// Anti-Procrastination Task Blueprint & Execution Guide Generator

export function generateExecutionBlueprint(task) {
  if (task.steps && task.steps.length > 0 && task.materials && task.materials.length > 0) {
    return {
      definitionOfDone: task.roadblock
        ? `Finish the core deliverable without stopping at: "${task.roadblock}"`
        : `Complete target: ${task.title}`,
      materials: task.materials,
      roadblock: task.roadblock || 'Procrastination drift or perfectionist formatting.',
      steps: task.steps,
      stuckProtocol: task.stuckProtocol || 'If stuck for > 7 minutes, write down the specific barrier, skip to the next section, and ask for help.',
    };
  }

  // Domain-specific smart synthesizer fallback
  const isCode = task.category === 'coding' || task.title.toLowerCase().includes('code') || task.title.toLowerCase().includes('api');
  const isStudy = task.category === 'academic' || task.title.toLowerCase().includes('chapter') || task.title.toLowerCase().includes('exam');
  const isWriting = task.category === 'creative' || task.title.toLowerCase().includes('write') || task.title.toLowerCase().includes('design');

  if (isCode) {
    return {
      definitionOfDone: `Working code implementation of "${task.title}" committed to git or verified in terminal.`,
      materials: ['IDE / Code Editor', 'API documentation / Official docs', 'Terminal with dev server'],
      roadblock: 'Getting lost in deep rabbit holes or syntax errors without logging.',
      steps: [
        'Step 1 (0-5 min): Review the exact interface inputs and expected outputs on scratchpad.',
        'Step 2 (5-25 min): Write the minimal working code path; do not over-optimize yet.',
        'Step 3 (25-35 min): Test the positive case and 1 edge case. Commit with clean message.',
      ],
      stuckProtocol: 'If stuck on an error for > 5 minutes, log console output and check StackOverflow/Docs; do not browse unrelated tabs.',
    };
  }

  if (isStudy) {
    return {
      definitionOfDone: `Understand the 3 core principles of "${task.title}" and solve 2 practice problems.`,
      materials: ['Primary Textbook / Lecture Slides', 'Blank Scratch Notebook', 'Pen and Formula Sheet'],
      roadblock: 'Passive reading: Highlighting text without actively testing memory.',
      steps: [
        'Step 1 (0-7 min): Skim headings and write down 3 key questions you need to answer.',
        'Step 2 (7-25 min): Read actively with closed-book recall. Write formulas or diagrams from memory.',
        'Step 3 (25-35 min): Attempt 1 past-year or textbook problem without checking solutions.',
      ],
      stuckProtocol: 'If you fail to recall a formula, write it 3 times on the margin, highlight the keyword, and proceed.',
    };
  }

  if (isWriting) {
    return {
      definitionOfDone: `First ugly draft completed for "${task.title}" (minimum 300 words or 1 clean mockup).`,
      materials: ['Notes document or Figma board', 'Outline bullet points'],
      roadblock: 'Editing while writing: stopping to fix grammar or layout instead of finishing the flow.',
      steps: [
        'Step 1 (0-5 min): Jot down 5 messy bullet points covering the entire narrative.',
        'Step 2 (5-25 min): Fast drafting: type continuously without backspacing typos.',
        'Step 3 (25-30 min): One quick polish pass for clarity and punchy headings.',
      ],
      stuckProtocol: 'Turn off spelling/grammar squiggles if they break your drafting momentum.',
    };
  }

  // Default general task blueprint
  return {
    definitionOfDone: `Clear physical milestone reached for "${task.title}".`,
    materials: ['Relevant app/document open', 'Notepad for distractions'],
    roadblock: 'Overthinking where to begin or opening social media tabs.',
    steps: [
      'Step 1 (0-3 min): Clear your desk, set phone to Do Not Disturb, and open only this document.',
      'Step 2 (3-25 min): Execute the single most urgent sub-action without multitasking.',
      'Step 3 (25-30 min): Log tangible progress and check off the item.',
    ],
    stuckProtocol: 'Write whatever distraction comes to mind onto a paper parking lot to deal with after the timer.',
  };
}
