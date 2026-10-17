import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Volume2, VolumeX, CheckCircle, Headphones, Sparkles } from 'lucide-react';
import { playAmbientSound, stopAmbientSound, playCompletionChime } from '../utils/audioSynthesizer';
import confetti from 'canvas-confetti';

export function FocusTimerModal({ block, onClose, onComplete }) {
  const initialSeconds = (block?.rawDuration || 25) * 60;
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
  const [soundType, setSoundType] = useState('brown_noise'); // 'brown_noise', 'rain', 'binaural_alpha', 'none'
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((sec) => sec - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      handleTimerFinish();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  // Ambient sound management
  useEffect(() => {
    if (isActive && !isMuted && soundType !== 'none') {
      playAmbientSound(soundType, 0.18);
    } else {
      stopAmbientSound();
    }
    return () => {
      stopAmbientSound();
    };
  }, [isActive, isMuted, soundType]);

  const handleTimerFinish = () => {
    stopAmbientSound();
    playCompletionChime();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    onComplete(block);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progressPercent = ((initialSeconds - secondsLeft) / initialSeconds) * 100;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-modal-title">
      <div className="modal-container" style={{ maxWidth: '580px', padding: '2.5rem', textAlign: 'center', background: '#0b101d' }}>
        {/* Close Button */}
        <button 
          onClick={() => { stopAmbientSound(); onClose(); }}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          id="close-focus-timer-btn"
        >
          <X size={22} />
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem' }}>
          <Sparkles size={14} /> FOCUSED SPRINT IN PROGRESS
        </div>

        <h2 id="focus-modal-title" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
          {block.taskTitle}
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Eliminate all distractions. Your phone and tabs can wait.
        </p>

        {/* Big Mono Countdown Display */}
        <div style={{ 
          fontSize: '4.5rem', 
          fontFamily: 'var(--font-mono)', 
          fontWeight: 800, 
          letterSpacing: '-0.04em', 
          color: '#ffffff',
          textShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
          marginBottom: '1rem'
        }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        {/* Progress Bar */}
        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden', maxWidth: '380px', margin: '0 auto 2rem auto' }}>
          <div style={{ 
            width: `${progressPercent}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, #6366f1, #06b6d4, #10b981)',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Audio Soundscape Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '0.5rem' }}>
            <Headphones size={15} /> Soundscape:
          </div>

          {[
            { id: 'brown_noise', label: 'Brown Noise' },
            { id: 'rain', label: 'Soft Rain' },
            { id: 'binaural_alpha', label: 'Alpha Waves' },
            { id: 'none', label: 'Silent' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => { setSoundType(s.id); setIsMuted(false); }}
              style={{
                background: soundType === s.id && !isMuted ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: soundType === s.id && !isMuted ? '#c7d2fe' : 'var(--text-muted)',
                border: soundType === s.id && !isMuted ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-card)',
                borderRadius: 'var(--radius-full)',
                padding: '0.3rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}

          <button 
            onClick={() => setIsMuted(!isMuted)} 
            style={{ background: 'transparent', border: 'none', color: isMuted ? '#f87171' : 'var(--text-muted)', cursor: 'pointer', marginLeft: '0.25rem' }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <button 
            className="btn-secondary"
            onClick={() => setIsActive(!isActive)}
            style={{ minWidth: '130px' }}
            id="pause-resume-timer-btn"
          >
            {isActive ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Resume</>}
          </button>

          <button 
            className="btn-emerald"
            onClick={handleTimerFinish}
            id="finish-timer-early-btn"
          >
            <CheckCircle size={18} />
            <span>Mark Completed</span>
          </button>
        </div>
      </div>
    </div>
  );
}
