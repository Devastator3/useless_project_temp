import pyaudio
import numpy as np
import tensorflow as tf
import librosa
# Load trained model
model = tf.keras.models.load_model("bell_model.keras")
class_names = ["background", "bell"]  # Update with your class names

# Audio parameters (MUST match training)
SAMPLE_RATE = 22050
DURATION = 1.0  # seconds
SAMPLES_PER_CHUNK = int(SAMPLE_RATE * DURATION)

def process_audio(audio_data):
    """Convert raw audio to MFCCs (same as training)"""
    # Convert to float32 and normalize
    audio = audio_data.astype(np.float32) / 32768.0
    # Extract MFCCs
    mfccs = librosa.feature.mfcc(
        y=audio,
        sr=SAMPLE_RATE,
        n_mfcc=13,
        n_fft=2048,
        hop_length=512
    )
    return mfccs.T

# Initialize audio stream
p = pyaudio.PyAudio()
stream = p.open(format=pyaudio.paInt16,
                channels=1,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=SAMPLES_PER_CHUNK)

print("\n🔔 Listening for bell clangs... (Press Ctrl+C to stop)")
try:
    while True:
        # Read audio chunk
        raw_data = stream.read(SAMPLES_PER_CHUNK)
        audio_chunk = np.frombuffer(raw_data, dtype=np.int16)
        # Process and predict
        mfccs = process_audio(audio_chunk)
        input_data = mfccs[np.newaxis, ...]  # Add batch dimension
        prediction = model.predict(input_data, verbose=0)
        class_idx = np.argmax(prediction)
        confidence = prediction[0][class_idx]
        # Only trigger on high-confidence bell detections
        if class_names[class_idx] == "bell" and confidence > 0.9:
            print(f"🚨 BELL DETECTED! ({confidence:.2%})")
except KeyboardInterrupt:
    stream.stop_stream()
    stream.close()
    p.terminate()
    print("\nStopped")