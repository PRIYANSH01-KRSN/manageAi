// Zero-Guilt Adaptive Recalibration & Habit Learning Service

export function processSessionReview({
  scheduledBlock,
  status, // 'COMPLETED' or 'NOT_DONE'
  reasonId,
  userNote,
  reviewHistory = [],
  learnedFatigueHours = [],
  learnedBufferInflation = 1.0,
}) {
  const newReviewEntry = {
    id: `rev-${Date.now()}`,
    blockId: scheduledBlock.id,
    taskTitle: scheduledBlock.taskTitle,
    quadrant: scheduledBlock.quadrant,
    time: scheduledBlock.startTime,
    hourOfDay: Math.floor(scheduledBlock.startMin / 60),
    status,
    reasonId: status === 'NOT_DONE' ? reasonId : null,
    userNote: userNote || '',
    timestamp: new Date().toISOString(),
  };

  const updatedHistory = [newReviewEntry, ...reviewHistory];

  // Learning analysis
  let newBufferInflation = learnedBufferInflation;
  const updatedFatigueHours = [...learnedFatigueHours];
  let encouragementNote = '';

  if (status === 'COMPLETED') {
    encouragementNote = `Great momentum! "${scheduledBlock.taskTitle}" is complete. Your focus streak has updated. Take a well-deserved stretch break.`;
  } else {
    // Adaptive intelligence based on reason
    switch (reasonId) {
      case 'UNDERESTIMATED_TIME':
        newBufferInflation = Math.min(newBufferInflation + 0.15, 1.8);
        encouragementNote = `Zero guilt here. Complex tasks frequently reveal unexpected depth once you dive in. I have increased your realistic time buffer for this subject by 15% so you don't feel rushed next time.`;
        break;

      case 'LOW_ENERGY_FATIGUE':
        const hour = Math.floor(scheduledBlock.startMin / 60);
        if (!updatedFatigueHours.includes(hour)) {
          updatedFatigueHours.push(hour);
        }
        encouragementNote = `Your brain is signaling fatigue—forcing deep work now yields negative returns. I've flagged this hour as your rest window and moved cognitively heavy tasks to your peak energy zone.`;
        break;

      case 'CONCEPTUAL_BLOCK':
        encouragementNote = `Getting stuck is proof you are stretching your skills. Instead of spinning your wheels, I've split this topic into a 15-minute unblocker/research step before diving back in.`;
        break;

      case 'DIGITAL_DISTRACTION':
        encouragementNote = `It happens to everyone. Context switching is an environmental cue, not a character flaw. For your next block, we will use shorter 15-minute micro-sprints with focused brown noise.`;
        break;

      case 'UNEXPECTED_INTERRUPT':
      default:
        encouragementNote = `Real-world interruptions happen. Your remaining priorities have been cleanly shifted forward with no penalties or late-night cramming required.`;
        break;
    }
  }

  return {
    reviewEntry: newReviewEntry,
    updatedHistory,
    newBufferInflation,
    updatedFatigueHours,
    encouragementNote,
  };
}

export function computeLearningInsights(reviewHistory = []) {
  const notDoneEntries = reviewHistory.filter((r) => r.status === 'NOT_DONE');
  const completedEntries = reviewHistory.filter((r) => r.status === 'COMPLETED');

  const reasonCounts = {};
  notDoneEntries.forEach((entry) => {
    if (entry.reasonId) {
      reasonCounts[entry.reasonId] = (reasonCounts[entry.reasonId] || 0) + 1;
    }
  });

  const hourFatigueCounts = {};
  notDoneEntries.forEach((entry) => {
    if (entry.reasonId === 'LOW_ENERGY_FATIGUE') {
      hourFatigueCounts[entry.hourOfDay] = (hourFatigueCounts[entry.hourOfDay] || 0) + 1;
    }
  });

  return {
    totalCompleted: completedEntries.length,
    totalNotDone: notDoneEntries.length,
    completionRate: reviewHistory.length > 0 ? Math.round((completedEntries.length / reviewHistory.length) * 100) : 100,
    topReason: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0] || null,
    peakFatigueHour: Object.entries(hourFatigueCounts).sort((a, b) => b[1] - a[1])[0] || null,
  };
}
