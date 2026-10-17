// Battle Plan Generator: deadline + syllabus + knowledge level → prioritized, sequenced,
// feasibility-checked task list. Pure function so it runs offline and is unit-testable.
import { estimateFromVolume } from './estimationEngine.js';

const SIZE_TO_CHAPTERS = { S: 0.6, M: 1, L: 1.5 };
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function learnMinutes(ch) {
  const base = {
    knowledgeLevel: ch.knowledgeLevel,
    difficulty: ch.difficulty || 3,
    taskType: 'learn',
  };
  const est = Number(ch.pages) > 0
    ? estimateFromVolume({ ...base, volumeType: 'pages', volumeCount: Number(ch.pages) })
    : estimateFromVolume({ ...base, volumeType: 'chapters', volumeCount: SIZE_TO_CHAPTERS[ch.size || 'M'] || 1 });
  return est ? est.planned : 60;
}

export function buildBattlePlan({ subject = '', examDate, chapters = [], capacityMinutes = Infinity, includeMock = true, stamp = Date.now() }) {
  const valid = chapters.filter((c) => c.name && c.name.trim());
  const daysLeft = examDate ? Math.round((new Date(`${examDate}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : 7;
  const quadrant = daysLeft <= 3 ? 'Q1' : 'Q2';
  const groupId = `bp-${stamp}`;

  // Triage: exam weight × weakness. Weak, high-weight chapters first.
  const ranked = valid
    .map((c, idx) => ({ ...c, idx, knowledgeLevel: Number(c.knowledgeLevel ?? 1), weight: Number(c.weight || 3) }))
    .map((c) => ({ ...c, score: c.weight * (4 - c.knowledgeLevel) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  const planned = ranked.map((c) => {
    const learn = c.knowledgeLevel >= 3 ? 0 : learnMinutes(c);
    const practice = c.knowledgeLevel >= 3 ? 30 : Math.max(20, round5(learn * 0.45));
    return { ...c, learn, practice, total: learn + practice };
  });

  const mockMinutes = includeMock && valid.length > 0 ? (valid.length >= 4 ? 90 : 60) : 0;
  const finalReview = valid.length > 0 ? 45 : 0;
  const budget = capacityMinutes * 0.9; // keep 10% slack for real life

  // Fit chapters in priority order: fully if possible, otherwise a scaled-down "core
  // concepts" version for important chapters, and only skim what's left over.
  let used = mockMinutes + finalReview;
  planned.forEach((c) => {
    const left = budget - used;
    if (c.total <= left) {
      c.mode = 'FULL';
      used += c.total;
    } else if (left >= Math.max(40, c.total * 0.35)) {
      const scale = left / c.total;
      c.mode = 'CORE';
      c.learn = c.learn > 0 ? round5(c.learn * scale) : 0;
      c.practice = Math.max(15, round5(c.practice * scale));
      c.total = c.learn + c.practice;
      used += c.total;
    } else {
      c.mode = 'SKIM';
      c.total = 20;
      used += 20;
    }
  });

  const tasks = [];
  const make = (t) => {
    const task = {
      id: `${groupId}-${tasks.length}`,
      category: 'academic',
      subject: subject || undefined,
      quadrant,
      deadline: examDate || undefined,
      groupId,
      confidence: 3,
      completedMinutes: 0,
      ...t,
    };
    tasks.push(task);
    return task;
  };

  let lastId = null;
  planned.forEach((c) => {
    const label = c.name.trim();
    if (c.mode === 'SKIM') {
      lastId = make({
        title: `Skim key points: ${label}`,
        taskType: 'revise',
        estimatedMinutes: 20,
        difficulty: 2,
        knowledgeLevel: c.knowledgeLevel,
        weightage: c.weight,
        materials: [`${label} summary / headings`],
        roadblock: 'Trying to learn everything instead of the essentials',
        stuckProtocol: 'Only write the 5 most-examined facts or formulas; move on.',
      }).id;
      return;
    }
    let learnTask = null;
    if (c.learn > 0) {
      learnTask = make({
        title: c.mode === 'CORE' ? `Learn core concepts: ${label}` : `Learn: ${label}`,
        taskType: 'learn',
        estimatedMinutes: c.learn,
        difficulty: c.difficulty || (c.knowledgeLevel === 0 ? 4 : 3),
        knowledgeLevel: c.knowledgeLevel,
        weightage: c.weight,
        volumeType: Number(c.pages) > 0 ? 'pages' : undefined,
        volumeCount: Number(c.pages) > 0 ? Number(c.pages) : undefined,
        materials: [`${label} notes / textbook`],
        roadblock: c.knowledgeLevel === 0 ? 'Getting lost in details of a brand-new topic' : 'Passive rereading',
        stuckProtocol: 'Write the exact confusing point, check one alternative explanation (video/notes), then move on.',
      });
    }
    lastId = make({
      title: c.mode === 'CORE' ? `Practice key question types: ${label}` : `Practice: ${label}`,
      taskType: 'practice',
      estimatedMinutes: c.practice,
      difficulty: Math.max(3, c.difficulty || 3),
      knowledgeLevel: c.knowledgeLevel,
      weightage: c.weight,
      dependsOn: learnTask?.id,
      materials: [`${label} problems / past questions`],
      roadblock: 'Peeking at solutions too early',
      stuckProtocol: 'Give each problem 10 minutes max, then study the solution and redo it without looking.',
    }).id;
  });

  if (mockMinutes) {
    lastId = make({
      title: `Mock test: ${subject || 'full syllabus'} (timed, exam conditions)`,
      taskType: 'practice',
      estimatedMinutes: mockMinutes,
      difficulty: 4,
      weightage: 5,
      dependsOn: lastId,
      materials: ['Past paper or self-made question set', 'Timer'],
      roadblock: 'Stopping to look things up mid-test',
      stuckProtocol: 'Mark the question, move on, return at the end — just like the real exam.',
    }).id;
  }
  if (finalReview) {
    make({
      title: `Final review: mistakes & weak spots${subject ? ` (${subject})` : ''}`,
      taskType: 'revise',
      estimatedMinutes: finalReview,
      difficulty: 2,
      weightage: 5,
      dependsOn: lastId,
      materials: ['Your mistake log', 'Formula / key-points sheet'],
      roadblock: 'Starting new material the night before',
      stuckProtocol: 'Only review what you already studied. Sleep is the final revision.',
    });
  }

  const totalMinutes = tasks.reduce((a, t) => a + t.estimatedMinutes, 0);
  const full = planned.filter((c) => c.mode === 'FULL');
  const skimmed = planned.filter((c) => c.mode === 'SKIM').map((c) => c.name.trim());
  const core = planned.filter((c) => c.mode === 'CORE').map((c) => c.name.trim());

  return {
    tasks,
    summary: {
      daysLeft,
      totalMinutes,
      capacityMinutes: Number.isFinite(capacityMinutes) ? Math.round(capacityMinutes) : null,
      coveragePct: valid.length ? Math.round((full.length / valid.length) * 100) : 0,
      skimmed,
      core,
      startHere: tasks[0] || null,
      phases: [
        { name: 'Phase 1 · Learn the weakest, highest-weight chapters first', items: tasks.filter((t) => t.taskType === 'learn').map((t) => t.title) },
        { name: 'Phase 2 · Practice right after each chapter', items: tasks.filter((t) => t.taskType === 'practice' && !t.title.startsWith('Mock')).map((t) => t.title) },

        { name: 'Phase 3 · Mock test, then review mistakes', items: tasks.filter((t) => t.title.startsWith('Mock') || t.title.startsWith('Final') || t.title.startsWith('Skim')).map((t) => t.title) },
      ].filter((p) => p.items.length > 0),
    },
  };
}
