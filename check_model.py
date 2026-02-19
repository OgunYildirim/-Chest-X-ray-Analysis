import tensorflow as tf

# Modeli yükle
model = tf.keras.models.load_model('best_model.keras', compile=False)

# 1. Modelin kaç çıkışı var? (14 mü yoksa 1 mi?)
print(f"--- MODEL ÇIKTI BOYUTU ---")
print(model.output_shape) 

# 2. Katman isimleri neler? (Grad-CAM için doğru katmanı bulmalıyız)
print(f"\n--- SON 10 KATMAN ---")
for layer in model.layers[-10:]:
    print(f"Katman Adı: {layer.name} | Türü: {type(layer).__name__}")