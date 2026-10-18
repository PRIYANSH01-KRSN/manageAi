// Focus My Energy: match work to how the student actually feels, not just the calendar.
//
//   1. Assess energy  — live self-report > energy profile > morning check-in > time heuristics
//   2. Classify tasks — 🔴 Deep work · 🟡 Steady work · 🟢 Low drain
//   3. Recommend      — ONE task to do now (+ save-for-later and quick wins); a task due
//                       today overrides energy matching, broken into a smaller first step
//   4. Learn patterns — surface repeated energy patterns and profile mismatches
import { buildHourlyEnergyCurve, parseTimeToMinutes, toDateKey } from './plannerEngine.js';
import { buildShrinkLadder } from './taskCoach.js';

export const ENERGY_LEVELS = {
  SHARP: { id: 'SHARP', label: 'sharp', emoji: '⚡', sessionMinutes: 45 },
  STEADY: { id: 'STEADY', label: 'steady', emoji: '🙂', sessionMinutes: 25 },
  FRIED: { id: 'FRIED', label: 'fried', emoji: '🪫', sessionMinutes: 15 },
};

export const TIERS = {
  DEEP: { id: 'DEEP', icon: '🔴', label: 'Deep work', needs: 'peak energy' },
  STEADY: { id: 'STEADY', icon: '🟡', label: 'Steady work', needs: 'decent energy' },
  LOW: { id: 'LOW', icon: '🟢', label: 'Low drain', needs: 'little energy — fine when fried' },
};

