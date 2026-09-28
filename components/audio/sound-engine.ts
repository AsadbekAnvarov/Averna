/**
 * Averna sound engine — everything is synthesised live with the Web Audio API
 * (no audio files to download). Client-only; import from client components.
 *
 * Interface sounds come in three "packs" (Soft marimba, Glass bells, Minimal
 * ticks). Ambient atmospheres are generative scenes that never loop audibly:
 * a warm evolving chord pad, soft rain, ocean waves, a night garden and a
 * slow cosmic music-box. Both buses share a gentle synthetic reverb.
 */

export type UiSound = "tap" | "toggle" | "success" | "error" | "notify";
export type UiPack = "soft" | "glass" | "minimal";
export type Scene = "focus" | "rain" | "ocean" | "night" | "cosmos";

export const UI_PACKS: { key: UiPack; label: string; desc: string }[] = [
  { key: "soft", label: "Soft", desc: "Warm wooden marimba" },
  { key: "glass", label: "Glass", desc: "Airy crystal bells" },
  { key: "minimal", label: "Minimal", desc: "Barely-there ticks" },
];

export const SCENES: { key: Scene; label: string; desc: string; emoji: string }[] = [
  { key: "focus", label: "Deep Focus", desc: "Warm, slowly evolving chords", emoji: "🎹" },
  { key: "rain", label: "Soft Rain", desc: "Gentle rain on the window", emoji: "🌧️" },
  { key: "ocean", label: "Ocean Waves", desc: "Slow waves rolling in", emoji: "🌊" },
  { key: "night", label: "Night Garden", desc: "Crickets and a light breeze", emoji: "🌙" },
  { key: "cosmos", label: "Cosmic Drift", desc: "A music box floating in space", emoji: "✨" },
];

type ToneOpts = {
  freq: number;
  when?: number;
  attack?: number;
  decay: number;
  gain: number;
  type?: OscillatorType;
  fmRatio?: number;
  fmIndex?: number;
  overtone?: number; // gain of a quick-decaying 4× partial (marimba "knock")
  lowpass?: number;
  send?: number; // reverb send 0..1
  sendTo?: AudioNode; // reverb input (defaults to the UI bus reverb)
  pan?: number;
};

