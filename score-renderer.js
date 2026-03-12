/**
 * Renders a proper musical score: clefs, key signatures, time signatures,
 * bar lines, diatonically-positioned notes, accidentals, ties, playhead.
 * Voices displayed soprano (top) to bass (bottom).
 */
const ScoreRenderer = (() => {
  const VOICE_COLORS = ['#2d6a4f', '#0f3460', '#8b4513', '#6a2d6a'];
  const GAP = 9;             // staff-line gap (px)
  const HALF = GAP / 2;      // one diatonic step in px
  const NOTE_RX = 5.5;       // note ellipse x-radius
  const NOTE_RY = 4.5;       // note ellipse y-radius
  const STEM_LEN = 26;

  // Clef bottom-line diatonic references
  const CLEF_REF = { treble: 30, bass: 18 }; // E4, G2

  let canvas, ctx;
  let currentPiece = null;
  let playheadBeat = -1;

  // Clef images (loaded from SVG files)
  let trebleClefImg = null;
  let bassClefImg = null;
  let clefsLoaded = false;

  function loadClefImages() {
    let loaded = 0;
    const onLoad = () => {
      if (++loaded === 2) {
        clefsLoaded = true;
        if (currentPiece) render(currentPiece, playheadBeat);
      }
    };
    trebleClefImg = new Image();
    trebleClefImg.onload = onLoad;
    trebleClefImg.src = 'treble-clef.svg';
    bassClefImg = new Image();
    bassClefImg.onload = onLoad;
    bassClefImg.src = 'bass-clef.svg';
  }

  // ── init / resize ─────────────────────────────────────────────────

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    loadClefImages();
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight || 460;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (currentPiece) render(currentPiece, playheadBeat);
  }

  // ── clef assignment ───────────────────────────────────────────────

  function clefFor(voiceName) {
    return (voiceName === 'bass' || voiceName === 'tenor') ? 'bass' : 'treble';
  }

  // ── Y position from diatonic position ─────────────────────────────

  function diaY(diatonic, clef, staffBottomY) {
    return staffBottomY - (diatonic - CLEF_REF[clef]) * HALF;
  }

  // ── draw helpers ──────────────────────────────────────────────────

  function drawTrebleClef(x, staffTopY) {
    if (!clefsLoaded) return;
    // SVG viewBox: 26×86, staff occupies y=15..55 (height 40)
    const scale = (4 * GAP) / 40;
    ctx.drawImage(trebleClefImg,
      x - 13 * scale, staffTopY - 15 * scale,
      26 * scale, 86 * scale);
  }

  function drawBassClef(x, staffTopY) {
    if (!clefsLoaded) return;
    // SVG viewBox: 30×48, staff occupies y=4..44 (height 40)
    const scale = (4 * GAP) / 40;
    ctx.drawImage(bassClefImg,
      x - 6 * scale, staffTopY - 4 * scale,
      30 * scale, 48 * scale);
  }

  function drawKeySig(startX, staffTopY, clef, keySig) {
    const positions = keySig.sharps > 0
      ? MusicTheory.SHARP_POSITIONS[clef]
      : MusicTheory.FLAT_POSITIONS[clef];
    const count = keySig.sharps || keySig.flats;
    const symbol = keySig.sharps > 0 ? '\u266F' : '\u266D';
    const staffBottomY = staffTopY + 4 * GAP;
    let x = startX;

    ctx.save();
    ctx.fillStyle = '#555';
    ctx.font = `${GAP * 1.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i++) {
      const y = diaY(positions[i], clef, staffBottomY);
      ctx.fillText(symbol, x, y);
      x += GAP * 0.9;
    }
    ctx.restore();
    return x; // returns the x after the last accidental
  }

  function drawTimeSig(x, staffTopY) {
    ctx.save();
    ctx.fillStyle = '#555';
    ctx.font = `bold ${GAP * 2.2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('4', x, staffTopY + GAP);
    ctx.fillText('4', x, staffTopY + GAP * 3);
    ctx.restore();
  }

  function drawLedgerLines(x, diatonic, clef, staffBottomY) {
    const ref = CLEF_REF[clef];
    ctx.save();
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    // Below staff
    for (let d = ref - 2; d >= diatonic - 1; d -= 2) {
      const y = diaY(d, clef, staffBottomY);
      ctx.beginPath();
      ctx.moveTo(x - NOTE_RX - 4, y);
      ctx.lineTo(x + NOTE_RX + 4, y);
      ctx.stroke();
    }
    // Above staff
    for (let d = ref + 10; d <= diatonic + 1; d += 2) {
      const y = diaY(d, clef, staffBottomY);
      ctx.beginPath();
      ctx.moveTo(x - NOTE_RX - 4, y);
      ctx.lineTo(x + NOTE_RX + 4, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── main render ───────────────────────────────────────────────────

  function render(piece, currentBeat) {
    currentPiece = piece;
    playheadBeat = currentBeat;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const numVoices = piece.voices.length;
    const keySig = MusicTheory.getKeySigInfo(piece.key.keyStr);
    const keySigWidth = Math.max(keySig.sharps, keySig.flats) * GAP * 0.9 + 4;

    // Layout constants
    const marginRight = 20;
    const marginTop = 28;
    const labelW = 28;
    const clefW = 26;
    const timeSigW = 18;
    const prefixW = labelW + clefW + keySigWidth + timeSigW + 10;
    const staffHeight = 4 * GAP;
    // Compute spacing to fit the canvas
    const availH = h - marginTop - 20;
    const staffSpacing = Math.min(availH / numVoices, staffHeight + 55);

    const noteAreaLeft = prefixW + 6;
    const noteAreaRight = w - marginRight;
    const numBeats = piece.length;
    const beatW = (noteAreaRight - noteAreaLeft) / numBeats;

    // Display order: soprano (top) → bass (bottom).
    // piece.voices is [bass, ..., soprano]; reverse for display.
    const displayOrder = [];
    for (let i = numVoices - 1; i >= 0; i--) displayOrder.push(i);

    for (let di = 0; di < numVoices; di++) {
      const vi = displayOrder[di];
      const voice = piece.voices[vi];
      const color = VOICE_COLORS[vi % VOICE_COLORS.length];
      const clef = clefFor(voice.name);
      const staffTopY = marginTop + di * staffSpacing;
      const staffBottomY = staffTopY + staffHeight;

      // ── staff lines ──
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      for (let l = 0; l < 5; l++) {
        const y = staffTopY + l * GAP;
        ctx.beginPath();
        ctx.moveTo(labelW, y);
        ctx.lineTo(noteAreaRight, y);
        ctx.stroke();
      }

      // ── voice label ──
      ctx.fillStyle = color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(voice.name.charAt(0).toUpperCase(), labelW - 6, staffTopY + staffHeight / 2);
      if (voice.isCantus) {
        ctx.font = '8px sans-serif';
        ctx.fillStyle = '#999';
        ctx.fillText('c.f.', labelW - 6, staffTopY + staffHeight / 2 + 12);
      }

      // ── clef ──
      const clefX = labelW + 12;
      if (clef === 'treble') drawTrebleClef(clefX, staffTopY);
      else drawBassClef(clefX, staffTopY);

      // ── key signature ──
      const keySigX = clefX + clefW - 4;
      const keySigEnd = drawKeySig(keySigX, staffTopY, clef, keySig);

      // ── time signature ──
      drawTimeSig(keySigEnd + timeSigW / 2 + 2, staffTopY);

      // ── bar lines ──
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      // Opening bar line (at start of note area)
      ctx.beginPath();
      ctx.moveTo(noteAreaLeft - 2, staffTopY);
      ctx.lineTo(noteAreaLeft - 2, staffBottomY);
      ctx.stroke();
      // Interior bar lines every 4 beats
      for (let b = 4; b < numBeats; b += 4) {
        const bx = noteAreaLeft + b * beatW;
        ctx.beginPath();
        ctx.moveTo(bx, staffTopY);
        ctx.lineTo(bx, staffBottomY);
        ctx.stroke();
      }
      // Final double bar
      const endX = noteAreaLeft + numBeats * beatW;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(endX - 4, staffTopY);
      ctx.lineTo(endX - 4, staffBottomY);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(endX - 1, staffTopY);
      ctx.lineTo(endX - 1, staffBottomY);
      ctx.stroke();

      // ── notes ──
      for (let beat = 0; beat < numBeats; beat++) {
        const midi = voice.notes[beat];
        const dur = voice.durations[beat];
        const dia = MusicTheory.midiToDiatonic(midi, piece.key);
        const x = noteAreaLeft + (beat + 0.5) * beatW;
        const y = diaY(dia, clef, staffBottomY);

        // Is this note currently sounding?
        let noteStart = beat;
        if (dur === 0) {
          for (let b = beat - 1; b >= 0; b--) {
            if (voice.durations[b] > 0) { noteStart = b; break; }
          }
        }
        const noteEnd = noteStart + voice.durations[noteStart];
        const active = currentBeat >= noteStart && currentBeat < noteEnd;

        // ── held beat (tie continuation) ──
        if (dur === 0) {
          // tie arc from previous beat
          const prevX = noteAreaLeft + (beat - 0.5) * beatW;
          ctx.save();
          ctx.strokeStyle = active ? 'rgba(200,168,122,0.6)' : color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          const arcY = y + NOTE_RY + 5;
          ctx.moveTo(prevX + NOTE_RX + 2, y + 1);
          ctx.quadraticCurveTo((prevX + x) / 2, arcY + 6, x - NOTE_RX - 2, y + 1);
          ctx.stroke();
          ctx.restore();
          continue; // don't draw a note head for held beats
        }

        // ── ledger lines ──
        drawLedgerLines(x, dia, clef, staffBottomY);

        // ── accidental ──
        const acc = MusicTheory.getNoteAccidental(piece.key, midi);
        if (acc) {
          ctx.save();
          ctx.fillStyle = active ? '#c4a87a' : '#777';
          ctx.font = `${GAP * 1.5}px serif`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(acc, x - NOTE_RX - 3, y);
          ctx.restore();
        }

        // ── note head ──
        const isOpen = dur >= 2;
        ctx.save();
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(x, y, NOTE_RX, NOTE_RY, -0.3, 0, Math.PI * 2);
        if (isOpen) {
          // hollow note head
          ctx.strokeStyle = active ? '#c4a87a' : color;
          ctx.stroke();
        } else {
          ctx.fillStyle = active ? '#e8d5b7' : color;
          ctx.fill();
        }
        // Active glow
        if (active) {
          ctx.strokeStyle = '#c4a87a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(x, y, NOTE_RX + 3, NOTE_RY + 2, -0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        // ── stem (skip for dur >= 4, i.e. whole-note style) ──
        if (dur < 4) {
          const stemDir = y < staffTopY + staffHeight / 2 ? 1 : -1;
          const stemX = x + (stemDir === 1 ? NOTE_RX : -NOTE_RX);
          ctx.save();
          ctx.strokeStyle = active ? '#c4a87a' : color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(stemX, y);
          ctx.lineTo(stemX, y + stemDir * STEM_LEN);
          ctx.stroke();
          ctx.restore();
        }

        // ── annotation below staff ──
        const noteInfo = MusicTheory.midiToNoteName(midi);
        const degree = MusicTheory.getScaleDegree(piece.key, midi);
        ctx.save();
        ctx.fillStyle = active ? '#c4a87a' : '#999';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(noteInfo.full, x, staffBottomY + 4);
        if (degree) ctx.fillText(degree.name, x, staffBottomY + 14);
        ctx.restore();
      }
    }

    // ── playhead (vertical dashed line across all staves) ──
    if (currentBeat >= 0 && currentBeat < numBeats) {
      const px = noteAreaLeft + (currentBeat + 0.5) * beatW;
      ctx.save();
      ctx.strokeStyle = 'rgba(232,213,183,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, marginTop - 8);
      ctx.lineTo(px, marginTop + (numVoices - 1) * staffSpacing + staffHeight + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── measure numbers ──
    ctx.save();
    ctx.fillStyle = '#999';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let m = 0; m < numBeats / 4; m++) {
      const mx = noteAreaLeft + (m * 4 + 2) * beatW;
      ctx.fillText(`m.${m + 1}`, mx, marginTop - 5);
    }
    ctx.restore();
  }

  return { init, render, resize };
})();
