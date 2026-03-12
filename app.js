/**
 * Main application: ties together generation, playback, rendering, and analysis.
 */
(() => {
  // State
  let piece = null;
  let isPlaying = false;
  let playTimer = null;
  let currentBeat = -1;
  let tempo = 72;

  // DOM refs
  const instrumentSel = document.getElementById('instrument');
  const keySel = document.getElementById('key-select');
  const voicesSel = document.getElementById('voices');
  const tempoSlider = document.getElementById('tempo');
  const tempoDisplay = document.getElementById('tempo-display');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const generateBtn = document.getElementById('generate-btn');
  const continuousChk = document.getElementById('continuous');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const appEl = document.getElementById('app');
  const canvas = document.getElementById('score-canvas');

  // Analysis DOM
  const beatInfo = document.getElementById('beat-info');
  const intervalInfo = document.getElementById('interval-info');
  const cadenceInfo = document.getElementById('cadence-info');
  const motionInfo = document.getElementById('motion-info');
  const ruleInfo = document.getElementById('rule-info');

  // Init
  ScoreRenderer.init(canvas);
  generatePiece();

  // Event listeners
  tempoSlider.addEventListener('input', () => {
    tempo = parseInt(tempoSlider.value);
    tempoDisplay.textContent = tempo;
  });

  playBtn.addEventListener('click', startPlayback);
  stopBtn.addEventListener('click', stopPlayback);
  generateBtn.addEventListener('click', () => {
    stopPlayback();
    generatePiece();
  });

  keySel.addEventListener('change', () => { stopPlayback(); generatePiece(); });
  voicesSel.addEventListener('change', () => { stopPlayback(); generatePiece(); });

  // Fullscreen toggle
  fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (appEl.requestFullscreen || appEl.webkitRequestFullscreen).call(appEl);
    }
  });

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  function onFullscreenChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fullscreenBtn.textContent = isFs ? '\u00D7' : '\u26F6';
    fullscreenBtn.title = isFs ? 'Exit full screen' : 'Full screen';
    // Re-render after layout settles
    setTimeout(() => {
      ScoreRenderer.resize();
      if (piece) ScoreRenderer.render(piece, currentBeat);
    }, 100);
  }

  function generatePiece() {
    const key = keySel.value;
    const numVoices = parseInt(voicesSel.value);
    piece = Counterpoint.generate(key, numVoices);
    currentBeat = -1;
    ScoreRenderer.render(piece, -1);
    updateAnalysis(-1);
  }

  function startPlayback() {
    if (isPlaying) return;
    Instruments.getContext();
    isPlaying = true;
    currentBeat = -1;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    generateBtn.disabled = true;
    playNextBeat();
  }

  function stopPlayback() {
    isPlaying = false;
    if (playTimer) {
      clearTimeout(playTimer);
      playTimer = null;
    }
    Instruments.stopAll();
    playBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = false;
    currentBeat = -1;
    if (piece) ScoreRenderer.render(piece, -1);
  }

  function playNextBeat() {
    if (!isPlaying || !piece) return;

    currentBeat++;

    if (currentBeat >= piece.length) {
      if (continuousChk.checked) {
        // Seamless transition: generate new piece and keep playing.
        // Don't call stopAll — let the last notes finish naturally.
        generatePiece();
        currentBeat = 0;
        // fall through to play beat 0 of the new piece
      } else {
        stopPlayback();
        return;
      }
    }

    const instrument = instrumentSel.value;
    const beatDuration = 60 / tempo;

    // Play voices — only trigger sound on note onsets (durations > 0)
    for (let v = 0; v < piece.voices.length; v++) {
      const voice = piece.voices[v];
      const dur = voice.durations[currentBeat];

      if (dur > 0) {
        const midi = voice.notes[currentBeat];
        const noteDuration = beatDuration * dur - 0.05;
        const velocity = v === 0 ? 0.75 : (v === piece.voices.length - 1 ? 0.7 : 0.6);
        Instruments.playNote(instrument, midi, Math.max(noteDuration, 0.1), velocity);
      }
    }

    ScoreRenderer.render(piece, currentBeat);
    updateAnalysis(currentBeat);

    playTimer = setTimeout(playNextBeat, beatDuration * 1000);
  }

  function updateAnalysis(beatIdx) {
    if (beatIdx < 0 || !piece) {
      beatInfo.innerHTML = '<span style="color:#666">Press Play to begin</span>';
      intervalInfo.innerHTML = '';
      cadenceInfo.innerHTML = '';
      motionInfo.innerHTML = '';
      ruleInfo.innerHTML = '';
      return;
    }

    const a = Analysis.analyzebeat(piece, beatIdx);
    if (!a) return;

    beatInfo.innerHTML = `<div style="margin-bottom:4px"><strong>Beat ${a.beat}</strong></div>` +
      a.notes.map((n, i) => {
        const voice = piece.voices[i];
        const isHeld = voice.durations[beatIdx] === 0;
        const heldTag = isHeld ? ' <span style="color:#888;font-size:0.8em">(held)</span>' : '';
        return `<div><span class="voice-label">${n.voice}:</span> ` +
          `<span class="note-label">${n.name}</span> ` +
          `<span class="degree">${n.degree}</span>${heldTag}</div>`;
      }).join('');

    intervalInfo.innerHTML = a.intervals.map(iv => {
      const cls = iv.quality === 'dissonant' ? 'rule-violation' :
                  iv.quality === 'perfect' ? '' : 'rule-ok';
      return `<div class="${cls}">${iv.voices}: <strong>${iv.interval}</strong> (${iv.quality})</div>`;
    }).join('');

    if (a.cadence) {
      cadenceInfo.innerHTML = `<span class="cadence-label">${a.cadence.symbol}</span> ${a.cadence.name}`;
    } else {
      cadenceInfo.innerHTML = '<span style="color:#666">None detected</span>';
    }

    if (a.motions.length > 0) {
      motionInfo.innerHTML = a.motions.map(m =>
        `<span class="motion-type motion-${m.type}">${m.voices}: ${m.type}</span>`
      ).join(' ');
    } else {
      motionInfo.innerHTML = '<span style="color:#666">N/A (first beat)</span>';
    }

    ruleInfo.innerHTML = a.ruleNotes.map(r =>
      `<div class="${r.ok ? 'rule-ok' : 'rule-violation'}">${r.ok ? '\u2713' : '\u2717'} ${r.text}</div>`
    ).join('');
  }
})();
