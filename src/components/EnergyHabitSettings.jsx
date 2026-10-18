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
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
          Habits & Circadian Rhythms
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
          Configures your wake/sleep boundaries, circadian peak windows, and protected routines.
        </p>
      </div>

      {/* Chronotypes */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '0.75rem' }}>
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
                  background: isSelected ? 'var(--fg)' : 'var(--bg-card-subtle)',
                  color: isSelected ? 'var(--fg-inverse)' : 'var(--text-primary)',
                  border: isSelected ? '1px solid var(--fg)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  {chrono.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: isSelected ? 'var(--fg-inverse-muted)' : 'var(--text-muted)' }}>
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
          <input type="range" min="1.0" max="1.5" step="0.05" value={userHabits.distractionFactor || 1.25} onChange={(e) => handleBufferChange(e.target.value)} style={{ width: '100%', accentColor: 'var(--fg)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Daily Focus Cap: {((userHabits.dailyFocusCapMinutes || 300) / 60).toFixed(1)}h of real study
          </label>
          <input type="range" min="60" max="540" step="30" value={userHabits.dailyFocusCapMinutes || 300} onChange={(e) => onUpdateHabits({ ...userHabits, dailyFocusCapMinutes: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--fg)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Session Style</label>
          <select className="input-field" value={userHabits.sessionStyle || 'pomodoro'} onChange={(e) => onUpdateHabits({ ...userHabits, sessionStyle: e.target.value })}>
            <option value="pomodoro">Short sprints (25–30 min)</option>
            <option value="deep">Deep work (45–50 min)</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Protected Leisure: {userHabits.leisureMinutes ?? 60} min/day
          </label>
          <input type="range" min="0" max="180" step="15" value={userHabits.leisureMinutes ?? 60} onChange={(e) => onUpdateHabits({ ...userHabits, leisureMinutes: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--fg)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Leisure Time</label>
          <select className="input-field" value={userHabits.leisureTime || 'evening'} onChange={(e) => onUpdateHabits({ ...userHabits, leisureTime: e.target.value })}>
            <option value="evening">Evening (before wind-down)</option>
            <option value="afternoon">Late afternoon (from 17:00)</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Wind-down Before Bed: {userHabits.windDownMinutes ?? 45} min
          </label>
          <input type="range" min="0" max="90" step="15" value={userHabits.windDownMinutes ?? 45} onChange={(e) => onUpdateHabits({ ...userHabits, windDownMinutes: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--fg)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Flex Reserve: {userHabits.flexPercent ?? 15}% of study time
          </label>
          <input type="range" min="0" max="30" step="5" value={userHabits.flexPercent ?? 15} onChange={(e) => onUpdateHabits({ ...userHabits, flexPercent: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--fg)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Weekly Half-Day Off</label>
          <select className="input-field" value={userHabits.weeklyOffDay ?? ''} onChange={(e) => onUpdateHabits({ ...userHabits, weeklyOffDay: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">None</option>
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
              <option key={d} value={i}>{d} afternoon</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Weekend Wake / Sleep</label>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <input type="time" className="input-field" value={userHabits.weekendWakeTime || ''} onChange={(e) => onUpdateHabits({ ...userHabits, weekendWakeTime: e.target.value })} />
            <input type="time" className="input-field" value={userHabits.weekendSleepTime || ''} onChange={(e) => onUpdateHabits({ ...userHabits, weekendSleepTime: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Session Reminders</label>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%' }}
            onClick={async () => {
              if (!userHabits.remindersEnabled && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                const result = await Notification.requestPermission().catch(() => 'denied');
                if (result !== 'granted') return;
              }
              onUpdateHabits({ ...userHabits, remindersEnabled: !userHabits.remindersEnabled });
            }}
          >
            {userHabits.remindersEnabled ? 'On — 5 min before each session' : 'Turn on browser reminders'}
          </button>
        </div>
      </div>

      {/* Blocked Daily Habits */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '0.75rem' }}>
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
                <strong style={{ fontSize: '0.85rem', color: 'var(--fg)' }}>{hb.name}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {hb.startTime} - {hb.endTime}
                </span>

                <button
                  onClick={() => handleToggleStrict(hb.id)}
                  style={{
                    background: hb.isStrict ? 'var(--fg)' : 'transparent',
                    color: hb.isStrict ? 'var(--fg-inverse)' : 'var(--text-muted)',
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
