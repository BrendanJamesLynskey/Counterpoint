/**
 * Instrument synthesis using Web Audio API.
 * Each instrument is defined by oscillator types, envelopes, and filtering.
 */
const Instruments = (() => {
  let audioCtx = null;
  let masterGain = null;

  function getContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function getMaster() {
    getContext();
    return masterGain;
  }

  // Instrument definitions
  const INSTRUMENTS = {
    'piano': {
      create(freq, duration, ctx, dest, velocity = 0.7) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'triangle';
        osc1.frequency.value = freq;
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        filter.type = 'lowpass';
        filter.frequency.value = Math.min(freq * 6, 8000);
        filter.Q.value = 1;

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(velocity * 0.5, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(velocity * 0.3, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(velocity * 0.15, now + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.95);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);

        return { stop: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05); }};
      }
    },

    'harpsichord': {
      create(freq, duration, ctx, dest, velocity = 0.7) {
        // Bright, plucked sound with quick decay
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.value = freq;
        osc2.type = 'square';
        osc2.frequency.value = freq;
        osc3.type = 'sawtooth';
        osc3.frequency.value = freq * 2.0; // octave above for brightness

        filter.type = 'lowpass';
        filter.frequency.value = Math.min(freq * 10, 12000);
        filter.Q.value = 2;

        const now = ctx.currentTime;
        const amp = velocity * 0.25;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(amp * 0.4, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(amp * 0.15, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        // Frequency-dependent decay on filter
        filter.frequency.setValueAtTime(Math.min(freq * 10, 12000), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 200), now + duration * 0.7);

        const mix1 = ctx.createGain();
        const mix2 = ctx.createGain();
        const mix3 = ctx.createGain();
        mix1.gain.value = 0.4;
        mix2.gain.value = 0.3;
        mix3.gain.value = 0.15;

        osc1.connect(mix1); mix1.connect(filter);
        osc2.connect(mix2); mix2.connect(filter);
        osc3.connect(mix3); mix3.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc1.start(now); osc2.start(now); osc3.start(now);
        osc1.stop(now + duration); osc2.stop(now + duration); osc3.stop(now + duration);

        return { stop: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.02); }};
      }
    },

    'church-organ': {
      create(freq, duration, ctx, dest, velocity = 0.7) {
        // Full organ: fundamental + multiple harmonics, sustained
        const harmonics = [1, 2, 3, 4, 5, 6, 8];
        const levels =    [0.5, 0.35, 0.2, 0.15, 0.1, 0.06, 0.04];
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const oscs = [];

        filter.type = 'lowpass';
        filter.frequency.value = Math.min(freq * 12, 10000);
        filter.Q.value = 0.5;

        const now = ctx.currentTime;
        const amp = velocity * 0.18;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.08);
        gain.gain.setValueAtTime(amp, now + duration - 0.15);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        harmonics.forEach((h, i) => {
          const osc = ctx.createOscillator();
          const hGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq * h;
          hGain.gain.value = levels[i];
          osc.connect(hGain);
          hGain.connect(filter);
          osc.start(now);
          osc.stop(now + duration);
          oscs.push(osc);
        });

        filter.connect(gain);
        gain.connect(dest);

        return { stop: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1); }};
      }
    },

    'baroque-organ': {
      create(freq, duration, ctx, dest, velocity = 0.7) {
        // Brighter, more "principal" sound with mixture-like upper partials
        const harmonics = [1, 2, 3, 4, 6, 8];
        const levels =    [0.4, 0.4, 0.25, 0.2, 0.12, 0.08];
        const gain = ctx.createGain();
        const oscs = [];

        const now = ctx.currentTime;
        const amp = velocity * 0.16;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.04);
        gain.gain.setValueAtTime(amp, now + duration - 0.1);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        harmonics.forEach((h, i) => {
          const osc = ctx.createOscillator();
          const hGain = ctx.createGain();
          osc.type = i < 2 ? 'sawtooth' : 'sine';
          osc.frequency.value = freq * h;
          hGain.gain.value = levels[i];
          osc.connect(hGain);
          hGain.connect(gain);
          osc.start(now);
          osc.stop(now + duration);
          oscs.push(osc);
        });

        // Add slight chorusing
        const chorusOsc = ctx.createOscillator();
        const chorusGain = ctx.createGain();
        chorusOsc.type = 'sine';
        chorusOsc.frequency.value = freq * 1.002;
        chorusGain.gain.value = 0.08 * velocity;
        chorusOsc.connect(chorusGain);
        chorusGain.connect(gain);
        chorusOsc.start(now);
        chorusOsc.stop(now + duration);

        gain.connect(dest);

        return { stop: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08); }};
      }
    },

    'reed-organ': {
      create(freq, duration, ctx, dest, velocity = 0.7) {
        // Reed-like: square waves with filtering for nasal quality
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const filter2 = ctx.createBiquadFilter();

        osc1.type = 'square';
        osc1.frequency.value = freq;
        osc2.type = 'sawtooth';
        osc2.frequency.value = freq * 1.001; // slight detune

        // Nasal / reedy quality via bandpass
        filter.type = 'bandpass';
        filter.frequency.value = freq * 3;
        filter.Q.value = 2;

        filter2.type = 'lowpass';
        filter2.frequency.value = Math.min(freq * 8, 8000);
        filter2.Q.value = 0.7;

        const now = ctx.currentTime;
        const amp = velocity * 0.2;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.06);
        gain.gain.setValueAtTime(amp, now + duration - 0.12);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        // Slight vibrato
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 5;
        lfoGain.gain.value = freq * 0.003;
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);
        lfo.start(now);
        lfo.stop(now + duration);

        const mix1 = ctx.createGain();
        const mix2 = ctx.createGain();
        mix1.gain.value = 0.5;
        mix2.gain.value = 0.3;

        osc1.connect(mix1);
        osc2.connect(mix2);
        mix1.connect(filter);
        mix2.connect(filter);
        filter.connect(filter2);
        filter2.connect(gain);
        gain.connect(dest);

        osc1.start(now); osc2.start(now);
        osc1.stop(now + duration); osc2.stop(now + duration);

        return { stop: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08); }};
      }
    },

    'flute-organ': {
      create(freq, duration, ctx, dest, velocity = 0.7) {
        // Gentle, pure flute stop: mostly sine with breath noise
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = freq;
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        filter.type = 'lowpass';
        filter.frequency.value = Math.min(freq * 4, 6000);
        filter.Q.value = 0.5;

        const now = ctx.currentTime;
        const amp = velocity * 0.3;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.06);
        gain.gain.setValueAtTime(amp, now + duration - 0.15);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        const mix2 = ctx.createGain();
        mix2.gain.value = 0.15;

        osc.connect(filter);
        osc2.connect(mix2);
        mix2.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(now); osc2.start(now);
        osc.stop(now + duration); osc2.stop(now + duration);

        return { stop: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1); }};
      }
    }
  };

  function playNote(instrumentName, midiNote, duration, velocity = 0.7) {
    const ctx = getContext();
    const dest = getMaster();
    const freq = MusicTheory.midiToFrequency(midiNote);
    const instrument = INSTRUMENTS[instrumentName];
    if (!instrument) return null;
    return instrument.create(freq, duration, ctx, dest, velocity);
  }

  function stopAll() {
    // Close and recreate on next use, so scheduled notes are silenced
    if (audioCtx) {
      try { audioCtx.close(); } catch(e) {}
      audioCtx = null;
      masterGain = null;
    }
  }

  function currentTime() {
    return getContext().currentTime;
  }

  return { playNote, stopAll, getContext, getMaster, currentTime, INSTRUMENTS };
})();
