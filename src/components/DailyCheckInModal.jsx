import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Sun, Heart } from 'lucide-react';
import { suggestDayMode } from '../utils/planUtils';

const SCALES = [
  { key: 'sleepQuality', label: 'How did you sleep?', low: 'Badly', high: 'Great' },
  { key: 'energy', label: 'Energy right now', low: 'Drained', high: 'Charged' },
  { key: 'mood', label: 'Mood', low: 'Low', high: 'Good' },
  { key: 'stress', label: 'Stress', low: 'Calm', high: 'Very stressed' },
];

const EVENING = [
  { id: 'free', label: 'Nothing special' },
  { id: 'study', label: 'Happy to study more' },
  { id: 'gym', label: 'Exercise / sport' },
  { id: 'family', label: 'Family / personal time' },
  { id: 'out', label: 'Going out' },
];

const MODES = [
  { id: 'FULL', title: 'Full day', desc: 'Normal plan' },
  { id: 'LIGHT', title: 'Light day', desc: '~60% load, short sprints, easier first' },
  { id: 'RECOVERY', title: 'Recovery', desc: '1–2 small wins, lots of rest' },
];

function Scale({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: '34px',
            height: '30px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            background: value === n ? 'var(--fg)' : 'var(--bg-card-subtle)',
            color: value === n ? 'var(--fg-inverse)' : 'var(--text-muted)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function DailyCheckInModal({ isOpen, onClose, onSave, initial, showSupportNudge }) {
  const [form, setForm] = useState(() => ({
    sleepQuality: 3,
    energy: 3,
    mood: 3,
    stress: 3,
    busyBlocks: [],
    availableMinutes: '',
    eveningPlan: 'free',
    mode: null,
    ...(initial || {}),
  }));
  const [modeTouched, setModeTouched] = useState(Boolean(initial?.mode));

  const suggested = useMemo(() => suggestDayMode(form), [form]);
  const mode = modeTouched && form.mode ? form.mode : suggested;

  if (!isOpen) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const updateBlock = (idx, key, value) =>
    set('busyBlocks', form.busyBlocks.map((b, i) => (i === idx ? { ...b, [key]: value } : b)));

  const handleSave = () => {
    onSave({
      ...form,
      mode,
      planVariant: form.planVariant || 'A',
      availableMinutes: form.availableMinutes === '' ? null : Number(form.availableMinutes),
      busyBlocks: form.busyBlocks.filter((b) => b.startTime && b.endTime),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '620px', padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Skip check-in">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Sun size={13} /> 30-second morning check-in
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--fg)', margin: '0.25rem 0 0.35rem' }}>How's today looking?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Your answers reshape today's plan — busy time gets blocked, low-energy days get lighter. No wrong answers.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
          {SCALES.map((s) => (
            <div key={s.key}>
              <div style={{ fontSize: '0.78rem', color: 'var(--fg)', fontWeight: 600, marginBottom: '0.3rem' }}>{s.label}</div>
              <Scale value={form[s.key]} onChange={(v) => set(s.key, v)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '186px', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '0.15rem' }}>
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          ))}
        </div>

        {(form.mood <= 1 || showSupportNudge) && (
          <div style={{ display: 'flex', gap: '0.55rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '0.75rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Heart size={15} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              It sounds like things have been heavy lately. Studying can wait a little — you matter more than the plan. If this feeling has stuck around, talking to someone you trust, a campus counsellor or a doctor can really help.
            </span>
          </div>
        )}

        {/* Commitments */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg)', fontWeight: 700 }}>Anything personal or busy today?</div>
            <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={() => set('busyBlocks', [...form.busyBlocks, { title: '', startTime: '15:00', endTime: '16:00' }])}>
              <Plus size={12} /> Add
            </button>
          </div>
          {form.busyBlocks.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Errands, appointments, family, part-time work… add them so nothing collides.</div>}
          {form.busyBlocks.map((b, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
              <input className="input-field" placeholder="What?" value={b.title} onChange={(e) => updateBlock(idx, 'title', e.target.value)} style={{ flex: 1 }} />
              <input className="input-field" type="time" value={b.startTime} onChange={(e) => updateBlock(idx, 'startTime', e.target.value)} style={{ width: '110px' }} />
              <input className="input-field" type="time" value={b.endTime} onChange={(e) => updateBlock(idx, 'endTime', e.target.value)} style={{ width: '110px' }} />
              <button type="button" onClick={() => set('busyBlocks', form.busyBlocks.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }} aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--fg)', fontWeight: 600, marginBottom: '0.3rem' }}>Evening plans</label>
            <select className="input-field" value={form.eveningPlan} onChange={(e) => set('eveningPlan', e.target.value)}>
              {EVENING.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--fg)', fontWeight: 600, marginBottom: '0.3rem' }}>
              Max study today {form.availableMinutes === '' ? '(auto)' : `(${(form.availableMinutes / 60).toFixed(1)}h)`}
            </label>
            <select className="input-field" value={form.availableMinutes} onChange={(e) => set('availableMinutes', e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Let the planner decide</option>
              {[60, 120, 180, 240, 300, 360].map((m) => (
                <option key={m} value={m}>{m / 60}h</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--fg)', fontWeight: 700, marginBottom: '0.4rem' }}>
          Today's mode <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(suggested: {MODES.find((m) => m.id === suggested)?.title})</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setModeTouched(true);
                set('mode', m.id);
              }}
              style={{
                textAlign: 'left',
                padding: '0.7rem',
                borderRadius: 'var(--radius-md)',
                background: mode === m.id ? 'var(--fg)' : 'var(--bg-card-subtle)',
                color: mode === m.id ? 'var(--fg-inverse)' : 'var(--fg)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{m.title}</div>
              <div style={{ fontSize: '0.68rem', color: mode === m.id ? 'var(--fg-inverse-muted)' : 'var(--text-muted)' }}>{m.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <button className="btn-secondary" onClick={onClose}>Skip today</button>
          <button className="btn-primary" onClick={handleSave} id="save-checkin-btn">Build today's plan</button>
        </div>
      </div>
    </div>
  );
}
