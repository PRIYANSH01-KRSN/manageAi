import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { DailyCheckInModal } from './components/DailyCheckInModal';
import { BattlePlanWizard } from './components/BattlePlanWizard';
import { EndOfDayModal } from './components/EndOfDayModal';
import { AuthModal } from './components/AuthModal';
import { supabase, authEnabled } from './services/supabaseClient';

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
  fetchAICoachApi,
  fetchAITaskCoachApi,
  fetchCheckinsApi,
  saveCheckinApi,
  fetchSessionLogsApi,
  createBatchFixedEventsApi,
  fetchStuckApi,
  addStuckApi,
  resolveStuckApi,
} from './services/apiClient';

import { buildStudyPlan, summarizePlanForAI, toDateKey, focusCapacityUntil, formatMinutesToTime } from './services/plannerEngine';
import { makeEnergyLogEntry } from './services/energyMatcher';
import { buildTaskCoaching } from './services/taskCoach';
import { FocusMyEnergy } from './components/FocusMyEnergy';
import { computeCalibration, calibrationRatioFor } from './services/estimationEngine';
import { BreakdownWizard } from './components/BreakdownWizard';
import { TodayScreen } from './components/TodayScreen';
import { proposeOverloadTriage, applyOverloadTriage, daysAway } from './services/overloadTriage';
import { processSessionReview } from './services/recalibrationService';
import { INITIAL_USER_HABITS } from './constants/initialData';
import { advanceStreak, currentStreakCount, downloadIcs, needsSupportNudge } from './utils/planUtils';
import confetti from 'canvas-confetti';
import { playCompletionChime } from './utils/audioSynthesizer';

// localStorage-backed state with safe parsing (data survives refresh / redeploys).
function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [key, value]);
  return [value, setValue];
}

