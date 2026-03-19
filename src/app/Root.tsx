import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Home, Map, Users, CheckSquare, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

export function Root() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/branches', icon: Map, label: 'Branches' },
    { path: '/queue', icon: Users, label: 'Queue' },
    { path: '/pre-check', icon: CheckSquare, label: 'Pre-Check' }
  ];

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-8 font-sans selection:bg-[#E63946] selection:text-white transition-colors duration-300 ${isDark ? 'bg-black' : 'bg-gray-200'}`}>
      <div className={`w-full max-w-[400px] h-[850px] rounded-[3rem] shadow-2xl overflow-hidden relative border-[8px] flex flex-col transition-colors duration-300 ${isDark ? 'bg-[#0D1F35] border-gray-900 ring-4 ring-gray-800' : 'bg-gray-50 border-gray-300 ring-4 ring-gray-400'}`}>
        
        {/* Status Bar */}
        <div className="h-7 w-full flex justify-between items-center px-6 pt-2 z-50 absolute top-0 left-0 right-0 pointer-events-none">
          <span className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>9:41</span>
          <div className="flex gap-1.5 items-center">
             <div className={`w-4 h-3 rounded-[2px] ${isDark ? 'bg-white' : 'bg-gray-900'}`} />
             <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-white' : 'bg-gray-900'}`} />
             <div className={`w-5 h-2.5 rounded-sm border p-[1px] ${isDark ? 'bg-white border-white' : 'bg-gray-900 border-gray-900'}`}>
               <div className={`w-3/4 h-full rounded-sm ${isDark ? 'bg-white' : 'bg-gray-900'}`} />
             </div>
          </div>
        </div>

        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-full z-50 pointer-events-none" />

        {/* Theme Toggle Button (Floating) */}
        <button 
          onClick={toggleTheme}
          className={`absolute bottom-24 right-6 z-50 p-3 rounded-full border shadow-xl transition-colors ${isDark ? 'bg-[#162A45] border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-100'}`}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 relative scrollbar-hide pt-16">
          <Outlet />
        </div>

        {/* Bottom Nav */}
        <div className={`absolute bottom-0 w-full backdrop-blur-xl border-t pb-8 pt-4 px-6 flex justify-between items-center z-50 transition-colors duration-300 ${isDark ? 'bg-[#0D1F35]/95 border-white/5' : 'bg-white/95 border-gray-200'}`}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button 
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1.5 group flex-1"
              >
                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-[#E63946]/15' : isDark ? 'group-hover:bg-white/5' : 'group-hover:bg-gray-100'}`}>
                  <Icon size={22} className={isActive ? 'text-[#E63946]' : isDark ? 'text-blue-200/40 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-900'} />
                </div>
                <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-[#E63946]' : isDark ? 'text-blue-200/40 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-900'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}} />
    </div>
  );
}