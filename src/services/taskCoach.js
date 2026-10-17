// Per-Task Coaching: turns what the student told us about a task (type, knowledge
// level, difficulty, roadblock, materials) plus today's context (mood, time of day)
// into concrete "how to do it" guidance: a technique, a 2-minute starter, a timed
// session script, if-then plans, a shrink ladder for "I can't start", and a done-check.

const TECHNIQUES = {
  learn: {
    name: 'Active recall (read → close → recall)',
    how: 'Read one section, close the book, write what you remember, then check. Rereading feels productive but recall is what builds memory.',
    script: [
      { pct: 0.1, text: 'Skim headings & summary. Write 3 questions this session must answer.' },
      { pct: 0.5, text: 'Section by section: read, close the book, jot key points from memory, check gaps.' },
      { pct: 0.25, text: 'Explain the main idea out loud or on paper as if teaching a friend (Feynman).' },
      { pct: 0.15, text: 'Answer your 3 questions without notes. Mark anything shaky for review.' },
    ],
    doneCheck: 'Can you explain the core idea in 2 minutes without notes and answer your 3 questions?',
  },
  practice: {
    name: 'Worked example → solo solve',
    how: 'Study one solved example closely, then solve similar problems without looking. Timebox each problem.',
    script: [
      { pct: 0.12, text: 'Walk through one worked example; note the method in 3 bullet steps.' },
      { pct: 0.68, text: 'Solve problems solo, notes closed. Max ~10 min each — then peek at a hint only.' },
      { pct: 0.2, text: 'Check answers. Log each mistake type (concept, careless, formula) in one line.' },
    ],
    doneCheck: 'Did you finish the problem target and write down your mistake types?',
  },
  revise: {
    name: 'Blurting + gap filling',
    how: 'Write everything you remember on a blank page first, then compare with notes and fill gaps in a different colour.',
    script: [
      { pct: 0.3, text: 'Blurt: blank page, write everything you remember about the topic.' },
      { pct: 0.4, text: 'Compare with notes. Fill gaps in a different colour — those are your weak spots.' },
      { pct: 0.3, text: 'Quick self-quiz on the gaps (flashcards or past questions).' },
    ],
    doneCheck: 'Is your gap list shorter than when you started?',
  },
  assignment: {
    name: 'Outline → ugly draft → polish',
    how: 'Separate thinking from writing from editing. Never edit while drafting.',
    script: [
      { pct: 0.15, text: 'Outline: list the sections and one key point for each.' },
      { pct: 0.6, text: 'Ugly first draft — keep typing, no backspacing, placeholders like [CITE] are fine.' },
      { pct: 0.25, text: 'One polish pass for clarity, then save and note the next section to start with.' },
    ],
    doneCheck: 'Is there a complete (even rough) draft of the section you targeted?',
  },
  project: {
    name: 'Smallest shippable step',
    how: 'Pick the smallest piece that visibly works, build it, test it, write down the next step before stopping.',
    script: [
      { pct: 0.1, text: 'Define the smallest thing that will work by the end of this session.' },
      { pct: 0.7, text: 'Build it. If stuck >7 min, write the exact blocker and try a simpler path.' },
      { pct: 0.2, text: 'Test it, save/commit, and write "next step: …" so tomorrow starts instantly.' },
    ],
    doneCheck: 'Does one small piece visibly work, and is the next step written down?',
  },
  admin: {
    name: 'Batch & ship',
    how: 'Gather everything first, do it in one go, and submit — admin grows when it is left half-done.',
    script: [
      { pct: 0.25, text: 'Gather what you need (forms, links, IDs, files).' },
      { pct: 0.6, text: 'Complete it in one pass without switching tabs.' },
      { pct: 0.15, text: 'Submit/send and note confirmation.' },
    ],
    doneCheck: 'Is it actually submitted or sent?',
  },
};

const STARTERS = {
  learn: (m) => `Open ${m} and write the 3 questions you want answered. That's it — 2 minutes.`,
  practice: (m) => `Open ${m} and copy problem #1 onto paper. Don't solve yet — just write it down.`,
  revise: (m) => `Take a blank page and write the topic title. Now list any 3 things you remember from ${m}.`,
  assignment: (m) => `Open ${m} and type the headings of each section. No sentences yet.`,
  project: (m) => `Open ${m} and write one line: "By the end of this session, ___ will work."`,
  admin: (m) => `Open ${m} and fill in only the first field.`,
};

