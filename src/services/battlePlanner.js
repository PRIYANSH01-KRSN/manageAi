// Battle Plan Generator: exam date + syllabus (marks, past-paper frequency, how well you
// know each chapter) → the study plan that wins the most marks in the time you really have,
// plus an explicit, guilt-free list of what to skip. Pure function: offline + unit-testable.
//
// Triage is an exact optimisation (multiple-choice knapsack, solved by dynamic programming):
// every chapter can be studied FULL, CORE (key concepts + common question types), SKIM
// (key facts only) or SKIPPED; we pick the combination that maximises expected marks
// gained within the free study time.
import { estimateFromVolume } from './estimationEngine.js';

const SIZE_TO_CHAPTERS = { S: 0.6, M: 1, L: 1.5 };
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

export const PAST_PAPER_FREQUENCY = {
  often: { id: 'often', label: 'Comes up often', factor: 1.3 },
  sometimes: { id: 'sometimes', label: 'Sometimes', factor: 1.0 },
  rarely: { id: 'rarely', label: 'Rarely', factor: 0.7 },
};

// Share of a chapter's marks a student can already secure, by self-rated knowledge.
const ALREADY_SECURED = [0, 0.25, 0.55, 0.85];

// Diminishing returns: the first ~45% of the effort captures ~70% of what's gainable.
const MODES = {
  FULL: { timeShare: 1, gainShare: 1 },
  CORE: { timeShare: 0.45, gainShare: 0.7 },
  SKIM: { fixedMinutes: 20, gainShare: 0.25 },
};

function learnMinutes(ch) {
  const base = { knowledgeLevel: ch.knowledgeLevel, difficulty: ch.difficulty || 3, taskType: 'learn' };
  const est = Number(ch.pages) > 0
    ? estimateFromVolume({ ...base, volumeType: 'pages', volumeCount: Number(ch.pages) })
    : estimateFromVolume({ ...base, volumeType: 'chapters', volumeCount: SIZE_TO_CHAPTERS[ch.size || 'M'] || 1 });
  return est ? est.planned : 60;
}

/**
 * Choose FULL / CORE / SKIM / SKIP per chapter to maximise expected marks within `budget`
 * minutes. Exact DP over 5-minute units.
 */
export function triageChapters(chapters, budgetMinutes) {
  const UNIT = 5;
  const cap = Math.max(0, Math.floor(budgetMinutes / UNIT));
  const options = chapters.map((c) => {
    const opts = [{ mode: 'SKIP', units: 0, gain: 0 }];
    const fullUnits = Math.ceil(c.total / UNIT);
    opts.push({ mode: 'FULL', units: fullUnits, gain: c.gainable * MODES.FULL.gainShare });
    const coreUnits = Math.ceil((c.total * MODES.CORE.timeShare) / UNIT);
    if (coreUnits < fullUnits) opts.push({ mode: 'CORE', units: coreUnits, gain: c.gainable * MODES.CORE.gainShare });
    const skimUnits = MODES.SKIM.fixedMinutes / UNIT;
    if (skimUnits < coreUnits) opts.push({ mode: 'SKIM', units: skimUnits, gain: c.gainable * MODES.SKIM.gainShare });
    return opts;
  });

  // best[i][t] = max gain using the first i chapters within t units
  const n = chapters.length;
  const best = Array.from({ length: n + 1 }, () => new Float64Array(cap + 1));
  const choice = Array.from({ length: n + 1 }, () => new Int8Array(cap + 1));
  for (let i = 1; i <= n; i++) {
    const opts = options[i - 1];
    for (let t = 0; t <= cap; t++) {
      let bestVal = -1;
      let bestOpt = 0;
      opts.forEach((o, k) => {
        if (o.units > t) return;
        const v = best[i - 1][t - o.units] + o.gain;
        // Tie-break towards deeper study (more time on the same chapter when it's free).
        if (v > bestVal + 1e-9 || (Math.abs(v - bestVal) < 1e-9 && o.units > opts[bestOpt].units)) {
          bestVal = v;
          bestOpt = k;
        }
      });
      best[i][t] = bestVal;
      choice[i][t] = bestOpt;
    }
  }

  const modes = new Array(n);
  let t = cap;
  for (let i = n; i >= 1; i--) {
    const o = options[i - 1][choice[i][t]];
    modes[i - 1] = o.mode;
    t -= o.units;
  }
  return modes;
}

