import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, FileText, Download, Activity, User, LogOut, ChevronRight, CheckCircle2, X, Settings as SettingsIcon, Bell } from 'lucide-react';
import SettingsComponent from '../components/Settings';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  
  const [showSettings, setShowSettings] = useState(false);

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if(parsedUser.role !== 'patient') {
      navigate('/login');
      return;
    }
    setUser(parsedUser);
    fetchAppointments(parsedUser.id);
    fetchReports(parsedUser.id);
    fetchNotifications(parsedUser.id);
    fetchDoctors();
  }, [navigate]);

  const fetchAppointments = async (userId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/appointments?user_id=${userId}&role=patient`);
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error("Randevular çekilemedi", err);
    }
  };

  const fetchNotifications = async (userId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/notifications?user_id=${userId}`);
      const data = await res.json();
      setNotifications(data);
    } catch (err) {
      console.error("Bildirimler çekilemedi", err);
    }
  };

  const fetchReports = async (userId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/reports?patient_id=${userId}`);
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Raporlar çekilemedi", err);
    }
  };

  const markAsRead = async (notifId) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/notifications/${notifId}/read`, { method: 'PUT' });
      setNotifications(notifications.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {}
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/doctors`);
      const data = await res.json();
      setDoctors(data);
      if(data.length > 0) setSelectedDoctorId(data[0].id);
    } catch (err) {
      console.error("Doktorlar çekilemedi", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: parseInt(selectedDoctorId),
          patient_id: user.id,
          time: `${appointmentDate} ${appointmentTime}`,
          type: 'Kontrol'
        })
      });
      if(res.ok) {
        setIsModalOpen(false);
        fetchAppointments(user.id);
      }
    } catch (err) {
      console.error("Randevu oluşturulamadı", err);
    }
  };

  const handleDownloadReport = async (report) => {
    try {
      const payload = {
        patient_name: user.name,
        doc_name: report.doctor_name,
        notes: report.notes,
        top_disease: report.disease,
        top_score: report.score
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
      a.download = `AI_Rapor_${user.name.replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_')}_${report.date.split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      alert("Hata: " + e.message);
    }
  };

  // Find next appointment
  const nextAppointment = appointments.find(a => new Date(a.time) >= new Date()) || appointments[0];

  return (
    <div className="min-h-screen bg-secondary pb-12">
      {/* Patient Header */}
      <header className="bg-primary pt-8 pb-32 px-6 lg:px-12 rounded-b-[40px] shadow-lg relative z-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                <Activity className="w-8 h-8" />
              </div>
              <span className="text-xl font-bold tracking-tight">Klinik AI Hasta</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-white/10 px-3 py-2 rounded-full backdrop-blur-md"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-primary"></span>
                  )}
                </button>
                
                {isNotifOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800">Bildirimler</h3>
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">{notifications.filter(n => !n.is_read).length} Yeni</span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">Hiç bildiriminiz yok.</div>
                      ) : (
                        notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                            className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${!notif.is_read ? 'bg-blue-50/30' : 'opacity-70'}`}
                          >
                            <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.date).toLocaleString('tr-TR')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-white/10 px-4 py-2 rounded-full backdrop-blur-md"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="font-medium text-sm">{showSettings ? 'Geri Dön' : 'Ayarlar'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-white/10 px-4 py-2 rounded-full backdrop-blur-md"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium text-sm">Çıkış Yap</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-primary border-4 border-white/20 shadow-xl overflow-hidden font-bold text-2xl">
              {user?.name.charAt(0)}
            </div>
            <div className="text-white">
              <h1 className="text-3xl font-bold">Merhaba, {user?.name}</h1>
              <p className="text-primary-light mt-1 text-lg">Sağlıklı günler dileriz.</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 lg:px-12 -mt-20 relative z-10">

        {showSettings ? (
          <SettingsComponent user={user} onUserUpdate={handleUserUpdate} />
        ) : (
          <>
            {/* Next Appointment Banner */}
        {nextAppointment ? (
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-2xl transition-shadow group mb-8">
            <div className="flex items-center gap-6">
              <div className="bg-blue-50 w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-primary">
                <span className="text-sm font-bold uppercase tracking-wider">
                  {new Date(nextAppointment.time).toLocaleString('tr-TR', { month: 'short' })}
                </span>
                <span className="text-2xl font-black">
                  {new Date(nextAppointment.time).getDate()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {new Date(nextAppointment.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <h3 className="text-xl font-bold text-textMain">{nextAppointment.type}</h3>
                <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                  <User className="w-4 h-4" /> {nextAppointment.doctor_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                nextAppointment.status === 'Onaylandı' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {nextAppointment.status === 'Onaylandı' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />} {nextAppointment.status}
              </span>
            </div>
          </div>
        ) : (
           <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 mb-8 text-center text-gray-500">
             Şu an için yaklaşan bir randevunuz bulunmamaktadır.
           </div>
        )}

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Card 1: Book Appointment */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-textMain mb-2">Yeni Randevu Al</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">Uzman doktorlarımızdan kendiniz için uygun tarih ve saatte randevu oluşturun.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 bg-gray-50 text-primary font-semibold rounded-xl border border-gray-200 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors"
            >
              Randevu Oluştur
            </button>
          </div>

          {/* Card 2: Past Visits & Prescriptions */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-textMain mb-2">Geçmiş Ziyaretlerim</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">Önceki hastane ziyaretlerinizin özetini ve reçete detaylarınızı görüntüleyin.</p>
            </div>
            <button className="w-full py-3 bg-gray-50 text-amber-600 font-semibold rounded-xl border border-gray-200 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-colors">
              Ziyaretleri Gör
            </button>
          </div>

          {/* Card 3: Test & AI Results */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-6 right-6 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
            <div>
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-6 group-hover:scale-110 transition-transform">
                <Activity className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-textMain mb-2">Test ve Radyoloji</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">AI destekli tarama analizlerinizi ve laboratuvar sonuçlarınızı inceleyin.</p>
            </div>
            <button 
              onClick={() => setIsReportsModalOpen(true)}
              className="w-full py-3 bg-emerald-50 text-emerald-700 font-semibold rounded-xl border border-emerald-100 flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Raporlarımı Gör
            </button>
          </div>

        </div>
        </>
        )}
      </div>

      {/* Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-[fadeIn_0.3s_ease-out]">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-textMain mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              Randevu Oluştur
            </h2>
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doktor Seçimi</label>
                <select 
                  value={selectedDoctorId} 
                  onChange={e => setSelectedDoctorId(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  required
                >
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                  <input 
                    type="date" 
                    value={appointmentDate}
                    onChange={e => setAppointmentDate(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                  <input 
                    type="time" 
                    value={appointmentTime}
                    onChange={e => setAppointmentTime(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-6 hover:bg-primary-dark transition-colors">
                Randevuyu Kaydet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {isReportsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative animate-[fadeIn_0.3s_ease-out] flex flex-col max-h-[80vh]">
            <button onClick={() => setIsReportsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-textMain mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              Radyoloji Raporlarım
            </h2>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
              {reports.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Henüz kayıtlı bir raporunuz bulunmuyor.</div>
              ) : (
                <div className="space-y-4">
                  {reports.map((rep) => (
                    <div key={rep.id} className="border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 hover:shadow-md transition-shadow bg-gray-50/50">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-800">{new Date(rep.date).toLocaleDateString('tr-TR')}</span>
                          <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded-full">{rep.doctor_name}</span>
                        </div>
                        <p className="text-emerald-700 font-semibold">{rep.disease} <span className="text-xs text-emerald-600/70">(%{(rep.score).toFixed(1)})</span></p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{rep.notes}</p>
                      </div>
                      <button 
                        onClick={() => handleDownloadReport(rep)}
                        className="shrink-0 bg-white border border-gray-200 text-gray-700 hover:text-emerald-600 hover:border-emerald-200 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                      >
                        <Download className="w-4 h-4" /> PDF İndir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PatientDashboard;
