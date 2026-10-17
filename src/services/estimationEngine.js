// Realistic Time Estimation Engine
//
// Students are bad at guessing durations (planning fallacy). Instead of trusting a
// slider, estimates are derived from *volume* (pages, chapters, problems, lectures),
// adjusted for prior knowledge and difficulty, expressed as a three-point range, and
// finally corrected by the student's own measured pace per subject / task type.

// Minutes per unit of volume for each kind of work.
export const UNIT_RATES = {
  pages: { learn: 5, practice: 3, revise: 2, assignment: 6, project: 6, admin: 2 },
  chapters: { learn: 75, practice: 50, revise: 30, assignment: 90, project: 90, admin: 20 },
  problems: { learn: 12, practice: 10, revise: 6, assignment: 15, project: 15, admin: 5 },
  lectures: { learn: 90, practice: 60, revise: 35, assignment: 90, project: 90, admin: 30 },
};

export const VOLUME_TYPES = [
  { id: 'none', label: 'No volume — I\'ll set time' },
  { id: 'pages', label: 'Pages' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'problems', label: 'Problems / questions' },
  { id: 'lectures', label: 'Lecture videos' },
];

export const KNOWLEDGE_LEVELS = [
  { id: 0, label: 'Never seen it', multiplier: 1.6 },
  { id: 1, label: 'Seen it once', multiplier: 1.25 },
  { id: 2, label: 'Mostly OK', multiplier: 1.0 },
  { id: 3, label: 'Confident', multiplier: 0.75 },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function knowledgeMultiplier(level) {
  const found = KNOWLEDGE_LEVELS.find((k) => k.id === Number(level));
  return found ? found.multiplier : 1.0;
}

function difficultyMultiplier(difficulty) {
  return 0.85 + 0.075 * clamp(Number(difficulty) || 3, 1, 5);
}

/**
 * Learned pace ratios (actual ÷ planned) from logged focus sessions.
 * Bayesian-shrunk toward 1.0 so a couple of odd sessions can't swing the plan.
 */
export function computeCalibration(sessionLogs = []) {
  const groups = {};
  const add = (key, ratio) => {
    groups[key] = groups[key] || [];
    groups[key].push(ratio);
  };
  sessionLogs.forEach((log) => {
    if (!log.plannedMinutes || !log.actualMinutes || log.kind === 'REVIEW') return;
    const ratio = clamp(log.actualMinutes / log.plannedMinutes, 0.4, 3);
    add('all', ratio);
    if (log.subject) add(`subject:${log.subject.toLowerCase()}`, ratio);
    if (log.taskType) add(`type:${log.taskType}`, ratio);
  });

  const result = {};
  Object.entries(groups).forEach(([key, ratios]) => {
    const sorted = [...ratios].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const weight = ratios.length / (ratios.length + 3); // 3 pseudo-observations at 1.0
    result[key] = { ratio: clamp(weight * median + (1 - weight), 0.7, 2.0), samples: ratios.length };
  });
  return result;
}

export function calibrationRatioFor(task, calibration = {}) {
  const bySubject = task.subject && calibration[`subject:${task.subject.toLowerCase()}`];
  if (bySubject && bySubject.samples >= 2) return bySubject.ratio;
  const byType = task.taskType && calibration[`type:${task.taskType}`];
  if (byType && byType.samples >= 2) return byType.ratio;
  return calibration.all?.ratio || 1.0;
}

/**
 * Three-point (PERT) estimate from volume. Plans with ~P80 so most days finish on time.
 */
export function estimateFromVolume({ volumeType, volumeCount, knowledgeLevel = 1, difficulty = 3, taskType = 'learn' }, calibrationRatio = 1) {
  const rates = UNIT_RATES[volumeType];
  const count = Number(volumeCount) || 0;
  if (!rates || count <= 0) return null;

  const perUnit = rates[taskType] ?? rates.learn;
  const likely = perUnit * count * knowledgeMultiplier(knowledgeLevel) * difficultyMultiplier(difficulty) * calibrationRatio;
  const optimistic = likely * 0.7;
  const pessimistic = likely * (Number(knowledgeLevel) === 0 ? 2.0 : 1.6);
  const mean = (optimistic + 4 * likely + pessimistic) / 6;
  const sd = (pessimistic - optimistic) / 6;
  const planned = mean + 0.84 * sd; // ~80th percentile

  return {
    optimistic: round5(optimistic),
    likely: round5(likely),
    pessimistic: round5(pessimistic),
    planned: round5(planned),
    explanation: `${count} ${volumeType} × ~${perUnit}m (${taskType}) × knowledge ${knowledgeMultiplier(knowledgeLevel)}× × difficulty ${difficultyMultiplier(difficulty).toFixed(2)}×${calibrationRatio !== 1 ? ` × your pace ${calibrationRatio.toFixed(2)}×` : ''}`,
  };
}

/**
 * Flags estimates that are unrealistically low or high compared to the volume model.
 */
export function sanityCheckEstimate(task, userMinutes, calibrationRatio = 1) {
  const warnings = [];
  const minutes = Number(userMinutes) || 0;
  const model = estimateFromVolume(task, calibrationRatio);

  if (model) {
    if (minutes < model.optimistic * 0.8) {
      warnings.push({
        level: 'low',
        text: `${minutes}m looks too short for ${task.volumeCount} ${task.volumeType}. Realistic range: ${model.optimistic}–${model.pessimistic}m. Underestimating is the #1 reason plans collapse.`,
        suggested: model.planned,
      });
    } else if (minutes > model.pessimistic * 1.4) {
      warnings.push({
        level: 'high',
        text: `${minutes}m is more than even a slow pace needs (~${model.pessimistic}m). Over-padding hides time you could use elsewhere.`,
        suggested: model.planned,
      });
    }
  } else if (minutes > 0 && minutes < 15 && ['learn', 'practice', 'assignment', 'project'].includes(task.taskType)) {
    warnings.push({ level: 'low', text: 'Under 15 minutes rarely covers real learning or problem solving. Consider 25m+.', suggested: 25 });
  }

  if (minutes > 180) {
    warnings.push({ level: 'info', text: `${(minutes / 60).toFixed(1)}h will be split automatically into focused sessions across days.` });
  }
  return warnings;
}

/**
 * Final planning minutes for a task: explicit estimate if given, otherwise derived from
 * volume, otherwise a difficulty-based default. Applies the learned pace correction.
 */
export function plannedMinutesFor(task, calibration = {}) {
  const ratio = calibrationRatioFor(task, calibration);
  const base = Number(task.estimatedMinutes) || estimateFromVolume(task)?.planned || 30 + (Number(task.difficulty) || 3) * 10;
  return round5(base * ratio);
}
