import React, { useState } from 'react';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const Settings = ({ user, onUserUpdate }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if(res.ok) {
        setProfileMsg({ type: 'success', text: 'Profil başarıyla güncellendi.' });
        onUserUpdate(data);
      } else {
        setProfileMsg({ type: 'error', text: data.detail || 'Güncelleme başarısız.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: 'Bir hata oluştu.' });
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });
    if(newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Yeni şifreler eşleşmiyor.' });
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/${user.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      const data = await res.json();
      if(res.ok) {
        setPasswordMsg({ type: 'success', text: 'Şifre başarıyla güncellendi.' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: data.detail || 'Şifre güncellenemedi.' });
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: 'Bir hata oluştu.' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-8 block">
        <h1 className="text-2xl font-bold text-textMain">Ayarlar</h1>
        <p className="text-gray-500 text-sm mt-1">Hesap bilgilerinizi ve güvenlik ayarlarınızı buradan yönetin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Profile Settings */}
        <div className="card-glass p-8 rounded-2xl bg-white shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profil Bilgileri
          </h2>
          
          {profileMsg.text && (
            <div className={`p-4 rounded-xl mb-6 flex items-center gap-2 text-sm font-medium ${profileMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {profileMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleProfileUpdate} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">Ad Soyad</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">E-posta Adresi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <button type="submit" className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium shadow transition bg-primary hover:bg-primary-dark text-white">
              <Save className="w-4 h-4" />
              Bilgileri Güncelle
            </button>
          </form>
        </div>

        {/* Security Settings */}
        <div className="card-glass p-8 rounded-2xl bg-white shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" />
            Şifre ve Güvenlik
          </h2>

          {passwordMsg.text && (
            <div className={`p-4 rounded-xl mb-6 flex items-center gap-2 text-sm font-medium ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {passwordMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">Mevcut Şifre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">Yeni Şifre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 ml-1">Yeni Şifre (Tekrar)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <button type="submit" className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium shadow transition bg-orange-500 hover:bg-orange-600 text-white">
              <Save className="w-4 h-4" />
              Şifreyi Değiştir
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Settings;
