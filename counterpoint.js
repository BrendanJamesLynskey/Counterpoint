/**
 * Counterpoint generator following species counterpoint rules.
 * Generates a cantus firmus and adds counterpoint voices.
 *
 * Each voice produces:
 *   notes[]     – MIDI value sounding on each beat
 *   durations[] – >0 = new note starts here, lasting N beats; 0 = held from previous
 */
const Counterpoint = (() => {

  // Voice ranges (MIDI)
  const VOICE_RANGES = {
    soprano: { low: 60, high: 79 },  // C4-G5
    alto:    { low: 53, high: 72 },   // F3-C5
    tenor:   { low: 48, high: 67 },   // C3-G4
    bass:    { low: 40, high: 60 },   // E2-C4
  };

  const VOICE_CONFIGS = {
    2: ['bass', 'soprano'],
    3: ['bass', 'alto', 'soprano'],
    4: ['bass', 'tenor', 'alto', 'soprano'],
  };

  // How likely each voice is to hold notes (probability of 2-beat, 3-beat, 4-beat)
  const HOLD_PROFILES = {
    bass:    { p2: 0.45, p3: 0.15, p4: 0.10 },  // bass holds often
    tenor:   { p2: 0.20, p3: 0.05, p4: 0.00 },
    alto:    { p2: 0.15, p3: 0.03, p4: 0.00 },
    soprano: { p2: 0.10, p3: 0.00, p4: 0.00 },  // soprano mostly stepwise
  };

  function generate(key, numVoices, length = 16) {
    const parsedKey = MusicTheory.parseKey(key);
    const voiceNames = VOICE_CONFIGS[numVoices];

    // 1. Generate bass with variable durations first
    const bassResult = generateBassVoice(parsedKey, VOICE_RANGES.bass, length);
    const voices = [bassResult];

    // 2. Add upper counterpoint voices, aware of bass durations
    for (let v = 1; v < numVoices; v++) {
      const cp = generateCounterpointVoice(
        parsedKey, voices, VOICE_RANGES[voiceNames[v]], length, voiceNames[v]
      );
      voices.push(cp);
    }

    return {
      key: parsedKey,
      voices: voices.map((v, i) => ({
        name: voiceNames[i],
        notes: v.notes,
        durations: v.durations,
        isCantus: i === 0
      })),
      length
    };
  }

  /**
   * Generate bass voice (cantus firmus) with variable note durations.
   * Decides durations first, then picks pitches at each onset.
   */
  function generateBassVoice(key, range, length) {
    const tones = MusicTheory.getScaleTonesInRange(key, range.low, range.high);
    const tonics = tones.filter(t => t % 12 === key.rootPc);
    const profile = HOLD_PROFILES.bass;

    // Plan durations: decide where new notes start
    const durations = new Array(length).fill(0);
    let beat = 0;
    while (beat < length) {
      const remaining = length - beat;
      let dur = 1;
      if (remaining >= 4 && beat > 0 && beat < length - 2 && Math.random() < profile.p4) {
        dur = 4;
      } else if (remaining >= 3 && beat > 0 && beat < length - 2 && Math.random() < profile.p3) {
        dur = 3;
      } else if (remaining >= 2 && beat > 0 && beat < length - 1 && Math.random() < profile.p2) {
        dur = 2;
      }
      // First and last beats always get their own note
      if (beat === 0 || beat === length - 1) dur = 1;
      // Penultimate should be its own note for cadence
      if (beat === length - 2) dur = 1;
      // Don't let a held note cross into the last 2 beats
      if (beat + dur > length - 1 && beat < length - 2) dur = length - 2 - beat;
      if (dur < 1) dur = 1;

      durations[beat] = dur;
      beat += dur;
    }

    // Now generate pitches at each onset
    const notes = new Array(length).fill(0);
    const startNote = tonics[Math.floor(tonics.length / 2)] || tones[Math.floor(tones.length / 2)];
    let prevPitch = startNote;

    for (let i = 0; i < length; i++) {
      if (durations[i] === 0) {
        // Held note – copy previous pitch
        notes[i] = notes[i - 1];
        continue;
      }

      const isFirst = i === 0;
      const isLast = i === length - 1;
      const isPenultimate = i === length - 2;

      if (isFirst) {
        notes[i] = startNote;
        prevPitch = startNote;
        continue;
      }

      if (isLast) {
        const closest = tonics.reduce((best, t) =>
          Math.abs(t - prevPitch) < Math.abs(best - prevPitch) ? t : best
        );
        notes[i] = closest;
        continue;
      }

      if (isPenultimate) {
        const closestTonic = tonics.reduce((best, t) =>
          Math.abs(t - prevPitch) < Math.abs(best - prevPitch) ? t : best
        );
        const candidates = [closestTonic - 1, closestTonic - 2, closestTonic + 2, closestTonic + 1];
        let picked = candidates[0];
        for (const c of candidates) {
          if ((tones.includes(c) || (key.isMinor && (c % 12 === (key.rootPc + 11) % 12)))
              && Math.abs(c - prevPitch) <= 7) {
            picked = c;
            break;
          }
        }
        notes[i] = picked;
        prevPitch = picked;
        continue;
      }

      // Normal note selection
      let bestNote = tones[Math.floor(tones.length / 2)];
      let bestScore = -Infinity;
      const maxAttempts = 300;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = tones[Math.floor(Math.random() * tones.length)];
        const score = evaluateCantusFirmusNote(
          notes, durations, candidate, tones, range, i, length, key, prevPitch
        );
        if (score > bestScore) {
          bestScore = score;
          bestNote = candidate;
        }
      }
      notes[i] = bestNote;
      prevPitch = bestNote;
      // Fill held beats
      for (let h = 1; h < durations[i] && i + h < length; h++) {
        notes[i + h] = bestNote;
      }
    }

    return { notes, durations };
  }

  function evaluateCantusFirmusNote(notes, durations, candidate, tones, range, position, length, key, prevPitch) {
    const interval = Math.abs(candidate - prevPitch);
    let score = 0;

    // Prefer stepwise motion
    if (interval >= 1 && interval <= 2) score += 10;
    else if (interval >= 3 && interval <= 4) score += 6;
    else if (interval === 5) score += 3;
    else if (interval === 7) score += 2;
    else if (interval > 7) score -= 15;
    else if (interval === 0) score -= 10;
    if (interval === 6) score -= 8;

    // If note is held for multiple beats, prefer more stable degrees (1, 4, 5)
    if (durations[position] > 1) {
      const pc = (candidate - key.rootPc + 12) % 12;
      if (pc === 0 || pc === 7 || pc === 5) score += 5; // tonic, dominant, subdominant
    }

    // Leap recovery (find previous actual onset)
    let prevOnset = -1;
    for (let i = position - 1; i >= 0; i--) {
      if (durations[i] > 0) {
        if (prevOnset === -1) { prevOnset = i; break; }
      }
    }
    if (prevOnset >= 0) {
      const prevOnsetNote = notes[prevOnset];
      let onsetBefore = -1;
      for (let i = prevOnset - 1; i >= 0; i--) {
        if (durations[i] > 0) { onsetBefore = i; break; }
      }
      if (onsetBefore >= 0) {
        const prevInterval = notes[prevOnset] - notes[onsetBefore];
        if (Math.abs(prevInterval) > 4) {
          const recoveryDir = -Math.sign(prevInterval);
          const moveDir = Math.sign(candidate - prevPitch);
          if (moveDir === recoveryDir && interval <= 4) score += 8;
          if (moveDir === Math.sign(prevInterval)) score -= 5;
        }
      }
    }

    // Prefer middle of range
    const rangeMid = (range.low + range.high) / 2;
    score -= Math.abs(candidate - rangeMid) * 0.3;

    // Variety
    for (let i = Math.max(0, position - 6); i < position; i++) {
      if (durations[i] > 0 && notes[i] === candidate) score -= 6;
      if (durations[i] > 0 && notes[i] % 12 === candidate % 12) score -= 3;
    }

    // Arch shape
    const progress = position / length;
    if (progress < 0.5 && candidate > prevPitch) score += 2;
    if (progress > 0.5 && candidate < prevPitch) score += 2;

    return score;
  }

  function generateCounterpointVoice(key, existingVoices, range, length, voiceName) {
    const tones = MusicTheory.getScaleTonesInRange(key, range.low, range.high);
    if (key.isMinor) {
      const raised7 = (key.rootPc + 11) % 12;
      for (let midi = range.low; midi <= range.high; midi++) {
        if (midi % 12 === raised7 && !tones.includes(midi)) tones.push(midi);
      }
      tones.sort((a, b) => a - b);
    }

    const tonics = tones.filter(t => t % 12 === key.rootPc);
    const profile = HOLD_PROFILES[voiceName] || HOLD_PROFILES.soprano;

    // Plan durations
    const durations = new Array(length).fill(0);
    let beat = 0;
    while (beat < length) {
      const remaining = length - beat;
      let dur = 1;
      if (remaining >= 3 && beat > 0 && beat < length - 2 && Math.random() < profile.p3) {
        dur = 3;
      } else if (remaining >= 2 && beat > 0 && beat < length - 1 && Math.random() < profile.p2) {
        dur = 2;
      }
      if (beat === 0 || beat === length - 1) dur = 1;
      if (beat === length - 2) dur = 1;
      if (beat + dur > length - 1 && beat < length - 2) dur = length - 2 - beat;
      if (dur < 1) dur = 1;
      durations[beat] = dur;
      beat += dur;
    }

    // Generate pitches
    const notes = new Array(length).fill(0);

    for (let i = 0; i < length; i++) {
      if (durations[i] === 0) {
        notes[i] = notes[i - 1];
        continue;
      }

      const isFirst = i === 0;
      const isLast = i === length - 1;
      const isPenultimate = i === length - 2;

      const candidates = isFirst || isLast
        ? [...new Set(tonics.concat(tones.filter(t => {
            const iv = MusicTheory.intervalBetween(existingVoices[0].notes[i], t);
            return iv.simple === 7;
          })))]
        : tones;

      let bestNote = null;
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        // For held notes, check consonance on all beats the note covers
        let score = evaluateCounterpointNote(
          key, notes, durations, candidate, existingVoices, i, length, range, tones, isPenultimate
        );

        // Penalize if held note becomes dissonant on later beats
        for (let h = 1; h < durations[i] && i + h < length; h++) {
          for (let ev = 0; ev < existingVoices.length; ev++) {
            const otherMidi = existingVoices[ev].notes[i + h];
            const iv = MusicTheory.intervalBetween(otherMidi, candidate);
            if (iv.isDissonance) score -= 30;
            else if (iv.isImperfectConsonance) score += 3;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestNote = candidate;
        }
      }

      const chosen = bestNote || tones[Math.floor(tones.length / 2)];
      notes[i] = chosen;
      for (let h = 1; h < durations[i] && i + h < length; h++) {
        notes[i + h] = chosen;
      }
    }

    return { notes, durations };
  }

  function evaluateCounterpointNote(key, voice, voiceDurations, candidate, existingVoices, beatIdx, length, range, tones, isPenultimate) {
    let score = 0;
    const numExisting = existingVoices.length;

    // === Vertical rules ===
    for (let v = 0; v < numExisting; v++) {
      const otherNote = existingVoices[v].notes[beatIdx];
      const interval = MusicTheory.intervalBetween(otherNote, candidate);

      if (interval.isDissonance) score -= 50;
      else if (interval.isImperfectConsonance) score += 8;
      else if (interval.isPerfectConsonance) score += 3;

      // Voice crossing
      if (numExisting > 0 && candidate <= existingVoices[numExisting - 1].notes[beatIdx]) {
        score -= 20;
      }

      // === Motion rules (compare to previous onset) ===
      // Find previous onset in this voice
      let prevBeat = -1;
      for (let b = beatIdx - 1; b >= 0; b--) {
        if (voiceDurations[b] > 0) { prevBeat = b; break; }
      }
      if (prevBeat >= 0) {
        const prevCandidate = voice[prevBeat];
        // Find the note sounding in the other voice at prevBeat
        const prevOther = existingVoices[v].notes[prevBeat];
        const prevInterval = MusicTheory.intervalBetween(prevOther, prevCandidate);
        const motion = MusicTheory.motionType(prevOther, otherNote, prevCandidate, candidate);

        if (motion === 'parallel' && (interval.simple === 7 || interval.simple === 0)) {
          score -= 100;
        }
        if (motion === 'similar' && (interval.simple === 7 || interval.simple === 0)) {
          score -= 15;
        }
        if (motion === 'contrary') score += 5;
        if (motion === 'oblique') score += 3;
      }
    }

    // === Melodic rules ===
    let prevBeat = -1;
    for (let b = beatIdx - 1; b >= 0; b--) {
      if (voiceDurations[b] > 0) { prevBeat = b; break; }
    }
    if (prevBeat >= 0) {
      const prev = voice[prevBeat];
      const leap = Math.abs(candidate - prev);

      if (leap >= 1 && leap <= 2) score += 8;
      else if (leap >= 3 && leap <= 4) score += 4;
      else if (leap === 5 || leap === 7) score += 1;
      else if (leap > 7) score -= 12;
      else if (leap === 0) score -= 8;
      if (leap === 6) score -= 10;

      // Leap recovery
      let prevPrevBeat = -1;
      for (let b = prevBeat - 1; b >= 0; b--) {
        if (voiceDurations[b] > 0) { prevPrevBeat = b; break; }
      }
      if (prevPrevBeat >= 0) {
        const prevLeap = voice[prevBeat] - voice[prevPrevBeat];
        if (Math.abs(prevLeap) > 4) {
          const recovery = -Math.sign(prevLeap);
          if (Math.sign(candidate - prev) === recovery && leap <= 4) score += 6;
        }
      }

      // Variety
      for (let i = Math.max(0, beatIdx - 5); i < beatIdx; i++) {
        if (voiceDurations[i] > 0 && voice[i] === candidate) score -= 5;
      }
    }

    // Prefer middle of range
    const rangeMid = (range.low + range.high) / 2;
    score -= Math.abs(candidate - rangeMid) * 0.2;

    // Held notes prefer stable scale degrees
    if (voiceDurations[beatIdx] > 1) {
      const pc = (candidate - key.rootPc + 12) % 12;
      if (pc === 0 || pc === 7 || pc === 5) score += 4;
    }

    if (isPenultimate) {
      const leadingTone = (key.rootPc + 11) % 12;
      if (candidate % 12 === leadingTone) score += 10;
    }
    if (beatIdx === length - 1) {
      if (candidate % 12 === key.rootPc) score += 15;
      if ((candidate - key.rootPc + 12) % 12 === 7) score += 5;
    }
    if (beatIdx === 0) {
      if (candidate % 12 === key.rootPc) score += 10;
      if ((candidate - key.rootPc + 12) % 12 === 7) score += 5;
    }

    return score;
  }

  return { generate, VOICE_RANGES, VOICE_CONFIGS };
})();
