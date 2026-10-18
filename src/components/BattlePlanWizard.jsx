import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Target, Flag, CheckCircle2, ClipboardList } from 'lucide-react';
import { buildBattlePlan, PAST_PAPER_FREQUENCY } from '../services/battlePlanner';
import { KNOWLEDGE_LEVELS } from '../services/estimationEngine';

const emptyChapter = () => ({ name: '', pages: '', size: 'M', knowledgeLevel: 1, marks: '', pastPaper: 'sometimes' });

// "Elasticity, 15" / "Elasticity - 15 marks" / "Elasticity" → { name, marks }
function parseChapterList(text) {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((line) => {
      const m = line.match(/^(.*?)[\s,;:–-]+(\d{1,3})\s*(marks?)?\s*$/i);
      return m ? { ...emptyChapter(), name: m[1].trim(), marks: m[2] } : { ...emptyChapter(), name: line };
    });
}

const label = { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 };
const COLS = '1.9fr 0.6fr 1fr 1.3fr 0.7fr 1.15fr 28px';

export function BattlePlanWizard({ isOpen, onClose, onAddTasks, getCapacityUntil }) {
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [chapters, setChapters] = useState([emptyChapter(), emptyChapter(), emptyChapter()]);
  const [includeMock, setIncludeMock] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const capacity = useMemo(() => (examDate && getCapacityUntil ? getCapacityUntil(examDate) : Infinity), [examDate, getCapacityUntil]);
  const result = useMemo(
    () => buildBattlePlan({ subject, examDate, chapters, capacityMinutes: capacity, includeMock }),
    [subject, examDate, chapters, capacity, includeMock]
  );

  if (!isOpen) return null;

  const update = (idx, key, value) => setChapters((list) => list.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  const { summary } = result;
  const hasChapters = result.tasks.length > 0;
  const marksEntered = chapters.some((c) => Number(c.marks) > 0);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '900px', padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Target size={13} /> Exam battle plan
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--fg)', margin: '0.25rem 0 0.35rem' }}>Too much to cover? Let's find the marks.</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Add each chapter with its marks and how well you know it. You'll get the plan that wins the most marks in the time you actually have — and a clear list of what you can safely skip.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={label}>Subject</label>
            <input className="input-field" placeholder="e.g. Microeconomics" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label style={label}>Exam date</label>
            <input className="input-field" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setPasteOpen(!pasteOpen)}>
            <ClipboardList size={12} /> {pasteOpen ? 'Close paste box' : 'Paste a chapter list'}
          </button>
        </div>
        {pasteOpen && (
          <div style={{ marginBottom: '1rem' }}>
            <textarea
              className="input-field"
              rows={5}
              placeholder={'One chapter per line, marks optional:\nElasticity, 15\nCost functions, 12\nMarket structures'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}
                onClick={() => {
                  const parsed = parseChapterList(pasteText);
                  if (parsed.length) setChapters(parsed);
                  setPasteOpen(false);
                }}
              >
                Use this list
              </button>
            </div>
          </div>
        )}

        {/* Chapter table */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '760px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.3rem' }}>
              <span>Chapter / topic</span>
              <span>Pages</span>
              <span>or size</span>
              <span>How well you know it</span>
              <span>Marks</span>
              <span>In past papers</span>
              <span />
            </div>
            {chapters.map((c, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: COLS, gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                <input className="input-field" placeholder={`Chapter ${idx + 1}`} value={c.name} onChange={(e) => update(idx, 'name', e.target.value)} />
                <input className="input-field" type="number" min="0" placeholder="—" value={c.pages} onChange={(e) => update(idx, 'pages', e.target.value)} />
                <select className="input-field" value={c.size} onChange={(e) => update(idx, 'size', e.target.value)} disabled={Number(c.pages) > 0}>
                  <option value="S">Short</option>
                  <option value="M">Medium</option>
                  <option value="L">Long</option>
                </select>
                <select className="input-field" value={c.knowledgeLevel} onChange={(e) => update(idx, 'knowledgeLevel', Number(e.target.value))}>
                  {KNOWLEDGE_LEVELS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
                <input className="input-field" type="number" min="0" placeholder="e.g. 10" value={c.marks} onChange={(e) => update(idx, 'marks', e.target.value)} />
                <select className="input-field" value={c.pastPaper} onChange={(e) => update(idx, 'pastPaper', e.target.value)}>
                  {Object.values(PAST_PAPER_FREQUENCY).map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setChapters((list) => list.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Remove chapter">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', margin: '0.5rem 0 1.25rem' }}>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setChapters((l) => [...l, emptyChapter()])}>
            <Plus size={12} /> Add chapter
          </button>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <input type="checkbox" checked={includeMock} onChange={(e) => setIncludeMock(e.target.checked)} style={{ accentColor: 'var(--fg)' }} />
            Include a timed mock test (when there's time)
          </label>
        </div>
        {!marksEntered && hasChapters && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.75rem', marginBottom: '1rem' }}>
            Tip: add marks per chapter (from the syllabus or past papers) for a much sharper triage.
          </div>
        )}

        {/* Result */}
        {hasChapters && (
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                { k: 'Days left', v: summary.daysLeft },
                { k: 'Study time needed', v: `${(summary.totalMinutes / 60).toFixed(1)}h` },
                { k: 'Free before exam', v: summary.capacityMinutes !== null ? `${(summary.capacityMinutes / 60).toFixed(1)}h` : '—' },
                { k: 'Expected score', v: `~${summary.expectedMarks}/${summary.totalMarks}` },
              ].map((s) => (
                <div key={s.k}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.k}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {summary.highYield.length > 0 && (
              <div style={{ marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 800, color: 'var(--fg)', marginBottom: '0.35rem' }}>
                  <Flag size={15} /> Focus on these{summary.highYield.length > 1 ? ` ${summary.highYield.length}` : ''} — best marks for your time
                </div>
                <ol style={{ margin: '0 0 0 1.2rem', padding: 0, fontSize: '0.88rem', color: 'var(--fg)', lineHeight: 1.6 }}>
                  {summary.highYield.map((n) => (
                    <li key={n}>{n}{summary.core.includes(n) ? <span style={{ color: 'var(--text-secondary)' }}> — core concepts & common questions</span> : null}</li>
                  ))}
                </ol>
                {summary.alsoStudied?.length > 0 && (
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    Then, if time allows: {summary.alsoStudied.join(', ')}
                  </div>
                )}
              </div>
            )}

            {summary.skipped.length > 0 && (
              <div style={{ display: 'flex', gap: '0.55rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 0.9rem', marginBottom: '0.9rem' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '0.15rem', color: 'var(--success)' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--fg)', lineHeight: 1.55 }}>
                  <strong>Permission to skip.</strong> {summary.permission}
                </div>
              </div>
            )}

            {summary.skimmed.length > 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Quick skim only (20 min each, for the easy marks): {summary.skimmed.join(', ')}
              </div>
            )}

            <details>
              <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>See the full step-by-step plan</summary>
              {summary.phases.map((p) => (
                <div key={p.name} style={{ marginTop: '0.6rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{p.name}</div>
                  <ol style={{ margin: '0.2rem 0 0 1.1rem', padding: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {p.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </details>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!hasChapters}
            onClick={() => {
              onAddTasks(result.tasks);
              onClose();
            }}
            id="add-battle-plan-btn"
          >
            Start this plan ({result.tasks.length} steps)
          </button>
        </div>
      </div>
    </div>
  );
}
