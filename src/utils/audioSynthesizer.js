// Web Audio API Ambient Sound Synthesizer (Zero external dependencies)
let audioCtx = null;
let currentSource = null;
let currentGain = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playAmbientSound(type = 'brown_noise', volume = 0.2) {
  stopAmbientSound();
  const ctx = getAudioContext();
  if (!ctx) return;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.connect(ctx.destination);
  currentGain = gainNode;

  if (type === 'brown_noise' || type === 'white_noise' || type === 'rain') {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'brown_noise') {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain compensation
      } else if (type === 'rain') {
        // Soft filtered pink/rain texture
        data[i] = (lastOut + 0.06 * white) / 1.06;
        lastOut = data[i];
        data[i] *= 2.0;
      } else {
        data[i] = white * 0.4;
      }
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = type === 'rain' ? 800 : (type === 'brown_noise' ? 400 : 1200);

    noise.connect(filter);
    filter.connect(gainNode);
    noise.start();
    currentSource = noise;
  } else if (type === 'binaural_alpha') {
    // 40Hz Gamma or 10Hz Alpha Binaural beat generator
    const oscLeft = ctx.createOscillator();
    const oscRight = ctx.createOscillator();
    const merger = ctx.createChannelMerger(2);

    oscLeft.frequency.value = 200; // Base carrier 200 Hz
    oscRight.frequency.value = 210; // 10 Hz Alpha focus beat

    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);
    merger.connect(gainNode);

    oscLeft.start();
    oscRight.start();
    currentSource = {
      stop: () => {
        try {
          oscLeft.stop();
          oscRight.stop();
        } catch {
          // ignore
        }
      }
    };
  }
}

export function stopAmbientSound() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // ignore
    }
    currentSource = null;
  }
}

export function playCompletionChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // C Major triad celebratory chime (C5, E5, G5, C6)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + index * 0.12);

    noteGain.gain.setValueAtTime(0, now + index * 0.12);
    noteGain.gain.linearRampToValueAtTime(0.25, now + index * 0.12 + 0.04);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.9);

    osc.connect(noteGain);
    noteGain.connect(ctx.destination);

    osc.start(now + index * 0.12);
    osc.stop(now + index * 0.12 + 1.0);
  });
}
