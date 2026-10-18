// Task breakdown tests: run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBreakdown, subtopicMinutes, graspFromChecks, parseSubtopics } from '../src/services/taskBreakdown.js';
import { buildStudyPlan } from '../src/services/plannerEngine.js';

// The user's real example: 3 data-structures lectures.
const LECTURES = (answers = {}) => ({
  kind: 'lectures',
  subject: 'Data Structures',
  goal: 'exam',
  speed: 1,
  graspSpeed: 'average',
  buildsOnPrevious: true,
  units: [
    { title: 'Linked lists', length: 60, subtopics: [{ name: 'Circular linked list', answers: answers.cll || [] }, { name: 'Doubly linked list', answers: answers.dll || [] }] },
    { title: 'Stacks & queues', length: 60, subtopics: [{ name: 'Stack', answers: answers.stack || [] }, { name: 'Queue', answers: answers.queue || [] }] },
    { title: 'Trees', length: 60, subtopics: [{ name: 'Binary trees', answers: answers.trees || [] }] },
  ],
});

test('subtopics parse from free text', () => {
  assert.deepEqual(parseSubtopics('Circular LL, DLL; Stack/Queue and Trees'), ['Circular LL', 'DLL', 'Stack', 'Queue', 'Trees']);
});

test('grasp comes from the quick self-check', () => {
  assert.equal(graspFromChecks(['know', 'know', 'partly']), (1 + 1 + 0.5) / 3);
  assert.equal(graspFromChecks([], 0.3), 0.3);
});

test('a new, hard topic gets far more time than a known, easy one', () => {
  const hardNew = subtopicMinutes({ contentMinutes: 20, complexity: 5, grasp: 0, goal: 'exam' });
  const easyKnown = subtopicMinutes({ contentMinutes: 20, complexity: 2, grasp: 1, goal: 'exam' });
  assert.ok(hardNew.total > easyKnown.total * 2, `${hardNew.total} vs ${easyKnown.total}`);
});

test('slow graspers and slower measured pace get more time; fast ones less', () => {
  const t = (graspSpeed, paceRatio = 1) => buildBreakdown({ ...LECTURES(), graspSpeed, paceRatio }).summary.totalMinutes;
  assert.ok(t('slow') > t('average') && t('average') > t('fast'));
  assert.ok(t('average', 1.4) > t('average'));
});

test('3 lectures become ordered, chunked, personally-timed steps', () => {
  const known = ['know', 'know', 'know'];
  const { steps, summary } = buildBreakdown(LECTURES({ stack: known, queue: known, trees: ['no', 'no', 'partly'] }));
  // Realistic total exceeds the naive 3 hours of video.
  assert.ok(summary.totalMinutes > summary.naiveMinutes);
  // Trees (new, hard) gets more learning time than Stack (known).
  const learnTime = (name) => steps.filter((s) => s.meta.kind === 'learn' && s.meta.subtopic === name).reduce((a, s) => a + s.estimatedMinutes, 0);
  assert.ok(learnTime('Binary trees') > learnTime('Stack') * 2);
  // No step longer than a pomodoro-style chunk (+ rounding).
  steps.filter((s) => s.meta.kind === 'learn').forEach((s) => assert.ok(s.estimatedMinutes <= 35));
  // Lecture 2 waits for lecture 1's summary; the final "connect" step waits for all summaries.
  const summaries = steps.filter((s) => s.meta.kind === 'summary');
  const firstOfLecture2 = steps.find((s) => s.meta.unit === 2);
  assert.equal(firstOfLecture2.meta.kind, 'learn'); // preview is folded into the first learning step
  assert.deepEqual(firstOfLecture2.dependsOn, [summaries[0].id]);
  const connect = steps.find((s) => s.meta.kind === 'connect');
  assert.deepEqual(connect.dependsOn, summaries.map((s) => s.id));
});

test('catch-up goal skips practice, reviews and the connect step', () => {
  const { steps } = buildBreakdown({ ...LECTURES(), goal: 'catchup' });
  assert.ok(!steps.some((s) => ['practice', 'review', 'connect'].includes(s.meta.kind)));
});

