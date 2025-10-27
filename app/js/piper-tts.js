// piper-tts.js
// SPA-compatible Piper TTS engine using ONNX Runtime Web

import { cachedFetch } from './model-cache.js'; // optional caching helper

export class PiperTTS {
  constructor(voiceConfig = null, session = null) {
    this.voiceConfig = voiceConfig;
    this.session = session;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  static async from_pretrained(modelPath, configPath) {
    try {
      const ort = await import('onnxruntime-web');

      // Fetch model + config (use cache if available)
      const [modelResponse, configResponse] = await Promise.all([
        cachedFetch?.(modelPath) || fetch(modelPath),
        cachedFetch?.(configPath) || fetch(configPath)
      ]);

      const [modelBuffer, voiceConfig] = await Promise.all([
        modelResponse.arrayBuffer(),
        configResponse.json()
      ]);

      // Create inference session (WASM backend)
      const session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: [
          {
            name: 'wasm',
            // SIMD improves latency in browsers that support it
            wasm: { simd: true }
          }
        ]
      });

      console.info('✅ Piper model loaded');
      return new PiperTTS(voiceConfig, session);
    } catch (error) {
      console.error('❌ Error loading Piper model:', error);
      throw error;
    }
  }

  async synthesize(text, options = {}) {
    const { speakerId = 0, lengthScale = 1.0, noiseScale = 0.667, noiseWScale = 0.8 } = options;
    try {
      const ort = await import('onnxruntime-web');

      // 1️⃣ Placeholder: simple character IDs → in real Piper, use phoneme IDs
      const phonemeIds = Array.from(text).map(c => Math.min(255, c.charCodeAt(0)));

      const inputs = {
        input: new ort.Tensor('int64', new BigInt64Array(phonemeIds.map(i => BigInt(i))), [1, phonemeIds.length]),
        input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]),
        scales: new ort.Tensor('float32', Float32Array.from([noiseScale, lengthScale, noiseWScale]), [3])
      };

      if (this.voiceConfig.num_speakers > 1) {
        inputs['sid'] = new ort.Tensor('int64', BigInt64Array.from([BigInt(speakerId)]), [1]);
      }

      const results = await this.session.run(inputs);
      const audioData = results.output.data;
      await this._playAudio(audioData);

      return audioData;
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  async _playAudio(floatArray) {
    // Convert Float32 PCM to AudioBuffer and play
    const buffer = this.audioCtx.createBuffer(1, floatArray.length, 22050);
    buffer.copyToChannel(floatArray, 0);
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    source.start();
  }
}
