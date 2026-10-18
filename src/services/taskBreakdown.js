// Task Breakdown: turn "cover 3 lectures" into ordered, personally-timed study steps.
//
// Time is personal. For every subtopic we combine:
//   • content time   — the share of lecture minutes (or pages) it occupies, weighted by
//                      its complexity, adjusted for playback speed and pausing to take notes
//   • understanding  — grows with complexity and with the student's knowledge gap
//                      (from the 2–3 quick self-check questions per subtopic)
//   • practice       — only when the goal needs it (exam > assignment > catch-up)
// …all scaled by how fast this student grasps this subject (self-reported, then refined
// by their measured pace from timed sessions).
//
// Structure is deterministic (fast, offline, testable). AI only suggests subtopic names,
// complexity and check questions; the student confirms everything.

// `pause` = extra time over the raw video/reading for pausing to note things down.
// Calibrated so 3 hours of brand-new lectures ≈ 5h exam-ready, partly known ≈ 4h,
// already known ≈ 3h (the planner adds only a small distraction buffer on top).
export const GOALS = {
  exam: { id: 'exam', label: 'Exam-ready', practice: 1, review: true, pause: 1.05 },
  assignment: { id: 'assignment', label: 'Do an assignment on it', practice: 0.5, review: false, pause: 1.05 },
  catchup: { id: 'catchup', label: 'Just catch up', practice: 0, review: false, pause: 1.0 },
};

export const GRASP_SPEEDS = {
  fast: { id: 'fast', label: 'Quickly', factor: 0.8 },
  average: { id: 'average', label: 'About average', factor: 1.0 },
  slow: { id: 'slow', label: 'It takes me a while', factor: 1.3 },
};

export const CHECK_SCORES = { know: 1, partly: 0.5, no: 0 };

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* ------------------------------------------------------------------ */
/* Offline fallbacks (used when AI is unavailable)                     */
/* ------------------------------------------------------------------ */

const HARD_RE = /\b(tree|graph|recurs|dynamic|dp\b|proof|deriv|integral|thermo|quantum|algorithm|complexity|pointer|heap|hash|balanc|avl|red.?black|trie|network flow|optimi[sz])/i;
const EASY_RE = /\b(intro|overview|basic|definition|history|recap|summary|motivation)/i;

export function guessComplexity(name = '') {
  if (HARD_RE.test(name)) return 4;
  if (EASY_RE.test(name)) return 2;
  return 3;
}

export function genericCheckQuestions(subtopic) {
  return [
    { q: `Can you explain what "${subtopic}" is in 1–2 sentences, without notes?`, hint: 'Say the core idea out loud. If you hesitate or need notes, pick "Partly".' },
    { q: `Could you draw or write a small example of "${subtopic}" from memory?`, hint: 'e.g. a diagram, a short code snippet or a worked example.' },
    { q: `Could you solve a typical exam/assignment question on "${subtopic}" right now?`, hint: 'Think of the last question you saw on it. Could you finish it alone?' },
  ];
}

