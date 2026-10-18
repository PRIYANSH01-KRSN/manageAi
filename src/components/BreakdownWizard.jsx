import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Sparkles, ArrowRight, ArrowLeft, Eye, EyeOff, Flag } from 'lucide-react';
import { GOALS, GRASP_SPEEDS, buildBreakdown, genericCheckQuestions, guessComplexity, parseSubtopics } from '../services/taskBreakdown';
import { fetchAITopicCheckApi } from '../services/apiClient';

const COMPLEXITY = [
  { v: 2, label: 'Easy' },
  { v: 3, label: 'Medium' },
  { v: 4, label: 'Hard' },
  { v: 5, label: 'Very hard' },
];
const ANSWERS = [
  { id: 'know', label: 'Know it' },
  { id: 'partly', label: 'Partly' },
  { id: 'no', label: 'No idea' },
];
const AI_CACHE_KEY = 'cf_topic_check_cache';

const emptyUnit = (title = '') => ({ title, length: '', subtopicsText: '', subtopics: [] });

const pill = (active) => ({
  padding: '0.3rem 0.65rem',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--border-subtle)',
  background: active ? '#ffffff' : 'transparent',
  color: active ? '#000000' : 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontWeight: 600,
});

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

// Remove a step and reconnect anything that depended on it to its own prerequisites.
function removeStep(steps, id) {
  const removed = steps.find((s) => s.id === id);
  const fallback = [].concat(removed?.dependsOn || []);
  return steps
    .filter((s) => s.id !== id)
    .map((s) => {
      const deps = [].concat(s.dependsOn || []);
      if (!deps.includes(id)) return s;
      const next = [...new Set(deps.filter((d) => d !== id).concat(fallback))];
      return { ...s, dependsOn: next.length ? next : undefined };
    });
}

