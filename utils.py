import numpy as np
import tensorflow as tf
import cv2

def get_gradcam(model, img_array, selected_idx, model_type="EfficientNetB0"):
    """
    Profesyonel Grad-CAM: Seçilen model tipine göre gürültüden arındırılmış 
    ve anatomik olarak pürüzsüzleştirilmiş Isı Haritası üretir.
    """
    try:
        # 1. Model tipine göre son konvolüsyon katmanı seçimi
        if "EfficientNet" in model_type:
            last_conv_layer_name = "top_activation"
        else:
            # DenseNet121 için genellikle 'relu' son zengin özellik katmanıdır
            last_conv_layer_name = "relu"
        
        # Ara model oluşturma
        grad_model = tf.keras.models.Model(
            [model.inputs], 
            [model.get_layer(last_conv_layer_name).output, model.output]
        )

        # 2. Gradyan İzleme
        with tf.GradientTape() as tape:
            last_conv_layer_output, preds = grad_model(img_array)
            class_channel = preds[:, selected_idx]

        # Gradyan hesaplama
        grads = tape.gradient(class_channel, last_conv_layer_output)
        
        # --- PROFESYONEL GÜNCELLEME: Guided Grad-CAM Filtreleme ---
        # Sadece pozitif gradyanları ve aktivasyonları dikkate alarak gürültüyü temizler
        cast_conv_outputs = tf.cast(last_conv_layer_output > 0, "float32")
        cast_grads = tf.cast(grads > 0, "float32")
        guided_grads = cast_conv_outputs * cast_grads * grads

        # Global Average Pooling (Ağırlıklar)
        pooled_grads = tf.reduce_mean(guided_grads, axis=(0, 1, 2))

        # Isı haritası hesaplama
        last_conv_layer_output = last_conv_layer_output[0]
        heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap).numpy()

        # 3. Normalizasyon ve Eşikleme (Thresholding)
        heatmap = np.maximum(heatmap, 0)
        max_val = np.max(heatmap)
        if max_val == 0: max_val = 1e-10
        heatmap = heatmap / max_val

        # --- PROFESYONEL GÜNCELLEME: Düşük sinyal temizliği ---
        # %20'nin altındaki zayıf sinyalleri (arka plan gürültüsü) temizler
        heatmap[heatmap < 0.2] = 0
        
        return heatmap
        
    except Exception as e:
        print(f"Grad-CAM Hatası ({model_type}): {e}")
        return np.zeros((7, 7))

def preprocess_image(image, model_type="EfficientNetB0"):
    """
    Modele göre görüntüyü hazırlar. 
    EfficientNetB0 için (256, 256), DenseNet121 için (224, 224) kullanır.
    """
    target_size = (256, 256) if "EfficientNet" in model_type else (224, 224)
    
    img = np.array(image.convert('RGB'))
    img_resized = cv2.resize(img, target_size)
    
    # Normalizasyon
    img_array = img_resized.astype('float32') / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array, img_resized

def overlay_heatmap(heatmap, original_img):
    """
    Profesyonel Görselleştirme: Isı haritasını yumuşatır ve anatomik uyumu artırır.
    """
    # --- PROFESYONEL GÜNCELLEME: Cubic Interpolation ---
    # Isı haritasını büyütürken pikselleşmeyi önler
    heatmap_resized = cv2.resize(heatmap, (original_img.shape[1], original_img.shape[0]), 
                                 interpolation=cv2.INTER_CUBIC)
    
    # --- PROFESYONEL GÜNCELLEME: Gaussian Smoothing ---
    # Isı haritasına yumuşak geçişler ekleyerek radyolojik lezyon görünümü sağlar
    heatmap_resized = cv2.GaussianBlur(heatmap_resized, (15, 15), 0)
    
    heatmap_color = np.uint8(255 * heatmap_resized)
    heatmap_color = cv2.applyColorMap(heatmap_color, cv2.COLORMAP_JET)
    
    # Orijinal resimle harmanlama (0.7 orijinal, 0.3 ısı haritası - ideal şeffaflık)
    superimposed_img = cv2.addWeighted(original_img, 0.7, heatmap_color, 0.3, 0)
    
    return superimposed_img