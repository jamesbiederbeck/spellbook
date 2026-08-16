package dev.nobugs.spellbook;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.File;

/**
 * Smallest possible proof of the native STT chain: hold the record button,
 * speak, release — captures 16kHz mono PCM via AudioRecord, feeds it to
 * WhisperBridge (the vendored whisper.cpp JNI bridge), and shows the
 * transcript. Not the SpellBook device UI (see CLAUDE.md at the spellbook
 * repo root for that); this activity exists to validate the whisper.cpp
 * native build before it's wired into the real app.
 */
public class MainActivity extends Activity {

    private static final int SAMPLE_RATE = 16000;
    private static final int REQUEST_RECORD_AUDIO = 1;
    private static final String MODEL_FILENAME = "ggml-model.bin";

    private TextView statusView;
    private TextView transcriptView;
    private Button recordButton;

    private WhisperBridge whisper;
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean recording = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUI();

        if (!BuildConfig.WHISPER_ENABLED) {
            statusView.setText("Native STT disabled in this build (WHISPER=0).");
            recordButton.setEnabled(false);
            return;
        }

        // Smoke test: getSystemInfo() takes no model/context, so this alone
        // proves System.loadLibrary("whisper") found and bound
        // Java_com_whispercpp_whisper_WhisperLib_00024Companion_* correctly —
        // if the JNI binding is wrong, this throws UnsatisfiedLinkError right
        // here instead of failing later behind a mic press.
        String systemInfo;
        try {
            systemInfo = com.whispercpp.whisper.WhisperLib.Companion.getSystemInfo();
        } catch (UnsatisfiedLinkError e) {
            statusView.setText("Native lib failed to bind: " + e.getMessage());
            recordButton.setEnabled(false);
            return;
        }

        File modelFile = new File(getExternalFilesDir(null), MODEL_FILENAME);
        if (!modelFile.exists()) {
            statusView.setText(systemInfo + "\n\nNo model at " + modelFile.getAbsolutePath()
                    + " — adb push a ggml whisper.cpp model there first.");
            recordButton.setEnabled(false);
            return;
        }

        modelPath = modelFile.getAbsolutePath();
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
    }

    private String modelPath;

    private void buildUI() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        root.setPadding(pad, dp(48), pad, pad);

        statusView = new TextView(this);
        statusView.setText("Loading...");
        root.addView(statusView);

        recordButton = new Button(this);
        recordButton.setText("Hold to Record");
        recordButton.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    startRecording();
                    return true;
                case android.view.MotionEvent.ACTION_UP:
                case android.view.MotionEvent.ACTION_CANCEL:
                    stopRecordingAndTranscribe();
                    return true;
            }
            return false;
        });
        root.addView(recordButton);

        transcriptView = new TextView(this);
        transcriptView.setPadding(0, dp(24), 0, 0);
        root.addView(transcriptView);

        setContentView(root);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_RECORD_AUDIO) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                try {
                    whisper = new WhisperBridge(modelPath);
                    statusView.setText("Model loaded. Hold the button and speak.");
                } catch (IllegalStateException e) {
                    statusView.setText("Failed to load model: " + e.getMessage());
                    recordButton.setEnabled(false);
                }
            } else {
                statusView.setText("RECORD_AUDIO permission denied.");
                recordButton.setEnabled(false);
            }
        }
    }

    private void startRecording() {
        if (recording || whisper == null) return;

        int minBufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBufSize * 4);

        java.io.ByteArrayOutputStream captured = new java.io.ByteArrayOutputStream();
        recording = true;
        audioRecord.startRecording();
        statusView.setText("Listening...");

        recordingThread = new Thread(() -> {
            short[] buf = new short[minBufSize];
            while (recording) {
                int read = audioRecord.read(buf, 0, buf.length);
                for (int i = 0; i < read; i++) {
                    captured.write(buf[i] & 0xFF);
                    captured.write((buf[i] >> 8) & 0xFF);
                }
            }
            pendingSamples = pcm16ToFloat(captured.toByteArray());
        });
        recordingThread.start();
    }

    private volatile float[] pendingSamples = new float[0];

    private void stopRecordingAndTranscribe() {
        if (!recording) return;
        recording = false;
        try {
            recordingThread.join();
        } catch (InterruptedException ignored) {
        }
        audioRecord.stop();
        audioRecord.release();
        audioRecord = null;

        statusView.setText("Transcribing...");
        float[] samples = pendingSamples;
        new Thread(() -> {
            String text = whisper.transcribe(samples);
            runOnUiThread(() -> {
                transcriptView.setText(text.isEmpty() ? "(no speech detected)" : text);
                statusView.setText("Hold the button and speak.");
            });
        }).start();
    }

    private static float[] pcm16ToFloat(byte[] pcm) {
        float[] out = new float[pcm.length / 2];
        for (int i = 0; i < out.length; i++) {
            short sample = (short) ((pcm[2 * i] & 0xFF) | (pcm[2 * i + 1] << 8));
            out[i] = sample / 32768f;
        }
        return out;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (whisper != null) {
            whisper.close();
        }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }
}
