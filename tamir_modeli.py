import tensorflow as tf
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras import layers, models

# --- 1. Yeni temiz model ---
base_model = EfficientNetB0(weights=None, include_top=False, input_shape=(256,256,3))

model = models.Sequential([
    base_model,
    layers.GlobalAveragePooling2D(),
    layers.BatchNormalization(),
    layers.Dropout(0.4),
    layers.Dense(14, activation='sigmoid')
])

model.build((None, 256, 256, 3))

# --- 2. Bozuk modelden ağırlıkları yükle ---
model.load_weights("model.weights.h5")

print("💚 Model başarıyla tamir edildi!")
model.save("tamir_edilmis_model.keras")
