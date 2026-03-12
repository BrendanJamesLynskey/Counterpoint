/**
 * Music theory fundamentals: notes, intervals, scales, degrees,
 * diatonic mapping, key signatures, accidentals.
 */
const MusicTheory = (() => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
  const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

  const DEGREE_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const MINOR_DEGREE_NAMES = ['i', 'ii\u00B0', 'III', 'iv', 'v', 'VI', 'VII'];

  const INTERVAL_NAMES = {
    0: 'P1', 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4',
    6: 'A4/d5', 7: 'P5', 8: 'm6', 9: 'M6', 10: 'm7', 11: 'M7', 12: 'P8'
  };

  const PERFECT_CONSONANCES = new Set([0, 7, 12]);
  const IMPERFECT_CONSONANCES = new Set([3, 4, 8, 9]);
  const DISSONANCES = new Set([1, 2, 5, 6, 10, 11]);

  // ── Diatonic mapping ──────────────────────────────────────────────
  // Maps chromatic pitch class → diatonic letter index (0=C .. 6=B)
  //                               C  C# D  D# E  F  F# G  G# A  A# B
  const CHROMATIC_TO_DIA_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const CHROMATIC_TO_DIA_FLAT  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
  const IS_WHITE_KEY = [1,0,1,0,1,1,0,1,0,1,0,1];

  // Key signature data: how many sharps/flats
  const KEY_SIGNATURES = {
    'C':  { sharps: 0, flats: 0 },
    'G':  { sharps: 1, flats: 0 },
    'D':  { sharps: 2, flats: 0 },
    'A':  { sharps: 3, flats: 0 },
    'E':  { sharps: 4, flats: 0 },
    'F':  { sharps: 0, flats: 1 },
    'Bb': { sharps: 0, flats: 2 },
    'Am': { sharps: 0, flats: 0 },
    'Em': { sharps: 1, flats: 0 },
    'Dm': { sharps: 0, flats: 1 },
    'Cm': { sharps: 0, flats: 3 },
    'Gm': { sharps: 0, flats: 2 },
  };

  // ── Core functions ────────────────────────────────────────────────

  function noteNameToMidi(name, octave) {
    let n = name;
    if (ENHARMONIC[n]) n = ENHARMONIC[n];
    const idx = NOTE_NAMES.indexOf(n);
    if (idx === -1) throw new Error(`Unknown note: ${name}`);
    return (octave + 1) * 12 + idx;
  }

  function midiToNoteName(midi) {
    const note = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return { note, octave, full: `${note}${octave}` };
  }

  // ── Tuning systems ───────────────────────────────────────────────
  // Each tuning defines cent offsets from equal temperament for each
  // pitch class (C=0 through B=11).  A440 is the reference pitch.

  let currentTuning = 'equal';
  let currentKeyRoot = 0; // pitch class of current key (0=C)

  // Tuning definitions: offsets in cents from equal temperament,
  // defined relative to C.  Key-relative tunings (just, pythagorean)
  // are rotated at playback time to match the current key.
  const TUNINGS = {
    'equal': {
      name: 'Equal Temperament',
      keyRelative: false,
      offsets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    'just-major': {
      name: 'Just Intonation (Major)',
      keyRelative: true,
      // Ratios: 1/1 16/15 9/8 6/5 5/4 4/3 45/32 3/2 8/5 5/3 9/5 15/8
      offsets: [0, 11.73, 3.91, 15.64, -13.69, -1.96, -10.26, 1.96, 13.69, -15.64, 17.60, -11.73]
    },
    'just-minor': {
      name: 'Just Intonation (Minor)',
      keyRelative: true,
      // Ratios: 1/1 16/15 9/8 6/5 5/4 4/3 7/5 3/2 8/5 5/3 7/4 15/8
      offsets: [0, 11.73, 3.91, 15.64, -13.69, -1.96, -17.49, 1.96, 13.69, -15.64, -31.17, -11.73]
    },
    'pythagorean': {
      name: 'Pythagorean',
      keyRelative: true,
      // Built on pure fifths (3:2). Cents from ET:
      offsets: [0, -9.78, 3.91, -5.87, 7.82, -1.96, 11.73, 1.96, -7.82, 5.87, -3.91, 9.78]
    },
    'meantone': {
      name: 'Quarter-Comma Meantone',
      keyRelative: true,
      // Pure major thirds (5:4), tempered fifths. Cents from ET:
      offsets: [0, -24.04, -6.84, 10.26, -13.69, 3.42, -20.53, -3.42, -27.37, -10.26, 6.84, -17.11]
    },
    'werckmeister': {
      name: 'Werckmeister III',
      keyRelative: false,
      // Well temperament (1691). Different keys have different colours.
      offsets: [0, -9.78, -7.82, -5.87, -3.91, -1.96, -9.78, -3.91, -7.82, -5.87, -3.91, -1.96]
    },
    'kirnberger': {
      name: 'Kirnberger III',
      keyRelative: false,
      // Well temperament blending just and Pythagorean.
      offsets: [0, -9.78, -6.84, -5.87, -13.69, -1.96, -9.78, -3.91, -7.82, -10.26, -3.91, -11.73]
    }
  };

  function setTuning(name) {
    if (TUNINGS[name]) currentTuning = name;
  }

  function setTuningKeyRoot(root) {
    currentKeyRoot = ((root % 12) + 12) % 12;
  }

  function midiToFrequency(midi) {
    const tuning = TUNINGS[currentTuning];
    const offsets = tuning.offsets;
    const pc = ((midi % 12) + 12) % 12;
    let cents;
    if (tuning.keyRelative) {
      // Rotate offsets so the current key root is the reference
      const interval = ((pc - currentKeyRoot) % 12 + 12) % 12;
      cents = offsets[interval];
    } else {
      cents = offsets[pc];
    }
    return 440 * Math.pow(2, (midi - 69) / 12 + cents / 1200);
  }

  function parseKey(keyStr) {
    const isMinor = keyStr.endsWith('m');
    const root = isMinor ? keyStr.slice(0, -1) : keyStr;
    let rootMidi = NOTE_NAMES.indexOf(ENHARMONIC[root] || root);
    if (rootMidi === -1) rootMidi = 0;
    return {
      keyStr,
      root,
      rootPc: rootMidi,
      isMinor,
      scale: isMinor ? MINOR_SCALE : MAJOR_SCALE,
      harmonicMinor: isMinor ? HARMONIC_MINOR : null
    };
  }

  function getScalePitches(key, octave) {
    return key.scale.map(s => (key.rootPc + s) % 12 + (octave + 1) * 12);
  }

  function getScaleTonesInRange(key, lowMidi, highMidi) {
    const tones = [];
    for (let midi = lowMidi; midi <= highMidi; midi++) {
      const pc = midi % 12;
      const offset = (pc - key.rootPc + 12) % 12;
      if (key.scale.includes(offset)) tones.push(midi);
    }
    return tones;
  }

  function getScaleDegree(key, midi) {
    const pc = midi % 12;
    const offset = (pc - key.rootPc + 12) % 12;
    const idx = key.scale.indexOf(offset);
    if (idx === -1) {
      if (key.isMinor && offset === 11) return { degree: 7, name: '#VII', isRaised: true };
      return null;
    }
    const names = key.isMinor ? MINOR_DEGREE_NAMES : DEGREE_NAMES;
    return { degree: idx + 1, name: names[idx], isRaised: false };
  }

  function intervalBetween(midi1, midi2) {
    const semitones = Math.abs(midi2 - midi1);
    const simple = semitones % 12;
    const compound = semitones > 12;
    return {
      semitones, simple, compound,
      name: INTERVAL_NAMES[simple] || `${semitones}st`,
      isPerfectConsonance: PERFECT_CONSONANCES.has(simple),
      isImperfectConsonance: IMPERFECT_CONSONANCES.has(simple),
      isDissonance: DISSONANCES.has(simple),
      isConsonant: PERFECT_CONSONANCES.has(simple) || IMPERFECT_CONSONANCES.has(simple)
    };
  }

  function motionType(voice1prev, voice1curr, voice2prev, voice2curr) {
    const dir1 = Math.sign(voice1curr - voice1prev);
    const dir2 = Math.sign(voice2curr - voice2prev);
    if (dir1 === 0 && dir2 === 0) return 'none';
    if (dir1 === 0 || dir2 === 0) return 'oblique';
    if (dir1 === dir2) {
      const prevInterval = Math.abs(voice2prev - voice1prev) % 12;
      const currInterval = Math.abs(voice2curr - voice1curr) % 12;
      if (prevInterval === currInterval) return 'parallel';
      return 'similar';
    }
    return 'contrary';
  }

  // ── Diatonic position (for staff rendering) ───────────────────────
  // Returns an integer where C4 = 28, D4 = 29, ... B4 = 34, C5 = 35, etc.
  // Each unit = one staff half-space (line-to-space or space-to-line).

  function midiToDiatonic(midi, key) {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const offset = (pc - key.rootPc + 12) % 12;

    // Out-of-scale black keys: always use sharp mapping (placed on the lower letter)
    if (!key.scale.includes(offset) && !IS_WHITE_KEY[pc]) {
      return octave * 7 + CHROMATIC_TO_DIA_SHARP[pc];
    }

    const keySig = KEY_SIGNATURES[key.keyStr];
    const useFlats = keySig && keySig.flats > 0;
    const map = useFlats ? CHROMATIC_TO_DIA_FLAT : CHROMATIC_TO_DIA_SHARP;
    return octave * 7 + map[pc];
  }

  // ── Accidentals ───────────────────────────────────────────────────
  // Returns null if the note is covered by the key signature,
  // or '\u266F' (♯), '\u266D' (♭), '\u266E' (♮) if an accidental is needed.

  function getNoteAccidental(key, midi) {
    const pc = midi % 12;
    const offset = (pc - key.rootPc + 12) % 12;
    if (key.scale.includes(offset)) return null; // in key — no accidental
    if (IS_WHITE_KEY[pc]) return '\u266E'; // natural sign (cancels a key-sig flat/sharp)
    return '\u266F'; // sharp sign
  }

  // ── Key-signature rendering info ──────────────────────────────────

  function getKeySigInfo(keyStr) {
    return KEY_SIGNATURES[keyStr] || { sharps: 0, flats: 0 };
  }

  // Diatonic positions where each sharp/flat glyph sits on the staff.
  // Treble clef bottom line = E4 = diatonic 30.
  // Bass clef bottom line = G2 = diatonic 18.
  const SHARP_POSITIONS = {
    treble: [38, 35, 39, 36, 33, 37, 34], // F5 C5 G5 D5 A4 E5 B4 — adjusted: G5→above staff for clarity? No, standard: F5 C5 G4 D5 A4 E5 B4
    bass:   [24, 21, 25, 22, 19, 23, 20],
  };
  // Fix treble sharp positions to standard engraving:
  // F♯5(38) C♯5(35) G♯4(32) D♯5(36) A♯4(33) E♯5(37) B♯4(34)
  SHARP_POSITIONS.treble = [38, 35, 32, 36, 33, 37, 34];

  const FLAT_POSITIONS = {
    treble: [34, 37, 33, 36, 32, 35, 31], // B4 E5 A4 D5 G4 C5 F4
    bass:   [20, 23, 19, 22, 18, 21, 24], // B2 E3 A2 D3 G2 C3 F3
  };

  return {
    NOTE_NAMES, DEGREE_NAMES, MINOR_DEGREE_NAMES, INTERVAL_NAMES,
    PERFECT_CONSONANCES, IMPERFECT_CONSONANCES, DISSONANCES,
    MAJOR_SCALE, MINOR_SCALE, HARMONIC_MINOR,
    KEY_SIGNATURES, SHARP_POSITIONS, FLAT_POSITIONS,
    IS_WHITE_KEY,
    noteNameToMidi, midiToNoteName, midiToFrequency, parseKey,
    getScalePitches, getScaleTonesInRange, getScaleDegree,
    intervalBetween, motionType,
    midiToDiatonic, getNoteAccidental, getKeySigInfo,
    TUNINGS, setTuning, setTuningKeyRoot
  };
})();
