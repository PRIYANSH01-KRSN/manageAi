// Deadline-Aware Cognitive Study Planner
//
// Pure, dependency-free planning engine shared by the React client and the Express
// server. Scored placement across a multi-day horizon:
//   1. Build per-day 5-minute availability + energy grid (chronotype curve, learned
//      fatigue, sleep inertia, post-class dip) and block real life: classes, habits,
//      check-in commitments, evening plans, protected leisure, wind-down, off days.
//   2. Apply the day's context from the morning check-in: Full / Light / Recovery mode,
//      Plan A / B / C, available hours, mood-aware distraction buffers.
//   3. Order tasks by deadline slack + importance (least-slack-first), respecting
//      prerequisites (learn → practice → revise).
//   4. Place work chunk-by-chunk at the slot maximising energy↔difficulty fit,
//      urgency-weighted earliness, load balance, distributed practice and interleaving,
//      under a daily focus cap with a flex reserve for overruns.
//   5. Add spaced-recall reviews, flex blocks, per-session coaching, deadline pace,
//      feasibility and plan-specific tips.
import { CHRONOTYPES } from '../constants/initialData.js';
import { calibrationRatioFor } from './estimationEngine.js';
import { buildTaskCoaching } from './taskCoach.js';

const SLOT = 5; // minutes per grid slot
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const QUADRANT_IMPORTANCE = { Q1: 1.0, Q2: 0.8, Q3: 0.45, Q4: 0.15 };
const DEFAULT_DAILY_CAP = 300; // 5h of real deep focus is a sustainable student ceiling

export const DAY_MODES = {
  FULL: { id: 'FULL', label: 'Full day', capFactor: 1, maxSession: null },
  LIGHT: { id: 'LIGHT', label: 'Light day', capFactor: 0.6, maxSession: 20 },
  RECOVERY: { id: 'RECOVERY', label: 'Recovery day', capFactor: 0.2, maxSession: 15 },
};

