import React from 'react';
import { X, Key, Sparkles, RefreshCw, Download, ShieldCheck } from 'lucide-react';

export function SettingsModal({ 
  isOpen, 
  onClose, 
  apiKey, 
  onSaveApiKey,
  onResetDemoData,
  onExportSchedule
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="modal-container" style={{ padding: '2rem' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          id="close-settings-modal-btn"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-primary)' }}>
          <Key size={20} />
          <h2 id="settings-modal-title" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
            System Settings & AI API Keys
          </h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          ChronosFlow AI includes a built-in deterministic cognitive scheduling engine and neural OCR simulator that runs 100% locally with zero latency and zero cost.
        </p>

        {/* Live Gemini Vision API Key field */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
            Optional: Google Gemini API Key (For live multimodal vision extraction)
          </label>
          <input
            type="password"
            className="input-field"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => onSaveApiKey(e.target.value)}
            id="gemini-api-key-input"
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
            Stored strictly in your local browser storage. Never transmitted to third parties.
          </div>
        </div>

        {/* Data Utilities */}
        <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#c7d2fe' }}>
            Data Management & Presets
          </h3>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="btn-secondary" 
              onClick={onResetDemoData}
              title="Reload sample study and work backlog presets"
              id="reset-demo-presets-btn"
            >
              <RefreshCw size={15} />
              <span>Reset Demo Presets</span>
            </button>

            <button 
              className="btn-secondary" 
              onClick={onExportSchedule}
              title="Download your schedule and tasks as JSON"
              id="export-schedule-json-btn"
            >
              <Download size={15} />
              <span>Export Schedule JSON</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose} id="close-settings-save-btn">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
