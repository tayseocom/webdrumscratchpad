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
    let isDelayConnected = true;
    let isLowpassConnected = true;
    let isHighpassConnected = true;
    let isTomsConnected = false;

    // Ducking Parameters
    let duckingIntensity = 0.5; // 50% by default
    let duckingDuration = 200; // 200 ms by default

    // Global tempo variable initialized to default value
    let tempo = 120;

    // Check for necessary DOM elements and buttons
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');

    if (!startButton || !stopButton) {
        console.error('Start or Stop buttons not found in the DOM');
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

    // Ducking Controls
    const duckingIntensitySlider = document.getElementById('ducking-intensity');
    const duckingIntensityValue = document.getElementById('ducking-intensity-value');
    const duckingDurationSlider = document.getElementById('ducking-duration');
    const duckingDurationValue = document.getElementById('ducking-duration-value');

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
        !duckingIntensitySlider || !duckingIntensityValue ||
        !duckingDurationSlider || !duckingDurationValue) {
        console.error('One or more DOM elements are missing. Please check the element IDs in the HTML and JavaScript.');
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
    let snareShape = snareShapeSelect.value; // 'standard' or 'clap'

    // Initialize Kick Sound Selection (default to 'standard')
    let kickSound = kickSoundSelect.value; // 'standard', 'deep', 'short', 'reverse', 'filtered'

    // Initialize Toms Toggle
    let tomsEnabled = tomsToggle.checked;

    // Initialize Drones
    let drone1Enabled = drone1Toggle.checked;
    let drone1Frequency = parseInt(drone1FrequencySlider.value);
    drone1FrequencyValue.textContent = drone1Frequency;

    let drone2Enabled = drone2Toggle.checked;
    let drone2Frequency = parseInt(drone2FrequencySlider.value);
    drone2FrequencyValue.textContent = drone2Frequency;

    // Initialize Ducking Parameters
    duckingIntensity = parseInt(duckingIntensitySlider.value) / 100; // Convert to 0-1
    duckingIntensityValue.textContent = parseInt(duckingIntensitySlider.value);
    duckingDuration = parseInt(duckingDurationSlider.value);
    duckingDurationValue.textContent = duckingDuration;

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
        console.log('Kick Sound Selected:', kickSound);
    });

    snareShapeSelect.addEventListener('change', (e) => {
        snareShape = e.target.value;
        console.log('Snare Shape Selected:', snareShape);
    });

    kickDecaySlider.addEventListener('input', (e) => {
        kickDecay = parseFloat(e.target.value);
        kickDecayValue.textContent = kickDecay;
    });

    tomsToggle.addEventListener('change', (e) => {
        tomsEnabled = tomsToggle.checked;
        console.log('Toms Enabled:', tomsEnabled);
    });

    hihatPatternSelect.addEventListener('change', (e) => {
        hihatPattern = e.target.value;
        console.log('Hi-Hat Pattern Selected:', hihatPattern);
    });

    // Drones Controls Event Listeners
    drone1Toggle.addEventListener('change', (e) => {
        drone1Enabled = drone1Toggle.checked;
        if (drone1Enabled) {
            startDrone1();
        } else {
            stopDrone1();
        }
    });

    drone1FrequencySlider.addEventListener('input', (e) => {
        drone1Frequency = parseInt(e.target.value);
        drone1FrequencyValue.textContent = drone1Frequency;
        if (drone1Osc1) {
            drone1Osc1.frequency.setValueAtTime(drone1Frequency, audioCtx.currentTime);
        }
        if (drone1Osc2) {
            drone1Osc2.frequency.setValueAtTime(drone1Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus
        }
    });

    drone2Toggle.addEventListener('change', (e) => {
        drone2Enabled = drone2Toggle.checked;
        if (drone2Enabled) {
            startDrone2();
        } else {
            stopDrone2();
        }
    });

    drone2FrequencySlider.addEventListener('input', (e) => {
        drone2Frequency = parseInt(e.target.value);
        drone2FrequencyValue.textContent = drone2Frequency;
        if (drone2Osc1) {
            drone2Osc1.frequency.setValueAtTime(drone2Frequency, audioCtx.currentTime);
        }
        if (drone2Osc2) {
            drone2Osc2.frequency.setValueAtTime(drone2Frequency * 1.005, audioCtx.currentTime); // Slight detune for chorus
        }
    });

    // Ducking Controls Event Listeners
    duckingIntensitySlider.addEventListener('input', (e) => {
        duckingIntensity = parseInt(e.target.value) / 100; // Convert to 0-1
        duckingIntensityValue.textContent = parseInt(e.target.value);
    });

    duckingDurationSlider.addEventListener('input', (e) => {
        duckingDuration = parseInt(e.target.value);
        duckingDurationValue.textContent = duckingDuration;
    });

    // Audio Nodes
    let delayNode;
    let lowpassFilter;
    let highpassFilter;
    let tomsEnabledFlag = false;
    let tomChance = 0.25; // 25% chance to play tom on a step

    // Drone Nodes
    let drone1Osc1, drone1Osc2, drone1Gain;
    let drone2Osc1, drone2Osc2, drone2Gain;

    // Ducking Gain Nodes for Drones
    let drone1GainNode, drone2GainNode;

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
    });

    // Stop Button Event Listener
    stopButton.addEventListener('click', () => {
        stopScheduler();
        document.getElementById('status').textContent = 'Stopped';
    });

    // Function to Setup Audio Context and Nodes
    function setupAudioContext() {
        // Master Gain Node
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(audioCtx.destination);

        // Low-Pass Filter
        lowpassFilter = audioCtx.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = parseInt(filterCutoffSlider.value); // Initialize with slider value
        if (lowpassToggle.checked && parseInt(filterCutoffSlider.value) > 0) {
            lowpassFilter.connect(masterGain);
            isLowpassConnected = true;
        } else {
            isLowpassConnected = false;
        }

        // High-Pass Filter
        highpassFilter = audioCtx.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = parseInt(highpassCutoffSlider.value); // Initialize with slider value
        if (highpassToggle.checked && parseInt(highpassCutoffSlider.value) > 0) {
            highpassFilter.connect(lowpassFilter);
            isHighpassConnected = true;
        } else {
            isHighpassConnected = false;
        }

        // Delay Effect (applied only to snare)
        delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = parseInt(delayTimeSlider.value) / 1000; // Convert ms to seconds

        // Feedback for Delay (self-oscillating)
        const feedbackGain = audioCtx.createGain();
        feedbackGain.gain.value = 0.5; // Adjust for more or less feedback

        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        if (delayToggle.checked) {
            delayNode.connect(lowpassFilter);
            isDelayConnected = true;
        } else {
            isDelayConnected = false;
        }

        // Initialize tomsEnabledFlag
        tomsEnabledFlag = tomsEnabled;
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
        if (tomsEnabledFlag) {
            // Set a probability to play tom on each step
            if (Math.random() < tomChance) {
                playTom(nextNoteTime);
            }
        }

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

    // Function to Play Kick Drum Based on Selected Sound
    function playKick(time) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine'; // Base waveform

        // Define kick sound parameters based on selection
        switch (kickSound) {
            case 'standard':
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.001, time + kickDecay);
                break;
            case 'deep':
                osc.frequency.setValueAtTime(100, time);
                osc.frequency.exponentialRampToValueAtTime(0.001, time + kickDecay);
                break;
            case 'short':
                osc.frequency.setValueAtTime(200, time);
                osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.3); // Shorter decay
                break;
            case 'reverse':
                osc.frequency.setValueAtTime(0.001, time);
                osc.frequency.setValueAtTime(150, time + kickDecay);
                break;
            case 'filtered':
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.001, time + kickDecay);
                break;
            default:
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.001, time + kickDecay);
        }

        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + kickDecay);

        // If 'filtered' kick, apply a low-pass filter
        if (kickSound === 'filtered') {
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, time);
            osc.connect(filter).connect(gain).connect(highpassFilter).connect(masterGain);
        } else {
            osc.connect(gain).connect(highpassFilter).connect(masterGain);
        }

        osc.start(time);
        osc.stop(time + kickDecay);

        // Implement Ducking
        applyDucking(time);
    }

    // Function to Apply Ducking to Drones
    function applyDucking(time) {
        if (!audioCtx) return;

        if (drone1GainNode) {
            drone1GainNode.gain.cancelScheduledValues(time);
            drone1GainNode.gain.setValueAtTime(drone1GainNode.gain.value, time);
            drone1GainNode.gain.linearRampToValueAtTime(drone1GainNode.gain.value * (1 - duckingIntensity), time + duckingDuration / 1000);
            drone1GainNode.gain.linearRampToValueAtTime(drone1GainNode.gain.value, time + (duckingDuration + 50) / 1000); // Return to normal after ducking
        }

        if (drone2GainNode) {
            drone2GainNode.gain.cancelScheduledValues(time);
            drone2GainNode.gain.setValueAtTime(drone2GainNode.gain.value, time);
            drone2GainNode.gain.linearRampToValueAtTime(drone2GainNode.gain.value * (1 - duckingIntensity), time + duckingDuration / 1000);
            drone2GainNode.gain.linearRampToValueAtTime(drone2GainNode.gain.value, time + (duckingDuration + 50) / 1000); // Return to normal after ducking
        }
    }

    // Function to Play Snare Drum Using Noise
    function playSnare(time) {
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

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, time);

        // Apply filter based on snare shape
        let snareFilter = audioCtx.createBiquadFilter();
        if (snareShape === 'clap') {
            snareFilter.type = 'bandpass';
            snareFilter.frequency.setValueAtTime(1000, time);
            snareFilter.Q.value = 1;
        } else {
            snareFilter.type = 'highpass';
            snareFilter.frequency.setValueAtTime(1000, time);
        }

        // Connect nodes with delay
        noise.connect(snareFilter)
             .connect(noiseGain);

        if (delayToggle.checked && isDelayConnected) {
            noiseGain.connect(delayNode);
        } else {
            noiseGain.connect(masterGain);
        }

        noise.start(time);
        noise.stop(time + 0.2);
    }

    // Function to Play Hi-Hat Using White Noise
    function playHiHat(time) {
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
    }

    // Function to Play Toms Using an Oscillator
    function playTom(time) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.3); // Short decay

        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

        osc.connect(gain).connect(highpassFilter).connect(masterGain);

        osc.start(time);
        osc.stop(time + 0.3);
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

        drone1GainNode = audioCtx.createGain();
        drone1GainNode.gain.value = 0.1; // Subtle volume

        // Connect oscillators to gain node
        drone1Osc1.connect(drone1GainNode);
        drone1Osc2.connect(drone1GainNode);

        // Connect gain node to master
        drone1GainNode.connect(masterGain);

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
        if (drone1GainNode) {
            drone1GainNode.disconnect();
            drone1GainNode = null;
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

        drone2GainNode = audioCtx.createGain();
        drone2GainNode.gain.value = 0.1; // Subtle volume

        // Connect oscillators to gain node
        drone2Osc1.connect(drone2GainNode);
        drone2Osc2.connect(drone2GainNode);

        // Connect gain node to master
        drone2GainNode.connect(masterGain);

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
        if (drone2GainNode) {
            drone2GainNode.disconnect();
            drone2GainNode = null;
        }
    }

    // Function to Create a Simple Reverb Buffer (Optional Enhancement)
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

    // Initialize Drone Toggles
    if (drone1Enabled) {
        startDrone1();
    }
    if (drone2Enabled) {
        startDrone2();
    }

    // Function to Setup Ducking Gain Nodes
    function setupDucking() {
        // Create separate gain nodes for drones to control their volumes independently
        if (drone1GainNode) {
            // Already connected directly to master
            // No additional setup needed
        }

        if (drone2GainNode) {
            // Already connected directly to master
            // No additional setup needed
        }
    }

    // Call setupDucking after setting up audio context
    setupDucking();

});