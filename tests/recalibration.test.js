// Anti-fragile recalibration tests: run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeOverloadTriage, applyOverloadTriage, daysAway } from '../src/services/overloadTriage.js';
import { buildStudyPlan } from '../src/services/plannerEngine.js';

const HABITS = { chronotype: 'BALANCED', wakeTime: '07:30', sleepTime: '23:30', sessionStyle: 'pomodoro', habits: [{ name: 'Lunch', startTime: '13:00', endTime: '14:00' }] };

test('days away counts missed days, not today or yesterday', () => {
  assert.equal(daysAway('2026-10-18', '2026-10-18'), 0);
  assert.equal(daysAway('2026-10-17', '2026-10-18'), 0);
  assert.equal(daysAway('2026-10-15', '2026-10-18'), 2);
  assert.equal(daysAway(null, '2026-10-18'), 0);
});

test('after missing days, an overloaded plan is made to fit by trimming the lowest-value work first', () => {
  // 2 days left before the exam, far more work than fits.
  const tasks = [
    { id: 'big', title: 'Learn: Thermodynamics', taskType: 'learn', quadrant: 'Q1', weightage: 5, estimatedMinutes: 300, deadline: '2026-10-21' },
    { id: 'mid', title: 'Practice: Optics', taskType: 'practice', quadrant: 'Q1', weightage: 3, estimatedMinutes: 240, deadline: '2026-10-21' },
    { id: 'low', title: 'Learn: History of physics', taskType: 'learn', quadrant: 'Q2', weightage: 1, estimatedMinutes: 240, deadline: '2026-10-21' },
    { id: 'tiny', title: 'Learn: Units recap', taskType: 'learn', quadrant: 'Q2', weightage: 2, estimatedMinutes: 120, deadline: '2026-10-21' },
  ];
  const plan = buildStudyPlan({ now: new Date('2026-10-19T09:00:00'), horizonDays: 3, userHabits: { ...HABITS, dailyFocusCapMinutes: 240 }, tasks });
  assert.ok(plan.unscheduled.length > 0, 'scenario should start overloaded');

  const triage = proposeOverloadTriage(tasks, plan);
  assert.equal(triage.needed, true);
  assert.ok(triage.fits);
  // The highest-value chapter is never the first thing cut.
  assert.notEqual(triage.changes[0].id, 'big');
  assert.ok(!triage.changes.some((c) => c.id === 'big' && c.action === 'skip'));

  const trimmed = applyOverloadTriage(tasks, triage.changes);
  const replanned = buildStudyPlan({ now: new Date('2026-10-19T09:00:00'), horizonDays: 3, userHabits: { ...HABITS, dailyFocusCapMinutes: 240 }, tasks: trimmed });
  const before = plan.unscheduled.reduce((a, u) => a + u.minutes, 0);
  const after = replanned.unscheduled.reduce((a, u) => a + u.minutes, 0);
  assert.ok(after < before, `still short ${after} (was ${before})`);
  assert.ok(trimmed.some((t) => t.title.startsWith('Core:')) || trimmed.length < tasks.length);
});

test('no triage when everything fits', () => {
  const tasks = [{ id: 'a', title: 'Learn: Sets', taskType: 'learn', quadrant: 'Q2', estimatedMinutes: 60 }];
  const plan = buildStudyPlan({ now: new Date('2026-10-19T09:00:00'), horizonDays: 7, userHabits: HABITS, tasks });
  assert.equal(proposeOverloadTriage(tasks, plan).needed, false);
});
