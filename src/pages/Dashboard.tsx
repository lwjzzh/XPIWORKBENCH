import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Box, Clock, RefreshCw, PenTool, Search, LayoutGrid, List, MessageSquare, MonitorPlay, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Badge, Button, Modal } from '../components/ui/Common';
import { App, AppRunMode } from '../types/schema';

const Dashboard: React.FC = () => {
  const { apps, isLoading, loadApps } = useAppStore();
  const navigate = useNavigate();

  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAppForRun, setSelectedAppForRun] = useState<App | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  // Filter and Sort
  const filteredApps = useMemo(() => {
      let result = apps;
      
      // Search
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(a => 
              a.name.toLowerCase().includes(q) || 
              a.description?.toLowerCase().includes(q)
          );
      }

      // Sort: Newest first (Removed Pin sorting)
      result = [...result].sort((a, b) => {
          return b.updatedAt - a.updatedAt;
      });

      return result;
  }, [apps, searchQuery]);

  const handleAppClick = (app: App) => {
      setSelectedAppForRun(app);
  };

  const confirmRun = (mode: AppRunMode) => {
      if (selectedAppForRun) {
          navigate(`/run/${selectedAppForRun.id}?mode=${mode}`);
          setSelectedAppForRun(null);
      }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
  };

  if (isLoading) {
      return (
          <div className="flex h-screen items-center justify-center text-zinc-500 gap-3 bg-background bg-dot-pattern">
              <div className="relative">
                 <div className="w-12 h-12 rounded-xl bg-primary/20 animate-ping absolute inset-0"></div>
                 <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center relative border border-primary/50">
                    <Zap className="w-6 h-6 text-primary" />
                 </div>
              </div>
              <span className="font-mono text-sm tracking-wider">LOADING...</span>
          </div>
      );
  }

  return (
    <div className="h-full w-full bg-background bg-dot-pattern flex flex-col overflow-hidden">
      
      {/* Header & Toolbar */}
      <div className="shrink-0 px-8 py-6 flex flex-col md:flex-row md:items-end justify-between gap-6 z-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">应用库</h1>
          <p className="text-zinc-400 text-sm">选择并运行您的自动化应用。</p>
        </div>
        
        <div className="flex items-center gap-3 p-1 rounded-2xl glass-panel shadow-2xl">
             <div className="relative group">
                 <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                 <input 
                    type="text" 
                    placeholder="搜索应用..." 
                    className="w-64 h-10 pl-10 pr-4 rounded-xl bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:bg-white/5 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
             </div>
             <div className="w-px h-6 bg-white/10 mx-1"></div>
             <div className="flex gap-1 pr-1">
                 <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                    title="网格视图"
                 >
                     <LayoutGrid className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                    title="列表视图"
                 >
                     <List className="w-4 h-4" />
                 </button>
             </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-10 custom-scrollbar">
          {filteredApps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center -mt-20">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_30px_-5px_rgba(0,0,0,0.5)]">
                <Box className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{apps.length === 0 ? '暂无应用' : '未找到匹配应用'}</h3>
              <p className="text-zinc-500 mb-8 max-w-xs text-center leading-relaxed">
                  {apps.length === 0 ? '您的应用库是空的。前往配置页面创建一个新应用。' : '尝试使用不同的关键词搜索。'}
              </p>
              {apps.length === 0 && (
                <Button onClick={() => navigate('/apps')} variant="primary" icon={PenTool} className="rounded-full px-8">
                    创建应用
                </Button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
              {filteredApps.map((app) => (
                viewMode === 'grid' ? (
                    // GRID CARD
                    <div 
                        key={app.id} 
                        className="group relative flex flex-col h-[220px] glass-panel rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border-white/5 hover:border-primary/30"
                        onClick={() => handleAppClick(app)}
                    >
                        {/* Card Bg Gradient Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        {/* Content */}
                        <div className="flex-1 p-6 relative z-10 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:border-primary/30 transition-all shadow-inner">
                                        <Box className="w-6 h-6" />
                                    </div>
                                    <Badge variant="outline" className="bg-black/20 backdrop-blur-sm border-white/5 text-[10px] uppercase tracking-wider">
                                        {app.runMode}
                                    </Badge>
                            </div>
                            
                            <h3 className="text-lg font-bold text-zinc-100 mb-2 truncate group-hover:text-primary transition-colors">{app.name}</h3>
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                                {app.description || "暂无描述..."}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between mt-auto relative z-10 group-hover:bg-primary/5 transition-colors">
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                                <Clock className="w-3 h-3" />
                                {formatDate(app.updatedAt)}
                            </div>
                            
                            <div className="flex items-center gap-1 text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                RUN APP <Play className="w-3 h-3 ml-1 fill-current" />
                            </div>
                        </div>
                    </div>
                ) : (
                    // LIST ITEM
                    <div 
                        key={app.id} 
                        className="group flex items-center gap-6 p-4 rounded-xl glass-panel hover:bg-white/5 cursor-pointer transition-all hover:border-primary/30"
                        onClick={() => handleAppClick(app)}
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors shrink-0">
                            <Box className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-zinc-200 truncate group-hover:text-primary transition-colors">{app.name}</h3>
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{app.description || "暂无描述..."}</p>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                            <Badge variant="outline" className="bg-black/20 border-white/5 font-mono text-[10px] uppercase">{app.runMode}</Badge>
                            <span className="text-xs text-zinc-600 font-mono hidden md:block">{formatDate(app.updatedAt)}</span>
                            
                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" icon={Play} onClick={(e) => { e.stopPropagation(); handleAppClick(app); }} className="rounded-full">运行</Button>
                            </div>
                        </div>
                    </div>
                )
              ))}
            </div>
          )}
      </div>

      {/* Run Mode Selection Modal */}
      <Modal
          isOpen={!!selectedAppForRun}
          onClose={() => setSelectedAppForRun(null)}
          title="启动模式 (Launch Mode)"
          width="md"
      >
          <div className="flex flex-col gap-6 p-2">
             <div className="text-center">
                 <h3 className="text-xl font-bold text-white mb-2">{selectedAppForRun?.name}</h3>
                 <p className="text-sm text-zinc-400">请选择以哪种界面模式运行此应用。</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <button
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl glass-panel hover:bg-white/5 hover:border-primary/50 transition-all group active:scale-95"
                    onClick={() => confirmRun('panel')}
                 >
                     <div className="p-4 rounded-full bg-black/40 group-hover:bg-primary/20 text-zinc-400 group-hover:text-primary transition-colors border border-white/5">
                         <MonitorPlay className="w-8 h-8" />
                     </div>
                     <div className="text-center">
                         <div className="font-bold text-zinc-200 mb-1">传统面板</div>
                         <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Panel Mode</div>
                     </div>
                 </button>

                 <button
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl glass-panel hover:bg-white/5 hover:border-primary/50 transition-all group active:scale-95"
                    onClick={() => confirmRun('chat')}
                 >
                     <div className="p-4 rounded-full bg-black/40 group-hover:bg-primary/20 text-zinc-400 group-hover:text-primary transition-colors border border-white/5">
                         <MessageSquare className="w-8 h-8" />
                     </div>
                     <div className="text-center">
                         <div className="font-bold text-zinc-200 mb-1">流式对话</div>
                         <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Chat Mode</div>
                     </div>
                 </button>
             </div>
          </div>
      </Modal>

    </div>
  );
};

export default Dashboard;