const SCENE_TRIM: Record<Scene, number> = { focus: 2, rain: 2.1, ocean: 2.2, night: 4.6, cosmos: 2 };

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export class SoundEngine {
  readonly ctx: AudioContext;
  private uiBus: GainNode;
  private ambBus: GainNode;
  private uiRevIn: GainNode;
  private ambRevIn: GainNode;
  private noise: Record<"white" | "pink" | "brown", AudioBuffer>;
  private scene: { key: Scene; stop: () => void } | null = null;

  constructor() {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 6;
    limiter.connect(ctx.destination);

    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = 0.6;
    this.uiBus.connect(limiter);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.5;
    this.ambBus.connect(limiter);

    // One reverb per bus, so each volume slider also scales its own echo.
    const ir = this.impulse(2.8, 2.6);
    const makeReverb = (bus: GainNode, amount: number) => {
      const input = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = amount;
      input.connect(conv).connect(wet).connect(bus);
      return input;
    };
    this.uiRevIn = makeReverb(this.uiBus, 0.8);
    this.ambRevIn = makeReverb(this.ambBus, 0.9);

    this.noise = { white: this.noiseBuffer("white"), pink: this.noiseBuffer("pink"), brown: this.noiseBuffer("brown") };
  }

  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setUiVolume(v: number) {
    this.uiBus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
  }

  setAmbientVolume(v: number) {
    this.ambBus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.3);
  }

  /* ---------------------------------------------------------- building blocks */

  private impulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noiseBuffer(kind: "white" | "pink" | "brown"): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = rate * 6;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
      // Cross-fade the loop point so the noise loops seamlessly.
      const fade = Math.floor(rate * 0.05);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        d[i] = d[i] * t + d[len - fade + i] * (1 - t);
      }
    }
    return buf;
  }

  private noiseSource(kind: "white" | "pink" | "brown"): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[kind];
    src.loop = true;
    src.loopEnd = src.buffer.duration - 0.05;
    return src;
  }

  /** A short enveloped tone (optionally FM for bell timbres) into a bus. */
  private tone(
    dest: AudioNode,
    o: ToneOpts
  ) {
    const ctx = this.ctx;
    const t = o.when ?? ctx.currentTime;
    const a = o.attack ?? 0.004;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(o.gain, t + a);
    out.gain.exponentialRampToValueAtTime(0.0001, t + a + o.decay);

    let node: AudioNode = out;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.lowpass;
      out.connect(f);
      node = f;
    }
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node.connect(p);
      node = p;
    }
    node.connect(dest);
    if (o.send) {
      const s = ctx.createGain();
      s.gain.value = o.send;
      node.connect(s).connect(o.sendTo ?? this.uiRevIn);
    }

    const end = t + a + o.decay + 0.05;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.value = o.freq;
    osc.connect(out);
    osc.start(t);
    osc.stop(end);

    if (o.fmRatio) {
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.frequency.value = o.freq * o.fmRatio;
      const idx = (o.fmIndex ?? 2) * o.freq;
      modGain.gain.setValueAtTime(idx, t);
      modGain.gain.exponentialRampToValueAtTime(idx * 0.02 + 0.01, t + o.decay * 0.8);
      mod.connect(modGain).connect(osc.frequency);
      mod.start(t);
      mod.stop(end);
    }
    if (o.overtone) {
      const ov = ctx.createOscillator();
      const og = ctx.createGain();
      ov.frequency.value = o.freq * 4;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(o.gain * o.overtone, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      ov.connect(og).connect(out);
      ov.start(t);
      ov.stop(t + 0.08);
    }
  }

  private tick(dest: AudioNode, when: number, gain: number, freq = 3200) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise.white;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    src.connect(bp).connect(g).connect(dest);
    src.start(when, Math.random() * 4, 0.06);
  }

  /* ------------------------------------------------------------ UI sounds */

  play(sound: UiSound, pack: UiPack) {
    this.resume();
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.005;
    const bus = this.uiBus;

    if (pack === "minimal") {
      if (sound === "tap") return this.tick(bus, now, 0.3);
      const notes: Record<UiSound, number[]> = {
        tap: [], toggle: [84], success: [84, 91], error: [72, 67], notify: [88],
      };
      notes[sound].forEach((m, i) =>
        this.tone(bus, { freq: mtof(m), when: now + i * 0.07, decay: 0.09, gain: 0.07, send: 0.1 })
      );
      return;
    }

    if (pack === "glass") {
      const seq: Record<UiSound, number[]> = {
        tap: [96], toggle: [91, 98], success: [84, 88, 91, 96], error: [79, 75], notify: [93, 100],
      };
      const step = sound === "success" ? 0.075 : 0.06;
      seq[sound].forEach((m, i) =>
        this.tone(bus, {
          freq: mtof(m),
          when: now + i * step,
          decay: sound === "tap" ? 0.35 : 0.9,
          gain: sound === "tap" ? 0.05 : 0.07,
          fmRatio: 3.5,
          fmIndex: sound === "tap" ? 0.6 : 1.2,
          send: 0.45,
          pan: seq[sound].length > 1 ? (i % 2 ? 0.25 : -0.25) : 0,
        })
      );
      return;
    }

    // soft (marimba)
    const seq: Record<UiSound, number[]> = {
      tap: [79], toggle: [74, 81], success: [72, 76, 79, 84], error: [69, 65], notify: [81, 88],
    };
    const step = sound === "success" ? 0.085 : 0.07;
    seq[sound].forEach((m, i) =>
      this.tone(bus, {
        freq: mtof(m),
        when: now + i * step,
        decay: sound === "tap" ? 0.14 : sound === "error" ? 0.3 : 0.4,
        gain: sound === "tap" ? 0.08 : 0.1,
        overtone: 0.35,
        lowpass: 3800,
        send: 0.18,
      })
    );
  }

  /* ------------------------------------------------------ ambient scenes */

  get currentScene(): Scene | null {
    return this.scene?.key ?? null;
  }

  startScene(key: Scene) {
    this.resume();
    if (this.scene?.key === key) return;
    this.stopScene();
    const t0 = this.ctx.currentTime;
    // Dry and reverb-send paths of this scene, faded in/out together.
    const out = this.ctx.createGain();
    const wet = this.ctx.createGain();
    out.connect(this.ambBus);
    wet.connect(this.ambRevIn);
    // Per-scene trim so every atmosphere sits at a similar loudness.
    const level = SCENE_TRIM[key];
    for (const g of [out, wet]) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + 3);
    }
    const stopInner = this.buildScene(key, out, wet);
    this.scene = {
      key,
      stop: () => {
        const t = this.ctx.currentTime;
        for (const g of [out, wet]) {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        }
        setTimeout(() => {
          stopInner();
          out.disconnect();
          wet.disconnect();
        }, 1700);
      },
    };
  }

  stopScene() {
    this.scene?.stop();
    this.scene = null;
  }

  private buildScene(key: Scene, out: GainNode, wet: GainNode): () => void {
    const ctx = this.ctx;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sources: (AudioScheduledSourceNode)[] = [];
    let alive = true;
    const every = (fn: () => void, min: number, max: number, first = rand(200, min)) => {
      const loop = () => {
        if (!alive) return;
        fn();
        timers.push(setTimeout(loop, rand(min, max)));
      };
      timers.push(setTimeout(loop, first));
    };
    const send = (node: AudioNode, amount: number) => {
      const g = ctx.createGain();
      g.gain.value = amount;
      node.connect(g).connect(wet);
    };
    // Scene tones: dry into the scene, echo into the scene's reverb send.
    const tone = (o: ToneOpts) => this.tone(out, { ...o, sendTo: wet });
    const lfo = (param: AudioParam, rate: number, depth: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = rate;
      g.gain.value = depth;
      o.connect(g).connect(param);
      o.start();
      sources.push(o);
    };
    const noiseLayer = (kind: "white" | "pink" | "brown", type: BiquadFilterType, freq: number, gain: number, q = 0.7) => {
      const src = this.noiseSource(kind);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(out);
      src.start(0, Math.random() * 5);
      sources.push(src);
      return { f, g };
    };

    switch (key) {
      case "focus": {
        // Four lush chords (Fmaj9 → Am9 → Cmaj9 → G6/9), each fading into the next.
        const chords = [
          [41, 53, 57, 60, 64, 67],
          [45, 52, 55, 59, 60, 64],
          [36, 48, 52, 55, 59, 62],
          [43, 50, 55, 57, 59, 64],
        ];
        const bus = ctx.createBiquadFilter();
        bus.type = "lowpass";
        bus.frequency.value = 900;
        bus.Q.value = 0.4;
        lfo(bus.frequency, 0.05, 350);
        const level = ctx.createGain();
        level.gain.value = 0.05;
        bus.connect(level).connect(out);
        send(level, 0.8);
        let i = 0;
        const LEN = 9;
        const playChord = () => {
          const t = ctx.currentTime;
          chords[i++ % chords.length].forEach((m, n) => {
            [-6, 6].forEach((cents) => {
              const o = ctx.createOscillator();
              o.type = n === 0 ? "sine" : "triangle";
              o.frequency.value = mtof(m);
              o.detune.value = cents + rand(-2, 2);
              const g = ctx.createGain();
              g.gain.setValueAtTime(0.0001, t);
              g.gain.exponentialRampToValueAtTime(n === 0 ? 0.9 : 0.45, t + 3.5);
              g.gain.setValueAtTime(n === 0 ? 0.9 : 0.45, t + LEN - 1);
              g.gain.exponentialRampToValueAtTime(0.0001, t + LEN + 3);
              o.connect(g).connect(bus);
              o.start(t);
              o.stop(t + LEN + 3.2);
            });
          });
          // A soft high "glint" now and then
          if (Math.random() < 0.6) {
            const top = chords[(i - 1) % chords.length];
            tone({ freq: mtof(pick(top.slice(3)) + 12), when: t + rand(2, 6), attack: 0.02, decay: 2.5, gain: 0.018, send: 0.9, pan: rand(-0.5, 0.5) });
          }
        };
        every(playChord, LEN * 1000, LEN * 1000, 0);
        break;
      }

      case "rain": {
        noiseLayer("pink", "lowpass", 5200, 0.22);
        const hiss = noiseLayer("white", "highpass", 6000, 0.035);
        lfo(hiss.g.gain, 0.13, 0.012);
        noiseLayer("brown", "lowpass", 180, 0.25);
        // Individual drops on the glass
        every(() => {
          const t = ctx.currentTime;
          for (let k = 0; k < 3; k++) {
            tone({
              freq: rand(1800, 4200), when: t + rand(0, 0.25), attack: 0.001, decay: rand(0.02, 0.05),
              gain: rand(0.006, 0.02), send: 0.35, pan: rand(-0.8, 0.8),
            });
          }
        }, 120, 420);
        break;
      }

      case "ocean": {
        const bed = noiseLayer("brown", "lowpass", 400, 0.12);
        const foam = noiseLayer("pink", "bandpass", 900, 0.0001, 0.5);
        send(foam.g, 0.4);
        const wave = () => {
          const t = ctx.currentTime;
          const len = rand(7, 11);
          const peak = rand(0.28, 0.45);
          bed.g.gain.setTargetAtTime(peak, t, len * 0.18);
          bed.g.gain.setTargetAtTime(0.1, t + len * 0.5, len * 0.2);
          bed.f.frequency.setTargetAtTime(rand(900, 1300), t, len * 0.2);
          bed.f.frequency.setTargetAtTime(350, t + len * 0.5, len * 0.2);
          foam.g.gain.setTargetAtTime(rand(0.05, 0.09), t + len * 0.35, 0.5);
          foam.g.gain.setTargetAtTime(0.0001, t + len * 0.55, len * 0.15);
          foam.f.frequency.setTargetAtTime(rand(1800, 2600), t + len * 0.35, 0.8);
          foam.f.frequency.setTargetAtTime(800, t + len * 0.6, 1.5);
        };
        every(wave, 7000, 11000);
        break;
      }

      case "night": {
        const wind = noiseLayer("pink", "bandpass", 500, 0.2, 0.8);
        lfo(wind.f.frequency, 0.07, 250);
        lfo(wind.g.gain, 0.05, 0.09);
        // Crickets: bursts of quick chirps, left and right
        const cricket = (pan: number) => () => {
          const t = ctx.currentTime;
          const f = rand(4200, 4800);
          const n = Math.floor(rand(3, 7));
          for (let k = 0; k < n; k++) {
            tone({ freq: f, when: t + k * 0.055, attack: 0.004, decay: 0.03, gain: 0.03, pan, send: 0.3 });
          }
        };
        every(cricket(-0.6), 900, 2600);
        every(cricket(0.55), 1300, 3400);
        // An occasional distant owl-like low tone
        every(() => {
          const t = ctx.currentTime;
          [0, 0.45].forEach((d) => tone({ freq: 392, when: t + d, attack: 0.08, decay: 0.35, gain: 0.03, lowpass: 900, send: 0.9, pan: rand(-0.4, 0.4) }));
        }, 16000, 30000);
        break;
      }

      case "cosmos": {
        // Low, breathing drone
        [36, 43].forEach((m) => {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = mtof(m);
          const g = ctx.createGain();
          g.gain.value = 0.035;
          lfo(g.gain, rand(0.03, 0.06), 0.015);
          o.connect(g).connect(out);
          o.start();
          sources.push(o);
        });
        // Music-box notes from a dreamy pentatonic scale
        const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
        every(() => {
          const t = ctx.currentTime;
          tone({
            freq: mtof(pick(scale) + 12), when: t, attack: 0.005, decay: rand(1.8, 3), gain: rand(0.018, 0.03),
            fmRatio: 3.01, fmIndex: 0.4, send: 1, pan: rand(-0.7, 0.7),
          });
        }, 900, 2800);
        break;
      }
    }

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      sources.forEach((s) => {
        try { s.stop(); } catch { /* already stopped */ }
      });
    };
  }
}
