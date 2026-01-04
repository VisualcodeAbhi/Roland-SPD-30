// Roland SPD-30 Web Connectivity & Sound Engine

// Initialize AudioContext
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const sounds = {}; // Store loaded buffers: { noteNumber: buffer }

// USER CONFIGURATION: Map Pads to Sound Files
// Put your audio files in the "sounds" folder.
// Filenames must match exactly!
// USER CONFIGURATION: Map Pads to Sound Files
// Put your audio files in the "sounds" folder.
// Filenames must match exactly!
const soundFiles = {
    'pad-1': 'sounds/Tabala&dholak/Vrb_Clp1.wav', // Folder is named 'Tabala&dholak'
    'pad-2': 'sounds/Tabala&dholak/Chap_1.wav',
    'pad-3': 'sounds/Tabala&dholak/mixed_Duff.wav',
    'pad-4': 'sounds/Tabala&dholak/Inst _dagga .wav', // Note the spaces in this filename
    'pad-5': 'sounds/Tabala&dholak/dolak_080.wav',
    'pad-6': 'sounds/Tabala&dholak/Real_dolak.wav',
    'pad-7': '', // File 'Inst_2dagga.wav' not found in folder
    'pad-8': ''  // File 'Inst_3dagga.wav' not found in folder
};

const padMapping = {
    // Standard MIDI notes for SPD-30 pads.
    // Update these MIDI numbers if your customization uses different ones.
    // Mapping format: MIDI_NOTE: PAD_ID
    36: 'pad-1', 
    38: 'pad-2', 
    40: 'pad-3', 
    41: 'pad-4', 
    43: 'pad-5', 
    45: 'pad-6', 
    47: 'pad-7', 
    48: 'pad-8'  
};

// Check for Web MIDI API support
if (navigator.requestMIDIAccess) {
    console.log('Web MIDI API supported.');
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
    console.warn('Web MIDI API not supported in this browser.');
    alert('Web MIDI is not supported in this browser. Please use Chrome or Edge.');
}

function onMIDISuccess(midiAccess) {
    const inputs = midiAccess.inputs;
    const bulb = document.getElementById('midi-bulb');
    
    // Initial check
    if (inputs.size > 0) {
        console.log('MIDI inputs found.');
        bulb.classList.add('connected');
    } else {
        console.log('No MIDI inputs found.');
        bulb.classList.remove('connected');
    }

    // Listen to all inputs
    for (let input of inputs.values()) {
        input.onmidimessage = getMIDIMessage;
    }

    // Handle connection changes
    midiAccess.onstatechange = (e) => {
        console.log('Connection status changed:', e.port.state);
        if (e.port.state === 'connected' && e.port.type === 'input') {
             bulb.classList.add('connected');
        } else if (e.port.state === 'disconnected' && e.port.type === 'input') {
             // Only turn off if no other inputs are present (simple check: if inputs.size is 0, but inputs map updates async)
             // For simplicity, we just check the event state.
             // Ideally we re-scan inputs, but this is usually sufficient for single device use.
             if (midiAccess.inputs.size === 0) {
                bulb.classList.remove('connected');
             }
        }
    };
}

function onMIDIFailure() {
    console.error('Could not access your MIDI devices.');
    alert('Failed to access MIDI devices.');
}

function getMIDIMessage(message) {
    const command = message.data[0];
    const note = message.data[1];
    const velocity = message.data[2];

    // Log for debugging/calibration
    // console.log(`Command: ${command}, Note: ${note}, Velocity: ${velocity}`);

    // Note On (usually 144 on channel 1, but we check range 144-159 for any channel)
    // Also some devices send Note On with 0 velocity as Note Off
    if (command >= 144 && command <= 159 && velocity > 0) {
        handleNoteOn(note, velocity);
    }
}

function handleNoteOn(note, velocity) {
    // Visual Feedback
    if (padMapping[note]) {
        const padId = padMapping[note];
        triggerPadVisual(padId);
    } else {
        console.log(`Unmapped Note received: ${note}`);
        // Optional: Flash a generic indicator or auto-map mode
    }

    // Audio Playback
    playSound(note, velocity);
}

function triggerPadVisual(padId) {
    const pad = document.getElementById(padId);
    if (pad) {
        pad.classList.add('active');
        // Remove class after animation
        setTimeout(() => {
            pad.classList.remove('active');
        }, 100);
    }
}

function playSound(note, velocity) {
    if (sounds[note]) {
        const source = audioCtx.createBufferSource();
        source.buffer = sounds[note];
        
        // Velocity volume mapping
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = velocity / 127; 
        
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
    } else {
        // console.log('No sound loaded for note:', note);
    }
}

// Function to load sounds (Call this when we have file paths)
async function loadSound(note, url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        sounds[note] = audioBuffer;
        console.log(`Loaded sound for note ${note}: ${url}`);
    } catch (e) {
        console.error(`Error loading sound ${url}:`, e);
    }
}

// Function to initialize all sounds from the config
function initSounds() {
    // Reverse map entries to find note for pad (simple lookup)
    const padToNote = {};
    for (const [note, padId] of Object.entries(padMapping)) {
        padToNote[padId] = parseInt(note);
    }

    for (const [padId, filename] of Object.entries(soundFiles)) {
        const note = padToNote[padId];
        if (note) {
            loadSound(note, filename);
        } else {
            console.warn(`Pad ${padId} is not mapped to a MIDI note.`);
        }
    }
}

// Initialize user interaction for AudioContext (required by browsers)
document.body.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });

// Enable Touch/Click on Screen Pads
function enableTouchPads() {
    // Need a reverse lookup to find note from pad ID
    const padToNote = {};
    for (const [note, padId] of Object.entries(padMapping)) {
        padToNote[padId] = parseInt(note);
    }

    const pads = document.querySelectorAll('.pad');
    pads.forEach(pad => {
        pad.addEventListener('mousedown', () => triggerPad(pad.id));
        pad.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling/zooming while drumming
            triggerPad(pad.id);
        });
    });

    function triggerPad(padId) {
        const note = padToNote[padId];
        if (note) {
            handleNoteOn(note, 127); // Simulate full velocity hit
        }
    }
}

// Load sounds and enable pads on start
initSounds();
enableTouchPads();
