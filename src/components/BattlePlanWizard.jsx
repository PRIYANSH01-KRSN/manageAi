import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Target, AlertTriangle, Flag } from 'lucide-react';
import { buildBattlePlan } from '../services/battlePlanner';
import { KNOWLEDGE_LEVELS } from '../services/estimationEngine';

const emptyChapter = () => ({ name: '', pages: '', size: 'M', knowledgeLevel: 1, weight: 3 });

export function BattlePlanWizard({ isOpen, onClose, onAddTasks, getCapacityUntil }) {
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [chapters, setChapters] = useState([emptyChapter(), emptyChapter(), emptyChapter()]);
  const [includeMock, setIncludeMock] = useState(true);

  const capacity = useMemo(() => (examDate && getCapacityUntil ? getCapacityUntil(examDate) : Infinity), [examDate, getCapacityUntil]);
  const result = useMemo(
    () => buildBattlePlan({ subject, examDate, chapters, capacityMinutes: capacity, includeMock }),
    [subject, examDate, chapters, capacity, includeMock]
  );

  if (!isOpen) return null;

  const update = (idx, key, value) => setChapters((list) => list.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  const { summary } = result;
  const hasChapters = result.tasks.length > 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '820px', padding: '2rem', maxHeight: '92vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Target size={13} /> Exam battle plan
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0.25rem 0 0.35rem' }}>What's on the syllabus, and how well do you know it?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Weak, high-weight chapters go first. Each chapter becomes learn → practice, then a mock test and a final review — all checked against your real free time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Subject</label>
            <input className="input-field" placeholder="e.g. Microeconomics" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Exam / deadline date</label>
            <input className="input-field" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>

        {/* Chapter table */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 1.4fr 1fr 28px', gap: '0.4rem', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
          <span>Chapter / topic</span>
          <span>Pages</span>
          <span>or size</span>
          <span>How well you know it</span>
          <span>Exam weight</span>
          <span />
        </div>
        {chapters.map((c, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 1.4fr 1fr 28px', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
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
            <select className="input-field" value={c.weight} onChange={(e) => update(idx, 'weight', Number(e.target.value))}>
              <option value={5}>Very high</option>
              <option value={4}>High</option>
              <option value={3}>Medium</option>
              <option value={2}>Low</option>
              <option value={1}>Minor</option>
            </select>
            <button type="button" onClick={() => setChapters((list) => list.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }} aria-label="Remove chapter">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.5rem 0 1.25rem' }}>
          <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setChapters((l) => [...l, emptyChapter()])}>
            <Plus size={12} /> Add chapter
          </button>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <input type="checkbox" checked={includeMock} onChange={(e) => setIncludeMock(e.target.checked)} style={{ accentColor: '#ffffff' }} />
            Include a timed mock test
          </label>
        </div>

        {/* Preview */}
        {hasChapters && (
          <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem 1.15rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              <span>Needs <strong style={{ color: '#ffffff' }}>{(summary.totalMinutes / 60).toFixed(1)}h</strong></span>
              {summary.capacityMinutes !== null && <span>Free before exam <strong style={{ color: "#ffffff" }}>{(summary.capacityMinutes / 60).toFixed(1)}h</strong> (plan uses ≤90%, rest is slack)</span>}
              <span>Full coverage <strong style={{ color: summary.coveragePct < 100 ? '#fbbf24' : '#ffffff' }}>{summary.coveragePct}%</strong></span>
              <span>{summary.daysLeft} days left</span>
            </div>

            {(summary.skimmed.length > 0 || summary.core.length > 0) && (
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: '#fde68a', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.2rem', color: '#f59e0b' }} />
                <span>
                  Honest check: there isn't time to master everything.
                  {summary.core.length > 0 && <> Focus on the core concepts and most-asked question types of <strong>{summary.core.join(', ')}</strong>.</>}
                  {summary.skimmed.length > 0 && <> Skim only the key points of <strong>{summary.skimmed.join(', ')}</strong>.</>}
                  {' '}That's the best score for the time you have.
                </span>
              </div>
            )}

            {summary.startHere && (
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: '#ffffff', marginBottom: '0.75rem' }}>
                <Flag size={14} style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                <span>
                  <strong>Start here:</strong> {summary.startHere.title} — it's your weakest high-weight topic.
                </span>
              </div>
            )}

            {summary.phases.map((p) => (
              <div key={p.name} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{p.name}</div>
                <ol style={{ margin: '0.2rem 0 0 1.1rem', padding: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {p.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ol>
              </div>
            ))}
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
            Add battle plan to planner ({result.tasks.length} tasks)
          </button>
        </div>
      </div>
    </div>
  );
}
