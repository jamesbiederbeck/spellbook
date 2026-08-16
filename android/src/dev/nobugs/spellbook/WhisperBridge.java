package dev.nobugs.spellbook;

import com.whispercpp.whisper.WhisperLib;

/**
 * Thin wrapper around the vendored whisper.cpp JNI bridge (libwhisper.so,
 * see ../../../whisper_cpp_binary_version.json for the pinned build). One
 * instance owns one loaded model context. Mirrors the shape of
 * sharerouter's LlamaBridge.
 */
public class WhisperBridge implements AutoCloseable {

    private long handle;

    public WhisperBridge(String modelPath) {
        handle = WhisperLib.Companion.initContext(modelPath);
        if (handle == 0) {
            throw new IllegalStateException("Failed to load Whisper model: " + modelPath);
        }
    }

    /** samples must be 16kHz mono, normalized to [-1, 1]. */
    public String transcribe(float[] samples) {
        if (handle == 0) {
            throw new IllegalStateException("WhisperBridge already closed");
        }
        int numThreads = Math.max(2, Runtime.getRuntime().availableProcessors() - 1);
        WhisperLib.Companion.fullTranscribe(handle, numThreads, samples);

        int segmentCount = WhisperLib.Companion.getTextSegmentCount(handle);
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < segmentCount; i++) {
            result.append(WhisperLib.Companion.getTextSegment(handle, i));
        }
        return result.toString().trim();
    }

    @Override
    public void close() {
        if (handle != 0) {
            WhisperLib.Companion.freeContext(handle);
            handle = 0;
        }
    }
}
