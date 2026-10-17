import React from 'react';
import { INCOMPLETION_REASONS } from '../constants/initialData';

export function AIInsightsPanel({ 
  reviewHistory = [], 
  learnedFatigueHours = [], 
  learnedBufferInflation = 1.0,
  userHabits 
}) {
  const completed = reviewHistory.filter((r) => r.status === 'COMPLETED').length;
  const stalled = reviewHistory.filter((r) => r.status === 'NOT_DONE').length;
  const total = reviewHistory.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

  const getReasonText = (reasonId) => {
    const found = INCOMPLETION_REASONS.find((r) => r.id === reasonId);
    return found ? found.label : reasonId || 'Unspecified';
  };

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      <div style={{ marginBottom: '1.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Adaptive Memory & Recalibration Analytics
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
          ChronosFlow learns from reasons you report when sessions stall to realistically calibrate future workloads.
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success Rate</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>{rate}%</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{completed} completed • {stalled} recalibrated</div>
        </div>

        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adaptive Buffer</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
            +{Math.round(((userHabits?.distractionFactor || 1.25) * learnedBufferInflation - 1) * 100)}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>Automatic human cushion factor</div>
        </div>

        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fatigue Hours</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '0.25rem' }}>
            {learnedFatigueHours.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
            {learnedFatigueHours.length > 0 ? learnedFatigueHours.map(h => `${h}:00`).join(', ') : 'No fatigue zones detected'}
          </div>
        </div>
      </div>

      {/* Recalibration Log Feed */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
          Recalibration History Log
        </h3>
        {reviewHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)', fontStyle: 'italic', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)' }}>
            No sessions reviewed yet. When you complete or stall a session, logs will appear here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {reviewHistory.map((rev) => (
              <div
                key={rev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{rev.taskTitle}</strong>
                  {rev.userNote && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      "{rev.userNote}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge">
                    {rev.status === 'COMPLETED' ? 'Completed' : `Stalled: ${getReasonText(rev.reasonId)}`}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(rev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
