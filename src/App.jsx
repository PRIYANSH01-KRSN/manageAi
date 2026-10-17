import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { RoundCounterTimer } from './components/RoundCounterTimer';
import { BacklogCruncher } from './components/BacklogCruncher';
import { ScheduleTimeline } from './components/ScheduleTimeline';
import { TimetableImporter } from './components/TimetableImporter';
import { AIInsightsPanel } from './components/AIInsightsPanel';
import { EnergyHabitSettings } from './components/EnergyHabitSettings';
import { ReviewModal } from './components/ReviewModal';
import { OnboardingModal } from './components/OnboardingModal';
import { GuideTourModal } from './components/GuideTourModal';

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
  submitReviewApi,
  crunchBacklogWithGeminiApi,
  fetchAICoachApi
} from './services/apiClient';

import { buildStudyPlan, summarizePlanForAI, toDateKey } from './services/plannerEngine';
import { processSessionReview } from './services/recalibrationService';
import { INITIAL_USER_HABITS } from './constants/initialData';
import confetti from 'canvas-confetti';
import { playCompletionChime } from './utils/audioSynthesizer';

export function App() {
  const [activeTab, setActiveTab] = useState('focus'); // focus, backlog, timeline, timetable, analytics, habits
  const [selectedDayIdx, setSelectedDayIdx] = useState(0); // 0 = today within the plan horizon
  const [backendOnline, setBackendOnline] = useState(false);
  const [targetDeadlineDays, setTargetDeadlineDays] = useState(() => {
    try {
      return parseInt(localStorage.getItem('cf_target_deadline'), 10) || 7;
    } catch {
      return 7;
    }
  });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [preferredSessionId, setPreferredSessionId] = useState(null);
  const [aiCoach, setAiCoach] = useState({ loading: false, headline: '', tips: [], error: '' });

  // Core Data States (Dual Persistence: localStorage + SQLite Sync)
  const [userHabits, setUserHabits] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_user_habits');
      return saved ? JSON.parse(saved) : INITIAL_USER_HABITS;
    } catch {
      return INITIAL_USER_HABITS;
    }
  });

  const [fixedSchedule, setFixedSchedule] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_fixed_schedule');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reviewHistory, setReviewHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_review_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [learnedFatigueHours, setLearnedFatigueHours] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_fatigue_hours');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [learnedBufferInflation, setLearnedBufferInflation] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_buffer_inflation');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [streakCount, setStreakCount] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_streak');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Sessions the student has checked off, keyed as "<sessionId>@<dateKey>"
  const [doneSessionIds, setDoneSessionIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cf_done_sessions') || '[]');
    } catch {
      return [];
    }
  });

  // Review Modal State
  const [activeReviewBlock, setActiveReviewBlock] = useState(null);

  // Sync state changes directly to localStorage immediately so data never resets on refresh
  useEffect(() => {
    try {
      localStorage.setItem('cf_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_fixed_schedule', JSON.stringify(fixedSchedule));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [fixedSchedule]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_user_habits', JSON.stringify(userHabits));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [userHabits]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_review_history', JSON.stringify(reviewHistory));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [reviewHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_fatigue_hours', JSON.stringify(learnedFatigueHours));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [learnedFatigueHours]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_buffer_inflation', learnedBufferInflation.toString());
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [learnedBufferInflation]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_streak', streakCount.toString());
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [streakCount]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_target_deadline', targetDeadlineDays.toString());
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [targetDeadlineDays]);

  useEffect(() => {
    try {
      localStorage.setItem('cf_done_sessions', JSON.stringify(doneSessionIds.slice(-200)));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [doneSessionIds]);

  // Roll the plan forward every minute so missed sessions get re-planned automatically.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // First-time onboarding trigger
  useEffect(() => {
    const done = localStorage.getItem('cf_onboarding_completed');
    if (!done) {
      setIsOnboardingOpen(true);
    }
  }, []);

  // Initial Load & Bidirectional Sync with SQLite backend
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

          if (habitsData && habitsData.habits && habitsData.habits.length > 0) {
            setUserHabits(habitsData);
            if (habitsData.learnedFatigueHours) {
              setLearnedFatigueHours(habitsData.learnedFatigueHours);
            }
          }

          if (fixedEvents && fixedEvents.length > 0) {
            setFixedSchedule(fixedEvents);
          }

          // If SQLite has tasks, use them. If SQLite is empty but local has tasks, sync to SQLite!
          if (dbTasks && dbTasks.length > 0) {
            setTasks(dbTasks);
          } else {
            const localSavedTasks = JSON.parse(localStorage.getItem('cf_tasks') || '[]');
            if (localSavedTasks.length > 0) {
              await createBatchTasksApi(localSavedTasks).catch(console.error);
            }
          }

          if (reviewsData && reviewsData.reviews && reviewsData.reviews.length > 0) {
            setReviewHistory(reviewsData.reviews);
            if (reviewsData.learnedBufferInflation) {
              setLearnedBufferInflation(reviewsData.learnedBufferInflation);
            }
          }
        }
      } catch (err) {
        console.warn('Backend connection notice:', err.message);
      }
    }
    loadDataFromDb();
  }, []);

  // 2. Generate the multi-day, deadline-aware study plan
  const plan = useMemo(() => {
    const raw = buildStudyPlan({
      tasks,
      userHabits,
      fixedSchedule,
      learnedFatigueHours,
      learnedBufferInflation,
      reviewHistory,
      horizonDays: targetDeadlineDays,
      now,
    });
    const done = new Set(doneSessionIds);
    raw.days.forEach((d) =>
      d.sessions.forEach((s) => {
        if (done.has(`${s.id}@${s.dateKey}`)) s.status = 'COMPLETED';
      })
    );
    return raw;
  }, [tasks, userHabits, fixedSchedule, learnedFatigueHours, learnedBufferInflation, reviewHistory, targetDeadlineDays, now, doneSessionIds]);

  // Current actionable focus task: next pending session today (or the one the student picked)
  const currentActionBlock = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todays = (plan.days[0]?.sessions || []).filter((s) => s.status !== 'COMPLETED' && s.endMin > nowMin);
    return todays.find((s) => s.id === preferredSessionId) || todays[0] || null;
  }, [plan, now, preferredSessionId]);

  const handleRequestAICoach = async () => {
    setAiCoach((c) => ({ ...c, loading: true, error: '' }));
    try {
      if (!backendOnline) throw new Error('offline');
      const res = await fetchAICoachApi(summarizePlanForAI(plan, userHabits));
      setAiCoach({ loading: false, headline: res.headline, tips: res.tips || [], error: '' });
    } catch {
      setAiCoach({
        loading: false,
        headline: '',
        tips: [],
        error: 'AI coach unavailable (backend offline or no GEMINI_API_KEY). Planner insights are shown instead.',
      });
    }
  };

  // Task Mutations
  const handleAddTask = async (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    if (backendOnline) {
      await createTaskApi(newTask).catch(console.error);
    }
  };

  const handleDeleteTask = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (backendOnline) {
      await deleteTaskApi(id).catch(console.error);
    }
  };

  const handleBatchAI = async (promptText) => {
    try {
      if (backendOnline) {
        const res = await crunchBacklogWithGeminiApi(promptText, {
          horizonDays: targetDeadlineDays,
          today: toDateKey(new Date()),
          profile: { chronotype: userHabits.chronotype, sessionStyle: userHabits.sessionStyle },
        });
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
        taskType: 'learn',
        difficulty: 4,
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
        taskType: 'practice',
        difficulty: 3,
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
    setPreferredSessionId(null);
    setDoneSessionIds((prev) => [...prev, `${block.id}@${block.dateKey}`]);

    // Work sessions advance the task's progress; the planner re-splits whatever remains.
    if (block.kind !== 'REVIEW') {
      const task = tasks.find((t) => t.id === block.taskId);
      if (task) {
        const completedMinutes = (task.completedMinutes || 0) + (block.rawDuration || 0);
        if (completedMinutes >= (task.estimatedMinutes || 45) - 5) {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
        } else {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completedMinutes } : t)));
        }
      }
    }

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
        hourOfDay: Math.floor((block.startMin % 1440) / 60),
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
      // Offline: apply the same adaptive learning locally.
      const result = processSessionReview({
        scheduledBlock,
        status,
        reasonId,
        userNote,
        reviewHistory,
        learnedFatigueHours,
        learnedBufferInflation,
      });
      setReviewHistory(result.updatedHistory);
      setLearnedFatigueHours(result.updatedFatigueHours);
      setLearnedBufferInflation(result.newBufferInflation);
    }
  };

  // Swap the current session for a lighter one later today; the heavy one stays planned.
  const handleSwapLighter = () => {
    if (!currentActionBlock) return;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const lighter = (plan.days[0]?.sessions || [])
      .filter((s) => s.id !== currentActionBlock.id && s.status !== 'COMPLETED' && s.endMin > nowMin)
      .filter((s) => s.difficulty < currentActionBlock.difficulty || s.rawDuration < currentActionBlock.rawDuration)
      .sort((a, b) => a.difficulty - b.difficulty || a.rawDuration - b.rawDuration)[0];
    if (lighter) setPreferredSessionId(lighter.id);
  };

  const handleSaveRoutine = async (routineData) => {
    const updated = {
      ...userHabits,
      wakeTime: routineData.wakeTime,
      sleepTime: routineData.sleepTime,
      chronotype: routineData.chronotype,
      distractionFactor: routineData.distractionFactor,
      sessionStyle: routineData.sessionStyle,
      habits: routineData.habits,
    };
    setUserHabits(updated);
    localStorage.setItem('cf_onboarding_completed', 'true');
    if (backendOnline) {
      await saveUserHabitsApi(updated).catch(console.error);
    }
  };

  const timelineProps = {
    plan,
    selectedDayIdx,
    setSelectedDayIdx,
    currentSessionId: currentActionBlock?.id,
    aiCoach,
    onRequestAICoach: handleRequestAICoach,
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
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
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
              onNavigateTab={setActiveTab}
              onOpenGuide={() => setIsGuideOpen(true)}
              onOpenRoutineSetup={() => setIsOnboardingOpen(true)}
            />

            {/* Structured master schedule underneath */}
            <ScheduleTimeline
              {...timelineProps}
              onStartFocus={(item) => {
                setPreferredSessionId(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}

        {/* VIEW 2: BACKLOG CRUNCHER & STRATEGIC PLANNER */}
        {activeTab === 'backlog' && (
          <BacklogCruncher
            tasks={tasks}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onGenerateBatchAI={handleBatchAI}
            targetDeadlineDays={targetDeadlineDays}
            onUpdateTargetDeadlineDays={setTargetDeadlineDays}
            feasibility={plan.feasibility}
            unscheduled={plan.unscheduled}
          />
        )}

        {/* VIEW 3: SCHEDULE TIMELINE */}
        {activeTab === 'timeline' && (
          <ScheduleTimeline
            {...timelineProps}
            onStartFocus={(item) => {
              setPreferredSessionId(item.id);
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

      {/* Routine Setup & Daily Analysis Questionnaire */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSaveRoutine={handleSaveRoutine}
      />

      {/* Interactive 5-Step First Time User Guide */}
      <GuideTourModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateTab={setActiveTab}
        onOpenRoutineSetup={() => setIsOnboardingOpen(true)}
      />

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
