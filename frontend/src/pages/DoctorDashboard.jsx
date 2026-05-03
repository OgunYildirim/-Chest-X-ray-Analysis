import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AIXRayAnalyzer from '../components/AIXRayAnalyzer';
import SettingsComponent from '../components/Settings';
import { Search, Bell, Menu, FileText, ArrowRight, UserPlus, FileSearch, Stethoscope, LogOut, Users, Calendar, Image as ImageIcon, Filter } from 'lucide-react';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState('Tümü');
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if(parsedUser.role !== 'doctor') {
      navigate('/login');
      return;
    }
    setUser(parsedUser);
    fetchAppointments(parsedUser.id);
    fetchNotifications(parsedUser.id);
  }, [navigate]);

  const fetchNotifications = async (userId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/notifications?user_id=${userId}`);
      const data = await res.json();
      setNotifications(data);
    } catch (err) {}
  };

  const markAsRead = async (notifId) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/notifications/${notifId}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {}
  };

  const fetchAppointments = async (userId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/appointments?user_id=${userId}&role=doctor`);
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error("Randevular çekilemedi", err);
    }
  };

  const updateAppointmentStatus = async (appId, newStatus) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/appointments/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if(res.ok) {
        fetchAppointments(user.id);
      }
    } catch (err) {
      console.error("Durum güncellenemedi", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const StatCard = ({ title, value, subtitle, colorClass }) => (
    <div className="card-glass p-6">
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-textMain">{value}</span>
        <span className={`text-xs font-semibold mb-1 ${colorClass}`}>{subtitle}</span>
      </div>
    </div>
  );

  const todayCount = appointments.filter(a => {
      const appDate = new Date(a.time).toDateString();
      const today = new Date().toDateString();
      return appDate === today;
  }).length;

  const pendingCount = appointments.filter(a => a.status === 'Bekliyor').length;
  const completedCount = appointments.filter(a => a.status === 'Tamamlandı').length;

  // Patients logic
  const uniquePatients = Array.from(new Set(appointments.map(a => a.patient_id)))
    .map(id => {
      const patientApps = appointments.filter(a => a.patient_id === id);
      const latestApp = patientApps.reduce((latest, current) => new Date(latest.time) > new Date(current.time) ? latest : current);
      return {
        id,
        name: latestApp.patient,
        lastVisit: latestApp.time,
        totalVisits: patientApps.length
      };
    });

  // Appointments logic
  const filteredAppointments = appointmentFilter === 'Tümü' 
    ? appointments 
    : appointments.filter(a => a.status === appointmentFilter);

  return (
    <div className="flex h-screen bg-secondary overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Hasta, TC veya Randevu Ara..."
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-gray-400 hover:text-primary transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Bildirimler</h3>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">
                        {notifications.filter(n => !n.is_read).length} Yeni
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">Hiç bildiriminiz yok.</div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => !notif.is_read && markAsRead(notif.id)}
                          className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-blue-50/40' : 'opacity-60'}`}
                        >
                          <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(notif.date).toLocaleString('tr-TR')}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-textMain">{user?.name}</p>
                <p className="text-xs text-gray-500">Göğüs Hastalıkları Uzmanı</p>
              </div>
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                {user?.name.charAt(0)}
              </div>
              <button onClick={handleLogout} className="ml-2 text-gray-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-8">

          <div className="mb-8 block">
            <h1 className="text-2xl font-bold text-textMain">Hoş Geldiniz, {user?.name}</h1>
            <p className="text-gray-500 text-sm mt-1">İşte kliniğinizin özeti.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Bugünkü Randevular" value={todayCount.toString()} subtitle="Toplam" colorClass="text-green-500" />
            <StatCard title="Bekleyen Hastalar" value={pendingCount.toString()} subtitle="Bekliyor" colorClass="text-orange-500" />
            <StatCard title="Tamamlanan" value={completedCount.toString()} subtitle="Başarılı" colorClass="text-blue-500" />
            <StatCard title="AI Analiz" value="Aktif" subtitle="Hazır" colorClass="text-emerald-500" />
          </div>

          {/* Charts & Activity Row */}
          {activeTab === 'summary' && (() => {
            // Build last-7-days bar chart data
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              return d;
            });
            const dayLabels = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
            const barData = days.map(d => ({
              label: dayLabels[d.getDay() === 0 ? 6 : d.getDay() - 1],
              count: appointments.filter(a => new Date(a.time).toDateString() === d.toDateString()).length
            }));
            const maxBar = Math.max(...barData.map(b => b.count), 1);

            // Activity timeline: last 5 appointments sorted by time desc
            const recentActivity = [...appointments]
              .sort((a, b) => new Date(b.time) - new Date(a.time))
              .slice(0, 5);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Bar Chart */}
                <div className="card-glass p-6">
                  <h3 className="font-semibold text-textMain mb-1">Haftalık Randevu Yoğunluğu</h3>
                  <p className="text-xs text-gray-400 mb-5">Son 7 gün</p>
                  <div className="flex items-end gap-2 h-28">
                    {barData.map((bar, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-primary">{bar.count > 0 ? bar.count : ''}</span>
                        <div
                          className="w-full rounded-t-md bg-primary/80 transition-all duration-700"
                          style={{ height: `${(bar.count / maxBar) * 88}px`, minHeight: bar.count > 0 ? '8px' : '2px', opacity: bar.count > 0 ? 1 : 0.15 }}
                        />
                        <span className="text-[10px] text-gray-400 font-medium">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="card-glass p-6">
                  <h3 className="font-semibold text-textMain mb-1">Son Aktiviteler</h3>
                  <p className="text-xs text-gray-400 mb-4">En son randevular</p>
                  <div className="space-y-3">
                    {recentActivity.length === 0 ? (
                      <p className="text-sm text-gray-400">Henüz aktivite yok.</p>
                    ) : recentActivity.map((apt, i) => (
                      <div key={apt.id} className="flex items-center gap-3">
                        <div className="relative flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            apt.status === 'Tamamlandı' ? 'bg-green-500' :
                            apt.status === 'Onaylanıdı' ? 'bg-blue-500' :
                            apt.status === 'Bekliyor' ? 'bg-orange-400' : 'bg-gray-400'
                          }`} />
                          {i < recentActivity.length - 1 && <div className="w-px h-full bg-gray-100 mt-1"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{apt.patient}</p>
                          <p className="text-xs text-gray-400">{new Date(apt.time).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })} &bull; <span className="font-medium">{apt.status}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Content Area */}
          {activeTab === 'settings' && (
            <SettingsComponent user={user} onUserUpdate={handleUserUpdate} />
          )}

          {activeTab === 'summary' && (
            <div className="flex gap-8 items-start h-full pb-10 animate-[fadeIn_0.3s_ease-out]">
              {/* Appointments Table */}
              <div className={`card-glass p-0 overflow-hidden flex-1 transition-all duration-300 ${selectedPatient ? 'hidden lg:block lg:flex-none lg:w-1/3' : 'w-full'}`}>
                <div className="p-6 border-b border-gray-100 bg-white">
                  <h2 className="font-semibold text-lg text-textMain">Yaklaşan Randevular</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="p-4 font-medium">Zaman</th>
                        <th className="p-4 font-medium">Hasta</th>
                        <th className="p-4 font-medium">Durum</th>
                        <th className="p-4 text-right font-medium">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {appointments.slice(0, 5).map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 text-sm font-medium text-gray-900">
                            {new Date(apt.time).toLocaleString('tr-TR', { month: 'short', day:'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 text-sm">
                            <p className="font-medium text-textMain">{apt.patient}</p>
                            <p className="text-xs text-gray-500">{apt.type}</p>
                          </td>
                          <td className="p-4 text-sm">
                            <select 
                              value={apt.status} 
                              onChange={(e) => updateAppointmentStatus(apt.id, e.target.value)}
                              className={`px-2 py-1 rounded-full text-xs font-semibold outline-none cursor-pointer ${
                                apt.status === 'Bekliyor' ? 'bg-orange-100 text-orange-700' :
                                apt.status === 'Onaylandı' ? 'bg-blue-100 text-blue-700' :
                                apt.status === 'Tamamlandı' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <option value="Bekliyor">Bekliyor</option>
                              <option value="Onaylandı">Onaylandı</option>
                              <option value="Muayenede">Muayenede</option>
                              <option value="Tamamlandı">Tamamlandı</option>
                              <option value="İptal">İptal</option>
                            </select>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedPatient(apt)}
                              className="bg-primary/10 text-primary p-2 rounded-lg hover:bg-primary hover:text-white transition-colors"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {appointments.length === 0 && (
                        <tr>
                          <td colSpan="4" className="p-4 text-center text-gray-500 text-sm">Hiç randevu bulunmamaktadır.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {appointments.length > 5 && (
                    <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                      <button onClick={() => setActiveTab('appointments')} className="text-sm font-medium text-primary hover:underline">Tümünü Gör</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Detail / AI Panel */}
              {selectedPatient && (
                <div className="flex-[2] card-glass rounded-2xl flex flex-col h-auto min-h-[600px] animate-[fadeIn_0.3s_ease-out]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-primary">
                        {selectedPatient.patient.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-textMain">{selectedPatient.patient}</h2>
                        <p className="text-sm text-gray-500">Tarih: {new Date(selectedPatient.time).toLocaleDateString('tr-TR')}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
                      Kapat ✕
                    </button>
                  </div>

                  <div className="p-6 space-y-6 bg-gray-50/30 flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg text-blue-600"><FileText className="w-6 h-6" /></div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Önceki Teşhisler</p>
                          <p className="text-sm mt-1 text-textMain font-medium">Bilinmiyor</p>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4">
                        <div className="bg-orange-50 p-3 rounded-lg text-orange-600"><Stethoscope className="w-6 h-6" /></div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Kullanılan İlaçlar</p>
                          <p className="text-sm mt-1 text-textMain font-medium">Kayıt Yok</p>
                        </div>
                      </div>
                    </div>
                    <AIXRayAnalyzer patientName={selectedPatient.patient} doctorName={user?.name} patientId={selectedPatient.patient_id} />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Hastalarım
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Kayıtlı hastalarınızın listesi ve özet bilgileri.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {uniquePatients.map(p => (
                  <div key={p.id} className="card-glass p-6 hover:shadow-lg transition-shadow bg-white rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-textMain text-lg">{p.name}</h3>
                        <p className="text-sm text-gray-500">Hasta ID: #{p.id}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4 pt-4 border-t border-gray-50">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Son Ziyaret:</span>
                        <span className="font-medium text-gray-900">{new Date(p.lastVisit).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Toplam Randevu:</span>
                        <span className="font-medium text-gray-900">{p.totalVisits}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveTab('appointments');
                        // In a real app, we might set a filter here
                      }}
                      className="mt-6 w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Geçmişi Gör
                    </button>
                  </div>
                ))}
                {uniquePatients.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    Henüz kayıtlı hastanız bulunmuyor.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-primary" />
                    Tüm Randevular
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Geçmiş ve gelecek tüm randevularınızı yönetin.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
                  <Filter className="w-4 h-4 text-gray-400 ml-2" />
                  <select 
                    value={appointmentFilter} 
                    onChange={(e) => setAppointmentFilter(e.target.value)}
                    className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer text-gray-700 py-1"
                  >
                    <option value="Tümü">Tümü</option>
                    <option value="Bekliyor">Bekleyenler</option>
                    <option value="Onaylandı">Onaylananlar</option>
                    <option value="Tamamlandı">Tamamlananlar</option>
                    <option value="İptal">İptal Edilenler</option>
                  </select>
                </div>
              </div>

              <div className="card-glass bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="p-4 font-medium">Zaman</th>
                        <th className="p-4 font-medium">Hasta</th>
                        <th className="p-4 font-medium">Tip</th>
                        <th className="p-4 font-medium">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAppointments.map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 text-sm font-medium text-gray-900">
                            {new Date(apt.time).toLocaleString('tr-TR', { weekday: 'long', month: 'long', day:'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 text-sm">
                            <p className="font-medium text-textMain">{apt.patient}</p>
                          </td>
                          <td className="p-4 text-sm text-gray-500">
                            {apt.type}
                          </td>
                          <td className="p-4 text-sm">
                            <select 
                              value={apt.status} 
                              onChange={(e) => updateAppointmentStatus(apt.id, e.target.value)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold outline-none cursor-pointer ${
                                apt.status === 'Bekliyor' ? 'bg-orange-100 text-orange-700' :
                                apt.status === 'Onaylandı' ? 'bg-blue-100 text-blue-700' :
                                apt.status === 'Tamamlandı' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <option value="Bekliyor">Bekliyor</option>
                              <option value="Onaylandı">Onaylandı</option>
                              <option value="Muayenede">Muayenede</option>
                              <option value="Tamamlandı">Tamamlandı</option>
                              <option value="İptal">İptal</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {filteredAppointments.length === 0 && (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-gray-500 text-sm">
                            Bu filtreye uygun randevu bulunamadı.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'imaging' && (
            <div className="animate-[fadeIn_0.3s_ease-out] flex flex-col h-full">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-primary" />
                  Serbest Tıbbi Görüntüleme
                </h2>
                <p className="text-sm text-gray-500 mt-1">Belirli bir randevuya bağlı kalmadan anında yapay zeka analizini çalıştırın.</p>
              </div>
              <div className="card-glass p-8 rounded-2xl bg-white shadow-sm border border-gray-100 flex-1 flex flex-col">
                <AIXRayAnalyzer patientName="Genel Hasta Analizi" doctorName={user?.name} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