export const PLAN_VARIANTS = {
  A: { id: 'A', label: 'Plan A · Full plan', capFactor: 1, mustDoOnly: false },
  B: { id: 'B', label: 'Plan B · Must-dos only', capFactor: 0.6, mustDoOnly: true },
  C: { id: 'C', label: 'Plan C · 45-min minimum', capMinutes: 45, mustDoOnly: true },
};

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatMinutesToTime(minutes) {
  const norm = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}`;
}

export function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function roundUp(n, step) {
  return Math.ceil(n / step) * step;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

const hoursLabel = (m) => `${Math.round(m / 6) / 10}h`;

/* ------------------------------------------------------------------ */
/* Energy model                                                        */
/* ------------------------------------------------------------------ */

// 24-entry hourly energy curve (0..1) derived from the chronotype buckets, smoothed so
// adjacent hours blend instead of jumping between categories.
export function buildHourlyEnergyCurve(chronotypeKey, energyProfile = null) {
  const chrono = CHRONOTYPES[chronotypeKey] || CHRONOTYPES.BALANCED;
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (chrono.peakHours.includes(h)) return 1.0;
    if (chrono.mediumHours.includes(h)) return 0.7;
    if (chrono.slumpHours.includes(h)) return 0.35;
    if (chrono.windDownHours.includes(h)) return 0.25;
    return 0.5;
  });

  // A personal energy profile (peak / dip / second wind) overrides the generic chronotype.
  const hoursIn = (start, end) => {
    if (!start || !end) return [];
    const s = Math.floor(parseTimeToMinutes(start) / 60);
    const e = Math.ceil(parseTimeToMinutes(end) / 60);
    const out = [];
    for (let h = s; h !== e % 24 && out.length < 24; h = (h + 1) % 24) out.push(h);
    return out;
  };
  if (energyProfile) {
    hoursIn(energyProfile.peakStart, energyProfile.peakEnd).forEach((h) => (raw[h] = 1.0));
    hoursIn(energyProfile.secondWindStart, energyProfile.secondWindEnd).forEach((h) => (raw[h] = Math.max(raw[h], 0.85)));
    hoursIn(energyProfile.dipStart, energyProfile.dipEnd).forEach((h) => (raw[h] = 0.3));
  }
  return raw.map((v, h) => 0.6 * v + 0.2 * raw[(h + 23) % 24] + 0.2 * raw[(h + 1) % 24]);
}

// Learns which hours actually work for this student from session reviews.
// Bayesian-smoothed completion rate → multiplier in [0.75, 1.2].
function learnHourAdjustments(reviewHistory = []) {
  const stats = {};
  reviewHistory.forEach((r) => {
    if (r.hourOfDay === undefined || r.hourOfDay === null) return;
    const h = Number(r.hourOfDay);
    stats[h] = stats[h] || { done: 0, total: 0 };
    stats[h].total += 1;
    if (r.status === 'COMPLETED') stats[h].done += 1;
  });
  const adj = {};
  Object.entries(stats).forEach(([h, s]) => {
    if (s.total < 2) return;
    const rate = (s.done + 1.5) / (s.total + 2);
    adj[h] = 0.75 + 0.45 * rate;
  });
  return adj;
}

/* ------------------------------------------------------------------ */
/* Day grid                                                            */
/* ------------------------------------------------------------------ */

const EVENING_PLANS = {
  out: { title: '🎉 Evening out', from: '18:30' },
  family: { title: '🏠 Family / personal time', from: '19:00' },
  gym: { title: '🏃 Exercise', from: '18:00', minutes: 75 },
};

function buildDayGrid({ date, dayIndex, userHabits, fixedSchedule, curve, fatigueHours, hourAdj, nowMin, ctx, dayContext }) {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const wakeMin = parseTimeToMinutes((isWeekend && userHabits.weekendWakeTime) || userHabits.wakeTime || '07:30');
  let sleepMin = parseTimeToMinutes((isWeekend && userHabits.weekendSleepTime) || userHabits.sleepTime || '23:30');
  if (sleepMin <= wakeMin) sleepMin += 1440; // bedtime after midnight (night owls)

  const slotCount = Math.ceil((sleepMin - wakeMin) / SLOT);
  const slotStart = (i) => wakeMin + i * SLOT;
  const slots = Array.from({ length: slotCount }, (_, i) => {
    const m = slotStart(i);
    const hour = Math.floor((m % 1440) / 60);
    let energy = curve[hour];
    if (fatigueHours.includes(hour)) energy *= 0.5;
    if (hourAdj[hour]) energy *= hourAdj[hour];
    if (m - wakeMin < 60) energy *= 0.75; // sleep inertia
    return { min: m, energy: clamp(energy, 0.05, 1), free: true, gap: false, late: false };
  });

  const blocks = [];
  const markBlocked = (start, end) => {
    for (let i = 0; i < slotCount; i++) {
      const m = slotStart(i);
      if (m + SLOT > start && m < end) slots[i].free = false;
    }
  };
  const addBlock = (block) => {
    if (block.endMin <= block.startMin) return;
    blocks.push(block);
    markBlocked(block.startMin, block.endMin);
  };
  // Map a clock time into this day's frame (handles post-midnight times for late sleepers).
  const frameTime = (t) => {
    let m = parseTimeToMinutes(t);
    if (m < wakeMin && m + 1440 < sleepMin) m += 1440;
    return m;
  };

  // Habits repeat every day.
  (userHabits.habits || []).forEach((hb) => {
    const s = frameTime(hb.startTime);
    let e = frameTime(hb.endTime);
    if (e <= s) e += 1440;
    addBlock({ type: 'HABIT', title: hb.name, startMin: s, endMin: e });
  });

  // Wind-down before sleep is never study time.
  const windDown = clamp(Number(userHabits.windDownMinutes ?? 45), 0, 120);
  const windDownStart = sleepMin - windDown;
  if (windDown > 0) addBlock({ type: 'WIND_DOWN', title: '🌙 Wind-down — screens off, no study', startMin: windDownStart, endMin: sleepMin });

  // Evening plans from the daily check-in replace generic leisure.
  const evening = EVENING_PLANS[dayContext?.eveningPlan];
  if (evening) {
    const s = Math.min(frameTime(evening.from), windDownStart);
    addBlock({ type: 'PERSONAL', title: evening.title, startMin: s, endMin: evening.minutes ? s + evening.minutes : windDownStart });
  }

  // Protected leisure is planned time, not leftovers.
  let leisure = clamp(Number(userHabits.leisureMinutes ?? 60), 0, 240);
  if (dayContext?.eveningPlan === 'study') leisure = Math.min(leisure, 30);
  if (leisure > 0 && !(evening && !evening.minutes)) {
    const end = userHabits.leisureTime === 'afternoon' ? frameTime('17:00') + leisure : windDownStart;
    addBlock({ type: 'LEISURE', title: '🎮 Protected leisure — guilt-free', startMin: end - leisure, endMin: end });
  }

  // Weekly half-day off.
  if (userHabits.weeklyOffDay !== null && userHabits.weeklyOffDay !== undefined && userHabits.weeklyOffDay !== '' && Number(userHabits.weeklyOffDay) === dayOfWeek) {
    addBlock({ type: 'OFF', title: '🌴 Weekly half-day off — recharge', startMin: Math.max(frameTime('14:00'), wakeMin), endMin: windDownStart });
  }

  // Personal commitments reported in today's check-in.
  (dayContext?.busyBlocks || []).forEach((b) => {
    const s = frameTime(b.startTime);
    let e = frameTime(b.endTime);
    if (e <= s) e += 1440;
    addBlock({ type: 'PERSONAL', title: `📌 ${b.title || 'Personal commitment'}`, startMin: s, endMin: e });
  });

  const classes = fixedSchedule
    .filter((ev) => Number(ev.dayOfWeek) === dayOfWeek)
    .map((ev) => ({ ...ev, startMin: parseTimeToMinutes(ev.startTime), endMin: parseTimeToMinutes(ev.endTime) }))
    .filter((ev) => ev.endMin > ev.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  let classMinutes = 0;
  classes.forEach((ev, idx) => {
    classMinutes += ev.endMin - ev.startMin;
    addBlock({ type: 'FIXED_CLASS', title: ev.title, location: ev.location, startMin: ev.startMin, endMin: ev.endMin });

    const next = classes[idx + 1];
    const bufferEnd = Math.min(ev.endMin + 20, next ? next.startMin : Infinity);
    if (bufferEnd > ev.endMin) {
      addBlock({ type: 'POST_CLASS_BUFFER', title: '🧠 Post-lecture decompression', startMin: ev.endMin, endMin: bufferEnd, isDecompression: true });
    }

    // Attention dips for an hour after lectures.
    slots.forEach((s) => {
      if (s.min >= bufferEnd && s.min < bufferEnd + 60) s.energy *= 0.85;
    });

    if (next && next.startMin > bufferEnd) {
      const gap = next.startMin - bufferEnd;
      if (ev.allowGapStudy && gap >= 25) {
        slots.forEach((s) => {
          if (s.min >= bufferEnd && s.min < next.startMin) s.gap = true;
        });
      } else {
        addBlock({ type: 'PROTECTED_GAP', title: '🌿 Free gap (rest & social)', startMin: bufferEnd, endMin: next.startMin });
      }
    }
  });

  // Morning routine: nobody starts deep work the minute they wake up.
  markBlocked(wakeMin, wakeMin + 30);

  // Late slots (last hour before wind-down) only suit light work.
  slots.forEach((s) => {
    if (s.min >= windDownStart - 60) s.late = true;
  });

  // Nothing can be scheduled in the past.
  if (nowMin !== null) markBlocked(wakeMin, roundUp(nowMin + 5, SLOT));

  // Prefix sum of energy for O(1) average-energy queries.
  const energyPrefix = [0];
  slots.forEach((s, i) => energyPrefix.push(energyPrefix[i] + s.energy));

  const freeMinutes = slots.filter((s) => s.free).length * SLOT;

  // Day context: mode, plan variant, available hours, mood-aware buffer.
  const mode = DAY_MODES[dayContext?.mode] || DAY_MODES.FULL;
  const variant = PLAN_VARIANTS[dayContext?.planVariant] || PLAN_VARIANTS.A;
  const flexFactor = 1 - clamp(Number(userHabits.flexPercent ?? 15), 0, 40) / 100;
  let cap = ctx.dailyCap * mode.capFactor * flexFactor;
  if (variant.capFactor) cap *= variant.capFactor;
  if (variant.capMinutes) cap = Math.min(cap, variant.capMinutes);
  if (mode.id === 'RECOVERY') cap = Math.min(cap, 60);
  if (dayContext?.availableMinutes !== undefined && dayContext?.availableMinutes !== null && dayContext.availableMinutes !== '') {
    cap = Math.min(cap, Number(dayContext.availableMinutes));
  }

  let bf = ctx.bufferFactor;
  if ((dayContext?.mood || 3) <= 2) bf *= 1.1;
  if ((dayContext?.energy || 3) <= 2) bf *= 1.05;
  if ((dayContext?.sleepQuality || 3) <= 2) bf *= 1.05;

  return {
    date,
    dateKey: toDateKey(date),
    dayIndex,
    dayOfWeek,
    wakeMin,
    sleepMin,
    windDownStart,
    slots,
    energyPrefix,
    blocks,
    classMinutes,
    freeMinutes,
    focusMinutes: 0,
    sessions: [],
    cap: Math.max(0, Math.round(cap)),
    bf,
    mode,
    variant,
    context: dayContext || null,
  };
}

function avgEnergy(day, i, n) {
  return (day.energyPrefix[i + n] - day.energyPrefix[i]) / n;
}

function isRunFree(day, i, n) {
  if (i + n > day.slots.length) return false;
  for (let k = i; k < i + n; k++) if (!day.slots[k].free) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Task helpers                                                        */
/* ------------------------------------------------------------------ */

export function inferDifficulty(task) {
  if (task.difficulty) return clamp(Number(task.difficulty), 1, 5);
  let d = 3;
  if (task.quadrant === 'Q3' || task.quadrant === 'Q4') d = 2;
  if ((task.confidence || 3) <= 2) d += 1;
  if (task.knowledgeLevel !== undefined && Number(task.knowledgeLevel) === 0) d += 1;
  if (task.taskType === 'admin') d = 1;
  if (task.taskType === 'revise') d = Math.min(d, 3);
  return clamp(d, 1, 5);
}

function isLearningTask(task) {
  if (task.taskType) return task.taskType === 'learn' || task.taskType === 'practice';
  const t = (task.title || '').toLowerCase();
  return task.category === 'academic' || /chapter|exam|lecture|concept|theory|unit|syllabus/.test(t);
}

function chunkLengthFor(task, day, userHabits, remaining) {
  const deep = userHabits.sessionStyle === 'deep';
  const d = inferDifficulty(task);
  let len = deep ? (d >= 4 ? 50 : 45) : d >= 4 ? 30 : 25;
  if (day.mode.maxSession) len = Math.min(len, day.mode.maxSession);
  if (task.microSprints) len = Math.min(len, 15); // after distraction stalls: short sprints
  if (remaining <= len + 10) return remaining; // finish it in one go
  if (remaining - len < 15) return roundUp(remaining / 2, SLOT); // avoid a sliver at the end
  return len;
}

/* ------------------------------------------------------------------ */
/* Placement scoring                                                   */
/* ------------------------------------------------------------------ */

function chainedFocusBefore(day, startMin) {
  // Minutes of near-continuous focus (≤15m breaks) that would end right before startMin.
  let total = 0;
  let cursor = startMin;
  const sorted = [...day.sessions].sort((a, b) => b.endMin - a.endMin);
  for (const s of sorted) {
    if (s.endMin > cursor) continue;
    if (cursor - s.endMin > 15) break;
    total += s.endMin - s.startMin;
    cursor = s.startMin;
  }
  return total;
}

function scoreCandidate({ day, i, n, draft, urgency, ctx }) {
  const startMin = day.slots[i].min;
  const endMin = startMin + n * SLOT;
  const d = draft.difficulty / 5;
  const e = avgEnergy(day, i, n);

  // Hard work → high energy. Easy work → avoid burning peak hours.
  let score = d * e + (1 - d) * (1 - e) * 0.8;

  // Urgent tasks are pulled earlier in the horizon; relaxed ones float.
  score -= day.dayIndex * (0.03 + 0.22 * urgency);
  score -= (startMin - day.wakeMin) * 0.00004;

  // Balance load across days.
  score -= (day.focusMinutes / Math.max(60, ctx.dailyCap)) * 0.35;

  // Continuity: a step should follow soon after the step it builds on (same or next day).
  if (draft.anchorDay !== undefined && draft.anchorDay !== null) {
    score -= Math.max(0, day.dayIndex - draft.anchorDay) * 0.2;
  }

  // Keep chains moving: when more work is queued behind this step, every idle hour
  // before it pushes the whole chain later — so prefer earlier slots (more so near a deadline).
  if (draft.chainContinues && draft.earliestAbs !== undefined) {
    const idleHours = Math.max(0, day.dayIndex * 1440 + startMin - draft.earliestAbs) / 60;
    score -= Math.min(idleHours, 24) * 0.008 * (0.5 + urgency);
  }

  // Distributed practice: discourage stacking the same task on one day unless urgent.
  const sameTaskToday = day.sessions.filter((s) => s.taskId === draft.taskId).length;
  score -= sameTaskToday * 0.18 * (1 - urgency);

  // Interleave subjects; avoid back-to-back same subject on different tasks.
  const subject = draft.task.subject || draft.task.category;
  const prev = day.sessions.find((s) => s.endMin <= startMin && startMin - s.endMin <= 15);
  if (prev && subject && (prev.task.subject || prev.task.category) === subject && prev.taskId !== draft.taskId) {
    score -= 0.06;
  }

  // Enforce a real break after ~110 min of chained deep work.
  if (chainedFocusBefore(day, startMin) + draft.rawMinutes > 110) score -= 0.4;

  // Late evening: calm, light work only.
  if (day.slots[i + n - 1].late) score -= draft.difficulty >= 4 ? 0.3 : 0.08;

  // Light / recovery days: steer away from heavy tasks unless they're must-dos.
  if (day.mode.id !== 'FULL' && draft.difficulty >= 4 && !draft.mustDo) score -= 0.25;

  // Light work fits nicely into between-class gaps.
  if (day.slots[i].gap) score += draft.difficulty <= 2 ? 0.12 : -0.15;

  // Sessions placed right before a fixed class risk overrunning into it.
  const nextBlock = day.blocks.find((b) => b.startMin >= endMin && b.type === 'FIXED_CLASS');
  if (nextBlock && nextBlock.startMin - endMin < 10) score -= 0.05;

  return score;
}

function blockSlotsFor(day, i, rawMinutes) {
  // Evening sessions get a slightly larger distraction buffer.
  const hour = Math.floor((day.slots[i].min % 1440) / 60);
  const bf = day.bf * (hour >= 20 || hour < 5 ? 1.1 : 1);
  return roundUp(rawMinutes * bf, SLOT) / SLOT;
}

function bestSlotInDay({ day, draft, earliest, urgency, ctx }) {
  let best = null;
  for (let i = 0; i < day.slots.length; i++) {
    const slot = day.slots[i];
    if (!slot.free) continue;
    if (earliest && day.dayIndex === earliest.dayIndex && slot.min < earliest.min) continue;
    const n = blockSlotsFor(day, i, draft.rawMinutes);
    if (!isRunFree(day, i, n)) continue;
    if (draft.difficulty >= 4 && slot.gap) continue;
    const score = scoreCandidate({ day, i, n, draft, urgency, ctx });
    if (!best || score > best.score) best = { day, i, n, score };
  }
  return best;
}

function commitPlacement({ best, draft }) {
  const { day, i, n } = best;
  const startMin = day.slots[i].min;
  const endMin = startMin + n * SLOT;
  for (let k = i; k < i + n; k++) day.slots[k].free = false;

  // Reserve a recovery break (longer after long blocks) when it fits.
  const breakLen = n * SLOT >= 45 ? 10 : 5;
  const breakSlots = breakLen / SLOT;
  let breakEnd = endMin;
  if (isRunFree(day, i + n, breakSlots)) {
    for (let k = i + n; k < i + n + breakSlots; k++) day.slots[k].free = false;
    breakEnd = endMin + breakLen;
  }

  const placed = { ...draft, dayIndex: day.dayIndex, dateKey: day.dateKey, startMin, endMin, breakEnd, energy: avgEnergy(day, i, n) };
  day.sessions.push(placed);
  day.focusMinutes += draft.rawMinutes;
  return placed;
}

// Reserve a visible flex block after the day's last session to absorb overruns.
function reserveFlex(day, userHabits) {
  if (day.focusMinutes <= 0) return;
  const pct = clamp(Number(userHabits.flexPercent ?? 15), 0, 40) / 100;
  if (pct === 0) return;
  const len = clamp(roundUp(day.focusMinutes * pct / (1 - pct), SLOT), 15, 60);
  const n = len / SLOT;
  const lastEnd = Math.max(...day.sessions.map((s) => s.breakEnd));
  const order = [...day.slots.keys()].sort((a, b) => {
    const da = day.slots[a].min >= lastEnd ? day.slots[a].min - lastEnd : 10000 + lastEnd - day.slots[a].min;
    const db = day.slots[b].min >= lastEnd ? day.slots[b].min - lastEnd : 10000 + lastEnd - day.slots[b].min;
    return da - db;
  });
  for (const i of order) {
    if (isRunFree(day, i, n)) {
      for (let k = i; k < i + n; k++) day.slots[k].free = false;
      day.blocks.push({ type: 'FLEX', title: '🧩 Flex buffer — catch up if something ran over, otherwise free time', startMin: day.slots[i].min, endMin: day.slots[i].min + len });
      return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

function energyLabel(e) {
  if (e >= 0.8) return 'PEAK_FOCUS';
  if (e >= 0.6) return 'MEDIUM_CONCEPTUAL';
  if (e >= 0.4) return 'SHALLOW';
  return 'LOW_ENERGY';
}

function explainPlacement(s, day) {
  const lvl = energyLabel(s.energy);
  if (s.kind === 'REVIEW') return `Spaced recall (${s.reviewLabel}) — locks in what you learned`;
  if (day.mode.id !== 'FULL') return `${day.mode.label}: shorter, gentler session`;
  if (s.difficulty >= 4 && lvl === 'PEAK_FOCUS') return 'Hardest work matched to your peak-energy window';
  if (s.difficulty >= 4) return 'Demanding task placed in the best energy slot left before its deadline';
  if (s.difficulty <= 2 && lvl !== 'PEAK_FOCUS') return 'Light task kept out of your peak hours';
  if (s.totalParts > 1) return `Part ${s.part}/${s.totalParts} — spread out for better retention`;
  return 'Balanced slot by energy, urgency and daily load';
}

export function buildStudyPlan({
  tasks = [],
  userHabits = {},
  fixedSchedule = [],
  learnedFatigueHours = [],
  learnedBufferInflation = 1.0,
  reviewHistory = [],
  dayContexts = {},
  calibration = {},
  horizonDays = 7,
  now = new Date(),
} = {}) {
  const horizon = clamp(Number(horizonDays) || 7, 1, 21);
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const curve = buildHourlyEnergyCurve(userHabits.chronotype, userHabits.energyProfile);
  const hourAdj = learnHourAdjustments(reviewHistory);
  const ctx = {
    dailyCap: clamp(Number(userHabits.dailyFocusCapMinutes) || DEFAULT_DAILY_CAP, 60, 720),
    bufferFactor: clamp((userHabits.distractionFactor || 1.25) * (learnedBufferInflation || 1), 1, 2.2),
  };

  const days = Array.from({ length: horizon }, (_, idx) => {
    const date = addDays(today, idx);
    return buildDayGrid({
      date,
      dayIndex: idx,
      userHabits,
      fixedSchedule,
      curve,
      fatigueHours: learnedFatigueHours,
      hourAdj,
      nowMin: idx === 0 ? nowMin : null,
      ctx,
      dayContext: dayContexts[toDateKey(date)],
    });
  });

  const daysUntil = (dateStr) => Math.round((startOfDay(new Date(`${dateStr}T00:00:00`)) - today) / 86400000);

  const deadlineIndexFor = (task) => {
    if (task.deadline) {
      // Finish the day *before* the due/exam date so the last day is for review, not cramming.
      // Recall reviews themselves may land on the exam morning.
      const reviewOk = task.meta?.kind === 'review' ? 0 : 1;
      return clamp(daysUntil(task.deadline) - reviewOk, 0, horizon - 1);
    }
    if (task.quadrant === 'Q1') return Math.min(1, horizon - 1);
    if (task.quadrant === 'Q3') return Math.min(2, horizon - 1);
    return horizon - 1;
  };

  // Focus minutes actually usable up to a day index.
  const capacityUntil = (idx) =>
    days.slice(0, idx + 1).reduce((acc, d) => acc + Math.min(d.freeMinutes / d.bf, d.cap), 0);

  const active = tasks.filter((t) => t && t.status !== 'COMPLETED');
  const plans = active
    .map((task) => {
      const ratio = calibrationRatioFor(task, calibration);
      const estimate = Number(task.estimatedMinutes) || 45;
      const remainingEstimate = Math.max(0, estimate - (task.completedMinutes || 0));
      const remaining = roundUp(remainingEstimate * ratio, SLOT);
      return {
        task,
        ratio,
        remaining: remainingEstimate >= 5 ? remaining : 0,
        deadlineIdx: deadlineIndexFor(task),
        importance: QUADRANT_IMPORTANCE[task.quadrant] ?? 0.6,
        weight: clamp((task.weightage || 3) / 5, 0, 1),
        mustDo: task.quadrant === 'Q1' || (task.deadline && daysUntil(task.deadline) <= 2),
        placed: [],
      };
    })
    .filter((p) => p.remaining > 0);

  // Prerequisites: dependsOn may be one id, an array, or a comma-separated string.
  const byId = new Map(plans.map((p) => [p.task.id, p]));
  const depsOf = (task) =>
    [].concat(task.dependsOn || []).flatMap((d) => String(d).split(',')).map((d) => d.trim()).filter((d) => byId.has(d));

  // Critical path: urgency counts all the work that still has to follow a task (its
  // longest chain of dependents), and the chain's earliest deadline. A 5-minute preview
  // that unlocks 6 hours of lecture work is urgent; on its own it wouldn't look it.
  const children = new Map();
  plans.forEach((p) => depsOf(p.task).forEach((id) => children.set(id, [...(children.get(id) || []), p])));
  const chainMemo = new Map();
  const chainOf = (p, stack = new Set()) => {
    if (chainMemo.has(p)) return chainMemo.get(p);
    if (stack.has(p)) return { minutes: p.remaining, deadlineIdx: p.deadlineIdx }; // cycle guard
    stack.add(p);
    let minutes = 0;
    let deadlineIdx = p.deadlineIdx;
    (children.get(p.task.id) || []).forEach((child) => {
      const c = chainOf(child, stack);
      minutes = Math.max(minutes, c.minutes);
      deadlineIdx = Math.min(deadlineIdx, c.deadlineIdx);
    });
    stack.delete(p);
    const result = { minutes: p.remaining + minutes, deadlineIdx };
    chainMemo.set(p, result);
    return result;
  };

  plans.forEach((p) => {
    const chain = chainOf(p);
    p.deadlineIdx = chain.deadlineIdx; // a prerequisite must finish before its dependents' deadline
    const capacity = capacityUntil(p.deadlineIdx);
    p.slackRatio = capacity > 0 ? chain.minutes / capacity : 9;
    p.urgency = clamp(0.25 * (1 - p.deadlineIdx / horizon) + 0.75 * p.slackRatio + (p.task.quadrant === 'Q1' ? 0.2 : 0), 0, 1);
    p.priority = 0.45 * p.urgency + 0.4 * p.importance + 0.15 * p.weight + (p.mustDo ? 0.1 : 0);
  });
  plans.sort((a, b) => b.priority - a.priority);
  const ordered = [];
  const visiting = new Set();
  const visit = (p) => {
    if (ordered.includes(p) || visiting.has(p)) return;
    visiting.add(p);
    depsOf(p.task).forEach((id) => visit(byId.get(id)));
    ordered.push(p);
  };
  plans.forEach(visit);

  const unscheduled = [];

  ordered.forEach((p) => {
    const deps = depsOf(p.task).map((id) => byId.get(id));
    // If a prerequisite couldn't be fully scheduled, this step has to wait too.
    const blocked = deps.find((d) => d.placed.length === 0 || unscheduled.some((u) => u.taskId === d.task.id));
    if (blocked) {
      unscheduled.push({ taskId: p.task.id, title: p.task.title, minutes: p.remaining, reason: `Waiting for "${blocked.task.title}" to fit in the plan` });
      return;
    }
    let earliest = null;
    deps.forEach((d) => {
      const last = d.placed.reduce((a, s) => (!a || s.dayIndex > a.dayIndex || (s.dayIndex === a.dayIndex && s.breakEnd > a.breakEnd) ? s : a), null);
      if (last && (!earliest || last.dayIndex > earliest.dayIndex || (last.dayIndex === earliest.dayIndex && last.breakEnd > earliest.min))) {
        earliest = { dayIndex: last.dayIndex, min: last.breakEnd };
      }
    });
    // Spacing rules, e.g. a recall review at least one day after learning.
    const gapDays = Number(p.task.meta?.minGapDays) || 0;
    if (earliest && gapDays > 0) earliest = { dayIndex: earliest.dayIndex + gapDays, min: 0 };
    const depAnchorDay = earliest ? earliest.dayIndex : null;
    let remaining = p.remaining;

    while (remaining >= 5) {
      let best = null;
      let bestRaw = 0;
      for (const day of days) {
        if (day.dayIndex > p.deadlineIdx) break;
        if (earliest && day.dayIndex < earliest.dayIndex) continue;
        if (day.variant.mustDoOnly && !p.mustDo) continue;
        const room = day.cap - day.focusMinutes;
        let raw = chunkLengthFor(p.task, day, userHabits, remaining);
        if (raw > room) {
          if (room < 15) continue;
          raw = Math.floor(room / SLOT) * SLOT;
        }
        const draft = {
          taskId: p.task.id,
          task: p.task,
          kind: 'WORK',
          rawMinutes: raw,
          difficulty: inferDifficulty(p.task),
          mustDo: p.mustDo,
          anchorDay: depAnchorDay,
          chainContinues: (children.get(p.task.id) || []).length > 0 || remaining > raw,
          earliestAbs: earliest ? earliest.dayIndex * 1440 + earliest.min : nowMin,
        };
        const candidate = bestSlotInDay({ day, draft, earliest, urgency: p.urgency, ctx });
        if (candidate && (!best || candidate.score > best.score)) {
          best = { ...candidate, draft };
          bestRaw = raw;
        }
      }
      if (!best) {
        unscheduled.push({
          taskId: p.task.id,
          title: p.task.title,
          minutes: remaining,
          reason: p.task.deadline
            ? `Not enough free focus time before ${p.task.deadline}`
            : 'No free focus time left in this planning window',
        });
        break;
      }
      const placed = commitPlacement({ best, draft: best.draft });
      p.placed.push(placed);
      remaining -= bestRaw;
      earliest = { dayIndex: placed.dayIndex, min: placed.breakEnd };
    }

    // Number parts chronologically.
    const sorted = [...p.placed].sort((a, b) => a.dayIndex - b.dayIndex || a.startMin - b.startMin);
    sorted.forEach((s, idx) => {
      s.part = idx + 1;
      s.totalParts = sorted.length;
    });

    // Spaced retrieval practice, anchored to first exposure and kept on/before the exam day.
    const first = sorted[0];
    if (first && isLearningTask(p.task) && p.remaining >= 30 && !p.task.meta?.noAutoReview) {
      const lastReviewIdx = p.task.deadline ? Math.min(daysUntil(p.task.deadline), horizon - 1) : horizon - 1;
      [{ offset: 1, label: '+1 day' }, { offset: 3, label: '+3 days' }].forEach(({ offset, label }) => {
        const targetIdx = Math.min(first.dayIndex + offset, lastReviewIdx);
        if (targetIdx <= first.dayIndex) return;
        const day = days[targetIdx];
        if (!day || day.sessions.some((s) => s.kind === 'REVIEW' && s.taskId === p.task.id)) return;
        if (day.focusMinutes + 15 > day.cap + 15) return; // reviews may dip into the flex reserve
        const draft = { taskId: p.task.id, task: p.task, kind: 'REVIEW', reviewLabel: label, rawMinutes: 15, difficulty: 2, part: 0, totalParts: sorted.length, mustDo: false };
        const best = bestSlotInDay({ day, draft, earliest: null, urgency: 0.5, ctx });
        if (best) commitPlacement({ best, draft });
      });
    }
  });

  days.forEach((day) => reserveFlex(day, userHabits));

  /* ---------------- Output shaping ---------------- */

  const planById = new Map(plans.map((p) => [p.task.id, p]));

  const toBlock = (s, day) => {
    const id = s.kind === 'REVIEW' ? `review-${s.taskId}-${s.dateKey}` : `slot-${s.taskId}-${s.dateKey}-${s.startMin}`;
    const titleSuffix = s.kind === 'REVIEW' ? ' — Recall Review' : s.totalParts > 1 ? ` (Part ${s.part}/${s.totalParts})` : '';
    const ratio = planById.get(s.taskId)?.ratio || 1;
    return {
      id,
      taskId: s.taskId,
      taskTitle: `${s.task.title}${titleSuffix}`,
      category: s.task.category,
      subject: s.task.subject,
      quadrant: s.task.quadrant,
      taskType: s.task.taskType,
      kind: s.kind,
      part: s.part,
      totalParts: s.totalParts,
      difficulty: s.difficulty,
      mustDo: s.mustDo,
      dateKey: s.dateKey,
      dayIndex: s.dayIndex,
      startMin: s.startMin,
      endMin: s.endMin,
      startTime: formatMinutesToTime(s.startMin),
      endTime: formatMinutesToTime(s.endMin),
      rawDuration: s.rawMinutes,
      // Progress credited to the task in *estimate* units (undo the learned pace ratio).
      progressMinutes: s.kind === 'REVIEW' ? 0 : Math.round(s.rawMinutes / ratio),
      bufferMinutes: s.endMin - s.startMin - s.rawMinutes,
      energyLevel: energyLabel(s.energy),
      reason: explainPlacement(s, day),
      timeNote: s.task.meta?.timeNote || null,
      groupTitle: s.task.meta?.groupTitle || null,
      status: 'SCHEDULED',
      coaching: buildTaskCoaching(s.task, { startMin: s.startMin, minutes: s.rawMinutes, dayContext: day.context }),
      taskData: s.task,
    };
  };

  const dayViews = days.map((day) => {
    const sessions = day.sessions.map((s) => toBlock(s, day)).sort((a, b) => a.startMin - b.startMin);
    const breaks = day.sessions
      .filter((s) => s.breakEnd > s.endMin)
      .map((s) => ({
        id: `break-${day.dateKey}-${s.endMin}`,
        isBreak: true,
        title: s.breakEnd - s.endMin >= 10 ? '☕ Recovery break — move, hydrate, no phone' : '☕ Micro-break',
        startMin: s.endMin,
        endMin: s.breakEnd,
        startTime: formatMinutesToTime(s.endMin),
        endTime: formatMinutesToTime(s.breakEnd),
        energyLevel: 'REST',
      }));
    const fixed = day.blocks.map((b) => ({
      id: `block-${day.dateKey}-${b.startMin}-${b.type}`,
      title: b.title,
      startMin: b.startMin,
      endMin: b.endMin,
      startTime: formatMinutesToTime(b.startMin),
      endTime: formatMinutesToTime(b.endMin),
      type: b.type,
      location: b.location,
      isFixed: true,
      isDecompression: b.isDecompression,
    }));
    const loadRatio = ctx.dailyCap ? day.focusMinutes / ctx.dailyCap : 0;
    return {
      dateKey: day.dateKey,
      dayIndex: day.dayIndex,
      dayOfWeek: day.dayOfWeek,
      label: day.dayIndex === 0 ? 'Today' : day.dayIndex === 1 ? 'Tomorrow' : `${DAY_NAMES[day.dayOfWeek]} ${day.date.getDate()}`,
      shortLabel: day.dayIndex === 0 ? 'Today' : `${DAY_NAMES[day.dayOfWeek]} ${day.date.getDate()}`,
      mode: day.mode.id,
      planVariant: day.variant.id,
      focusMinutes: day.focusMinutes,
      classMinutes: day.classMinutes,
      capacityMinutes: day.cap,
      leisureMinutes: day.blocks.filter((b) => b.type === 'LEISURE' || b.type === 'OFF').reduce((a, b) => a + b.endMin - b.startMin, 0),
      load: loadRatio > 0.85 ? 'heavy' : loadRatio > 0.45 ? 'balanced' : 'light',
      sessions,
      items: [...sessions, ...breaks, ...fixed].sort((a, b) => a.startMin - b.startMin),
    };
  });

  const allSessions = dayViews.flatMap((d) => d.sessions);
  const todaySessions = dayViews[0]?.sessions.filter((s) => s.endMin > nowMin) || [];
  const nextSession = todaySessions[0] || null;

  const requiredMinutes = plans.reduce((a, p) => a + p.remaining, 0);
  const availableMinutes = Math.round(capacityUntil(horizon - 1));
  const unscheduledMinutes = unscheduled.reduce((a, u) => a + u.minutes, 0);
  const atRisk = plans
    .filter((p) => p.task.deadline && unscheduled.some((u) => u.taskId === p.task.id))
    .map((p) => ({
      taskId: p.task.id,
      title: p.task.title,
      deadline: p.task.deadline,
      neededMinutes: p.remaining,
      shortByMinutes: unscheduled.find((u) => u.taskId === p.task.id)?.minutes || 0,
    }));

  // Deadline pace: when each deadline task will be finished relative to its due date.
  const pace = plans
    .filter((p) => p.task.deadline)
    .map((p) => {
      const work = p.placed;
      const last = work.reduce((m, s) => Math.max(m, s.dayIndex), -1);
      const short = unscheduled.find((u) => u.taskId === p.task.id);
      const daysLeft = daysUntil(p.task.deadline);
      const estimate = Number(p.task.estimatedMinutes) || 45;
      return {
        taskId: p.task.id,
        title: p.task.title,
        deadline: p.task.deadline,
        daysLeft,
        progressPct: Math.round(((p.task.completedMinutes || 0) / estimate) * 100),
        finishLabel: last >= 0 ? dayViews[last].label : null,
        status: short ? 'AT_RISK' : p.slackRatio > 0.7 ? 'TIGHT' : 'ON_TRACK',
        shortByMinutes: short?.minutes || 0,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const feasibility = {
    requiredMinutes,
    availableMinutes,
    scheduledMinutes: requiredMinutes - unscheduledMinutes,
    unscheduledMinutes,
    dailyCapMinutes: ctx.dailyCap,
    avgDailyFocusMinutes: Math.round(dayViews.reduce((a, d) => a + d.focusMinutes, 0) / horizon),
    status: unscheduledMinutes > 0 ? 'OVERLOADED' : requiredMinutes > availableMinutes * 0.8 ? 'TIGHT' : 'OK',
    atRisk,
  };

  const todayView = dayViews[0];
  const mission = todayView
    ? {
        mode: todayView.mode,
        planVariant: todayView.planVariant,
        sessionCount: todaySessions.length,
        mustDoCount: todaySessions.filter((s) => s.mustDo).length,
        focusMinutes: todaySessions.reduce((a, s) => a + s.rawDuration, 0),
        endsAt: todaySessions.length ? todaySessions[todaySessions.length - 1].endTime : null,
        firstSession: nextSession,
      }
    : null;

  const plan = { generatedAt: now.toISOString(), horizonDays: horizon, days: dayViews, sessions: allSessions, nextSession, unscheduled, feasibility, pace, mission };
  plan.tips = generatePlanTips({ plan, userHabits, curve, learnedFatigueHours, bufferFactor: ctx.bufferFactor, reviewHistory });
  return plan;
}

/**
 * Free focus minutes from now until the day before `dateKey` (used by the battle-plan wizard).
 */
export function focusCapacityUntil(params, dateKey) {
  const today = startOfDay(params.now || new Date());
  const diff = Math.round((startOfDay(new Date(`${dateKey}T00:00:00`)) - today) / 86400000);
  if (diff <= 0) return 0;
  return buildStudyPlan({ ...params, tasks: [], horizonDays: diff }).feasibility.availableMinutes;
}

/* ------------------------------------------------------------------ */
/* Rule-based coaching tips (always available, no AI required)         */
/* ------------------------------------------------------------------ */

function skipPatterns(reviewHistory = []) {
  const buckets = { morning: [5, 12], afternoon: [12, 17], evening: [17, 21], night: [21, 29] };
  const stats = {};
  reviewHistory.forEach((r) => {
    if (r.hourOfDay === undefined || r.hourOfDay === null) return;
    const h = Number(r.hourOfDay) < 5 ? Number(r.hourOfDay) + 24 : Number(r.hourOfDay);
    const name = Object.keys(buckets).find((k) => h >= buckets[k][0] && h < buckets[k][1]);
    if (!name) return;
    stats[name] = stats[name] || { skipped: 0, total: 0 };
    stats[name].total += 1;
    if (r.status === 'NOT_DONE') stats[name].skipped += 1;
  });
  return Object.entries(stats)
    .filter(([, s]) => s.total >= 3 && s.skipped / s.total >= 0.6)
    .map(([name, s]) => ({ name, rate: Math.round((s.skipped / s.total) * 100) }));
}

export function generatePlanTips({ plan, userHabits = {}, curve, learnedFatigueHours = [], bufferFactor = 1.25, reviewHistory = [] }) {
  const tips = [];
  const { feasibility, days, nextSession, sessions } = plan;
  const today = days[0];

  if (nextSession) {
    tips.push({
      id: 'next',
      kind: 'action',
      text: `Start here: "${nextSession.taskTitle}" at ${nextSession.startTime}. First 2 minutes: ${nextSession.coaching.starter}`,
    });
  }

  if (today && today.mode !== 'FULL') {
    tips.push({
      id: 'mode',
      kind: 'insight',
      text: today.mode === 'LIGHT'
        ? 'Light day: shorter sessions and easier tasks first. Doing a little today keeps tomorrow from piling up — that\'s a win.'
        : 'Recovery day: one small session is enough. Rest is part of the plan, not a failure of it.',
    });
  }

  feasibility.atRisk.forEach((r) => {
    tips.push({
      id: `risk-${r.taskId}`,
      kind: 'warning',
      text: `"${r.title}" is short by ~${hoursLabel(r.shortByMinutes)} before ${r.deadline}. Use the Battle Plan triage to skim lower-weight parts, raise your daily focus cap, or move the deadline — don't plan on sleeping less.`,
    });
  });

  if (feasibility.status === 'OVERLOADED' && feasibility.atRisk.length === 0) {
    tips.push({
      id: 'overload',
      kind: 'warning',
      text: `${hoursLabel(feasibility.unscheduledMinutes)} of work doesn't fit in the next ${plan.horizonDays} days. Extend the planning window or prune low-priority tasks.`,
    });
  } else if (feasibility.status === 'TIGHT') {
    tips.push({ id: 'tight', kind: 'warning', text: 'This week is tight: protect your planned breaks and flex blocks — skipping them now usually costs more time later.' });
  }

  const hardAtPeak = sessions.filter((s) => s.difficulty >= 4 && s.energyLevel === 'PEAK_FOCUS');
  if (hardAtPeak.length > 0 && curve) {
    // Group peak hours into contiguous ranges, e.g. "10:00–13:00 & 16:00–19:00".
    const ranges = [];
    curve.forEach((v, h) => {
      if (v < 0.85) return;
      const last = ranges[ranges.length - 1];
      if (last && last.end === h) last.end = h + 1;
      else ranges.push({ start: h, end: h + 1 });
    });
    if (ranges.length) {
      const fmt = (h) => `${String(h % 24).padStart(2, '0')}:00`;
      tips.push({
        id: 'peak',
        kind: 'insight',
        text: `${hardAtPeak.length} of your hardest sessions sit in your peak window (${ranges.map((r) => `${fmt(r.start)}–${fmt(r.end)}`).join(' & ')}). Guard that time — no messages, no admin.`,
      });
    }
  }

  const reviews = sessions.filter((s) => s.kind === 'REVIEW');
  if (reviews.length > 0) {
    tips.push({
      id: 'spaced',
      kind: 'insight',
      text: `${reviews.length} spaced-recall reviews are scheduled. Do them closed-book: write what you remember first, then check — that's what makes it stick.`,
    });
  }

  skipPatterns(reviewHistory).forEach((p) => {
    tips.push({
      id: `pattern-${p.name}`,
      kind: 'insight',
      text: `Pattern spotted: you skip ${p.rate}% of ${p.name} sessions, so heavy work is being moved out of the ${p.name}. If that time is never realistic, block it as a habit.`,
    });
  });

  const heavyClassDay = days.find((d) => d.classMinutes >= 300);
  if (heavyClassDay) {
    tips.push({
      id: 'classday',
      kind: 'insight',
      text: `${heavyClassDay.label} has ${Math.round(heavyClassDay.classMinutes / 60)}h of classes, so it gets a lighter study load. Use evening time for review, not new material.`,
    });
  }

  if (today?.leisureMinutes > 0) {
    tips.push({ id: 'leisure', kind: 'insight', text: `${today.leisureMinutes} min of leisure is protected today. Enjoy it fully — guilt-free rest makes the next session sharper.` });
  }

  const wake = parseTimeToMinutes(userHabits.wakeTime || '07:30');
  let sleep = parseTimeToMinutes(userHabits.sleepTime || '23:30');
  if (sleep <= wake) sleep += 1440;
  const sleepHours = (1440 - (sleep - wake)) / 60;
  if (sleepHours < 7) {
    tips.push({ id: 'sleep', kind: 'warning', text: `You're planning ~${sleepHours.toFixed(1)}h of sleep. Memory consolidation happens during sleep — 7–9h will make your study hours count more.` });
  }

  if (learnedFatigueHours.length > 0) {
    tips.push({
      id: 'fatigue',
      kind: 'insight',
      text: `Learned from your reviews: ${learnedFatigueHours.map((h) => `${h}:00`).join(', ')} ${learnedFatigueHours.length > 1 ? 'are' : 'is'} low-energy for you, so only light work goes there.`,
    });
  }

  if (bufferFactor >= 1.5) {
    tips.push({ id: 'buffer', kind: 'insight', text: 'Your sessions run long often. Write a one-line "done means…" goal before each block to stop scope creep.' });
  }

  return tips.slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Compact summary for LLM coaching prompts                            */
/* ------------------------------------------------------------------ */

export function summarizePlanForAI(plan, userHabits = {}, todayContext = null) {
  return {
    profile: {
      chronotype: userHabits.chronotype || 'BALANCED',
      wakeTime: userHabits.wakeTime,
      sleepTime: userHabits.sleepTime,
      sessionStyle: userHabits.sessionStyle || 'pomodoro',
    },
    today: todayContext
      ? { mode: todayContext.mode, mood: todayContext.mood, energy: todayContext.energy, stress: todayContext.stress, eveningPlan: todayContext.eveningPlan }
      : null,
    feasibility: plan.feasibility,
    pace: plan.pace,
    days: plan.days.map((d) => ({
      day: d.label,
      mode: d.mode,
      classHours: Math.round(d.classMinutes / 6) / 10,
      focusHours: Math.round(d.focusMinutes / 6) / 10,
      sessions: d.sessions.map((s) => `${s.startTime} ${s.taskTitle} [${s.quadrant || 'Q2'}, difficulty ${s.difficulty}, ${s.energyLevel}]`),
    })),
    unscheduled: plan.unscheduled,
  };
}
