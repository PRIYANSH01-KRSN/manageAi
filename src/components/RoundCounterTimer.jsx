import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Check, X, CheckCircle2, Sliders, Sparkles, Clock, ArrowRight, ChevronDown, Lightbulb, ShieldAlert, ListChecks, Inbox, Plus, Flag, HelpCircle } from 'lucide-react';
import { playAmbientSound, stopAmbientSound, playCompletionChime } from '../utils/audioSynthesizer';
import { StuckModal } from './StuckModal';

const MODE_LABEL = { FULL: null, LIGHT: 'Light day', RECOVERY: 'Recovery day' };

function SectionTitle({ icon: Icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
      <Icon size={12} /> {children}
    </div>
  );
}

const card = { background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' };

export function RoundCounterTimer({
  currentBlock,
  mission,
  onMarkDone,
  onMarkNotDone,
  onMarkPartial,
  onSwapLighter,
  onNavigateTab,
  onOpenGuide,
  onOpenRoutineSetup,
  onOpenCheckIn,
  onRequestAITaskCoach,
  aiCoaching,
  parkingLot = [],
  onUpdateParkingLot,
  onOpenEnergy,
  stuckItems = [],
  onReportStuck,
  onResolveStuck,
}) {
  const [ladderIdx, setLadderIdx] = useState(0);
  const coaching = currentBlock?.coaching;
  const ladder = coaching?.shrinkLadder || [];
  const sessionMinutes = ladderIdx > 0 && ladder[ladderIdx] ? ladder[ladderIdx].minutes : currentBlock?.rawDuration || 25;

  const [secondsLeft, setSecondsLeft] = useState(sessionMinutes * 60);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [soundType, setSoundType] = useState('none');
  const [showDetails, setShowDetails] = useState(true);
  const [parkingText, setParkingText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showStuck, setShowStuck] = useState(false);

  const endTimeRef = useRef(null);
  const startEpochRef = useRef(null);
  const startSecRef = useRef(0);

  // Reset when the session changes.
  useEffect(() => {
    setLadderIdx(0);
    setSecondsLeft((currentBlock?.rawDuration || 25) * 60);
    setElapsedSec(0);
    setIsActive(false);
    endTimeRef.current = null;
    startEpochRef.current = null;
    startSecRef.current = 0;
  }, [currentBlock?.id]);

  // High-precision countdown + elapsed-time tracking backed by real timestamps.
  // When browser tabs are backgrounded, browsers throttle setInterval; timestamp deltas
  // ensure the timer never loses seconds or stops when reading in another tab.
  useEffect(() => {
    if (!isActive) {
      endTimeRef.current = null;
      return undefined;
    }

    if (!endTimeRef.current) {
      endTimeRef.current = Date.now() + secondsLeft * 1000;
      startEpochRef.current = Date.now();
      startSecRef.current = elapsedSec;
    }

    const syncTime = () => {
      if (!endTimeRef.current) return;
      const now = Date.now();
      const diffMs = endTimeRef.current - now;
      const remaining = Math.max(0, Math.ceil(diffMs / 1000));
      setSecondsLeft(remaining);

      if (startEpochRef.current) {
        const elapsed = Math.max(0, Math.round(startSecRef.current + (now - startEpochRef.current) / 1000));
        setElapsedSec(elapsed);
      }

      if (diffMs <= 0) {
        setIsActive(false);
        endTimeRef.current = null;
        stopAmbientSound();
        playCompletionChime();
      }
    };

    // Immediate sync when returning from another tab or window focus
    const handleSync = () => {
      if (endTimeRef.current) syncTime();
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    // 250ms interval for responsive ticking
    const interval = setInterval(syncTime, 250);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [isActive]);

  // Keep browser tab title updated with countdown so student can see progress from another tab
  useEffect(() => {
    if (isActive && currentBlock?.taskTitle) {
      const min = Math.floor(secondsLeft / 60);
      const sec = secondsLeft % 60;
      document.title = `(${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}) ${currentBlock.taskTitle}`;
    } else {
      document.title = 'Manage by AI — the Energy Sequencer for students';
    }
    return () => {
      document.title = 'Manage by AI — the Energy Sequencer for students';
    };
  }, [isActive, secondsLeft, currentBlock?.taskTitle]);

  useEffect(() => {
    if (isActive && soundType !== 'none') playAmbientSound(soundType, 0.15);
    else stopAmbientSound();
    return () => stopAmbientSound();
  }, [isActive, soundType]);

  if (!currentBlock) {
    return (
      <div className="mono-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg)', marginBottom: '0.25rem' }}>
              {mission && mission.sessionCount === 0 && mission.focusMinutes === 0 ? 'Nothing left for today' : 'Getting started'}
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              No session is waiting right now
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', maxWidth: '620px' }}>
              Either today's plan is done (well done — enjoy the rest of your day), or there are no tasks yet. Add a backlog or build an exam battle plan and ChronosFlow will tell you exactly where to start.
            </p>
          </div>
          <button className="btn-secondary" onClick={onOpenGuide} id="view-guide-tour-btn">
            <span>Open Tour</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {[
            { icon: Sliders, title: 'Calibrate your routine', text: 'Sleep, peak hours, meals, leisure and wind-down.', action: onOpenRoutineSetup, label: 'Routine setup' },
            { icon: Flag, title: 'Build an exam battle plan', text: 'Chapters + exam date + what you know → a sequenced plan.', action: () => onNavigateTab && onNavigateTab('backlog'), label: 'Go to backlog', primary: true },
            { icon: Clock, title: 'Import your timetable', text: 'Photo of your class schedule → classes blocked automatically.', action: () => onNavigateTab && onNavigateTab('timetable'), label: 'Timetable OCR' },
          ].map((c) => (
            <div key={c.title} style={{ ...card, padding: '1.15rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <c.icon size={16} color="var(--text-muted)" />
                <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--fg)', margin: '0.4rem 0 0.3rem' }}>{c.title}</strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.text}</p>
              </div>
              <button onClick={c.action} className={c.primary ? 'btn-primary' : 'btn-secondary'} style={{ marginTop: '1rem', width: '100%', fontSize: '0.78rem' }}>
                {c.label}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const ai = aiCoaching?.[currentBlock.taskId];
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const totalSec = sessionMinutes * 60;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((totalSec - secondsLeft) / totalSec) * circumference;
  const elapsedMin = (totalSec - secondsLeft) / 60;
  const finished = secondsLeft === 0;

  // Script: AI steps (if requested) or the technique script; shrunk sessions show one step.
  let script = coaching?.script || [];
  if (ai?.steps?.length) {
    let cursor = 0;
    script = ai.steps.map((s) => {
      const item = { from: cursor, to: cursor + s.minutes, text: s.text };
      cursor += s.minutes;
      return item;
    });
  }
  if (ladderIdx > 0 && ladder[ladderIdx]) script = [{ from: 0, to: ladder[ladderIdx].minutes, text: ladder[ladderIdx].text }];
  const activeStep = script.findIndex((s) => elapsedMin >= s.from && elapsedMin < s.to);

  const actualMinutes = elapsedSec >= 60 ? Math.round(elapsedSec / 60) : null;
  const finish = (fn) => {
    setIsActive(false);
    endTimeRef.current = null;
    stopAmbientSound();
    fn(currentBlock, { actualMinutes });
  };

  const handleCantStart = () => {
    const next = Math.min(ladderIdx + 1, ladder.length - 1);
    setLadderIdx(next);
    setIsActive(false);
    endTimeRef.current = null;
    startEpochRef.current = null;
    startSecRef.current = 0;
    setSecondsLeft((ladder[next]?.minutes || 2) * 60);
    setElapsedSec(0);
  };

  const toggleTimer = () => {
    if (!isActive) {
      endTimeRef.current = Date.now() + secondsLeft * 1000;
      startEpochRef.current = Date.now();
      startSecRef.current = elapsedSec;
      setIsActive(true);
    } else {
      setIsActive(false);
      endTimeRef.current = null;
    }
  };

  const handleReset = () => {
    setIsActive(false);
    endTimeRef.current = null;
    startEpochRef.current = null;
    startSecRef.current = 0;
    setSecondsLeft(sessionMinutes * 60);
    setElapsedSec(0);
  };

  const handleAddMoreTime = () => {
    const next = secondsLeft + 10 * 60;
    setSecondsLeft(next);
    endTimeRef.current = Date.now() + next * 1000;
    startEpochRef.current = Date.now();
    startSecRef.current = elapsedSec;
    setIsActive(true);
  };

  const handleAI = async () => {
    if (!onRequestAITaskCoach) return;
    setAiLoading(true);
    await onRequestAITaskCoach(currentBlock);
    setAiLoading(false);
  };

  const addParking = (e) => {
    e.preventDefault();
    if (!parkingText.trim()) return;
    onUpdateParkingLot([...parkingLot, { id: `p-${Date.now()}`, text: parkingText.trim() }]);
    setParkingText('');
  };

  return (
    <section className="mono-card" style={{ marginBottom: '2.5rem' }}>
      {showStuck && (
        <StuckModal
          block={currentBlock}
          onClose={() => setShowStuck(false)}
          onSave={(data) => {
            if (data.action === 'micro') {
              setIsActive(false);
              setSecondsLeft(15 * 60);
            }
            onReportStuck(currentBlock, data);
          }}
        />
      )}
      {/* Today's mission */}
      {mission && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          <span>
            Today: <strong style={{ color: 'var(--fg)' }}>{mission.sessionCount} sessions</strong> · {(mission.focusMinutes / 60).toFixed(1)}h focus
            {mission.mustDoCount > 0 && <> · {mission.mustDoCount} must-do</>}
            {mission.endsAt && <> · done by ~{mission.endsAt}</>}
            {MODE_LABEL[mission.mode] && <> · <strong style={{ color: 'var(--fg)' }}>{MODE_LABEL[mission.mode]}</strong></>}
            {mission.planVariant !== 'A' && <> · Plan {mission.planVariant}</>}
          </span>
          {onOpenCheckIn && (
            <button onClick={onOpenCheckIn} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem' }}>
              Update today's check-in
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="badge badge-highlight">START HERE</span>
          {currentBlock.mustDo && <span className="badge">Must-do</span>}
          {currentBlock.quadrant && <span className="badge">{currentBlock.quadrant}</span>}
          <span className="badge">{currentBlock.startTime} - {currentBlock.endTime}</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
          {currentBlock.rawDuration}m work + {currentBlock.bufferMinutes}m buffer
          {currentBlock.reason && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.15rem' }}>{currentBlock.reason}</div>}
          {currentBlock.timeNote && <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>Time: {currentBlock.timeNote}</div>}
        </div>
      </div>

      <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: '1rem' }}>
        {currentBlock.taskTitle}
      </h2>

      {/* 2-minute starter / shrink ladder */}
      <div style={{ ...card, border: '1px solid var(--border-strong)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <SectionTitle icon={Flag}>{ladderIdx === 0 ? 'Your first 2 minutes' : `Smaller start · ${ladder[ladderIdx]?.minutes} min`}</SectionTitle>
          <div style={{ fontSize: '0.95rem', color: 'var(--fg)', lineHeight: 1.5 }}>
            {ladderIdx === 0 ? (ai?.starter || coaching?.starter) : ladder[ladderIdx]?.text}
          </div>
        </div>
        {ladderIdx < ladder.length - 1 && (
          <button className="btn-secondary" onClick={handleCantStart} style={{ fontSize: '0.78rem' }} id="cant-start-btn">
            I can't start — make it smaller
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="round-counter-box">
            <svg className="round-counter-svg" viewBox="0 0 190 190">
              <circle className="round-counter-track" cx="95" cy="95" r={radius} />
              <circle className="round-counter-progress" cx="95" cy="95" r={radius} style={{ strokeDasharray: circumference, strokeDashoffset: isNaN(strokeDashoffset) ? circumference : strokeDashoffset }} />
            </svg>
            <div className="round-counter-content">
              <div style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--fg)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.35rem' }}>
                {isActive ? 'In session' : finished ? "Time's up" : 'Ready'}
              </div>
            </div>
          </div>

          {finished && currentBlock.budget && (
            <div style={{ marginTop: '1rem', textAlign: 'center', maxWidth: '320px', fontSize: '0.9rem', color: 'var(--fg)', lineHeight: 1.5 }} role="status">
              <strong>Today's budget is spent — you're done with this for today.</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tap Done or Partly done; anything left is planned for another day.</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {!finished ? (
              <button className="btn-primary" onClick={toggleTimer} id="round-timer-toggle-btn">
                {isActive ? <><Pause size={16} /> Pause</> : <><Play size={16} fill="currentColor" /> {elapsedSec > 0 ? 'Resume' : 'Start'}</>}
              </button>
            ) : currentBlock.budget ? null : (
              <button className="btn-secondary" onClick={handleAddMoreTime}>
                <Plus size={14} /> 10 more min
              </button>
            )}
            <button className="icon-btn" onClick={handleReset} title="Reset timer" id="round-timer-reset-btn">
              <RotateCcw size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={() => finish(onMarkDone)} id="round-timer-done-btn">
              <Check size={16} /> Done
            </button>
            <button className="btn-secondary" onClick={() => finish(onMarkPartial)} id="round-timer-partial-btn">
              Partly done
            </button>
            <button className="btn-danger" onClick={() => finish(onMarkNotDone)} id="round-timer-stalled-btn">
              <X size={16} /> Stalled
            </button>
            {onReportStuck && (
              <button className="btn-secondary" onClick={() => setShowStuck(true)} id="im-stuck-btn">
                <HelpCircle size={15} /> I'm stuck
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '1rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-faint)', marginRight: '0.2rem' }}>Sound:</span>
            {[
              { id: 'none', label: 'Off' },
              { id: 'brown_noise', label: 'Noise' },
              { id: 'rain', label: 'Rain' },
              { id: 'binaural_alpha', label: 'Alpha' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSoundType(s.id)}
                style={{
                  background: soundType === s.id ? 'var(--fg)' : 'transparent',
                  color: soundType === s.id ? 'var(--fg-inverse)' : 'var(--text-muted)',
                  border: soundType === s.id ? '1px solid var(--fg)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Stuck points for this lecture plan / task */}
          {stuckItems.length > 0 && (
            <div style={{ ...card, width: '100%', marginTop: '1.25rem', border: '1px solid var(--border-strong)' }}>
              <SectionTitle icon={HelpCircle}>
                {['summary', 'review', 'connect'].includes(currentBlock.taskData?.meta?.kind) ? 'Resolve your stuck points in this step' : `Parked questions (${stuckItems.length})`}
              </SectionTitle>
              {stuckItems.map((it) => (
                <label key={it.id} style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', cursor: 'pointer' }}>
                  <input type="checkbox" onChange={() => onResolveStuck(it.id)} style={{ accentColor: 'var(--fg)', marginTop: '0.2rem' }} />
                  <span>{it.note}{it.taskTitle ? <span style={{ color: 'var(--text-faint)' }}> — {it.taskTitle}</span> : null}</span>
                </label>
              ))}
            </div>
          )}

          {/* Distraction parking lot */}
          <div style={{ ...card, width: '100%', marginTop: '1.25rem' }}>
            <SectionTitle icon={Inbox}>Distraction parking lot</SectionTitle>
            <form onSubmit={addParking} style={{ display: 'flex', gap: '0.35rem' }}>
              <input className="input-field" placeholder="Random thought? Park it here, deal with it later" value={parkingText} onChange={(e) => setParkingText(e.target.value)} />
              <button type="submit" className="btn-secondary" style={{ padding: '0.3rem 0.6rem' }} aria-label="Park thought">
                <Plus size={14} />
              </button>
            </form>
            {parkingLot.length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {parkingLot.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>• {p.text}</span>
                    <button onClick={() => onUpdateParkingLot(parkingLot.filter((x) => x.id !== p.id))} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }} aria-label="Clear">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* How to do it */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--fg)' }}>How to do this session</strong>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {onRequestAITaskCoach && (
                <button className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={handleAI} disabled={aiLoading}>
                  <Sparkles size={12} /> {aiLoading ? 'Thinking…' : ai ? 'AI guide on' : 'AI guide for this topic'}
                </button>
              )}
              <button onClick={() => setShowDetails(!showDetails)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Toggle details">
                <ChevronDown size={16} style={{ transform: showDetails ? 'rotate(180deg)' : 'none' }} />
              </button>
            </div>
          </div>
          {ai?.error && <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{ai.error}</div>}

          {/* Step-by-step script with the current step highlighted */}
          <div style={card}>
            <SectionTitle icon={ListChecks}>Step by step</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {script.map((st, idx) => {
                const active = (isActive || elapsedSec > 0) && idx === activeStep;
                const done = elapsedMin >= st.to;
                return (
                  <div key={idx} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', background: active ? 'var(--fg)' : 'transparent', color: active ? 'var(--fg-inverse)' : done ? 'var(--text-faint)' : 'var(--text-secondary)', fontSize: '0.83rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', minWidth: '58px', fontWeight: 700 }}>
                      {Math.round(st.from)}–{Math.round(st.to)}m
                    </span>
                    <span style={{ textDecoration: done && !active ? 'line-through' : 'none' }}>{st.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {showDetails && (
            <>
              <div style={card}>
                <SectionTitle icon={Lightbulb}>Technique · {ai?.technique?.name || coaching?.technique.name}</SectionTitle>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ai?.technique?.how || coaching?.technique.how}</div>
                {coaching?.tips?.map((t) => (
                  <div key={t} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.5 }}>• {t}</div>
                ))}
              </div>

              <div style={card}>
                <SectionTitle icon={ShieldAlert}>If–then plans</SectionTitle>
                {(ai?.ifThen?.length ? ai.ifThen : coaching?.ifThen || []).map((t) => (
                  <div key={t} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.25rem' }}>• {t}</div>
                ))}
              </div>

              <div style={card}>
                <SectionTitle icon={CheckCircle2}>You're done when…</SectionTitle>
                <div style={{ fontSize: '0.82rem', color: 'var(--fg)' }}>{ai?.doneCheck || coaching?.doneCheck}</div>
                {currentBlock.taskData?.materials?.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Open first: {currentBlock.taskData.materials.join(' • ')}</div>
                )}
              </div>
            </>
          )}

          <button onClick={onSwapLighter} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            Too heavy right now? Swap to a lighter session today →
          </button>
          {onOpenEnergy && (
            <button onClick={onOpenEnergy} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
              Feeling sharp or fried? Match your work to your energy →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