test('planner respects multiple prerequisites, day gaps and order', () => {
  const { steps } = buildBreakdown(LECTURES());
  const plan = buildStudyPlan({
    now: new Date('2026-10-17T08:00:00'),
    horizonDays: 7,
    userHabits: { chronotype: 'BALANCED', wakeTime: '07:00', sleepTime: '23:00', sessionStyle: 'pomodoro', habits: [] },
    tasks: steps,
  });
  const abs = (s) => s.dayIndex * 1440 + s.startMin;
  const firstOf = (id) => Math.min(...plan.sessions.filter((s) => s.taskId === id).map(abs));
  const lastEndOf = (id) => Math.max(...plan.sessions.filter((s) => s.taskId === id).map((s) => s.dayIndex * 1440 + s.endMin));
  const placed = new Set(plan.sessions.map((s) => s.taskId));
  steps.forEach((step) => {
    if (!placed.has(step.id)) return;
    (step.dependsOn || []).forEach((dep) => {
      if (placed.has(dep)) assert.ok(firstOf(step.id) >= lastEndOf(dep), `${step.title} starts before ${dep} ends`);
    });
  });
  // Recall reviews land at least a day after their summary.
  steps.filter((s) => s.meta.kind === 'review' && placed.has(s.id)).forEach((review) => {
    const summaryDay = Math.max(...plan.sessions.filter((s) => s.taskId === review.dependsOn[0]).map((s) => s.dayIndex));
    const reviewDay = Math.min(...plan.sessions.filter((s) => s.taskId === review.id).map((s) => s.dayIndex));
    assert.ok(reviewDay >= summaryDay + 1);
  });
  // No duplicate automatic reviews for broken-down steps.
  assert.ok(!plan.sessions.some((s) => s.kind === 'REVIEW'));
});

test('a 3-lecture exam plan fits alongside other work, starts today and finishes before the exam', () => {
  const { steps } = buildBreakdown({ ...LECTURES({ stack: ['know', 'know', 'know'], trees: ['no', 'no', 'no'] }), deadline: '2026-10-23' });
  const others = [
    { id: 'o1', title: 'Checkout feature', quadrant: 'Q1', estimatedMinutes: 75, difficulty: 4 },
    { id: 'o2', title: 'DP practice', quadrant: 'Q1', estimatedMinutes: 60 },
    { id: 'o3', title: 'Landing page', quadrant: 'Q2', estimatedMinutes: 50 },
    { id: 'o4', title: 'Paging notes', quadrant: 'Q2', estimatedMinutes: 45 },
    { id: 'o5', title: 'Lab report', quadrant: 'Q3', estimatedMinutes: 20 },
  ];
  const plan = buildStudyPlan({
    now: new Date('2026-10-18T10:30:00'),
    horizonDays: 7,
    userHabits: { chronotype: 'BALANCED', wakeTime: '07:30', sleepTime: '23:30', sessionStyle: 'pomodoro', habits: [{ name: 'Lunch', startTime: '13:00', endTime: '14:00' }] },
    tasks: [...steps, ...others],
  });
  assert.deepEqual(plan.unscheduled, []);
  const lecture = plan.sessions.filter((s) => s.taskId.startsWith('bd-'));
  assert.ok(lecture.some((s) => s.dayIndex === 0), 'lecture plan starts today');
  // Exam on day 5: only recall reviews may land on exam day; everything else finishes earlier.
  lecture.filter((s) => s.taskData.meta.kind !== 'review').forEach((s) => assert.ok(s.dayIndex <= 4));
});

test('estimates stay realistic: 3h of new lectures is under 2x the video, known material ~1x', () => {
  const total = (answers) => buildBreakdown(LECTURES({ cll: answers, dll: answers, stack: answers, queue: answers, trees: answers })).summary.totalMinutes;
  const allNew = total(['no', 'no', 'no']);
  const known = total(['know', 'know', 'know']);
  assert.ok(allNew <= 2 * 180, `new: ${allNew} min`);
  assert.ok(known <= 1.25 * 180, `known: ${known} min`);
  assert.ok(allNew > known);
});

const HABITS = { chronotype: 'BALANCED', wakeTime: '07:30', sleepTime: '23:30', sessionStyle: 'pomodoro', distractionFactor: 1.25, habits: [{ name: 'Lunch', startTime: '13:00', endTime: '14:00' }] };

test('a 2-3 hour task is finished on one day when that day has room', () => {
  for (const minutes of [120, 150, 180]) {
    const plan = buildStudyPlan({ now: new Date('2026-10-18T09:00:00'), horizonDays: 7, userHabits: HABITS, tasks: [{ id: 't', title: 'Finish DBMS assignment', taskType: 'assignment', quadrant: 'Q2', estimatedMinutes: minutes, difficulty: 3 }] });
    const days = new Set(plan.sessions.filter((s) => s.kind === 'WORK').map((s) => s.dayIndex));
    assert.equal(days.size, 1, `${minutes} min task spread over ${days.size} days`);
  }
});

test('each lecture of a broken-down plan is completed within one day', () => {
  const { steps } = buildBreakdown(LECTURES());
  const plan = buildStudyPlan({ now: new Date('2026-10-18T09:00:00'), horizonDays: 7, userHabits: HABITS, tasks: steps });
  [1, 2, 3].forEach((unit) => {
    const days = new Set(plan.sessions.filter((s) => s.taskData.meta.unit === unit && s.taskData.meta.kind !== 'review').map((s) => s.dayIndex));
    assert.equal(days.size, 1, `lecture ${unit} spread over ${days.size} days`);
  });
});
