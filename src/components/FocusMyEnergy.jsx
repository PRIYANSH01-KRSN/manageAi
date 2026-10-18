import React, { useMemo, useState } from 'react';
import { Battery, Play, Clock, Lightbulb, ChevronDown, Sliders, Zap } from 'lucide-react';
import { ENERGY_LEVELS, TIERS, JUST_FINISHED, inferEnergy, recommendForEnergy, energyPatterns } from '../services/energyMatcher';

const card = { background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem 1.15rem' };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY_PROFILE = { peakStart: '', peakEnd: '', dipStart: '', dipEnd: '', secondWindStart: '', secondWindEnd: '', slowDays: [], drains: '', boosts: '' };

function SectionLabel({ children }) {
  return <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.45rem' }}>{children}</div>;
}

function TimeRange({ label, hint, startKey, endKey, profile, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600 }}>{label}</label>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: '0.3rem' }}>{hint}</div>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        <input type="time" className="input-field" value={profile[startKey]} onChange={(e) => onChange(startKey, e.target.value)} />
        <span style={{ color: 'var(--text-faint)' }}>–</span>
        <input type="time" className="input-field" value={profile[endKey]} onChange={(e) => onChange(endKey, e.target.value)} />
      </div>
    </div>
  );
}

export function FocusMyEnergy({ tasks = [], userHabits = {}, todayContext, learnedFatigueHours = [], now, onLogEnergy, onSaveProfile, onStartTask }) {
  const [after, setAfter] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [draft, setDraft] = useState(() => ({ ...EMPTY_PROFILE, ...(userHabits.energyProfile || {}) }));
  const [inviteDismissed, setInviteDismissed] = useState(() => {
    try {
      return localStorage.getItem('cf_energy_profile_invite') === 'dismissed';
    } catch {
      return false;
    }
  });

  const profile = userHabits.energyProfile || null;
  const log = useMemo(() => userHabits.energyLog || [], [userHabits.energyLog]);
  const latestReport = log[0];

  const energy = useMemo(
    () => inferEnergy({ latestReport, profile, checkin: todayContext, chronotype: userHabits.chronotype, fatigueHours: learnedFatigueHours, now }),
    [latestReport, profile, todayContext, userHabits.chronotype, learnedFatigueHours, now]
  );
  const rec = useMemo(() => recommendForEnergy({ tasks, energy, profile, chronotype: userHabits.chronotype, now }), [tasks, energy, profile, userHabits.chronotype, now]);
  const insights = useMemo(() => energyPatterns(log, profile), [log, profile]);
  const level = ENERGY_LEVELS[energy.level];
  const hasProfile = Boolean(profile && (profile.peakStart || profile.dipStart || profile.secondWindStart || profile.slowDays?.length || profile.drains || profile.boosts));

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleSlowDay = (d) => setDraft((p) => ({ ...p, slowDays: p.slowDays.includes(d) ? p.slowDays.filter((x) => x !== d) : [...p.slowDays, d] }));
  const dismissInvite = () => {
    setInviteDismissed(true);
    try {
      localStorage.setItem('cf_energy_profile_invite', 'dismissed');
    } catch {
      // ignore
    }
  };

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Battery size={20} /> Focus My Energy
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
          Do the right task at the right time — match your work to how you actually feel, not just what's due next.
        </p>
      </div>

      {/* Step 1: how are you feeling */}
      <div style={{ ...card, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 700, marginBottom: '0.75rem' }}>How are you feeling right now?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
          {Object.values(ENERGY_LEVELS).map((l) => {
            const active = energy.level === l.id && energy.source === 'self';
            return (
              <button
                key={l.id}
                onClick={() => onLogEnergy(l.id, after)}
                id={`energy-${l.id.toLowerCase()}-btn`}
                style={{
                  padding: '0.85rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: active ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                  background: active ? '#ffffff' : 'var(--bg-card)',
                  color: active ? '#000000' : '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                }}
              >
                {l.emoji} {l.label.charAt(0).toUpperCase() + l.label.slice(1)}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Just finished (optional):</span>
          {JUST_FINISHED.map((j) => (
            <button
              key={j.id}
              onClick={() => setAfter(after === j.id ? null : j.id)}
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                background: after === j.id ? '#ffffff' : 'transparent',
                color: after === j.id ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.72rem',
              }}
            >
              {j.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.5 }}>
          {level.emoji} <strong style={{ color: '#ffffff' }}>Treating you as {level.label}.</strong> {energy.reason}
        </div>
      </div>

      {/* Optional energy profile invite — shown once */}
      {!hasProfile && !inviteDismissed && !showProfile && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Want to set up your energy profile? Tell me your natural rhythms and I'll use them as a baseline instead of guessing.
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setShowProfile(true)}>Set it up</button>
            <button className="btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} onClick={dismissInvite}>Not now</button>
          </div>
        </div>
      )}

      {/* Step 3: recommendation */}
      {rec.empty ? (
        <div style={{ ...card, marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rec.message}</div>
      ) : (
        <>
          <div style={{ ...card, border: '1px solid #ffffff', marginBottom: '1.25rem' }}>
            <SectionLabel>⚡ You're {level.label} — do now</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.3rem' }}>
                  {TIERS[rec.doNow.tier].icon} {rec.doNow.task.title}
                </div>
                <div style={{ fontSize: '0.82rem', color: rec.doNow.deadlineOverride ? '#fde68a' : 'var(--text-secondary)', lineHeight: 1.5 }}>{rec.doNow.why}</div>
                {energy.level === 'FRIED' && profile?.boosts && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    <Zap size={12} /> Before you start, one of your boosts might help: {profile.boosts}.
                  </div>
                )}
              </div>
              <button className="btn-primary" onClick={() => onStartTask(rec.doNow.task, rec.doNow.minutes)} id="energy-start-btn">
                <Play size={14} fill="black" /> Start {rec.doNow.minutes} min
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={card}>
              <SectionLabel>Save for later</SectionLabel>
              {rec.saveForLater.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Nothing needs more energy than you have right now.</div>
              ) : (
                rec.saveForLater.map((s) => (
                  <div key={s.task.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', lineHeight: 1.45 }}>
                    {TIERS[s.tier].icon} <strong style={{ color: '#ffffff' }}>{s.task.title}</strong> — {s.why}
                  </div>
                ))
              )}
            </div>
            <div style={card}>
              <SectionLabel>Quick wins (easy momentum)</SectionLabel>
              {rec.quickWins.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>No quick tasks on your list.</div>
              ) : (
                rec.quickWins.map((q) => (
                  <div key={q.task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    <span>{TIERS[q.tier].icon} {q.task.title} <span style={{ color: 'var(--text-faint)' }}>· {q.minutes} min, low effort</span></span>
                    <button className="btn-secondary" style={{ padding: '0.2rem 0.55rem', fontSize: '0.7rem' }} onClick={() => onStartTask(q.task, q.minutes)}>Do it</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Step 2: tiers */}
          <SectionLabel>Your tasks by mental demand</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {Object.values(TIERS).map((t) => (
              <div key={t.id} style={card}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>{t.icon} {t.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: '0.45rem' }}>Needs {t.needs}</div>
                {rec.tiers[t.id].length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>—</div>
                ) : (
                  rec.tiers[t.id].map((c) => (
                    <div key={c.task.id} title={c.reason} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span>{c.task.title}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-faint)', flexShrink: 0 }}><Clock size={10} /> {c.remaining}m</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Step 4: patterns */}
      {insights.length > 0 && (
        <div style={{ ...card, marginBottom: '1.25rem' }}>
          <SectionLabel>Patterns I've noticed</SectionLabel>
          {insights.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', lineHeight: 1.45 }}>
              <Lightbulb size={13} style={{ flexShrink: 0, marginTop: '0.2rem' }} /> {i.text}
            </div>
          ))}
        </div>
      )}

      {/* Energy profile */}
      <div style={card}>
        <button onClick={() => setShowProfile(!showProfile)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: '0.88rem', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sliders size={14} /> 🔋 My energy profile {hasProfile ? '' : '(optional)'}
          </span>
          <ChevronDown size={16} style={{ transform: showProfile ? 'rotate(180deg)' : 'none' }} />
        </button>
        {showProfile && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Fill in as much or as little as you like. It's a baseline, not a cage — how you say you feel always wins. Your profile also shapes where the planner puts hard sessions.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
              <TimeRange label="Peak hours" hint="When are you sharpest?" startKey="peakStart" endKey="peakEnd" profile={draft} onChange={setField} />
              <TimeRange label="Dip window" hint="When do you reliably crash?" startKey="dipStart" endKey="dipEnd" profile={draft} onChange={setField} />
              <TimeRange label="Second wind" hint="A late-day surge? Leave empty if not." startKey="secondWindStart" endKey="secondWindEnd" profile={draft} onChange={setField} />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.3rem' }}>Slow-start days (mornings are sluggish)</label>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleSlowDay(i)}
                    style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', background: draft.slowDays.includes(i) ? '#ffffff' : 'transparent', color: draft.slowDays.includes(i) ? '#000000' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem' }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.3rem' }}>Energy drains</label>
                <input className="input-field" placeholder="e.g. back-to-back classes, long calls, context-switching" value={draft.drains} onChange={(e) => setField('drains', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.3rem' }}>Energy boosts</label>
                <input className="input-field" placeholder="e.g. a walk, music, a good lunch" value={draft.boosts} onChange={(e) => setField('boosts', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setDraft({ ...EMPTY_PROFILE })}>Clear</button>
              <button
                className="btn-primary"
                id="save-energy-profile-btn"
                onClick={() => {
                  onSaveProfile(draft);
                  setShowProfile(false);
                }}
              >
                Save profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
