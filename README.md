# Counterpoint Player

A browser-based counterpoint music generator and player. Generates random polyphonic music following the rules of species counterpoint, plays it with selectable synthesized instruments, and displays real-time harmonic analysis.

**[Launch the app](https://brendanjameslynskey.github.io/Counterpoint/)**

## Features

- **Counterpoint generation** — Produces 2-, 3-, or 4-voice counterpoint (soprano, alto, tenor, bass) following first-species rules: consonant intervals, no parallel fifths/octaves, contrary motion preferred, stepwise motion, leap recovery, proper cadences.
- **6 instruments** — Piano, Harpsichord, Church Organ, Baroque Organ, Reed Organ, Flute Organ, all synthesized in real time via the Web Audio API.
- **12 keys** — Major and minor keys with correct key signatures.
- **Variable note durations** — Bass and inner voices hold notes across beats, producing a more musical texture. Open noteheads and tie arcs reflect held notes visually.
- **Tempo control** — 30 to 160 BPM.
- **Continuous mode** — Generates new pieces seamlessly when the current one ends, for indefinite listening.
- **Score display** — Canvas-rendered notation with treble/bass clefs, key signatures, time signatures (4/4), bar lines, diatonically-positioned notes, accidentals, ledger lines, stems, ties, and a moving playhead.
- **Real-time analysis panel** — Shows for each beat:
  - Note names and scale degrees per voice
  - Interval quality between all voice pairs (perfect, imperfect, dissonant)
  - Cadence detection (PAC, IAC, HC, PC, DC, Phrygian HC)
  - Voice motion types (contrary, oblique, similar, parallel)
  - Counterpoint rule-checking with pass/violation indicators

## Usage

Open `index.html` in any modern browser. No build step, no dependencies.

1. Select an instrument, key, and number of voices.
2. Click **Play**. The score scrolls with a playhead and the analysis panel updates on each beat.
3. Check **Continuous** to keep generating and playing new pieces indefinitely.
4. Adjust **Tempo** in real time during playback.

## How it works

The generator uses a constraint-satisfaction approach:

1. **Bass voice** is generated first as the cantus firmus, with variable note durations (longer holds on stable scale degrees).
2. **Upper voices** are added one at a time from bottom up. Each note is scored against vertical (harmonic) and horizontal (melodic) rules, selecting the candidate with the highest score.
3. **Rules enforced**: consonance on every beat, no parallel fifths/octaves, no voice crossing, stepwise motion preferred, leap recovery, leading-tone approach at cadences, held notes checked for consonance across all beats they span.

Instruments are additive/subtractive synthesizers built from Web Audio API oscillators, filters, and gain envelopes.

## Technology

Pure HTML, CSS, and vanilla JavaScript. No frameworks, no libraries, no build tools.

## License

MIT
