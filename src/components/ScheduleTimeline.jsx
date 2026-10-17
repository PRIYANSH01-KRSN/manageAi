import React from 'react';
import { Clock, Play, Sparkles, AlertTriangle, Lightbulb, CheckCircle2, RotateCcw } from 'lucide-react';

const TIP_ICONS = {
  action: Play,
  warning: AlertTriangle,
  insight: Lightbulb,
};

function formatHours(minutes) {
  return `${(Math.round((minutes / 60) * 10) / 10).toFixed(1)}h`;
}

function TipList({ tips }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {tips.map((tip) => {
        const Icon = TIP_ICONS[tip.kind] || Lightbulb;
        return (
          <div key={tip.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.8rem', color: tip.kind === 'warning' ? '#fde68a' : 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Icon size={14} style={{ flexShrink: 0, marginTop: '0.2rem', color: tip.kind === 'warning' ? '#f59e0b' : 'var(--text-muted)' }} />
            <span>{tip.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ScheduleTimeline({
  plan,
  selectedDayIdx = 0,
  setSelectedDayIdx,
  currentSessionId,
  aiCoach,
  onRequestAICoach,
  onStartFocus,
}) {
  const days = plan?.days || [];
  const day = days[Math.min(selectedDayIdx, days.length - 1)];
  const timelineItems = day?.items || [];
  const feasibility = plan?.feasibility;

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      {/* Header and Day Picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Study Plan · Next {days.length} {days.length === 1 ? 'Day' : 'Days'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
            Hard work goes to your peak hours, deadlines are finished a day early, and missed sessions re-plan themselves.
          </p>
        </div>

        {feasibility && (
          <div style={{ display: 'flex', gap: '1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Planned <strong style={{ color: '#ffffff' }}>{formatHours(feasibility.scheduledMinutes)}</strong></span>
            <span>Avg/day <strong style={{ color: '#ffffff' }}>{formatHours(feasibility.avgDailyFocusMinutes)}</strong></span>
            <span style={{ color: feasibility.status === 'OVERLOADED' ? '#f87171' : feasibility.status === 'TIGHT' ? '#fbbf24' : 'var(--text-muted)' }}>
              {feasibility.status === 'OVERLOADED' ? 'Overloaded' : feasibility.status === 'TIGHT' ? 'Tight' : 'Feasible'}
            </span>
          </div>
        )}
      </div>

      {/* Day Selector with daily load */}
      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.35rem', marginBottom: '1.25rem' }}>
        {days.map((d) => {
          const active = d.dayIndex === day?.dayIndex;
          const loadPct = Math.min(100, Math.round((d.focusMinutes / (feasibility?.dailyCapMinutes || 300)) * 100));
          return (
            <button
              key={d.dateKey}
              onClick={() => setSelectedDayIdx(d.dayIndex)}
              style={{
                minWidth: '78px',
                background: active ? '#ffffff' : 'var(--bg-card-subtle)',
                color: active ? '#000000' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.4rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                flexShrink: 0,
              }}
            >
              <div>{d.shortLabel}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', opacity: 0.8 }}>{formatHours(d.focusMinutes)} focus</div>
              <div style={{ height: '3px', background: active ? '#d4d4d8' : 'var(--border-subtle)', borderRadius: '2px', marginTop: '0.25rem' }}>
                <div style={{ width: `${loadPct}%`, height: '100%', background: d.load === 'heavy' ? '#f87171' : active ? '#000000' : '#ffffff', borderRadius: '2px' }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Planner insights + AI coach */}
      {(plan?.tips?.length > 0 || onRequestAICoach) && (
        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem 1.15rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>
              {aiCoach?.tips?.length ? aiCoach.headline || 'AI Study Coach' : 'Planner Insights & Tips'}
            </strong>
            {onRequestAICoach && (
              <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} onClick={onRequestAICoach} disabled={aiCoach?.loading}>
                <Sparkles size={12} />
                <span>{aiCoach?.loading ? 'Reviewing plan…' : aiCoach?.tips?.length ? 'Refresh AI Coach' : 'Ask AI Coach'}</span>
              </button>
            )}
          </div>
          {aiCoach?.error && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>{aiCoach.error}</div>
          )}
          <TipList tips={aiCoach?.tips?.length ? aiCoach.tips : plan?.tips || []} />
        </div>
      )}

      {/* Timeline Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {timelineItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
            Nothing planned for this day. Add tasks in the Backlog tab to generate a plan.
          </div>
        ) : (
          timelineItems.map((item, idx) => {
            const isTask = !item.isFixed && !item.isBreak;
            const isDecompression = item.isDecompression;
            const isDone = item.status === 'COMPLETED';
            const isCurrent = isTask && item.id === currentSessionId && day?.dayIndex === 0;

            return (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: item.isBreak ? '0.4rem 1rem' : '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isTask ? 'var(--bg-card-subtle)' : 'transparent',
                  border: isCurrent ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  opacity: isDone ? 0.5 : item.isBreak ? 0.7 : 1,
                }}
              >
                {/* Time Badge */}
                <div style={{ minWidth: '110px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: item.isBreak ? '0.75rem' : '0.825rem', color: '#ffffff' }}>
                  <Clock size={13} style={{ color: 'var(--text-faint)' }} />
                  <span>{item.startTime} - {item.endTime}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: item.isBreak ? '0.78rem' : '0.9rem', fontWeight: item.isBreak ? 500 : 600, color: item.isBreak ? 'var(--text-muted)' : '#ffffff', textDecoration: isDone ? 'line-through' : 'none' }}>
                      {item.title || item.taskTitle}
                    </span>

                    {item.quadrant && (
                      <span className="badge" style={{ fontSize: '0.68rem' }}>
                        {item.quadrant}
                      </span>
                    )}

                    {item.kind === 'REVIEW' && (
                      <span className="badge" style={{ fontSize: '0.68rem' }}>
                        <RotateCcw size={10} /> Recall
                      </span>
                    )}

                    {item.subject && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.subject}</span>
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

                  {isTask && item.reason && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                      {item.reason} · {item.rawDuration}m work + {item.bufferMinutes}m buffer
                    </div>
                  )}
                </div>

                {/* Focus Button if actionable task (only today's sessions can be started) */}
                {isTask && isDone && <CheckCircle2 size={16} style={{ color: 'var(--text-muted)' }} />}
                {isTask && !isDone && day?.dayIndex === 0 && (
                  <button
                    className="btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => onStartFocus(item)}
                  >
                    <Play size={12} fill="black" />
                    <span>{isCurrent ? 'Now' : 'Focus'}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {plan?.unscheduled?.length > 0 && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem' }}>
            Didn't fit in this window
          </div>
          {plan.unscheduled.map((u) => (
            <div key={u.taskId} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              • {u.title} — {formatHours(u.minutes)} left ({u.reason})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
