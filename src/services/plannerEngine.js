// Deadline-Aware Cognitive Study Planner
//
// Pure, dependency-free planning engine shared by the React client and the Express
// server. Replaces first-fit packing with scored placement across a multi-day horizon:
//   1. Build per-day 5-minute availability + energy grid (chronotype curve, fatigue
//      learning, sleep inertia, post-class dip, wind-down).
//   2. Split each task's *remaining* work into sessions sized to the student's
//      session style and the task's difficulty.
//   3. Order tasks by deadline slack + importance (least-slack-first).
//   4. Place each session at the slot that maximises: energy↔difficulty fit,
//      urgency-weighted earliness, day load balance, distributed practice and
//      subject interleaving — while respecting a daily deep-focus cap.
//   5. Add spaced-recall reviews (+1 day, +3 days) for learning tasks.
//   6. Report feasibility, at-risk deadlines and plan-specific tips.
import { CHRONOTYPES } from '../constants/initialData.js';

const SLOT = 5; // minutes per grid slot
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const QUADRANT_IMPORTANCE = { Q1: 1.0, Q2: 0.8, Q3: 0.45, Q4: 0.15 };
const DEFAULT_DAILY_CAP = 300; // 5h of real deep focus is a sustainable student ceiling

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

/* ------------------------------------------------------------------ */
/* Energy model                                                        */
/* ------------------------------------------------------------------ */

// 24-entry hourly energy curve (0..1) derived from the chronotype buckets, smoothed so
// adjacent hours blend instead of jumping between categories.
export function buildHourlyEnergyCurve(chronotypeKey) {
  const chrono = CHRONOTYPES[chronotypeKey] || CHRONOTYPES.BALANCED;
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (chrono.peakHours.includes(h)) return 1.0;
    if (chrono.mediumHours.includes(h)) return 0.7;
    if (chrono.slumpHours.includes(h)) return 0.35;
    if (chrono.windDownHours.includes(h)) return 0.25;
    return 0.5;
  });
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