export function BreakdownWizard({ isOpen, onClose, initialTask, sessionStyle, learnerSpeeds = {}, paceRatioFor, aiAvailable, onAddSteps, onSaveLearnerSpeed }) {
  const [stage, setStage] = useState(1);
  const [kind, setKind] = useState('lectures');
  const [subject, setSubject] = useState(initialTask?.subject || '');
  const [deadline, setDeadline] = useState(initialTask?.deadline || '');
  const [goal, setGoal] = useState('exam');
  const [speed, setSpeed] = useState(1);
  const [hasSlides, setHasSlides] = useState(true);
  const [buildsOnPrevious, setBuildsOnPrevious] = useState(true);
  const [units, setUnits] = useState(() => [emptyUnit(), emptyUnit(), emptyUnit()]);
  const [stamp] = useState(() => Date.now()); // stable step ids while the wizard is open
  const [graspSpeed, setGraspSpeed] = useState(null);
  const [showHints, setShowHints] = useState({});
  const [aiState, setAiState] = useState({ loading: false, message: '' });
  const [editedSteps, setEditedSteps] = useState(null);

  const effectiveGraspSpeed = graspSpeed || learnerSpeeds[subject.trim().toLowerCase()] || 'average';
  const paceRatio = paceRatioFor ? paceRatioFor(subject.trim()) : 1;
  const validUnits = useMemo(() => units.filter((u) => u.title.trim() || u.subtopicsText.trim()), [units]);

  const result = useMemo(() => {
    if (stage < 3) return null;
    return buildBreakdown({
      kind,
      subject: subject.trim(),
      deadline: deadline || undefined,
      goal,
      speed,
      hasSlides,
      buildsOnPrevious,
      graspSpeed: effectiveGraspSpeed,
      paceRatio,
      sessionStyle,
      units: validUnits.map((u) => ({ title: u.title.trim(), length: Number(u.length) || undefined, subtopics: u.subtopics })),
    }, { stamp });
  }, [stage, kind, subject, deadline, goal, speed, hasSlides, buildsOnPrevious, effectiveGraspSpeed, paceRatio, sessionStyle, validUnits, stamp]);

  if (!isOpen) return null;

  const steps = editedSteps || result?.steps || [];
  const total = steps.reduce((a, s) => a + s.estimatedMinutes, 0);

  const updateUnit = (idx, patch) => setUnits((list) => list.map((u, i) => (i === idx ? { ...u, ...patch } : u)));

  // Build each unit's subtopic list (keeping answers / AI info for names that stay the same).
  const syncSubtopics = (list) =>
    list.map((u) => {
      const names = parseSubtopics(u.subtopicsText);
      const finalNames = names.length ? names : [u.title.trim() || 'Main topic'];
      return {
        ...u,
        subtopics: finalNames.map((name) => {
          const existing = u.subtopics.find((s) => s.name.toLowerCase() === name.toLowerCase());
          return existing || { name, complexity: guessComplexity(name), questions: genericCheckQuestions(name), answers: [] };
        }),
      };
    });

  const goToCheck = () => {
    setUnits((list) => syncSubtopics(list));
    setStage(2);
  };

  const runAI = async () => {
    const payload = validUnits.map((u) => ({ title: u.title.trim(), subtopics: parseSubtopics(u.subtopicsText) }));
    const key = JSON.stringify({ s: subject.trim().toLowerCase(), u: payload });
    const cache = readCache();
    setAiState({ loading: true, message: '' });
    try {
      const data = cache[key] || (await fetchAITopicCheckApi(subject.trim(), payload));
      if (!cache[key]) {
        try {
          const entries = Object.entries({ ...cache, [key]: data }).slice(-30);
          localStorage.setItem(AI_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
        } catch {
          // cache is optional
        }
      }
      let ai = 0;
      setUnits((list) => {
        const next = list.map((u) => {
          if (!(u.title.trim() || u.subtopicsText.trim())) return u;
          const fromAI = data.units?.[ai++];
          if (!fromAI?.subtopics?.length) return u;
          return {
            ...u,
            subtopicsText: fromAI.subtopics.map((s) => s.name).join(', '),
            subtopics: fromAI.subtopics.map((s) => ({
              name: s.name,
              complexity: s.complexity,
              questions: s.questions?.length ? s.questions : genericCheckQuestions(s.name),
              answers: [],
            })),
          };
        });
        return next;
      });
      setAiState({ loading: false, message: 'AI filled in subtopics, difficulty and check questions. Edit anything that looks off.' });
    } catch (err) {
      setAiState({
        loading: false,
        message: err.status === 401 ? 'Sign in to use AI suggestions — or type subtopics yourself.' : 'AI is unavailable right now — type subtopics yourself; built-in check questions will be used.',
      });
    }
  };

  const setAnswer = (ui, si, qi, value) =>
    setUnits((list) =>
      list.map((u, i) =>
        i !== ui
          ? u
          : {
              ...u,
              subtopics: u.subtopics.map((s, j) => {
                if (j !== si) return s;
                const answers = [...(s.answers || [])];
                answers[qi] = value;
                return { ...s, answers };
              }),
            }
      )
    );

  const setComplexity = (ui, si, v) =>
    setUnits((list) => list.map((u, i) => (i !== ui ? u : { ...u, subtopics: u.subtopics.map((s, j) => (j === si ? { ...s, complexity: v } : s)) })));

  const markUnit = (ui, value) =>
    setUnits((list) => list.map((u, i) => (i !== ui ? u : { ...u, subtopics: u.subtopics.map((s) => ({ ...s, answers: s.questions.map(() => value) })) })));

  const handleAdd = () => {
    if (subject.trim() && graspSpeed) onSaveLearnerSpeed?.(subject.trim(), graspSpeed);
    onAddSteps(steps, initialTask?.id);
    onClose();
  };

  const lengthLabel = kind === 'lectures' ? 'Length (min)' : 'Pages';
  const unitWord = kind === 'lectures' ? 'Lecture' : 'Chapter';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '860px', padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ height: '4px', flex: 1, borderRadius: '9999px', background: s <= stage ? '#ffffff' : 'var(--border-subtle)' }} />
          ))}
        </div>

        {/* ---------------- Stage 1: what are you covering ---------------- */}
        {stage === 1 && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 1 of 3 · What are you covering?</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0.25rem 0 0.35rem' }}>Break it down into clear, timed steps</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.1rem' }}>
              {initialTask ? <>Breaking down <strong style={{ color: '#ffffff' }}>"{initialTask.title}"</strong>. </> : null}
              List each {unitWord.toLowerCase()} and what's inside it. Time is worked out per subtopic — for you, not an average student.
            </p>

            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem' }}>
              <button style={pill(kind === 'lectures')} onClick={() => setKind('lectures')}>Lectures / videos</button>
              <button style={pill(kind === 'chapters')} onClick={() => setKind('chapters')}>Chapters / reading</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Subject</label>
                <input className="input-field" placeholder="e.g. Data Structures" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Exam / due date (optional)</label>
                <input className="input-field" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Your goal</label>
                <select className="input-field" value={goal} onChange={(e) => setGoal(e.target.value)}>
                  {Object.values(GOALS).map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
              {kind === 'lectures' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Playback speed</label>
                  <select className="input-field" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                    {[1, 1.25, 1.5, 1.75, 2].map((s) => (
                      <option key={s} value={s}>{s}×</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.6fr 2fr 28px', gap: '0.4rem', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              <span>{unitWord} title</span>
              <span>{lengthLabel}</span>
              <span>Subtopics inside (comma separated)</span>
              <span />
            </div>
            {units.map((u, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.6fr 2fr 28px', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                <input className="input-field" placeholder={`${unitWord} ${idx + 1}, e.g. Linked lists`} value={u.title} onChange={(e) => updateUnit(idx, { title: e.target.value })} />
                <input className="input-field" type="number" min="1" placeholder={kind === 'lectures' ? '60' : '20'} value={u.length} onChange={(e) => updateUnit(idx, { length: e.target.value })} />
                <input className="input-field" placeholder="e.g. Circular linked list, Doubly linked list" value={u.subtopicsText} onChange={(e) => updateUnit(idx, { subtopicsText: e.target.value })} />
                <button onClick={() => setUnits((l) => l.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }} aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', margin: '0.5rem 0 1rem' }}>
              <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setUnits((l) => [...l, emptyUnit()])}>
                <Plus size={12} /> Add {unitWord.toLowerCase()}
              </button>
              <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="checkbox" checked={buildsOnPrevious} onChange={(e) => setBuildsOnPrevious(e.target.checked)} style={{ accentColor: '#ffffff' }} />
                  Each {unitWord.toLowerCase()} builds on the previous one
                </label>
                {kind === 'lectures' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="checkbox" checked={hasSlides} onChange={(e) => setHasSlides(e.target.checked)} style={{ accentColor: '#ffffff' }} />
                    I have the slides
                  </label>
                )}
              </div>
            </div>

            {aiAvailable && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button className="btn-secondary" style={{ fontSize: '0.78rem' }} onClick={runAI} disabled={aiState.loading || validUnits.length === 0}>
                  <Sparkles size={13} /> {aiState.loading ? 'Thinking…' : 'Suggest subtopics & check questions with AI'}
                </button>
                {aiState.message && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{aiState.message}</span>}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button className="btn-primary" disabled={validUnits.length === 0} onClick={goToCheck} id="breakdown-next-btn">
                Next: quick check <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ---------------- Stage 2: quick self-check ---------------- */}
        {stage === 2 && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 2 of 3 · Quick check (about 1 minute)</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0.25rem 0 0.35rem' }}>How well do you already know each part?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Answer honestly in your head — "Partly" and "No idea" just mean more time where you need it. Unanswered questions count as "not sure yet".
            </p>

            <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 700, marginBottom: '0.45rem' }}>
                How quickly do you usually grasp new topics{subject.trim() ? ` in ${subject.trim()}` : ''}?
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {Object.values(GRASP_SPEEDS).map((g) => (
                  <button key={g.id} style={pill(effectiveGraspSpeed === g.id)} onClick={() => setGraspSpeed(g.id)}>{g.label}</button>
                ))}
              </div>
              {paceRatio !== 1 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.4rem' }}>
                  From your timed sessions, your real pace here is {paceRatio.toFixed(2)}× your estimates — that's included too.
                </div>
              )}
            </div>

            {units.map((u, ui) => (
              <div key={ui} style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{unitWord} {ui + 1}{u.title ? `: ${u.title}` : ''}</strong>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button style={pill(false)} onClick={() => markUnit(ui, 'know')}>I know all of this</button>
                    <button style={pill(false)} onClick={() => markUnit(ui, 'no')}>All new to me</button>
                  </div>
                </div>
                {u.subtopics.map((s, si) => (
                  <div key={s.name} style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.75rem 0.9rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</span>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginRight: '0.2rem' }}>Looks</span>
                        {COMPLEXITY.map((c) => (
                          <button key={c.v} style={pill(s.complexity === c.v)} onClick={() => setComplexity(ui, si, c.v)}>{c.label}</button>
                        ))}
                      </div>
                    </div>
                    {s.questions.map((q, qi) => {
                      const hintKey = `${ui}-${si}-${qi}`;
                      return (
                        <div key={qi} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap', padding: '0.3rem 0', borderTop: qi ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div style={{ flex: 1, minWidth: '220px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {q.q}
                            {q.hint && (
                              <button onClick={() => setShowHints((h) => ({ ...h, [hintKey]: !h[hintKey] }))} style={{ marginLeft: '0.35rem', background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.7rem' }}>
                                {showHints[hintKey] ? <EyeOff size={11} /> : <Eye size={11} />} {showHints[hintKey] ? 'hide' : 'check answer'}
                              </button>
                            )}
                            {showHints[hintKey] && <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{q.hint}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {ANSWERS.map((a) => (
                              <button key={a.id} style={pill(s.answers?.[qi] === a.id)} onClick={() => setAnswer(ui, si, qi, a.id)}>{a.label}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setStage(1)}><ArrowLeft size={14} /> Back</button>
              <button className="btn-primary" onClick={() => { setEditedSteps(null); setStage(3); }} id="breakdown-preview-btn">
                See my time plan <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ---------------- Stage 3: preview & edit ---------------- */}
        {stage === 3 && result && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 3 of 3 · Your plan</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0.25rem 0 0.35rem' }}>
              {(total / 60).toFixed(1)}h of focused work · {steps.length} steps
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
              The {kind === 'lectures' ? 'videos' : 'reading'} alone {kind === 'lectures' ? 'run' : 'take'} ~{(result.summary.naiveMinutes / 60).toFixed(1)}h. The rest is pausing to take notes, understanding, practice and review — the part that actually makes it stick.
              {result.summary.learnerFactor !== 1 && <> Paced at {result.summary.learnerFactor}× for how you learn.</>}
              {' '}Edit any minutes or remove steps you don't need.
            </p>

            {result.summary.startHere && (
              <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.82rem', color: '#ffffff', marginBottom: '0.85rem' }}>
                <Flag size={14} style={{ flexShrink: 0, marginTop: '0.2rem' }} /> <span><strong>Start with:</strong> {steps[0]?.title}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.1rem' }}>
              {steps.map((s, idx) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 74px 26px', gap: '0.5rem', alignItems: 'center', background: s.meta?.kind === 'learn' ? 'var(--bg-card-subtle)' : 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.6rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)' }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 600 }}>{s.title}</div>
                    {s.meta?.timeNote && <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{s.meta.timeNote}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <input
                      className="input-field"
                      type="number"
                      min="5"
                      step="5"
                      value={s.estimatedMinutes}
                      onChange={(e) => setEditedSteps(steps.map((x) => (x.id === s.id ? { ...x, estimatedMinutes: Math.max(5, Number(e.target.value) || 5) } : x)))}
                      style={{ padding: '0.25rem 0.35rem', fontSize: '0.78rem' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>m</span>
                  </div>
                  <button onClick={() => setEditedSteps(removeStep(steps, s.id))} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }} aria-label="Remove step">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Got stuck while studying? Use <strong style={{ color: '#ffffff' }}>"I'm stuck"</strong> on the focus screen — your stuck points become the agenda of each summary step.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setStage(2)}><ArrowLeft size={14} /> Back</button>
              <button className="btn-primary" onClick={handleAdd} disabled={steps.length === 0} id="breakdown-add-btn">
                Add {steps.length} steps to my plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