export const JUST_FINISHED = [
  { id: 'classes', label: 'Classes / lectures' },
  { id: 'meetings', label: 'Meetings / group work' },
  { id: 'focus', label: 'A long focus block' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'rest', label: 'A break / rest' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEVEL_RANK = { FRIED: 0, STEADY: 1, SHARP: 2 };
const RANK_LEVEL = ['FRIED', 'STEADY', 'SHARP'];
const downgrade = (level) => RANK_LEVEL[Math.max(0, LEVEL_RANK[level] - 1)];

const fmtHour = (h) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
const nowMinutes = (now) => now.getHours() * 60 + now.getMinutes();

function inWindow(min, start, end) {
  if (!start || !end) return false;
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  return s <= e ? min >= s && min < e : min >= s || min < e; // handles windows past midnight
}

/* ------------------------------------------------------------------ */
/* Step 2: classify tasks by cognitive demand                          */
/* ------------------------------------------------------------------ */

const LOW_RE = /\b(email|reply|form|submit|schedul|book|pay|fee|file|organi[sz]e|clean|inbox|print|register|upload|rename|tidy|sign|attendance|admin|errand)/i;
const DEEP_RE = /\b(write|essay|draft|design|architect|strategy|research|prove|derive|problem set|understand|concept|theory|build|implement|debug|mock test|learn)/i;
const STEADY_RE = /\b(review|revis|edit|proofread|plan|read|summar|flashcard|practice|recap|outline|notes)/i;

export function classifyTask(task = {}) {
  const title = task.title || '';
  const d = Number(task.difficulty) || null;
  const type = task.taskType;

  if (type === 'admin' || (!type && LOW_RE.test(title) && !DEEP_RE.test(title))) {
    return { tier: 'LOW', reason: 'routine admin — doable even when fried' };
  }
  if (type === 'learn' || type === 'project' || type === 'assignment') {
    if (d && d <= 2) return { tier: 'STEADY', reason: 'familiar material — needs attention, not invention' };
    return { tier: 'DEEP', reason: type === 'learn' ? 'new material needs real thinking' : 'creating from scratch needs peak focus' };
  }
  if (type === 'practice') {
    return d && d >= 4
      ? { tier: 'DEEP', reason: 'hard problem solving needs peak focus' }
      : { tier: 'STEADY', reason: 'applying what you know — needs decent focus' };
  }
  if (type === 'revise') {
    return d && d <= 1 ? { tier: 'LOW', reason: 'light review' } : { tier: 'STEADY', reason: 'review needs attention, not invention' };
  }
  if (d >= 4 || DEEP_RE.test(title)) return { tier: 'DEEP', reason: 'demanding, creative or new work' };
  if (d && d <= 1) return { tier: 'LOW', reason: 'quick and routine' };
  if (STEADY_RE.test(title) || d) return { tier: 'STEADY', reason: 'needs attention but not invention' };
  return { tier: 'STEADY', reason: 'vague title — treated as steady work (add details for a sharper match)' };
}

/* ------------------------------------------------------------------ */
/* Step 1: assess current energy                                       */
/* ------------------------------------------------------------------ */

/**
 * @param latestReport  { level, ts, after } from the energy log (live self-report)
 * @param profile       optional energy profile { peakStart, peakEnd, dipStart, dipEnd, secondWindStart, secondWindEnd, slowDays[], drains, boosts }
 * @param checkin       today's morning check-in { energy, mood, sleepQuality }
 */
export function inferEnergy({ latestReport, profile, checkin, chronotype, fatigueHours = [], now = new Date() } = {}) {
  const min = nowMinutes(now);
  const hour = now.getHours();
  const weekday = now.getDay();
  const time = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. Real-time self-report wins (valid for 90 minutes).
  if (latestReport && now - new Date(latestReport.ts) < 90 * 60000) {
    return { level: latestReport.level, source: 'self', reason: `You told me you're ${ENERGY_LEVELS[latestReport.level].label}.` };
  }

  // 2. Energy profile fills the gaps.
  const hasProfile = profile && (profile.peakStart || profile.dipStart || profile.secondWindStart || profile.slowDays?.length);
  if (hasProfile) {
    let level = null;
    let reason = '';
    if (inWindow(min, profile.dipStart, profile.dipEnd)) {
      level = 'FRIED';
      reason = `It's ${time} and your profile says you dip from ${profile.dipStart}–${profile.dipEnd}, so I'm treating you as steady-to-fried.`;
    } else if (inWindow(min, profile.peakStart, profile.peakEnd)) {
      level = 'SHARP';
      reason = `It's ${time} — inside your peak hours (${profile.peakStart}–${profile.peakEnd}).`;
    } else if (inWindow(min, profile.secondWindStart, profile.secondWindEnd)) {
      level = 'SHARP';
      reason = `It's ${time} — your second wind (${profile.secondWindStart}–${profile.secondWindEnd}).`;
    }
    if (level) {
      if (profile.slowDays?.includes(weekday) && hour < 12 && level !== 'FRIED') {
        level = downgrade(level);
        reason += ` ${WEEKDAYS[weekday]} mornings are usually slow for you, so I've eased it down a notch.`;
      }
      return { level, source: 'profile', reason: `${reason} Tell me if that's off.` };
    }
  }

  // 3. Morning check-in (a self-report, but from earlier today).
  if (checkin && (checkin.energy || checkin.mood)) {
    const e = Math.min(checkin.energy || 3, checkin.mood || 5, checkin.sleepQuality || 5);
    if (e <= 2) return { level: 'FRIED', source: 'checkin', reason: 'This morning you checked in with low energy, so I\'m keeping things light. Tell me if you\'ve perked up.' };
    if ((checkin.energy || 3) >= 4 && (checkin.mood || 3) >= 3) {
      const curve = buildHourlyEnergyCurve(chronotype);
      if (curve[hour] >= 0.6) return { level: 'SHARP', source: 'checkin', reason: 'You checked in with high energy this morning and this is a good hour for you. Tell me if that\'s off.' };
    }
  }

  // 4. Generic heuristics: chronotype curve, learned fatigue hours, day of week.
  const curve = buildHourlyEnergyCurve(chronotype, profile);
  let level = curve[hour] >= 0.8 ? 'SHARP' : curve[hour] >= 0.5 ? 'STEADY' : 'FRIED';
  let reason = `It's ${time}; for your rhythm this is usually a ${ENERGY_LEVELS[level].label} hour.`;
  if (fatigueHours.includes(hour)) {
    level = 'FRIED';
    reason = `It's ${time} — you've reported fatigue around this hour before.`;
  }
  if (weekday === 5 && hour >= 15) {
    level = downgrade(level);
    reason += ' Friday afternoons usually wind down.';
  } else if (weekday === 1 && hour < 10) {
    reason += ' Monday mornings are a fresh start.';
  }
  return { level, source: 'time', reason: `${reason} This is a guess — tap how you actually feel.` };
}

/* ------------------------------------------------------------------ */
/* Step 3: match and recommend                                         */
/* ------------------------------------------------------------------ */

const MATCH = {
  SHARP: { DEEP: 3, STEADY: 2, LOW: 1 },
  STEADY: { STEADY: 3, LOW: 2, DEEP: 1.2 },
  FRIED: { LOW: 3, STEADY: 1.2, DEEP: 0 },
};
const IMPORTANCE = { Q1: 1, Q2: 0.75, Q3: 0.4, Q4: 0.1 };

const remainingOf = (t) => Math.max(0, (Number(t.estimatedMinutes) || 45) - (Number(t.completedMinutes) || 0));

function daysUntil(dateKey, now) {
  if (!dateKey) return null;
  return Math.round((new Date(`${dateKey}T00:00:00`) - new Date(`${toDateKey(now)}T00:00:00`)) / 86400000);
}

// When is the next likely high-energy window? (profile peak / second wind, else chronotype curve)
export function nextPeakLabel({ profile, chronotype, now = new Date() }) {
  const min = nowMinutes(now);
  const windows = [
    [profile?.peakStart, profile?.peakEnd],
    [profile?.secondWindStart, profile?.secondWindEnd],
  ].filter(([s, e]) => s && e);
  if (windows.length) {
    const upcoming = windows.map(([s]) => parseTimeToMinutes(s)).sort((a, b) => a - b);
    const later = upcoming.find((s) => s >= min + 180);
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return later !== undefined ? `today at ${fmt(later)}` : `tomorrow at ${fmt(upcoming[0])}`;
  }
  // Recovery takes time: only suggest a peak at least 3 hours away.
  const curve = buildHourlyEnergyCurve(chronotype, profile);
  for (let h = now.getHours() + 3; h < 22; h++) if (curve[h] >= 0.85) return `today around ${fmtHour(h)}`;
  const first = curve.findIndex((v, h) => v >= 0.85 && h >= 6);
  return first >= 0 ? `tomorrow morning around ${fmtHour(first)}` : 'your next fresh session';
}

export function recommendForEnergy({ tasks = [], energy, profile, chronotype, now = new Date() }) {
  const level = energy?.level || 'STEADY';
  const active = tasks.filter((t) => t && t.status !== 'COMPLETED' && remainingOf(t) >= 5);
  if (active.length === 0) {
    return { empty: true, level, message: "You've got nothing on your list right now. Enjoy it — or add something in the Backlog when you're ready." };
  }

  const classified = active.map((task) => {
    const c = classifyTask(task);
    const due = daysUntil(task.deadline, now);
    const urgency = due === null ? 0 : due <= 0 ? 1 : due <= 2 ? 0.6 : due <= 5 ? 0.3 : 0;
    const score = MATCH[level][c.tier] * 2 + (IMPORTANCE[task.quadrant] ?? 0.6) + urgency * 1.5;
    return { task, ...c, due, remaining: remainingOf(task), score };
  });

  // A hard deadline today overrides energy matching.
  const dueToday = classified.filter((c) => c.due !== null && c.due <= 0).sort((a, b) => (IMPORTANCE[b.task.quadrant] ?? 0.6) - (IMPORTANCE[a.task.quadrant] ?? 0.6));
  let doNow;
  let deadlineOverride = false;
  if (dueToday.length) {
    doNow = dueToday[0];
    deadlineOverride = MATCH[level][doNow.tier] < 3;
  } else {
    doNow = [...classified].sort((a, b) => b.score - a.score)[0];
  }

  const minutes = Math.min(doNow.remaining, ENERGY_LEVELS[level].sessionMinutes);
  const peak = nextPeakLabel({ profile, chronotype, now });

  let why;
  if (deadlineOverride) {
    const smaller = buildShrinkLadder(doNow.task, minutes)[1];
    why = `Normally I'd save this for when you're sharper, but it's due today. Make it easier: ${smaller.text}`;
  } else if (level === 'SHARP' && doNow.tier === 'DEEP') {
    why = 'This is the one. It needs real thinking and you have the energy for it — do it now before the energy fades.';
  } else if (level === 'FRIED' && doNow.tier === 'LOW') {
    why = `Good call to keep it light — knock out the easy stuff and protect ${peak} for the hard thing.`;
  } else if (level === 'FRIED') {
    why = 'Nothing truly low-effort is on your list, so this is the gentlest useful step. Do just 15 minutes, then reassess.';
  } else if (level === 'STEADY' && doNow.tier === 'STEADY') {
    why = 'Needs attention but not invention — a solid match for steady energy.';
  } else {
    why = `${TIERS[doNow.tier].label} (${doNow.reason}) — the best fit for ${ENERGY_LEVELS[level].label} energy right now.`;
  }

  const saveForLater = classified
    .filter((c) => c !== doNow && LEVEL_RANK[level] < (c.tier === 'DEEP' ? 2 : c.tier === 'STEADY' ? 1 : 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((c) => ({
      task: c.task,
      tier: c.tier,
      why: c.tier === 'DEEP' ? `needs peak energy (${c.reason}) — try ${peak}` : 'needs steadier focus than you have right now',
    }));

  const quickWins = classified
    .filter((c) => c !== doNow && (c.tier === 'LOW' || c.remaining <= 20))
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 3)
    .map((c) => ({ task: c.task, tier: c.tier, minutes: Math.min(c.remaining, 15) }));

  return {
    empty: false,
    level,
    doNow: { task: doNow.task, tier: doNow.tier, why, minutes, deadlineOverride },
    saveForLater,
    quickWins,
    tiers: {
      DEEP: classified.filter((c) => c.tier === 'DEEP'),
      STEADY: classified.filter((c) => c.tier === 'STEADY'),
      LOW: classified.filter((c) => c.tier === 'LOW'),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Step 4: refine energy patterns over time                            */
/* ------------------------------------------------------------------ */

export function energyPatterns(log = [], profile = null) {
  const insights = [];
  const recent = log.slice(0, 60);
  if (recent.length < 3) return insights;

  const friedAfter = {};
  recent.filter((e) => e.level === 'FRIED' && e.after).forEach((e) => {
    friedAfter[e.after] = (friedAfter[e.after] || 0) + 1;
  });
  Object.entries(friedAfter).forEach(([after, n]) => {
    if (n < 3) return;
    const label = JUST_FINISHED.find((j) => j.id === after)?.label.toLowerCase() || after;
    insights.push({
      id: `after-${after}`,
      text: `You've been fried after ${label} ${n} times now. Consider blocking 30 minutes of recovery after ${label}-heavy mornings before any deep work.`,
    });
    const drains = String(profile?.drains || '').toLowerCase();
    if (drains && drains.includes(after.slice(0, 5))) {
      insights.push({ id: `drain-${after}`, text: `You listed this as an energy drain in your profile, and your check-ins confirm it — your profile is spot-on.` });
    }
  });

  const morning = recent.filter((e) => e.hour < 12);
  const sharpMorning = morning.filter((e) => e.level === 'SHARP').length;
  if (sharpMorning >= 3 && sharpMorning / morning.length >= 0.6) {
    insights.push({ id: 'morning-sharp', text: 'You tend to feel sharp before noon. Deep work will be suggested earlier in the day.' });
  }
  const evening = recent.filter((e) => e.hour >= 18);
  const sharpEvening = evening.filter((e) => e.level === 'SHARP').length;
  if (sharpEvening >= 3 && sharpEvening / evening.length >= 0.6) {
    insights.push({ id: 'evening-sharp', text: 'Your sharpest check-ins are in the evening — consider setting your chronotype to Night Owl in Habits.' });
  }

  [1, 5].forEach((wd) => {
    const day = recent.filter((e) => e.weekday === wd);
    const fried = day.filter((e) => e.level === 'FRIED').length;
    if (day.length >= 2 && fried / day.length >= 0.6) {
      insights.push({ id: `weekday-${wd}`, text: `${WEEKDAYS[wd]}s you're usually low on energy. Leaning into that: lighter tasks on ${WEEKDAYS[wd]}s.` });
    }
  });

  if (profile?.dipStart && profile?.dipEnd) {
    const inDip = recent.filter((e) => inWindow(e.hour * 60 + (e.minute || 0), profile.dipStart, profile.dipEnd));
    if (inDip.filter((e) => e.level === 'SHARP').length >= 2) {
      insights.push({ id: 'dip-mismatch', text: `Your profile says you dip ${profile.dipStart}–${profile.dipEnd}, but lately you've been sharp then. Want to update your profile?` });
    }
  }
  if (profile?.peakStart && profile?.peakEnd) {
    const inPeak = recent.filter((e) => inWindow(e.hour * 60 + (e.minute || 0), profile.peakStart, profile.peakEnd));
    if (inPeak.filter((e) => e.level === 'FRIED').length >= 2) {
      insights.push({ id: 'peak-mismatch', text: `You've felt fried during your listed peak hours (${profile.peakStart}–${profile.peakEnd}) a few times. Your rhythm may have shifted — worth revisiting your profile.` });
    }
  }
  return insights.slice(0, 4);
}

export function makeEnergyLogEntry(level, after, now = new Date()) {
  return { ts: now.toISOString(), dateKey: toDateKey(now), hour: now.getHours(), minute: now.getMinutes(), weekday: now.getDay(), level, after: after || null };
}
