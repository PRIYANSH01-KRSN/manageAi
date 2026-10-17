// Hyper-Realistic Cognitive Scheduling Engine
import { CHRONOTYPES } from '../constants/initialData';

// Helper: parse "HH:mm" to minutes from midnight
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Helper: format minutes from midnight to "HH:mm"
export function formatMinutesToTime(minutes) {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTimeRange(startMin, endMin) {
  return `${formatMinutesToTime(startMin)} - ${formatMinutesToTime(endMin)}`;
}

/**
 * Builds the 24h energy & availability grid for a specific day
 */
export function buildDailyEnergyGrid({
  dayOfWeek = 1,
  userHabits,
  fixedSchedule = [],
  learnedFatigueHours = [],
}) {
  const chronotypeKey = userHabits.chronotype || 'BALANCED';
  const chrono = CHRONOTYPES[chronotypeKey] || CHRONOTYPES.BALANCED;

  const wakeMin = parseTimeToMinutes(userHabits.wakeTime || '07:30');
  const sleepMin = parseTimeToMinutes(userHabits.sleepTime || '23:30');

  // Filter fixed events for this day
  const todayFixedEvents = fixedSchedule
    .filter((ev) => ev.dayOfWeek === dayOfWeek)
    .map((ev) => ({
      ...ev,
      startMin: parseTimeToMinutes(ev.startTime),
      endMin: parseTimeToMinutes(ev.endTime),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Filter daily habits
  const todayHabits = (userHabits.habits || [])
    .map((hb) => ({
      ...hb,
      startMin: parseTimeToMinutes(hb.startTime),
      endMin: parseTimeToMinutes(hb.endTime),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  // Time slots generated from wakeMin to sleepMin in 15-minute chunks
  const availableIntervals = [];
  let cursor = wakeMin;

  // Combine blocked intervals (fixed events and habits)
  const blockedIntervals = [];

  // Add habits
  todayHabits.forEach((hb) => {
    blockedIntervals.push({
      startMin: hb.startMin,
      endMin: hb.endMin,
      type: 'HABIT',
      title: hb.name,
      isStrict: hb.isStrict,
    });
  });

  // Add fixed classes/shifts with 20m post-class decompression buffer
  todayFixedEvents.forEach((ev, idx) => {
    blockedIntervals.push({
      startMin: ev.startMin,
      endMin: ev.endMin,
      type: 'FIXED_CLASS',
      title: ev.title,
      location: ev.location,
      allowGapStudy: ev.allowGapStudy,
    });

    // Injects mandatory 20m decompression immediately after class
    const bufferEnd = Math.min(ev.endMin + 20, sleepMin);
    blockedIntervals.push({
      startMin: ev.endMin,
      endMin: bufferEnd,
      type: 'POST_CLASS_BUFFER',
      title: '🧠 Post-Lecture Cognitive Decompression',
      isDecompression: true,
    });

    // Check gap between this class buffer and next class
    const nextEvent = todayFixedEvents[idx + 1];
    if (nextEvent) {
      const gapStart = bufferEnd;
      const gapEnd = nextEvent.startMin;
      if (gapEnd > gapStart) {
        const gapDuration = gapEnd - gapStart;
        if (ev.allowGapStudy && gapDuration >= 30) {
          // Allow light / optional quick batching in this gap
          availableIntervals.push({
            startMin: gapStart,
            endMin: gapEnd,
            isGap: true,
            energyLevel: 'SHALLOW',
            tag: 'Micro-Gap (Light Work Allowed)',
          });
        } else {
          // Flag as protected recharge gap
          blockedIntervals.push({
            startMin: gapStart,
            endMin: gapEnd,
            type: 'PROTECTED_GAP',
            title: '🌿 Free Gap (Rest & Social)',
          });
        }
      }
    }
  });

  // Sort blocked intervals
  blockedIntervals.sort((a, b) => a.startMin - b.startMin);

  // Merge overlapping blocked intervals to find open work windows
  let currentWindowStart = wakeMin;
  blockedIntervals.forEach((blk) => {
    if (blk.startMin > currentWindowStart) {
      // Free window found
      availableIntervals.push({
        startMin: currentWindowStart,
        endMin: blk.startMin,
        isGap: false,
        energyLevel: getEnergyLevelForInterval(currentWindowStart, blk.startMin, chrono, learnedFatigueHours),
      });
    }
    if (blk.endMin > currentWindowStart) {
      currentWindowStart = Math.max(currentWindowStart, blk.endMin);
    }
  });

  if (currentWindowStart < sleepMin) {
    availableIntervals.push({
      startMin: currentWindowStart,
      endMin: sleepMin,
      isGap: false,
      energyLevel: getEnergyLevelForInterval(currentWindowStart, sleepMin, chrono, learnedFatigueHours),
    });
  }

  return {
    wakeMin,
    sleepMin,
    chrono,
    blockedIntervals,
    availableIntervals: availableIntervals.filter((iv) => iv.endMin - iv.startMin >= 20),
  };
}

function getEnergyLevelForInterval(startMin, endMin, chrono, learnedFatigueHours = []) {
  const midHour = Math.floor(((startMin + endMin) / 2) / 60);

  // If user previously reported fatigue in this hour
  if (learnedFatigueHours.includes(midHour)) {
    return 'LOW_ENERGY';
  }

  if (chrono.peakHours.includes(midHour)) {
    return 'PEAK_FOCUS';
  }
  if (chrono.mediumHours.includes(midHour)) {
    return 'MEDIUM_CONCEPTUAL';
  }
  if (chrono.slumpHours.includes(midHour)) {
    return 'SLUMP_RECHARGE';
  }
  return 'SHALLOW';
}

/**
 * Packs backlog tasks into the energy grid using Eisenhower rules and distraction buffers
 */
export function generateRealisticSchedule({
  backlogTasks = [],
  userHabits,
  fixedSchedule = [],
  learnedFatigueHours = [],
  learnedBufferInflation = 1.0, // Multiplier from past underestimated tasks
  activeDay = 1, // 1 = Monday
}) {
  const grid = buildDailyEnergyGrid({
    dayOfWeek: activeDay,
    userHabits,
    fixedSchedule,
    learnedFatigueHours,
  });

  const baseDistraction = (userHabits.distractionFactor || 1.25) * learnedBufferInflation;

  // Prepare tasks: Atomic slicing (max 45 min core work) + add realistic buffer
  const taskQueue = [];
  backlogTasks.forEach((task) => {
    const rawMinutes = task.estimatedMinutes || 45;
    const bufferedMinutes = Math.round(rawMinutes * baseDistraction);

    // If task is large (> 50m), slice into atomic 40-50 min digestible sessions
    if (rawMinutes > 50) {
      const chunkSize = 45;
      const numParts = Math.ceil(rawMinutes / chunkSize);
      const perPartRaw = Math.round(rawMinutes / numParts);
      const perPartBuffered = Math.round(perPartRaw * baseDistraction);

      for (let p = 1; p <= numParts; p++) {
        taskQueue.push({
          ...task,
          id: `${task.id}-part${p}`,
          title: `${task.title} (Part ${p}/${numParts})`,
          estimatedMinutes: perPartRaw,
          bufferedMinutes: perPartBuffered,
          isPart: p,
          totalParts: numParts,
        });
      }
    } else {
      taskQueue.push({
        ...task,
        bufferedMinutes,
      });
    }
  });

  // Sort queue by Eisenhower Matrix & Weightage:
  // Q1 (Urgent/Important) -> Q2 (Strategic Deep Work) -> Q3 (Quick Gaps) -> Q4
  const quadrantRank = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
  taskQueue.sort((a, b) => {
    const qA = quadrantRank[a.quadrant] || 2;
    const qB = quadrantRank[b.quadrant] || 2;
    if (qA !== qB) return qA - qB;
    // Lower confidence means need more focus early
    return (a.confidence || 3) - (b.confidence || 3);
  });

  // Allocate into available intervals
  const scheduledBlocks = [];
  const unassignedTasks = [];
  const intervals = JSON.parse(JSON.stringify(grid.availableIntervals));

  taskQueue.forEach((task) => {
    let allocated = false;

    // Find best interval matching task's Eisenhower quadrant
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      const availableDuration = interval.endMin - interval.startMin;

      // Q1 & Q2 prefer Peak or Medium intervals, avoiding gaps unless urgent
      if (task.quadrant === 'Q1' || task.quadrant === 'Q2') {
        if (interval.isGap) continue; // Keep gaps for rest or Q3
      }

      if (availableDuration >= task.bufferedMinutes) {
        const slotStart = interval.startMin;
        const slotEnd = slotStart + task.bufferedMinutes;

        scheduledBlocks.push({
          id: `slot-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          category: task.category,
          quadrant: task.quadrant,
          startMin: slotStart,
          endMin: slotEnd,
          startTime: formatMinutesToTime(slotStart),
          endTime: formatMinutesToTime(slotEnd),
          rawDuration: task.estimatedMinutes,
          bufferMinutes: task.bufferedMinutes - task.estimatedMinutes,
          energyLevel: interval.energyLevel,
          status: 'SCHEDULED', // SCHEDULED, IN_PROGRESS, COMPLETED, NOT_DONE
          taskData: task,
        });

        // Add 10-minute micro-break between intense sessions
        const breakEnd = Math.min(slotEnd + 10, interval.endMin);
        if (breakEnd > slotEnd) {
          scheduledBlocks.push({
            id: `break-${slotEnd}`,
            isBreak: true,
            title: '☕ Cognitive Reset & Hydration Break',
            startMin: slotEnd,
            endMin: breakEnd,
            startTime: formatMinutesToTime(slotEnd),
            endTime: formatMinutesToTime(breakEnd),
            energyLevel: 'REST',
          });
        }

        // Adjust interval
        interval.startMin = breakEnd;
        allocated = true;
        break;
      }
    }

    if (!allocated) {
      unassignedTasks.push(task);
    }
  });

  // Merge fixed classes and habits into master schedule view
  const allTimelineItems = [
    ...scheduledBlocks,
    ...grid.blockedIntervals.map((b) => ({
      id: `block-${b.startMin}-${b.title}`,
      title: b.title,
      startMin: b.startMin,
      endMin: b.endMin,
      startTime: formatMinutesToTime(b.startMin),
      endTime: formatMinutesToTime(b.endMin),
      type: b.type,
      location: b.location,
      isFixed: true,
      isDecompression: b.isDecompression,
    })),
  ].sort((a, b) => a.startMin - b.startMin);

  return {
    scheduledBlocks,
    allTimelineItems,
    unassignedTasks,
    grid,
  };
}
