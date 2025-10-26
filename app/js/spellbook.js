// ===========================
// SpellBook Device Controller
// ===========================

// Finite State Machine — hardware behavior simulation
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
const vfd = document.querySelector('.vfd .text');
const recordBtn = document.querySelector('.record-btn');
const sayBtn = document.querySelector('.btn.blue:nth-child(5)'); // "Say" button
const powerBtn = document.querySelector('.btn.gray'); // first gray = Power
const checkBtn = document.querySelector('.btn.pink:last-child'); // "Enter" = Check
const keys = document.querySelectorAll('.keys .btn');
let targetWord = '';
let typedWord = '';

/* ===========================
   HARDWARE-LIKE FUNCTIONS
=========================== */

function updateVFD(text) {
  // Simulate instant-on phosphor refresh (not animation)
  vfd.textContent = text.toUpperCase();
}

function playTone(freq = 440, dur = 150) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'square';
  osc.start();
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  osc.stop(ctx.currentTime + dur / 1000);
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
      updateVFD('PRESS SAY OR SPELL');
    }, 800);
  } else {
    setState(DeviceState.SHUTDOWN);
    updateVFD('GOODBYE');
    playTone(330, 300);
    setTimeout(() => {
      setState(DeviceState.POWER_OFF);
      updateVFD('');
    }, 700);
  }
}

async function handleSay() {
  if (state !== DeviceState.IDLE_READY) return;
  setState(DeviceState.SAY_MODE);
  // choose a random target word for demo
  const words = ['apple', 'banana', 'cat', 'dog', 'train'];
  targetWord = words[Math.floor(Math.random() * words.length)];
  updateVFD(`SAY ${targetWord.toUpperCase()}`);
  playTone(440, 120);
  // Simulate Piper TTS playback
  try {
    const audio = new Audio(`/api/speak?text=${encodeURIComponent(targetWord)}`);
    audio.play();
  } catch {
    console.warn('TTS playback not connected');
  }
  setTimeout(() => {
    updateVFD('PRESS RECORD');
    setState(DeviceState.IDLE_READY);
  }, 2000);
}

function handleRecord() {
  if (state === DeviceState.RECORDING) {
    stopRecording();
    return;
  }
  if (state !== DeviceState.IDLE_READY) return;
  setState(DeviceState.RECORDING);
  recordBtn.style.background = '#ff3b3b';
  updateVFD('LISTENING...');
  playTone(880, 100);

  // Placeholder for real STT integration
  // Simulate recorded input and transcription
  setTimeout(() => {
    stopRecording();
    simulateTranscription();
  }, 2000);
}

function stopRecording() {
  if (state !== DeviceState.RECORDING) return;
  recordBtn.style.background = 'radial-gradient(circle at 30% 30%, #ff7676, #d41c1c 70%)';
  updateVFD('PROCESSING...');
  setState(DeviceState.TRANSCRIBING);
}

function simulateTranscription() {
  const fakeResult = targetWord; // assume perfect recognition
  setState(DeviceState.SPEECH_EVALUATE);
  updateVFD(`YOU SAID: ${fakeResult.toUpperCase()}`);
  playTone(520, 120);
  setTimeout(() => {
    updateVFD('PRESS SPELL TO TYPE');
    setState(DeviceState.IDLE_READY);
  }, 1500);
}

function handleKeyPress(e) {
  if (state !== DeviceState.SPELL_MODE) return;
  const letter = e.target.textContent.trim();
  if (!letter) return;
  typedWord += letter;
  updateVFD(typedWord);
  playTone(400, 40);
}

function handleCheck() {
  if (state !== DeviceState.SPELL_MODE) return;
  setState(DeviceState.SPELL_EVALUATE);
  if (typedWord.toLowerCase() === targetWord.toLowerCase()) {
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
    updateVFD('PRESS SAY OR SPELL');
    setState(DeviceState.IDLE_READY);
  }, 1500);
}

/* ===========================
   EVENT BINDINGS
=========================== */

powerBtn.addEventListener('click', handlePower);
sayBtn.addEventListener('click', handleSay);
recordBtn.addEventListener('click', handleRecord);
checkBtn.addEventListener('click', handleCheck);
keys.forEach(k => k.addEventListener('click', handleKeyPress));

/* Initialize */
updateVFD('');
