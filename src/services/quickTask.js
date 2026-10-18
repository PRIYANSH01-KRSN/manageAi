// Quick Add: "Study Chapter 4 of NCERT Physics" → a realistic estimate + an energy-matched,
// time-budgeted session. AI does the estimate when available; this module provides the
// offline fallback and the (pure, testable) session rules.
import { estimateFromVolume } from './estimationEngine.js';

// Humans underestimate task time by ~30–50% (planning fallacy / Hofstadter's law).
export const PLANNING_FALLACY = {
  userGuess: 1.5, // the student's own guess → +50%
  averageStudent: 1.2, // an "average student" estimate (AI) is less optimistic → +20%
};

export const ENERGY_SESSION = {
  SHARP: { minutes: 90, label: 'deep work' },
  STEADY: { minutes: 50, label: 'focused session' },
  FRIED: { minutes: 25, label: 'gentle sprint' },
};

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

const SUBJECTS = ['physics', 'chemistry', 'biology', 'maths', 'mathematics', 'math', 'economics', 'history', 'geography', 'english', 'computer science', 'accountancy', 'business studies', 'political science', 'statistics', 'data structures', 'algorithms', 'dbms', 'operating systems', 'networks'];

/**
 * Offline estimate from the text alone (used when AI is unavailable).
 */
export function parseQuickTask(text = '') {
  const t = String(text).trim();
  const lower = t.toLowerCase();
  const subject = SUBJECTS.find((s) => lower.includes(s));
  const num = (re) => {
    const m = lower.match(re);
    return m ? Number(m[1]) : null;
  };

  let taskType = 'learn';
  if (/revise|revision|review|recap/.test(lower)) taskType = 'revise';
  else if (/problem|exercise|question|numerical|worksheet|past paper|pyq|mock/.test(lower)) taskType = 'practice';
  else if (/assignment|essay|report|write|lab/.test(lower)) taskType = 'assignment';
  else if (/form|email|submit|register|pay/.test(lower)) taskType = 'admin';

  const pages = num(/(\d+)\s*(?:pages?|pgs?)/);
  const problems = num(/(\d+)\s*(?:problems?|questions?|exercises?|numericals?)/);
  const lectures = num(/(\d+)\s*(?:lectures?|videos?|classes)/);
  const chapters = num(/(\d+)\s*chapters/) || (/(chapter|ch\.?\s*\d)/.test(lower) ? 1 : null);

  const difficulty = /physics|maths?|mathematics|chemistry|algorithms|data structures|calculus|thermo|organic/.test(lower) ? 4 : 3;
  const base = { knowledgeLevel: 1, difficulty, taskType };
  const est =
    (pages && estimateFromVolume({ ...base, volumeType: 'pages', volumeCount: pages })) ||
    (problems && estimateFromVolume({ ...base, volumeType: 'problems', volumeCount: problems })) ||
    (lectures && estimateFromVolume({ ...base, volumeType: 'lectures', volumeCount: lectures })) ||
    (chapters && estimateFromVolume({ ...base, volumeType: 'chapters', volumeCount: chapters })) ||
    null;

  const averageMinutes = est ? est.likely : taskType === 'admin' ? 20 : 60;
  return {
    title: t.charAt(0).toUpperCase() + t.slice(1),
    subject: subject ? subject.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    taskType,
    averageMinutes,
    rangeMinutes: est ? [est.optimistic, est.pessimistic] : [Math.round(averageMinutes * 0.7), Math.round(averageMinutes * 1.6)],
    difficulty,
    subtopics: [],
    firstStep: '',
    why: est ? 'Estimated from the amount of material you mentioned.' : 'Rough estimate — add pages or the chapter name for a sharper one.',
    assumption: '',
    source: 'estimate',
  };
}

/**
 * Buffered planning time with the reason shown to the student.
 * @param minutes   raw estimate
 * @param kind      'userGuess' | 'averageStudent'
 */
export function withPlanningBuffer(minutes, kind = 'userGuess') {
  const factor = PLANNING_FALLACY[kind] || PLANNING_FALLACY.userGuess;
  const planned = round5(minutes * factor);
  const pct = Math.round((factor - 1) * 100);
  const reason =
    kind === 'userGuess'
      ? `We added ${pct}% (${minutes}m → ${planned}m) because people underestimate how long tasks take by 30–50% — the "planning fallacy".`
      : `We added ${pct}% (${minutes}m → ${planned}m) as a buffer — even realistic estimates run over, and finishing early beats running late.`;
  return { planned, pct, reason };
}

/**
 * Session for right now: sized by current energy, never more than today's time budget or
 * the work that's left. When the timer hits zero the task is done for today.
 */
export function planQuickSession({ plannedMinutes, energyLevel = 'STEADY', budgetMinutes }) {
  const energy = ENERGY_SESSION[energyLevel] || ENERGY_SESSION.STEADY;
  const budget = Number(budgetMinutes) > 0 ? Number(budgetMinutes) : energy.minutes;
  const minutes = Math.max(10, Math.min(budget, plannedMinutes));
  const remainingAfter = Math.max(0, plannedMinutes - minutes);
  return {
    minutes,
    label: minutes >= 75 ? 'deep work' : energy.label,
    remainingAfter,
    note:
      remainingAfter > 0
        ? `That's today's budget. The remaining ~${round5(remainingAfter)} min goes into your plan for later — no need to finish it all now.`
        : 'This should be enough to finish it today.',
  };
}
