import React, { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';

const KINDS = [
  {
    id: 'concept',
    label: "A concept isn't clicking",
    tips: [
      'Try a different explanation for 10 minutes: another video, the textbook, or a classmate.',
      'Explain what you DO understand out loud — the gap usually shows itself.',
      'Draw it: a diagram often unlocks structures like lists, trees and flows.',
    ],
  },
  {
    id: 'problem',
    label: "I can't solve a problem",
    tips: [
      'Look at a worked solution, close it, then redo the problem without looking.',
      'Solve a smaller version first (fewer elements, simpler numbers).',
      'Write down the exact step where you get lost — that is the real question.',
    ],
  },
  {
    id: 'focus',
    label: "I've lost focus",
    tips: ['Switch to a 15-minute micro-sprint.', 'Park every distracting thought in the parking lot.', 'Stand up, drink water, then restart the current step only.'],
  },
];

export function StuckModal({ block, onClose, onSave }) {
  const [kind, setKind] = useState('concept');
  const [note, setNote] = useState('');
  const current = KINDS.find((k) => k.id === kind);
  const subtopic = block?.taskData?.meta?.subtopic;

  const submit = (action) => {
    onSave({ kind, note: note.trim() || current.label, action });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ padding: '2rem', maxWidth: '560px' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <HelpCircle size={13} /> Stuck — that's normal
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: '0.3rem 0 0.9rem' }}>
          What's blocking you{subtopic ? ` on ${subtopic}` : ''}?
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.9rem' }}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              style={{
                textAlign: 'left',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: kind === k.id ? '#ffffff' : 'var(--bg-card-subtle)',
                color: kind === k.id ? '#000000' : '#ffffff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.84rem',
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem 0.9rem', marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Try this first</div>
          {current.tips.map((t) => (
            <div key={t} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>• {t}</div>
          ))}
        </div>

        {kind !== 'focus' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Write the exact question or timestamp (it goes on your stuck list)
            </label>
            <input className="input-field" placeholder="e.g. Why does the last node point back to head? (12:40)" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {kind === 'focus' ? (
            <button className="btn-primary" onClick={() => submit('micro')}>Switch to a 15-min sprint</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => submit('unblock')}>Add a 15-min unblock session</button>
              <button className="btn-primary" onClick={() => submit('park')} id="stuck-park-btn">Park it & keep going</button>
            </>
          )}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.75rem' }}>
          Parked questions show up in this {block?.taskData?.meta?.groupTitle ? 'lecture plan' : 'task'}'s summary and review steps, so nothing gets lost.
        </div>
      </div>
    </div>
  );
}
