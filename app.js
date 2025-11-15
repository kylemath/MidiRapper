// Melody definitions - recognizable pop melodies
const melodies = {
    graduation: {
        name: "Graduation (Friends Forever)",
        notes: [60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60]
    },
    rainbow: {
        name: "Somewhere Over the Rainbow",
        notes: [60, 64, 67, 64, 67, 69, 67, 64, 67, 64, 60, 64, 67, 69, 71, 72, 71, 69, 67]
    },
    falling: {
        name: "Can't Help Falling in Love",
        notes: [60, 64, 67, 64, 67, 69, 67, 64, 62, 64, 67, 64, 67, 69, 71, 69, 67]
    },
    yesterday: {
        name: "Yesterday",
        notes: [64, 62, 60, 62, 64, 67, 65, 64, 62, 60, 62, 64, 65, 64, 62, 60]
    },
    hallelujah: {
        name: "Hallelujah",
        notes: [60, 64, 67, 64, 67, 69, 67, 64, 62, 64, 67, 64, 67, 69, 71, 69, 67, 64]
    },
    imagine: {
        name: "Imagine",
        notes: [60, 64, 67, 64, 67, 69, 67, 64, 67, 64, 60, 64, 67, 69, 71, 69, 67, 64]
    }
};

// Global state
let audioContext;
let currentWords = [];
let currentWordIndex = 0; // Sequential word index for rapping
let selectedMelody = 'graduation';
let midiInput = null;

// Initialize Web Audio API
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Speak the word at the MIDI note pitch with longer duration
// Slower rate makes pitch differences much more audible
function synthesizeVoicedWord(word, midiNote) {
    const utterance = new SpeechSynthesisUtterance(word.trim());
    const pitch = midiNoteToPitch(midiNote);
    
    // Much slower rate so you can clearly hear the pitch differences
    // This allows you to play A, B, C and hear the actual musical tones
    utterance.rate = 0.6; // Slow enough to hear pitch clearly
    utterance.pitch = pitch;
    utterance.volume = 1.0;
    
    const voices = speechSynthesis.getVoices();
    const preferredVoices = voices.filter(v => 
        v.lang.includes('en') && (v.name.includes('Samantha') || v.name.includes('Alex') || v.name.includes('Google'))
    );
    
    if (preferredVoices.length > 0) {
        utterance.voice = preferredVoices[0];
    }
    
    speechSynthesis.speak(utterance);
}

// Convert MIDI note number to frequency
function midiNoteToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

// Convert MIDI note to speech pitch with increased sensitivity
// MIDI note 60 (middle C) = pitch 1.0 (normal)
// Using a more aggressive mapping to make pitch differences more noticeable
function midiNoteToPitch(midiNote) {
    // Calculate pitch based on semitones from middle C (60)
    // Use a steeper curve to make differences more noticeable
    const semitonesFromC = midiNote - 60;
    
    // More aggressive pitch mapping: each semitone = 0.1 pitch units
    // This makes adjacent keys much more distinguishable
    const pitch = 1.0 + (semitonesFromC * 0.1);
    
    // Clamp to wider range (0.3 to 2.5) to allow more variation
    return Math.max(0.3, Math.min(2.5, pitch));
}

// Speak a word using Web Speech API with pitch based on MIDI note
function speakWord(word, midiNote) {
    if (!word || word.trim() === '') return;
    
    const utterance = new SpeechSynthesisUtterance(word.trim());
    
    // Calculate pitch from MIDI note
    const pitch = midiNoteToPitch(midiNote);
    
    // Configure voice settings
    utterance.rate = 0.9;
    utterance.pitch = pitch;
    utterance.volume = 1.0;
    
    // Try to use a more natural voice
    const voices = speechSynthesis.getVoices();
    const preferredVoices = voices.filter(v => 
        v.lang.includes('en') && (v.name.includes('Samantha') || v.name.includes('Alex') || v.name.includes('Google'))
    );
    
    if (preferredVoices.length > 0) {
        utterance.voice = preferredVoices[0];
    }
    
    speechSynthesis.speak(utterance);
}

// Process poem text into words
function processPoem(poemText) {
    if (!poemText) return [];
    
    // Split by whitespace and filter out empty strings
    const words = poemText
        .split(/\s+/)
        .map(word => word.replace(/[.,!?;:]/g, '')) // Remove punctuation
        .filter(word => word.length > 0);
    
    return words;
}

