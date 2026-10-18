import React, { useState } from 'react';
import { Sliders, Flame, LogIn, LogOut, Sun, Moon, MoreHorizontal } from 'lucide-react';

// Simple by default: the three things an anxious student needs. Everything else is under "More".
const PRIMARY_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'timeline', label: 'Plan' },
  { id: 'backlog', label: 'My work' },
];
const MORE_TABS = [
  { id: 'focus', label: 'Focus timer' },
  { id: 'energy', label: 'Focus My Energy' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'analytics', label: 'Insights' },
  { id: 'habits', label: 'Habits & routine' },
];

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
  onSignOut,
  theme,
  onToggleTheme,
}) {
  const [showMore, setShowMore] = useState(() => MORE_TABS.some((t) => t.id === activeTab));
  const tabs = showMore || MORE_TABS.some((t) => t.id === activeTab) ? [...PRIMARY_TABS, ...MORE_TABS] : PRIMARY_TABS;

  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <h1 className="brand-title">Manage by AI</h1>
        <div className="db-badge" title="Where your plan is saved">
          <span className="db-indicator" style={{ background: backendOnline ? 'var(--fg)' : 'var(--text-muted)' }} />
          <span>{storageLabel || (backendOnline ? 'Synced' : 'Saved on this device')}</span>
        </div>
      </div>

      <nav className="nav-tab-container" aria-label="Main navigation">
        {tabs.map((t) => (
          <button key={t.id} className={`nav-tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)} id={`nav-${t.id}-btn`}>
            <span>{t.id === 'backlog' && taskCount ? `${t.label} (${taskCount})` : t.label}</span>
          </button>
        ))}
        <button className="nav-tab-btn" onClick={() => setShowMore(!showMore)} aria-expanded={showMore} id="nav-more-btn" title={showMore ? 'Show fewer' : 'More tools'}>
          <MoreHorizontal size={16} />
          <span>{showMore ? 'Less' : 'More'}</span>
        </button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={onToggleTheme}
          className="icon-btn"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          id="theme-toggle-btn"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <button onClick={onOpenGuide} className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} title="How ChronosFlow works" id="guide-tour-nav-btn">
          <span>Guide</span>
        </button>

        <button onClick={onOpenOnboarding} className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} title="Set up your sleep, meals and rhythm" id="routine-setup-nav-btn">
          <Sliders size={13} />
          <span>Routine</span>
        </button>

        {authEnabled && (userEmail ? (
          <button onClick={onSignOut} className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} title={`Signed in as ${userEmail} — click to sign out`} id="sign-out-btn">
            <LogOut size={13} />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>
          </button>
        ) : (
          <button onClick={onSignIn} className="btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} id="sign-in-btn">
            <LogIn size={13} />
            <span>Sign in</span>
          </button>
        ))}

        <div className="streak-pill" title="Study days in a row (one missed day a week is forgiven)">
          <Flame size={14} />
          <span>{streakCount}-day streak</span>
        </div>
      </div>
    </header>
  );
}