// Split "Circular LL, DLL; Stack/Queue" style input into clean subtopic names.
export function parseSubtopics(text = '') {
  return String(text)
    .split(/[,;\n/&]|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Grasp & time model                                                  */
/* ------------------------------------------------------------------ */

// Average of the self-check answers (know=1, partly=0.5, no=0). Unanswered → fallback.
export function graspFromChecks(answers = [], fallback = 0.3) {
  const scored = answers.filter((a) => a in CHECK_SCORES).map((a) => CHECK_SCORES[a]);
  if (!scored.length) return fallback;
  return scored.reduce((x, y) => x + y, 0) / scored.length;
}

export function knowledgeLevelFromGrasp(g) {
  if (g >= 0.8) return 3;
  if (g >= 0.5) return 2;
  if (g > 0.15) return 1;
  return 0;
}

/**
 * Personal minutes for one subtopic.
 * @returns {{ content, understand, practice, total, notes }}
 */
export function subtopicMinutes({ contentMinutes, complexity = 3, grasp = 0.3, goal = 'exam', learnerFactor = 1 }) {
  const g = GOALS[goal] || GOALS.exam;
  const c = clamp(Number(complexity) || 3, 1, 5);
  const gap = 1 - clamp(grasp, 0, 1);
  const known = grasp >= 0.8;

  // Everything is proportional to how much of the lecture this subtopic covers, so
  // listing more subtopics refines the split instead of inflating the total.
  // Already know it → skim the content at speed instead of full note-taking.
  const content = contentMinutes * (known ? 0.6 : g.pause) * (1 + 0.25 * (learnerFactor - 1));
  // Understanding: rewinding, re-reading, explaining it to yourself (≈20–35% extra when new).
  const understand = contentMinutes * 0.07 * c * gap * learnerFactor;
  // Practice scales with difficulty and with how shaky the student is.
  const practice = g.practice * contentMinutes * 0.05 * c * (0.3 + 0.7 * gap) * learnerFactor;

  const notes = [];
  if (known) notes.push('you know this — skim only');
  else if (gap >= 0.7) notes.push('new to you — extra time to understand');
  if (c >= 4) notes.push('a harder topic');
  if (learnerFactor > 1) notes.push('paced for steady understanding');
  return { content: Math.round(content), understand: Math.round(understand), practice: Math.round(practice), total: Math.round(content + understand + practice), notes };
}

/* ------------------------------------------------------------------ */
/* Breakdown                                                           */
/* ------------------------------------------------------------------ */

/**
 * @param input {
 *   kind: 'lectures' | 'chapters',
 *   subject, deadline, goal, buildsOnPrevious, hasSlides, speed (lectures), graspSpeed,
 *   paceRatio (learned actual ÷ planned, default 1), sessionStyle ('pomodoro'|'deep'),
 *   units: [{ title, length (minutes or pages), subtopics: [{ name, complexity, answers: [...] }] }]
 * }
 * @returns { steps (planner tasks), summary }
 */
export function buildBreakdown(input, { stamp = Date.now() } = {}) {
  const kind = input.kind === 'chapters' ? 'chapters' : 'lectures';
  const goal = GOALS[input.goal] ? input.goal : 'exam';
  const g = GOALS[goal];
  const speed = kind === 'lectures' ? clamp(Number(input.speed) || 1, 0.75, 2.5) : 1;
  const learnerFactor = clamp((GRASP_SPEEDS[input.graspSpeed]?.factor || 1) * clamp(Number(input.paceRatio) || 1, 0.7, 2), 0.6, 2.4);
  const maxChunk = input.sessionStyle === 'deep' ? 50 : 30;
  const groupId = `bd-${stamp}`;
  const unitWord = kind === 'lectures' ? 'Lecture' : 'Chapter';
  const groupTitle = `${input.subject ? `${input.subject}: ` : ''}${input.units.length} ${kind}`;

  const steps = [];
  let seq = 0;
  const add = (t) => {
    const step = {
      id: `${groupId}-${seq}`,
      category: 'academic',
      subject: input.subject || undefined,
      deadline: input.deadline || undefined,
      quadrant: input.deadline ? 'Q1' : 'Q2',
      groupId,
      completedMinutes: 0,
      confidence: 3,
      weightage: 4,
      ...t,
      meta: { groupTitle, seq: seq + 1, noAutoReview: true, bufferIncluded: true, ...(t.meta || {}) },
    };
    seq += 1;
    steps.push(step);
    return step;
  };

  const unitSummaries = [];
  const unitReports = [];
  let prevUnitEnd = null;

  input.units.forEach((unit, ui) => {
    const label = `${unitWord} ${ui + 1}${unit.title ? `: ${unit.title}` : ''}`;
    const subs = (unit.subtopics?.length ? unit.subtopics : [{ name: unit.title || label }]).map((s) => ({
      ...s,
      complexity: clamp(Number(s.complexity) || guessComplexity(s.name), 1, 5),
      grasp: graspFromChecks(s.answers, input.defaultGrasp ?? 0.3),
    }));

    // Content minutes for the unit, shared out by complexity.
    const length = Number(unit.length) || (kind === 'lectures' ? 60 : 20);
    const unitContent = kind === 'lectures' ? length / speed : length * 4; // ~4 min/page of real reading
    const weightSum = subs.reduce((a, s) => a + s.complexity, 0);

    // The preview (skim + write 3 questions) is folded into the first learning step: it's
    // the first step of that session's script, and keeps each lecture on one day.
    let chainEnd = prevUnitEnd && input.buildsOnPrevious ? prevUnitEnd : null;
    let firstLearn = true;
    let practiceTotal = 0;
    const subReports = [];

    subs.forEach((s) => {
      const share = unitContent * (s.complexity / weightSum);
      const m = subtopicMinutes({ contentMinutes: share, complexity: s.complexity, grasp: s.grasp, goal, learnerFactor });
      practiceTotal += m.practice;
      subReports.push({ name: s.name, complexity: s.complexity, grasp: s.grasp, ...m });

      const learnMinutes = m.content + m.understand + (firstLearn ? 5 : 0);
      const parts = Math.max(1, Math.ceil(learnMinutes / maxChunk));
      const per = round5(learnMinutes / parts);
      const knowledgeLevel = knowledgeLevelFromGrasp(s.grasp);
      for (let p = 1; p <= parts; p++) {
        const step = add({
          title: `${kind === 'lectures' ? 'Watch & learn' : 'Read & learn'}: ${s.name}${parts > 1 ? ` (part ${p}/${parts})` : ''}`,
          taskType: 'learn',
          difficulty: clamp(Math.round(s.complexity * (1 - s.grasp * 0.5)), 1, 5),
          knowledgeLevel,
          estimatedMinutes: per,
          dependsOn: chainEnd ? [chainEnd] : undefined,
          materials: [`${label}${kind === 'lectures' ? ' recording' : ''} — section on ${s.name}`],
          roadblock: s.grasp < 0.4 ? `${s.name} is new — it may not click the first time` : `Re-watching parts you already know`,
          stuckProtocol: `Stuck for 10 minutes on ${s.name}? Note the exact timestamp/question in your stuck list, skip ahead, and keep going — it gets resolved in the review.`,
          meta: {
            kind: 'learn',
            unit: ui + 1,
            subtopic: s.name,
            timeNote: `${firstLearn && p === 1 ? 'Starts with a 5-min preview of the slides · ' : ''}${parts > 1 ? `Whole topic (${parts} parts): ` : ''}${m.content}m ${kind === 'lectures' ? 'watching (with pauses)' : 'reading'} + ${m.understand}m understanding${m.notes.length ? ` — ${m.notes.join(', ')}` : ''}`,
          },
        });
        chainEnd = step.id;
      }
      firstLearn = false;
    });

    // Practice: one step per hard subtopic, or one combined step for the unit.
    if (g.practice > 0 && practiceTotal >= 5) {
      if (practiceTotal <= maxChunk) {
        chainEnd = add({
          title: `Practice: ${label} questions`,
          taskType: 'practice',
          difficulty: 3,
          estimatedMinutes: round5(practiceTotal),
          dependsOn: [chainEnd],
          materials: ['Past questions / end-of-lecture exercises'],
          roadblock: 'Looking at solutions too early',
          stuckProtocol: 'Give each question 10 minutes, then study the solution and redo it without looking.',
          meta: { kind: 'practice', unit: ui + 1, timeNote: `Practice on ${subs.map((s) => s.name).join(', ')}` },
        }).id;
      } else {
        subReports.filter((r) => r.practice >= 5).forEach((r) => {
          chainEnd = add({
            title: `Practice: ${r.name}`,
            taskType: 'practice',
            difficulty: clamp(r.complexity, 2, 5),
            estimatedMinutes: round5(r.practice),
            dependsOn: [chainEnd],
            materials: [`Questions on ${r.name}`],
            roadblock: 'Looking at solutions too early',
            stuckProtocol: 'Give each question 10 minutes, then study the solution and redo it without looking.',
            meta: { kind: 'practice', unit: ui + 1, subtopic: r.name, timeNote: `${r.practice}m — more practice where your check was shaky` },
          }).id;
        });
      }
    }

    const summary = add({
      title: `Summarise ${label} on one page`,
      taskType: 'revise',
      difficulty: 2,
      estimatedMinutes: round5(4 + subs.length),
      dependsOn: [chainEnd],
      materials: ['Your notes', 'Your stuck list'],
      roadblock: 'Copying notes instead of recalling',
      stuckProtocol: 'Write from memory first; only then open your notes to fill gaps.',
      meta: { kind: 'summary', unit: ui + 1, timeNote: 'Answer your 3 preview questions and resolve your stuck points.' },
    });
    unitSummaries.push(summary.id);
    prevUnitEnd = summary.id;

    if (g.review) {
      add({
        title: `Recall review: ${label}`,
        taskType: 'revise',
        difficulty: 2,
        estimatedMinutes: round5(8 + 2 * subs.length),
        dependsOn: [summary.id],
        materials: ['Blank paper', 'Your one-page summary'],
        roadblock: 'Rereading instead of recalling',
        stuckProtocol: 'Blurt everything you remember first, then check the summary.',
        meta: { kind: 'review', unit: ui + 1, minGapDays: 1, timeNote: 'A day later, recall it from memory — this is what makes it stick.' },
      });
    }

    unitReports.push({ label, subtopics: subReports });
  });

  if (input.units.length > 1 && goal !== 'catchup') {
    add({
      title: `Connect all ${input.units.length} ${kind}: one big-picture sheet`,
      taskType: 'revise',
      difficulty: 3,
      estimatedMinutes: round5(10 + 4 * input.units.length),
      dependsOn: unitSummaries,
      materials: ['Your one-page summaries'],
      roadblock: 'Treating topics as unrelated',
      stuckProtocol: 'For each pair of topics write one way they relate or differ.',
      meta: { kind: 'connect', timeNote: 'How the topics relate — the questions exams love.' },
    });
  }

  const totalMinutes = steps.reduce((a, s) => a + s.estimatedMinutes, 0);
  const naiveMinutes = Math.round(
    input.units.reduce((a, u) => a + (Number(u.length) || (kind === 'lectures' ? 60 : 20)) * (kind === 'lectures' ? 1 : 4), 0)
  );

  return {
    steps,
    summary: {
      groupId,
      groupTitle,
      totalMinutes,
      naiveMinutes,
      learnerFactor: Math.round(learnerFactor * 100) / 100,
      units: unitReports,
      startHere: steps[0],
    },
  };
}
