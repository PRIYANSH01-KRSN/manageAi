import React, { useState } from 'react';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  AlertTriangle, 
  BookOpen, 
  ShieldAlert, 
  ChevronRight, 
  Lightbulb, 
  Clock, 
  Zap,
  ArrowRightLeft
} from 'lucide-react';
import { EISENHOWER_QUADRANTS } from '../constants/initialData';
import { generateExecutionBlueprint } from '../services/blueprintGenerator';

export function DecisionParalysisCard({ 
  currentBlock, 
  onStartFocus, 
  onMarkDone, 
  onMarkNotDone,
  onSwapWithLighterTask,
  userHabits,
  recalibrationMessage
}) {
  const [showFullBlueprint, setShowFullBlueprint] = useState(true);

  if (!currentBlock) {
    return (
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', margin: '1.5rem 0' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', marginBottom: '1rem' }}>
          <CheckCircle2 size={36} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>All Clear for Now!</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
          No active tasks require immediate action. You can import a syllabus, add a new backlog goal, or enjoy protected downtime.
        </p>
      </div>
    );
  }

  const quad = EISENHOWER_QUADRANTS[currentBlock.quadrant] || EISENHOWER_QUADRANTS.Q1;
  const blueprint = generateExecutionBlueprint(currentBlock.taskData || { title: currentBlock.taskTitle });

  return (
    <section className="glass-panel paralysis-card-glow" style={{ padding: '2rem', marginBottom: '2rem' }} aria-labelledby="start-right-now-title">
      {/* Empathetic Recalibration Alert if present */}
      {recalibrationMessage && (
        <div style={{ 
          background: 'rgba(99, 102, 241, 0.15)', 
          border: '1px solid rgba(99, 102, 241, 0.35)', 
          borderRadius: 'var(--radius-md)', 
          padding: '0.85rem 1.25rem', 
          marginBottom: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          fontSize: '0.875rem',
          color: '#e0e7ff'
        }}>
          <Sparkles size={20} style={{ color: '#818cf8', flexShrink: 0 }} />
          <div>
            <strong>Adaptive Rebalance:</strong> {recalibrationMessage}
          </div>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ 
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)', 
            color: 'white', 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            letterSpacing: '0.05em', 
            padding: '0.25rem 0.65rem', 
            borderRadius: 'var(--radius-full)' 
          }}>
            🎯 START RIGHT NOW
          </span>
          <span className="badge" style={{ background: quad.bg, color: quad.color, borderColor: quad.border }}>
            {quad.id}: {quad.badge}
          </span>
          <span className="badge badge-peak">
            <Zap size={13} /> {currentBlock.energyLevel || 'PEAK FOCUS'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
          <Clock size={15} />
          <span>Scheduled: {currentBlock.startTime} - {currentBlock.endTime}</span>
          <span style={{ color: 'var(--accent-cyan)', fontSize: '0.78rem' }}>
            ({currentBlock.rawDuration}m task + {currentBlock.bufferMinutes}m buffer)
          </span>
        </div>
      </div>

      {/* Main Task Title */}
      <h2 id="start-right-now-title" style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem', color: '#ffffff' }}>
        {currentBlock.taskTitle}
      </h2>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span>Category:</span>
        <strong style={{ color: 'var(--text-main)', textTransform: 'capitalize' }}>{currentBlock.category || 'General'}</strong>
        <span>•</span>
        <span>Zero-friction target: Take action for the next 25 minutes. No perfectionism required.</span>
      </p>

      {/* Execution Blueprint Panel (Anti-Procrastination Guide) */}
      <div style={{ 
        background: 'rgba(15, 23, 42, 0.75)', 
        border: '1px solid rgba(255, 255, 255, 0.08)', 
        borderRadius: 'var(--radius-md)', 
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Lightbulb size={16} style={{ color: '#fbbf24' }} />
            Anti-Procrastination Execution Blueprint
          </h3>
          <button 
            onClick={() => setShowFullBlueprint(!showFullBlueprint)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            {showFullBlueprint ? 'Hide Details' : 'Show Guide'}
          </button>
        </div>

        {showFullBlueprint && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
            {/* Definition of Done */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} /> Definition of Done:
              </div>
              <div style={{ color: 'var(--text-main)' }}>{blueprint.definitionOfDone}</div>
            </div>

            {/* Materials to Open First */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <BookOpen size={14} /> Open These First:
              </div>
              <div style={{ color: 'var(--text-main)' }}>
                {blueprint.materials.join(' • ')}
              </div>
            </div>

            {/* Anticipated Roadblock */}
            <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)', gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldAlert size={14} /> Anticipated Roadblock & Stuck Protocol:
              </div>
              <div style={{ color: '#fecaca', marginBottom: '0.35rem' }}>
                <strong>Friction point:</strong> {blueprint.roadblock}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <strong>If stuck:</strong> {blueprint.stuckProtocol}
              </div>
            </div>

            {/* Step by Step Path */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                3-Step Rapid Execution Path
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {blueprint.steps.map((st, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#818cf8', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      #{sIdx + 1}
                    </span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{st}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Trigger Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
        <button 
          className="btn-primary" 
          onClick={() => onStartFocus(currentBlock)}
          id="start-focus-session-btn"
          style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}
        >
          <Play size={18} fill="white" />
          <span>Start Focused Sprint ({currentBlock.rawDuration}m)</span>
        </button>

        <button 
          className="btn-emerald" 
          onClick={() => onMarkDone(currentBlock)}
          id="mark-task-done-btn"
        >
          <CheckCircle2 size={18} />
          <span>Done (Complete)</span>
        </button>

        <button 
          className="btn-rose" 
          onClick={() => onMarkNotDone(currentBlock)}
          id="mark-task-not-done-btn"
        >
          <XCircle size={18} />
          <span>Not Done / Stalled</span>
        </button>

        <button 
          className="btn-secondary" 
          onClick={onSwapWithLighterTask}
          title="Swap with a low-cognitive or micro-admin task"
          id="swap-lighter-task-btn"
        >
          <ArrowRightLeft size={16} />
          <span>Need a Lighter Step</span>
        </button>
      </div>
    </section>
  );
}
