import React, { useState } from 'react';
import { Clock, Play, Sparkles, AlertTriangle, Lightbulb, CheckCircle2, RotateCcw, CalendarPlus, Moon, Zap, ChevronDown } from 'lucide-react';

const TIP_ICONS = {
  action: Play,
  warning: AlertTriangle,
  insight: Lightbulb,
};

const PACE_LABEL = {
  ON_TRACK: { text: 'On track', color: 'var(--text-secondary)' },
  TIGHT: { text: 'Tight', color: 'var(--warn)' },
  AT_RISK: { text: 'At risk', color: 'var(--danger)' },
};

const VARIANTS = [
  { id: 'A', title: 'Plan A', desc: 'Full plan' },
  { id: 'B', title: 'Plan B', desc: 'Must-dos only' },
  { id: 'C', title: 'Plan C', desc: '45-min minimum' },
];

function formatHours(minutes) {
  return `${(Math.round((minutes / 60) * 10) / 10).toFixed(1)}h`;
}

function TipList({ tips }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {tips.map((tip) => {
        const Icon = TIP_ICONS[tip.kind] || Lightbulb;
        return (
          <div key={tip.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.8rem', color: tip.kind === 'warning' ? 'var(--warn-text)' : 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Icon size={14} style={{ flexShrink: 0, marginTop: '0.2rem', color: tip.kind === 'warning' ? 'var(--warn)' : 'var(--text-muted)' }} />
            <span>{tip.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function SessionCoaching({ coaching }) {
  if (!coaching) return null;
  return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div><strong style={{ color: 'var(--fg)' }}>Start with:</strong> {coaching.starter}</div>
      <div><strong style={{ color: 'var(--fg)' }}>Technique:</strong> {coaching.technique.name} — {coaching.technique.how}</div>
      <div>
        <strong style={{ color: 'var(--fg)' }}>Steps:</strong>
        {coaching.script.map((s, i) => (
          <div key={i} style={{ paddingLeft: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.from}–{s.to}m</span> {s.text}
          </div>
        ))}
      </div>
      {coaching.ifThen.map((t) => <div key={t}>• {t}</div>)}
      {coaching.tips.map((t) => <div key={t} style={{ color: 'var(--text-muted)' }}>• {t}</div>)}
      <div><strong style={{ color: 'var(--fg)' }}>Done when:</strong> {coaching.doneCheck}</div>
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
  onChangePlanVariant,
  onSomethingCameUp,
  onExportCalendar,
  onWrapUpDay,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [showCameUp, setShowCameUp] = useState(false);
  const days = plan?.days || [];
  const day = days[Math.min(selectedDayIdx, days.length - 1)];
  const timelineItems = day?.items || [];
  const feasibility = plan?.feasibility;
  const isToday = day?.dayIndex === 0;

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            Study Plan · Next {days.length} {days.length === 1 ? 'Day' : 'Days'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
            Hard work in peak hours, deadlines finished a day early, leisure protected, missed sessions re-planned automatically.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {feasibility && (
            <div style={{ display: 'flex', gap: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Planned <strong style={{ color: 'var(--fg)' }}>{formatHours(feasibility.scheduledMinutes)}</strong></span>
              <span>Avg/day <strong style={{ color: 'var(--fg)' }}>{formatHours(feasibility.avgDailyFocusMinutes)}</strong></span>
              <span style={{ color: feasibility.status === 'OVERLOADED' ? 'var(--danger)' : feasibility.status === 'TIGHT' ? 'var(--warn)' : 'var(--text-muted)' }}>
                {feasibility.status === 'OVERLOADED' ? 'Overloaded' : feasibility.status === 'TIGHT' ? 'Tight' : 'Feasible'}
              </span>
            </div>
          )}
          {onExportCalendar && (
            <button className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem' }} onClick={onExportCalendar} title="Download .ics for Google/Apple/Outlook Calendar">
              <CalendarPlus size={12} /> Export to calendar
            </button>
          )}
        </div>
      </div>

      {/* Deadline pace */}
      {plan?.pace?.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: '0.25rem' }}>
          {plan.pace.map((p) => {
            const label = PACE_LABEL[p.status] || PACE_LABEL.ON_TRACK;
            return (
              <div key={p.taskId} style={{ flexShrink: 0, minWidth: '190px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.65rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>{p.title}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Due {p.deadline} · {p.daysLeft}d left · {p.progressPct}% done
                </div>
                <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', margin: '0.3rem 0' }}>
                  <div style={{ width: `${Math.min(100, p.progressPct)}%`, height: '100%', background: 'var(--fg)', borderRadius: '2px' }} />
                </div>
                <div style={{ fontSize: '0.68rem', color: label.color }}>
                  {label.text}{p.finishLabel ? ` · finishes ${p.finishLabel}` : ''}{p.shortByMinutes ? ` · short ${formatHours(p.shortByMinutes)}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                background: active ? 'var(--fg)' : 'var(--bg-card-subtle)',
                color: active ? 'var(--fg-inverse)' : 'var(--text-muted)',
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
              <div>{d.shortLabel}{d.mode !== 'FULL' ? ' ·' : ''}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', opacity: 0.8 }}>{formatHours(d.focusMinutes)} focus</div>
              <div style={{ height: '3px', background: active ? 'var(--fg-inverse-muted)' : 'var(--border-subtle)', borderRadius: '2px', marginTop: '0.25rem' }}>
                <div style={{ width: `${loadPct}%`, height: '100%', background: d.load === 'heavy' ? 'var(--danger)' : active ? 'var(--fg-inverse)' : 'var(--fg)', borderRadius: '2px' }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Today controls: backup plans + something came up */}
      {isToday && (onChangePlanVariant || onSomethingCameUp) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {onChangePlanVariant && (
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {VARIANTS.map((v) => {
                const active = (day.planVariant || 'A') === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onChangePlanVariant(v.id)}
                    style={{
                      background: active ? 'var(--fg)' : 'var(--bg-card-subtle)',
                      color: active ? 'var(--fg-inverse)' : 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.35rem 0.65rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{v.title}</div>
                    <div style={{ fontSize: '0.65rem' }}>{v.desc}</div>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {onSomethingCameUp && (
              showCameUp ? (
                <>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Block from now for:</span>
                  {[{ v: 60, l: '1h' }, { v: 120, l: '2h' }, { v: 'afternoon', l: 'Afternoon' }, { v: 'rest', l: 'Rest of day' }].map((o) => (
                    <button key={o.l} className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={() => { onSomethingCameUp(o.v); setShowCameUp(false); }}>
                      {o.l}
                    </button>
                  ))}
                  <button onClick={() => setShowCameUp(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.72rem' }}>cancel</button>
                </>
              ) : (
                <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} onClick={() => setShowCameUp(true)} id="something-came-up-btn">
                  <Zap size={12} /> Something came up
                </button>
              )
            )}
            {onWrapUpDay && (
              <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} onClick={onWrapUpDay}>
                <Moon size={12} /> Wrap up today
              </button>
            )}
          </div>
        </div>
      )}

      {/* Planner insights + AI coach */}
      {(plan?.tips?.length > 0 || onRequestAICoach) && (
        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem 1.15rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--fg)' }}>
              {aiCoach?.tips?.length ? aiCoach.headline || 'AI Study Coach' : 'Planner Insights & Tips'}
            </strong>
            {onRequestAICoach && (
              <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} onClick={onRequestAICoach} disabled={aiCoach?.loading}>
                <Sparkles size={12} />
                <span>{aiCoach?.loading ? 'Reviewing plan…' : aiCoach?.tips?.length ? 'Refresh AI Coach' : 'Ask AI Coach'}</span>
              </button>
            )}
          </div>
          {aiCoach?.error && <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>{aiCoach.error}</div>}
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
            const isDone = item.status === 'COMPLETED';
            const isCurrent = isTask && item.id === currentSessionId && isToday;
            const expanded = expandedId === item.id;
            const quiet = item.isBreak || ['LEISURE', 'WIND_DOWN', 'FLEX', 'OFF'].includes(item.type);

            return (
              <div
                key={item.id || idx}
                style={{
                  padding: quiet ? '0.4rem 1rem' : '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isTask ? 'var(--bg-card-subtle)' : 'transparent',
                  border: isCurrent ? '1px solid var(--fg)' : '1px solid var(--border-subtle)',
                  opacity: isDone ? 0.5 : quiet ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: '110px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: quiet ? '0.75rem' : '0.825rem', color: 'var(--fg)' }}>
                    <Clock size={13} style={{ color: 'var(--text-faint)' }} />
                    <span>{item.startTime} - {item.endTime}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: quiet ? '0.78rem' : '0.9rem', fontWeight: quiet ? 500 : 600, color: quiet ? 'var(--text-muted)' : 'var(--fg)', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {item.title || item.taskTitle}
                      </span>
                      {item.mustDo && <span className="badge" style={{ fontSize: '0.68rem' }}>Must-do</span>}
                      {item.quadrant && <span className="badge" style={{ fontSize: '0.68rem' }}>{item.quadrant}</span>}
                      {item.kind === 'REVIEW' && (
                        <span className="badge" style={{ fontSize: '0.68rem' }}>
                          <RotateCcw size={10} /> Recall
                        </span>
                      )}
                      {item.subject && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.subject}</span>}
                      {item.isDecompression && <span className="badge" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>20m Rest Buffer</span>}
                      {item.location && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {item.location}</span>}
                    </div>

                    {isTask && item.reason && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                        {item.reason} · {item.rawDuration}m work + {item.bufferMinutes}m buffer
                      </div>
                    )}
                  </div>

                  {isTask && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', color: 'var(--text-muted)', padding: '0.25rem 0.55rem', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        How to <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
                      </button>
                      {isDone && <CheckCircle2 size={16} style={{ color: 'var(--text-muted)' }} />}
                      {!isDone && isToday && (
                        <button className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => onStartFocus(item)}>
                          <Play size={12} fill="currentColor" />
                          <span>{isCurrent ? 'Now' : 'Focus'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isTask && expanded && <SessionCoaching coaching={item.coaching} />}
              </div>
            );
          })
        )}
      </div>

      {plan?.unscheduled?.length > 0 && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '0.4rem' }}>Didn't fit in this window</div>
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
