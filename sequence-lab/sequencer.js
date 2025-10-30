(() => {
  const instruments = ["kick", "snare", "hihat", "bass"];
  const stepsPerMeasure = 16;
  const lookahead = 25; // ms
  const scheduleAheadTime = 0.1; // seconds

  const patterns = Object.fromEntries(
    instruments.map((name) => [name, new Array(stepsPerMeasure).fill(false)])
  );

  const densities = {
    kick: 0.55,
    snare: 0.35,
    hihat: 0.75,
    bass: 0.25,
  };

  const cellsByStep = Array.from({ length: stepsPerMeasure }, () => []);
  const allCells = [];

  let audioCtx;
  let masterGain;
  let reverbFilter;
  let noiseBuffer;
  let currentStep = 0;
  let nextNoteTime = 0;
  let isPlaying = false;
  let schedulerTimer;
  let activeVisualStep = null;
  let tempo = 120;
  let swingAmount = 0; // 0 to 0.6

  const secondsPerSixteenth = () => (60 / tempo) / 4;

  const statusEl = document.getElementById("status");
  const tempoSlider = document.getElementById("tempo");
  const tempoDisplay = document.getElementById("tempo-display");
  const swingSlider = document.getElementById("swing");
  const swingDisplay = document.getElementById("swing-display");
  const volumeSlider = document.getElementById("volume");
  const volumeDisplay = document.getElementById("volume-display");
  const playToggle = document.getElementById("play-toggle");
  const clearButton = document.getElementById("clear-pattern");
  const randomizeAllButton = document.getElementById("randomize-pattern");

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(volumeSlider.value / 100, audioCtx.currentTime);
      reverbFilter = audioCtx.createBiquadFilter();
      reverbFilter.type = "lowpass";
      reverbFilter.frequency.setValueAtTime(8000, audioCtx.currentTime);
      masterGain.connect(reverbFilter).connect(audioCtx.destination);
      noiseBuffer = createNoiseBuffer(audioCtx);
    }
  }

  function createNoiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function toggleStep(event) {
    const button = event.currentTarget;
    const instrument = button.dataset.instrument;
    const stepIndex = Number(button.dataset.step);
    const isActive = !patterns[instrument][stepIndex];
    patterns[instrument][stepIndex] = isActive;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function resetVisuals() {
    if (activeVisualStep !== null) {
      cellsByStep[activeVisualStep].forEach((cell) => cell.classList.remove("playing"));
    }
    activeVisualStep = null;
  }

  function highlightStep(step, time) {
    if (!audioCtx) {
      return;
    }
    const delay = Math.max((time - audioCtx.currentTime) * 1000, 0);
    window.setTimeout(() => {
      if (!isPlaying) {
        return;
      }
      if (activeVisualStep !== null) {
        cellsByStep[activeVisualStep].forEach((cell) => cell.classList.remove("playing"));
      }
      cellsByStep[step].forEach((cell) => cell.classList.add("playing"));
      activeVisualStep = step;
    }, delay);
  }

  function scheduleStep(step, time) {
    instruments.forEach((instrument) => {
      if (patterns[instrument][step]) {
        playInstrument(instrument, time, step);
      }
    });
    highlightStep(step, time);
  }

  function advanceStep() {
    const baseDuration = secondsPerSixteenth();
    const length =
      currentStep % 2 === 0
        ? baseDuration * (1 + swingAmount)
        : baseDuration * (1 - swingAmount);
    nextNoteTime += length;
    currentStep = (currentStep + 1) % stepsPerMeasure;
  }

  function scheduler() {
    while (isPlaying && nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
      scheduleStep(currentStep, nextNoteTime);
      advanceStep();
    }
  }

  function start() {
    ensureAudio();
    audioCtx.resume();
    currentStep = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    isPlaying = true;
    playToggle.textContent = "Stop";
    setStatus(`Playing at ${tempo} BPM with ${Math.round(swingAmount * 100)}% swing.`);
    schedulerTimer = window.setInterval(scheduler, lookahead);
  }

  function stop() {
    isPlaying = false;
    playToggle.textContent = "Play";
    window.clearInterval(schedulerTimer);
    resetVisuals();
    setStatus("Stopped.");
  }

  function playInstrument(name, time, step) {
    if (!audioCtx) {
      return;
    }
    switch (name) {
      case "kick":
        playKick(time);
        break;
      case "snare":
        playSnare(time);
        break;
      case "hihat":
        playHat(time);
        break;
      case "bass":
        playBass(time, step);
        break;
      default:
        break;
    }
  }

  function playKick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.28);
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(gain).connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function playSnare(time) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1800, time);
    noiseFilter.Q.setValueAtTime(0.8, time);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);

    const tone = audioCtx.createOscillator();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(220, time);
    tone.frequency.exponentialRampToValueAtTime(150, time + 0.2);
    const toneGain = audioCtx.createGain();
    toneGain.gain.setValueAtTime(0.35, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    tone.connect(toneGain).connect(masterGain);

    noise.start(time);
    noise.stop(time + 0.3);
    tone.start(time);
    tone.stop(time + 0.35);
  }

  function playHat(time) {
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    const highpass = audioCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(8000, time);
    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(0.3, time);
    envelope.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    source.connect(highpass).connect(envelope).connect(masterGain);
    source.start(time);
    source.stop(time + 0.15);
  }

  function playBass(time, step) {
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, time);
    filter.Q.setValueAtTime(6, time);

    const notes = [36, 36, 41, 43];
    const noteIndex = Math.floor(step / 4) % notes.length;
    const freq = midiToFrequency(notes[noteIndex]);
    osc.frequency.setValueAtTime(freq, time);

    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function clearPattern() {
    instruments.forEach((instrument) => {
      patterns[instrument].fill(false);
    });
    allCells.forEach((cell) => {
      cell.classList.remove("active");
      cell.setAttribute("aria-pressed", "false");
    });
  }

  function randomizeRow(instrument) {
    const probability = densities[instrument] ?? 0.5;
    patterns[instrument] = patterns[instrument].map(() => Math.random() < probability);
    patterns[instrument].forEach((active, index) => {
      const cell = cellsByStep[index].find((node) => node.dataset.instrument === instrument);
      if (!cell) {
        return;
      }
      cell.classList.toggle("active", active);
      cell.setAttribute("aria-pressed", String(active));
    });
  }

  function randomizeAll() {
    instruments.forEach((instrument) => randomizeRow(instrument));
  }

  function handlePlayToggle() {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  }

  function initGrid() {
    document.querySelectorAll(".row").forEach((row) => {
      const instrument = row.dataset.instrument;
      const container = row.querySelector(".steps");
      for (let i = 0; i < stepsPerMeasure; i += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "step";
        button.dataset.instrument = instrument;
        button.dataset.step = String(i);
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", toggleStep);
        container.appendChild(button);
        cellsByStep[i].push(button);
        allCells.push(button);
      }
    });
  }

  function bindControls() {
    playToggle.addEventListener("click", handlePlayToggle);
    tempoSlider.addEventListener("input", () => {
      tempo = Number(tempoSlider.value);
      tempoDisplay.textContent = `${tempo} BPM`;
      if (isPlaying) {
        setStatus(`Playing at ${tempo} BPM with ${Math.round(swingAmount * 100)}% swing.`);
      }
    });

    swingSlider.addEventListener("input", () => {
      swingAmount = Number(swingSlider.value) / 100;
      swingDisplay.textContent = `${Math.round(swingAmount * 100)}%`;
      if (isPlaying) {
        setStatus(`Playing at ${tempo} BPM with ${Math.round(swingAmount * 100)}% swing.`);
      }
    });

    volumeSlider.addEventListener("input", () => {
      const value = Number(volumeSlider.value);
      volumeDisplay.textContent = `${value}%`;
      if (!audioCtx) {
        return;
      }
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.linearRampToValueAtTime(value / 100, audioCtx.currentTime + 0.05);
    });

    document.querySelectorAll(".row-randomize").forEach((button) => {
      button.addEventListener("click", () => {
        randomizeRow(button.dataset.target);
      });
    });

    clearButton.addEventListener("click", clearPattern);
    randomizeAllButton.addEventListener("click", randomizeAll);
  }

  initGrid();
  bindControls();
})();
