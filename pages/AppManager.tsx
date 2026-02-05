
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Box, Clock, RefreshCw, AlertTriangle, Layers, Download, Upload, Copy } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button, Card, Badge, Modal } from '../components/ui/Common';
import { useToast } from '../components/ui/Toast';
import { App } from '../types/schema';

const AppManager: React.FC = () => {
  const { apps, isLoading, loadApps, deleteApp, addApp } = useAppStore();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const handleCreate = async () => {
      const newAppId = crypto.randomUUID();
      await addApp({
          id: newAppId,
          name: '未命名应用',
          description: '',
          icon: 'Box',
          runMode: 'panel',
          components: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          layoutConfig: { direction: 'vertical', gap: 4 }
      });
      addToast('应用已创建', 'success');
      navigate(`/builder/${newAppId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      await deleteApp(deleteTargetId);
      addToast('应用已删除', 'success');
      setDeleteTargetId(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      navigate(`/builder/${id}`);
  };

  // --- New Features ---

  const handleExport = (e: React.MouseEvent, app: App) => {
      e.stopPropagation();
      try {
          // Clean up internal keys if necessary, strictly exporting schema data
          const exportData = {
              ...app,
              isPinned: false // Don't export pinned state
          };
          const dataStr = JSON.stringify(exportData, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          // Sanitize filename
          const safeName = app.name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').substring(0, 50);
          a.download = `${safeName}.omni.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addToast('应用配置已导出', 'success');
      } catch (e) {
          addToast('导出失败', 'error');
      }
  };

  const handleImport = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const raw = event.target?.result as string;
                  const json = JSON.parse(raw);
                  
                  // Basic Validation
                  if (!json.name || !Array.isArray(json.components)) {
                      throw new Error("Invalid App Configuration");
                  }
                  
                  // Sanitize & Re-ID to avoid conflicts
                  const newApp: App = {
                      ...json,
                      id: crypto.randomUUID(),
                      name: `${json.name} (Imported)`,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      isPinned: false
                  };
                  
                  await addApp(newApp);
                  addToast('应用导入成功', 'success');
              } catch (err) {
                  console.error(err);
                  addToast('导入失败: 文件格式错误', 'error');
              }
          };
          reader.readAsText(file);
      };
      input.click();
  };

  const handleDuplicate = async (e: React.MouseEvent, app: App) => {
      e.stopPropagation();
      const newApp: App = {
          ...app,
          id: crypto.randomUUID(),
          name: `${app.name} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPinned: false
      };
      await addApp(newApp);
      addToast('应用已复制', 'success');
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
          <div className="flex h-screen items-center justify-center text-zinc-500 gap-2 bg-background bg-dot-pattern">
              <RefreshCw className="w-5 h-5 animate-spin" />
              正在加载...
          </div>
      );
  }

  return (
    <div className="h-full w-full bg-background bg-dot-pattern flex flex-col overflow-hidden">
      <div className="shrink-0 px-8 py-6 flex flex-col md:flex-row md:items-end justify-between gap-6 z-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">配置应用</h1>
          <p className="text-zinc-400 text-sm">创建、编辑或设计您的工作流。</p>
        </div>
        <div className="flex items-center gap-3">
            <Button onClick={handleImport} variant="secondary" icon={Upload} className="rounded-full shadow-lg bg-black/40 border-white/10 hover:bg-white/10">
              导入配置
            </Button>
            <Button onClick={handleCreate} icon={Plus} className="rounded-full px-6 shadow-lg shadow-primary/20">
              创建新应用
            </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-10 custom-scrollbar">
          {apps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center -mt-20">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
                <Layers className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">暂无应用</h3>
              <p className="text-zinc-500 mb-8 max-w-xs text-center">开始构建您的第一个自动化工具。</p>
              <Button onClick={handleCreate} variant="secondary">
                立即创建
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {apps.map((app) => (
                <div key={app.id} className="group relative flex flex-col h-[220px] glass-panel rounded-2xl overflow-hidden hover:border-primary/30 transition-all cursor-default">
                   <div className="flex-1 p-6" onClick={(e) => handleEdit(e, app.id)}>
                       <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                                <Box className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px]">{app.components.length} 步骤</Badge>
                            </div>
                       </div>
                       
                       <h3 className="text-lg font-bold text-zinc-100 mb-1 truncate cursor-pointer hover:underline decoration-primary/50 underline-offset-4">{app.name}</h3>
                       <p className="text-xs text-zinc-500 line-clamp-2 h-8 leading-relaxed">
                         {app.description || "暂无描述..."}
                       </p>
                   </div>

                   <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                          <Clock className="w-3 h-3" />
                          {formatDate(app.updatedAt)}
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => handleExport(e, app)}
                            className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-blue-300 rounded-md transition-colors"
                            title="导出 (Export)"
                          >
                              <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleDuplicate(e, app)}
                            className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-md transition-colors"
                            title="复制 (Duplicate)"
                          >
                              <Copy className="w-4 h-4" />
                          </button>
                          <div className="w-px h-3 bg-white/10 mx-1"></div>
                          <button 
                            onClick={(e) => handleEdit(e, app.id)}
                            className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-md transition-colors"
                            title="编辑 (Edit)"
                          >
                              <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteClick(e, app.id)}
                            className="p-1.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-md transition-colors"
                            title="删除 (Delete)"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Delete Modal */}
      <Modal 
          isOpen={!!deleteTargetId} 
          onClose={() => setDeleteTargetId(null)}
          title="确认删除"
          width="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteTargetId(null)}>取消</Button>
              <Button variant="danger" onClick={confirmDelete}>确认删除</Button>
            </>
          }
      >
          <div className="flex items-start gap-4">
             <div className="p-2 bg-red-500/10 rounded-full text-red-400 shrink-0">
                 <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
                 <h4 className="text-sm font-bold text-white mb-1">删除此应用？</h4>
                 <p className="text-xs text-zinc-400 leading-relaxed">
                   此操作将永久删除该应用及其所有配置。历史运行记录也将丢失。<br/>此操作无法撤销。
                 </p>
             </div>
          </div>
      </Modal>
    </div>
  );
};

export default AppManager;
