import React from 'react';
import { CHRONOTYPES } from '../constants/initialData';
import { Clock, Trash2 } from 'lucide-react';

export function EnergyHabitSettings({ userHabits = {}, onUpdateHabits }) {
  const currentChrono = userHabits.chronotype || 'BALANCED';

  const handleChronoSelect = (key) => {
    onUpdateHabits({ ...userHabits, chronotype: key });
  };

  const handleTimeChange = (field, val) => {
    onUpdateHabits({ ...userHabits, [field]: val });
  };

  const handleBufferChange = (val) => {
    onUpdateHabits({ ...userHabits, distractionFactor: parseFloat(val) });
  };

  const handleToggleStrict = (habitId) => {
    const updated = (userHabits.habits || []).map((h) => {
      if (h.id === habitId) return { ...h, isStrict: !h.isStrict };
      return h;
    });
    onUpdateHabits({ ...userHabits, habits: updated });
  };

  const handleDeleteHabit = (habitId) => {
    const updated = (userHabits.habits || []).filter((h) => h.id !== habitId);
    onUpdateHabits({ ...userHabits, habits: updated });
  };

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      <div style={{ marginBottom: '1.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Habits & Circadian Rhythms
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
          Configures your wake/sleep boundaries, circadian peak windows, and protected routines.
        </p>
      </div>

      {/* Chronotypes */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
          Select Circadian Chronotype
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {Object.values(CHRONOTYPES).map((chrono) => {
            const isSelected = currentChrono === chrono.id;
            return (
              <div
                key={chrono.id}
                onClick={() => handleChronoSelect(chrono.id)}
                style={{
                  background: isSelected ? '#ffffff' : 'var(--bg-card-subtle)',
                  color: isSelected ? '#000000' : 'var(--text-primary)',
                  border: isSelected ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  {chrono.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: isSelected ? '#3f3f46' : 'var(--text-muted)' }}>
                  {chrono.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wake / Sleep / Buffer Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Wake Time</label>
          <input type="time" className="input-field" value={userHabits.wakeTime || '07:30'} onChange={(e) => handleTimeChange('wakeTime', e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Sleep Time</label>
          <input type="time" className="input-field" value={userHabits.sleepTime || '23:30'} onChange={(e) => handleTimeChange('sleepTime', e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Distraction Buffer: +{Math.round(((userHabits.distractionFactor || 1.25) - 1) * 100)}%
          </label>
          <input type="range" min="1.0" max="1.5" step="0.05" value={userHabits.distractionFactor || 1.25} onChange={(e) => handleBufferChange(e.target.value)} style={{ width: '100%', accentColor: '#ffffff' }} />
        </div>
      </div>

      {/* Blocked Daily Habits */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
          Protected Daily Routines
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(userHabits.habits || []).map((hb) => (
            <div
              key={hb.id}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={13} style={{ color: 'var(--text-faint)' }} />
                <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{hb.name}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {hb.startTime} - {hb.endTime}
                </span>

                <button
                  onClick={() => handleToggleStrict(hb.id)}
                  style={{
                    background: hb.isStrict ? '#ffffff' : 'transparent',
                    color: hb.isStrict ? '#000000' : 'var(--text-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  {hb.isStrict ? 'Strict' : 'Flexible'}
                </button>

                <button
                  onClick={() => handleDeleteHabit(hb.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
