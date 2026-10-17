import React, { useEffect, useState } from 'react';
import { X, LogIn, Mail } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabaseClient';

export function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('signin'); // signin | signup | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Only offer Google when it's switched on in Supabase (otherwise it lands on an error page).
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } })
      .then((r) => r.json())
      .then((s) => setGoogleEnabled(Boolean(s?.external?.google)))
      .catch(() => setGoogleEnabled(false));
  }, [isOpen]);

  if (!isOpen || !supabase) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) onClose();
        else setMessage({ type: 'ok', text: 'Account created. Check your email to confirm, then sign in.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage({ type: 'ok', text: 'If that email has an account, a reset link is on its way.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setMessage({ type: '', text: '' });
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setMessage({ type: 'error', text: error.message.includes('not enabled') ? 'Google sign-in is not enabled yet. Use email instead.' : error.message });
  };

  const titles = { signin: 'Sign in to sync your plan', signup: 'Create your free account', reset: 'Reset your password' };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: '420px', padding: '2rem' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>{titles[mode]}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Your tasks, check-ins and progress are saved to your account and follow you to any device. Only you can see them.
        </p>

        {mode !== 'reset' && googleEnabled && (
          <>
            <button type="button" className="btn-secondary" style={{ width: '100%', marginBottom: '0.85rem' }} onClick={handleGoogle}>
              Continue with Google
            </button>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '0.85rem' }}>or with email</div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input className="input-field" type="email" autoComplete="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {mode !== 'reset' && (
            <input
              className="input-field"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
              minLength={mode === 'signup' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
          {message.text && (
            <div style={{ fontSize: '0.78rem', color: message.type === 'error' ? '#fca5a5' : 'var(--text-secondary)' }}>{message.text}</div>
          )}
          <button type="submit" className="btn-primary" disabled={busy} id="auth-submit-btn">
            {mode === 'reset' ? <Mail size={14} /> : <LogIn size={14} />}
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.75rem' }}>
          {mode === 'signin' ? (
            <>
              <button type="button" onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: '#ffffff', textDecoration: 'underline', cursor: 'pointer' }}>Create an account</button>
              <button type="button" onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>Forgot password?</button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('signin')} style={{ background: 'none', border: 'none', color: '#ffffff', textDecoration: 'underline', cursor: 'pointer' }}>Back to sign in</button>
          )}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '1rem' }}>
          No account? You can keep using ChronosFlow in this browser — your data just stays on this device.
        </div>
      </div>
    </div>
  );
}
