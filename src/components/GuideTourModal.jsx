import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Sliders, CheckSquare, Image as ImageIcon, Play, Sparkles, Brain } from 'lucide-react';

const GUIDE_STEPS = [
  {
    step: 1,
    badge: 'Phase 1: Foundation',
    title: 'Calibrate Your Circadian Rhythms',
    icon: Sliders,
    description: 'ChronosFlow does not use rigid generic calendars. Start by telling the engine when you sleep, when your peak focus occurs (Morning Lark vs Night Owl), and what routines (meals, gym) must be protected.',
    actionLabel: 'Open Routine Setup',
    actionTab: 'habits',
    tip: 'The scheduler adds a realistic +25% buffer to tasks to prevent schedule collapse from human distractions.',
  },
  {
    step: 2,
    badge: 'Phase 2: Planning',
    title: 'Add Backlog or AI Batch Crunch',
    icon: CheckSquare,
    description: 'Go to the Backlog tab. Add tasks using the extended time slider (up to 4 hours) or click "I am uncertain" if you don\'t know the time. Alternatively, use "AI Batch Crunch" to paste your raw syllabus and let Gemini 3.8 Flash structure it across the 4 Eisenhower quadrants.',
    actionLabel: 'Go to Backlog',
    actionTab: 'backlog',
    tip: 'Q1 (Urgent & Critical) tasks are automatically scheduled into your biological peak hours.',
  },
  {
    step: 3,
    badge: 'Phase 3: Optional Ingestion',
    title: 'Import Your Class / Work Schedule via OCR',
    icon: ImageIcon,
    description: 'Have a university lecture timetable or shift schedule? Drop the image into Timetable OCR. The multimodal vision model extracts your classes and injects a mandatory 20-minute rest buffer after every lecture.',
    actionLabel: 'Open Timetable OCR',
    actionTab: 'timetable',
    tip: 'You can toggle open gaps between classes to "Protected Rest" or "Light Review Allowed".',
  },
  {
    step: 4,
    badge: 'Phase 4: Execution',
    title: 'Destroy Decision Paralysis in Focus & Counter',
    icon: Play,
    description: 'Never waste mental energy deciding what to do. The Focus tab isolates the single top-priority task right now. Follow the 3-Step Action Guide, turn on ambient Brown Noise or Alpha Waves, and press Start on the Round Counter.',
    actionLabel: 'Go to Focus & Counter',
    actionTab: 'focus',
    tip: 'Follow the "Definition of Done" and "Stuck Protocol" to prevent getting blocked for >7 minutes.',
  },
  {
    step: 5,
    badge: 'Phase 5: Self-Evolution',
    title: 'Zero-Guilt Adaptive Recalibration',
    icon: Brain,
    description: 'Finished? Click Done for a celebratory chime and streak boost. Stalled or distracted? Click Stalled and pick the honest reason. The AI learns your true stamina, inflates future buffers, and shifts remaining tasks without late-night guilt.',
    actionLabel: 'View Adaptive Memory',
    actionTab: 'analytics',
    tip: 'Your responses directly train the SQLite model to avoid scheduling heavy work during fatigue zones.',
  },
];

export function GuideTourModal({ isOpen, onClose, onNavigateTab, onOpenRoutineSetup }) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  if (!isOpen) return null;

  const currentStep = GUIDE_STEPS[currentStepIdx];
  const IconComponent = currentStep.icon;

  const handleAction = () => {
    if (currentStep.actionTab === 'habits' && onOpenRoutineSetup) {
      onClose();
      onOpenRoutineSetup();
    } else if (onNavigateTab) {
      onClose();
      onNavigateTab(currentStep.actionTab);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '640px', padding: '2.5rem' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          id="close-guide-modal-btn"
        >
          <X size={18} />
        </button>

        {/* Step Indicator Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-highlight">{currentStep.badge}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Step {currentStep.step} of 5
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {GUIDE_STEPS.map((s, idx) => (
              <button
                key={s.step}
                onClick={() => setCurrentStepIdx(idx)}
                style={{
                  width: idx === currentStepIdx ? '22px' : '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  background: idx === currentStepIdx ? '#ffffff' : 'var(--border-strong)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'inline-flex', padding: '0.65rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
              <IconComponent size={22} color="#ffffff" />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {currentStep.title}
            </h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {currentStep.description}
          </p>

          {/* Pro Tip Box */}
          <div style={{ 
            background: 'var(--bg-card-subtle)', 
            border: '1px solid var(--border-subtle)', 
            borderRadius: 'var(--radius-md)', 
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem'
          }}>
            <Sparkles size={16} style={{ color: '#ffffff', flexShrink: 0, marginTop: '0.15rem' }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: '#ffffff' }}>Why this works: </strong>
              {currentStep.tip}
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <button
            className="btn-secondary"
            onClick={() => setCurrentStepIdx(Math.max(0, currentStepIdx - 1))}
            disabled={currentStepIdx === 0}
            style={{ opacity: currentStepIdx === 0 ? 0.3 : 1, cursor: currentStepIdx === 0 ? 'not-allowed' : 'pointer' }}
          >
            <ArrowLeft size={14} /> Previous
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              onClick={handleAction}
            >
              <span>{currentStep.actionLabel}</span>
            </button>

            {currentStepIdx < GUIDE_STEPS.length - 1 ? (
              <button
                className="btn-primary"
                onClick={() => setCurrentStepIdx(currentStepIdx + 1)}
              >
                <span>Next Step</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={onClose}
              >
                <span>Ready to Begin</span>
                <Check size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
