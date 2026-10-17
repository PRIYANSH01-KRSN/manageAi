import React from 'react';
import { Clock, Play } from 'lucide-react';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

export function ScheduleTimeline({ 
  timelineItems = [], 
  activeDay, 
  setActiveDay,
  onStartFocus
}) {
  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      {/* Header and Day Picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Daily Master Schedule
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
            Calculated by energy curves, mandatory decompression buffers, and distraction factor.
          </p>
        </div>

        {/* Day Selector */}
        <div style={{ display: 'flex', background: 'var(--bg-card-subtle)', padding: '0.2rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', gap: '0.2rem' }}>
          {DAYS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDay(d.id)}
              style={{
                background: activeDay === d.id ? '#ffffff' : 'transparent',
                color: activeDay === d.id ? '#000000' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {d.name.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {timelineItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
            No events or blocks scheduled for this day.
          </div>
        ) : (
          timelineItems.map((item, idx) => {
            const isTask = !item.isFixed && !item.isBreak;
            const isDecompression = item.isDecompression;

            return (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isTask ? 'var(--bg-card-subtle)' : 'transparent',
                  border: '1px solid var(--border-subtle)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Time Badge */}
                <div style={{ minWidth: '110px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.825rem', color: '#ffffff' }}>
                  <Clock size={13} style={{ color: 'var(--text-faint)' }} />
                  <span>{item.startTime} - {item.endTime}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                      {item.title || item.taskTitle}
                    </span>

                    {item.quadrant && (
                      <span className="badge" style={{ fontSize: '0.68rem' }}>
                        {item.quadrant}
                      </span>
                    )}

                    {isDecompression && (
                      <span className="badge" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        20m Rest Buffer
                      </span>
                    )}

                    {item.location && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        • {item.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Focus Button if actionable task */}
                {isTask && (
                  <button
                    className="btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => onStartFocus(item)}
                  >
                    <Play size={12} fill="black" />
                    <span>Focus</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
