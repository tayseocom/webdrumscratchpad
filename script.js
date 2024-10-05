// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let audioCtx;
    let masterGain; // Global master gain node
    let isPlaying = false;
    let currentStep = 0;
    let nextNoteTime = 0.0;
    const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
    const scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)
    let timerID;

    // Connection state flags
    let isDelayConnected = false;
    let isLowpassConnected = false;
    let isHighpassConnected = false;

    // Global tempo variable initialized to default value
    let tempo = 120;

    // Define tomChance variable
    let tomChance = 25; // 25% chance to play toms on each step

    // Kick drum parameters
    const kickParams = {
        'standard': {
            baseFrequency: 150,
            detune: 1.02,
            decay: 0.5,
            type: 'sine',
            subFrequency: 60, // Sub-oscillator for depth
            subGain: 0.3,
            pitchDecay: 0.05, // Pitch envelope decay
            filter: null,
            gain: 1.0
        },
        'deep': { // TR-808 Kick
            baseFrequency: 100, // Lower base frequency for deeper tone
            detune: 1.05,
            decay: 0.7,
            type: 'sine',
            subFrequency: 50, // Lower sub-frequency
            subGain: 0.4,
            pitchDecay: 0.07,
            filter: {
                type: 'lowpass',
                frequency: 300
            },
            gain: 1.0
        },
        '909': { // TR-909 Kick
            baseFrequency: 180, // Higher base frequency for snappier sound
            detune: 1.03,
            decay: 0.4,
            type: 'sine',
            subFrequency: 0, // No sub-oscillator for cleaner tone
            subGain: 0,
            pitchDecay: 0.03,
            filter: {
                type: 'highpass',
                frequency: 500
            },
            gain: 1.0
        },
        'true808': { // Enhanced 808 Kick
            baseFrequency: 120,
            detune: 1.04,
            decay: 0.6,
            type: 'sine',
            subFrequency: 40,
            subGain: 0.5,
            pitchDecay: 0.06,
            filter: {
                type: 'lowpass',
                frequency: 250
            },
            gain: 1.0
        }
    };

    // Snare drum parameters
    const snareParams = {
        'standard': { // Reintroduced Standard Snare
            noiseType: 'white',
            filterType: 'highpass',
            filterFreq: 1000,
            bodyTone: false,
            reverb: false,
            gain: 0.8 // Increased gain for impact
        },
        'clap': { // Reintroduced Clap Snare
            noiseType: 'white',
            filterType: 'bandpass',
            filterFreq: 1500,
            bodyTone: false,
            reverb: false,
            gain: 0.9 // Increased gain for more impact
        },
        'acoustic-snap': { // New Acoustic Snap Snare
            noiseType: 'white',
            filterType: 'bandpass',
            filterFreq: 1200,
            bodyTone: false,
            reverb: false,
            gain: 0.7
        },
        'electronic-tight': { // New Electronic Tight Snare
            noiseType: 'pink',
            filterType: 'highpass',
            filterFreq: 2000,
            bodyTone: false,
            reverb: false,
            gain: 0.6
        },
        'clap-layered': { // New Clap Layered Snare
            noiseType: 'white',
            filterType: 'bandpass',
            filterFreq: 1600,
            bodyTone: true, // Adds a body tone for layered clap effect
            reverb: false,
            gain: 0.85
        },
        'reverb-tail': { // New Reverb Tail Snare
            noiseType: 'white',
            filterType: 'highpass',
            filterFreq: 1000,
            bodyTone: false,
            reverb: true, // Adds reverb tail
            gain: 0.75
        }
    };

    // Check for necessary DOM elements and buttons
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');

    if (!startButton || !stopButton) {
        return;
    }

    // Retrieve all slider and select elements
    const tempoSlider = document.getElementById('tempo');
    const tempoValue = document.getElementById('tempo-value');
    const delayTimeSlider = document.getElementById('delay-time');
    const delayTimeValue = document.getElementById('delay-time-value');
    const delayToggle = document.getElementById('delay-toggle');
    const filterCutoffSlider = document.getElementById('filter-cutoff');
    const filterCutoffValue = document.getElementById('filter-cutoff-value');
    const lowpassToggle = document.getElementById('lowpass-toggle');
    const highpassCutoffSlider = document.getElementById('highpass-cutoff');
    const highpassCutoffValue = document.getElementById('highpass-cutoff-value');
    const highpassToggle = document.getElementById('highpass-toggle');
    const swingSlider = document.getElementById('swing');
    const swingValue = document.getElementById('swing-value');
    const secondKickBeatSlider = document.getElementById('second-kick-beat');
    const secondKickBeatValue = document.getElementById('second-kick-beat-value');
    const kickSoundSelect = document.getElementById('kick-sound');
    const snareShapeSelect = document.getElementById('snare-shape');
    const kickDecaySlider = document.getElementById('kick-decay');
    const kickDecayValue = document.getElementById('kick-decay-value');
    const tomsToggle = document.getElementById('toms-toggle');
    const hihatPatternSelect = document.getElementById('hihat-pattern');

    // Drones Controls
    const drone1Toggle = document.getElementById('drone1-toggle');
    const drone1FrequencySlider = document.getElementById('drone1-frequency');
    const drone1FrequencyValue = document.getElementById('drone1-frequency-value');

    const drone2Toggle = document.getElementById('drone2-toggle');
    const drone2FrequencySlider = document.getElementById('drone2-frequency');
    const drone2FrequencyValue = document.getElementById('drone2-frequency-value');

    const drone3Toggle = document.getElementById('drone3-toggle');
    const drone3FrequencySlider = document.getElementById('drone3-frequency');
    const drone3FrequencyValue = document.getElementById('drone3-frequency-value');

    // Bass Controls
    const bassToggle = document.getElementById('bass-toggle');
    const bassChanceSlider = document.getElementById('bass-chance');
    const bassChanceValue = document.getElementById('bass-chance-value');

    // Tom Chance Controls
    const tomChanceSlider = document.getElementById('tom-chance');
    const tomChanceValue = document.getElementById('tom-chance-value');

    // Ensure all sliders and selects are present
    if (!tempoSlider || !tempoValue || !delayTimeSlider || !delayTimeValue ||
        !delayToggle || !filterCutoffSlider || !filterCutoffValue ||
        !lowpassToggle || !highpassCutoffSlider || !highpassCutoffValue ||
        !highpassToggle || !swingSlider || !swingValue ||
        !secondKickBeatSlider || !secondKickBeatValue ||
        !kickSoundSelect || !snareShapeSelect ||
        !kickDecaySlider || !kickDecayValue ||
        !tomsToggle || !hihatPatternSelect ||
        !drone1Toggle || !drone1FrequencySlider || !drone1FrequencyValue ||
        !drone2Toggle || !drone2FrequencySlider || !drone2FrequencyValue ||
        !drone3Toggle || !drone3FrequencySlider || !drone3FrequencyValue ||
        !bassToggle || !bassChanceSlider || !bassChanceValue ||
        !tomChanceSlider || !tomChanceValue) {
        return;
    }

    // Initialize second kick beat (default to beat 2)
    let secondKickBeat = parseInt(secondKickBeatSlider.value); // 1-4
    secondKickBeatValue.textContent = secondKickBeat;

    // Initialize kick decay (default to 0.5 seconds)
    let kickDecay = parseFloat(kickDecaySlider.value); // 0.1 - 1.0
    kickDecayValue.textContent = kickDecay;

    // Initialize Hi-Hat pattern (default to 8th notes)
    let hihatPattern = hihatPatternSelect.value; // '8th' or '4th'

    // Initialize Snare Shape (default to 'standard')
    let snareShape = snareShapeSelect.value; // 'standard', 'clap', 'acoustic-snap', etc.

    // Initialize Kick Sound Selection (default to 'standard')
    let kickSound = kickSoundSelect.value; // 'standard', 'deep', '909', 'true808'

    // Initialize Toms Toggle
    let tomsEnabled = tomsToggle.checked;

    // Initialize Drones
    let drone1Enabled = drone1Toggle.checked;
    let drone1Frequency = parseFloat(drone1FrequencySlider.value);
    drone1FrequencyValue.textContent = drone1Frequency.toFixed(2);

    let drone2Enabled = drone2Toggle.checked;
    let drone2Frequency = parseFloat(drone2FrequencySlider.value);
    drone2FrequencyValue.textContent = drone2Frequency.toFixed(2);

    let drone3Enabled = drone3Toggle.checked;
    let drone3Frequency = parseFloat(drone3FrequencySlider.value);
    drone3FrequencyValue.textContent = drone3Frequency.toFixed(2);

    // Initialize Bass Synth Toggle State
    let isRandomBassEnabled = bassToggle.checked;

    // Initialize Bass Chance
    let bassChance = parseInt(bassChanceSlider.value);
    bassChanceValue.textContent = bassChance;

    // Initialize Tom Chance
    tomChance = parseInt(tomChanceSlider.value);
    tomChanceValue.textContent = tomChance;

    // Attach event listeners to sliders and select inputs immediately for real-time updates
    tempoSlider.addEventListener('input', (e) => {
        tempo = parseInt(e.target.value);
        tempoValue.textContent = tempo;
    });

    delayTimeSlider.addEventListener('input', (e) => {
        const delayMs = parseInt(e.target.value);
        delayTimeValue.textContent = delayMs;
        if (audioCtx && delayNode && delayToggle.checked) {
            delayNode.delayTime.setValueAtTime(delayMs / 1000, audioCtx.currentTime);
        }
    });

    delayToggle.addEventListener('change', (e) => {
        if (audioCtx && delayNode) {
            if (delayToggle.checked) {
                if (!isDelayConnected) {
                    delayNode.connect(lowpassFilter);
                    isDelayConnected = true;
                }
            } else {
                if (isDelayConnected) {
                    delayNode.disconnect(lowpassFilter);
                    isDelayConnected = false;
                }
            }
        }
    });

    filterCutoffSlider.addEventListener('input', (e) => {
        const cutoff = parseInt(e.target.value);
        filterCutoffValue.textContent = cutoff;
        if (audioCtx && lowpassFilter) {
            if (cutoff === 0) {
                // Bypass Low-Pass Filter
                if (isLowpassConnected) {
                    lowpassFilter.disconnect(masterGain);
                    isLowpassConnected = false;
                }
            } else {
                // Apply Low-Pass Filter
                lowpassFilter.frequency.setValueAtTime(cutoff, audioCtx.currentTime);
                if (!isLowpassConnected && lowpassToggle.checked) {
                    lowpassFilter.connect(masterGain);
                    isLowpassConnected = true;
                }
            }
        }
    });

    lowpassToggle.addEventListener('change', (e) => {
        if (audioCtx && lowpassFilter) {
            if (lowpassToggle.checked) {
                if (!isLowpassConnected && parseInt(filterCutoffSlider.value) > 0) {
                    lowpassFilter.connect(masterGain);
                    isLowpassConnected = true;
                }
            } else {
                if (isLowpassConnected) {
                    lowpassFilter.disconnect(masterGain);
                    isLowpassConnected = false;
                }
            }
        }
    });

    highpassCutoffSlider.addEventListener('input', (e) => {
        const cutoff = parseInt(e.target.value);
        highpassCutoffValue.textContent = cutoff;
        if (audioCtx && highpassFilter) {
            if (cutoff === 0) {
                // Bypass High-Pass Filter
                if (isHighpassConnected) {
                    highpassFilter.disconnect(lowpassFilter);
                    isHighpassConnected = false;
                }
            } else {
                // Apply High-Pass Filter
                highpassFilter.frequency.setValueAtTime(cutoff, audioCtx.currentTime);
                if (!isHighpassConnected && highpassToggle.checked) {
                    highpassFilter.connect(lowpassFilter);
                    isHighpassConnected = true;
                }
            }
        }
    });

    highpassToggle.addEventListener('change', (e) => {
        if (audioCtx && highpassFilter) {
            if (highpassToggle.checked) {
                if (!isHighpassConnected && parseInt(highpassCutoffSlider.value) > 0) {
                    highpassFilter.connect(lowpassFilter);
                    isHighpassConnected = true;
                }
            } else {
                if (isHighpassConnected) {
                    highpassFilter.disconnect(lowpassFilter);
                    isHighpassConnected = false;
                }
            }
        }
    });

    swingSlider.addEventListener('input', (e) => {
        const swingValueNum = parseInt(e.target.value);
        swingValue.textContent = swingValueNum;
    });

    secondKickBeatSlider.addEventListener('input', (e) => {
        secondKickBeat = parseInt(e.target.value);
        secondKickBeatValue.textContent = secondKickBeat;
    });

    kickSoundSelect.addEventListener('change', (e) => {
        kickSound = e.target.value;
    });

    snareShapeSelect.addEventListener('change', (e) => {
        snareShape = e.target.value;
    });

    kickDecaySlider.addEventListener('input', (e) => {
        kickDecay = parseFloat(e.target.value);
        kickDecayValue.textContent = kickDecay;
    });

    tomsToggle.addEventListener('change', (e) => {
        tomsEnabled = tomsToggle.checked;
    });

    hihatPatternSelect.addEventListener('change', (e) => {
        hihatPattern = e.target.value;
    });

    // Drones Controls Event Listeners
    drone1Toggle.addEventListener('change', () => {
        drone1Enabled = drone1Toggle.checked;
        if (drone1Enabled) {
            startDrone1();
        } else {
            stopDrone1();
        }
    });

    drone1FrequencySlider.addEventListener('input', (e) => {
        drone1Frequency = parseFloat(e.target.value);
        drone1FrequencyValue.textContent = drone1Frequency.toFixed(2);
        if (drone1Osc1) {
            drone1Osc1.frequency.setValueAtTime(drone1Frequency, audioCtx.currentTime);
        }
        if (drone1Osc2) {
            drone1Osc2.frequency.setValueAtTime(drone1Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus
        }
    });

    drone2Toggle.addEventListener('change', () => {
        drone2Enabled = drone2Toggle.checked;
        if (drone2Enabled) {
            startDrone2();
        } else {
            stopDrone2();
        }
    });

    drone2FrequencySlider.addEventListener('input', (e) => {
        drone2Frequency = parseFloat(e.target.value);
        drone2FrequencyValue.textContent = drone2Frequency.toFixed(2);
        if (drone2Osc1) {
            drone2Osc1.frequency.setValueAtTime(drone2Frequency, audioCtx.currentTime);
        }
        if (drone2Osc2) {
            drone2Osc2.frequency.setValueAtTime(drone2Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus
        }
    });

    drone3Toggle.addEventListener('change', () => {
        drone3Enabled = drone3Toggle.checked;
        if (drone3Enabled) {
            startDrone3();
        } else {
            stopDrone3();
        }
    });

    drone3FrequencySlider.addEventListener('input', (e) => {
        drone3Frequency = parseFloat(e.target.value);
        drone3FrequencyValue.textContent = drone3Frequency.toFixed(2);
        if (drone3Osc1) {
            drone3Osc1.frequency.setValueAtTime(drone3Frequency, audioCtx.currentTime);
        }
        if (drone3Osc2) {
            drone3Osc2.frequency.setValueAtTime(drone3Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus
        }
    });

    // Bass Synth Controls
    bassToggle.addEventListener('change', (e) => {
        isRandomBassEnabled = e.target.checked;
    });

    bassChanceSlider.addEventListener('input', (e) => {
        bassChance = parseInt(e.target.value);
        bassChanceValue.textContent = bassChance;
    });

    // Tom Chance Controls
    tomChanceSlider.addEventListener('input', (e) => {
        tomChance = parseInt(e.target.value);
        tomChanceValue.textContent = tomChance;
    });

    // Audio Nodes
    let delayNode;
    let lowpassFilter;
    let highpassFilter;

    // Drone Nodes
    let drone1Osc1, drone1Osc2, drone1Gain;
    let drone2Osc1, drone2Osc2, drone2Gain;
    let drone3Osc1, drone3Osc2, drone3Gain;

    // --- Bass Synth Functionality ---

    // Define the C Major Scale Frequencies starting at C2 and C3
    const cMajorScale = {
        'C2': 65.41,
        'D2': 73.42,
        'E2': 82.41,
        'F2': 87.31,
        'G2': 98.00,
        'A2': 110.00,
        'B2': 123.47,
        'C3': 130.81,
        'D3': 146.83,
        'E3': 164.81,
        'F3': 174.61,
        'G3': 196.00,
        'A3': 220.00,
        'B3': 246.94,
        'C4': 261.63
    };

    const cMajorNotes = Object.values(cMajorScale); // Array of frequencies

    // Function to play bass note
    function playBass(time) {
        if (!isRandomBassEnabled) return; // Do nothing if bass is not enabled

        // Use bassChance to determine if bass should play
        if (Math.random() * 100 >= bassChance) return;

        // Select a random note from C major scale
        const randomIndex = Math.floor(Math.random() * cMajorNotes.length);
        const frequency = cMajorNotes[randomIndex];

        // Create oscillator
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth'; // 'sawtooth' for a bass sound
        osc.frequency.setValueAtTime(frequency, time);

        // Create gain node for amplitude envelope
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.15, time); // Adjust gain to prevent clipping
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 1.0); // 1-second decay

        // Connect oscillator to gain
        osc.connect(gainNode);

        // Connect gain to master gain
        gainNode.connect(masterGain);

        // Start and stop oscillator
        osc.start(time);
        osc.stop(time + 1.0); // Duration of the bass note

        // Cleanup after stopping
        osc.onended = () => {
            osc.disconnect();
            gainNode.disconnect();
        };
    }

    // Function to Create a Reverb Buffer
    function createReverbBuffer(audioCtx, duration = 2, decay = 2) {
        const sampleRate = audioCtx.sampleRate;
        const length = sampleRate * duration;
        const impulse = audioCtx.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    // Start Button Event Listener
    startButton.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            setupAudioContext();
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        if (!isPlaying) {
            isPlaying = true;
            currentStep = 0;
            nextNoteTime = audioCtx.currentTime;
            scheduler();
            document.getElementById('status').textContent = 'Playing';
        }

        // Start drones if enabled
        if (drone1Enabled) {
            startDrone1();
        }
        if (drone2Enabled) {
            startDrone2();
        }
        if (drone3Enabled) {
            startDrone3();
        }
    });

    // Stop Button Event Listener
    stopButton.addEventListener('click', () => {
        stopScheduler();
        document.getElementById('status').textContent = 'Stopped';

        // Stop drones if playing
        if (drone1Enabled) {
            stopDrone1();
        }
        if (drone2Enabled) {
            stopDrone2();
        }
        if (drone3Enabled) {
            stopDrone3();
        }
    });

    // Function to Setup Audio Context and Nodes
    function setupAudioContext() {
        // Master Gain Node
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(audioCtx.destination);

        // High-Pass Filter
        highpassFilter = audioCtx.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = parseInt(highpassCutoffSlider.value); // Initialize with slider value

        // Low-Pass Filter
        lowpassFilter = audioCtx.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = parseInt(filterCutoffSlider.value); // Initialize with slider value

        // Connect High-Pass to Low-Pass to Master Gain
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(masterGain);

        // Delay Effect (if enabled)
        delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = parseInt(delayTimeSlider.value) / 1000; // Convert ms to seconds

        // Feedback for Delay
        const feedbackGain = audioCtx.createGain();
        feedbackGain.gain.value = 0.5; // Adjust for more or less feedback

        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        // Connect Delay to Low-Pass Filter if enabled
        if (delayToggle.checked) {
            delayNode.connect(lowpassFilter);
            isDelayConnected = true;
        } else {
            isDelayConnected = false;
        }
    }

    // Function to Schedule the Next Note
    function nextNote() {
        const secondsPerBeat = 60.0 / tempo;
        nextNoteTime += 0.25 * secondsPerBeat; // Move to the next sixteenth note

        // Implement swing by delaying every second eighth note
        if (swingSlider.value > 0 && (currentStep % 2 === 1)) {
            const swingAmount = parseInt(swingSlider.value) / 100;
            nextNoteTime += swingAmount * (secondsPerBeat / 2);
        }

        // Move to the next step and reset after 16 steps
        currentStep++;
        if (currentStep === 16) {
            currentStep = 0;
        }
    }

    // Function to Schedule a Note
    function scheduleNote() {
        // Schedule Bass Drum on step 0
        if (currentStep === 0) {
            playKick(nextNoteTime);
        }

        // Schedule Second Bass Drum on selected beat
        const secondKickStep = (secondKickBeat - 1) * 4; // e.g., beat 2 -> step 4
        if (currentStep === secondKickStep) {
            playKick(nextNoteTime);
        }

        // Schedule Snare Drum on steps 4 and 12
        if (currentStep === 4 || currentStep === 12) {
            playSnare(nextNoteTime);
        }

        // Schedule Hi-Hat based on pattern
        if (hihatPattern === '8th') {
            // 8th notes: every 2 steps (0,2,4,...14)
            if (currentStep % 2 === 0) {
                playHiHat(nextNoteTime);
            }
        } else if (hihatPattern === '4th') {
            // 4th notes on offbeat: steps 1,3,5,...15
            if (currentStep % 4 === 1 || currentStep % 4 === 3) {
                playHiHat(nextNoteTime);
            }
        }

        // Schedule Toms if enabled
        if (tomsEnabled) {
            // Set a probability to play tom on each step
            if (Math.random() < tomChance / 100) {
                playTom(nextNoteTime);
            }
        }

        // Schedule Bass Synth if enabled
        playBass(nextNoteTime);

        // Highlight Beat Indicators
        highlightBeatIndicator(currentStep);
    }

    // Scheduler Function
    function scheduler() {
        while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
            scheduleNote();
            nextNote();
        }
        timerID = setTimeout(scheduler, lookahead);
    }

    // Function to Start the Scheduler
    function startScheduler() {
        if (!isPlaying) {
            isPlaying = true;
            currentStep = 0;
            nextNoteTime = audioCtx.currentTime;
            scheduler();
        }
    }

    // Function to Stop the Scheduler
    function stopScheduler() {
        clearTimeout(timerID);
        isPlaying = false;
    }

    // Function to Play Kick Drum
    function playKick(time) {
        try {
            const params = kickParams[kickSound]; // Retrieve parameters based on selected kick sound

            // Main Oscillator
            const osc1 = audioCtx.createOscillator();
            osc1.type = params.type;
            osc1.frequency.setValueAtTime(params.baseFrequency, time);
            osc1.frequency.exponentialRampToValueAtTime(0.001, time + kickDecay);

            // Detune
            osc1.detune.value = params.detune;

            // Sub-Oscillator
            let oscSub;
            if (params.subFrequency > 0) {
                oscSub = audioCtx.createOscillator();
                oscSub.type = 'sine';
                oscSub.frequency.setValueAtTime(params.subFrequency, time);
                oscSub.frequency.exponentialRampToValueAtTime(0.001, time + kickDecay);
            }

            // Gain Node for Amplitude Envelope
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(params.gain, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + kickDecay);

            // Connect Oscillators to Gain
            osc1.connect(gain);
            if (oscSub) oscSub.connect(gain);

            // Apply Filter if defined
            if (params.filter) {
                const filter = audioCtx.createBiquadFilter();
                filter.type = params.filter.type; // e.g., 'lowpass'
                filter.frequency.setValueAtTime(params.filter.frequency, time);
                gain.connect(filter).connect(masterGain);
            } else {
                // Connect Gain to High-Pass Filter and Master Gain
                gain.connect(highpassFilter).connect(masterGain);
            }

            // Start Oscillators
            osc1.start(time);
            if (oscSub) oscSub.start(time);

            // Stop Oscillators After Decay
            osc1.stop(time + kickDecay);
            if (oscSub) oscSub.stop(time + kickDecay);

            // Cleanup After Stopping
            osc1.onended = () => {
                osc1.disconnect();
                if (oscSub) oscSub.disconnect();
                gain.disconnect();
            };
        } catch {
            // Error handling removed as per request
        }
    }

    // Function to Play Snare Drum Using Noise
    function playSnare(time) {
        try {
            const params = snareParams[snareShape];
            if (!params) {
                return;
            }

            // Create a noise buffer
            const bufferSize = audioCtx.sampleRate;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = params.noiseType === 'white' ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * 0.5; // Simple pink noise approximation
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = false;

            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(params.gain, time);

            // Apply filter based on snare shape
            let snareFilter = audioCtx.createBiquadFilter();
            snareFilter.type = params.filterType;
            snareFilter.frequency.setValueAtTime(params.filterFreq, time);

            // Body Tone (if applicable)
            let bodyOsc;
            let bodyGain;
            if (params.bodyTone) {
                bodyOsc = audioCtx.createOscillator();
                bodyOsc.type = 'triangle';
                bodyOsc.frequency.setValueAtTime(200, time); // Example frequency for body tone

                bodyGain = audioCtx.createGain();
                bodyGain.gain.setValueAtTime(0.3, time);
                bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3); // Decay for body tone

                bodyOsc.connect(bodyGain);
            }

            // Reverb (if applicable)
            let convolver;
            if (params.reverb) {
                convolver = audioCtx.createConvolver();
                convolver.buffer = createReverbBuffer(audioCtx, 1.5, 2.0);

                noiseGain.connect(convolver);
                if (bodyGain) {
                    bodyGain.connect(convolver);
                }
                convolver.connect(masterGain);
            } else {
                if (delayToggle.checked && isDelayConnected) {
                    noiseGain.connect(delayNode);
                } else {
                    noiseGain.connect(masterGain);
                }
                if (bodyGain) {
                    if (delayToggle.checked && isDelayConnected) {
                        bodyGain.connect(delayNode);
                    } else {
                        bodyGain.connect(masterGain);
                    }
                }
            }

            // Connect noise through filter
            noise.connect(snareFilter).connect(noiseGain);

            // Start Noise
            noise.start(time);
            noise.stop(time + 0.2);

            // Start Body Tone
            if (bodyOsc) {
                bodyOsc.start(time);
                bodyOsc.stop(time + 0.3);
            }

            // Cleanup after stopping
            noise.onended = () => {
                noise.disconnect();
                snareFilter.disconnect();
                noiseGain.disconnect();
                if (bodyOsc) {
                    bodyOsc.disconnect();
                    bodyGain.disconnect();
                }
                if (convolver) {
                    convolver.disconnect();
                }
            };
        } catch {
            // Error handling removed as per request
        }
    }

    // Function to Play Hi-Hat Using White Noise
    function playHiHat(time) {
        try {
            // Create a noise buffer
            const bufferSize = audioCtx.sampleRate;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = false;

            // Create a band-pass filter for hi-hat
            const bandpass = audioCtx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(7000, time); // High frequency for hi-hat
            bandpass.Q.value = 1;

            // Create a gain node for amplitude envelope
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // Fast decay

            // Connect noise through band-pass filter and gain
            noise.connect(bandpass)
                 .connect(gain)
                 .connect(masterGain);

            noise.start(time);
            noise.stop(time + 0.05);
        } catch {
            // Error handling removed as per request
        }
    }

    // Function to Play Toms Using Dual Oscillators
    function playTom(time) {
        try {
            if (!tomsEnabled) return; // Ensure toms are enabled

            // Create Gain Node for Tom Volume Control
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.04, time); // Adjust volume as needed

            // Create Oscillators for Tom (Dual Oscillators for Chorus Effect)
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();

            osc1.type = 'square';
            osc2.type = 'triangle';
            osc1.frequency.setValueAtTime(200, time); // Base frequency for tom
            osc2.frequency.setValueAtTime(200 * 1.005, time); // Slight detune for chorus

            // Configure Frequency Envelope
            osc1.frequency.exponentialRampToValueAtTime(0.001, time + 0.5); // 0.5 seconds decay
            osc2.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);

            // Connect Oscillators to Gain
            osc1.connect(gain);
            osc2.connect(gain);

            // Connect Gain to High-Pass Filter and Master Gain
            gain.connect(highpassFilter).connect(masterGain);

            // Start Oscillators
            osc1.start(time);
            osc2.start(time);

            // Stop Oscillators After Decay
            osc1.stop(time + 0.5);
            osc2.stop(time + 0.5);

            // Cleanup After Stopping
            osc1.onended = () => {
                osc1.disconnect();
                osc2.disconnect();
                gain.disconnect();
            };
        } catch {
            // Error handling removed as per request
        }
    }

    // Function to Highlight Current Beat Indicator
    function highlightBeatIndicator(step) {
        // Calculate which beat (1-4) based on step (0-15)
        const beatNumber = Math.floor(step / 4) + 1;
        // Remove 'active' class from all beats
        document.querySelectorAll('.beat').forEach(beat => beat.classList.remove('active'));
        // Add 'active' class to the current beat
        const currentBeat = document.getElementById(`beat${beatNumber}`);
        if (currentBeat) {
            currentBeat.classList.add('active');
        }
    }

    // Drone 1 Functions
    function startDrone1() {
        if (drone1Osc1 || drone1Osc2) return; // Prevent multiple instances

        drone1Osc1 = audioCtx.createOscillator();
        drone1Osc1.type = 'sine';
        drone1Osc1.frequency.setValueAtTime(drone1Frequency, audioCtx.currentTime);

        drone1Osc2 = audioCtx.createOscillator();
        drone1Osc2.type = 'sine';
        drone1Osc2.frequency.setValueAtTime(drone1Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus

        drone1Gain = audioCtx.createGain();
        drone1Gain.gain.value = 0.1; // Subtle volume

        // Connect oscillators to gain
        drone1Osc1.connect(drone1Gain);
        drone1Osc2.connect(drone1Gain);

        // Connect gain to master with subtle chorus effect
        drone1Gain.connect(masterGain);

        // Start oscillators
        drone1Osc1.start();
        drone1Osc2.start();
    }

    function stopDrone1() {
        if (drone1Osc1) {
            drone1Osc1.stop();
            drone1Osc1.disconnect();
            drone1Osc1 = null;
        }
        if (drone1Osc2) {
            drone1Osc2.stop();
            drone1Osc2.disconnect();
            drone1Osc2 = null;
        }
        if (drone1Gain) {
            drone1Gain.disconnect();
            drone1Gain = null;
        }
    }

    // Drone 2 Functions
    function startDrone2() {
        if (drone2Osc1 || drone2Osc2) return; // Prevent multiple instances

        drone2Osc1 = audioCtx.createOscillator();
        drone2Osc1.type = 'sine';
        drone2Osc1.frequency.setValueAtTime(drone2Frequency, audioCtx.currentTime);

        drone2Osc2 = audioCtx.createOscillator();
        drone2Osc2.type = 'sine';
        drone2Osc2.frequency.setValueAtTime(drone2Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus

        drone2Gain = audioCtx.createGain();
        drone2Gain.gain.value = 0.1; // Subtle volume

        // Connect oscillators to gain
        drone2Osc1.connect(drone2Gain);
        drone2Osc2.connect(drone2Gain);

        // Connect gain to master with subtle chorus effect
        drone2Gain.connect(masterGain);

        // Start oscillators
        drone2Osc1.start();
        drone2Osc2.start();
    }

    function stopDrone2() {
        if (drone2Osc1) {
            drone2Osc1.stop();
            drone2Osc1.disconnect();
            drone2Osc1 = null;
        }
        if (drone2Osc2) {
            drone2Osc2.stop();
            drone2Osc2.disconnect();
            drone2Osc2 = null;
        }
        if (drone2Gain) {
            drone2Gain.disconnect();
            drone2Gain = null;
        }
    }

    // Drone 3 Functions
    function startDrone3() {
        if (drone3Osc1 || drone3Osc2) return; // Prevent multiple instances

        drone3Osc1 = audioCtx.createOscillator();
        drone3Osc1.type = 'sine';
        drone3Osc1.frequency.setValueAtTime(drone3Frequency, audioCtx.currentTime);

        drone3Osc2 = audioCtx.createOscillator();
        drone3Osc2.type = 'sine';
        drone3Osc2.frequency.setValueAtTime(drone3Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus

        drone3Gain = audioCtx.createGain();
        drone3Gain.gain.value = 0.1; // Subtle volume

        // Connect oscillators to gain
        drone3Osc1.connect(drone3Gain);
        drone3Osc2.connect(drone3Gain);

        // Connect gain to master with subtle chorus effect
        drone3Gain.connect(masterGain);

        // Start oscillators
        drone3Osc1.start();
        drone3Osc2.start();
    }

    function stopDrone3() {
        if (drone3Osc1) {
            drone3Osc1.stop();
            drone3Osc1.disconnect();
            drone3Osc1 = null;
        }
        if (drone3Osc2) {
            drone3Osc2.stop();
            drone3Osc2.disconnect();
            drone3Osc2 = null;
        }
        if (drone3Gain) {
            drone3Gain.disconnect();
            drone3Gain = null;
        }
    }

    // --- Audio Enhancements ---

    // Register Service Worker (For PWA - Optional)
    // Commented out to prevent errors in non-secure contexts
    /*
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
    */

});