import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Check, X, Volume2, VolumeX, Headphones, CheckCircle2, Sliders, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { playAmbientSound, stopAmbientSound, playCompletionChime } from '../utils/audioSynthesizer';
import { generateExecutionBlueprint } from '../services/blueprintGenerator';

export function RoundCounterTimer({ 
  currentBlock, 
  onMarkDone, 
  onMarkNotDone,
  onSwapLighter,
  onNavigateTab,
  onOpenGuide,
  onOpenRoutineSetup
}) {
  const initialMinutes = currentBlock?.rawDuration || 25;
  const initialSeconds = initialMinutes * 60;
  
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const [soundType, setSoundType] = useState('none'); // 'none', 'brown_noise', 'rain', 'binaural_alpha'
  const [isMuted, setIsMuted] = useState(false);

  // Sync when current block changes
  useEffect(() => {
    if (currentBlock) {
      setSecondsLeft((currentBlock.rawDuration || 25) * 60);
      setIsActive(false);
    }
  }, [currentBlock?.id]);

  // Countdown interval
  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      stopAmbientSound();
      playCompletionChime();
      onMarkDone(currentBlock);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  // Soundscape management
  useEffect(() => {
    if (isActive && !isMuted && soundType !== 'none') {
      playAmbientSound(soundType, 0.15);
    } else {
      stopAmbientSound();
    }
    return () => stopAmbientSound();
  }, [isActive, isMuted, soundType]);

  if (!currentBlock) {
    return (
      <div className="mono-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              ✦ First-Time User Getting Started Guide
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Welcome to ChronosFlow
            </h2>
          </div>

          <button
            className="btn-secondary"
            onClick={onOpenGuide}
            id="view-guide-tour-btn"
          >
            <span>Open 5-Step Tour</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.75rem', maxWidth: '620px' }}>
          ChronosFlow uses a hybrid cognitive scheduler. Follow these 3 simple steps to generate your first hyper-realistic plan:
        </p>

        {/* 3 Actionable Guiding Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Step 1 */}
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="badge badge-highlight">Step 01</span>
                <Sliders size={16} color="var(--text-muted)" />
              </div>
              <strong style={{ fontSize: '0.925rem', color: '#ffffff', display: 'block', marginBottom: '0.35rem' }}>
                Calibrate Your Routine
              </strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Configure wake/sleep boundaries, biological peak hours, and non-negotiable meal/exercise breaks.
              </p>
            </div>
            <button
              onClick={onOpenRoutineSetup}
              className="btn-secondary"
              style={{ marginTop: '1rem', width: '100%', fontSize: '0.78rem' }}
            >
              <span>Setup Daily Rhythms</span>
            </button>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="badge badge-highlight">Step 02</span>
                <Sparkles size={16} color="var(--text-muted)" />
              </div>
              <strong style={{ fontSize: '0.925rem', color: '#ffffff', display: 'block', marginBottom: '0.35rem' }}>
                Add Backlog or AI Crunch
              </strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Add tasks with time sliders up to 4 hours or paste your syllabus for Gemini 3.8 Flash to structure into Eisenhower quadrants.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('backlog')}
              className="btn-primary"
              style={{ marginTop: '1rem', width: '100%', fontSize: '0.78rem' }}
            >
              <span>Go to Backlog & Planner</span>
            </button>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="badge">Optional</span>
                <Clock size={16} color="var(--text-muted)" />
              </div>
              <strong style={{ fontSize: '0.925rem', color: '#ffffff', display: 'block', marginBottom: '0.35rem' }}>
                Import Timetable Image
              </strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Drop a photo of your class schedule to extract lectures and protect mandatory 20m post-class rest buffers.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('timetable')}
              className="btn-secondary"
              style={{ marginTop: '1rem', width: '100%', fontSize: '0.78rem' }}
            >
              <span>Import Timetable OCR</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const blueprint = generateExecutionBlueprint(currentBlock.taskData || { title: currentBlock.taskTitle });
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  
  // Calculate SVG round progress stroke
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = (initialSeconds - secondsLeft) / initialSeconds;
  const strokeDashoffset = circumference - (progressRatio * circumference);

  const handleReset = () => {
    setIsActive(false);
    setSecondsLeft((currentBlock.rawDuration || 25) * 60);
    stopAmbientSound();
  };

  return (
    <section className="mono-card" style={{ marginBottom: '2.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-highlight">NOW</span>
          <span className="badge">{currentBlock.quadrant || 'Q1'}: DO FIRST</span>
          <span className="badge">{currentBlock.startTime} - {currentBlock.endTime}</span>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {currentBlock.rawDuration}m Sprint + {currentBlock.bufferMinutes}m Buffer
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
        {/* Left Column: Round Counter Box */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="round-counter-box">
            <svg className="round-counter-svg" viewBox="0 0 190 190">
              <circle
                className="round-counter-track"
                cx="95"
                cy="95"
                r={radius}
              />
              <circle
                className="round-counter-progress"
                cx="95"
                cy="95"
                r={radius}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: isNaN(strokeDashoffset) ? circumference : strokeDashoffset,
                }}
              />
            </svg>

            {/* Content inside round counter */}
            <div className="round-counter-content">
              <div style={{ 
                fontSize: '2.4rem', 
                fontWeight: 800, 
                fontFamily: 'var(--font-mono)', 
                color: '#ffffff',
                letterSpacing: '-0.02em',
                lineHeight: 1
              }}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.35rem' }}>
                {isActive ? 'In Session' : (secondsLeft === 0 ? 'Finished' : 'Ready')}
              </div>
            </div>
          </div>

          {/* Timer Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              className="btn-primary"
              onClick={() => setIsActive(!isActive)}
              id="round-timer-toggle-btn"
            >
              {isActive ? <><Pause size={16} /> Pause</> : <><Play size={16} fill="black" /> Start</>}
            </button>

            <button 
              className="icon-btn" 
              onClick={handleReset} 
              title="Reset Timer"
              id="round-timer-reset-btn"
            >
              <RotateCcw size={16} />
            </button>

            <button 
              className="btn-secondary" 
              onClick={() => { stopAmbientSound(); onMarkDone(currentBlock); }}
              id="round-timer-done-btn"
            >
              <Check size={16} />
              <span>Done</span>
            </button>

            <button 
              className="btn-danger" 
              onClick={() => { stopAmbientSound(); onMarkNotDone(currentBlock); }}
              id="round-timer-stalled-btn"
            >
              <X size={16} />
              <span>Stalled</span>
            </button>
          </div>

          {/* Soundscapes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '1rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-faint)', marginRight: '0.2rem' }}>Sound:</span>
            {[
              { id: 'none', label: 'Off' },
              { id: 'brown_noise', label: 'Noise' },
              { id: 'rain', label: 'Rain' },
              { id: 'binaural_alpha', label: 'Alpha' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => { setSoundType(s.id); setIsMuted(false); }}
                style={{
                  background: soundType === s.id && !isMuted ? '#ffffff' : 'transparent',
                  color: soundType === s.id && !isMuted ? '#000000' : 'var(--text-muted)',
                  border: soundType === s.id && !isMuted ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
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
        </div>

        {/* Right Column: Execution Blueprint & Guidance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Current Target
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              {currentBlock.taskTitle}
            </h2>
          </div>

          {/* Definition of Done */}
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Definition of Done
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ffffff' }}>
              {blueprint.definitionOfDone}
            </div>
          </div>

          {/* Materials */}
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Open First (Zero Friction)
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {blueprint.materials.join(' • ')}
            </div>
          </div>

          {/* 3 Step Action Path */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {blueprint.steps.map((st, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.65rem',
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#ffffff', fontWeight: 700 }}>
                  0{idx + 1}
                </span>
                <span>{st}</span>
              </div>
            ))}
          </div>

          {/* Swap lighter task button */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.25rem' }}>
            <button
              onClick={onSwapLighter}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Need a lighter step? Swap with low-cognitive task →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
