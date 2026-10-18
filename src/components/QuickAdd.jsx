import React, { useState } from 'react';
import { Sparkles, Play, Plus, Info, Zap } from 'lucide-react';
import { quickTaskApi } from '../services/apiClient';
import { parseQuickTask, withPlanningBuffer, planQuickSession, ENERGY_SESSION } from '../services/quickTask';

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const ENERGY_WORD = { SHARP: 'sharp', STEADY: 'steady', FRIED: 'low on energy' };
const BUDGETS = [25, 50, 90, 120];

export function QuickAdd({ energy, onCreate }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [aiNote, setAiNote] = useState('');
  const [budget, setBudget] = useState(null);

  const level = energy?.level || 'STEADY';
  const defaultBudget = ENERGY_SESSION[level].minutes;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setAiNote('');
    setBudget(null);
    try {
      const res = await quickTaskApi(text.trim());
      setEstimate(res.task);
    } catch (err) {
      setEstimate(parseQuickTask(text.trim()));
      setAiNote(err.status === 429 ? err.message : 'AI is unavailable right now, so this is a rough estimate from your text.');
    } finally {
      setLoading(false);
    }
  };

  const buffered = estimate ? withPlanningBuffer(estimate.averageMinutes, 'averageStudent') : null;
  const session = estimate ? planQuickSession({ plannedMinutes: buffered.planned, energyLevel: level, budgetMinutes: budget || defaultBudget }) : null;

  const create = (startNow) => {
    const task = {
      id: `quick-${Date.now()}`,
      title: estimate.title,
      subject: estimate.subject || undefined,
      category: ['learn', 'practice', 'revise'].includes(estimate.taskType) ? 'academic' : 'general',
      taskType: estimate.taskType,
      difficulty: estimate.difficulty,
      quadrant: 'Q2',
      estimatedMinutes: buffered.planned,
      completedMinutes: 0,
      confidence: 3,
      weightage: 3,
      materials: estimate.subtopics?.length ? [`${estimate.title} — ${estimate.subtopics.slice(0, 3).join(', ')}`] : [estimate.title],
      roadblock: '',
      steps: estimate.subtopics || [],
      stuckProtocol: '',
      meta: { timeNote: buffered.reason, bufferIncluded: true },
    };
    onCreate({ task, startNow, sessionMinutes: session.minutes, firstStep: estimate.firstStep });
    setText('');
    setEstimate(null);
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          className="input-field"
          style={{ flex: 1, minWidth: '220px', fontSize: '0.95rem' }}
          placeholder='What do you need to do? e.g. "Study Chapter 4 of NCERT Physics"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="What do you need to do?"
          id="quick-add-input"
        />
        <button className="btn-primary" type="submit" disabled={loading || !text.trim()} id="quick-add-btn">
          <Sparkles size={15} /> {loading ? 'Thinking…' : 'Plan it'}
        </button>
      </form>

      {estimate && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--fg)' }}>{estimate.title}</div>
            {estimate.subject && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{estimate.subject}</div>}
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--fg)', lineHeight: 1.55 }}>
            <strong>An average student needs ~{fmt(estimate.averageMinutes)}</strong>
            <span style={{ color: 'var(--text-secondary)' }}>
              {' '}({fmt(estimate.rangeMinutes[0])}–{fmt(estimate.rangeMinutes[1])}) · {estimate.source === 'ai' ? 'estimated by AI' : 'rough estimate'}
            </span>
            {estimate.why && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{estimate.why}</div>}
            {estimate.assumption && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Assumed: {estimate.assumption}</div>}
            {aiNote && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{aiNote}</div>}
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem', lineHeight: 1.5 }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>Planned as <strong style={{ color: 'var(--fg)' }}>{fmt(buffered.planned)}</strong>. {buffered.reason}</span>
          </div>

          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Zap size={14} style={{ verticalAlign: '-2px' }} /> You seem <strong style={{ color: 'var(--fg)' }}>{ENERGY_WORD[level]}</strong> right now
            {energy?.reason ? <> — {energy.reason.replace(/ Tell me if that's off\.| This is a guess — tap how you actually feel\./, '')}</> : null}
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '0.35rem' }}>Max time you'll spend on this today?</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {BUDGETS.map((b) => {
                const active = (budget || defaultBudget) === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    style={{ padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', background: active ? 'var(--fg)' : 'transparent', color: active ? 'var(--fg-inverse)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    {fmt(b)}{b === defaultBudget ? ' · fits your energy' : ''}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              When the timer hits zero, you're done with this for today. {session.note}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => create(true)} style={{ padding: '0.7rem 1.3rem' }} id="quick-start-btn">
              <Play size={15} fill="currentColor" /> Start {fmt(session.minutes)} {session.label} now
            </button>
            <button className="btn-secondary" onClick={() => create(false)} id="quick-plan-btn">
              <Plus size={15} /> Just add to my plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
