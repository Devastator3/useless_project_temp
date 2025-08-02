# --- MODEL TRAINING --- (model.py)
import librosa
import numpy as np
import os
from tensorflow.keras import layers, models

# 1. Feature Extraction
def extract_features(file_path, duration=1.0, sr=22050):
    """Convert audio to MFCC features"""
    audio, sr = librosa.load(file_path, sr=sr, duration=duration)
    # Pad/trim audio to exact duration
    if len(audio) < sr * duration:
        audio = np.pad(audio, (0, int(sr * duration) - len(audio)))
    else:
        audio = audio[:int(sr * duration)]
    # Extract MFCCs (sound fingerprints)
    mfccs = librosa.feature.mfcc(
        y=audio,
        sr=sr,
        n_mfcc=13,       # Number of coefficients
        n_fft=2048,       # Window size
        hop_length=512     # Sliding window step
    )
    return mfccs.T  # Transpose for time steps first

def prepare_dataset(data_path):
    features = []
    labels = []
    class_names = sorted(os.listdir(data_path))
    for label_idx, class_name in enumerate(class_names):
        class_dir = os.path.join(data_path, class_name)
        for file in os.listdir(class_dir):
            if file.endswith(".wav"):
                file_path = os.path.join(class_dir, file)
                mfccs = extract_features(file_path)
                # Standard MFCC shape: (time_steps, 13)
                features.append(mfccs)
                labels.append(label_idx)
    return np.array(features), np.array(labels), class_names
def create_model(input_shape, num_classes):
    model = models.Sequential([
        # Input: MFCC matrix (time steps x features)
        layers.Input(shape=input_shape),
        # Expand for CNN (add channel dimension)
        layers.Reshape((input_shape[0], input_shape[1], 1)),
        # Feature detection layers
        layers.Conv2D(16, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        # Classification layers
        layers.Flatten(),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.3),  # Reduce overfitting
        layers.Dense(num_classes, activation='softmax')
    ])
    model.compile(optimizer='adam',
                 loss='sparse_categorical_crossentropy',
                 metrics=['accuracy'])
    return model
if __name__ == "__main__":
    # Prepare data
    X, y, class_names = prepare_dataset("dataset")
    print(f"Data shape: {X.shape}, Classes: {class_names}")
    # Create model
    model = create_model(input_shape=X[0].shape, num_classes=len(class_names))
    model.summary()
    # Train
    history = model.fit(X, y,
                        epochs=30,
                        validation_split=0.2,
                        batch_size=16)
    # Save for live detection
    model.save("bell_model.keras")
    print("Model saved!")