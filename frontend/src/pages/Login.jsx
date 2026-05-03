import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User, Lock, Mail, Activity, LogIn, UserPlus } from 'lucide-react';

const Login = () => {
  const [role, setRole] = useState('doctor'); // 'doctor' or 'patient'
  const [isLogin, setIsLogin] = useState(true); // true = Login, false = Register
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setName('');
    setEmail('');
    setPassword('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? 'http://127.0.0.1:8000/api/auth/login' : 'http://127.0.0.1:8000/api/auth/register';
    const payload = isLogin ? { email, password, role } : { name, email, password, role };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Bir hata oluştu');
      }

      // Başarılı
      localStorage.setItem('user', JSON.stringify(data));
      
      if (data.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else {
        navigate('/patient-dashboard');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br ${
      role === 'doctor' ? 'from-secondary to-blue-50' : 'from-secondary to-emerald-50'
    }`}>
      
      {/* Background Decorative Elements */}
      <div className={`absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full blur-3xl ${
        role === 'doctor' ? 'bg-primary/10' : 'bg-emerald-500/10'
      }`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full blur-3xl ${
        role === 'doctor' ? 'bg-blue-300/20' : 'bg-emerald-300/20'
      }`}></div>

      <div className="w-full max-w-md card-glass p-8 relative z-10 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Logo / Icon Area */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Activity className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textMain tracking-tight">Klinik Yönetim Sistemi</h2>
          <p className="text-sm text-gray-500 mt-1">Lütfen devam etmek için rolünüzü seçin</p>
        </div>

        {/* Toggle Role */}
        <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
          <button
            type="button"
            onClick={() => handleRoleChange('doctor')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition-all duration-300 ${
              role === 'doctor' 
                ? 'bg-white text-primary shadow-sm ring-1 ring-primary/20 scale-105' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Stethoscope className={`w-4 h-4 ${role === 'doctor' ? 'text-primary' : ''}`} />
            Doktor
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('patient')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium text-sm transition-all duration-300 ${
              role === 'patient' 
                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-600/20 scale-105' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className={`w-4 h-4 ${role === 'patient' ? 'text-emerald-600' : ''}`} />
            Hasta
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}

          {!isLogin && (
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
                  placeholder="Adınız Soyadınız"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 ml-1">
              {role === 'doctor' ? 'Kurumsal E-posta' : 'E-posta veya TC Kimlik No'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {role === 'doctor' ? (
                  <Mail className="h-5 w-5 text-gray-400" />
                ) : (
                  <User className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <input
                type={role === 'doctor' ? 'email' : 'text'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                placeholder={role === 'doctor' ? 'dr.isim@klinik.com' : 'E-posta adresiniz'}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 ml-1">Şifre</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {isLogin && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center">
                <input type="checkbox" id="remember" className="h-4 w-4 text-primary focus:ring-primary/20 border-gray-300 rounded" />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-600">
                  Beni hatırla
                </label>
              </div>
              <a href="#" className="text-sm font-medium text-primary hover:text-primary-light transition-colors">
                Şifremi Unuttum
              </a>
            </div>
          )}

          <button 
            type="submit" 
            className={`mt-6 flex items-center justify-center gap-2 group w-full py-3 rounded-lg font-medium shadow transition ${
               role === 'doctor' ? 'bg-primary hover:bg-primary-dark text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
            {isLogin ? <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> : <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button" 
            onClick={() => {
                setIsLogin(!isLogin);
                setError('');
            }} 
            className={`text-sm hover:underline transition-colors font-medium ${
                role === 'doctor' ? 'text-primary hover:text-primary-dark' : 'text-emerald-600 hover:text-emerald-700'
            }`}
          >
            {isLogin ? "Hesabınız yok mu? Kayıt olun." : "Zaten hesabınız var mı? Giriş yapın."}
          </button>
        </div>
        
        {/* Footer info dummy */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Güvenli bağlantı sağlanmaktadır. Verileriniz KVKK kapsamında korunmaktadır.
        </div>
      </div>
    </div>
  );
};

export default Login;
