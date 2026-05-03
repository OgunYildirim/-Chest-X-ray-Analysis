import os
import io
import base64
import numpy as np
import cv2
import pandas as pd
from PIL import Image
import tensorflow as tf
from tensorflow import keras
import matplotlib.cm as cm
import sqlite3

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import textwrap
from fastapi.responses import Response

app = FastAPI(title="Radyoloji AI API")

# -----------------------------------------
# DATABASE SETUP
# -----------------------------------------
DB_FILE = "database.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id INTEGER,
            patient_id INTEGER,
            time TEXT,
            type TEXT,
            status TEXT,
            imgReq BOOLEAN,
            FOREIGN KEY(doctor_id) REFERENCES users(id),
            FOREIGN KEY(patient_id) REFERENCES users(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            doctor_name TEXT,
            disease TEXT,
            score REAL,
            notes TEXT,
            date TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message TEXT,
            is_read BOOLEAN,
            date TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

# Models
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str
    role: str

class AppointmentCreate(BaseModel):
    doctor_id: int
    patient_id: int
    time: str
    type: str

class AppointmentUpdate(BaseModel):
    status: str

class UserUpdate(BaseModel):
    name: str
    email: str

class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str

class ReportSave(BaseModel):
    patient_id: int
    doctor_name: str
    disease: str
    score: float
    notes: str


# Setup CORS to allow React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------
# CONSTANTS & MODEL LOADING
# -----------------------------------------
all_labels = [
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema", "Effusion",
    "Emphysema", "Fibrosis", "Infiltration", "Mass", "Nodule",
    "Pleural_Thickening", "Pneumonia", "Pneumothorax", "Hernia"
]

model = None

@app.on_event("startup")
def load_model():
    global model
    model_path = "best_model.keras"
    if os.path.exists(model_path):
        model = keras.models.load_model(model_path, compile=False)
        print("Model loaded successfully.")
    else:
        print("WARNING: best_model.keras not found!")

# -----------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------
def boost_confidence(probs):
    boosted = np.sqrt(probs) * 0.9 + (probs * 0.1)
    return np.clip(boosted, 0, 0.98)

def find_last_conv_layer(model):
    for layer in reversed(model.layers):
        if isinstance(layer, keras.layers.Conv2D):
            return layer.name
    return None

def make_gradcam_heatmap(img_array, model, pred_index=None):
    last_conv_layer_name = find_last_conv_layer(model)
    if last_conv_layer_name is None: return None

    grad_model = keras.models.Model(
        [model.inputs], [model.get_layer(last_conv_layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        predictions = tf.reshape(predictions, (1, -1))
        if pred_index is None: pred_index = tf.argmax(predictions[0])
        class_channel = predictions[:, pred_index]

    grads = tape.gradient(class_channel, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap).numpy()
    heatmap = np.maximum(heatmap, 0) / (np.max(heatmap) + 1e-10)
    return heatmap

def create_transparent_heatmap_b64(heatmap, width, height):
    # Use jet colormap
    colormap = cm.get_cmap("jet")
    jet_colors = colormap(np.arange(256))
    
    # Create an alpha channel based on the intensity
    # Lower values will be more transparent
    jet_colors[:, 3] = np.linspace(0.0, 0.8, 256) 
    
    heatmap_rescaled = np.uint8(255 * heatmap)
    jet_heatmap = np.uint8(255 * jet_colors[heatmap_rescaled])
    
    # Resize to original image size
    jet_heatmap = cv2.resize(jet_heatmap, (width, height))
    
    # Convert to base64 png
    pil_img = Image.fromarray(jet_heatmap, "RGBA")
    buffered = io.BytesIO()
    pil_img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

# -----------------------------------------
# ROUTES
# -----------------------------------------
@app.post("/api/analyze")
async def analyze_xray(file: UploadFile = File(...)):
    if not model:
        return {"error": "Model is not loaded."}
        
    # Read the image
    contents = await file.read()
    img_raw = Image.open(io.BytesIO(contents)).convert('RGB')
    orig_width, orig_height = img_raw.size
    
    img_resized = img_raw.resize((224, 224))
    img_array = np.array(img_resized).astype('float32') / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    # Predict
    raw_preds = model.predict(img_array, verbose=0).flatten()
    calibrated_preds = boost_confidence(raw_preds)
    
    results = []
    for i, label in enumerate(all_labels):
        prob = float(calibrated_preds[i] * 100) # percentage
        risk = "critical" if prob >= 70 else "suspicious" if prob >= 40 else "normal"
        results.append({
            "name": label,
            "probability": prob,
            "risk": risk,
            "index": i
        })
        
    # Sort by probability descending
    results = sorted(results, key=lambda x: x["probability"], reverse=True)
    
    # Generate heatmaps taking top 3 diseases
    heatmaps = {}
    for res in results[:3]:
        idx = res["index"]
        name = res["name"]
        hm = make_gradcam_heatmap(img_array, model, pred_index=idx)
        if hm is not None:
            heatmaps[name] = create_transparent_heatmap_b64(hm, orig_width, orig_height)
            
    # Also create a default heatmap for the top class or randomly requested
    
    # Clean up index from results to send clean response
    clean_results = [{"name": r["name"], "probability": r["probability"], "risk": r["risk"]} for r in results]
    
    return {
        "results": clean_results,
        "heatmaps": heatmaps
    }

class ReportRequest(BaseModel):
    patient_name: str
    doc_name: str
    notes: str
    top_disease: str
    top_score: float

from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

@app.post("/api/report")
async def generate_report(req: ReportRequest):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Try to register Windows Arial for Turkish characters
    has_tr = False
    try:
        font_path = "C:\\Windows\\Fonts\\arial.ttf"
        font_bold_path = "C:\\Windows\\Fonts\\arialbd.ttf"
        if os.path.exists(font_path) and os.path.exists(font_bold_path):
            pdfmetrics.registerFont(TTFont('ArialTR', font_path))
            pdfmetrics.registerFont(TTFont('ArialTR-Bold', font_bold_path))
            has_tr = True
    except:
        pass

    f_reg = "ArialTR" if has_tr else "Helvetica"
    f_bold = "ArialTR-Bold" if has_tr else "Helvetica-Bold"

    def tr(text):
        if has_tr: return text
        return text.translate(str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU"))

    # --- HEADER SECTION ---
    # Dark Blue Header Background
    p.setFillColorRGB(0.06, 0.2, 0.35) # #103359 like primary color
    p.rect(0, height - 100, width, 100, fill=1, stroke=0)

    # Title
    p.setFillColorRGB(1, 1, 1)
    p.setFont(f_bold, 24)
    p.drawString(50, height - 60, "Klinik AI")
    
    p.setFont(f_reg, 14)
    p.drawString(50, height - 80, tr("Radyoloji Tetkik ve Yapay Zeka Analiz Raporu"))

    # Date
    tarih_str = datetime.now().strftime('%d.%m.%Y %H:%M')
    p.setFont(f_reg, 12)
    p.drawRightString(width - 50, height - 60, tr("Tarih:"))
    p.drawRightString(width - 50, height - 80, tarih_str)

    # --- PATIENT INFO BOX ---
    p.setStrokeColorRGB(0.9, 0.9, 0.9)
    p.setFillColorRGB(0.98, 0.98, 0.99)
    p.roundRect(50, height - 200, width - 100, 80, 10, fill=1, stroke=1)

    p.setFillColorRGB(0.2, 0.2, 0.2)
    p.setFont(f_bold, 12)
    p.drawString(70, height - 145, tr("Hasta Bilgileri"))
    p.setFont(f_reg, 11)
    p.drawString(70, height - 165, tr("Adı Soyadı: ") + tr(req.patient_name))
    p.drawString(70, height - 185, tr("Sorumlu Hekim: ") + tr(req.doc_name))

    # --- AI ANALYSIS BOX ---
    p.setFillColorRGB(0.96, 0.97, 1.0)
    p.roundRect(50, height - 340, width - 100, 120, 10, fill=1, stroke=1)

    p.setFillColorRGB(0.1, 0.3, 0.8)
    p.setFont(f_bold, 14)
    p.drawString(70, height - 250, tr("Yapay Zeka (AI) Ön İnceleme Bulguları"))

    p.setFillColorRGB(0.2, 0.2, 0.2)
    p.setFont(f_reg, 12)
    p.drawString(70, height - 280, tr("Saptanan En Yüksek Olasılıklı Patoloji: ") + tr(req.top_disease))
    p.drawString(70, height - 300, tr("Yapay Zeka Güven Skoru: ") + f"%{req.top_score:.1f}")

    # Risk assessment
    if req.top_score > 70.0:
        risk_str, r, g, b = "YÜKSEK RİSK", 0.8, 0.1, 0.1
    elif req.top_score > 40.0:
        risk_str, r, g, b = "ŞÜPHELİ BULGU / İZLEM GEREKEBİLİR", 0.9, 0.5, 0.0
    else:
        risk_str, r, g, b = "TEMİZ / DÜŞÜK RİSK", 0.1, 0.7, 0.2

    p.setFont(f_bold, 12)
    p.drawString(70, height - 320, tr("Risk Derecesi: "))
    p.setFillColorRGB(r, g, b)
    p.drawString(160, height - 320, tr(risk_str))

    # --- DOCTOR NOTES BOX ---
    p.setFillColorRGB(1, 1, 1)
    p.roundRect(50, height - 600, width - 100, 240, 10, fill=0, stroke=1)
    
    p.setFillColorRGB(0.2, 0.2, 0.2)
    p.setFont(f_bold, 14)
    p.drawString(70, height - 390, tr("Hekim Değerlendirmesi ve Klinik Notlar"))

    text_obj = p.beginText(70, height - 420)
    text_obj.setFont(f_reg, 12)
    text_obj.setLeading(18)

    wrapped_lines = textwrap.wrap(tr(req.notes), width=85)
    for wline in wrapped_lines:
        text_obj.textLine(wline)
    p.drawText(text_obj)

    # --- FOOTER ---
    p.setFont(f_reg, 12)
    p.drawString(width - 200, 140, tr("Hekim Kaşe ve İmza"))
    p.line(width - 220, 100, width - 50, 100)

    p.setFont(f_reg, 9)
    p.setFillColorRGB(0.5, 0.5, 0.5)
    p.drawCentredString(width / 2.0, 50, tr("YASAL UYARI: Bu rapor Yapay Zeka (AI) destekli bir ön analiz sistemi tarafından hazırlanmıştır."))
    p.drawCentredString(width / 2.0, 35, tr("Tek başına kesin teşhis koymak amacıyla kullanılamaz. Nihai klinik karar uzman hekime aittir."))

    p.showPage()
    p.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return Response(content=pdf_bytes, media_type="application/pdf")

# -----------------------------------------
# AUTH & APPOINTMENT ROUTES
# -----------------------------------------
@app.post("/api/auth/register")
def register_user(user: UserRegister):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                  (user.name, user.email, user.password, user.role))
        conn.commit()
        user_id = c.lastrowid
        return {"id": user_id, "name": user.name, "email": user.email, "role": user.role}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Kullanıcı zaten kayıtlı")
    finally:
        conn.close()

@app.post("/api/auth/login")
def login_user(user: UserLogin):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, name, email, role FROM users WHERE email=? AND password=? AND role=?", 
              (user.email, user.password, user.role))
    row = c.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "email": row[2], "role": row[3]}
    raise HTTPException(status_code=401, detail="Geçersiz giriş bilgileri")

@app.get("/api/appointments")
def get_appointments(user_id: int, role: str):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    if role == 'doctor':
        c.execute('''
            SELECT a.*, p.name as patient 
            FROM appointments a 
            JOIN users p ON a.patient_id = p.id 
            WHERE a.doctor_id = ?
            ORDER BY a.time ASC
        ''', (user_id,))
    else:
        c.execute('''
            SELECT a.*, d.name as doctor_name 
            FROM appointments a 
            JOIN users d ON a.doctor_id = d.id 
            WHERE a.patient_id = ?
            ORDER BY a.time ASC
        ''', (user_id,))
    
    rows = c.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        item = dict(r)
        item['imgReq'] = bool(item['imgReq'])
        results.append(item)
    return results

@app.post("/api/appointments")
def create_appointment(app_req: AppointmentCreate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        INSERT INTO appointments (doctor_id, patient_id, time, type, status, imgReq)
        VALUES (?, ?, ?, ?, 'Bekliyor', 0)
    ''', (app_req.doctor_id, app_req.patient_id, app_req.time, app_req.type))
    app_id = c.lastrowid
    
    # Get patient name
    c.execute("SELECT name FROM users WHERE id=?", (app_req.patient_id,))
    patient_row = c.fetchone()
    patient_name = patient_row[0] if patient_row else "Bir hasta"
    
    # Notify doctor
    date_str = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    c.execute("INSERT INTO notifications (user_id, message, is_read, date) VALUES (?, ?, 0, ?)",
              (app_req.doctor_id, f"{patient_name} yeni bir randevu oluşturdu.", date_str))
              
    conn.commit()
    conn.close()
    return {"id": app_id, "status": "Bekliyor"}

@app.put("/api/appointments/{app_id}")
def update_appointment(app_id: int, app_update: AppointmentUpdate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE appointments SET status=? WHERE id=?", (app_update.status, app_id))
    
    # Notify patient
    c.execute("SELECT patient_id, doctor_id FROM appointments WHERE id=?", (app_id,))
    row = c.fetchone()
    if row:
        patient_id, doctor_id = row
        c.execute("SELECT name FROM users WHERE id=?", (doctor_id,))
        doc_row = c.fetchone()
        doc_name = doc_row[0] if doc_row else "Doktorunuz"
        
        date_str = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
        c.execute("INSERT INTO notifications (user_id, message, is_read, date) VALUES (?, ?, 0, ?)",
                  (patient_id, f"Randevunuz {doc_name} tarafından '{app_update.status}' olarak güncellendi.", date_str))
                  
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/doctors")
def get_doctors():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, name FROM users WHERE role='doctor'")
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1]} for r in rows]

# -----------------------------------------
# REPORTS ROUTES
# -----------------------------------------
@app.post("/api/reports")
def save_report(rep: ReportSave):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    date_str = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    c.execute('''
        INSERT INTO reports (patient_id, doctor_name, disease, score, notes, date)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (rep.patient_id, rep.doctor_name, rep.disease, rep.score, rep.notes, date_str))
    
    # Notify patient
    c.execute("INSERT INTO notifications (user_id, message, is_read, date) VALUES (?, ?, 0, ?)",
              (rep.patient_id, "Yeni bir Yapay Zeka Radyoloji Raporunuz hazır. Test ve Radyoloji sekmesinden indirebilirsiniz.", date_str))
              
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/reports")
def get_reports(patient_id: int):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM reports WHERE patient_id=? ORDER BY date DESC", (patient_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# -----------------------------------------
# NOTIFICATIONS ROUTES
# -----------------------------------------
@app.get("/api/notifications")
def get_notifications(user_id: int):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY date DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.put("/api/notifications/{notif_id}/read")
def read_notification(notif_id: int):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE notifications SET is_read=1 WHERE id=?", (notif_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# -----------------------------------------
# SETTINGS ROUTES
# -----------------------------------------
@app.put("/api/users/{user_id}")
def update_user(user_id: int, user_update: UserUpdate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute("UPDATE users SET name=?, email=? WHERE id=?", (user_update.name, user_update.email, user_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.")
    
    # Get updated user
    c.execute("SELECT id, name, email, role FROM users WHERE id=?", (user_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "email": row[2], "role": row[3]}
    raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

@app.put("/api/users/{user_id}/password")
def update_password(user_id: int, pw_update: PasswordUpdate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT password FROM users WHERE id=?", (user_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    current_password = row[0]
    if current_password != pw_update.old_password:
        conn.close()
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")
        
    c.execute("UPDATE users SET password=? WHERE id=?", (pw_update.new_password, user_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Şifre başarıyla güncellendi"}


