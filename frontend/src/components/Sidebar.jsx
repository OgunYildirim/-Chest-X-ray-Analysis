import React from 'react';
import { Home, Users, Calendar, Image as ImageIcon, Settings, LogOut, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { name: 'Özet', icon: Home, id: 'summary' },
  { name: 'Hastalarım', icon: Users, id: 'patients' },
  { name: 'Randevular', icon: Calendar, id: 'appointments' },
  { name: 'Tıbbi Görüntüleme', icon: ImageIcon, id: 'imaging' }
];

const Sidebar = ({ activeTab, setActiveTab }) => {
  const navigate = useNavigate();

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen hidden md:flex flex-col sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-gray-100">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Activity className="w-6 h-6 text-primary" />
        </div>
        <span className="font-bold text-lg text-textMain tracking-tight">Klinik AI</span>
      </div>

      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ana Menü</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-textMain'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{item.name}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-100 space-y-2">
        <button 
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
            activeTab === 'settings' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-500 hover:bg-gray-50 hover:text-textMain'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>Ayarlar</span>
        </button>
        <button 
          onClick={() => navigate('/login')}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
