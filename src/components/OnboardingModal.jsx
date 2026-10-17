import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Sun, Moon } from 'lucide-react';

export function OnboardingModal({ isOpen, onClose, onSaveRoutine }) {
  const [step, setStep] = useState(1);

  // Diagnostic questionnaire states
  const [wakeTime, setWakeTime] = useState('07:30');
  const [sleepTime, setSleepTime] = useState('23:30');
  const [chronotype, setChronotype] = useState('BALANCED');
  const [distractionLevel, setDistractionLevel] = useState('medium'); // low (1.15), medium (1.25), high (1.40)
  const [sessionStyle, setSessionStyle] = useState('pomodoro'); // pomodoro (25-30m), deep (45-60m)
  
  // Daily fixed habits
  const [includeLunch, setIncludeLunch] = useState(true);
  const [includeDinner, setIncludeDinner] = useState(true);
  const [includeExercise, setIncludeExercise] = useState(false);
  const [dailyCommuteMinutes] = useState(30);
  const [leisureMinutes, setLeisureMinutes] = useState(60);

  if (!isOpen) return null;

  const handleFinish = () => {
    let factor = 1.25;
    if (distractionLevel === 'low') factor = 1.15;
    if (distractionLevel === 'high') factor = 1.40;

    const habits = [];
    if (includeLunch) {
      habits.push({ id: `h-lunch-${Date.now()}`, name: 'Lunch & Screen Break', startTime: '13:00', endTime: '14:00', isStrict: true });
    }
    if (includeDinner) {
      habits.push({ id: `h-dinner-${Date.now()}`, name: 'Dinner & Downtime', startTime: '19:30', endTime: '20:30', isStrict: true });
    }
    if (includeExercise) {
      habits.push({ id: `h-gym-${Date.now()}`, name: 'Workout / Physical Recharge', startTime: '17:30', endTime: '18:30', isStrict: false });
    }
    if (dailyCommuteMinutes > 0) {
      habits.push({ id: `h-commute-${Date.now()}`, name: 'Commute / Travel Buffer', startTime: '08:30', endTime: '09:00', isStrict: true });
    }

    onSaveRoutine({
      wakeTime,
      sleepTime,
      chronotype,
      distractionFactor: factor,
      sessionStyle,
      leisureMinutes,
      habits,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '600px', padding: '2.25rem' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          id="close-onboarding-btn"
        >
          <X size={18} />
        </button>

        {/* Progress Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '9999px',
                background: s <= step ? '#ffffff' : 'var(--border-subtle)',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* STEP 1: Sleep & Wake Cycle */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Step 1 of 4 • Circadian Foundation
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              What is your natural sleep & wake routine?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1.5rem' }}>
              The scheduler strictly protects your sleep boundaries. We will never schedule work into these hours unless a critical deadline explicitly demands Crunch Mode.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  <Sun size={15} /> Natural Wake Time
                </div>
                <input
                  type="time"
                  className="input-field"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  <Moon size={15} /> Usual Bedtime
                </div>
                <input
                  type="time"
                  className="input-field"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Chronotype & Focus Rhythm */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Step 2 of 4 • Biological Peak
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              When is your mental stamina at its highest?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1.5rem' }}>
              We map your toughest analytical and high-yield problems to your biological peak.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { id: 'MORNING_LARK', title: 'Early Morning Lark 🌅', desc: 'Sharpest focus between 08:00 - 12:30. Afternoon slump around 14:00.' },
                { id: 'BALANCED', title: 'Balanced Flow ⚡', desc: 'Peak focus mid-morning (10:00 - 13:00) and secondary evening peak (16:30 - 19:30).' },
                { id: 'NIGHT_OWL', title: 'Night Owl 🦉', desc: 'Slow morning bootup. High nocturnal creativity & deep focus after 18:00.' },
              ].map((c) => (
                <div
                  key={c.id}
                  onClick={() => setChronotype(c.id)}
                  style={{
                    padding: '1rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    background: chronotype === c.id ? '#ffffff' : 'var(--bg-card-subtle)',
                    color: chronotype === c.id ? '#000000' : '#ffffff',
                    border: chronotype === c.id ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{c.title}</div>
                  <div style={{ fontSize: '0.75rem', color: chronotype === c.id ? '#3f3f46' : 'var(--text-muted)' }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Fixed Commitments & Meals */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Step 3 of 4 • Daily Life Architecture
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Which daily non-negotiables should we protect?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1.5rem' }}>
              Select routines to shield from academic/work tasks so you don't burn out.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                <div>
                  <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>Lunch & Screen Break (13:00 - 14:00)</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Preserves mid-day mental recovery</div>
                </div>
                <input type="checkbox" checked={includeLunch} onChange={(e) => setIncludeLunch(e.target.checked)} style={{ accentColor: '#ffffff', width: '16px', height: '16px' }} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                <div>
                  <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>Dinner & Evening Wind-Down (19:30 - 20:30)</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Guarantees a clean break before bed</div>
                </div>
                <input type="checkbox" checked={includeDinner} onChange={(e) => setIncludeDinner(e.target.checked)} style={{ accentColor: '#ffffff', width: '16px', height: '16px' }} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                <div>
                  <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>Exercise / Gym / Walk (17:30 - 18:30)</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Physical stamina restoration window</div>
                </div>
                <input type="checkbox" checked={includeExercise} onChange={(e) => setIncludeExercise(e.target.checked)} style={{ accentColor: '#ffffff', width: '16px', height: '16px' }} />
              </label>

              <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>Guilt-free leisure every day: {leisureMinutes} min</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.4rem' }}>Games, shows, friends — planned and protected, so rest never feels "stolen"</div>
                <input type="range" min="0" max="180" step="15" value={leisureMinutes} onChange={(e) => setLeisureMinutes(Number(e.target.value))} style={{ width: '100%', accentColor: '#ffffff' }} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Distraction Tolerance & Work Style */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Step 4 of 4 • Realistic Calibration
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              How easily do you get pulled away?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1.5rem' }}>
              ChronosFlow automatically adds realistic buffers to prevent schedule collapse when distractions happen.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { id: 'low', title: 'Low', buffer: '+15%', desc: 'Highly disciplined, rare interruptions' },
                { id: 'medium', title: 'Moderate', buffer: '+25%', desc: 'Normal human phone & thought drift' },
                { id: 'high', title: 'High', buffer: '+40%', desc: 'Frequent interruptions & context switches' },
              ].map((d) => (
                <div
                  key={d.id}
                  onClick={() => setDistractionLevel(d.id)}
                  style={{
                    padding: '1rem',
                    textAlign: 'center',
                    borderRadius: 'var(--radius-md)',
                    background: distractionLevel === d.id ? '#ffffff' : 'var(--bg-card-subtle)',
                    color: distractionLevel === d.id ? '#000000' : '#ffffff',
                    border: distractionLevel === d.id ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{d.title}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0.25rem 0', fontFamily: 'var(--font-mono)' }}>{d.buffer}</div>
                  <div style={{ fontSize: '0.68rem', color: distractionLevel === d.id ? '#3f3f46' : 'var(--text-muted)' }}>{d.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 700, marginBottom: '0.5rem' }}>Preferred study session length</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { id: 'pomodoro', title: 'Short sprints', desc: '25–30 min blocks, frequent breaks' },
                { id: 'deep', title: 'Deep work', desc: '45–50 min blocks, longer breaks' },
              ].map((o) => (
                <div
                  key={o.id}
                  onClick={() => setSessionStyle(o.id)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: sessionStyle === o.id ? '#ffffff' : 'var(--bg-card-subtle)',
                    color: sessionStyle === o.id ? '#000000' : '#ffffff',
                    border: sessionStyle === o.id ? '1px solid #ffffff' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{o.title}</div>
                  <div style={{ fontSize: '0.7rem', color: sessionStyle === o.id ? '#3f3f46' : 'var(--text-muted)' }}>{o.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          {step > 1 ? (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleFinish} id="finish-onboarding-btn">
              Apply Routine & Build Engine <Check size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
