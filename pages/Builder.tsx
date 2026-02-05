import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Layout, RefreshCw, AlertCircle, Settings2, Code, MonitorPlay, MessageSquare, AlertTriangle, ChevronRight, Save, MousePointerClick, Zap } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { App, Component } from '../types/schema';
import { Button, Input, Textarea, Card, Modal, Switch } from '../components/ui/Common';
import { ApiConfigPanel } from '../components/builder/ApiConfigPanel';
import { UiMapper } from '../components/builder/UiMapper';
import { AppAssembler } from '../components/builder/AppAssembler';
import { PresetGallery } from '../components/builder/PresetGallery';
import { useToast } from '../components/ui/Toast';

const BuilderPage: React.FC = () => {
  const { id: appId } = useParams();
  const navigate = useNavigate();
  const { getAppById, updateApp, addComponent, updateComponent, deleteComponent } = useAppStore();
  const { addToast } = useToast();
  
  // --- Global State ---
  const [app, setApp] = useState<App | undefined>(undefined);
  const [isNotFound, setIsNotFound] = useState(false);
  
  // --- UI State ---
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'inputs' | 'api'>('api');
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null);

  // --- Save Mode State ---
  const [isAutoSave, setIsAutoSave] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- Debounce Refs ---
  const appUpdatesRef = useRef<Partial<App>>({});
  const appUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compUpdatesRef = useRef<Record<string, Partial<Component>>>({});
  const compUpdateTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // --- Derived State ---
  const activeComponent = useMemo(() => 
    app?.components.find(c => c.id === selectedComponentId), 
  [app, selectedComponentId]);

  const previousComponents = useMemo(() => {
    if (!app || !activeComponent) return [];
    const index = app.components.findIndex(c => c.id === activeComponent.id);
    return index > 0 ? app.components.slice(0, index) : [];
  }, [app, activeComponent]);

  const mappableVariables = useMemo(() => {
      if (!activeComponent) return [];
      const { apiConfig } = activeComponent;
      const text = `${apiConfig.url} ${JSON.stringify(apiConfig.headers)} ${apiConfig.bodyTemplate || ''}`;
      const regex = /{{\s*([a-zA-Z0-9_$.-]+)\s*}}/g;
      const matches = new Set<string>();
      let match;
      while ((match = regex.exec(text)) !== null) {
        const v = match[1];
        // Filter out system vars ($), environment vars (env.), and variables containing dots (usually references)
        if (!v.startsWith('$') && !v.startsWith('env.') && !v.includes('.')) {
            matches.add(v);
        }
      }
      return Array.from(matches);
  }, [activeComponent?.apiConfig]);

  // --- Effects ---
  useEffect(() => {
    if (appId) {
      const data = getAppById(appId);
      if (data) {
        setApp(data);
        setIsNotFound(false);
      } else {
        setIsNotFound(true);
      }
    }
  }, [appId, getAppById]); 

  // Reset unsaved indicator when switching components
  useEffect(() => {
      setHasUnsavedChanges(false);
  }, [selectedComponentId]);

  useEffect(() => {
      return () => {
          if (appUpdateTimeoutRef.current) clearTimeout(appUpdateTimeoutRef.current);
          Object.values(compUpdateTimeoutsRef.current).forEach(t => clearTimeout(t));
      };
  }, []);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              handleGlobalSave();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [app, updateApp, addToast]);


  // --- Handlers ---
  
  const handleGlobalSave = () => {
      if (app && Object.keys(appUpdatesRef.current).length > 0) {
          updateApp(app.id, appUpdatesRef.current);
          appUpdatesRef.current = {};
      }
      // Also save any dirty component if in manual mode
      if (!isAutoSave && activeComponent && hasUnsavedChanges) {
          handleManualSaveStep();
      }
      addToast("应用已保存", "success");
  };

  const handleAppUpdate = (field: keyof App, value: any) => {
      if (!app) return;
      setApp(prev => prev ? ({ ...prev, [field]: value }) : undefined);
      appUpdatesRef.current = { ...appUpdatesRef.current, [field]: value };
      if (appUpdateTimeoutRef.current) clearTimeout(appUpdateTimeoutRef.current);
      appUpdateTimeoutRef.current = setTimeout(() => {
          if (Object.keys(appUpdatesRef.current).length > 0) {
              updateApp(app.id, appUpdatesRef.current);
              appUpdatesRef.current = {}; 
          }
      }, 800);
  };

  const handleUpdateComponent = (id: string, updates: Partial<Component>) => {
      if (!app) return;
      
      // 1. Update UI immediately
      setApp(prev => {
          if (!prev) return undefined;
          return {
              ...prev,
              components: prev.components.map(c => c.id === id ? { ...c, ...updates } : c)
          };
      });

      // 2. Handle Persistence
      if (isAutoSave) {
          // Debounced Auto Save
          compUpdatesRef.current[id] = { ...(compUpdatesRef.current[id] || {}), ...updates };
          if (compUpdateTimeoutsRef.current[id]) clearTimeout(compUpdateTimeoutsRef.current[id]);
          compUpdateTimeoutsRef.current[id] = setTimeout(() => {
              if (compUpdatesRef.current[id]) {
                  updateComponent(app.id, id, compUpdatesRef.current[id]);
                  delete compUpdatesRef.current[id];
              }
              delete compUpdateTimeoutsRef.current[id];
          }, 1000);
      } else {
          // Manual Save Mode
          setHasUnsavedChanges(true);
      }
  };

  const handleManualSaveStep = () => {
      if (!app || !activeComponent) return;
      // We push the entire current component state to ensure consistency
      updateComponent(app.id, activeComponent.id, activeComponent);
      setHasUnsavedChanges(false);
      addToast("步骤配置已保存", "success");
  };

  const handleAddComponent = (component: Component) => {
      if (!app) return;
      addComponent(app.id, component);
      setApp(prev => prev ? ({ ...prev, components: [...prev.components, component] }) : undefined);
      setShowPresetGallery(false);
      setSelectedComponentId(component.id); // Auto open editor
      setActiveTab('api');
      addToast('组件已添加', 'success');
  };

  const confirmDeleteComponent = () => {
      if (!app || !deleteComponentId) return;
      deleteComponent(app.id, deleteComponentId);
      setApp(prev => prev ? ({ ...prev, components: prev.components.filter(c => c.id !== deleteComponentId) }) : undefined);
      if (selectedComponentId === deleteComponentId) setSelectedComponentId(null);
      setDeleteComponentId(null);
      addToast('组件已删除', 'success');
  };

  const handleReorderComponent = useCallback((fromIndex: number, toIndex: number) => {
      if (!app) return;
      const newComponents = [...app.components];
      const [moved] = newComponents.splice(fromIndex, 1);
      newComponents.splice(toIndex, 0, moved);
      
      setApp({ ...app, components: newComponents });
      updateApp(app.id, { components: newComponents });
  }, [app, updateApp]);

  if (isNotFound) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-background text-zinc-400 gap-4 bg-dot-pattern">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <h2 className="text-xl font-semibold text-white">未找到应用</h2>
              <Button onClick={() => navigate('/')} variant="secondary">返回首页</Button>
          </div>
      );
  }

  if (!app) {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-background text-zinc-500 gap-3 bg-dot-pattern">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p>正在加载...</p>
          </div>
      );
  }

  return (
    <div className="h-screen w-full bg-background bg-dot-pattern overflow-hidden relative flex flex-col font-sans">
      
      {/* 1. Floating Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none">
          <div className="max-w-7xl mx-auto flex items-center justify-between glass-panel rounded-full px-6 py-3 pointer-events-auto shadow-2xl">
               <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => navigate('/')} className="text-zinc-400 hover:text-white px-3 h-8 rounded-full flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>返回</span>
                  </Button>
                  
                  <div className="h-4 w-px bg-white/10"></div>
                  
                  <div className="flex items-center gap-2">
                       <input 
                          className="bg-transparent border-none text-white font-semibold focus:ring-0 w-auto min-w-[100px] outline-none placeholder:text-zinc-600 focus:bg-white/5 rounded px-2 transition-colors"
                          value={app.name}
                          onChange={(e) => handleAppUpdate('name', e.target.value)}
                          placeholder="Untitled App"
                       />
                       <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-500 border border-white/5 font-mono">v1.0</span>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                   <div className="bg-black/40 rounded-full p-1 flex items-center border border-white/5">
                        <button
                            onClick={() => handleAppUpdate('runMode', 'panel')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${app.runMode === 'panel' ? 'bg-zinc-800 text-white shadow-sm border border-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <MonitorPlay className="w-3 h-3" /> Panel
                        </button>
                        <button
                            onClick={() => handleAppUpdate('runMode', 'chat')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${app.runMode === 'chat' ? 'bg-zinc-800 text-white shadow-sm border border-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <MessageSquare className="w-3 h-3" /> Chat
                        </button>
                   </div>

                   <div className="h-4 w-px bg-white/10"></div>

                   <Button 
                        variant="secondary"
                        onClick={handleGlobalSave}
                        className="rounded-full px-4 border-white/10 bg-white/5 hover:bg-white/10"
                        icon={Save}
                   >
                       保存
                   </Button>

                   <Button 
                        variant="primary" 
                        className="rounded-full px-6 shadow-primary/20 shadow-lg"
                        icon={Play} 
                        onClick={() => navigate(`/run/${app.id}`)}
                   >
                        运行
                   </Button>
               </div>
          </div>
      </div>

      {/* 2. Main Canvas Area */}
      <div className="flex-1 w-full h-full relative z-0 pt-20">
            {app.components.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                     <div className="glass-panel p-10 rounded-2xl flex flex-col items-center text-center max-w-md border border-white/10">
                         <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                             <Layout className="w-8 h-8 text-zinc-500" />
                         </div>
                         <h3 className="text-xl font-bold text-white mb-2">开始构建</h3>
                         <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                             画布为空。添加第一个 API 请求或逻辑步骤以开始。
                         </p>
                         <Button onClick={() => setShowPresetGallery(true)} size="lg" className="rounded-full px-8">
                             + 添加步骤
                         </Button>
                     </div>
                </div>
            ) : (
                <AppAssembler 
                    components={app.components}
                    onAddComponent={() => setShowPresetGallery(true)}
                    onEditComponent={(id) => setSelectedComponentId(id)}
                    onDeleteComponent={(id) => setDeleteComponentId(id)}
                    onReorderComponents={handleReorderComponent}
                />
            )}
      </div>

      {/* 3. Slide-in Editor Drawer (Inspector) */}
      <div className={`fixed top-0 right-0 bottom-0 w-[500px] xl:w-[600px] glass-panel border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${selectedComponentId ? 'translate-x-0' : 'translate-x-full'}`}>
          {activeComponent ? (
             <>
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/20 rounded-lg text-primary">
                            <Code className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">编辑步骤 (Editing)</span>
                            <span className="text-sm font-bold text-white truncate max-w-[200px]">{activeComponent.name}</span>
                        </div>
                    </div>
                    
                    {/* Save Controls */}
                    <div className="flex items-center gap-3">
                         {/* Toggle Switch */}
                         <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
                             <button
                                 onClick={() => {
                                     setIsAutoSave(false);
                                     // When switching to manual, assume clean until change
                                     setHasUnsavedChanges(false);
                                 }}
                                 className={`p-1.5 rounded flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors ${!isAutoSave ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                 title="手动保存模式"
                             >
                                 <MousePointerClick className="w-3.5 h-3.5" />
                                 {!isAutoSave && "Manual"}
                             </button>
                             <button
                                 onClick={() => {
                                     setIsAutoSave(true);
                                     if (hasUnsavedChanges) handleManualSaveStep(); // Auto-save pending changes when switching back
                                 }}
                                 className={`p-1.5 rounded flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors ${isAutoSave ? 'bg-white/10 text-green-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                 title="自动保存模式"
                             >
                                 <Zap className="w-3.5 h-3.5" />
                                 {isAutoSave && "Auto"}
                             </button>
                         </div>
                        
                         {/* Manual Save Button */}
                         {!isAutoSave && (
                             <Button 
                                size="sm" 
                                variant={hasUnsavedChanges ? 'primary' : 'secondary'}
                                onClick={handleManualSaveStep}
                                disabled={!hasUnsavedChanges}
                                className={`transition-all ${hasUnsavedChanges ? 'shadow-[0_0_15px_-3px_rgba(59,130,246,0.6)]' : 'opacity-70'}`}
                             >
                                 保存步骤
                             </Button>
                         )}

                        <div className="w-px h-4 bg-white/10 mx-1"></div>

                        <button onClick={() => setSelectedComponentId(null)} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 px-6 shrink-0 bg-black/20">
                    <button 
                        onClick={() => setActiveTab('api')}
                        className={`py-4 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 mr-6 ${activeTab === 'api' ? 'border-primary text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                    >
                        1. API 请求
                    </button>
                    <button 
                        onClick={() => setActiveTab('inputs')}
                        className={`py-4 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 mr-6 ${activeTab === 'inputs' ? 'border-primary text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                    >
                        2. 变量与界面
                    </button>
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`py-4 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'border-primary text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                    >
                        设置
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-950/30">
                     {activeTab === 'api' && (
                        <ApiConfigPanel 
                            component={activeComponent}
                            onUpdate={(updates) => handleUpdateComponent(activeComponent.id, { apiConfig: { ...activeComponent.apiConfig, ...updates } })}
                        />
                    )}

                    {activeTab === 'inputs' && (
                        <UiMapper 
                            component={activeComponent}
                            detectedVariables={mappableVariables} // Use filtered list for auto-generate
                            onUpdate={(params) => handleUpdateComponent(activeComponent.id, { parameters: params })}
                            previousComponents={previousComponents}
                        />
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <Card title="基础信息 (General)" variant="glass">
                                <div className="space-y-4">
                                    <Input 
                                        label="步骤名称"
                                        value={activeComponent.name}
                                        onChange={(e) => handleUpdateComponent(activeComponent.id, { name: e.target.value })}
                                    />
                                    <Textarea 
                                        label="描述"
                                        value={activeComponent.description || ''}
                                        onChange={(e) => handleUpdateComponent(activeComponent.id, { description: e.target.value })}
                                    />
                                </div>
                            </Card>

                            <Card title="流程控制 (Flow Control)" variant="glass">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                                <AlertTriangle className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-zinc-200">失败后继续 (Continue On Error)</h4>
                                                <p className="text-[10px] text-zinc-500">如果请求失败，是否忽略错误并执行下一步骤。</p>
                                            </div>
                                        </div>
                                        <Switch 
                                            checked={activeComponent.flowControl?.continueOnError || false}
                                            onChange={(val) => handleUpdateComponent(activeComponent.id, { 
                                                flowControl: { ...activeComponent.flowControl, continueOnError: val, retryCount: activeComponent.flowControl?.retryCount || 0, retryDelay: activeComponent.flowControl?.retryDelay || 1000 } 
                                            })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                                <RefreshCw className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-zinc-200">自动重试 (Retry)</h4>
                                                <p className="text-[10px] text-zinc-500">失败时自动重试的次数。</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select 
                                                className="bg-black/40 border border-white/10 rounded-md text-sm px-2 py-1 focus:outline-none"
                                                value={activeComponent.flowControl?.retryCount || 0}
                                                onChange={(e) => handleUpdateComponent(activeComponent.id, { 
                                                    flowControl: { ...activeComponent.flowControl, retryCount: parseInt(e.target.value), continueOnError: activeComponent.flowControl?.continueOnError || false, retryDelay: activeComponent.flowControl?.retryDelay || 1000 } 
                                                })}
                                            >
                                                <option value={0}>不重试 (None)</option>
                                                <option value={1}>1 次</option>
                                                <option value={2}>2 次</option>
                                                <option value={3}>3 次</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                            
                            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-red-400">删除步骤</h4>
                                    <p className="text-xs text-red-400/60">移除此步骤可能会影响后续依赖它的步骤。</p>
                                </div>
                                <Button variant="danger" size="sm" onClick={() => setDeleteComponentId(activeComponent.id)}>
                                    删除
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-black/40 flex justify-between items-center text-[10px] text-zinc-500">
                    <span className="font-mono">ID: {activeComponent.id.slice(0, 8)}...</span>
                    <span>
                        {isAutoSave ? (
                            <span className="flex items-center gap-1.5 text-zinc-500"><RefreshCw className="w-3 h-3 animate-spin" /> 自动保存已开启</span>
                        ) : (
                            <span className={`flex items-center gap-1.5 ${hasUnsavedChanges ? 'text-amber-500' : 'text-green-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${hasUnsavedChanges ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                                {hasUnsavedChanges ? '有未保存更改' : '已保存'}
                            </span>
                        )}
                    </span>
                </div>
             </>
          ) : (
             <div className="h-full flex items-center justify-center text-zinc-500">
                 未选择组件
             </div>
          )}
      </div>

      {/* 4. Modals */}
      {showPresetGallery && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
                <div className="glass-panel border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-full overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                    <PresetGallery 
                        onSelect={handleAddComponent} 
                        onCancel={() => setShowPresetGallery(false)} 
                    />
                </div>
            </div>
      )}

      <Modal 
          isOpen={!!deleteComponentId} 
          onClose={() => setDeleteComponentId(null)} 
          title="删除步骤" 
          width="sm"
          footer={
             <>
                 <Button variant="ghost" onClick={() => setDeleteComponentId(null)}>取消</Button>
                 <Button variant="danger" onClick={confirmDeleteComponent}>确认删除</Button>
             </>
          }
      >
          <div className="flex items-start gap-4 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm text-zinc-300 mt-1">
                  确定要删除此步骤吗？该操作无法撤销。
              </p>
          </div>
      </Modal>
    </div>
  );
};

export default BuilderPage;