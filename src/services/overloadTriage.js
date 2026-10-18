// Anti-fragile recalibration: when missed days or new work mean the remaining syllabus no
// longer fits before its deadline, propose the smallest set of cuts that makes it fit —
// lowest value-per-minute work first: shrink full chapters to their core, then skip.
// The student confirms; nothing is deleted silently.

const CORE_SHARE = 0.45;

const valueOf = (t) => {
  const importance = { Q1: 1, Q2: 0.8, Q3: 0.45, Q4: 0.15 }[t.quadrant] ?? 0.6;
  return (Number(t.weightage) || 3) * importance;
};

const remainingOf = (t) => Math.max(0, (Number(t.estimatedMinutes) || 45) - (Number(t.completedMinutes) || 0));

/**
 * @returns {{ needed: boolean, shortMinutes: number, changes: Array<{ id, title, action: 'core'|'skip', saveMinutes, newMinutes? }>, fits: boolean }}
 */
export function proposeOverloadTriage(tasks = [], plan) {
  const short = (plan?.unscheduled || []).reduce((a, u) => a + u.minutes, 0);
  if (!short) return { needed: false, shortMinutes: 0, changes: [], fits: true };

  // Only trim work that shares a deadline with something that doesn't fit (or has no deadline).
  const atRiskDeadlines = new Set(
    (plan.unscheduled || []).map((u) => tasks.find((t) => t.id === u.taskId)?.deadline).filter(Boolean)
  );
  const candidates = tasks
    .filter((t) => remainingOf(t) >= 10 && t.meta?.kind !== 'review' && !/^(Mock test|Final review)/.test(t.title))
    .filter((t) => !t.deadline || atRiskDeadlines.size === 0 || atRiskDeadlines.has(t.deadline))
    .map((t) => ({ t, density: valueOf(t) / remainingOf(t) }))
    .sort((a, b) => a.density - b.density);

  const changes = [];
  let saved = 0;
  // Pass 1: shrink full learning/practice to its core (keeps ~70% of the value).
  for (const { t } of candidates) {
    if (saved >= short) break;
    const isCoreAlready = /^(Learn core|Practice key|Skim|Core:)/.test(t.title);
    if (isCoreAlready || !['learn', 'practice', 'assignment', 'revise'].includes(t.taskType)) continue;
    const rem = remainingOf(t);
    const newMinutes = Math.max(15, Math.round((rem * CORE_SHARE) / 5) * 5);
    if (rem - newMinutes < 10) continue;
    changes.push({ id: t.id, title: t.title, action: 'core', saveMinutes: rem - newMinutes, newMinutes });
    saved += rem - newMinutes;
  }
  // Pass 2: skip the lowest-value work entirely.
  for (const { t } of candidates) {
    if (saved >= short) break;
    const existing = changes.find((c) => c.id === t.id);
    const rem = existing ? existing.newMinutes : remainingOf(t);
    if (existing) {
      existing.action = 'skip';
      existing.saveMinutes += rem;
    } else {
      changes.push({ id: t.id, title: t.title, action: 'skip', saveMinutes: rem });
    }
    saved += rem;
  }
  return { needed: true, shortMinutes: short, changes, fits: saved >= short };
}

export function applyOverloadTriage(tasks, changes) {
  const byId = new Map(changes.map((c) => [c.id, c]));
  return tasks
    .filter((t) => byId.get(t.id)?.action !== 'skip')
    .map((t) => {
      const c = byId.get(t.id);
      if (!c || c.action !== 'core') return t;
      return {
        ...t,
        title: `Core: ${t.title.replace(/^(Learn|Practice): /, '')}`,
        estimatedMinutes: (Number(t.completedMinutes) || 0) + c.newMinutes,
        meta: { ...(t.meta || {}), timeNote: 'Trimmed to the core concepts and most-asked questions so the rest fits before your exam.' },
      };
    });
}

// How many whole days since the student last opened the app (0 = yesterday or today).
export function daysAway(lastActiveKey, todayKey) {
  if (!lastActiveKey || !todayKey) return 0;
  const diff = Math.round((new Date(`${todayKey}T00:00:00`) - new Date(`${lastActiveKey}T00:00:00`)) / 86400000);
  return Math.max(0, diff - 1);
}
