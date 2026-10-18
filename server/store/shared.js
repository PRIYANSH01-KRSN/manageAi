// Shared row <-> domain mappers used by both storage adapters (SQLite and Supabase).

const parseJsonArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseJsonObject = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v) {
    try {
      return JSON.parse(v) || {};
    } catch {
      return {};
    }
  }
  return {};
};

export const PROFILE_DEFAULTS = {
  chronotype: 'BALANCED',
  wake_time: '07:30',
  sleep_time: '23:30',
  distraction_factor: 1.25,
  learned_buffer_inflation: 1.0,
  session_style: 'pomodoro',
  daily_focus_cap_minutes: 300,
};

export const PREFERENCE_KEYS = ['leisureMinutes', 'leisureTime', 'windDownMinutes', 'weeklyOffDay', 'weekendWakeTime', 'weekendSleepTime', 'flexPercent', 'remindersEnabled', 'energyProfile', 'energyLog', 'learnerSpeeds'];

export function pickPreferences(body = {}) {
  const prefs = {};
  PREFERENCE_KEYS.forEach((k) => {
    if (body[k] !== undefined) prefs[k] = body[k];
  });
  return prefs;
}

export function taskToRow(t, userId) {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    category: t.category,
    subject: t.subject,
    quadrant: t.quadrant,
    estimated_minutes: t.estimatedMinutes,
    completed_minutes: t.completedMinutes,
    confidence: t.confidence,
    weightage: t.weightage,
    difficulty: t.difficulty,
    deadline: t.deadline,
    task_type: t.taskType,
    knowledge_level: t.knowledgeLevel,
    volume_type: t.volumeType,
    volume_count: t.volumeCount,
    depends_on: t.dependsOn,
    group_id: t.groupId,
    micro_sprints: t.microSprints,
    materials: t.materials,
    roadblock: t.roadblock,
    steps: t.steps,
    stuck_protocol: t.stuckProtocol,
    meta: t.meta || {},
    status: 'PENDING',
  };
}

export function rowToTask(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    subject: r.subject,
    quadrant: r.quadrant,
    estimatedMinutes: r.estimated_minutes,
    completedMinutes: r.completed_minutes || 0,
    confidence: r.confidence,
    weightage: r.weightage,
    difficulty: r.difficulty,
    deadline: r.deadline,
    taskType: r.task_type,
    knowledgeLevel: r.knowledge_level,
    volumeType: r.volume_type,
    volumeCount: r.volume_count,
    dependsOn: r.depends_on && r.depends_on.includes(',') ? r.depends_on.split(',') : r.depends_on,
    groupId: r.group_id,
    microSprints: Boolean(r.micro_sprints),
    materials: parseJsonArray(r.materials),
    roadblock: r.roadblock,
    steps: parseJsonArray(r.steps),
    stuckProtocol: r.stuck_protocol,
    meta: parseJsonObject(r.meta),
    status: r.status,
  };
}

export function rowToFixedEvent(ev) {
  return {
    id: ev.id,
    title: ev.title,
    location: ev.location,
    dayOfWeek: ev.day_of_week,
    startTime: ev.start_time,
    endTime: ev.end_time,
    allowGapStudy: Boolean(ev.allow_gap_study),
    source: ev.source,
  };
}

export function fixedEventToRow(ev, userId) {
  return {
    id: ev.id,
    user_id: userId,
    title: ev.title,
    location: ev.location || '',
    day_of_week: ev.dayOfWeek,
    start_time: ev.startTime,
    end_time: ev.endTime,
    allow_gap_study: Boolean(ev.allowGapStudy),
    source: ev.source || 'MANUAL',
  };
}

export function profileToHabits(profile, habits = [], fatigueHours = []) {
  const p = { ...PROFILE_DEFAULTS, ...(profile || {}) };
  return {
    ...parseJsonObject(p.preferences),
    chronotype: p.chronotype,
    wakeTime: p.wake_time,
    sleepTime: p.sleep_time,
    distractionFactor: p.distraction_factor,
    learnedBufferInflation: p.learned_buffer_inflation,
    sessionStyle: p.session_style || 'pomodoro',
    dailyFocusCapMinutes: p.daily_focus_cap_minutes || 300,
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      startTime: h.start_time,
      endTime: h.end_time,
      isStrict: Boolean(h.is_strict),
    })),
    learnedFatigueHours: fatigueHours.map((f) => f.hour),
  };
}

export function rowToReview(r) {
  return {
    id: r.id,
    taskTitle: r.task_title,
    quadrant: r.quadrant,
    status: r.status,
    reasonId: r.reason_id,
    userNote: r.user_note,
    hourOfDay: r.hour_of_day,
    timestamp: r.created_at,
  };
}

export function rowToSessionLog(r) {
  return {
    kind: r.kind,
    subject: r.subject,
    taskType: r.task_type,
    plannedMinutes: r.planned_minutes,
    actualMinutes: r.actual_minutes,
    progressPct: r.progress_pct,
    status: r.status,
    hourOfDay: r.hour_of_day,
    timestamp: r.created_at,
  };
}

export function rowToStuck(r) {
  return {
    id: r.id,
    taskId: r.task_id,
    groupId: r.group_id,
    taskTitle: r.task_title,
    kind: r.kind,
    note: r.note,
    resolved: Boolean(r.resolved),
    timestamp: r.created_at,
  };
}

export { parseJsonObject };
