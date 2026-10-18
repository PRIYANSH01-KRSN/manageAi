import React, { useState } from 'react';
import { Play, Check, Feather, CalendarX, ArrowRight, Heart, Scissors, Target, CheckCircle2 } from 'lucide-react';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' };
const fmtDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

// Nearest upcoming exam/deadline across the student's tasks.
function nearestDeadline(tasks, todayKey) {
  const upcoming = tasks
    .filter((t) => t.deadline && t.deadline >= todayKey)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  if (!upcoming.length) return null;
  const t = upcoming[0];
  const days = Math.round((new Date(`${t.deadline}T00:00:00`) - new Date(`${todayKey}T00:00:00`)) / 86400000);
  return { days, date: t.deadline, label: t.subject || t.meta?.groupTitle || t.title };
}

export function TodayScreen({
  plan,
  tasks = [],
  currentBlock,
  todayKey,
  daysAwayCount = 0,
  triage,
  onStart,
  onDone,
  onEasier,
  onCantToday,
  onApplyTriage,
  onDismissWelcome,
  onSeeFullPlan,
  onBattlePlan,
  onBreakDown,
}) {
  const [cantOpen, setCantOpen] = useState(false);
  const deadline = nearestDeadline(tasks, todayKey);
  const today = plan?.days?.[0];
  const todaySessions = today?.sessions || [];
  const doneCount = todaySessions.filter((s) => s.status === 'COMPLETED').length;
  const remaining = todaySessions.filter((s) => s.status !== 'COMPLETED' && s.id !== currentBlock?.id);
  const tomorrowFirst = plan?.days?.[1]?.sessions?.[0];
  const showTriage = triage?.needed && triage.changes.length > 0;

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto 2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Welcome back after missed days — no guilt, just the new reality */}
      {daysAwayCount > 0 && (
        <div style={{ ...card, display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Heart size={20} style={{ flexShrink: 0, marginTop: '0.15rem', color: 'var(--fg)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--fg)' }}>Welcome back.</div>
            <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '0.2rem' }}>
              You were away {daysAwayCount === 1 ? 'a day' : `${daysAwayCount} days`} — that happens. Nothing to catch up on: your plan has been rebuilt around the days you have left.{' '}
              {showTriage ? 'A few things need trimming to fit — see below.' : deadline ? 'You are still on track.' : ''}
            </div>
          </div>
          <button onClick={onDismissWelcome} className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>Got it</button>
        </div>
      )}

      {/* Days left */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', padding: '0 0.25rem' }}>
        {deadline ? (
          <div>
            <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--fg)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{deadline.days}</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--fg)', marginLeft: '0.5rem' }}>
              {deadline.days === 0 ? 'Exam day — you’ve got this' : deadline.days === 1 ? 'day left' : 'days left'}
            </span>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              until {deadline.label} · {fmtDate(deadline.date)}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--fg)' }}>Today</div>
            {tasks.length > 0 && (
              <button onClick={onBattlePlan} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.88rem' }}>
                Have an exam coming? Add the date →
              </button>
            )}
          </div>
        )}
        {todaySessions.length > 0 && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {doneCount}/{todaySessions.length} done today
          </div>
        )}
      </div>

      {/* Do this now */}
      {currentBlock ? (
        <div style={{ ...card, border: '2px solid var(--fg)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
            Do this now
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--fg)', lineHeight: 1.25, marginBottom: '0.35rem' }}>{currentBlock.taskTitle}</div>
          <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {currentBlock.rawDuration} minutes{currentBlock.subject ? ` · ${currentBlock.subject}` : ''}
          </div>
          {currentBlock.coaching?.starter && (
            <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.1rem', fontSize: '0.95rem', color: 'var(--fg)', lineHeight: 1.5 }}>
              <strong>First 2 minutes:</strong> {currentBlock.coaching.starter}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => onStart(currentBlock)} style={{ padding: '0.8rem 1.6rem', fontSize: '1rem' }} id="today-start-btn">
              <Play size={17} fill="currentColor" /> Start
            </button>
            <button className="btn-secondary" onClick={() => onDone(currentBlock)} style={{ padding: '0.8rem 1.2rem', fontSize: '0.95rem' }} id="today-done-btn">
              <Check size={16} /> Done
            </button>
            <button className="btn-secondary" onClick={() => setCantOpen(!cantOpen)} style={{ padding: '0.8rem 1.2rem', fontSize: '0.95rem' }} id="today-cant-btn">
              Not now
            </button>
          </div>
          {cantOpen && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
              <button className="btn-secondary" onClick={() => { setCantOpen(false); onEasier(); }}>
                <Feather size={14} /> Give me something easier
              </button>
              <button className="btn-secondary" onClick={() => { setCantOpen(false); onCantToday(); }}>
                <CalendarX size={14} /> I can't study today — re-plan it
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={card}>
          {tasks.length === 0 ? (
            <>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--fg)', marginBottom: '0.35rem' }}>What's coming up?</div>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>Tell us once — we'll tell you exactly what to do, every day.</div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={onBattlePlan} style={{ padding: '0.75rem 1.3rem' }}>
                  <Target size={16} /> I have an exam
                </button>
                <button className="btn-secondary" onClick={onBreakDown} style={{ padding: '0.75rem 1.3rem' }}>
                  <Scissors size={16} /> I have lectures to cover
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.3rem', fontWeight: 800, color: 'var(--fg)' }}>
                <CheckCircle2 size={22} /> {todaySessions.length ? "That's today done." : 'Nothing scheduled for right now.'}
              </div>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {tomorrowFirst ? <>Tomorrow starts with <strong style={{ color: 'var(--fg)' }}>{tomorrowFirst.taskTitle}</strong> at {tomorrowFirst.startTime}. Rest well.</> : 'Rest well — you earned it.'}
              </div>
            </>
          )}
        </div>
      )}

      {/* Anti-fragile triage when the plan no longer fits */}
      {showTriage && (
        <div style={card}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--fg)', marginBottom: '0.3rem' }}>Let's make it fit</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '0.75rem' }}>
            About {Math.round(triage.shortMinutes / 6) / 10}h of work no longer fits before your deadline. Here's the smallest change that protects your most valuable topics:
          </div>
          <ul style={{ margin: '0 0 0.9rem 1.1rem', padding: 0, fontSize: '0.9rem', color: 'var(--fg)', lineHeight: 1.6 }}>
            {triage.changes.slice(0, 6).map((c) => (
              <li key={c.id}>
                {c.action === 'core' ? 'Keep just the core of ' : 'Skip '}
                <strong>{c.title}</strong>
                <span style={{ color: 'var(--text-secondary)' }}> (saves {c.saveMinutes} min)</span>
              </li>
            ))}
            {triage.changes.length > 6 && <li style={{ color: 'var(--text-secondary)' }}>…and {triage.changes.length - 6} more small cuts</li>}
          </ul>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.9rem' }}>
            This is the smart call, not giving up — your time goes where it wins the most marks.
          </div>
          <button className="btn-primary" onClick={onApplyTriage} id="apply-triage-btn">
            Make it fit
          </button>
        </div>
      )}

      {/* Later today — one line, no clutter */}
      {remaining.length > 0 && (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0 0.25rem' }}>
          Later today: {remaining.length} more {remaining.length === 1 ? 'step' : 'steps'} · done by ~{remaining[remaining.length - 1].endTime}
        </div>
      )}

      <button onClick={onSeeFullPlan} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: '0 0.25rem', color: 'var(--fg)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.92rem', fontWeight: 600 }} id="see-full-plan-btn">
        See the full plan <ArrowRight size={14} style={{ verticalAlign: '-2px' }} />
      </button>
    </div>
  );
}