// Handle MIDI note - synthesize the word as a voiced sound with fast attack/release
function handleMIDINote(noteNumber) {
    if (currentWords.length === 0) {
        console.log('No poem loaded');
        return;
    }
    
    // Get the next word in sequence (for rapping)
    const word = currentWords[currentWordIndex];
    
    // Synthesize the word as a voiced sound with fast attack/release
    if (word) {
        synthesizeVoicedWord(word, noteNumber, 0.25);
        updateWordDisplay(word, currentWordIndex);
        
        // Advance to next word (cycle back to start if at end)
        currentWordIndex = (currentWordIndex + 1) % currentWords.length;
    }
}

// Update the word display
function updateWordDisplay(word, wordIndex = 0) {
    const display = document.getElementById('current-word-display');
    const wordIndexEl = document.getElementById('word-index');
    const totalWordsEl = document.getElementById('total-words');
    
    if (display) display.textContent = word;
    if (wordIndexEl) wordIndexEl.textContent = wordIndex + 1;
    if (totalWordsEl) totalWordsEl.textContent = currentWords.length;
}

// Connect to MIDI device
async function connectMIDI() {
    try {
        if (!navigator.requestMIDIAccess) {
            alert('Web MIDI API is not supported in your browser. Please use Chrome, Edge, or Opera.');
            return;
        }
        
        const access = await navigator.requestMIDIAccess({ sysex: false });
        const inputs = access.inputs.values();
        
        if (inputs.next().done) {
            alert('No MIDI devices found. Please connect your MIDI keyboard and try again.');
            return;
        }
        
        // Reset inputs iterator
        const inputArray = Array.from(access.inputs.values());
        
        if (inputArray.length === 1) {
            midiInput = inputArray[0];
            setupMIDIInput(midiInput);
        } else if (inputArray.length > 1) {
            // Let user choose if multiple devices
            const deviceNames = inputArray.map((input, index) => `${index + 1}. ${input.name}`);
            const choice = prompt(`Multiple MIDI devices found:\n${deviceNames.join('\n')}\n\nEnter device number (1-${inputArray.length}):`);
            const deviceIndex = parseInt(choice) - 1;
            
            if (deviceIndex >= 0 && deviceIndex < inputArray.length) {
                midiInput = inputArray[deviceIndex];
                setupMIDIInput(midiInput);
            }
        }
        
        // Listen for new devices
        access.onstatechange = (e) => {
            if (e.port.state === 'connected' && e.port.type === 'input') {
                if (!midiInput) {
                    midiInput = e.port;
                    setupMIDIInput(midiInput);
                }
            } else if (e.port.state === 'disconnected' && e.port === midiInput) {
                midiInput = null;
                updateMIDIStatus(false);
            }
        };
        
    } catch (error) {
        console.error('Error accessing MIDI:', error);
        alert('Error connecting to MIDI device: ' + error.message);
    }
}

// Setup MIDI input handler
function setupMIDIInput(input) {
    input.onmidimessage = (message) => {
        const [status, note, velocity] = message.data;
        
        // Note on (144 = 0x90)
        if (status === 144 && velocity > 0) {
            handleMIDINote(note);
        }
    };
    
    updateMIDIStatus(true, input.name);
}

// Update MIDI connection status
function updateMIDIStatus(connected, deviceName = '') {
    const statusEl = document.getElementById('midi-status');
    const statusText = statusEl.querySelector('span:last-child');
    
    if (connected) {
        statusEl.classList.add('connected');
        statusText.textContent = `Connected: ${deviceName}`;
    } else {
        statusEl.classList.remove('connected');
        statusText.textContent = 'No MIDI device connected';
    }
}

// Initialize the application
function init() {
    // Initialize audio
    initAudio();
    
    // Load voices for speech synthesis
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            // Voices loaded
        };
    }
    
    // Poem input handler
    const poemInput = document.getElementById('poem-input');
    poemInput.addEventListener('input', (e) => {
        currentWords = processPoem(e.target.value);
        currentWordIndex = 0; // Reset to start of poem
        updateWordDisplay('—', 0);
    });
    
    // MIDI connect button
    const connectBtn = document.getElementById('connect-midi');
    connectBtn.addEventListener('click', connectMIDI);
    
    // Resume audio context on user interaction (required by browsers)
    document.addEventListener('click', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });
    
    // Initialize word count display
    updateWordDisplay('—');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

