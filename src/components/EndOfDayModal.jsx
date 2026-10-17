import React from 'react';
import { X, Moon, CheckCircle2, ArrowRight } from 'lucide-react';

function messageFor(doneCount, plannedCount) {
  if (plannedCount === 0) return 'Nothing was planned today — rest days are part of a sustainable plan.';
  const ratio = doneCount / plannedCount;
  if (ratio >= 1) return 'You did everything you planned. That consistency is exactly what wins exams.';
  if (ratio >= 0.6) return 'Solid day. The bits that slipped are already re-planned — no catching up tonight.';
  if (doneCount > 0) return 'You showed up and made progress. Some days are like that; tomorrow\'s plan already absorbed the rest.';
  return 'Today didn\'t go to plan, and that\'s okay. Nothing is lost — the work has been moved, and tomorrow starts fresh.';
}

export function EndOfDayModal({ isOpen, onClose, todayStats, tomorrow, parkingLot = [] }) {
  if (!isOpen) return null;
  const { doneCount = 0, plannedCount = 0, doneMinutes = 0 } = todayStats || {};
  const firstTomorrow = tomorrow?.sessions?.[0];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ padding: '2rem', maxWidth: '540px' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Moon size={13} /> Wrap up today
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0.3rem 0 0.75rem' }}>
          {doneCount}/{plannedCount} sessions · {(doneMinutes / 60).toFixed(1)}h focused
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>{messageFor(doneCount, plannedCount)}</p>

        {firstTomorrow && (
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Tomorrow starts with</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.88rem', fontWeight: 600 }}>
              <ArrowRight size={14} /> {firstTomorrow.startTime} · {firstTomorrow.taskTitle}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Lay out what you need tonight: {firstTomorrow.taskData?.materials?.[0] || 'your notes'}. Future-you will thank you.
            </div>
          </div>
        )}

        {parkingLot.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Parked thoughts to handle (or let go of):</div>
            {parkingLot.map((p) => (
              <div key={p.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>• {p.text}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          <CheckCircle2 size={14} /> Screens down 30–45 min before bed — sleep is when today's learning gets stored.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose}>Good night</button>
        </div>
      </div>
    </div>
  );
}
