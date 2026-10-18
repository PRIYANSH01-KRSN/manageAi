// Quick add, planning-fallacy buffer, time budgets and AI model selection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickTask, withPlanningBuffer, planQuickSession } from '../src/services/quickTask.js';
import { pickBestFlashModel } from '../server/app.js';

test('offline quick-add understands chapters, pages and problems', () => {
  const ch = parseQuickTask('Study Chapter 4 of NCERT Physics');
  assert.equal(ch.subject, 'Physics');
  assert.equal(ch.taskType, 'learn');
  assert.ok(ch.averageMinutes >= 60 && ch.averageMinutes <= 180, `${ch.averageMinutes}`);
  const pages = parseQuickTask('read 50 pages of history');
  assert.ok(pages.averageMinutes > 150, `50 pages → ${pages.averageMinutes}`);
  assert.equal(parseQuickTask('solve 20 problems on integration').taskType, 'practice');
});

test('a student guess gets +50% and the reason is shown; AI estimates get +20%', () => {
  const g = withPlanningBuffer(60, 'userGuess');
  assert.equal(g.planned, 90);
  assert.match(g.reason, /planning fallacy/);
  assert.equal(withPlanningBuffer(100, 'averageStudent').planned, 120);
});

test('session size follows energy and never exceeds the time budget', () => {
  assert.equal(planQuickSession({ plannedMinutes: 150, energyLevel: 'SHARP' }).minutes, 90);
  assert.equal(planQuickSession({ plannedMinutes: 150, energyLevel: 'FRIED' }).minutes, 25);
  assert.equal(planQuickSession({ plannedMinutes: 150, energyLevel: 'SHARP', budgetMinutes: 50 }).minutes, 50);
  const small = planQuickSession({ plannedMinutes: 40, energyLevel: 'SHARP' });
  assert.equal(small.minutes, 40);
  assert.equal(small.remainingAfter, 0);
  assert.match(planQuickSession({ plannedMinutes: 150, energyLevel: 'STEADY' }).note, /planned for later|your plan for later/);
});

test('picks the newest stable flash model when the configured one does not exist', () => {
  const models = [
    { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  ];
  assert.equal(pickBestFlashModel(models), 'gemini-2.5-flash');
  assert.equal(pickBestFlashModel([{ name: 'models/gemini-2.0-flash-lite', supportedGenerationMethods: ['generateContent'] }]), 'gemini-2.0-flash-lite');
  assert.equal(pickBestFlashModel([]), null);
});
