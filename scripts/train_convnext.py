"""
train_convnext.py
=================
NIH ChestX-ray14 veri seti üzerinde ConvNeXt-Base modelini eğitir.
Hedef: Ortalama AUC >= 0.90

KULLANIM:
    python train_convnext.py
    python train_convnext.py --dry_run          # Sadece 1 batch test eder
    python train_convnext.py --data_dir D:/data # Veri seti başka bir yerdeyse

VERİ SETİ YAPISI (NIH ChestX-ray14):
    <data_dir>/
        Data_Entry_2017.csv
        images/
            00000001_000.png
            00000001_001.png
            ...
"""

import argparse
import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("[UYARI] scikit-learn kurulu değil. AUC hesabı atlanacak.")
    print("        Kurmak için: python -m pip install scikit-learn")

# ─────────────────────────────────────────
# 0. ARGÜMANLAR
# ─────────────────────────────────────────
parser = argparse.ArgumentParser(description="ConvNeXt-Base Eğitim Scripti")
parser.add_argument("--data_dir", type=str, default=".",
                    help="NIH ChestX-ray14 veri setinin bulunduğu klasör")
parser.add_argument("--batch_size", type=int, default=32)
parser.add_argument("--img_size", type=int, default=224)
parser.add_argument("--epochs_phase1", type=int, default=5,
                    help="Donmuş backbone ile ön-eğitim epoch sayısı")
parser.add_argument("--epochs_phase2", type=int, default=50,
                    help="Tam fine-tuning epoch sayısı")
parser.add_argument("--dry_run", action="store_true",
                    help="Sadece 1 batch ile modeli test et, tam eğitim yapma")
parser.add_argument("--output_model", type=str, default="convnext_model.keras",
                    help="Kaydedilecek model dosyasının adı")
args = parser.parse_args()

# ─────────────────────────────────────────
# 1. SABİTLER
# ─────────────────────────────────────────
ALL_LABELS = [
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema",
    "Effusion", "Emphysema", "Fibrosis", "Infiltration",
    "Mass", "Nodule", "Pleural_Thickening", "Pneumonia",
    "Pneumothorax", "Hernia"
]
NUM_CLASSES = len(ALL_LABELS)
IMG_SIZE    = (args.img_size, args.img_size)
BATCH_SIZE  = args.batch_size
CSV_PATH    = os.path.join(args.data_dir, "Data_Entry_2017.csv")
IMG_DIR     = os.path.join(args.data_dir, "images")

print("=" * 60)
print(f"  ConvNeXt-Base Eğitim Scripti")
print(f"  TF Sürümü : {tf.__version__}")
print(f"  GPU       : {tf.config.list_physical_devices('GPU')}")
print(f"  Veri Yolu : {args.data_dir}")
print(f"  Görüntü   : {IMG_SIZE}, Batch: {BATCH_SIZE}")
print("=" * 60)

