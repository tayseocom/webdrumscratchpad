(() => {
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const statusLabel = document.getElementById('status');
  const sequencerGrid = document.getElementById('sequencer-grid');

  const tempoSlider = document.getElementById('tempo');
  const tempoValue = document.getElementById('tempo-value');
  const swingSlider = document.getElementById('swing');
  const swingValue = document.getElementById('swing-value');

  const delayToggle = document.getElementById('delay-toggle');
  const delayTimeSlider = document.getElementById('delay-time');
  const delayTimeValue = document.getElementById('delay-time-value');

  const highpassToggle = document.getElementById('highpass-toggle');
  const highpassCutoffSlider = document.getElementById('highpass-cutoff');
  const highpassCutoffValue = document.getElementById('highpass-cutoff-value');

  const lowpassToggle = document.getElementById('lowpass-toggle');
  const lowpassCutoffSlider = document.getElementById('lowpass-cutoff');
  const lowpassCutoffValue = document.getElementById('lowpass-cutoff-value');

  const bassToggle = document.getElementById('bass-toggle');
  const bassChanceSlider = document.getElementById('bass-chance');
  const bassChanceValue = document.getElementById('bass-chance-value');

  const droneConfigs = [
    {
      toggle: document.getElementById('drone1-toggle'),
      slider: document.getElementById('drone1-frequency'),
      value: document.getElementById('drone1-frequency-value'),
      detuneRatio: 1.005,
      gain: 0.1
    },
    {
      toggle: document.getElementById('drone2-toggle'),
      slider: document.getElementById('drone2-frequency'),
      value: document.getElementById('drone2-frequency-value'),
      detuneRatio: 1.007,
      gain: 0.12
    },
    {
      toggle: document.getElementById('drone3-toggle'),
      slider: document.getElementById('drone3-frequency'),
      value: document.getElementById('drone3-frequency-value'),
      detuneRatio: 1.009,
      gain: 0.14
    }
  ];

  const stepCount = 16;
  const voiceDefinitions = [
    { id: 'kick', label: 'Kick' },
    { id: 'snare', label: 'Snare' },
    { id: 'hat', label: 'Hat' }
  ];

  const defaultPatterns = {
    kick: [0, 8],
    snare: [4, 12],
    hat: Array.from({ length: stepCount }, (_, index) => (index % 2 === 0 ? index : null)).filter(
      (index) => index !== null
    )
  };

  const sequenceState = new Map();
  const stepElements = new Map();
  let playheadStep = -1;

  let audioCtx;
  let masterInput;
  let masterGain;
  let highpassFilter;
  let lowpassFilter;
  let delayNode;
  let delayFeedback;
  let delaySend;
  let delayWet;

  let snareNoiseBuffer;
  let hatNoiseBuffer;

  let isPlaying = false;
  let schedulerId;
  let nextNoteTime = 0;
  let currentStep = 0;

  const lookahead = 25;
  const scheduleAheadTime = 0.1;

  let isRandomBassEnabled = bassToggle.checked;
  let bassChance = Number(bassChanceSlider.value);

  const cMajorNotes = [
    65.41, 73.42, 82.41, 87.31, 98.0, 110.0, 123.47, 130.81, 146.83, 164.81,
    174.61, 196.0, 220.0, 246.94, 261.63
  ];

  const droneState = new WeakMap();

  function ensureAudio() {
    if (audioCtx) {
      return audioCtx;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterInput = audioCtx.createGain();
    masterInput.gain.value = 1;

    highpassFilter = audioCtx.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = highpassToggle.checked
      ? Number(highpassCutoffSlider.value)
      : 20;

    lowpassFilter = audioCtx.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = lowpassToggle.checked
      ? Number(lowpassCutoffSlider.value)
      : audioCtx.sampleRate / 2;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;

    delayNode = audioCtx.createDelay(1.5);
    delayNode.delayTime.value = Number(delayTimeSlider.value) / 1000;

    delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.32;

    delayWet = audioCtx.createGain();
    delayWet.gain.value = 0.35;

    delaySend = audioCtx.createGain();
    delaySend.gain.value = delayToggle.checked ? 0.35 : 0;

    masterInput.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    masterInput.connect(delaySend);
    delaySend.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(masterGain);

    return audioCtx;
  }

  function connectVoice(node) {
    if (!masterInput) {
      ensureAudio();
    }
    node.connect(masterInput);
  }

  function cleanupNodes(...nodes) {
    nodes.forEach((node) => {
      if (!node) return;
      try {
        node.disconnect();
      } catch (err) {
        // ignored
      }
    });
  }

  function createNoiseBuffer(ctx, durationSeconds) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function getSnareNoiseBuffer(ctx) {
    if (!snareNoiseBuffer) {
      snareNoiseBuffer = createNoiseBuffer(ctx, 0.25);
    }
    return snareNoiseBuffer;
  }

  function getHatNoiseBuffer(ctx) {
    if (!hatNoiseBuffer) {
      hatNoiseBuffer = createNoiseBuffer(ctx, 0.08);
    }
    return hatNoiseBuffer;
  }

  function applyStepState(voiceId, stepIndex, state) {
    const pattern = sequenceState.get(voiceId);
    if (!pattern) return;
    pattern[stepIndex] = Boolean(state);
    const buttons = stepElements.get(voiceId);
    const button = buttons ? buttons[stepIndex] : undefined;
    if (!button) return;
    button.classList.toggle('active', pattern[stepIndex]);
    button.setAttribute('aria-pressed', pattern[stepIndex] ? 'true' : 'false');
  }

  function toggleStep(voiceId, stepIndex) {
    const pattern = sequenceState.get(voiceId);
    if (!pattern) return;
    const nextState = !pattern[stepIndex];
    applyStepState(voiceId, stepIndex, nextState);
  }

  function updatePlayhead(stepIndex) {
    if (playheadStep === stepIndex) {
      return;
    }
    stepElements.forEach((buttons) => {
      buttons.forEach((button, index) => {
        button.classList.toggle('playing', stepIndex === index);
      });
    });
    playheadStep = stepIndex;
  }

  function createSequencerGrid() {
    if (!sequencerGrid) return;
    sequencerGrid.textContent = '';

    voiceDefinitions.forEach((voice) => {
      const pattern = new Array(stepCount).fill(false);
      sequenceState.set(voice.id, pattern);

      const row = document.createElement('div');
      row.className = 'sequencer-row';
      row.setAttribute('role', 'row');

      const label = document.createElement('span');
      label.className = 'sequencer-label';
      label.textContent = voice.label;
      label.setAttribute('role', 'rowheader');
      row.appendChild(label);

      const stepsWrapper = document.createElement('div');
      stepsWrapper.className = 'steps';
      stepsWrapper.setAttribute('role', 'presentation');

      const buttons = [];
      for (let i = 0; i < stepCount; i += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'step';
        if (i % 4 === 0) {
          button.classList.add('step--beat');
        }
        button.dataset.voice = voice.id;
        button.dataset.step = String(i);
        button.setAttribute('aria-label', `${voice.label} step ${i + 1}`);
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('role', 'gridcell');
        button.addEventListener('click', () => toggleStep(voice.id, i));
        stepsWrapper.appendChild(button);
        buttons.push(button);
      }

      stepElements.set(voice.id, buttons);

      const defaults = defaultPatterns[voice.id] || [];
      defaults.forEach((index) => {
        if (typeof index === 'number' && index >= 0 && index < stepCount) {
          applyStepState(voice.id, index, true);
        }
      });

      row.appendChild(stepsWrapper);
      sequencerGrid.appendChild(row);
    });
  }

  function playKick(time) {
    ensureAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.25);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gain);
    connectVoice(gain);

    osc.start(time);
    osc.stop(time + 0.5);
    osc.onended = () => {
      cleanupNodes(osc, gain);
    };
  }

  function playSnare(time) {
    ensureAudio();
    if (!audioCtx) return;

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = getSnareNoiseBuffer(audioCtx);

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1200;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectVoice(noiseGain);

    noiseSource.start(time);
    noiseSource.stop(time + 0.3);
    noiseSource.onended = () => {
      cleanupNodes(noiseSource, noiseFilter, noiseGain);
    };

    const tone = audioCtx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(200, time);
    tone.frequency.exponentialRampToValueAtTime(120, time + 0.18);

    const toneGain = audioCtx.createGain();
    toneGain.gain.setValueAtTime(0.2, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    tone.connect(toneGain);
    connectVoice(toneGain);

    tone.start(time);
    tone.stop(time + 0.22);
    tone.onended = () => {
      cleanupNodes(tone, toneGain);
    };
  }

  function playHat(time) {
    ensureAudio();
    if (!audioCtx) return;

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = getHatNoiseBuffer(audioCtx);

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 9000;
    bandpass.Q.value = 8;

    const highpass = audioCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    noiseSource.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    connectVoice(gain);

    noiseSource.start(time);
    noiseSource.stop(time + 0.12);
    noiseSource.onended = () => {
      cleanupNodes(noiseSource, bandpass, highpass, gain);
    };
  }

  const voicePlayers = {
    kick: playKick,
    snare: playSnare,
    hat: playHat
  };

  function playBass(time) {
    if (!audioCtx || !isRandomBassEnabled) return;
    if (Math.random() * 100 >= bassChance) return;

    const index = Math.floor(Math.random() * cMajorNotes.length);
    const frequency = cMajorNotes[index];

    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.1);

    osc.connect(gain);
    connectVoice(gain);

    osc.start(time);
    osc.stop(time + 1.2);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function nextNote() {
    const tempo = Number(tempoSlider.value);
    const secondsPerBeat = 60 / tempo;
    const swingPercent = Number(swingSlider.value) / 100;

    nextNoteTime += 0.25 * secondsPerBeat;

    if (currentStep % 2 === 1) {
      nextNoteTime += swingPercent * (secondsPerBeat / 2);
    }

    currentStep = (currentStep + 1) % 16;
  }

  function scheduleStep() {
    const stepIndex = currentStep;
    updatePlayhead(stepIndex);

    voiceDefinitions.forEach((voice) => {
      const pattern = sequenceState.get(voice.id);
      if (!pattern || !pattern[stepIndex]) {
        return;
      }
      const player = voicePlayers[voice.id];
      if (player) {
        player(nextNoteTime);
      }
    });

    playBass(nextNoteTime);
  }

  function scheduler() {
    if (!audioCtx) return;
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
      scheduleStep();
      nextNote();
    }
    schedulerId = window.setTimeout(scheduler, lookahead);
  }

  function startSequencer() {
    ensureAudio();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (isPlaying) return;

    isPlaying = true;
    statusLabel.textContent = 'Playing';
    startButton.disabled = true;
    stopButton.disabled = false;

    nextNoteTime = audioCtx.currentTime + 0.05;
    currentStep = 0;
    updatePlayhead(-1);

    scheduler();
    startEnabledDrones();
  }

  function stopSequencer() {
    if (!isPlaying) return;
    isPlaying = false;

    window.clearTimeout(schedulerId);
    statusLabel.textContent = 'Stopped';
    startButton.disabled = false;
    stopButton.disabled = true;

    updatePlayhead(-1);
    currentStep = 0;

    stopAllDrones();
  }

  function startEnabledDrones() {
    droneConfigs.forEach((config) => {
      if (config.toggle.checked) {
        startDrone(config);
      }
    });
  }

  function stopAllDrones() {
    droneConfigs.forEach((config) => stopDrone(config));
  }

  function startDrone(config) {
    ensureAudio();
    if (!audioCtx) return;

    const state = droneState.get(config) || {};
    if (state.osc1 || state.osc2) return;

    const baseFrequency = Number(config.slider.value);

    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFrequency, audioCtx.currentTime);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFrequency * config.detuneRatio, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.value = config.gain;

    osc1.connect(gain);
    osc2.connect(gain);
    connectVoice(gain);

    osc1.start();
    osc2.start();

    droneState.set(config, { osc1, osc2, gain });
  }

  function stopDrone(config) {
    const state = droneState.get(config);
    if (!state) return;

    ['osc1', 'osc2'].forEach((key) => {
      const osc = state[key];
      if (!osc) return;
      try {
        osc.stop();
      } catch (err) {
        // ignore state errors
      }
      osc.disconnect();
      state[key] = null;
    });

    if (state.gain) {
      state.gain.disconnect();
      state.gain = null;
    }

    droneState.delete(config);
  }

  function updateDroneFrequency(config) {
    const state = droneState.get(config);
    config.value.textContent = `${Math.round(Number(config.slider.value))} Hz`;
    if (!state) return;
    const baseFrequency = Number(config.slider.value);
    state.osc1.frequency.setTargetAtTime(baseFrequency, audioCtx.currentTime, 0.05);
    state.osc2.frequency.setTargetAtTime(baseFrequency * config.detuneRatio, audioCtx.currentTime, 0.05);
  }

  function updateDelayState() {
    if (!audioCtx || !delayNode || !delaySend) return;
    delaySend.gain.setTargetAtTime(delayToggle.checked ? 0.35 : 0.0, audioCtx.currentTime, 0.05);
    delayNode.delayTime.setTargetAtTime(Number(delayTimeSlider.value) / 1000, audioCtx.currentTime, 0.05);
  }

  function updateFilterState() {
    if (!audioCtx) return;
    if (highpassFilter) {
      const target = highpassToggle.checked ? Number(highpassCutoffSlider.value) : 20;
      highpassFilter.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.05);
    }
    if (lowpassFilter) {
      const maxFrequency = audioCtx.sampleRate / 2;
      const target = lowpassToggle.checked ? Number(lowpassCutoffSlider.value) : maxFrequency;
      lowpassFilter.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.05);
    }
  }

  function updateBassChance() {
    bassChance = Number(bassChanceSlider.value);
    bassChanceValue.textContent = `${bassChance}%`;
  }

  createSequencerGrid();
  updatePlayhead(-1);

  startButton.addEventListener('click', startSequencer);
  stopButton.addEventListener('click', stopSequencer);

  tempoSlider.addEventListener('input', () => {
    tempoValue.textContent = `${tempoSlider.value} BPM`;
  });

  swingSlider.addEventListener('input', () => {
    swingValue.textContent = `${swingSlider.value}%`;
  });

  delayTimeSlider.addEventListener('input', () => {
    delayTimeValue.textContent = `${delayTimeSlider.value} ms`;
    updateDelayState();
  });
  delayToggle.addEventListener('change', () => {
    updateDelayState();
  });

  highpassCutoffSlider.addEventListener('input', () => {
    highpassCutoffValue.textContent = `${highpassCutoffSlider.value} Hz`;
    updateFilterState();
  });
  highpassToggle.addEventListener('change', updateFilterState);

  lowpassCutoffSlider.addEventListener('input', () => {
    const value = Number(lowpassCutoffSlider.value);
    lowpassCutoffValue.textContent = `${value.toLocaleString()} Hz`;
    updateFilterState();
  });
  lowpassToggle.addEventListener('change', updateFilterState);

  bassToggle.addEventListener('change', () => {
    isRandomBassEnabled = bassToggle.checked;
  });

  bassChanceSlider.addEventListener('input', () => {
    updateBassChance();
  });

  droneConfigs.forEach((config) => {
    config.value.textContent = `${Math.round(Number(config.slider.value))} Hz`;
    config.slider.addEventListener('input', () => updateDroneFrequency(config));
    config.toggle.addEventListener('change', () => {
      if (config.toggle.checked) {
        if (isPlaying) {
          startDrone(config);
        }
      } else {
        stopDrone(config);
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSequencer();
    }
  });

  updateBassChance();
  delayTimeValue.textContent = `${delayTimeSlider.value} ms`;
  highpassCutoffValue.textContent = `${highpassCutoffSlider.value} Hz`;
  lowpassCutoffValue.textContent = `${Number(lowpassCutoffSlider.value).toLocaleString()} Hz`;
  tempoValue.textContent = `${tempoSlider.value} BPM`;
  swingValue.textContent = `${swingSlider.value}%`;
})();
