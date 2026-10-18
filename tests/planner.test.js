// Engine tests: run with `npm test` (Node's built-in test runner, no extra dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudyPlan, focusCapacityUntil } from '../src/services/plannerEngine.js';
import { estimateFromVolume, sanityCheckEstimate, computeCalibration } from '../src/services/estimationEngine.js';
import { buildBattlePlan } from '../src/services/battlePlanner.js';
import { buildTaskCoaching } from '../src/services/taskCoach.js';

const NOW = new Date('2026-10-17T09:10:00'); // Saturday
const HABITS = {
  chronotype: 'MORNING_LARK',
  wakeTime: '07:00',
  sleepTime: '23:00',
  distractionFactor: 1.25,
  sessionStyle: 'pomodoro',
  leisureMinutes: 60,
  habits: [{ name: 'Lunch', startTime: '13:00', endTime: '14:00' }],
};
const base = (extra = {}) => ({ now: NOW, horizonDays: 4, userHabits: HABITS, fixedSchedule: [], ...extra });
const overlaps = (a, b) => a.startMin < b.endMin && b.startMin < a.endMin;

test('sessions never overlap fixed blocks, each other, or the past', () => {
  const plan = buildStudyPlan(base({
    fixedSchedule: [{ title: 'Class', dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
    tasks: [
      { id: 'a', title: 'Hard', quadrant: 'Q1', estimatedMinutes: 150, difficulty: 5 },
      { id: 'b', title: 'Easy', quadrant: 'Q3', estimatedMinutes: 40, difficulty: 1 },
    ],
  }));
  plan.days.forEach((d) => {
    const fixed = d.items.filter((i) => i.isFixed);
    d.sessions.forEach((s, i) => {
      fixed.forEach((f) => assert.ok(!overlaps(s, f), `${s.taskTitle} overlaps ${f.title} on ${d.label}`));
      d.sessions.slice(i + 1).forEach((o) => assert.ok(!overlaps(s, o), 'sessions overlap'));
    });
  });
  plan.days[0].sessions.forEach((s) => assert.ok(s.startMin >= 9 * 60 + 15));
});

test('hard work lands in higher-energy slots than easy work', () => {
  const plan = buildStudyPlan(base({
    tasks: [
      { id: 'a', title: 'Hard', quadrant: 'Q2', estimatedMinutes: 30, difficulty: 5 },
      { id: 'b', title: 'Easy', quadrant: 'Q2', estimatedMinutes: 30, difficulty: 1 },
    ],
  }));
  const hard = plan.sessions.find((s) => s.taskId === 'a');
  const easy = plan.sessions.find((s) => s.taskId === 'b');
  assert.equal(hard.energyLevel, 'PEAK_FOCUS');
  assert.notEqual(easy.energyLevel, 'PEAK_FOCUS');
});

test('deadline work finishes the day before the due date', () => {
  const plan = buildStudyPlan(base({
    tasks: [{ id: 'a', title: 'Exam prep', quadrant: 'Q1', estimatedMinutes: 120, difficulty: 4, deadline: '2026-10-19', taskType: 'practice' }],
  }));
  const work = plan.sessions.filter((s) => s.kind === 'WORK');
  assert.ok(work.length > 0);
  work.forEach((s) => assert.ok(s.dayIndex <= 1, `work on day ${s.dayIndex}`));
});

test('dependent tasks are scheduled after their prerequisite', () => {
  const plan = buildStudyPlan(base({
    tasks: [
      { id: 'p', title: 'Practice', quadrant: 'Q1', estimatedMinutes: 30, difficulty: 3, dependsOn: 'l' },
      { id: 'l', title: 'Learn', quadrant: 'Q2', estimatedMinutes: 60, difficulty: 4 },
    ],
  }));
  const abs = (s) => s.dayIndex * 1440 + s.startMin;
  const lastLearn = Math.max(...plan.sessions.filter((s) => s.taskId === 'l' && s.kind === 'WORK').map(abs));
  const firstPractice = Math.min(...plan.sessions.filter((s) => s.taskId === 'p').map(abs));
  assert.ok(firstPractice > lastLearn);
});

test('daily focus cap and light-day mode are respected', () => {
  const tasks = [{ id: 'a', title: 'Big', quadrant: 'Q2', estimatedMinutes: 900, difficulty: 3 }];
  const plan = buildStudyPlan(base({ tasks, userHabits: { ...HABITS, dailyFocusCapMinutes: 120 } }));
  plan.days.forEach((d) => assert.ok(d.focusMinutes <= 120));
  assert.ok(plan.unscheduled.length > 0);

  const light = buildStudyPlan(base({ tasks, dayContexts: { '2026-10-17': { mode: 'LIGHT' } } }));
  light.days[0].sessions.forEach((s) => assert.ok(s.rawDuration <= 20));
});

test('plan C caps today at 45 minutes and only must-dos', () => {
  const plan = buildStudyPlan(base({
    tasks: [
      { id: 'must', title: 'Must', quadrant: 'Q1', estimatedMinutes: 120, difficulty: 3 },
      { id: 'opt', title: 'Optional', quadrant: 'Q4', estimatedMinutes: 60, difficulty: 2 },
    ],
    dayContexts: { '2026-10-17': { planVariant: 'C' } },
  }));
  const today = plan.days[0];
  assert.ok(today.focusMinutes <= 45);
  today.sessions.forEach((s) => assert.equal(s.taskId, 'must'));
});

test('check-in busy blocks, leisure and wind-down are kept free', () => {
  const plan = buildStudyPlan(base({
    tasks: [{ id: 'a', title: 'Work', quadrant: 'Q1', estimatedMinutes: 400, difficulty: 3 }],
    dayContexts: { '2026-10-17': { busyBlocks: [{ title: 'Doctor', startTime: '15:00', endTime: '16:00' }] } },
  }));
  const today = plan.days[0];
  const protectedItems = today.items.filter((i) => ['PERSONAL', 'LEISURE', 'WIND_DOWN'].includes(i.type));
  assert.equal(protectedItems.length, 3);
  today.sessions.forEach((s) => protectedItems.forEach((p) => assert.ok(!overlaps(s, p))));
});

test('every session carries actionable coaching', () => {
  const plan = buildStudyPlan(base({ tasks: [{ id: 'a', title: 'Chapter 4 thermodynamics', quadrant: 'Q1', estimatedMinutes: 60, taskType: 'learn', roadblock: 'entropy' }] }));
  const s = plan.nextSession;
  assert.ok(s.coaching.starter.length > 10);
  assert.ok(s.coaching.script.length >= 3);
  assert.equal(s.coaching.script[s.coaching.script.length - 1].to <= s.rawDuration + 2, true);
  assert.ok(s.coaching.ifThen.some((t) => t.includes('entropy')));
  assert.equal(s.coaching.shrinkLadder[s.coaching.shrinkLadder.length - 1].minutes, 2);
});

test('volume estimates scale with knowledge and flag unrealistic guesses', () => {
  const novice = estimateFromVolume({ volumeType: 'pages', volumeCount: 20, knowledgeLevel: 0, difficulty: 3, taskType: 'learn' });
  const expert = estimateFromVolume({ volumeType: 'pages', volumeCount: 20, knowledgeLevel: 3, difficulty: 3, taskType: 'learn' });
  assert.ok(novice.planned > expert.planned * 1.8);
  assert.ok(novice.optimistic < novice.likely && novice.likely < novice.pessimistic);
  const warnings = sanityCheckEstimate({ volumeType: 'chapters', volumeCount: 2, knowledgeLevel: 1, taskType: 'learn' }, 20);
  assert.equal(warnings[0].level, 'low');
});

test('calibration learns a slower pace but is shrunk toward 1', () => {
  const logs = Array.from({ length: 6 }, () => ({ plannedMinutes: 25, actualMinutes: 50, subject: 'Physics' }));
  const cal = computeCalibration(logs);
  assert.ok(cal['subject:physics'].ratio > 1.4 && cal['subject:physics'].ratio < 2);
});

test('battle plan triages weak, high-weight chapters first and skims when short on time', () => {
  const chapters = [
    { name: 'Easy minor', size: 'M', knowledgeLevel: 3, weight: 1 },
    { name: 'Weak major', size: 'L', knowledgeLevel: 0, weight: 5 },
    { name: 'Medium', size: 'M', knowledgeLevel: 1, weight: 3 },
  ];
  const roomy = buildBattlePlan({ subject: 'Econ', examDate: '2026-10-25', chapters, capacityMinutes: 5000 });
  assert.equal(roomy.summary.startHere.title, 'Learn: Weak major');
  assert.equal(roomy.summary.coveragePct, 100);
  const practice = roomy.tasks.find((t) => t.title === 'Practice: Weak major');
  assert.deepEqual(practice.dependsOn, [roomy.tasks.find((t) => t.title === 'Learn: Weak major').id]);

  const tight = buildBattlePlan({ subject: 'Econ', examDate: '2026-10-25', chapters, capacityMinutes: 300 });
  // Short on time: something is skimmed or explicitly skipped, but never the high-value weak chapter.
  assert.ok(tight.summary.skimmed.length + tight.summary.skipped.length > 0);
  assert.ok(!tight.summary.skimmed.includes('Weak major'));
  assert.ok(!tight.summary.skipped.some((c) => c.name === 'Weak major'));
});

test('capacity helper reports free focus time before a date', () => {
  const cap = focusCapacityUntil(base(), '2026-10-20');
  assert.ok(cap > 300 && cap < 3 * 300 + 1);
});

test('low-mood context changes the coaching tone', () => {
  const c = buildTaskCoaching({ title: 'Essay', taskType: 'assignment' }, { minutes: 25, dayContext: { mood: 1 } });
  assert.ok(c.tips.some((t) => t.toLowerCase().includes('low mood')));
});

test('triage is optimal: matches brute force on small syllabi', async () => {
  const { triageChapters } = await import('../src/services/battlePlanner.js');
  const chapters = [
    { total: 120, gainable: 20 },
    { total: 90, gainable: 9 },
    { total: 60, gainable: 12 },
    { total: 150, gainable: 25 },
    { total: 45, gainable: 3 },
  ];
  const opt = (c, mode) => ({
    SKIP: [0, 0],
    FULL: [Math.ceil(c.total / 5) * 5, c.gainable],
    CORE: [Math.ceil((c.total * 0.45) / 5) * 5, c.gainable * 0.7],
    SKIM: [20, c.gainable * 0.25],
  })[mode];
  for (const budget of [60, 150, 240, 400]) {
    let bestBrute = 0;
    const modesList = ['SKIP', 'FULL', 'CORE', 'SKIM'];
    const rec = (i, time, gain) => {
      if (time > budget) return;
      if (i === chapters.length) { bestBrute = Math.max(bestBrute, gain); return; }
      modesList.forEach((m) => { const [t, g] = opt(chapters[i], m); rec(i + 1, time + t, gain + g); });
    };
    rec(0, 0, 0);
    const modes = triageChapters(chapters, budget);
    const used = modes.reduce((a, m, i) => a + opt(chapters[i], m)[0], 0);
    const gain = modes.reduce((a, m, i) => a + opt(chapters[i], m)[1], 0);
    assert.ok(used <= budget, `over budget at ${budget}`);
    assert.ok(Math.abs(gain - bestBrute) < 1e-6, `budget ${budget}: dp ${gain} vs brute ${bestBrute}`);
  }
});

test('20 chapters in 3 days: picks high-yield chapters and gives permission to skip the rest', () => {
  const chapters = Array.from({ length: 20 }, (_, i) => ({
    name: `Chapter ${i + 1}`,
    size: 'M',
    knowledgeLevel: i % 4,
    marks: [15, 4, 10, 2, 12][i % 5],
    pastPaper: i % 3 === 0 ? 'often' : 'sometimes',
  }));
  const plan = buildBattlePlan({ subject: 'Economics', examDate: '2026-10-21', chapters, capacityMinutes: 3 * 240, today: new Date('2026-10-18T09:00:00') });
  const s = plan.summary;
  assert.ok(s.skipped.length >= 8, `skipped ${s.skipped.length}`);
  assert.match(s.permission, /smart call/);
  assert.ok(s.highYield.length > 0 && s.highYield.length <= 5);
  assert.ok(plan.tasks.reduce((a, t) => a + t.estimatedMinutes, 0) <= 3 * 240 * 0.9 + 5);
  // High-mark chapters are favoured over low-mark ones.
  const skippedMarks = s.skipped.reduce((a, c) => a + c.marks, 0) / s.skipped.length;
  assert.ok(skippedMarks < 10, `average skipped marks ${skippedMarks}`);
  assert.ok(s.expectedMarks > s.securedNowMarks);
});
