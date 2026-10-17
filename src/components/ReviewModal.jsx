import React, { useState } from 'react';
import { X } from 'lucide-react';
import { INCOMPLETION_REASONS } from '../constants/initialData';

export function ReviewModal({ block, mode = 'NOT_DONE', actualMinutes, onClose, onSubmitReview }) {
  const isPartial = mode === 'PARTIAL';
  const [selectedReason, setSelectedReason] = useState(isPartial ? '' : 'UNDERESTIMATED_TIME');
  const [userNote, setUserNote] = useState('');
  const [progressPct, setProgressPct] = useState(50);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitReview({
      scheduledBlock: block,
      status: isPartial ? 'PARTIAL' : 'NOT_DONE',
      reasonId: selectedReason || null,
      userNote,
      progressPct: isPartial ? progressPct : 0,
      actualMinutes,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
          {isPartial ? 'Progress counts — how far did you get?' : 'No guilt. What got in the way?'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          {isPartial
            ? 'Whatever is left is re-planned automatically into your next good slot.'
            : 'This only teaches the planner to fit your real life better. The session will be moved, not lost.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isPartial && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[25, 50, 75].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProgressPct(p)}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: progressPct === p ? '#ffffff' : 'var(--bg-card-subtle)',
                      color: progressPct === p ? '#000000' : '#ffffff',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ~{p}%
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Optional: why did it stop there?</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem' }}>
            {INCOMPLETION_REASONS.map((r) => {
              const isSelected = selectedReason === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReason(isSelected && isPartial ? '' : r.id)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? '#ffffff' : 'var(--bg-card-subtle)',
                    color: isSelected ? '#000000' : '#ffffff',
                    border: isSelected ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: '0.72rem', color: isSelected ? '#3f3f46' : 'var(--text-muted)' }}>{r.adaptiveAction}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Optional note</label>
            <input type="text" className="input-field" placeholder="e.g. Concept on slide 14 was unclear" value={userNote} onChange={(e) => setUserNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{isPartial ? 'Save progress & re-plan' : 'Re-plan without guilt'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
