/**
 * Real-time analysis of counterpoint: intervals, cadences, motion, rule-checking.
 */
const Analysis = (() => {

  function analyzebeat(piece, beatIdx) {
    if (!piece || beatIdx < 0 || beatIdx >= piece.length) return null;

    const key = piece.key;
    const voices = piece.voices;
    const numVoices = voices.length;

    const result = {
      beat: beatIdx + 1,
      notes: [],
      degrees: [],
      intervals: [],
      motions: [],
      cadence: null,
      ruleNotes: []
    };

    // Note info & scale degrees
    for (let v = 0; v < numVoices; v++) {
      const midi = voices[v].notes[beatIdx];
      const noteInfo = MusicTheory.midiToNoteName(midi);
      const degree = MusicTheory.getScaleDegree(key, midi);
      result.notes.push({
        voice: voices[v].name,
        midi,
        name: noteInfo.full,
        degree: degree ? degree.name : '?',
        degreeNum: degree ? degree.degree : 0
      });
    }

    // Intervals between all voice pairs
    for (let i = 0; i < numVoices; i++) {
      for (let j = i + 1; j < numVoices; j++) {
        const midi1 = voices[i].notes[beatIdx];
        const midi2 = voices[j].notes[beatIdx];
        const interval = MusicTheory.intervalBetween(midi1, midi2);
        result.intervals.push({
          voices: `${voices[i].name}-${voices[j].name}`,
          interval: interval.name,
          semitones: interval.semitones,
          quality: interval.isDissonance ? 'dissonant' :
                   interval.isPerfectConsonance ? 'perfect' : 'imperfect',
          isConsonant: interval.isConsonant
        });
      }
    }

    // Voice motion (requires previous beat)
    if (beatIdx > 0) {
      for (let i = 0; i < numVoices; i++) {
        for (let j = i + 1; j < numVoices; j++) {
          const motion = MusicTheory.motionType(
            voices[i].notes[beatIdx - 1], voices[i].notes[beatIdx],
            voices[j].notes[beatIdx - 1], voices[j].notes[beatIdx]
          );
          result.motions.push({
            voices: `${voices[i].name}-${voices[j].name}`,
            type: motion
          });
        }
      }
    }

    // Cadence detection (look at last 2-3 beats)
    result.cadence = detectCadence(piece, beatIdx);

    // Rule checking
    result.ruleNotes = checkRules(piece, beatIdx);

    return result;
  }

  function detectCadence(piece, beatIdx) {
    if (beatIdx < 1) return null;
    const key = piece.key;
    const voices = piece.voices;

    // Get bass degrees for current and previous beats
    const bassCurr = voices[0].notes[beatIdx];
    const bassPrev = voices[0].notes[beatIdx - 1];
    const currDeg = MusicTheory.getScaleDegree(key, bassCurr);
    const prevDeg = MusicTheory.getScaleDegree(key, bassPrev);

    if (!currDeg || !prevDeg) return null;

    const prev = prevDeg.degree;
    const curr = currDeg.degree;

    // Check if this is near the end for full cadence detection
    const isNearEnd = beatIdx >= piece.length - 3;

    // Also check soprano for leading tone resolution
    const sopVoice = voices[voices.length - 1];
    const sopCurr = sopVoice.notes[beatIdx];
    const sopPrev = sopVoice.notes[beatIdx - 1];
    const sopCurrDeg = MusicTheory.getScaleDegree(key, sopCurr);
    const sopPrevDeg = MusicTheory.getScaleDegree(key, sopPrev);

    // Authentic cadence: V -> I
    if (prev === 5 && curr === 1) {
      // Perfect authentic if soprano ends on tonic
      if (sopCurrDeg && sopCurrDeg.degree === 1) {
        return { name: 'Perfect Authentic Cadence', symbol: 'PAC', type: 'authentic' };
      }
      return { name: 'Imperfect Authentic Cadence', symbol: 'IAC', type: 'authentic' };
    }

    // Half cadence: anything -> V
    if (curr === 5) {
      return { name: 'Half Cadence', symbol: 'HC', type: 'half' };
    }

    // Plagal cadence: IV -> I
    if (prev === 4 && curr === 1) {
      return { name: 'Plagal Cadence', symbol: 'PC', type: 'plagal' };
    }

    // Deceptive cadence: V -> VI
    if (prev === 5 && curr === 6) {
      return { name: 'Deceptive Cadence', symbol: 'DC', type: 'deceptive' };
    }

    // Phrygian half cadence (minor): iv6 -> V (bass moves by half step down to 5)
    if (key.isMinor && curr === 5 && prev === 6) {
      return { name: 'Phrygian Half Cadence', symbol: 'PHC', type: 'phrygian' };
    }

    return null;
  }

  function checkRules(piece, beatIdx) {
    const notes = [];
    const voices = piece.voices;
    const numVoices = voices.length;

    if (beatIdx < 1) return notes;

    for (let i = 0; i < numVoices; i++) {
      for (let j = i + 1; j < numVoices; j++) {
        const prev1 = voices[i].notes[beatIdx - 1];
        const curr1 = voices[i].notes[beatIdx];
        const prev2 = voices[j].notes[beatIdx - 1];
        const curr2 = voices[j].notes[beatIdx];

        const prevInterval = MusicTheory.intervalBetween(prev1, prev2);
        const currInterval = MusicTheory.intervalBetween(curr1, curr2);
        const motion = MusicTheory.motionType(prev1, curr1, prev2, curr2);

        // Parallel fifths
        if (motion === 'parallel' && currInterval.simple === 7) {
          notes.push({
            ok: false,
            text: `Parallel 5ths: ${voices[i].name}-${voices[j].name}`
          });
        }
        // Parallel octaves/unisons
        else if (motion === 'parallel' && currInterval.simple === 0) {
          notes.push({
            ok: false,
            text: `Parallel octaves: ${voices[i].name}-${voices[j].name}`
          });
        }

        // Hidden (direct) fifths/octaves in outer voices
        if (i === 0 && j === numVoices - 1 && motion === 'similar') {
          if (currInterval.simple === 7) {
            notes.push({
              ok: false,
              text: `Hidden 5ths in outer voices`
            });
          }
          if (currInterval.simple === 0) {
            notes.push({
              ok: false,
              text: `Hidden octaves in outer voices`
            });
          }
        }

        // Dissonance on strong beat
        if (currInterval.isDissonance) {
          notes.push({
            ok: false,
            text: `Dissonance (${currInterval.name}): ${voices[i].name}-${voices[j].name}`
          });
        }
      }
    }

    // Check melodic intervals for each voice (only on note onsets, not held notes)
    for (let v = 0; v < numVoices; v++) {
      // Skip leap checks for held notes
      if (voices[v].durations && voices[v].durations[beatIdx] === 0) continue;

      const prev = voices[v].notes[beatIdx - 1];
      const curr = voices[v].notes[beatIdx];
      const leap = Math.abs(curr - prev);

      if (leap > 7 && leap !== 12) {
        notes.push({
          ok: false,
          text: `Large leap (${leap} semitones) in ${voices[v].name}`
        });
      }
      if (leap === 6) {
        notes.push({
          ok: false,
          text: `Tritone leap in ${voices[v].name}`
        });
      }
    }

    // Voice crossing
    for (let i = 0; i < numVoices - 1; i++) {
      if (voices[i].notes[beatIdx] > voices[i + 1].notes[beatIdx]) {
        notes.push({
          ok: false,
          text: `Voice crossing: ${voices[i].name} above ${voices[i + 1].name}`
        });
      }
    }

    // If no issues found, note that
    if (notes.length === 0) {
      notes.push({ ok: true, text: 'All counterpoint rules satisfied' });
    }

    // Add positive observations
    const motionTypes = {};
    for (let i = 0; i < numVoices; i++) {
      for (let j = i + 1; j < numVoices; j++) {
        // Held notes produce oblique motion by definition
        const iHeld = voices[i].durations && voices[i].durations[beatIdx] === 0;
        const jHeld = voices[j].durations && voices[j].durations[beatIdx] === 0;
        let motion;
        if (iHeld || jHeld) {
          motion = (iHeld && jHeld) ? 'none' : 'oblique';
        } else {
          motion = MusicTheory.motionType(
            voices[i].notes[beatIdx - 1], voices[i].notes[beatIdx],
            voices[j].notes[beatIdx - 1], voices[j].notes[beatIdx]
          );
        }
        motionTypes[motion] = (motionTypes[motion] || 0) + 1;
      }
    }
    if (motionTypes.contrary) {
      notes.push({ ok: true, text: `Contrary motion present (good)` });
    }

    return notes;
  }

  // Full piece analysis summary
  function analyzePiece(piece) {
    const beatAnalyses = [];
    for (let i = 0; i < piece.length; i++) {
      beatAnalyses.push(analyzebeat(piece, i));
    }

    let violations = 0;
    let contraryMotionCount = 0;
    let totalMotions = 0;
    const cadences = [];

    for (const ba of beatAnalyses) {
      if (!ba) continue;
      for (const rule of ba.ruleNotes) {
        if (!rule.ok && !rule.text.includes('All counterpoint')) violations++;
      }
      for (const m of ba.motions) {
        totalMotions++;
        if (m.type === 'contrary') contraryMotionCount++;
      }
      if (ba.cadence) cadences.push({ beat: ba.beat, ...ba.cadence });
    }

    return { beatAnalyses, violations, contraryMotionCount, totalMotions, cadences };
  }

  return { analyzebeat, analyzePiece, detectCadence, checkRules };
})();
