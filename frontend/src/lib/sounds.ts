/**
 * Sound effects using Web Audio API
 * No sound files needed - all generated programmatically
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// Soft welcome sound - calm chime when app loads
export function playWelcomeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

  // C5 note
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523, now);
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.6);

  // E5 note (delayed)
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659, now + 0.2);
  osc2.connect(gain);
  osc2.start(now + 0.2);
  osc2.stop(now + 0.8);

  // G5 note (delayed more)
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(784, now + 0.4);
  osc3.connect(gain);
  osc3.start(now + 0.4);
  osc3.stop(now + 1.2);
}

// Short click sound for button presses
export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.08);
}

// Alert sound for new order - urgent, attention-grabbing
export function playOrderAlertSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.setValueAtTime(0.3, now + 1.5);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 2);

  // Urgent beep pattern: high-low-high-low-high
  const freqs = [880, 660, 880, 660, 880];
  const duration = 0.3;

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * duration);
    osc.connect(gain);
    osc.start(now + i * duration);
    osc.stop(now + i * duration + duration * 0.8);
  });
}

// Success sound for balance topup - pleasant ascending
export function playSuccessSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

  // Ascending: C5 → E5 → G5 → C6 (fast arpeggio)
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.1);
    osc.connect(gain);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
}
