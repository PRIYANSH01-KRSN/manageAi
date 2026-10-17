import React from 'react';
import { 
  CheckSquare, 
  Calendar, 
  Image as ImageIcon, 
  Brain, 
  Sliders, 
  Flame,
  Database
} from 'lucide-react';

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  streakCount, 
  backendOnline,
  taskCount = 0
}) {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <h1 className="brand-title">Chronos</h1>
        <div className="db-badge" title="Persistent SQLite Database">
          <span className="db-indicator" style={{ background: backendOnline ? '#ffffff' : '#71717a' }} />
          <span>{backendOnline ? 'SQLite Connected (3001)' : 'Offline Local'}</span>
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

      {/* Right Side Streak */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="streak-pill">
          <Flame size={14} />
          <span>{streakCount} Streak</span>
        </div>
      </div>
    </header>
  );
}
