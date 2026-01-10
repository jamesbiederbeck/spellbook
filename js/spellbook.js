// ===========================
// SpellBook Device Controller
// ===========================

import { PiperTTS } from './piper-tts.js';
import { WhisperASR } from './whisper-asr.js';

const DeviceState = Object.freeze({
  POWER_OFF: 'POWER_OFF',
  BOOTING: 'BOOTING',
  IDLE_READY: 'IDLE_READY',
  SAY_MODE: 'SAY_MODE',
  RECORDING: 'RECORDING',
  TRANSCRIBING: 'TRANSCRIBING',
  SPEECH_EVALUATE: 'SPEECH_EVALUATE',
  SPELL_MODE: 'SPELL_MODE',
  SPELL_EVALUATE: 'SPELL_EVALUATE',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  SHUTDOWN: 'SHUTDOWN'
});

let state = DeviceState.POWER_OFF;
let targetWord = '';
let typedWord = '';
let freeTypeBuffer = ''; // For free typing in IDLE_READY
let piperTTS = null;
let whisperASR = null;

const vfd = document.querySelector('.vfd .text');
const recordBtn = document.querySelector('.record-btn');
const sayBtn = document.getElementById('say');
const powerBtn = document.getElementById('power');
const spellBtn = document.getElementById('spell-btn');
const checkBtn = document.querySelector('.big-row .btn.pink'); // "Enter"
const keys = document.querySelectorAll('.keys .btn');
const eraseBtn = document.querySelector('.big-row .btn.gray');
const spaceBtn = document.querySelector('.big-row .btn.blue');

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/* ===========================
   HARDWARE-LIKE FUNCTIONS
=========================== */

function updateVFD(text) {
  vfd.textContent = text.toUpperCase();
}

function playTone(freq = 440, dur = 150) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.start();
  osc.stop(audioCtx.currentTime + dur / 1000);
}

function setState(newState) {
  console.log(`STATE: ${state} → ${newState}`);
  state = newState;
}

/* ===========================
   EVENT HANDLERS
=========================== */

function handlePower() {
  if (state === DeviceState.POWER_OFF) {
    setState(DeviceState.BOOTING);
    updateVFD('SPELLBOOK');
    playTone(660, 200);
    setTimeout(() => {
      setState(DeviceState.IDLE_READY);
      freeTypeBuffer = '';
      updateVFD('');
    }, 800);
  } else {
    setState(DeviceState.SHUTDOWN);
    updateVFD('GOODBYE');
    playTone(330, 300);
    setTimeout(() => {
      setState(DeviceState.POWER_OFF);
      freeTypeBuffer = '';
      targetWord = '';
      typedWord = '';
      updateVFD('');
    }, 700);
  }
}

async function handleSay() {
  // In IDLE_READY: start SAY_MODE with random word
  if (state === DeviceState.IDLE_READY) {
    setState(DeviceState.SAY_MODE);
    const words = ['apple', 'banana', 'cat', 'dog', 'train'];
    targetWord = words[Math.floor(Math.random() * words.length)];
    freeTypeBuffer = ''; // Clear free type buffer
    updateVFD(`SAY: ${targetWord.toUpperCase()}`);
    playTone(440, 120);
    
    await speakWord(targetWord);
    
    setTimeout(() => {
      updateVFD('PRESS SPELL TO TYPE');
      setState(DeviceState.IDLE_READY);
    }, 2000);
    return;
  }
  
  // In SAY_MODE: replay the word
  if (state === DeviceState.SAY_MODE) {
    playTone(440, 120);
    await speakWord(targetWord);
    return;
  }
}

async function speakWord(word) {
  try {
    if (piperTTS) {
      await piperTTS.synthesize(word);
    } else {
      console.warn('Piper TTS not loaded, using fallback');
      // Fallback to basic TTS if available
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(word);
        window.speechSynthesis.speak(utterance);
      }
    }
  } catch (error) {
    console.warn('TTS playback failed:', error);
  }
}