export function buildBattlePlan({ subject = '', examDate, chapters = [], capacityMinutes = Infinity, includeMock = true, stamp = Date.now(), today = new Date() }) {
  const valid = chapters.filter((c) => c.name && c.name.trim());
  const daysLeft = examDate ? Math.round((new Date(`${examDate}T00:00:00`) - new Date(new Date(today).toDateString())) / 86400000) : 7;
  const quadrant = daysLeft <= 3 ? 'Q1' : 'Q2';
  const groupId = `bp-${stamp}`;

  const chaptersInfo = valid.map((c, idx) => {
    const knowledgeLevel = Math.max(0, Math.min(3, Number(c.knowledgeLevel ?? 1)));
    // Real marks when given; otherwise the 1–5 importance scale stands in (×5 ≈ marks).
    const marks = Number(c.marks) > 0 ? Number(c.marks) : Number(c.weight || 3) * 5;
    const freq = PAST_PAPER_FREQUENCY[c.pastPaper]?.factor || 1;
    const learn = knowledgeLevel >= 3 ? 0 : learnMinutes({ ...c, knowledgeLevel });
    const practice = knowledgeLevel >= 3 ? 30 : Math.max(20, round5(learn * 0.45));
    const total = learn + practice;
    const gainable = marks * freq * (1 - ALREADY_SECURED[knowledgeLevel]);
    return { ...c, idx, name: c.name.trim(), knowledgeLevel, marks, learn, practice, total, gainable, ratio: gainable / Math.max(total, 1) };
  });

  const totalStudy = chaptersInfo.reduce((a, c) => a + c.total, 0);
  const rawBudget = capacityMinutes * 0.9; // keep 10% slack for real life
  // Reserve a mock test / final review only when there's room for them to matter.
  const mockMinutes = includeMock && valid.length > 0 && rawBudget >= 240 ? (valid.length >= 4 ? 90 : 60) : 0;
  const finalReview = valid.length > 0 && rawBudget >= 120 ? (rawBudget >= 300 ? 45 : 30) : 0;
  const studyBudget = Number.isFinite(rawBudget) ? Math.max(0, rawBudget - mockMinutes - finalReview) : totalStudy;

  const modes = triageChapters(chaptersInfo, studyBudget);
  chaptersInfo.forEach((c, i) => {
    c.mode = modes[i];
    if (c.mode === 'CORE') {
      c.learn = c.learn > 0 ? round5(c.learn * MODES.CORE.timeShare) : 0;
      c.practice = Math.max(15, round5(c.practice * MODES.CORE.timeShare));
    }
    c.expected = c.mode === 'SKIP' ? 0 : c.gainable * MODES[c.mode].gainShare;
  });

  // Study order: best marks-per-hour first, so stopping early still banks the most marks.
  const studied = chaptersInfo.filter((c) => c.mode !== 'SKIP').sort((a, b) => b.ratio - a.ratio || a.idx - b.idx);

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
  studied.forEach((c) => {
    const label = c.name;
    const marksNote = `${c.marks} marks${c.pastPaper === 'often' ? ', common in past papers' : ''}`;
    if (c.mode === 'SKIM') {
      lastId = make({
        title: `Skim key points: ${label}`,
        taskType: 'revise',
        estimatedMinutes: 20,
        difficulty: 2,
        knowledgeLevel: c.knowledgeLevel,
        weightage: Math.min(5, Math.max(1, Math.round(c.marks / 5))),
        materials: [`${label} summary / headings`],
        roadblock: 'Trying to learn everything instead of the essentials',
        stuckProtocol: 'Only write the 5 most-examined facts or formulas; move on.',
        meta: { timeNote: `Skim only (${marksNote}) — key facts for the easy marks.` },
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
        weightage: Math.min(5, Math.max(1, Math.round(c.marks / 5))),
        volumeType: Number(c.pages) > 0 ? 'pages' : undefined,
        volumeCount: Number(c.pages) > 0 ? Number(c.pages) : undefined,
        materials: [`${label} notes / textbook`],
        roadblock: c.knowledgeLevel === 0 ? 'Getting lost in details of a brand-new topic' : 'Passive rereading',
        stuckProtocol: 'Write the exact confusing point, check one alternative explanation (video/notes), then move on.',
        meta: { timeNote: `${c.mode === 'CORE' ? 'Core only' : 'Full'} (${marksNote}).` },
      });
    }
    lastId = make({
      title: c.mode === 'CORE' ? `Practice key question types: ${label}` : `Practice: ${label}`,
      taskType: 'practice',
      estimatedMinutes: c.practice,
      difficulty: Math.max(3, c.difficulty || 3),
      knowledgeLevel: c.knowledgeLevel,
      weightage: Math.min(5, Math.max(1, Math.round(c.marks / 5))),
      dependsOn: learnTask ? [learnTask.id] : undefined,
      materials: [`${label} problems / past questions`],
      roadblock: 'Peeking at solutions too early',
      stuckProtocol: 'Give each problem 10 minutes max, then study the solution and redo it without looking.',
      meta: { timeNote: `Exam-style questions (${marksNote}).` },
    }).id;
  });

  if (mockMinutes && studied.length) {
    lastId = make({
      title: `Mock test: ${subject || 'full syllabus'} (timed, exam conditions)`,
      taskType: 'practice',
      estimatedMinutes: mockMinutes,
      difficulty: 4,
      weightage: 5,
      dependsOn: lastId ? [lastId] : undefined,
      materials: ['Past paper or self-made question set', 'Timer'],
      roadblock: 'Stopping to look things up mid-test',
      stuckProtocol: 'Mark the question, move on, return at the end — just like the real exam.',
    }).id;
  }
  if (finalReview && studied.length) {
    make({
      title: `Final review: mistakes & weak spots${subject ? ` (${subject})` : ''}`,
      taskType: 'revise',
      estimatedMinutes: finalReview,
      difficulty: 2,
      weightage: 5,
      dependsOn: lastId ? [lastId] : undefined,
      materials: ['Your mistake log', 'Formula / key-points sheet'],
      roadblock: 'Starting new material the night before',
      stuckProtocol: 'Only review what you already studied. Sleep is the final revision.',
    });
  }

  const totalMarks = chaptersInfo.reduce((a, c) => a + c.marks, 0);
  const securedNow = chaptersInfo.reduce((a, c) => a + c.marks * ALREADY_SECURED[c.knowledgeLevel], 0);
  // Expected marks after the plan (capped at each chapter's marks).
  const expectedMarks = chaptersInfo.reduce((a, c) => a + Math.min(c.marks, c.marks * ALREADY_SECURED[c.knowledgeLevel] + c.expected / (PAST_PAPER_FREQUENCY[c.pastPaper]?.factor || 1)), 0);
  const skipped = chaptersInfo.filter((c) => c.mode === 'SKIP').sort((a, b) => b.marks - a.marks);
  const full = chaptersInfo.filter((c) => c.mode === 'FULL');
  const deepStudied = studied.filter((c) => c.mode === 'FULL' || c.mode === 'CORE');
  const highYield = deepStudied.slice(0, 5).map((c) => c.name);
  const alsoStudied = deepStudied.slice(5).map((c) => c.name);

  let permission = '';
  if (skipped.length) {
    const skippedMarks = skipped.reduce((a, c) => a + c.marks, 0);
    permission = `Skip ${skipped.length === 1 ? 'this chapter' : `these ${skipped.length} chapters`} (${skipped.map((c) => c.name).join(', ')}). That's the smart call, not giving up: ${skipped.length === 1 ? 'it is' : 'they are'} worth about ${Math.round(skippedMarks)} marks, and the time ${skipped.length === 1 ? 'it' : 'they'} would take wins you more marks elsewhere.`;
  }

  const totalMinutes = tasks.reduce((a, t) => a + t.estimatedMinutes, 0);
  return {
    tasks,
    summary: {
      daysLeft,
      totalMinutes,
      capacityMinutes: Number.isFinite(capacityMinutes) ? Math.round(capacityMinutes) : null,
      coveragePct: valid.length ? Math.round((full.length / valid.length) * 100) : 0,
      totalMarks: Math.round(totalMarks),
      securedNowMarks: Math.round(securedNow),
      expectedMarks: Math.round(expectedMarks),
      expectedPct: totalMarks ? Math.round((expectedMarks / totalMarks) * 100) : 0,
      highYield,
      alsoStudied,
      skimmed: chaptersInfo.filter((c) => c.mode === 'SKIM').map((c) => c.name),
      core: chaptersInfo.filter((c) => c.mode === 'CORE').map((c) => c.name),
      skipped: skipped.map((c) => ({ name: c.name, marks: Math.round(c.marks) })),
      permission,
      startHere: tasks[0] || null,
      phases: [
        { name: 'Phase 1 · Highest marks-per-hour chapters first', items: tasks.filter((t) => t.taskType === 'learn').map((t) => t.title) },
        { name: 'Phase 2 · Practise right after each chapter', items: tasks.filter((t) => t.taskType === 'practice' && !t.title.startsWith('Mock')).map((t) => t.title) },
        { name: 'Phase 3 · Quick wins, mock test and final review', items: tasks.filter((t) => t.title.startsWith('Mock') || t.title.startsWith('Final') || t.title.startsWith('Skim')).map((t) => t.title) },
      ].filter((p) => p.items.length > 0),
    },
  };
}
