// Domain Agnostic Categories & Initial Presets

export const DOMAIN_CATEGORIES = [
  { id: 'all', label: 'All Domains', icon: 'Sparkles' },
  { id: 'academic', label: 'Study & Academics', icon: 'GraduationCap' },
  { id: 'work', label: 'Work & Engineering', icon: 'Briefcase' },
  { id: 'coding', label: 'Software & Projects', icon: 'Code' },
  { id: 'creative', label: 'Creative & Writing', icon: 'PenTool' },
  { id: 'life', label: 'Life & Admin', icon: 'CheckSquare' },
];

export const EISENHOWER_QUADRANTS = {
  Q1: {
    id: 'Q1',
    name: 'Do First',
    subtitle: 'Urgent & Important',
    badge: 'Urgent & Critical',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    description: 'Crises, immediate deadlines, high-stakes tasks. Scheduled in peak energy hours.',
  },
  Q2: {
    id: 'Q2',
    name: 'Schedule / Deep Work',
    subtitle: 'Important, Not Urgent',
    badge: 'Strategic & High Yield',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.3)',
    description: 'Conceptual mastery, strategic building, prevention. Protected deep work blocks.',
  },
  Q3: {
    id: 'Q3',
    name: 'Quick Batch / Delegate',
    subtitle: 'Urgent, Not Important',
    badge: 'Fast Admin & Tasks',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    description: 'Forms, emails, small fixes. Batched into between-class or meeting micro-gaps.',
  },
  Q4: {
    id: 'Q4',
    name: 'Deprioritize / Prune',
    subtitle: 'Not Urgent & Not Important',
    badge: 'Low Yield / Prune',
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.3)',
    description: 'Busywork, excessive formatting. Automatically pruned or deferred.',
  },
};

export const CHRONOTYPES = {
  MORNING_LARK: {
    id: 'MORNING_LARK',
    name: 'Morning Lark 🌅',
    description: 'Peak cognitive focus: 08:00 - 12:30. Slump: 14:00 - 16:00. Evening: Wind down.',
    peakHours: [8, 9, 10, 11, 12],
    mediumHours: [13, 16, 17, 18],
    slumpHours: [14, 15],
    windDownHours: [20, 21, 22],
  },
  BALANCED: {
    id: 'BALANCED',
    name: 'Balanced Rhythm ⚡',
    description: 'Peak cognitive focus: 10:00 - 13:00 and 16:30 - 19:30. Steady mid-day flow.',
    peakHours: [10, 11, 12, 16, 17, 18],
    mediumHours: [9, 13, 14, 19, 20],
    slumpHours: [15],
    windDownHours: [22, 23],
  },
  NIGHT_OWL: {
    id: 'NIGHT_OWL',
    name: 'Night Owl 🦉',
    description: 'Peak cognitive focus: 18:00 - 01:00. Slow morning bootup. High nocturnal creativity.',
    peakHours: [18, 19, 20, 21, 22, 23, 0],
    mediumHours: [14, 15, 16, 17],
    slumpHours: [10, 11],
    windDownHours: [2, 3],
  },
};

export const INCOMPLETION_REASONS = [
  {
    id: 'UNDERESTIMATED_TIME',
    label: 'Underestimated Time Needed',
    badge: 'Time Drift',
    description: 'The task required more research or problem solving than expected.',
    adaptiveAction: 'This task gets +25% more time and future sessions get a +15% buffer.',
  },
  {
    id: 'LOW_ENERGY_FATIGUE',
    label: 'Brain Fog / Low Energy',
    badge: 'Fatigue Zone',
    description: 'Ran out of mental stamina or had post-class/meeting fatigue.',
    adaptiveAction: 'AI will mark this hour as a low-energy zone and prevent heavy tasks.',
  },
  {
    id: 'CONCEPTUAL_BLOCK',
    label: 'Got Stuck on a Specific Problem',
    badge: 'Roadblock',
    description: 'Encountered a concept, bug, or equation that blocked progress.',
    adaptiveAction: 'Adds a 15-minute "unblock" session first, then continues the task.',
  },
  {
    id: 'DIGITAL_DISTRACTION',
    label: 'Distracted by Phone / Socials',
    badge: 'Attention Leak',
    description: 'Lost focus to notifications or impulsive context switching.',
    adaptiveAction: 'This task switches to 15-minute micro-sprints. Try the Noise soundscape.',
  },
  {
    id: 'UNEXPECTED_INTERRUPT',
    label: 'Unexpected Errand / Emergency',
    badge: 'External Event',
    description: 'Real-world interruption outside your control.',
    adaptiveAction: 'Neutral reshuffle: shifts forward without altering cognitive profile.',
  },
];

export const INITIAL_USER_HABITS = {
  chronotype: 'BALANCED',
  wakeTime: '07:30',
  sleepTime: '23:30',
  distractionFactor: 1.25, // 25% realistic human buffer
  habits: [],
};

// Fixed schedule starts clean
export const INITIAL_FIXED_SCHEDULE = [];

// Backlog goals start clean
export const INITIAL_BACKLOG_GOALS = [];

