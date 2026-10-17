import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { RoundCounterTimer } from './components/RoundCounterTimer';
import { BacklogCruncher } from './components/BacklogCruncher';
import { ScheduleTimeline } from './components/ScheduleTimeline';
import { TimetableImporter } from './components/TimetableImporter';
import { AIInsightsPanel } from './components/AIInsightsPanel';
import { EnergyHabitSettings } from './components/EnergyHabitSettings';
import { ReviewModal } from './components/ReviewModal';

import { 
  checkBackendStatus, 
  fetchUserHabitsApi, 
  saveUserHabitsApi,
  fetchFixedEventsApi,
  createFixedEventApi,
  deleteFixedEventApi,
  toggleGapStudyApi,
  fetchTasksApi,
  createTaskApi,
  createBatchTasksApi,
  deleteTaskApi,
  fetchReviewsApi,
  submitReviewApi
} from './services/apiClient';

import { generateRealisticSchedule } from './services/schedulerEngine';
import { 
  INITIAL_USER_HABITS, 
  INITIAL_FIXED_SCHEDULE, 
  INITIAL_BACKLOG_GOALS 
} from './constants/initialData';
import confetti from 'canvas-confetti';
import { playCompletionChime } from './utils/audioSynthesizer';

export function App() {
  const [activeTab, setActiveTab] = useState('focus'); // focus, backlog, timeline, timetable, analytics, habits
  const [activeDay, setActiveDay] = useState(1); // 1 = Monday
  const [backendOnline, setBackendOnline] = useState(false);

  // Core Data States (Synced with SQLite)
  const [userHabits, setUserHabits] = useState(INITIAL_USER_HABITS);
  const [fixedSchedule, setFixedSchedule] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [learnedFatigueHours, setLearnedFatigueHours] = useState([]);
  const [learnedBufferInflation, setLearnedBufferInflation] = useState(1.0);
  const [streakCount, setStreakCount] = useState(0);

  // Review Modal State
  const [activeReviewBlock, setActiveReviewBlock] = useState(null);

  // 1. Initial Load: Fetch everything from SQLite backend
  useEffect(() => {
    async function loadDataFromDb() {
      try {
        const status = await checkBackendStatus();
        if (status.status === 'online') {
          setBackendOnline(true);

          const [habitsData, fixedEvents, dbTasks, reviewsData] = await Promise.all([
            fetchUserHabitsApi().catch(() => null),
            fetchFixedEventsApi().catch(() => null),
            fetchTasksApi().catch(() => null),
            fetchReviewsApi().catch(() => null),
          ]);

          if (habitsData) {
            setUserHabits(habitsData);
            if (habitsData.learnedFatigueHours) {
              setLearnedFatigueHours(habitsData.learnedFatigueHours);
            }
          }
          if (fixedEvents && fixedEvents.length > 0) {
            setFixedSchedule(fixedEvents);
          }
          if (dbTasks && dbTasks.length > 0) {
            setTasks(dbTasks);
          }
          if (reviewsData) {
            setReviewHistory(reviewsData.reviews || []);
            if (reviewsData.learnedBufferInflation) {
              setLearnedBufferInflation(reviewsData.learnedBufferInflation);
            }
          }
        }
      } catch (err) {
        console.warn('Backend connection error:', err);
      }
    }
    loadDataFromDb();
  }, []);

  // 2. Generate Master Schedule
  const scheduleResult = useMemo(() => {
    return generateRealisticSchedule({
      backlogTasks: tasks,
      userHabits,
      fixedSchedule,
      learnedFatigueHours,
      learnedBufferInflation,
      activeDay,
    });
  }, [tasks, userHabits, fixedSchedule, learnedFatigueHours, learnedBufferInflation, activeDay]);

  // Current actionable focus task
  const currentActionBlock = useMemo(() => {
    return scheduleResult.scheduledBlocks.find((b) => b.status === 'SCHEDULED') || null;
  }, [scheduleResult.scheduledBlocks]);

  // Task Mutations
  const handleAddTask = async (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    if (backendOnline) {
      await createTaskApi(newTask).catch(console.error);
    }
  };

  const handleDeleteTask = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && !id.startsWith(t.id)));
    if (backendOnline) {
      await deleteTaskApi(id).catch(console.error);
    }
  };

  const handleBatchAI = async (promptText) => {
    try {
      if (backendOnline) {
        const res = await crunchBacklogWithGeminiApi(promptText);
        if (res?.tasks && res.tasks.length > 0) {
          setTasks((prev) => [...res.tasks, ...prev]);
          return;
        }
      }
    } catch (err) {
      console.warn('Gemini live call error, using local synthesizer:', err);
    }

    // Local deterministic fallback
    const isExam = promptText.toLowerCase().includes('exam') || promptText.toLowerCase().includes('chapter');
    const newTasks = [
      {
        id: `batch-${Date.now()}-1`,
        title: isExam ? 'Core Theoretical Principles & Review' : 'Scaffolding & Core Endpoint Implementation',
        category: 'academic',
        quadrant: 'Q1',
        estimatedMinutes: 45,
        confidence: 2,
        weightage: 5,
        materials: ['Reference Slides / Docs'],
        roadblock: 'Overthinking start point',
        steps: [
          'Step 1: Open primary reference material (5m)',
          'Step 2: Solve 1 core section without interruption (30m)',
          'Step 3: Document summary notes (10m)',
        ],
        stuckProtocol: 'If stuck > 7 minutes, write down the question and proceed.',
      },
      {
        id: `batch-${Date.now()}-2`,
        title: isExam ? 'Targeted Problem Set & Calculations' : 'Integration & Error Handling Test',
        category: 'academic',
        quadrant: 'Q2',
        estimatedMinutes: 40,
        confidence: 3,
        weightage: 4,
        materials: ['Problem set sheet'],
        roadblock: 'Skipping edge cases',
        steps: [
          'Step 1: Setup workspace and formula sheet (5m)',
          'Step 2: Execute problems 1 through 3 (25m)',
          'Step 3: Check against answer key (10m)',
        ],
        stuckProtocol: 'Check formula list on slide 12.',
      },
    ];

    setTasks((prev) => [...newTasks, ...prev]);
    if (backendOnline) {
      await createBatchTasksApi(newTasks).catch(console.error);
    }
  };

  // Fixed Events Mutations
  const handleAddFixedEvent = async (ev) => {
    setFixedSchedule((prev) => [...prev, ev]);
    if (backendOnline) {
      await createFixedEventApi(ev).catch(console.error);
    }
  };

  const handleDeleteFixedEvent = async (id) => {
    setFixedSchedule((prev) => prev.filter((e) => e.id !== id));
    if (backendOnline) {
      await deleteFixedEventApi(id).catch(console.error);
    }
  };

  const handleToggleGapStudy = async (id) => {
    setFixedSchedule((prev) =>
      prev.map((e) => (e.id === id ? { ...e, allowGapStudy: !e.allowGapStudy } : e))
    );
    if (backendOnline) {
      await toggleGapStudyApi(id).catch(console.error);
    }
  };

  const handleBatchAddFixedEvents = async (events) => {
    setFixedSchedule((prev) => [...prev, ...events]);
    if (backendOnline) {
      for (const ev of events) {
        await createFixedEventApi(ev).catch(console.error);
      }
    }
  };

  // Habit mutations
  const handleUpdateHabits = async (newHabits) => {
    setUserHabits(newHabits);
    if (backendOnline) {
      await saveUserHabitsApi(newHabits).catch(console.error);
    }
  };

  // Session Completion & Stalled Handlers
  const handleMarkDone = async (block) => {
    playCompletionChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });

    setStreakCount((s) => s + 1);
    setTasks((prev) => prev.filter((t) => t.id !== block.taskId && !block.taskId.startsWith(t.id)));

    if (backendOnline) {
      await submitReviewApi({
        scheduledBlock: block,
        status: 'COMPLETED',
      }).catch(console.error);
    }

    setReviewHistory((prev) => [
      {
        id: `rev-${Date.now()}`,
        taskTitle: block.taskTitle,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleMarkNotDone = (block) => {
    setActiveReviewBlock(block);
  };

  const handleSubmitReview = async ({ scheduledBlock, status, reasonId, userNote }) => {
    if (backendOnline) {
      const res = await submitReviewApi({
        scheduledBlock,
        status,
        reasonId,
        userNote,
      }).catch(console.error);

      if (res?.reviewId) {
        // Refresh reviews and inflation
        const reviewsData = await fetchReviewsApi().catch(() => null);
        if (reviewsData) {
          setReviewHistory(reviewsData.reviews || []);
          if (reviewsData.learnedBufferInflation) {
            setLearnedBufferInflation(reviewsData.learnedBufferInflation);
          }
          if (reviewsData.learnedFatigueHours) {
            setLearnedFatigueHours(reviewsData.learnedFatigueHours);
          }
        }
      }
    } else {
      setReviewHistory((prev) => [
        {
          id: `rev-${Date.now()}`,
          taskTitle: scheduledBlock.taskTitle,
          status: 'NOT_DONE',
          reasonId,
          userNote,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const handleSwapLighter = () => {
    const lighter = tasks.find((t) => t.quadrant === 'Q3' || t.estimatedMinutes <= 25);
    if (lighter) {
      setTasks((prev) => [lighter, ...prev.filter((t) => t.id !== lighter.id)]);
    }
  };

  return (
    <div className="app-root">
      {/* Top Monochrome Navbar with Live SQLite Connection */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        streakCount={streakCount}
        backendOnline={backendOnline}
        taskCount={tasks.length}
      />

      <main className="main-content">
        {/* VIEW 1: FOCUS & ROUND COUNTER */}
        {activeTab === 'focus' && (
          <div>
            <RoundCounterTimer
              currentBlock={currentActionBlock}
              onMarkDone={handleMarkDone}
              onMarkNotDone={handleMarkNotDone}
              onSwapLighter={handleSwapLighter}
            />

            {/* Structured master schedule underneath */}
            <ScheduleTimeline
              timelineItems={scheduleResult.allTimelineItems}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              onStartFocus={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </div>
        )}

        {/* VIEW 2: BACKLOG CRUNCHER */}
        {activeTab === 'backlog' && (
          <BacklogCruncher
            tasks={tasks}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onGenerateBatchAI={handleBatchAI}
          />
        )}

        {/* VIEW 3: SCHEDULE TIMELINE */}
        {activeTab === 'timeline' && (
          <ScheduleTimeline
            timelineItems={scheduleResult.allTimelineItems}
            activeDay={activeDay}
            setActiveDay={setActiveDay}
            onStartFocus={() => {
              setActiveTab('focus');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW 4: TIMETABLE OCR */}
        {activeTab === 'timetable' && (
          <TimetableImporter
            fixedSchedule={fixedSchedule}
            onAddEvent={handleAddFixedEvent}
            onDeleteEvent={handleDeleteFixedEvent}
            onToggleGap={handleToggleGapStudy}
            onBatchAdd={handleBatchAddFixedEvents}
          />
        )}

        {/* VIEW 5: ADAPTIVE MEMORY & ANALYTICS */}
        {activeTab === 'analytics' && (
          <AIInsightsPanel
            reviewHistory={reviewHistory}
            learnedFatigueHours={learnedFatigueHours}
            learnedBufferInflation={learnedBufferInflation}
            userHabits={userHabits}
          />
        )}

        {/* VIEW 6: HABITS & CIRCADIAN RHYTHMS */}
        {activeTab === 'habits' && (
          <EnergyHabitSettings
            userHabits={userHabits}
            onUpdateHabits={handleUpdateHabits}
          />
        )}
      </main>

      {/* Zero-Guilt Stall Review Modal */}
      {activeReviewBlock && (
        <ReviewModal
          block={activeReviewBlock}
          onClose={() => setActiveReviewBlock(null)}
          onSubmitReview={handleSubmitReview}
        />
      )}
    </div>
  );
}
export default App;
