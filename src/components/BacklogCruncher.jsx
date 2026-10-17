import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, Clock, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { EISENHOWER_QUADRANTS } from '../constants/initialData';

export function BacklogCruncher({ 
  tasks = [], 
  onAddTask, 
  onDeleteTask, 
  onGenerateBatchAI,
  targetDeadlineDays = 3,
  onUpdateTargetDeadlineDays
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [title, setTitle] = useState('');
  const [quadrant, setQuadrant] = useState('Q1');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [isUncertain, setIsUncertain] = useState(false);
  const [materials, setMaterials] = useState('');
  const [roadblock, setRoadblock] = useState('');

  const [batchText, setBatchText] = useState('4 chapters of Microeconomics exam in 3 days; need to master Elasticity and Cost functions');

  // Workload feasibility calculations
  const totalMinutes = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const hoursPerDay = targetDeadlineDays > 0 ? (totalMinutes / 60 / targetDeadlineDays).toFixed(1) : totalHours;
  
  // Normal healthy daytime deep focus capacity is ~4.5 - 5.0 hours/day
  const isHighCrunch = Number(hoursPerDay) > 4.5;
  const isExtremeCrunch = Number(hoursPerDay) > 7.0;

  const handleCreate = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalMinutes = isUncertain ? 45 : Number(estimatedMinutes) || 45;

    onAddTask({
      id: `task-${Date.now()}`,
      title: isUncertain ? `${title} (Estimated)` : title,
      category: 'general',
      quadrant,
      estimatedMinutes: finalMinutes,
      isUncertain,
      confidence: isUncertain ? 2 : 3,
      weightage: 4,
      materials: materials ? materials.split(',').map((s) => s.trim()) : ['Reference Notes'],
      roadblock: roadblock || 'Overthinking start point',
      steps: [
        'Step 1: Open primary reference material (5m)',
        `Step 2: Work continuously through the targeted problem or section (${Math.max(15, finalMinutes - 10)}m)`,
        'Step 3: Document summary bullets and log progress (5m)',
      ],
      stuckProtocol: 'If stuck for > 7 minutes, record the specific question and move to the next sub-step.',
    });

    setTitle('');
    setMaterials('');
    setRoadblock('');
    setIsUncertain(false);
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
            Backlog & Strategic Planner
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
            Set deadlines, gauge uncertainty, and sequence tasks without burning out.
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

      {/* Strategic Timeline & Feasibility Planner Box */}
      <div style={{ 
        background: 'var(--bg-card-subtle)', 
        border: '1px solid var(--border-subtle)', 
        borderRadius: 'var(--radius-md)', 
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Strategic Timeline Target
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Target Timeline:</span>
              <select
                value={targetDeadlineDays}
                onChange={(e) => onUpdateTargetDeadlineDays && onUpdateTargetDeadlineDays(Number(e.target.value))}
                style={{
                  background: 'var(--bg-card)',
                  color: '#ffffff',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                }}
                id="target-timeline-select"
              >
                <option value={1}>1 Day (Immediate Sprint)</option>
                <option value={2}>2 Days</option>
                <option value={3}>3 Days (Recommended)</option>
                <option value={5}>5 Days (Week Sprint)</option>
                <option value={7}>1 Week</option>
                <option value={14}>2 Weeks</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Workload</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {totalHours}h ({tasks.length} tasks)
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Required Pace</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isHighCrunch ? '#f87171' : '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {hoursPerDay}h / day
              </div>
            </div>
          </div>
        </div>

        {/* Feasibility Alert Note */}
        <div style={{ 
          borderTop: '1px solid var(--border-subtle)', 
          paddingTop: '0.75rem', 
          marginTop: '0.5rem',
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: isExtremeCrunch ? '#fca5a5' : (isHighCrunch ? '#fde68a' : 'var(--text-secondary)')
        }}>
          {isExtremeCrunch ? (
            <>
              <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span>
                <strong>Extreme Crunch Mode:</strong> {hoursPerDay}h/day exceeds normal awake capacity. AI recommends borrowing 1 hour from leisure or waking 45m earlier, and pruning Q4 tasks.
              </span>
            </>
          ) : isHighCrunch ? (
            <>
              <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span>
                <strong>Tight Timeline:</strong> {hoursPerDay}h/day is intensive. AI will protect high-yield Q1/Q2 tasks first and compress breaks.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} style={{ color: '#ffffff', flexShrink: 0 }} />
              <span>
                <strong>Feasible Pace:</strong> {hoursPerDay}h/day fits comfortably into your awake energy slots without touching sleep or meals.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>Add New Task to Planner</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Task Title / Deliverable *</label>
              <input type="text" className="input-field" placeholder="e.g. Chapter 4 Practice Problems or Backend API Module" value={title} onChange={(e) => setTitle(e.target.value)} required />
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

            {/* Extended Time Estimation with Uncertainty Toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Estimated Minutes: <strong>{isUncertain ? 'AI Gauge (Auto)' : `${estimatedMinutes}m (${(estimatedMinutes/60).toFixed(1)}h)`}</strong>
                </label>
                <button
                  type="button"
                  onClick={() => setIsUncertain(!isUncertain)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isUncertain ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {isUncertain ? 'Set Specific Time' : 'I am uncertain / Unsure'}
                </button>
              </div>

              {!isUncertain ? (
                <>
                  <input 
                    type="range" 
                    min="15" 
                    max="240" 
                    step="15" 
                    value={estimatedMinutes} 
                    onChange={(e) => setEstimatedMinutes(e.target.value)} 
                    style={{ width: '100%', accentColor: '#ffffff' }} 
                  />
                  {/* Quick Preset Buttons */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                    {[30, 60, 90, 120, 180, 240].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEstimatedMinutes(m)}
                        style={{
                          background: estimatedMinutes === m ? '#ffffff' : 'transparent',
                          color: estimatedMinutes === m ? '#000000' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.15rem 0.4rem',
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                        }}
                      >
                        {m >= 60 ? `${m/60}h` : `${m}m`}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                  ⚡ AI will dynamically gauge complexity and slice into 40m atomic chunks.
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Materials to Open</label>
              <input type="text" className="input-field" placeholder="Slides PDF, Code Editor" value={materials} onChange={(e) => setMaterials(e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Anticipated Roadblock</label>
              <input type="text" className="input-field" placeholder="e.g. Getting stuck on complex equations or syntax" value={roadblock} onChange={(e) => setRoadblock(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" id="add-to-planner-btn">
              Add to Planner
            </button>
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
                          <Clock size={11} /> {t.estimatedMinutes}m {t.estimatedMinutes >= 60 ? `(${(t.estimatedMinutes/60).toFixed(1)}h)` : ''}
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
              Enter syllabus volume, target deadline, and subject difficulty. Gemini 3.8 Flash will structure it into prioritized atomic units.
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
                <button type="submit" className="btn-primary">Crunch & Add to Planner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
