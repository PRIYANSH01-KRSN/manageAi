import React, { useState } from 'react';
import { Upload, Trash2, Plus, Clock, MapPin, Check } from 'lucide-react';
import { parseTimetableImage } from '../services/visionTimetableParser';
import { parseTimetableWithGeminiVisionApi } from '../services/apiClient';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TimetableImporter({ 
  fixedSchedule = [], 
  onAddEvent,
  onDeleteEvent,
  onToggleGap,
  onBatchAdd
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [allowGapStudy, setAllowGapStudy] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      setIsScanning(true);
      setUploadDone(false);
      try {
        // Try live Gemini Vision API
        let events = null;
        try {
          const res = await parseTimetableWithGeminiVisionApi(ev.target.result);
          if (res?.events && res.events.length > 0) {
            events = res.events;
          }
        } catch {
          // fallback to local parser
        }

        if (!events) {
          events = await parseTimetableImage(ev.target.result);
        }

        onBatchAdd(events);
        setUploadDone(true);
      } catch (err) {
        console.error('OCR Error', err);
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddEvent({
      id: `fe-${Date.now()}`,
      title,
      location,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      allowGapStudy,
      source: 'MANUAL',
    });

    setTitle('');
    setLocation('');
    setShowManual(false);
  };

  return (
    <div className="mono-card" style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Timetable & Schedule OCR
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
            Upload class schedules or recurring shifts. The engine protects mandatory 20m post-class rest buffers.
          </p>
        </div>

        <button 
          className="btn-secondary"
          onClick={() => setShowManual(!showManual)}
        >
          <Plus size={14} />
          <span>{showManual ? 'Cancel' : 'Add Fixed Event'}</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div style={{ 
        border: '1px dashed var(--border-strong)', 
        borderRadius: 'var(--radius-md)', 
        padding: '2.5rem 1.5rem', 
        textAlign: 'center',
        background: 'var(--bg-card-subtle)',
        position: 'relative',
        marginBottom: '2rem'
      }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          id="timetable-file-upload-input"
        />

        <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', border: '1px solid var(--border-strong)', marginBottom: '0.75rem' }}>
          <Upload size={22} color="#ffffff" />
        </div>

        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.25rem' }}>
          {isScanning ? 'Extracting Schedule via Neural OCR...' : 'Click or Drop Timetable Image Here'}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Supports screenshots, syllabus photos, or PDFs. Automatic gap and lecture extraction.
        </p>

        {uploadDone && (
          <div style={{ marginTop: '0.75rem', color: '#ffffff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <Check size={14} /> Schedule parsed and synced to database!
          </div>
        )}
      </div>

      {/* Manual Form */}
      {showManual && (
        <form onSubmit={handleManualSubmit} style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>Add Class / Event</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Title *</label>
              <input type="text" className="input-field" placeholder="e.g. Physics Lecture" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Location / Room</label>
              <input type="text" className="input-field" placeholder="e.g. Hall 3" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Day of Week</label>
              <select className="input-field" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Start Time</label>
              <input type="time" className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>End Time</label>
              <input type="time" className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={allowGapStudy} onChange={(e) => setAllowGapStudy(e.target.checked)} style={{ accentColor: '#ffffff' }} />
              <span>Allow optional quick review in gap following this event</span>
            </label>
            <button type="submit" className="btn-primary">Save Event</button>
          </div>
        </form>
      )}

      {/* List of Fixed Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {fixedSchedule.map((ev) => (
          <div
            key={ev.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#ffffff' }}>{ev.title}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                <span className="badge">{DAYS[ev.dayOfWeek]}</span>
                <span>{ev.startTime} - {ev.endTime}</span>
                {ev.location && <span>• {ev.location}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => onToggleGap(ev.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.25rem 0.65rem',
                  color: ev.allowGapStudy ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                {ev.allowGapStudy ? 'Gap: Review Allowed' : 'Gap: Protected Rest'}
              </button>

              <button
                onClick={() => onDeleteEvent(ev.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
