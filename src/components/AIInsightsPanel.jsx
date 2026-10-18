import React from 'react';
import { INCOMPLETION_REASONS } from '../constants/initialData';

function WeeklyReview({ sessionLogs = [], calibration = {} }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const logs = sessionLogs.filter((l) => l.dateKey === key);
    const minutes = logs.reduce((a, l) => a + (l.actualMinutes || Math.round((l.plannedMinutes || 0) * (l.progressPct ?? 100) / 100)), 0);
    return { key, label: d.toLocaleDateString([], { weekday: 'short' }), minutes, sessions: logs.filter((l) => l.status !== 'NOT_DONE').length };
  });
  const max = Math.max(60, ...days.map((d) => d.minutes));
  const total = days.reduce((a, d) => a + d.minutes, 0);
  const weekLogs = sessionLogs.filter((l) => days.some((d) => d.key === l.dateKey));
  const bySubject = {};
  weekLogs.forEach((l) => {
    const k = l.subject || 'Other';
    bySubject[k] = (bySubject[k] || 0) + (l.actualMinutes || l.plannedMinutes || 0);
  });
  const paceEntries = Object.entries(calibration).filter(([k, v]) => k !== 'all' && v.samples >= 2);

  return (
    <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <strong style={{ fontSize: '0.95rem', color: 'var(--fg)' }}>This week</strong>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(total / 60).toFixed(1)}h focused · {weekLogs.filter((l) => l.status !== 'NOT_DONE').length} sessions</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '90px', marginBottom: '0.75rem' }}>
        {days.map((d) => (
          <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{d.minutes ? `${(d.minutes / 60).toFixed(1)}h` : ''}</span>
            <div title={`${d.minutes} min`} style={{ width: '100%', maxWidth: '36px', height: `${Math.max(2, (d.minutes / max) * 60)}px`, background: d.minutes ? 'var(--fg)' : 'var(--border-subtle)', borderRadius: '3px 3px 0 0' }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.label}</span>
          </div>
        ))}
      </div>
      {Object.keys(bySubject).length > 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          By subject: {Object.entries(bySubject).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}h`).join(' · ')}
        </div>
      )}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {paceEntries.length > 0
          ? <>Your real pace (learned from timed sessions): {paceEntries.map(([k, v]) => `${k.split(':')[1]} ${v.ratio.toFixed(2)}×`).join(' · ')}. Future estimates are adjusted automatically.</>
          : 'Use the focus timer for a few sessions and ChronosFlow will learn how long things really take you — per subject.'}
      </div>
    </div>
  );
}

export function AIInsightsPanel({
  reviewHistory = [],
  learnedFatigueHours = [],
  learnedBufferInflation = 1.0,
  userHabits,
  sessionLogs = [],
  calibration = {}
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
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
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
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--fg)', marginTop: '0.25rem' }}>{rate}%</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{completed} completed • {stalled} recalibrated</div>
        </div>

        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adaptive Buffer</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--fg)', marginTop: '0.25rem' }}>
            +{Math.round(((userHabits?.distractionFactor || 1.25) * learnedBufferInflation - 1) * 100)}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>Automatic human cushion factor</div>
        </div>

        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fatigue Hours</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--fg)', marginTop: '0.25rem' }}>
            {learnedFatigueHours.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
            {learnedFatigueHours.length > 0 ? learnedFatigueHours.map(h => `${h}:00`).join(', ') : 'No fatigue zones detected'}
          </div>
        </div>
      </div>

      <WeeklyReview sessionLogs={sessionLogs} calibration={calibration} />

      {/* Recalibration Log Feed */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '0.75rem' }}>
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
                  <strong style={{ fontSize: '0.85rem', color: 'var(--fg)' }}>{rev.taskTitle}</strong>
                  {rev.userNote && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      "{rev.userNote}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge">
                    {rev.status === 'COMPLETED' ? 'Completed' : rev.status === 'PARTIAL' ? 'Partly done' : `Stalled: ${getReasonText(rev.reasonId)}`}
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
