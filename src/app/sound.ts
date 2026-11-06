import type { FeedbackEvent } from "./feedback.ts";

/** The parts of the Web Audio API the sounds use, so tests can supply a fake. */
export type AudioContextFactory = () => AudioContext;

type Voice = (context: AudioContext, output: AudioNode, at: number) => void;

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** A short burst of filtered noise: the snap or slide of a card. */
function noise(frequency: number, seconds: number, level: number, type: BiquadFilterType): Voice {
  return (context, output, at) => {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, seconds);
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    source.connect(filter).connect(gain).connect(output);
    source.start(at);
    source.stop(at + seconds);
  };
}

/** A sine tone with a quick attack and decay, for chimes and the soft "no" tone. */
function tone(frequency: number, seconds: number, level: number, delay = 0): Voice {
  return (context, output, at) => {
    const start = at + delay;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + seconds);
  };
}

const SOUNDS: Readonly<Record<FeedbackEvent, readonly Voice[]>> = {
  pickup: [noise(3000, 0.03, 0.15, "highpass")],
  drop: [noise(2200, 0.05, 0.4, "bandpass")],
  draw: [noise(1600, 0.07, 0.3, "bandpass")],
  flip: [noise(4000, 0.04, 0.25, "highpass")],
  invalid: [tone(150, 0.16, 0.25)],
  foundation: [noise(2200, 0.04, 0.3, "bandpass"), tone(880, 0.25, 0.12, 0.02)],
  complete: [tone(660, 0.3, 0.15), tone(990, 0.4, 0.12, 0.08)],
  win: [523.25, 659.25, 783.99, 1046.5].map((note, i) => tone(note, 0.6, 0.18, i * 0.12)),
};

export interface SoundPlayer {
  /** Turns sound on or off. The audio context is only created once sound is on. */
  configure(enabled: boolean, volume: number): void;
  /** Must be called from a user gesture (browsers, iOS especially, require one). */
  unlock(): void;
  play(event: FeedbackEvent): void;
  hasContext(): boolean;
}

export function createSoundPlayer(createContext: AudioContextFactory): SoundPlayer {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let enabled = false;
  let volume = 0.6;

  const ensure = (): AudioContext | undefined => {
    if (!enabled) {
      return undefined;
    }
    if (context === undefined) {
      context = createContext();
      master = context.createGain();
      master.connect(context.destination);
    }
    if (master !== undefined) {
      master.gain.value = volume;
    }
    if (context.state === "suspended") {
      context.resume().catch((error: unknown) => {
        console.warn("Audio could not start", error);
      });
    }
    return context;
  };

  return {
    configure: (on, level) => {
      enabled = on;
      volume = level;
      if (master !== undefined) {
        master.gain.value = level;
      }
    },
    unlock: () => {
      ensure();
    },
    play: (event) => {
      // Sounds follow user actions, so the context is never created without a gesture.
      const audio = ensure();
      if (audio === undefined || master === undefined) {
        return;
      }
      for (const voice of SOUNDS[event]) {
        voice(audio, master, audio.currentTime);
      }
    },
    hasContext: () => context !== undefined,
  };
}
