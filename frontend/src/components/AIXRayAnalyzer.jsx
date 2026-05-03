import React, { useState, useCallback, useEffect } from 'react';
import {
  UploadCloud,
  FileImage,
  AlertTriangle,
  CheckCircle,
  Activity,
  Sun,
  Sliders,
  Layers,
  Eye,
  ScanSearch,
  Check,
  Search,
  Maximize2,
  Download,
  FileText
} from 'lucide-react';

// Removed Mock Heatmaps - We now get real base64 heatmaps from the Backend

const AIXRayAnalyzer = ({ patientName, doctorName, patientId }) => {
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [heatmaps, setHeatmaps] = useState({});

  // Image Display Controls
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [viewMode, setViewMode] = useState('heatmap'); // 'original' | 'heatmap'
  const [heatmapOpacity, setHeatmapOpacity] = useState(70);
  const [activeCondition, setActiveCondition] = useState(null);
  
  // Doctor Note & PDF
  const [doctorNote, setDoctorNote] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [editablePatientName, setEditablePatientName] = useState("");

  useEffect(() => {
    setEditablePatientName(patientName === "Genel Hasta Analizi" ? "" : patientName || "");
  }, [patientName]);

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file) => {
    if (!file.type.match('image/jpeg') && !file.type.match('image/png') && !file.name.endsWith('.dcm')) {
      alert("Lütfen geçerli bir röntgen resmi yükleyin (JPEG, PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);

    // Reset controls
    setIsProcessing(true);
    setResults(null);
    setHeatmaps({});
    setBrightness(100);
    setContrast(100);
    setActiveCondition(null);
    setViewMode('heatmap');
    setHeatmapOpacity(75);

    // Call Real Backend API
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("API isteği başarısız oldu.");

      const data = await response.json();

      if (data.error) {
        alert("Hata: " + data.error);
        setIsProcessing(false);
        return;
      }

      setResults(data.results);
      setHeatmaps(data.heatmaps || {});
      setActiveCondition(data.results[0].name); // Select top finding automatically
      setViewMode('heatmap');
    } catch (error) {
      console.error("Backend bağlantı hatası:", error);
      alert("API Bağlantı Hatası: Lütfen uvicorn api:app --reload komutuyla backend'in açık olduğundan emin olun.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFocusArea = (condition) => {
    setActiveCondition(condition);
    setViewMode('heatmap');
    setHeatmapOpacity(85);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const topResult = results[0];
      const payload = {
        patient_name: editablePatientName || "İsimsiz Hasta",
        doc_name: doctorName || "Bilinmiyor", // Default or adapt as needed
        notes: doctorNote || "Bulgular incelendi. Klinik verilerle korelasyon önerilir.",
        top_disease: topResult.name,
        top_score: topResult.probability
      };

      const res = await fetch("http://localhost:8000/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Rapor oluşturulamadı.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.target = "_blank";
      a.download = `AI_Rapor_${(editablePatientName || "Hasta").replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);

      if (patientId) {
        try {
          await fetch("http://localhost:8000/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patientId,
              doctor_name: doctorName || "Bilinmiyor",
              disease: topResult.name,
              score: topResult.probability,
              notes: doctorNote || "Bulgular incelendi. Klinik verilerle korelasyon önerilir."
            })
          });
          setTimeout(() => {
            alert("PDF İndirildi ve sonuç hastanın paneline gönderildi!");
          }, 300);
        } catch (e) {
          console.error("Rapor hastaya kaydedilemedi", e);
        }
      }
    } catch (e) {
      alert("Hata: " + e.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getHeatmapStyle = () => {
    if (viewMode !== 'heatmap' || !activeCondition || !heatmaps[activeCondition]) return { opacity: 0 };
    return {
      backgroundImage: `url(${heatmaps[activeCondition]})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: heatmapOpacity / 100,
      mixBlendMode: 'normal',
    };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden w-full flex flex-col font-sans">
      <style>
        {`
          @keyframes scanline {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; text-shadow: 0 0 10px rgba(45,212,191,0.5); }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          .animate-scanline {
            animation: scanline 2.5s cubic-bezier(0.53, 0.21, 0.29, 0.67) infinite;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}
      </style>

      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/10 p-2.5 rounded-lg border border-teal-500/20">
            <Activity className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">AI X-Ray Analizi & Grad-CAM</h2>
            <p className="text-xs text-slate-500 font-medium tracking-wide">YÜKSEK ÇÖZÜNÜRLÜKLÜ RADYOLOJİK İNCELEME</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20">
          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
          <span className="text-sm font-semibold text-slate-700">Hasta:</span>
          <input
            type="text"
            className="text-sm font-semibold text-slate-700 border-none outline-none bg-transparent w-40 placeholder-slate-400 focus:ring-0"
            placeholder="İsim giriniz..."
            value={editablePatientName}
            onChange={(e) => setEditablePatientName(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row p-6 gap-8 bg-white min-h-[600px]">

        {/* LEFT PANEL: Image Interaction Area */}
        <div className="lg:w-[55%] flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileImage className="w-4 h-4 text-teal-500" /> Görüntü Ekranı
          </h3>

          {!imagePreview ? (
            // Upload Zone
            <div
              className={`flex-1 min-h-[400px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all duration-300 ${isDragging ? 'border-teal-500 bg-teal-50/50 scale-[1.02]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-400'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-colors duration-300 ${isDragging ? 'bg-teal-100 text-teal-600' : 'bg-white shadow-sm text-slate-400 border border-slate-100'}`}>
                <UploadCloud className="w-10 h-10" />
              </div>
              <h3 className="font-bold text-xl text-slate-800 mb-2">X-Ray Görüntüsünü Aktarın</h3>
              <p className="text-slate-500 text-sm mb-8 max-w-sm leading-relaxed">
                Radyolojik görüntüyü buraya sürükleyin veya cihazınızdan seçin. Sistem otomatik olarak taramaya başlayacaktır.
              </p>

              <label className="cursor-pointer group">
                <span className="px-8 py-3.5 bg-slate-800 text-white rounded-xl font-semibold shadow-md group-hover:bg-teal-600 transition-all duration-300 flex items-center gap-2 text-sm">
                  <Maximize2 className="w-4 h-4" /> Dosyayı Seçin
                </span>
                <input
                  type="file"
                  accept="image/jpeg, image/png, .dcm"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          ) : (
            // Image Display & Controls
            <div className="flex-col flex">
              <div className="relative bg-slate-900 rounded-2xl overflow-hidden shadow-inner h-[460px] border border-slate-200">
                {/* Image */}
                <img
                  src={imagePreview}
                  alt="Röntgen İncelemesi"
                  className="w-full h-full object-contain transition-all duration-300"
                  style={{
                    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                    opacity: isProcessing ? 0.3 : 1
                  }}
                />

                {/* Heatmap Overlay */}
                {!isProcessing && (
                  <div
                    className="absolute inset-0 pointer-events-none transition-all duration-500"
                    style={getHeatmapStyle()}
                  ></div>
                )}

                {/* Processing Scanning Animation */}
                {isProcessing && (
                  <div className="absolute inset-0 z-20 pointer-events-none rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-teal-900/20 backdrop-blur-[2px]"></div>
                    <div className="w-full h-1 bg-teal-400 shadow-[0_0_20px_rgba(45,212,191,1)] absolute left-0 animate-scanline z-30"></div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center z-40">
                      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col items-center">
                        <ScanSearch className="w-12 h-12 text-teal-400 mb-4 animate-pulse" />
                        <h4 className="font-bold text-lg text-white tracking-wide">Model İnceliyor</h4>
                        <p className="text-xs text-teal-200 mt-1.5 opacity-80">Derin Öğrenme Katmanları Aktif</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Change Image Button */}
                {!isProcessing && (
                  <button
                    onClick={() => { setImagePreview(null); setResults(null); }}
                    className="absolute top-4 right-4 bg-slate-900/60 text-white px-3 py-1.5 rounded-lg backdrop-blur-md hover:bg-slate-800 flex items-center gap-2 text-xs font-semibold border border-white/10 transition-colors"
                  >
                    Görüntüyü Değiştir
                  </button>
                )}

                {/* Active Heatmap Badge */}
                {!isProcessing && viewMode === 'heatmap' && activeCondition && (
                  <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-medium border border-white/10 shadow-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Odak: <span className="font-bold text-teal-300">{activeCondition}</span>
                  </div>
                )}
              </div>

              {/* Enhanced Controls Area */}
              {!isProcessing && (
                <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row gap-5 items-center">

                    {/* View Toggle */}
                    <div className="flex bg-slate-200/50 p-1 rounded-lg w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setViewMode('original')}
                        className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all ${viewMode === 'original'
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1.5" /> Orijinal
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('heatmap')}
                        className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all ${viewMode === 'heatmap'
                            ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                            : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        <Layers className="w-3.5 h-3.5 inline mr-1.5" /> Grad-CAM
                      </button>
                    </div>

                    {/* Sliders */}
                    <div className="flex-1 w-full grid grid-cols-2 gap-6 pl-0 sm:pl-4 sm:border-l border-slate-200">
                      {viewMode === 'heatmap' ? (
                        <div className="col-span-2 flex items-center gap-3 w-full min-w-0">
                          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="flex-1 flex flex-col gap-1 min-w-0 w-full">
                            <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase mb-1 pr-1">
                              <span className="truncate">Opaklık</span>
                              <span className="text-teal-600 ml-2 shrink-0">{heatmapOpacity}%</span>
                            </div>
                            <input
                              type="range" min="0" max="100" value={heatmapOpacity} onChange={(e) => setHeatmapOpacity(e.target.value)}
                              className="w-full accent-teal-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer min-w-0"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0 w-full">
                            <Sun className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex-1 flex flex-col gap-1 min-w-0 w-full">
                              <span className="text-[10px] font-bold text-slate-500 uppercase truncate">Parlaklık</span>
                              <input
                                type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(e.target.value)}
                                className="w-full accent-slate-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer min-w-0"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 min-w-0 w-full">
                            <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex-1 flex flex-col gap-1 min-w-0 w-full">
                              <span className="text-[10px] font-bold text-slate-500 uppercase truncate">Kontrast</span>
                              <input
                                type="range" min="50" max="180" value={contrast} onChange={(e) => setContrast(e.target.value)}
                                className="w-full accent-slate-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer min-w-0"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Analysis Results Area */}
        <div className="lg:w-[45%] flex flex-col bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-500" /> Analiz Raporu
          </h3>

          {(!results && !isProcessing) && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white p-8">
              <ScanSearch className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-center font-medium text-sm text-slate-500">Rapor hazırlamak için görüntü yükleyin.</p>
            </div>
          )}

          {/* Skeletons while processing */}
          {isProcessing && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="h-8 bg-slate-200/60 rounded-lg w-1/2 mb-2 animate-pulse"></div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="h-20 bg-teal-100/40 rounded-xl animate-pulse"></div>
                <div className="h-20 bg-slate-200/50 rounded-xl animate-pulse"></div>
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center bg-white p-3 rounded-xl border border-slate-100/50 shadow-sm animate-pulse">
                  <div className="w-20 h-4 bg-slate-200 rounded"></div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full"></div>
                  <div className="w-8 h-4 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {/* Actual Results */}
          {results && !isProcessing && (
            <div className="flex-1 flex flex-col animate-[fadeIn_0.5s_ease-out]">

              {/* Critical Findings Alert Badge */}
              {results[0].risk === 'critical' && (
                <div className="mb-5 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-red-800 font-bold text-sm">Dikkat: Kritik Bulgular Tespit Edildi</h4>
                    <p className="text-red-600 text-xs mt-1 font-medium">Model yüksek olasılıklı patolojik belirtiler buldu. Lütfen Grad-CAM ile referans bölgelerini doğrulayın.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mb-3 px-1">
                <p className="text-xs font-bold text-slate-400 tracking-wider">TÜM SINIFLANDIRMALAR (14)</p>
                <p className="text-xs font-bold text-slate-400 tracking-wider">SKOR</p>
              </div>

              {/* Scrollable Results List */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[450px]">
                <div className="space-y-2.5">
                  {results.map((res, idx) => (
                    <div
                      key={idx}
                      className={`group relative flex flex-col justify-center p-3.5 rounded-xl border transition-all duration-300 ${res.risk === 'critical'
                          ? 'bg-red-50/40 border-red-100 hover:bg-red-50 hover:shadow-md'
                          : res.risk === 'suspicious'
                            ? 'bg-amber-50/40 border-amber-100'
                            : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          {res.risk === 'critical' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          {res.risk === 'suspicious' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                          {res.risk === 'normal' && <CheckCircle className="w-4 h-4 text-teal-400" />}
                          <span className={`text-sm font-bold tracking-tight ${res.risk === 'critical' ? 'text-red-700' :
                              res.risk === 'suspicious' ? 'text-amber-700' : 'text-slate-600'
                            }`}>
                            {res.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-black ${res.risk === 'critical' ? 'text-red-600' :
                              res.risk === 'suspicious' ? 'text-amber-600' : 'text-slate-500'
                            }`}>
                            %{res.probability.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${res.risk === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                res.risk === 'suspicious' ? 'bg-amber-400' : 'bg-teal-400'
                              }`}
                            style={{ width: `${res.probability}%` }}
                          ></div>
                        </div>

                        {/* Contextual Focus Button for High Risk (Only show if heatmap exists) */}
                        {res.risk === 'critical' && heatmaps[res.name] && (
                          <button
                            type="button"
                            onClick={() => handleFocusArea(res.name)}
                            className="shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Search className="w-3 h-3" /> Odak
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor Note & PDF Download */}
              <div className="mt-4 bg-white border border-slate-200 shadow-sm rounded-xl p-4 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <h4 className="font-bold text-slate-700 text-xs uppercase">Uzman Hekim Notu</h4>
                </div>
                <textarea 
                  className="w-full h-16 p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 mb-3 bg-slate-50 focus:bg-white transition-colors custom-scrollbar resize-none"
                  placeholder="Klinik yorumunuzu veya reçete notlarınızı buraya ekleyin..."
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                ></textarea>
                
                <button 
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                    isGeneratingPdf 
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                      : 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow-md'
                  }`}
                >
                  {isGeneratingPdf ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin" /> Rapor Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> PDF Rapor ve Reçete İndir
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AIXRayAnalyzer;
