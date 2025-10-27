// A minimal in–browser speech-to-text implementation built around
// the OpenAI Whisper model exported to ONNX.  This class mirrors the
// structure of the existing Piper TTS module and is designed to be
// dropped into the SpellBook codebase without additional changes.
//
// The ASR pipeline follows the same basic four-stage process used
// internally by Whisper:
//   1. Preprocessing – convert raw audio into a log-mel spectrogram.
//   2. Encoder inference – run the mel input through the encoder
//      portion of the model.
//   3. Decoder loop – iteratively generate tokens until the end
//      token is produced.
//   4. Postprocessing – decode token IDs back into text via the
//      provided vocabulary.
//
// The code below intentionally avoids external dependencies beyond
// `onnxruntime-web` and the existing model cache helper.  It does
// not currently attempt to optimise for performance; instead it
// provides a simple, clear implementation that can be improved later.

import { cachedFetch } from './model-cache.js';

export class WhisperASR {
  constructor(session, tokenizer, featureCfg) {
    this.session = session;
    this.tokenizer = tokenizer;
    this.featureCfg = featureCfg;
    this.sampleRate = 16000;
    this.bosTokenId = this.tokenizer.bos_token_id ?? 50257;
    this.eotTokenId = this.tokenizer.eot_token_id ?? 50256;
  }

  static async from_pretrained(modelPath, vocabPath, featurePath) {
    const ort = await import('onnxruntime-web');
    const [modelBuf, vocabJson, featCfg] = await Promise.all([
      cachedFetch(modelPath),
      fetch(vocabPath).then(r => r.json()),
      fetch(featurePath).then(r => r.json())
    ]);
    const session = await ort.InferenceSession.create(modelBuf, {
      executionProviders: ['wasm', 'webgpu']
    });
    return new WhisperASR(session, vocabJson, featCfg);
  }

  // Convert Float32 PCM → log-mel spectrogram
  audioToMel(audio) {
    const nFft = this.featureCfg.n_fft;
    const hop = this.featureCfg.hop_length;
    const nMels = this.featureCfg.n_mels;
    const melFilters = this.featureCfg.mel_filters;
    const hann = new Float32Array(nFft);
    for (let i = 0; i < nFft; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / nFft));
    const frames = Math.floor((audio.length - nFft) / hop) + 1;
    const mel = new Float32Array(frames * nMels);
    const re = new Float32Array(nFft);
    const im = new Float32Array(nFft);
    for (let f = 0; f < frames; f++) {
      const offset = f * hop;
      for (let i = 0; i < nFft; i++) {
        const v = audio[offset + i] * hann[i];
        re[i] = v;
        im[i] = 0;
      }
      this.fft(re, im);
      const mags = new Float32Array(nFft / 2 + 1);
      for (let k = 0; k < mags.length; k++)
        mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      for (let m = 0; m < nMels; m++) {
        let e = 0;
        for (let k = 0; k < mags.length; k++) e += melFilters[m][k] * mags[k];
        mel[f * nMels + m] = Math.log10(Math.max(e, 1e-10));
      }
    }
    return mel;
  }

  fft(re, im) {
    const N = re.length;
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) [re[i], re[j]] = [re[j], re[i]], [im[i], im[j]] = [im[j], im[i]];
    }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wlen_re = Math.cos(ang), wlen_im = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let w_re = 1, w_im = 0;
        for (let j = 0; j < len / 2; j++) {
          const u_re = re[i + j], u_im = im[i + j];
          const v_re = re[i + j + len / 2] * w_re - im[i + j + len / 2] * w_im;
          const v_im = re[i + j + len / 2] * w_im + im[i + j + len / 2] * w_re;
          re[i + j] = u_re + v_re;
          im[i + j] = u_im + v_im;
          re[i + j + len / 2] = u_re - v_re;
          im[i + j + len / 2] = u_im - v_im;
          const next_re = w_re * wlen_re - w_im * wlen_im;
          const next_im = w_re * wlen_im + w_im * wlen_re;
          w_re = next_re; w_im = next_im;
        }
      }
    }
  }

  async transcribe(audio) {
    const mel = this.audioToMel(audio);
    const frames = mel.length / this.featureCfg.n_mels;
    const input = new Float32Array(1 * 80 * frames);
    input.set(mel);
    const ort = await import('onnxruntime-web');
    const inputs = { input_features: new ort.Tensor('float32', input, [1, 80, frames]) };
    const encoderOut = await this.session.run(inputs);
    const enc = encoderOut.encoder_output;
    let tokens = [this.bosTokenId];
    for (let step = 0; step < 200; step++) {
      const decInputs = {
        tokens: new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length]),
        encoder_output: enc
      };
      const out = await this.session.run(decInputs);
      const next = Number(out.logits.data[out.logits.data.length - 1]);
      if (next === this.eotTokenId) break;
      tokens.push(next);
    }
    const text = tokens.map(id => this.tokenizer.decoder[id] || '').join('').trim();
    return { text };
  }
}
