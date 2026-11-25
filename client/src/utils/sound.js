// Web Audio API POS scanner sound generator
let audioCtx = null;

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

export function playBeep(type = 'success') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Supermarket scanner chime (1800Hz quick beep)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'error') {
      // Low double buzz for error/not found
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'cash') {
      // Cash register ding
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }

    // Trigger haptic vibration on Android devices
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'success' ? 60 : 150);
    }
  } catch (e) {
    console.warn('Audio play skipped:', e);
  }
}
