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

const WORDS = ['apple', 'banana', 'cat', 'dog', 'train'];

let state = DeviceState.POWER_OFF;
let targetWord = ''; // word the device picked, for SPELL_MODE quiz
let lastWord = '';
let typedWord = ''; // user's spelling attempt in SPELL_MODE quiz
let sayBuffer = ''; // word the user is composing in SAY_MODE
let lastSpokenWord = ''; // for Replay/Repeat
let piperTTS = null;
let whisperASR = null;

const vfd = document.querySelector('.vfd .text');
const recordBtn = document.querySelector('.record-btn');
const sayBtn = document.getElementById('say');
const powerBtn = document.getElementById('power');
const spellBtn = document.getElementById('spell-btn');
const checkBtn = document.querySelector('.big-row .btn.pink'); // "Enter"
const replayBtn = document.getElementById('replay');
const repeatBtn = document.getElementById('repeat');
const keys = document.querySelectorAll('.keys .btn');
const eraseBtn = document.querySelector('.big-row .btn.gray');
const spaceBtn = document.querySelector('.big-row .btn.blue');
const fullscreenBtn = document.getElementById('fullscreen-btn');

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
      updateVFD('');
    }, 800);
  } else {
    setState(DeviceState.SHUTDOWN);
    updateVFD('GOODBYE');
    playTone(330, 300);
    setTimeout(() => {
      setState(DeviceState.POWER_OFF);
      sayBuffer = '';
      lastSpokenWord = '';
      targetWord = '';
      typedWord = '';
      updateVFD('');
    }, 700);
  }
}

function handleSay() {
  // From IDLE_READY, or re-pressed within SAY_MODE: (re)enter "Say It" mode
  // and start composing a fresh word. Speech only happens on Enter/GO.
  if (state === DeviceState.IDLE_READY || state === DeviceState.SAY_MODE) {
    setState(DeviceState.SAY_MODE);
    sayBuffer = '';
    updateVFD('TYPE A WORD');
    playTone(440, 120);
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

  try {
    const transcript = await performTranscription();
    stopRecording();
    processTranscriptionResult(transcript);
  } catch (error) {
    console.error('Transcription error:', error);
    recordBtn.style.background = 'radial-gradient(circle at 30% 30%, #ff7676, #d41c1c 70%)';
    updateVFD('ERROR');
    playTone(220, 200);
    setTimeout(() => {
      setState(DeviceState.IDLE_READY);
      updateVFD('');
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

async function handleSpell() {
  // "Spell It" mode: device picks a word, speaks it, then the user spells it back
  if (state !== DeviceState.IDLE_READY) return;

  setState(DeviceState.SPELL_MODE);
  const choices = WORDS.length > 1 ? WORDS.filter(w => w !== lastWord) : WORDS;
  targetWord = choices[Math.floor(Math.random() * choices.length)];
  lastWord = targetWord;
  typedWord = '';
  updateVFD('TYPE WORD:');
  playTone(480, 100);

  await speakWord(targetWord);
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

  // In SAY_MODE: compose the word to be spoken (silently, until Enter/GO)
  if (state === DeviceState.SAY_MODE) {
    sayBuffer += letter;
    updateVFD(sayBuffer);
    playTone(400, 40);
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

  // In SAY_MODE: delete from the word being composed
  if (state === DeviceState.SAY_MODE) {
    sayBuffer = sayBuffer.slice(0, -1);
    updateVFD(sayBuffer || 'TYPE A WORD');
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

  // In SAY_MODE: add space to the word being composed
  if (state === DeviceState.SAY_MODE) {
    sayBuffer += ' ';
    updateVFD(sayBuffer);
    playTone(260, 40);
    return;
  }
}

async function handleCheck() {
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

  // In SAY_MODE: Enter/GO speaks the composed word
  if (state === DeviceState.SAY_MODE && sayBuffer.trim()) {
    playTone(440, 100);
    lastSpokenWord = sayBuffer.trim();
    await speakWord(lastSpokenWord);
    return;
  }
}

function handleReplay() {
  // Say what was last spoken, in whichever mode makes sense
  if (state === DeviceState.SAY_MODE && lastSpokenWord) {
    playTone(440, 120);
    speakWord(lastSpokenWord);
    return;
  }
  if (state === DeviceState.SPELL_MODE && targetWord) {
    playTone(440, 120);
    speakWord(targetWord);
    return;
  }
  if (state === DeviceState.IDLE_READY && lastSpokenWord) {
    playTone(440, 120);
    speakWord(lastSpokenWord);
    return;
  }
}

function handleRepeat() {
  // Alias to Replay for the word-audio case
  handleReplay();
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

  // In SAY_MODE: handle word composition, speak on Enter/GO
  if (state === DeviceState.SAY_MODE) {
    if (/^[a-zA-Z]$/.test(e.key)) {
      sayBuffer += e.key.toUpperCase();
      updateVFD(sayBuffer);
      playTone(400, 40);
    } else if (e.key === 'Backspace') {
      handleErase();
    } else if (e.key === ' ') {
      handleSpace();
    } else if (e.key === 'Enter') {
      handleCheck();
    }
    return;
  }
});

/* ===========================
   FULLSCREEN SUPPORT
=========================== */

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Fullscreen request failed:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

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
if (replayBtn) {
  replayBtn.addEventListener('click', handleReplay);
}
if (repeatBtn) {
  repeatBtn.addEventListener('click', handleRepeat);
}
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

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