export function inferTaskType(task = {}) {
  if (task.taskType && TECHNIQUES[task.taskType]) return task.taskType;
  const t = (task.title || '').toLowerCase();
  if (/problem|exercise|question|numerical|past paper|mock/.test(t)) return 'practice';
  if (/revis|review|recap|flashcard/.test(t)) return 'revise';
  if (/essay|report|assignment|write|lab/.test(t)) return 'assignment';
  if (/build|code|api|project|app|implement/.test(t)) return 'project';
  if (/form|email|submit|register|pay|fee/.test(t)) return 'admin';
  return 'learn';
}

function knowledgeTip(level) {
  switch (Number(level)) {
    case 0:
      return 'Brand-new topic: aim to understand the big picture, not every detail. Draw a quick map of how the ideas connect.';
    case 1:
      return 'You\'ve seen this once: start by recalling what you already know before reading — it primes your memory.';
    case 3:
      return 'You\'re confident here: skip rereading and go straight to hard questions to find hidden gaps.';
    default:
      return null;
  }
}

function timeOfDayTip(startMin) {
  if (startMin === undefined || startMin === null) return null;
  const h = Math.floor((startMin % 1440) / 60);
  if (h >= 20 || h < 5) return 'Evening session: put your phone in another room and dim notifications — evening willpower is lower, so remove temptation instead of resisting it.';
  if (h >= 13 && h < 16) return 'Afternoon dip zone: drink water and work standing for the first 5 minutes to wake up your focus.';
  if (h < 10) return 'Morning session: start before checking messages — your first decision of the day sets the tone.';
  return null;
}

function moodTip(dayContext) {
  if (!dayContext) return null;
  if ((dayContext.mood || 3) <= 2) return 'Low mood today: aim for "done", not "perfect". Finishing even half a session counts and lifts mood more than waiting to feel ready.';
  if ((dayContext.energy || 3) <= 2) return 'Low energy: use the 2-minute starter, then decide whether to continue. Motion usually creates energy.';
  if ((dayContext.stress || 3) >= 4) return 'High stress: before starting, write down everything worrying you on paper (1 minute). It frees working memory for this task.';
  return null;
}

/**
 * Timed session script scaled to the session length.
 */
export function buildSessionScript(task, minutes) {
  const type = inferTaskType(task);
  const total = Math.max(10, Number(minutes) || 25);
  let cursor = 0;
  return TECHNIQUES[type].script.map((step) => {
    const len = Math.max(2, Math.round(total * step.pct));
    const item = { from: cursor, to: Math.min(total, cursor + len), text: step.text };
    cursor += len;
    return item;
  });
}

/**
 * Ladder of ever-smaller first steps for "I can't start". Each rung is a real commitment
 * that still moves the task forward.
 */
export function buildShrinkLadder(task, minutes) {
  const type = inferTaskType(task);
  const material = task.materials?.[0] || 'your notes';
  return [
    { minutes: Math.max(10, Number(minutes) || 25), text: 'Full session as planned.' },
    { minutes: 10, text: `Just the first step (10 min): ${TECHNIQUES[type].script[0].text}` },
    { minutes: 5, text: `5 minutes: open ${material} and do whatever is easiest on this task.` },
    { minutes: 2, text: STARTERS[type](material) },
  ];
}

export function buildTaskCoaching(task = {}, { startMin, minutes, dayContext } = {}) {
  const type = inferTaskType(task);
  const technique = TECHNIQUES[type];
  const material = task.materials?.[0] || 'your notes';

  const ifThen = [];
  if (task.roadblock) {
    ifThen.push(`If "${task.roadblock}" happens → ${task.stuckProtocol || 'write the exact question down, skip to the next part, and come back with fresh eyes in the review.'}`);
  }
  ifThen.push('If you get distracted → note the distraction in the parking lot, and restart with the current step. No guilt.');
  if (Number(task.difficulty) >= 4) {
    ifThen.push('If it feels too hard → switch to a worked example or a simpler explanation video for 5 minutes, then retry.');
  }

  const tips = [knowledgeTip(task.knowledgeLevel), timeOfDayTip(startMin), moodTip(dayContext)].filter(Boolean);

  return {
    type,
    technique: { name: technique.name, how: technique.how },
    starter: STARTERS[type](material),
    script: buildSessionScript(task, minutes),
    ifThen,
    tips,
    doneCheck: technique.doneCheck,
    shrinkLadder: buildShrinkLadder(task, minutes),
  };
}
