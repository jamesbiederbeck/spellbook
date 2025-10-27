// Lightweight Whisper ASR integration shim for the Spellbook app
// - Provides a compatible WhisperASR.from_pretrained(...) factory used by js/spellbook.js
// - Attempts to load an ONNX runtime if available, otherwise falls back to the browser Web Speech API
// - Exposes a simple transcribe(audioBlobOrDuration) method that returns a transcript string

export class WhisperASR {
  constructor(options = {}) {
    this._useOnnx = !!options.useOnnx;
    this._modelPath = options.modelPath || null;
    this._ready = true;
    this._backend = this._useOnnx ? 'onnx' : 'webspeech';
    console.log(`[WhisperASR] initialized - backend=${this._backend}`);
  }

  // Factory to mirror the API used in spellbook.js
  // modelPath, vocabPath, featurePath are accepted but optional. This shim will try to
  // load onnxruntime-web dynamically if available and fall back to browser SpeechRecognition.
  static async from_pretrained(modelPath = '', vocabPath = '', featurePath = '') {
    // Try to dynamically load onnxruntime-web (ORT) from a CDN. If that fails, fall back.
    try {
      if (typeof ort === 'undefined') {
        // Try importing ORT from jsdelivr. If the host blocks dynamic import of remote files,
        // this will fail and we'll fall back to Web Speech API.
        await import('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');
      }

      // If ort is present, we create an instance that indicates ONNX backend would be used.
      // Full model execution is out of scope for this shim; the original project can replace
      // this with a richer implementation that runs the Whisper ONNX model in the browser.
      return new WhisperASR({ useOnnx: true, modelPath });
    } catch (err) {
      console.warn('[WhisperASR] ONNX runtime not available or failed to load, falling back to Web Speech API.', err);
      // Fallback: use browser's Web Speech API if available
      return new WhisperASR({ useOnnx: false, modelPath });
    }
  }

  // A convenience method to transcribe from the microphone for a fixed duration (ms)
  // If the instance was created with ONNX support, this method still falls back to Web Speech API
  // in this shim. A real ONNX-powered implementation would accept audio buffers and run the model.
  async transcribeFromMicrophone(durationMs = 2000, lang = 'en-US') {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      console.warn('[WhisperASR] No Web Speech API available in this browser. Returning empty transcript.');
      return '';
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return new Promise((resolve, reject) => {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        try {
          const transcript = event.results[0][0].transcript || '';
          resolve(transcript);
        } catch (e) {
          resolve('');
        }
      };

      recognition.onerror = (event) => {
        console.warn('[WhisperASR] SpeechRecognition error', event);
        // Resolve with empty string instead of rejecting to keep UI flow simple
        resolve('');
      };

      recognition.onend = () => {
        // If no result fired, return empty string
        resolve('');
      };

      try {
        recognition.start();
      } catch (e) {
        console.warn('[WhisperASR] Failed to start SpeechRecognition:', e);
        resolve('');
        return;
      }

      // Stop after the requested duration
      setTimeout(() => {
        try {
          recognition.stop();
        } catch (_) {
          // ignore
        }
      }, durationMs);
    });
  }

  // Generic transcribe method that accepts either an audio Blob/ArrayBuffer or a number
  // If passed a number, it records from the mic for that many milliseconds. If passed
  // a Blob/ArrayBuffer, this shim does not process it and returns an empty string (placeholder).
  async transcribe(input, options = {}) {
    // If input is a number -> treat as microphone duration
    if (typeof input === 'number') {
      return this.transcribeFromMicrophone(input, options.lang || 'en-US');
    }

    // If input is falsy -> default to short mic capture
    if (!input) {
      return this.transcribeFromMicrophone(2000, options.lang || 'en-US');
    }

    // If the user passed an audio Blob/Buffer, a full ONNX implementation would decode
    // and run the model. This shim can't do that, so we fall back to returning an empty string.
    console.warn('[WhisperASR] transcribe(audioBlob) called but this lightweight shim does not support offline blob transcription.');
    return '';
  }
}