async function handleRecord() {
  if (state === DeviceState.RECORDING) {
    stopRecording();
    return;
  }
  if (state !== DeviceState.IDLE_READY) return;
  setState(DeviceState.RECORDING);
  recordBtn.style.background = '#ff3b3b';
  updateVFD('LISTENING...');
  playTone(880, 100);

  // Use WhisperASR to transcribe from microphone for 2 seconds
  try {
    const transcript = await performTranscription();
    stopRecording(); // Reset button and show "PROCESSING..."
    processTranscriptionResult(transcript);
  } catch (error) {
    console.error('Transcription error:', error);
    recordBtn.style.background = 'radial-gradient(circle at 30% 30%, #ff7676, #d41c1c 70%)';
    updateVFD('ERROR');
    playTone(220, 200);
    setTimeout(() => {
      setState(DeviceState.IDLE_READY);
      updateVFD(freeTypeBuffer);
    }, 1000);
  }
}

function stopRecording() {
  if (state !== DeviceState.RECORDING) return;
  recordBtn.style.background =
    'radial-gradient(circle at 30% 30%, #ff7676, #d41c1c 70%)';
  updateVFD('PROCESSING...');
  setState(DeviceState.TRANSCRIBING);
}

async function performTranscription() {
  if (whisperASR) {
    // Use WhisperASR to transcribe (2000ms = 2 seconds of audio)
    return await whisperASR.transcribe(2000);
  } else {
    console.warn('WhisperASR not loaded, returning empty result');
    return '';
  }
}

function processTranscriptionResult(transcript) {
  setState(DeviceState.SPEECH_EVALUATE);
  const result = transcript.trim() || '(no speech detected)';
  updateVFD(`YOU SAID: ${result.toUpperCase()}`);
  playTone(520, 120);
  setTimeout(() => {
    updateVFD('PRESS SPELL TO TYPE');
    setState(DeviceState.IDLE_READY);
  }, 1500);
}

function handleSpell() {
  // Only allow entering SPELL_MODE if we have a target word from SAY mode
  if (state !== DeviceState.IDLE_READY) return;
  
  if (!targetWord) {
    // No target word set, play error tone
    playTone(220, 150);
    updateVFD('PRESS SAY FIRST');
    setTimeout(() => {
      updateVFD(freeTypeBuffer);
    }, 1200);
    return;
  }
  
  setState(DeviceState.SPELL_MODE);
  typedWord = '';
  updateVFD('TYPE WORD:');
  playTone(480, 100);
}

function handleKeyPress(e) {
  const letter = e.target.textContent.trim();
  if (!letter.match(/^[A-Z]$/)) return;
  
  // In SPELL_MODE: add to typed word buffer
  if (state === DeviceState.SPELL_MODE) {
    typedWord += letter;
    updateVFD(typedWord);
    return;
  }
  
  // In IDLE_READY: free typing mode - speak letter and add to buffer
  if (state === DeviceState.IDLE_READY) {
    freeTypeBuffer += letter;
    updateVFD(freeTypeBuffer);
    speakWord(letter); // Speak the letter aloud
    return;
  }
}

function handleErase() {
  // In SPELL_MODE: delete from typed word
  if (state === DeviceState.SPELL_MODE) {
    typedWord = typedWord.slice(0, -1);
    updateVFD(typedWord || 'TYPE WORD:');
    playTone(300, 40);
    return;
  }
  
  // In IDLE_READY: delete from free type buffer
  if (state === DeviceState.IDLE_READY) {
    freeTypeBuffer = freeTypeBuffer.slice(0, -1);
    updateVFD(freeTypeBuffer);
    playTone(300, 40);
    return;
  }
}

