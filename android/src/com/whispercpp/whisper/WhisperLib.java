package com.whispercpp.whisper;

/**
 * Plain-Java re-declaration of the native methods upstream whisper.cpp
 * declares in examples/whisper.android/lib's Kotlin WhisperLib (see
 * LibWhisper.kt at the ref pinned in ../whisper_cpp_binary_version.json).
 * libwhisper.so IS the compiled JNI bridge for that Kotlin class — its
 * exported symbols are Java_com_whispercpp_whisper_WhisperLib_00024Companion_*
 * (the $Companion nested-class mangling), so this class must reproduce the
 * exact package, class/nesting, method names, and parameter types for
 * System.loadLibrary to bind correctly. The natives themselves are plain
 * blocking JNI calls (no coroutines/suspend), so no Kotlin runtime is
 * needed to call them from Java.
 *
 * Deliberately omits initContextFromInputStream/initContextFromAsset (unused
 * here) and the bench* methods (unused). Always loads libwhisper.so, not the
 * CPU-feature-detected vfpv4/v8fp16 variants upstream's Kotlin loader
 * self-selects — this app ships only the baseline arm64-v8a build.
 */
public class WhisperLib {

    public static class Companion {
        public native long initContext(String modelPath);
        public native void freeContext(long contextPtr);
        public native void fullTranscribe(long contextPtr, int numThreads, float[] audioData);
        public native int getTextSegmentCount(long contextPtr);
        public native String getTextSegment(long contextPtr, int index);
        public native String getSystemInfo();
    }

    public static final Companion Companion = new Companion();

    static {
        System.loadLibrary("whisper");
    }

    private WhisperLib() {}
}
