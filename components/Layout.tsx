
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Settings, Zap, LucideIcon, PenTool, Grid } from 'lucide-react';

const SidebarItem: React.FC<{ to: string; icon: LucideIcon; label: string }> = ({ to, icon: Icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium group border ${
          isActive
            ? 'bg-primary/10 text-primary border-primary/20 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border-transparent hover:border-white/5'
        }`
      }
    >
      <Icon className="w-4 h-4" />
      {label}
    </NavLink>
  );
};

const Layout: React.FC = () => {
  return (
    <div className="flex h-screen bg-background text-text overflow-hidden bg-dot-pattern">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-primary shadow-inner">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">OmniFlow</span>
        </div>

        <div className="flex-1 px-4 py-2 space-y-1.5">
          <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Workspace</div>
          <SidebarItem to="/" icon={Grid} label="应用库 (App Library)" />
          <SidebarItem to="/apps" icon={PenTool} label="配置应用 (Config)" />
        </div>

        <div className="px-4 py-4 space-y-1">
            <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">System</div>
            <SidebarItem to="/settings" icon={Settings} label="设置 (Settings)" />
        </div>

        <div className="p-4 border-t border-white/5 bg-white/5">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-2 font-mono">
                <span>v0.4.0</span>
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
