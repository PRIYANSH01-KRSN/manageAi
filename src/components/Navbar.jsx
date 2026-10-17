import React from 'react';
import { 
  CheckSquare, 
  Calendar, 
  Image as ImageIcon, 
  Brain, 
  Sliders, 
  Flame,
  LogIn,
  LogOut
} from 'lucide-react';

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  streakCount, 
  backendOnline,
  taskCount = 0,
  onOpenOnboarding,
  onOpenGuide,
  storageLabel,
  authEnabled,
  userEmail,
  onSignIn,
  onSignOut
}) {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <h1 className="brand-title">Chronos</h1>
        <div className="db-badge" title="Persistent SQLite Database">
          <span className="db-indicator" style={{ background: backendOnline ? '#ffffff' : '#71717a' }} />
          <span>{storageLabel || (backendOnline ? 'Synced' : 'Saved on this device')}</span>
        </div>
      </div>

      {/* Main Tabs */}
      <nav className="nav-tab-container" aria-label="Main Navigation">
        <button
          className={`nav-tab-btn ${activeTab === 'focus' ? 'active' : ''}`}
          onClick={() => setActiveTab('focus')}
          id="nav-focus-btn"
        >
          <span>Focus & Counter</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'backlog' ? 'active' : ''}`}
          onClick={() => setActiveTab('backlog')}
          id="nav-backlog-btn"
        >
          <span>Backlog ({taskCount})</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
          id="nav-timeline-btn"
        >
          <span>Schedule</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'timetable' ? 'active' : ''}`}
          onClick={() => setActiveTab('timetable')}
          id="nav-timetable-btn"
        >
          <span>Timetable OCR</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
          id="nav-analytics-btn"
        >
          <span>Adaptive Memory</span>
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'habits' ? 'active' : ''}`}
          onClick={() => setActiveTab('habits')}
          id="nav-habits-btn"
        >
          <span>Habits & Rhythms</span>
        </button>
      </nav>

      {/* Right Side Streak, Guide & Routine Setup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={onOpenGuide}
          className="btn-secondary"
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
          title="Open First-Time User 5-Step Guide"
          id="guide-tour-nav-btn"
        >
          <span>Guide</span>
        </button>

        <button
          onClick={onOpenOnboarding}
          className="btn-secondary"
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
          title="Analyze and calibrate daily routine"
          id="routine-setup-nav-btn"
        >
          <Sliders size={13} />
          <span>Routine Setup</span>
        </button>

        {authEnabled && (userEmail ? (
          <button onClick={onSignOut} className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }} title={`Signed in as ${userEmail} — click to sign out`} id="sign-out-btn">
            <LogOut size={13} />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>
          </button>
        ) : (
          <button onClick={onSignIn} className="btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }} id="sign-in-btn">
            <LogIn size={13} />
            <span>Sign in</span>
          </button>
        ))}

        <div className="streak-pill">
          <Flame size={14} />
          <span>{streakCount}-day streak</span>
        </div>
      </div>
    </header>
  );
}
