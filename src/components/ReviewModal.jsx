import React, { useState } from 'react';
import { X } from 'lucide-react';
import { INCOMPLETION_REASONS } from '../constants/initialData';

export function ReviewModal({ block, onClose, onSubmitReview }) {
  const [selectedReason, setSelectedReason] = useState('UNDERESTIMATED_TIME');
  const [userNote, setUserNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitReview({
      scheduledBlock: block,
      status: 'NOT_DONE',
      reasonId: selectedReason,
      userNote,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ padding: '2rem' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
          Adaptive Recalibration
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          Why did this session stall? Recording the true cause trains the scheduling engine to prevent time crunches.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {INCOMPLETION_REASONS.map((r) => {
              const isSelected = selectedReason === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReason(r.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? '#ffffff' : 'var(--bg-card-subtle)',
                    color: isSelected ? '#000000' : '#ffffff',
                    border: isSelected ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={isSelected}
                    onChange={() => setSelectedReason(r.id)}
                    style={{ accentColor: '#000000' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: '0.75rem', color: isSelected ? '#3f3f46' : 'var(--text-muted)' }}>
                      {r.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Optional context:
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Concept on slide 14 was unclear; got stuck on formula"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Recalibrate & Sync DB</button>
          </div>
        </form>
      </div>
    </div>
  );
}
