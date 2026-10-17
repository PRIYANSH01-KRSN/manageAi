import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, Clock, Check } from 'lucide-react';
import { EISENHOWER_QUADRANTS } from '../constants/initialData';

export function BacklogCruncher({ 
  tasks = [], 
  onAddTask, 
  onDeleteTask, 
  onGenerateBatchAI 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [title, setTitle] = useState('');
  const [quadrant, setQuadrant] = useState('Q1');
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [materials, setMaterials] = useState('');
  const [roadblock, setRoadblock] = useState('');

  const [batchText, setBatchText] = useState('4 chapters of Microeconomics exam in 3 days; need to master Elasticity and Cost functions');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      id: `task-${Date.now()}`,
      title,
      category: 'general',
      quadrant,
      estimatedMinutes: Number(estimatedMinutes) || 45,
      confidence: 3,
      weightage: 4,
      materials: materials ? materials.split(',').map((s) => s.trim()) : ['Reference Notes'],
      roadblock: roadblock || 'Overthinking start point',
      steps: [
        'Step 1: Open primary reference material (5m)',
        `Step 2: Work continuously through the targeted problem or section (${estimatedMinutes - 10}m)`,
        'Step 3: Document summary bullets and log progress (5m)',
      ],
      stuckProtocol: 'If stuck for > 7 minutes, record the specific question and move to the next sub-step.',
    });

    setTitle('');
    setMaterials('');
    setRoadblock('');
    setShowAddForm(false);
  };

  const handleBatchSubmit = (e) => {
    e.preventDefault();
    onGenerateBatchAI(batchText);
    setShowBatchModal(false);
  };

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Backlog & Eisenhower Prioritization
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
            Tasks are allocated into peak focus hours (Q1/Q2) and shallow gap hours (Q3).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button 
            className="btn-secondary"
            onClick={() => setShowBatchModal(true)}
            id="batch-crunch-btn"
          >
            <Sparkles size={14} />
            <span>AI Batch Crunch</span>
          </button>

          <button 
            className="btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
            id="add-task-btn"
          >
            <Plus size={14} />
            <span>{showAddForm ? 'Cancel' : 'New Task'}</span>
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>Add New Task</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Title *</label>
              <input type="text" className="input-field" placeholder="e.g. Chapter 4 Practice Problems" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Priority Quadrant</label>
              <select className="input-field" value={quadrant} onChange={(e) => setQuadrant(e.target.value)}>
                <option value="Q1">Q1: Urgent & Important (Do First)</option>
                <option value="Q2">Q2: Important, Not Urgent (Deep Work)</option>
                <option value="Q3">Q3: Urgent, Not Important (Quick Gaps)</option>
                <option value="Q4">Q4: Low Priority</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Estimated Minutes ({estimatedMinutes}m)</label>
              <input type="range" min="15" max="90" step="5" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} style={{ width: '100%', accentColor: '#ffffff' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Materials to Open</label>
              <input type="text" className="input-field" placeholder="Slides PDF, Code Editor" value={materials} onChange={(e) => setMaterials(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Anticipated Roadblock</label>
              <input type="text" className="input-field" placeholder="e.g. Getting stuck on complex equations" value={roadblock} onChange={(e) => setRoadblock(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save to SQLite</button>
          </div>
        </form>
      )}

      {/* 4 Quadrants Display */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {['Q1', 'Q2', 'Q3', 'Q4'].map((qKey) => {
          const qObj = EISENHOWER_QUADRANTS[qKey];
          const qTasks = tasks.filter((t) => t.quadrant === qKey);

          return (
            <div
              key={qKey}
              style={{
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '220px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <strong style={{ fontSize: '0.875rem', color: '#ffffff' }}>{qKey}: {qObj.name}</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{qObj.subtitle}</div>
                </div>
                <span className="badge">{qTasks.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {qTasks.length === 0 ? (
                  <div style={{ margin: 'auto 0', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    Empty
                  </div>
                ) : (
                  qTasks.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.65rem 0.75rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#ffffff' }}>
                          {t.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          <Clock size={11} /> {t.estimatedMinutes}m
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteTask(t.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Batch Modal */}
      {showBatchModal && (
        <div className="modal-overlay" role="dialog">
          <div className="modal-container" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem', color: '#ffffff' }}>
              AI Batch Backlog Cruncher
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1.25rem' }}>
              Enter syllabus, project goals, or deadlines. The AI will decompose and assign tasks across the 4 quadrants.
            </p>
            <form onSubmit={handleBatchSubmit}>
              <textarea
                className="input-field"
                rows="4"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                style={{ marginBottom: '1.25rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBatchModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Crunch & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
