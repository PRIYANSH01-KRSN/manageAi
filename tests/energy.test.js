// Focus My Energy tests: run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTask, inferEnergy, recommendForEnergy, energyPatterns, makeEnergyLogEntry } from '../src/services/energyMatcher.js';
import { buildHourlyEnergyCurve } from '../src/services/plannerEngine.js';

const at = (iso) => new Date(iso);
const TASKS = [
  { id: 'essay', title: 'Write history essay draft', taskType: 'assignment', difficulty: 4, quadrant: 'Q2', estimatedMinutes: 120 },
  { id: 'review', title: 'Review lecture notes', taskType: 'revise', difficulty: 2, quadrant: 'Q2', estimatedMinutes: 30 },
  { id: 'form', title: 'Submit scholarship form', taskType: 'admin', quadrant: 'Q3', estimatedMinutes: 15 },
];

test('tasks are classified into deep / steady / low drain', () => {
  assert.equal(classifyTask(TASKS[0]).tier, 'DEEP');
  assert.equal(classifyTask(TASKS[1]).tier, 'STEADY');
  assert.equal(classifyTask(TASKS[2]).tier, 'LOW');
  assert.equal(classifyTask({ title: 'Reply to group email' }).tier, 'LOW');
  assert.equal(classifyTask({ title: 'Debug the login API' }).tier, 'DEEP');
});

test('live self-report beats the energy profile', () => {
  const now = at('2026-10-19T14:15:00');
  const profile = { dipStart: '14:00', dipEnd: '15:30' };
  const fromProfile = inferEnergy({ profile, now });
  assert.equal(fromProfile.level, 'FRIED');
  assert.equal(fromProfile.source, 'profile');
  assert.match(fromProfile.reason, /14:00–15:30/);

  const report = { level: 'SHARP', ts: new Date(now - 10 * 60000).toISOString() };
  const fromSelf = inferEnergy({ latestReport: report, profile, now });
  assert.equal(fromSelf.level, 'SHARP');
  assert.equal(fromSelf.source, 'self');

  const stale = { level: 'SHARP', ts: new Date(now - 3 * 3600000).toISOString() };
  assert.equal(inferEnergy({ latestReport: stale, profile, now }).source, 'profile');
});

test('falls back to check-in, then time-of-day heuristics', () => {
  const now = at('2026-10-19T10:00:00');
  assert.equal(inferEnergy({ checkin: { energy: 2, mood: 3 }, now }).level, 'FRIED');
  const guess = inferEnergy({ chronotype: 'MORNING_LARK', now });
  assert.equal(guess.source, 'time');
  assert.equal(guess.level, 'SHARP');
});

test('sharp → hardest task now; fried → easy win and save deep work', () => {
  const now = at('2026-10-19T10:00:00');
  const sharp = recommendForEnergy({ tasks: TASKS, energy: { level: 'SHARP' }, now });
  assert.equal(sharp.doNow.task.id, 'essay');
  assert.match(sharp.doNow.why, /do it now/i);

  const fried = recommendForEnergy({ tasks: TASKS, energy: { level: 'FRIED' }, now });
  assert.equal(fried.doNow.task.id, 'form');
  assert.ok(fried.saveForLater.some((s) => s.task.id === 'essay'));
  assert.ok(!/fail|lazy|should have/i.test(fried.doNow.why));
});

test('a deadline today overrides energy matching with a smaller first step', () => {
  const now = at('2026-10-19T15:00:00');
  const tasks = [...TASKS.slice(1), { ...TASKS[0], deadline: '2026-10-19' }];
  const rec = recommendForEnergy({ tasks, energy: { level: 'FRIED' }, now });
  assert.equal(rec.doNow.task.id, 'essay');
  assert.equal(rec.doNow.deadlineOverride, true);
  assert.match(rec.doNow.why, /due today/);
});

test('no tasks → says so, invents nothing', () => {
  const rec = recommendForEnergy({ tasks: [], energy: { level: 'SHARP' } });
  assert.equal(rec.empty, true);
});

test('patterns surface repeated fatigue and profile mismatches', () => {
  const log = [];
  for (let i = 0; i < 3; i++) log.push({ ...makeEnergyLogEntry('FRIED', 'classes', at(`2026-10-1${i + 2}T13:00:00`)) });
  for (let i = 0; i < 2; i++) log.push({ ...makeEnergyLogEntry('SHARP', null, at(`2026-10-1${i + 5}T14:30:00`)) });
  const insights = energyPatterns(log, { dipStart: '14:00', dipEnd: '15:30' });
  assert.ok(insights.some((i) => i.id === 'after-classes'));
  assert.ok(insights.some((i) => i.id === 'dip-mismatch'));
});

test('energy profile reshapes the planner energy curve', () => {
  const base = buildHourlyEnergyCurve('MORNING_LARK');
  const custom = buildHourlyEnergyCurve('MORNING_LARK', { peakStart: '20:00', peakEnd: '22:00', dipStart: '10:00', dipEnd: '11:00' });
  assert.ok(custom[21] > base[21] + 0.2);
  assert.ok(custom[10] < base[10] - 0.3);
});