function buildDayGrid({ date, dayIndex, userHabits, fixedSchedule, curve, fatigueHours, hourAdj, nowMin }) {
  const dayOfWeek = date.getDay();
  const wakeMin = parseTimeToMinutes(userHabits.wakeTime || '07:30');
  let sleepMin = parseTimeToMinutes(userHabits.sleepTime || '23:30');
  if (sleepMin <= wakeMin) sleepMin += 1440; // bedtime after midnight (night owls)

  const slotCount = Math.ceil((sleepMin - wakeMin) / SLOT);
  const slotStart = (i) => wakeMin + i * SLOT;
  const slots = Array.from({ length: slotCount }, (_, i) => {
    const m = slotStart(i);
    const hour = Math.floor((m % 1440) / 60);
    let energy = curve[hour];
    if (fatigueHours.includes(hour)) energy *= 0.5;
    if (hourAdj[hour]) energy *= hourAdj[hour];
    if (m - wakeMin < 30) energy *= 0.6; // sleep inertia
    if (sleepMin - m <= 60) energy *= 0.55; // wind-down
    return { min: m, energy: clamp(energy, 0.05, 1), free: true, gap: false, windDown: sleepMin - m <= 60 };
  });

  const blocks = [];
  const markBlocked = (start, end) => {
    for (let i = 0; i < slotCount; i++) {
      const m = slotStart(i);
      if (m + SLOT > start && m < end) slots[i].free = false;
    }
  };

  // Habits repeat every day; shift post-midnight habits into this day's frame.
  (userHabits.habits || []).forEach((hb) => {
    let s = parseTimeToMinutes(hb.startTime);
    let e = parseTimeToMinutes(hb.endTime);
    if (e <= s) e += 1440;
    if (s < wakeMin && s + 1440 < sleepMin) {
      s += 1440;
      e += 1440;
    }
    blocks.push({ type: 'HABIT', title: hb.name, startMin: s, endMin: e });
    markBlocked(s, e);
  });

  const classes = fixedSchedule
    .filter((ev) => Number(ev.dayOfWeek) === dayOfWeek)
    .map((ev) => ({ ...ev, startMin: parseTimeToMinutes(ev.startTime), endMin: parseTimeToMinutes(ev.endTime) }))
    .filter((ev) => ev.endMin > ev.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  let classMinutes = 0;
  classes.forEach((ev, idx) => {
    classMinutes += ev.endMin - ev.startMin;
    blocks.push({ type: 'FIXED_CLASS', title: ev.title, location: ev.location, startMin: ev.startMin, endMin: ev.endMin });
    markBlocked(ev.startMin, ev.endMin);

    const next = classes[idx + 1];
    const bufferEnd = Math.min(ev.endMin + 20, next ? next.startMin : Infinity);
    if (bufferEnd > ev.endMin) {
      blocks.push({ type: 'POST_CLASS_BUFFER', title: '🧠 Post-lecture decompression', startMin: ev.endMin, endMin: bufferEnd, isDecompression: true });
      markBlocked(ev.endMin, bufferEnd);
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
        blocks.push({ type: 'PROTECTED_GAP', title: '🌿 Free gap (rest & social)', startMin: bufferEnd, endMin: next.startMin });
        markBlocked(bufferEnd, next.startMin);
      }
    }
  });

  // Morning routine: nobody starts deep work the minute they wake up.
  markBlocked(wakeMin, wakeMin + 30);

  // Nothing can be scheduled in the past.
  if (nowMin !== null) markBlocked(wakeMin, roundUp(nowMin + 5, SLOT));

  // Prefix sum of energy for O(1) average-energy queries.
  const energyPrefix = [0];
  slots.forEach((s, i) => energyPrefix.push(energyPrefix[i] + s.energy));

  const freeMinutes = slots.filter((s) => s.free).length * SLOT;

  return {
    date,
    dateKey: toDateKey(date),
    dayIndex,
    dayOfWeek,
    wakeMin,
    sleepMin,
    slots,
    energyPrefix,
    blocks,
    classMinutes,
    freeMinutes,
    focusMinutes: 0,
    sessions: [],
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
/* Task → sessions                                                     */
/* ------------------------------------------------------------------ */

export function inferDifficulty(task) {
  if (task.difficulty) return clamp(Number(task.difficulty), 1, 5);
  let d = 3;
  if (task.quadrant === 'Q3' || task.quadrant === 'Q4') d = 2;
  if ((task.confidence || 3) <= 2) d += 1;
  if (task.taskType === 'admin') d = 1;
  if (task.taskType === 'revise') d = Math.min(d, 3);
  return clamp(d, 1, 5);
}

function isLearningTask(task) {
  if (task.taskType) return task.taskType === 'learn' || task.taskType === 'practice';
  const t = (task.title || '').toLowerCase();
  return task.category === 'academic' || /chapter|exam|lecture|concept|theory|unit|syllabus/.test(t);
}

function sessionLengthFor(task, userHabits) {
  const deep = userHabits.sessionStyle === 'deep';
  const d = inferDifficulty(task);
  if (deep) return d >= 4 ? 50 : 45;
  return d >= 4 ? 30 : 25;
}

function buildSessions(task, userHabits, bufferFactor) {
  const remaining = Math.max(0, (task.estimatedMinutes || 45) - (task.completedMinutes || 0));
  if (remaining < 5) return [];

  const base = sessionLengthFor(task, userHabits);
  // Short tasks stay whole; long ones split evenly so no sliver sessions appear.
  const parts = remaining <= base + 15 ? 1 : Math.ceil(remaining / base);
  const per = Math.max(15, Math.round(remaining / parts / 5) * 5);

  return Array.from({ length: parts }, (_, idx) => {
    const raw = idx === parts - 1 ? Math.max(10, remaining - per * (parts - 1)) : per;
    return {
      taskId: task.id,
      task,
      part: idx + 1,
      totalParts: parts,
      kind: 'WORK',
      rawMinutes: raw,
      blockMinutes: roundUp(raw * bufferFactor, SLOT),
      difficulty: inferDifficulty(task),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Placement scoring                                                   */
/* ------------------------------------------------------------------ */

function chainedFocusBefore(day, startMin) {
  // Minutes of near-continuous focus (≤10m breaks) that would end right before startMin.
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

function scoreCandidate({ day, i, n, session, urgency, ctx }) {
  const startMin = day.slots[i].min;
  const endMin = startMin + n * SLOT;
  const d = session.difficulty / 5;
  const e = avgEnergy(day, i, n);

  // Hard work → high energy. Easy work → avoid burning peak hours.
  let score = d * e + (1 - d) * (1 - e) * 0.8;

  // Urgent tasks are pulled earlier in the horizon; relaxed ones float.
  score -= day.dayIndex * (0.03 + 0.22 * urgency);
  score -= (startMin - day.wakeMin) * 0.00004;

  // Balance load across days.
  score -= (day.focusMinutes / ctx.dailyCap) * 0.35;

  // Distributed practice: discourage stacking the same task on one day unless urgent.
  const sameTaskToday = day.sessions.filter((s) => s.taskId === session.taskId).length;
  score -= sameTaskToday * 0.18 * (1 - urgency);

  // Interleave subjects; avoid back-to-back same subject.
  const subject = session.task.subject || session.task.category;
  const prev = day.sessions.find((s) => s.endMin <= startMin && startMin - s.endMin <= 15);
  if (prev && subject && (prev.task.subject || prev.task.category) === subject && prev.taskId !== session.taskId) {
    score -= 0.06;
  }

  // Enforce a real break after ~100 min of chained deep work.
  if (chainedFocusBefore(day, startMin) + session.rawMinutes > 110) score -= 0.4;

  // Keep the last hour before bed calm.
  if (day.slots[i + n - 1].windDown) score -= 0.12;

  // Light work fits nicely into between-class gaps.
  if (day.slots[i].gap) score += session.difficulty <= 2 ? 0.12 : -0.15;

  // Sessions placed right before a fixed class risk overrunning into it.
  const nextBlock = day.blocks.find((b) => b.startMin >= endMin && b.type === 'FIXED_CLASS');
  if (nextBlock && nextBlock.startMin - endMin < 10) score -= 0.05;

  return score;
}

function placeSession({ session, days, earliest, deadlineIdx, urgency, ctx }) {
  const n = session.blockMinutes / SLOT;
  let best = null;

  for (const day of days) {
    if (day.dayIndex > deadlineIdx) break;
    if (earliest && day.dayIndex < earliest.dayIndex) continue;
    if (day.focusMinutes + session.rawMinutes > ctx.dailyCap) continue;

    for (let i = 0; i + n <= day.slots.length; i++) {
      const slot = day.slots[i];
      if (!slot.free) continue;
      if (earliest && day.dayIndex === earliest.dayIndex && slot.min < earliest.min) continue;
      if (!isRunFree(day, i, n)) continue;
      if (session.difficulty >= 4 && day.slots[i + n - 1].windDown) continue;
      if (session.difficulty >= 4 && slot.gap) continue;

      const score = scoreCandidate({ day, i, n, session, urgency, ctx });
      if (!best || score > best.score) best = { day, i, n, score };
    }
  }
  return best;
}

function commitPlacement({ best, session }) {
  const { day, i, n } = best;
  const startMin = day.slots[i].min;
  const endMin = startMin + n * SLOT;
  for (let k = i; k < i + n; k++) day.slots[k].free = false;

  // Reserve a recovery break (longer after long blocks) when it fits.
  const breakLen = session.blockMinutes >= 45 ? 10 : 5;
  const breakSlots = breakLen / SLOT;
  let breakEnd = endMin;
  if (isRunFree(day, i + n, breakSlots)) {
    for (let k = i + n; k < i + n + breakSlots; k++) day.slots[k].free = false;
    breakEnd = endMin + breakLen;
  }

  const placed = {
    ...session,
    dayIndex: day.dayIndex,
    dateKey: day.dateKey,
    startMin,
    endMin,
    breakEnd,
    energy: avgEnergy(day, i, n),
  };
  day.sessions.push(placed);
  day.focusMinutes += session.rawMinutes;
  return placed;
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

function explainPlacement(s) {
  const lvl = energyLabel(s.energy);
  if (s.kind === 'REVIEW') return `Spaced recall (${s.reviewLabel}) — locks in what you learned`;
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
  horizonDays = 7,
  now = new Date(),
} = {}) {
  const horizon = clamp(Number(horizonDays) || 7, 1, 21);
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const curve = buildHourlyEnergyCurve(userHabits.chronotype);
  const hourAdj = learnHourAdjustments(reviewHistory);
  const bufferFactor = clamp((userHabits.distractionFactor || 1.25) * (learnedBufferInflation || 1), 1, 2.2);
  const ctx = { dailyCap: clamp(Number(userHabits.dailyFocusCapMinutes) || DEFAULT_DAILY_CAP, 60, 720) };

  const days = Array.from({ length: horizon }, (_, idx) =>
    buildDayGrid({
      date: addDays(today, idx),
      dayIndex: idx,
      userHabits,
      fixedSchedule,
      curve,
      fatigueHours: learnedFatigueHours,
      hourAdj,
      nowMin: idx === 0 ? nowMin : null,
    })
  );

  const daysUntil = (dateStr) => Math.round((startOfDay(new Date(`${dateStr}T00:00:00`)) - today) / 86400000);

  const deadlineIndexFor = (task) => {
    if (task.deadline) {
      // Finish the day *before* the due/exam date so the last day is for review, not cramming.
      return clamp(daysUntil(task.deadline) - 1, 0, horizon - 1);
    }
    if (task.quadrant === 'Q1') return Math.min(1, horizon - 1);
    if (task.quadrant === 'Q3') return Math.min(2, horizon - 1);
    return horizon - 1;
  };

  // Capacity actually usable up to a day index (free time capped by daily focus cap).
  const capacityUntil = (idx) =>
    days.slice(0, idx + 1).reduce((acc, d) => acc + Math.min(d.freeMinutes / bufferFactor, ctx.dailyCap), 0);

  const active = tasks.filter((t) => t && t.status !== 'COMPLETED');
  const plans = active.map((task) => {
    const sessions = buildSessions(task, userHabits, bufferFactor);
    const remaining = sessions.reduce((a, s) => a + s.rawMinutes, 0);
    const deadlineIdx = deadlineIndexFor(task);
    const capacity = capacityUntil(deadlineIdx);
    const slackRatio = capacity > 0 ? remaining / capacity : 9;
    const urgency = clamp(0.25 * (1 - deadlineIdx / horizon) + 0.75 * slackRatio + (task.quadrant === 'Q1' ? 0.2 : 0), 0, 1);
    const importance = QUADRANT_IMPORTANCE[task.quadrant] ?? 0.6;
    const weight = clamp((task.weightage || 3) / 5, 0, 1);
    const priority = 0.45 * urgency + 0.4 * importance + 0.15 * weight;
    return { task, sessions, remaining, deadlineIdx, urgency, priority };
  });
  plans.sort((a, b) => b.priority - a.priority);

  const placedAll = [];
  const unscheduled = [];

  plans.forEach((p) => {
    let earliest = null;
    let lastPlaced = null;
    let firstPlaced = null;
    for (const session of p.sessions) {
      const best = placeSession({ session, days, earliest, deadlineIdx: p.deadlineIdx, urgency: p.urgency, ctx });
      if (!best) {
        const left = p.sessions.filter((s) => s.part >= session.part).reduce((a, s) => a + s.rawMinutes, 0);
        unscheduled.push({
          taskId: p.task.id,
          title: p.task.title,
          minutes: left,
          reason: p.task.deadline
            ? `Not enough free focus time before ${p.task.deadline}`
            : 'No free focus time left in this planning window',
        });
        break;
      }
      lastPlaced = commitPlacement({ best, session });
      firstPlaced = firstPlaced || lastPlaced;
      placedAll.push(lastPlaced);
      earliest = { dayIndex: lastPlaced.dayIndex, min: lastPlaced.breakEnd };
    }

    // Spaced retrieval practice for learning tasks, anchored to first exposure and
    // kept on/before the exam day so recall happens while it still matters.
    if (firstPlaced && isLearningTask(p.task) && p.remaining >= 30) {
      const lastReviewIdx = p.task.deadline ? Math.min(daysUntil(p.task.deadline), horizon - 1) : horizon - 1;
      [{ offset: 1, label: '+1 day' }, { offset: 3, label: '+3 days' }].forEach(({ offset, label }) => {
        const targetIdx = Math.min(firstPlaced.dayIndex + offset, lastReviewIdx);
        if (targetIdx <= firstPlaced.dayIndex) return;
        const review = {
          taskId: p.task.id,
          task: p.task,
          part: 0,
          totalParts: p.sessions.length,
          kind: 'REVIEW',
          reviewLabel: label,
          rawMinutes: 15,
          blockMinutes: roundUp(15 * Math.min(bufferFactor, 1.3), SLOT),
          difficulty: 2,
        };
        const reviewDays = days.filter((d) => d.dayIndex === targetIdx);
        if (placedAll.some((s) => s.kind === 'REVIEW' && s.taskId === p.task.id && s.dayIndex === targetIdx)) return;
        const best = placeSession({ session: review, days: reviewDays, earliest: null, deadlineIdx: horizon, urgency: 0.5, ctx });
        if (best) placedAll.push(commitPlacement({ best, session: review }));
      });
    }
  });

  /* ---------------- Output shaping ---------------- */

  const toBlock = (s) => {
    const id = s.kind === 'REVIEW' ? `review-${s.taskId}-${s.dateKey}` : `slot-${s.taskId}-p${s.part}`;
    const titleSuffix = s.kind === 'REVIEW' ? ' — Recall Review' : s.totalParts > 1 ? ` (Part ${s.part}/${s.totalParts})` : '';
    return {
      id,
      taskId: s.taskId,
      taskTitle: `${s.task.title}${titleSuffix}`,
      category: s.task.category,
      subject: s.task.subject,
      quadrant: s.task.quadrant,
      kind: s.kind,
      part: s.part,
      totalParts: s.totalParts,
      difficulty: s.difficulty,
      dateKey: s.dateKey,
      dayIndex: s.dayIndex,
      startMin: s.startMin,
      endMin: s.endMin,
      startTime: formatMinutesToTime(s.startMin),
      endTime: formatMinutesToTime(s.endMin),
      rawDuration: s.rawMinutes,
      bufferMinutes: s.endMin - s.startMin - s.rawMinutes,
      energyLevel: energyLabel(s.energy),
      reason: explainPlacement(s),
      status: 'SCHEDULED',
      taskData: s.task,
    };
  };

  const dayViews = days.map((day) => {
    const sessions = day.sessions.map(toBlock).sort((a, b) => a.startMin - b.startMin);
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
      id: `block-${day.dateKey}-${b.startMin}-${b.title}`,
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
    const capacity = Math.min(day.freeMinutes / bufferFactor + day.focusMinutes, ctx.dailyCap);
    const loadRatio = ctx.dailyCap ? day.focusMinutes / ctx.dailyCap : 0;
    return {
      dateKey: day.dateKey,
      dayIndex: day.dayIndex,
      dayOfWeek: day.dayOfWeek,
      label: day.dayIndex === 0 ? 'Today' : day.dayIndex === 1 ? 'Tomorrow' : `${DAY_NAMES[day.dayOfWeek]} ${day.date.getDate()}`,
      shortLabel: day.dayIndex === 0 ? 'Today' : `${DAY_NAMES[day.dayOfWeek]} ${day.date.getDate()}`,
      focusMinutes: day.focusMinutes,
      classMinutes: day.classMinutes,
      capacityMinutes: Math.round(capacity),
      load: loadRatio > 0.85 ? 'heavy' : loadRatio > 0.45 ? 'balanced' : 'light',
      sessions,
      items: [...sessions, ...breaks, ...fixed].sort((a, b) => a.startMin - b.startMin),
    };
  });

  const allSessions = dayViews.flatMap((d) => d.sessions);
  const nextSession = dayViews[0]?.sessions.find((s) => s.endMin > nowMin) || null;

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

  const plan = { generatedAt: now.toISOString(), horizonDays: horizon, days: dayViews, sessions: allSessions, nextSession, unscheduled, feasibility };
  plan.tips = generatePlanTips({ plan, userHabits, curve, learnedFatigueHours, bufferFactor });
  return plan;
}

/* ------------------------------------------------------------------ */
/* Rule-based coaching tips (always available, no AI required)         */
/* ------------------------------------------------------------------ */

export function generatePlanTips({ plan, userHabits = {}, curve, learnedFatigueHours = [], bufferFactor = 1.25 }) {
  const tips = [];
  const { feasibility, days, nextSession, sessions } = plan;

  if (nextSession) {
    const material = nextSession.taskData?.materials?.[0];
    tips.push({
      id: 'next',
      kind: 'action',
      text: `Next up: "${nextSession.taskTitle}" at ${nextSession.startTime}.${material ? ` Open "${material}" 2 minutes before so you start without friction.` : ' Clear your desk and silence your phone before it starts.'}`,
    });
  }

  feasibility.atRisk.forEach((r) => {
    tips.push({
      id: `risk-${r.taskId}`,
      kind: 'warning',
      text: `"${r.title}" is short by ~${Math.round(r.shortByMinutes / 6) / 10}h before ${r.deadline}. Drop or shrink Q4 work, raise your daily focus cap, or move the deadline — don't plan on sleeping less.`,
    });
  });

  if (feasibility.status === 'OVERLOADED' && feasibility.atRisk.length === 0) {
    tips.push({
      id: 'overload',
      kind: 'warning',
      text: `${Math.round(feasibility.unscheduledMinutes / 6) / 10}h of work doesn't fit in the next ${plan.horizonDays} days. Extend the planning window or prune low-priority tasks.`,
    });
  } else if (feasibility.status === 'TIGHT') {
    tips.push({ id: 'tight', kind: 'warning', text: 'This week is tight: protect your planned breaks — skipping them now usually costs more time later.' });
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

  const heavyClassDay = days.find((d) => d.classMinutes >= 300);
  if (heavyClassDay) {
    tips.push({
      id: 'classday',
      kind: 'insight',
      text: `${heavyClassDay.label} has ${Math.round(heavyClassDay.classMinutes / 60)}h of classes, so it gets a lighter study load. Use evening time for review, not new material.`,
    });
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
    tips.push({ id: 'buffer', kind: 'insight', text: 'Your sessions run long often. Try writing a one-line "done means…" goal before each block to stop scope creep.' });
  }

  return tips.slice(0, 7);
}

/* ------------------------------------------------------------------ */
/* Compact summary for LLM coaching prompts                            */
/* ------------------------------------------------------------------ */

export function summarizePlanForAI(plan, userHabits = {}) {
  return {
    profile: {
      chronotype: userHabits.chronotype || 'BALANCED',
      wakeTime: userHabits.wakeTime,
      sleepTime: userHabits.sleepTime,
      sessionStyle: userHabits.sessionStyle || 'pomodoro',
    },
    feasibility: plan.feasibility,
    days: plan.days.map((d) => ({
      day: d.label,
      classHours: Math.round(d.classMinutes / 6) / 10,
      focusHours: Math.round(d.focusMinutes / 6) / 10,
      sessions: d.sessions.map((s) => `${s.startTime} ${s.taskTitle} [${s.quadrant || 'Q2'}, difficulty ${s.difficulty}, ${s.energyLevel}]`),
    })),
    unscheduled: plan.unscheduled,
  };
}