# ─────────────────────────────────────────
# 2. VERİ YÜKLEME
# ─────────────────────────────────────────
def load_nih_dataset(csv_path: str, img_dir: str):
    """NIH ChestX-ray14 CSV'sini okur, etiketleri one-hot'a çevirir."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"CSV bulunamadı: {csv_path}\n"
            "Lütfen --data_dir argümanıyla veri setinin doğru yolunu belirtin.\n"
            "Dataset: https://nihcc.app.box.com/v/ChestXray-NIHCC"
        )
    df = pd.read_csv(csv_path)
    df = df[["Image Index", "Finding Labels"]].copy()

    # Görüntü dosyasının varlığını kontrol et
    df["path"] = df["Image Index"].apply(lambda x: os.path.join(img_dir, x))
    df = df[df["path"].apply(os.path.exists)].reset_index(drop=True)
    print(f"  Geçerli görüntü sayısı: {len(df):,}")

    # One-hot etiket matrisi
    for label in ALL_LABELS:
        df[label] = df["Finding Labels"].apply(
            lambda x: 1.0 if label in x.split("|") else 0.0
        )
    return df


df = load_nih_dataset(CSV_PATH, IMG_DIR)

# Eğitim / Validation / Test bölmesi (%70 / %15 / %15)
if SKLEARN_AVAILABLE:
    train_df, temp_df = train_test_split(df, test_size=0.30, random_state=42)
    val_df,   test_df = train_test_split(temp_df, test_size=0.50, random_state=42)
else:
    # Basit numpy bölmesi (sklearn yoksa)
    n = len(df)
    idx = np.random.RandomState(42).permutation(n)
    train_df = df.iloc[idx[:int(n * 0.70)]].reset_index(drop=True)
    val_df   = df.iloc[idx[int(n * 0.70):int(n * 0.85)]].reset_index(drop=True)
    test_df  = df.iloc[idx[int(n * 0.85):]].reset_index(drop=True)

print(f"  Eğitim: {len(train_df):,} | Validation: {len(val_df):,} | Test: {len(test_df):,}")

# ─────────────────────────────────────────
# 3. VERİ PİPELİNE (tf.data)
# ─────────────────────────────────────────
AUTOTUNE = tf.data.AUTOTUNE

def parse_image(path, label):
    img = tf.io.read_file(path)
    img = tf.image.decode_png(img, channels=3)      # JPEG/PNG otomatik algılanır
    img = tf.image.resize(img, IMG_SIZE)
    img = tf.cast(img, tf.float32) / 255.0
    return img, label

def augment(img, label):
    """Eğitim için veri artırma (agresif değil, radyolojiye uygun)."""
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_brightness(img, max_delta=0.08)
    img = tf.image.random_contrast(img, 0.92, 1.08)
    # Hafif rotasyon (kontrollü)
    img = tf.keras.layers.RandomRotation(0.05)(img, training=True)
    return img, label

def make_dataset(dataframe, augment_data=False, shuffle=False):
    paths  = dataframe["path"].values
    labels = dataframe[ALL_LABELS].values.astype("float32")
    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if shuffle:
        ds = ds.shuffle(buffer_size=len(dataframe), seed=42)
    ds = ds.map(parse_image, num_parallel_calls=AUTOTUNE)
    if augment_data:
        ds = ds.map(augment, num_parallel_calls=AUTOTUNE)
    ds = ds.batch(BATCH_SIZE).prefetch(AUTOTUNE)
    return ds


if args.dry_run:
    # Sadece 1 batch al
    train_ds = make_dataset(train_df.head(BATCH_SIZE * 2), augment_data=True, shuffle=True)
    val_ds   = make_dataset(val_df.head(BATCH_SIZE * 2))
    test_ds  = make_dataset(test_df.head(BATCH_SIZE * 2))
    print("\n  [DRY RUN] Sadece 1 batch ile test yapılıyor...")
else:
    train_ds = make_dataset(train_df, augment_data=True, shuffle=True)
    val_ds   = make_dataset(val_df)
    test_ds  = make_dataset(test_df)

# ─────────────────────────────────────────
# 4. SINIF AĞIRLIKLARI (Class Imbalance)
# ─────────────────────────────────────────
# Binary etiket başına pozitif/negatif oran hesapla
pos_counts = train_df[ALL_LABELS].sum()
neg_counts = len(train_df) - pos_counts
# Pozitif ağırlık = negatif/pozitif oranı (seyrek sınıfları güçlendirir)
pos_weights = (neg_counts / pos_counts.clip(lower=1)).values.astype("float32")
pos_weights_tensor = tf.constant(pos_weights, dtype=tf.float32)

print("\n  Sınıf Ağırlıkları (Pozitif):")
for label, w in zip(ALL_LABELS, pos_weights):
    print(f"    {label:<22}: {w:.2f}")

# ─────────────────────────────────────────
# 5. MODEL MİMARİSİ
# ─────────────────────────────────────────
def build_convnext_model(num_classes: int, img_size: tuple) -> keras.Model:
    """
    ConvNeXt-Base backbone + özel sınıflandırma başı.
    - ImageNet ağırlıklarıyla başlar (transfer learning)
    - GlobalAveragePooling → Dropout → Dense(sigmoid)
    """
    # Keras 2.x ve 3.x uyumlu içe aktarma
    try:
        # Keras 3.x
        backbone = keras.applications.ConvNeXtBase(
            include_top=False,
            weights="imagenet",
            input_shape=(*img_size, 3),
            include_preprocessing=True   # Otomatik normalizasyon
        )
    except TypeError:
        # Keras 2.x (include_preprocessing parametresi yok)
        backbone = keras.applications.ConvNeXtBase(
            include_top=False,
            weights="imagenet",
            input_shape=(*img_size, 3)
        )

    inputs = keras.Input(shape=(*img_size, 3), name="input_image")
    x = backbone(inputs, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="gap")(x)
    x = keras.layers.BatchNormalization(name="bn_head")(x)
    x = keras.layers.Dropout(0.3, name="dropout_1")(x)
    x = keras.layers.Dense(512, activation="gelu", name="dense_head")(x)
    x = keras.layers.Dropout(0.2, name="dropout_2")(x)
    outputs = keras.layers.Dense(
        num_classes, activation="sigmoid", name="predictions"
    )(x)

    model = keras.Model(inputs, outputs, name="ConvNeXt_ChestXray")
    model.backbone = backbone  # Dondurma/çözme için referans
    return model


model = build_convnext_model(NUM_CLASSES, IMG_SIZE)
model.summary(line_length=100)

# ─────────────────────────────────────────
# 6. KAYIP FONKSİYONU (Weighted BCE)
# ─────────────────────────────────────────
def weighted_binary_crossentropy(y_true, y_pred):
    """
    Her hastalık sınıfı için ayrı pozitif ağırlıklı BCE.
    Seyrek sınıfların (Hernia, Nodule vb.) katkısını artırır.
    """
    epsilon = 1e-7
    y_pred  = tf.clip_by_value(y_pred, epsilon, 1.0 - epsilon)

    # Standart BCE bileşenleri
    pos_loss = -y_true * tf.math.log(y_pred) * pos_weights_tensor
    neg_loss = -(1 - y_true) * tf.math.log(1 - y_pred)

    return tf.reduce_mean(pos_loss + neg_loss)


# ─────────────────────────────────────────
# 7. METRIKLER
# ─────────────────────────────────────────
auc_metrics = [
    keras.metrics.AUC(name=f"auc_{label}", curve="ROC")
    for label in ALL_LABELS
]
mean_auc = keras.metrics.AUC(name="mean_auc", curve="ROC", multi_label=True,
                               num_labels=NUM_CLASSES)

# ─────────────────────────────────────────
# 8. FAZA 1 - Backbone Dondurulmuş Eğitim
# ─────────────────────────────────────────
print("\n" + "=" * 60)
print("  FAZA 1: Backbone dondurulmuş ön-eğitim")
print("=" * 60)

model.backbone.trainable = False

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss=weighted_binary_crossentropy,
    metrics=[mean_auc]
)

callbacks_phase1 = [
    keras.callbacks.ModelCheckpoint(
        "best_phase1.keras",
        monitor="val_mean_auc",
        mode="max",
        save_best_only=True,
        verbose=1
    ),
    keras.callbacks.EarlyStopping(
        monitor="val_mean_auc",
        patience=3,
        mode="max",
        restore_best_weights=True,
        verbose=1
    )
]

epochs_p1 = 1 if args.dry_run else args.epochs_phase1
history_p1 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=epochs_p1,
    callbacks=callbacks_phase1,
    verbose=1
)

print(f"\n  Faza 1 tamamlandı. Validation AUC: "
      f"{max(history_p1.history.get('val_mean_auc', [0])):.4f}")

# ─────────────────────────────────────────
# 9. FAZA 2 - Tam Fine-Tuning
# ─────────────────────────────────────────
print("\n" + "=" * 60)
print("  FAZA 2: Tam fine-tuning (tüm katmanlar açık)")
print("=" * 60)

model.backbone.trainable = True

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-5),
    loss=weighted_binary_crossentropy,
    metrics=[mean_auc]
)

checkpoint_path = args.output_model

callbacks_phase2 = [
    keras.callbacks.ModelCheckpoint(
        checkpoint_path,
        monitor="val_mean_auc",
        mode="max",
        save_best_only=True,
        verbose=1
    ),
    keras.callbacks.EarlyStopping(
        monitor="val_mean_auc",
        patience=7,
        mode="max",
        restore_best_weights=True,
        verbose=1
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_mean_auc",
        factor=0.5,
        patience=3,
        mode="max",
        min_lr=1e-7,
        verbose=1
    ),
    keras.callbacks.TensorBoard(
        log_dir="./logs_convnext",
        histogram_freq=0
    )
]

epochs_p2 = 1 if args.dry_run else args.epochs_phase2
history_p2 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=epochs_p2,
    callbacks=callbacks_phase2,
    verbose=1
)

# ─────────────────────────────────────────
# 10. TEST SETİ DEĞERLENDİRMESİ
# ─────────────────────────────────────────
print("\n" + "=" * 60)
print("  TEST SETİ DEĞERLENDİRMESİ")
print("=" * 60)

if SKLEARN_AVAILABLE:
    # Tahminleri topla
    all_preds      = []
    all_labels_arr = []

    for batch_imgs, batch_labels in test_ds:
        preds = model.predict(batch_imgs, verbose=0)
        all_preds.append(preds)
        all_labels_arr.append(batch_labels.numpy())

    y_pred = np.vstack(all_preds)
    y_true = np.vstack(all_labels_arr)

    # Her hastalık için AUC hesapla
    auc_scores = {}
    for i, label in enumerate(ALL_LABELS):
        if y_true[:, i].sum() > 0 and (1 - y_true[:, i]).sum() > 0:
            try:
                auc = roc_auc_score(y_true[:, i], y_pred[:, i])
            except ValueError:
                auc = float("nan")
        else:
            auc = float("nan")
        auc_scores[label] = auc

    print(f"\n  {'Hastalık':<25} {'AUC':>8}")
    print(f"  {'-'*35}")
    valid_aucs = []
    for label, auc in auc_scores.items():
        marker = " ✅" if auc >= 0.90 else (" ⚠️ " if auc >= 0.80 else " ❌")
        if not np.isnan(auc):
            valid_aucs.append(auc)
            print(f"  {label:<25} {auc:.4f}{marker}")
        else:
            print(f"  {label:<25}    N/A (yetersiz örnek)")

    mean_auc_score = np.mean(valid_aucs) if valid_aucs else 0.0
    print(f"\n  {'ORTALAMA AUC':<25} {mean_auc_score:.4f}"
          + (" ✅ HEDEF KARŞILANDI!" if mean_auc_score >= 0.90 else " (Hedef: 0.90)"))
else:
    print("  [UYARI] scikit-learn kurulu değil, AUC hesabı atlandı.")
    print("  AUC raporu için: python -m pip install scikit-learn")

# ─────────────────────────────────────────
# 11. MODEL KAYDET
# ─────────────────────────────────────────
# En iyi model zaten ModelCheckpoint tarafından kaydedildi.
# Ek olarak son modeli de kaydedelim (karşılaştırma için).
last_model_path = args.output_model.replace(".keras", "_last.keras")
model.save(last_model_path)

print(f"\n  En iyi model: {checkpoint_path}")
print(f"  Son model   : {last_model_path}")
print(f"\n  app.py'de 'best_model.keras' yerine '{checkpoint_path}' kullanılacak.")
print("=" * 60)
print("  Eğitim tamamlandı!")
print("=" * 60)
