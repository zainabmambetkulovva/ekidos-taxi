/**
 * Sound effects using HTML5 Audio with inline base64 WAV
 * Works on all devices including mobile WebView
 */

// Generate a simple WAV file programmatically (beep sound)
function generateWav(frequency: number, duration: number, volume: number = 0.3): string {
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);

  // Generate sine wave with fade out
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const fade = Math.max(0, 1 - t / duration); // fade out
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * fade * 32767;
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample)), true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Generate multi-tone sound (chord/arpeggio)
function generateMultiTone(frequencies: number[], duration: number, volume: number = 0.2): string {
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const fade = Math.max(0, 1 - t / duration);
    let sample = 0;
    frequencies.forEach((freq, idx) => {
      const delay = idx * 0.1; // stagger each note
      if (t >= delay) {
        const localT = t - delay;
        const localFade = Math.max(0, 1 - localT / (duration - delay));
        sample += Math.sin(2 * Math.PI * freq * localT) * localFade;
      }
    });
    sample = sample / frequencies.length * volume * fade * 32767;
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample)), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Pre-generate sounds
let clickSoundData: string | null = null;
let successSoundData: string | null = null;
let welcomeSoundData: string | null = null;
let alertSoundData: string | null = null;

function getClickSound(): string {
  if (!clickSoundData) clickSoundData = generateWav(1000, 0.05, 0.3);
  return clickSoundData;
}

function getSuccessSound(): string {
  if (!successSoundData) successSoundData = generateMultiTone([523, 659, 784, 1047], 0.6, 0.25);
  return successSoundData;
}

function getWelcomeSound(): string {
  if (!welcomeSoundData) welcomeSoundData = generateMultiTone([392, 523, 659], 2.5, 0.15);
  return welcomeSoundData;
}

function getAlertSound(): string {
  if (!alertSoundData) alertSoundData = generateWav(880, 0.8, 0.4);
  return alertSoundData;
}

// Play functions
export function playClickSound() {
  try {
    const audio = new Audio(getClickSound());
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
}

export function playSuccessSound() {
  try {
    const audio = new Audio(getSuccessSound());
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}

export function playWelcomeSound() {
  try {
    const audio = new Audio(getWelcomeSound());
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch {}
}

export function playOrderAlertSound() {
  try {
    const audio = new Audio(getAlertSound());
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

export function unlockAudio() {
  // Not needed with HTML5 Audio approach, but keep for compatibility
}