export function App() {
  const [activeTab, setActiveTab] = useState('today'); // today, timeline, backlog, focus, energy, timetable, analytics, habits
  // Missed days since the last visit (computed once on load), for the guilt-free welcome back.
  const [awayDays, setAwayDays] = useState(() => {
    try {
      return daysAway(JSON.parse(localStorage.getItem('cf_last_active') || 'null'), toDateKey(new Date()));
    } catch {
      return 0;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [serverMode, setServerMode] = useState(null); // null (offline) | 'sqlite' | 'supabase'
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(!authEnabled);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // Server sync is on for local SQLite, or for Supabase once the student is signed in.
  const backendOnline = serverMode === 'sqlite' || (serverMode === 'supabase' && Boolean(authUser));
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isBattlePlanOpen, setIsBattlePlanOpen] = useState(false);
  const [isEndOfDayOpen, setIsEndOfDayOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [preferredSessionId, setPreferredSessionId] = useState(null);
  const [adHocBlock, setAdHocBlock] = useState(null); // one-off session picked by Focus My Energy
  const [aiCoach, setAiCoach] = useState({ loading: false, headline: '', tips: [], error: '' });
  const [aiTaskCoaching, setAiTaskCoaching] = useState({});
  const [review, setReview] = useState(null); // { block, mode, actualMinutes }
  const [breakdownTask, setBreakdownTask] = useState(undefined); // undefined = closed, null = new, task = break down that task
  const [aiEnabled, setAiEnabled] = useState(false);

  // Core data (dual persistence: localStorage + SQLite sync)
  const [targetDeadlineDays, setTargetDeadlineDays] = usePersistentState('cf_target_deadline', 7);
  const [userHabits, setUserHabits] = usePersistentState('cf_user_habits', INITIAL_USER_HABITS);
  const [fixedSchedule, setFixedSchedule] = usePersistentState('cf_fixed_schedule', []);
  const [tasks, setTasks] = usePersistentState('cf_tasks', []);
  const [reviewHistory, setReviewHistory] = usePersistentState('cf_review_history', []);
  const [learnedFatigueHours, setLearnedFatigueHours] = usePersistentState('cf_fatigue_hours', []);
  const [learnedBufferInflation, setLearnedBufferInflation] = usePersistentState('cf_buffer_inflation', 1.0);
  const [streak, setStreak] = usePersistentState('cf_streak_v2', null);
  const [doneSessionIds, setDoneSessionIds] = usePersistentState('cf_done_sessions', []);
  const [dayContexts, setDayContexts] = usePersistentState('cf_checkins', {});
  const [sessionLogs, setSessionLogs] = usePersistentState('cf_session_logs', []);
  const [parkingLot, setParkingLot] = usePersistentState('cf_parking_lot', []);
  const [stuckItems, setStuckItems] = usePersistentState('cf_stuck_items', []);
  const [checkInSkipped, setCheckInSkipped] = usePersistentState('cf_checkin_skipped', null);

  const todayKey = toDateKey(now);
  const todayContext = dayContexts[todayKey] || null;
  const calibration = useMemo(() => computeCalibration(sessionLogs), [sessionLogs]);

  // Remember today's visit (for the welcome-back message next time).
  useEffect(() => {
    try {
      localStorage.setItem('cf_last_active', JSON.stringify(todayKey));
    } catch {
      // ignore
    }
  }, [todayKey]);

  // Light / dark theme on <html data-theme>, remembered per device.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('cf_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Roll the plan forward every minute so missed sessions get re-planned automatically.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // First-time onboarding, then a daily check-in each morning.
  useEffect(() => {
    if (!localStorage.getItem('cf_onboarding_completed')) {
      setIsOnboardingOpen(true);
    } else if (!dayContexts[todayKey] && checkInSkipped !== todayKey) {
      setIsCheckInOpen(true);
    }
    // Only evaluated when the date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  // Track the signed-in student (Supabase auth).
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user || null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
      if (session?.user) setIsAuthOpen(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Which backend (if any) is reachable?
  useEffect(() => {
    checkBackendStatus().then((status) => {
      setServerMode(status.status === 'online' ? status.mode || 'sqlite' : null);
      setAiEnabled(Boolean(status.aiEnabled));
    });
  }, []);

  // Wipe this browser's copy of the plan (used on sign-out and when another account signs in).
  const resetLocalData = () => {
    setTasks([]);
    setFixedSchedule([]);
    setUserHabits(INITIAL_USER_HABITS);
    setReviewHistory([]);
    setLearnedFatigueHours([]);
    setLearnedBufferInflation(1.0);
    setStreak(null);
    setDoneSessionIds([]);
    setDayContexts({});
    setSessionLogs([]);
    setParkingLot([]);
    setStuckItems([]);
    setAiTaskCoaching({});
    setPreferredSessionId(null);
    setAdHocBlock(null);
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    resetLocalData();
    localStorage.removeItem('cf_owner');
  };

  // Load & sync with the backend whenever sync becomes available (or the account changes).
  useEffect(() => {
    if (!backendOnline || !authReady) return;
    async function loadDataFromDb() {
      try {
        // Accounts: this browser's local data belongs to whoever created it.
        if (serverMode === 'supabase') {
          const owner = localStorage.getItem('cf_owner');
          if (owner && owner !== authUser.id) {
            resetLocalData(); // a different student used this browser before
          } else if (!owner) {
            // First sign-in on this device: upload anything made before signing in, once.
            const read = (k, fb) => {
              try {
                return JSON.parse(localStorage.getItem(k)) ?? fb;
              } catch {
                return fb;
              }
            };
            const localTasks = read('cf_tasks', []);
            const localEvents = read('cf_fixed_schedule', []);
            const localCheckins = read('cf_checkins', {});
            if (localTasks.length) await createBatchTasksApi(localTasks).catch(console.error);
            if (localEvents.length) await createBatchFixedEventsApi(localEvents).catch(console.error);
            if (localStorage.getItem('cf_onboarding_completed')) await saveUserHabitsApi(read('cf_user_habits', INITIAL_USER_HABITS)).catch(console.error);
            for (const [dateKey, c] of Object.entries(localCheckins)) await saveCheckinApi(dateKey, c).catch(console.error);
          }
          localStorage.setItem('cf_owner', authUser.id);
        }

        const [habitsData, fixedEvents, dbTasks, reviewsData, checkins, logsData, stuck] = await Promise.all([
          fetchUserHabitsApi().catch(() => null),
          fetchFixedEventsApi().catch(() => null),
          fetchTasksApi().catch(() => null),
          fetchReviewsApi().catch(() => null),
          fetchCheckinsApi().catch(() => null),
          fetchSessionLogsApi().catch(() => null),
          fetchStuckApi().catch(() => null),
        ]);

        // Signed-in (cloud) accounts: the server is the source of truth, even when empty.
        const cloud = serverMode === 'supabase';

        if (habitsData && (cloud || (habitsData.habits && habitsData.habits.length > 0))) {
          setUserHabits((local) => ({ ...local, ...habitsData }));
          if (habitsData.learnedFatigueHours) setLearnedFatigueHours(habitsData.learnedFatigueHours);
          if (cloud && habitsData.habits?.length) localStorage.setItem('cf_onboarding_completed', 'true');
        }
        if (fixedEvents && (cloud || fixedEvents.length > 0)) setFixedSchedule(fixedEvents);

        if (dbTasks && (cloud || dbTasks.length > 0)) {
          setTasks(dbTasks);
        } else if (!cloud) {
          const localSavedTasks = JSON.parse(localStorage.getItem('cf_tasks') || '[]');
          if (localSavedTasks.length > 0) await createBatchTasksApi(localSavedTasks).catch(console.error);
        }

        if (reviewsData && (cloud || (reviewsData.reviews && reviewsData.reviews.length > 0))) {
          setReviewHistory(reviewsData.reviews || []);
          if (reviewsData.learnedBufferInflation) setLearnedBufferInflation(reviewsData.learnedBufferInflation);
        }
        if (checkins && (cloud || Object.keys(checkins).length > 0)) {
          setDayContexts((local) => (cloud ? checkins : { ...checkins, ...local }));
        }
        if (Array.isArray(stuck) && (cloud || stuck.length > 0)) setStuckItems(stuck);
        if (logsData?.logs?.length) {
          setSessionLogs((local) =>
            local.length > 0
              ? local
              : logsData.logs.map((l) => ({ ...l, dateKey: l.timestamp ? toDateKey(new Date(`${l.timestamp.replace(' ', 'T')}Z`)) : null }))
          );
        }
      } catch (err) {
        console.warn('Backend connection notice:', err.message);
      }
    }
    loadDataFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendOnline, authReady, authUser?.id]);

  const planParams = useMemo(
    () => ({
      tasks,
      userHabits,
      fixedSchedule,
      learnedFatigueHours,
      learnedBufferInflation,
      reviewHistory,
      dayContexts,
      calibration,
      horizonDays: targetDeadlineDays,
      now,
    }),
    [tasks, userHabits, fixedSchedule, learnedFatigueHours, learnedBufferInflation, reviewHistory, dayContexts, calibration, targetDeadlineDays, now]
  );

  // Multi-day, deadline-aware, check-in-aware study plan
  const plan = useMemo(() => {
    const raw = buildStudyPlan(planParams);
    const done = new Set(doneSessionIds);
    raw.days.forEach((d) =>
      d.sessions.forEach((s) => {
        if (done.has(`${s.id}@${s.dateKey}`)) s.status = 'COMPLETED';
      })
    );
    return raw;
  }, [planParams, doneSessionIds]);

  // Exactly one thing to do now: an energy-matched pick, the session the student chose,
  // or the next pending session today.
  const currentActionBlock = useMemo(() => {
    if (adHocBlock && tasks.some((t) => t.id === adHocBlock.taskId)) return adHocBlock;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todays = (plan.days[0]?.sessions || []).filter((s) => s.status !== 'COMPLETED' && s.endMin > nowMin);
    return todays.find((s) => s.id === preferredSessionId) || todays[0] || null;
  }, [plan, now, preferredSessionId, adHocBlock, tasks]);

  /* ---------------- Focus My Energy ---------------- */

  const handleLogEnergy = (level, after) => {
    const energyLog = [makeEnergyLogEntry(level, after), ...(userHabits.energyLog || [])].slice(0, 60);
    handleUpdateHabits({ ...userHabits, energyLog });
  };

  const handleSaveEnergyProfile = (energyProfile) => handleUpdateHabits({ ...userHabits, energyProfile });

  // Start the energy-matched task right now, sized to the student's current energy.
  // Progress is credited to the task, so the rest of the plan re-adjusts afterwards.
  const handleStartEnergyTask = (task, minutes) => {
    const startMin = now.getHours() * 60 + now.getMinutes();
    setPreferredSessionId(null);
    setAdHocBlock({
      id: `now-${task.id}-${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      subject: task.subject,
      quadrant: task.quadrant,
      taskType: task.taskType,
      kind: 'WORK',
      difficulty: task.difficulty || 3,
      dateKey: todayKey,
      startMin,
      endMin: startMin + minutes,
      startTime: formatMinutesToTime(startMin),
      endTime: formatMinutesToTime(startMin + minutes),
      rawDuration: minutes,
      progressMinutes: minutes,
      bufferMinutes: 0,
      reason: 'Picked by Focus My Energy for how you feel right now',
      coaching: buildTaskCoaching(task, { startMin, minutes, dayContext: todayContext }),
      taskData: task,
    });
    setActiveTab('focus');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Browser reminders 5 minutes before each session
  const notifiedRef = useRef(new Set());
  useEffect(() => {
    if (!userHabits.remindersEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    (plan.days[0]?.sessions || []).forEach((s) => {
      const key = `${s.id}@${s.dateKey}`;
      if (s.status === 'COMPLETED' || notifiedRef.current.has(key)) return;
      if (s.startMin - nowMin <= 5 && s.startMin - nowMin >= 0) {
        notifiedRef.current.add(key);
        try {
          new Notification(`In ${s.startMin - nowMin} min: ${s.taskTitle}`, { body: `First 2 minutes: ${s.coaching?.starter || 'open your materials.'}` });
        } catch {
          // notifications unsupported in this context
        }
      }
    });
  }, [plan, now, userHabits.remindersEnabled]);

  /* ---------------- Check-in & day controls ---------------- */

  const saveTodayContext = async (patch) => {
    const next = { ...(dayContexts[todayKey] || {}), ...patch };
    setDayContexts((prev) => ({ ...prev, [todayKey]: next }));
    if (backendOnline) await saveCheckinApi(todayKey, next).catch(console.error);
  };

  const handleSaveCheckin = (data) => {
    saveTodayContext(data);
    setPreferredSessionId(null);
    setAdHocBlock(null);
  };

  const handleChangePlanVariant = (variant) => saveTodayContext({ planVariant: variant });

  const handleSomethingCameUp = (choice) => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const start = formatMinutesToTime(Math.ceil(nowMin / 5) * 5);
    let end;
    if (choice === 'rest') end = userHabits.sleepTime || '23:30';
    else if (choice === 'afternoon') end = '18:00';
    else end = formatMinutesToTime(Math.ceil(nowMin / 5) * 5 + Number(choice));
    const busyBlocks = [...(todayContext?.busyBlocks || []), { title: 'Something came up', startTime: start, endTime: end }];
    saveTodayContext({ busyBlocks });
    setPreferredSessionId(null);
    setAdHocBlock(null);
  };

  /* ---------------- AI ---------------- */

  const handleRequestAICoach = async () => {
    setAiCoach((c) => ({ ...c, loading: true, error: '' }));
    try {
      if (!backendOnline) throw new Error('offline');
      const res = await fetchAICoachApi(summarizePlanForAI(plan, userHabits, todayContext));
      setAiCoach({ loading: false, headline: res.headline, tips: res.tips || [], error: '' });
    } catch {
      setAiCoach({ loading: false, headline: '', tips: [], error: 'AI coach unavailable (backend offline or no GEMINI_API_KEY). Planner insights are shown instead.' });
    }
  };

  const handleRequestAITaskCoach = async (block) => {
    try {
      if (!backendOnline) throw new Error('offline');
      const res = await fetchAITaskCoachApi(block.taskData, block.rawDuration, todayContext || {});
      setAiTaskCoaching((prev) => ({ ...prev, [block.taskId]: res.coaching }));
    } catch {
      setAiTaskCoaching((prev) => ({ ...prev, [block.taskId]: { error: 'AI guide unavailable right now — the built-in technique guide below still applies.' } }));
    }
  };

  /* ---------------- Tasks ---------------- */

  const handleAddTask = async (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    if (backendOnline) await createTaskApi(newTask).catch(console.error);
  };

  const handleAddTasks = async (newTasks) => {
    setTasks((prev) => [...newTasks, ...prev]);
    if (backendOnline) await createBatchTasksApi(newTasks).catch(console.error);
  };

  const updateTask = (id, patch) => {
    const current = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    return current ? { ...current, ...patch } : null;
  };

  const handleDeleteTask = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (backendOnline) await deleteTaskApi(id).catch(console.error);
  };

  const handleBatchAI = async (promptText) => {
    try {
      if (backendOnline) {
        const res = await crunchBacklogWithGeminiApi(promptText, {
          horizonDays: targetDeadlineDays,
          today: todayKey,
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

    // Offline fallback: open the deterministic battle-plan wizard instead of guessing.
    setIsBattlePlanOpen(true);
  };

  /* ---------------- Fixed events & habits ---------------- */

  const handleAddFixedEvent = async (ev) => {
    setFixedSchedule((prev) => [...prev, ev]);
    if (backendOnline) await createFixedEventApi(ev).catch(console.error);
  };

  const handleDeleteFixedEvent = async (id) => {
    setFixedSchedule((prev) => prev.filter((e) => e.id !== id));
    if (backendOnline) await deleteFixedEventApi(id).catch(console.error);
  };

  const handleToggleGapStudy = async (id) => {
    setFixedSchedule((prev) => prev.map((e) => (e.id === id ? { ...e, allowGapStudy: !e.allowGapStudy } : e)));
    if (backendOnline) await toggleGapStudyApi(id).catch(console.error);
  };

  const handleBatchAddFixedEvents = async (events) => {
    setFixedSchedule((prev) => [...prev, ...events]);
    if (backendOnline) await createBatchFixedEventsApi(events).catch(console.error);
  };

  const handleUpdateHabits = async (newHabits) => {
    setUserHabits(newHabits);
    if (backendOnline) await saveUserHabitsApi(newHabits).catch(console.error);
  };

  /* ---------------- Sessions: done / partial / stalled ---------------- */

  const logSession = (block, status, progressPct, actualMinutes) => {
    setSessionLogs((prev) =>
      [
        {
          dateKey: todayKey,
          timestamp: new Date().toISOString(),
          taskTitle: block.taskTitle,
          subject: block.subject,
          taskType: block.taskType,
          kind: block.kind,
          status,
          progressPct,
          // planned work actually covered vs. real minutes spent → pace calibration
          plannedMinutes: actualMinutes ? Math.round((block.rawDuration * progressPct) / 100) : null,
          actualMinutes: actualMinutes || null,
          hourOfDay: Math.floor((block.startMin % 1440) / 60),
        },
        ...prev,
      ].slice(0, 400)
    );
  };

  const creditProgress = (block, pct) => {
    if (block.kind === 'REVIEW') return;
    const task = tasks.find((t) => t.id === block.taskId);
    if (!task) return;
    const completedMinutes = (task.completedMinutes || 0) + Math.round(((block.progressMinutes ?? block.rawDuration) * pct) / 100);
    if (completedMinutes >= (task.estimatedMinutes || 45) - 5) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      updateTask(task.id, { completedMinutes });
    }
  };

  const handleMarkDone = async (block, { actualMinutes } = {}) => {
    playCompletionChime();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });

    setStreak((s) => advanceStreak(s));
    setPreferredSessionId(null);
    setAdHocBlock(null);
    setDoneSessionIds((prev) => [...prev, `${block.id}@${block.dateKey}`].slice(-300));
    creditProgress(block, 100);
    logSession(block, 'COMPLETED', 100, actualMinutes);

    if (backendOnline) {
      await submitReviewApi({ scheduledBlock: block, status: 'COMPLETED', actualMinutes }).catch(console.error);
    }

    setReviewHistory((prev) => [
      { id: `rev-${Date.now()}`, taskTitle: block.taskTitle, status: 'COMPLETED', hourOfDay: Math.floor((block.startMin % 1440) / 60), timestamp: new Date().toISOString() },
      ...prev,
    ]);
  };

  const handleMarkPartial = (block, { actualMinutes } = {}) => setReview({ block, mode: 'PARTIAL', actualMinutes });
  const handleMarkNotDone = (block, { actualMinutes } = {}) => setReview({ block, mode: 'NOT_DONE', actualMinutes });

  // Make each stall reason actually change the plan, as promised in the UI.
  const applyReasonToTask = (block, reasonId, userNote) => {
    const task = tasks.find((t) => t.id === block.taskId);
    if (!task) return;
    let updated = null;
    if (reasonId === 'UNDERESTIMATED_TIME') {
      updated = updateTask(task.id, { estimatedMinutes: Math.round(((task.estimatedMinutes || 45) * 1.25) / 5) * 5 });
    } else if (reasonId === 'DIGITAL_DISTRACTION') {
      updated = updateTask(task.id, { microSprints: true });
    } else if (reasonId === 'CONCEPTUAL_BLOCK') {
      handleAddTask({
        id: `unblock-${task.id}-${Date.now()}`,
        title: `Unblock: ${task.title}`,
        subject: task.subject,
        category: task.category,
        taskType: 'learn',
        quadrant: 'Q1',
        difficulty: 2,
        estimatedMinutes: 15,
        completedMinutes: 0,
        deadline: task.deadline,
        materials: ['A different explanation (video, classmate, TA, alternative textbook)'],
        roadblock: userNote || 'The specific concept that blocked you',
        stuckProtocol: 'Write the exact question in one sentence. If still stuck after 15 minutes, ask someone and move on.',
      });
    }
    if (updated && backendOnline) createTaskApi(updated).catch(console.error);
  };

  const handleSubmitReview = async ({ scheduledBlock, status, reasonId, userNote, progressPct = 0, actualMinutes }) => {
    if (status === 'PARTIAL') {
      creditProgress(scheduledBlock, progressPct);
      setStreak((s) => advanceStreak(s)); // progress counts
      setDoneSessionIds((prev) => [...prev, `${scheduledBlock.id}@${scheduledBlock.dateKey}`].slice(-300));
    }
    setPreferredSessionId(null);
    setAdHocBlock(null);
    logSession(scheduledBlock, status, progressPct, actualMinutes);
    if (reasonId) applyReasonToTask(scheduledBlock, reasonId, userNote);

    if (backendOnline) {
      const res = await submitReviewApi({ scheduledBlock, status, reasonId, userNote, progressPct, actualMinutes }).catch(console.error);
      if (res?.reviewId) {
        const reviewsData = await fetchReviewsApi().catch(() => null);
        if (reviewsData) {
          setReviewHistory(reviewsData.reviews || []);
          if (reviewsData.learnedBufferInflation) setLearnedBufferInflation(reviewsData.learnedBufferInflation);
          if (reviewsData.learnedFatigueHours) setLearnedFatigueHours(reviewsData.learnedFatigueHours);
        }
      }
    } else if (reasonId) {
      const result = processSessionReview({ scheduledBlock, status: 'NOT_DONE', reasonId, userNote, reviewHistory, learnedFatigueHours, learnedBufferInflation });
      setReviewHistory(result.updatedHistory.map((r, i) => (i === 0 ? { ...r, status } : r)));
      setLearnedFatigueHours(result.updatedFatigueHours);
      setLearnedBufferInflation(result.newBufferInflation);
    } else {
      setReviewHistory((prev) => [
        { id: `rev-${Date.now()}`, taskTitle: scheduledBlock.taskTitle, status, hourOfDay: Math.floor((scheduledBlock.startMin % 1440) / 60), timestamp: new Date().toISOString() },
        ...prev,
      ]);
    }
  };

  // Swap the current session for a lighter one later today; the heavy one stays planned.
  /* ---------------- Break it down & stuck list ---------------- */

  const handleAddBreakdownSteps = async (steps, replaceTaskId) => {
    await handleAddTasks(steps);
    if (replaceTaskId) await handleDeleteTask(replaceTaskId);
    setActiveTab('timeline');
  };

  const handleSaveLearnerSpeed = (subject, speed) =>
    handleUpdateHabits({ ...userHabits, learnerSpeeds: { ...(userHabits.learnerSpeeds || {}), [subject.toLowerCase()]: speed } });

  const paceRatioFor = (subject) => calibrationRatioFor({ subject, taskType: 'learn' }, calibration);

  const handleReportStuck = async (block, { kind, note, action }) => {
    const item = {
      id: `stuck-${Date.now()}`,
      taskId: block.taskId,
      groupId: block.taskData?.groupId || null,
      taskTitle: block.taskTitle,
      kind,
      note,
      resolved: false,
      timestamp: new Date().toISOString(),
    };
    setStuckItems((prev) => [item, ...prev].slice(0, 200));
    if (backendOnline) addStuckApi(item).catch(console.error);
    if (action === 'unblock') applyReasonToTask(block, 'CONCEPTUAL_BLOCK', note);
  };

  const handleResolveStuck = (id) => {
    setStuckItems((prev) => prev.map((it) => (it.id === id ? { ...it, resolved: true } : it)));
    if (backendOnline) resolveStuckApi(id).catch(console.error);
  };

  // Unresolved stuck points that belong to the current session's lecture plan (or task).
  const currentStuck = currentActionBlock
    ? stuckItems.filter((it) => !it.resolved && (it.taskId === currentActionBlock.taskId || (it.groupId && it.groupId === currentActionBlock.taskData?.groupId)))
    : [];

  // Anti-fragile: if the remaining work no longer fits, propose the smallest cuts.
  const triage = useMemo(() => proposeOverloadTriage(tasks, plan), [tasks, plan]);

  const handleApplyTriage = async () => {
    const next = applyOverloadTriage(tasks, triage.changes);
    setTasks(next);
    if (!backendOnline) return;
    for (const c of triage.changes) {
      if (c.action === 'skip') await deleteTaskApi(c.id).catch(console.error);
      else {
        const updated = next.find((t) => t.id === c.id);
        if (updated) await createTaskApi(updated).catch(console.error);
      }
    }
  };

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
    const updated = { ...userHabits, ...routineData };
    setUserHabits(updated);
    localStorage.setItem('cf_onboarding_completed', 'true');
    if (backendOnline) await saveUserHabitsApi(updated).catch(console.error);
    if (!dayContexts[todayKey]) setIsCheckInOpen(true);
  };

  const getCapacityUntil = useCallback((dateKey) => focusCapacityUntil(planParams, dateKey), [planParams]);

  const todayStats = useMemo(() => {
    const today = plan.days[0];
    const logsToday = sessionLogs.filter((l) => l.dateKey === todayKey && l.status !== 'NOT_DONE');
    const done = today ? today.sessions.filter((s) => s.status === 'COMPLETED').length : 0;
    return {
      doneCount: Math.max(done, logsToday.length),
      plannedCount: Math.max(done, logsToday.length) + (today ? today.sessions.filter((s) => s.status !== 'COMPLETED').length : 0),
      doneMinutes: logsToday.reduce((a, l) => a + (l.actualMinutes || 0), 0),
    };
  }, [plan, sessionLogs, todayKey]);

  const timelineProps = {
    plan,
    selectedDayIdx,
    setSelectedDayIdx,
    currentSessionId: currentActionBlock?.id,
    aiCoach,
    onRequestAICoach: handleRequestAICoach,
    onChangePlanVariant: handleChangePlanVariant,
    onSomethingCameUp: handleSomethingCameUp,
    onExportCalendar: () => downloadIcs(plan),
    onWrapUpDay: () => setIsEndOfDayOpen(true),
  };

  return (
    <div className="app-root">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        streakCount={currentStreakCount(streak, now)}
        backendOnline={backendOnline}
        taskCount={tasks.length}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        storageLabel={
          serverMode === 'supabase'
            ? authUser
              ? 'Synced to your account'
              : 'Saved on this device · sign in to sync'
            : serverMode === 'sqlite'
              ? 'Local database'
              : 'Saved on this device'
        }
        authEnabled={authEnabled && serverMode === 'supabase'}
        userEmail={authUser?.email}
        onSignIn={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      />

      <main className="main-content">
        {activeTab === 'today' && (
          <TodayScreen
            plan={plan}
            tasks={tasks}
            currentBlock={currentActionBlock}
            todayKey={todayKey}
            daysAwayCount={awayDays}
            triage={triage}
            onStart={(block) => {
              if (!block.id.startsWith('now-')) setPreferredSessionId(block.id);
              setActiveTab('focus');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDone={(block) => handleMarkDone(block)}
            onEasier={handleSwapLighter}
            onCantToday={() => handleSomethingCameUp('rest')}
            onApplyTriage={handleApplyTriage}
            onDismissWelcome={() => setAwayDays(0)}
            onSeeFullPlan={() => setActiveTab('timeline')}
            onBattlePlan={() => setIsBattlePlanOpen(true)}
            onBreakDown={() => setBreakdownTask(null)}
          />
        )}

        {activeTab === 'focus' && (
          <div>
            <RoundCounterTimer
              currentBlock={currentActionBlock}
              mission={plan.mission}
              onMarkDone={handleMarkDone}
              onMarkPartial={handleMarkPartial}
              onMarkNotDone={handleMarkNotDone}
              onSwapLighter={handleSwapLighter}
              onOpenEnergy={() => setActiveTab('energy')}
              stuckItems={currentStuck}
              onReportStuck={handleReportStuck}
              onResolveStuck={handleResolveStuck}
              onNavigateTab={setActiveTab}
              onOpenGuide={() => setIsGuideOpen(true)}
              onOpenRoutineSetup={() => setIsOnboardingOpen(true)}
              onOpenCheckIn={() => setIsCheckInOpen(true)}
              onRequestAITaskCoach={handleRequestAITaskCoach}
              aiCoaching={aiTaskCoaching}
              parkingLot={parkingLot}
              onUpdateParkingLot={setParkingLot}
            />

            <ScheduleTimeline
              {...timelineProps}
              onStartFocus={(item) => {
                setPreferredSessionId(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}

        {activeTab === 'backlog' && (
          <BacklogCruncher
            tasks={tasks}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onGenerateBatchAI={handleBatchAI}
            onOpenBattlePlan={() => setIsBattlePlanOpen(true)}
            onBreakDown={(task) => setBreakdownTask(task || null)}
            targetDeadlineDays={targetDeadlineDays}
            onUpdateTargetDeadlineDays={setTargetDeadlineDays}
            feasibility={plan.feasibility}
            unscheduled={plan.unscheduled}
            calibration={calibration}
          />
        )}

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

        {activeTab === 'timetable' && (
          <TimetableImporter
            fixedSchedule={fixedSchedule}
            onAddEvent={handleAddFixedEvent}
            onDeleteEvent={handleDeleteFixedEvent}
            onToggleGap={handleToggleGapStudy}
            onBatchAdd={handleBatchAddFixedEvents}
          />
        )}

        {activeTab === 'analytics' && (
          <AIInsightsPanel
            reviewHistory={reviewHistory}
            learnedFatigueHours={learnedFatigueHours}
            learnedBufferInflation={learnedBufferInflation}
            userHabits={userHabits}
            sessionLogs={sessionLogs}
            calibration={calibration}
          />
        )}

        {activeTab === 'energy' && (
          <FocusMyEnergy
            tasks={tasks}
            userHabits={userHabits}
            todayContext={todayContext}
            learnedFatigueHours={learnedFatigueHours}
            now={now}
            onLogEnergy={handleLogEnergy}
            onSaveProfile={handleSaveEnergyProfile}
            onStartTask={handleStartEnergyTask}
          />
        )}

        {activeTab === 'habits' && <EnergyHabitSettings userHabits={userHabits} onUpdateHabits={handleUpdateHabits} />}
      </main>

      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} onSaveRoutine={handleSaveRoutine} />

      <GuideTourModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateTab={setActiveTab}
        onOpenRoutineSetup={() => setIsOnboardingOpen(true)}
      />

      {isCheckInOpen && (
        <DailyCheckInModal
          isOpen
          initial={todayContext}
          showSupportNudge={needsSupportNudge(dayContexts)}
          onClose={() => {
            setIsCheckInOpen(false);
            if (!dayContexts[todayKey]) setCheckInSkipped(todayKey);
          }}
          onSave={handleSaveCheckin}
        />
      )}

      {breakdownTask !== undefined && (
        <BreakdownWizard
          isOpen
          initialTask={breakdownTask}
          sessionStyle={userHabits.sessionStyle}
          learnerSpeeds={userHabits.learnerSpeeds || {}}
          paceRatioFor={paceRatioFor}
          aiAvailable={backendOnline && aiEnabled}
          onClose={() => setBreakdownTask(undefined)}
          onAddSteps={handleAddBreakdownSteps}
          onSaveLearnerSpeed={handleSaveLearnerSpeed}
        />
      )}

      <BattlePlanWizard isOpen={isBattlePlanOpen} onClose={() => setIsBattlePlanOpen(false)} onAddTasks={handleAddTasks} getCapacityUntil={getCapacityUntil} />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <EndOfDayModal isOpen={isEndOfDayOpen} onClose={() => setIsEndOfDayOpen(false)} todayStats={todayStats} tomorrow={plan.days[1]} parkingLot={parkingLot} />

      {review && (
        <ReviewModal
          block={review.block}
          mode={review.mode}
          actualMinutes={review.actualMinutes}
          onClose={() => setReview(null)}
          onSubmitReview={handleSubmitReview}
        />
      )}
    </div>
  );
}
export default App;