function handleSpace() {
  // In SPELL_MODE: add space to typed word
  if (state === DeviceState.SPELL_MODE) {
    typedWord += ' ';
    updateVFD(typedWord);
    playTone(260, 40);
    return;
  }
  
  // In IDLE_READY: add space to free type buffer
  if (state === DeviceState.IDLE_READY) {
    freeTypeBuffer += ' ';
    updateVFD(freeTypeBuffer);
    playTone(260, 40);
    return;
  }
}

function handleCheck() {
  // In SPELL_MODE: evaluate the spelling
  if (state === DeviceState.SPELL_MODE) {
    setState(DeviceState.SPELL_EVALUATE);
    if (typedWord.trim().toLowerCase() === targetWord.toLowerCase()) {
      updateVFD('CORRECT!');
      playTone(880, 200);
      setState(DeviceState.SUCCESS);
    } else {
      updateVFD('TRY AGAIN');
      playTone(220, 200);
      setState(DeviceState.FAILURE);
    }
    setTimeout(() => {
      typedWord = '';
      targetWord = ''; // Clear target after evaluation
      updateVFD('');
      setState(DeviceState.IDLE_READY);
    }, 1500);
    return;
  }
  
  // In IDLE_READY: speak the typed text
  if (state === DeviceState.IDLE_READY && freeTypeBuffer.trim()) {
    playTone(440, 100);
    speakWord(freeTypeBuffer.trim());
    return;
  }
}

/* ===========================
   KEYBOARD SUPPORT
=========================== */

document.addEventListener('keydown', e => {
  // In SPELL_MODE: handle spelling input
  if (state === DeviceState.SPELL_MODE) {
    if (/^[a-zA-Z]$/.test(e.key)) {
      typedWord += e.key.toUpperCase();
      updateVFD(typedWord);
    } else if (e.key === 'Backspace') {
      handleErase();
    } else if (e.key === ' ') {
      handleSpace();
    } else if (e.key === 'Enter') {
      handleCheck();
    }
    return;
  }
  
  // In IDLE_READY: handle free typing
  if (state === DeviceState.IDLE_READY) {
    if (/^[a-zA-Z]$/.test(e.key)) {
      const letter = e.key.toUpperCase();
      freeTypeBuffer += letter;
      updateVFD(freeTypeBuffer);
      speakWord(letter); // Speak the letter
    } else if (e.key === 'Backspace') {
      handleErase();
    } else if (e.key === ' ') {
      handleSpace();
    } else if (e.key === 'Enter') {
      handleCheck(); // Speak the whole word
    }
    return;
  }
});

/* ===========================
   EVENT BINDINGS
=========================== */

powerBtn.addEventListener('click', handlePower);
sayBtn.addEventListener('click', handleSay);
recordBtn.addEventListener('click', handleRecord);
spellBtn.addEventListener('click', handleSpell);
checkBtn.addEventListener('click', handleCheck);
eraseBtn.addEventListener('click', handleErase);
spaceBtn.addEventListener('click', handleSpace);
keys.forEach(k => k.addEventListener('click', handleKeyPress));

/* ===========================
   INITIALIZE PIPER TTS
=========================== */

async function initializePiperTTS() {
  try {
    console.log('🎵 Loading Piper TTS...');
    piperTTS = await PiperTTS.from_pretrained(
      './models/en_US-sam-medium.onnx',
      './models/en_US-sam-medium.onnx.json'
    );
    console.log('✅ Piper TTS loaded successfully');
  } catch (error) {
    console.warn('⚠️ Failed to load Piper TTS:', error);
    console.log('📱 Falling back to browser TTS');
  }
}

/* ===========================
   INITIALIZE WHISPER ASR
=========================== */

async function initializeWhisperASR() {
  try {
    console.log('🎤 Loading Whisper ASR...');
    whisperASR = await WhisperASR.from_pretrained();
    console.log('✅ Whisper ASR loaded successfully');
  } catch (error) {
    console.warn('⚠️ Failed to load Whisper ASR:', error);
    console.log('📱 Will attempt fallback if needed');
  }
}

/* Initialize */
updateVFD('');
initializePiperTTS();
initializeWhisperASR();
