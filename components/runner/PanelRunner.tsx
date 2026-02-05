
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RefreshCw, Upload, FileCheck, History, X, Save, ArrowLeft, Terminal, Activity, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { App, ParamUiType, ParamDefinition, Session } from '../../types/schema';
import { Button, Input, Textarea, Select, Badge, Switch } from '../ui/Common';
import { ResultRenderer } from './ResultRenderer';
import { executeApp } from '../../services/workflowEngine';
import { useSessionStore } from '../../store/useSessionStore';

interface PanelRunnerProps {
  app: App;
}

interface ComponentState {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  result: any;
  error?: string;
  startTime?: number;
  duration?: number;
}

export const PanelRunner: React.FC<PanelRunnerProps> = ({ app }) => {
  const navigate = useNavigate();
  const { loadSessions, saveSession, getSessionsByApp } = useSessionStore();

  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  // Track state for ALL components to render the timeline
  const [compStates, setCompStates] = useState<Record<string, ComponentState>>({});
  const [isRunning, setIsRunning] = useState(false);
  
  // UI State
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<any[]>([]); 
  const [showHistory, setShowHistory] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Constants
  const SESSION_ID = `panel_latest_${app.id}`;
  const SAVE_DELAY = 2000; 

  // 1. Load Session & Init
  useEffect(() => {
      const init = async () => {
          await loadSessions();
          
          const sessions = getSessionsByApp(app.id, 'panel');
          const lastSession = sessions.find(s => s.id === SESSION_ID);

          const defaults: Record<string, Record<string, string>> = {};
          const states: Record<string, ComponentState> = {};

          app.components.forEach(comp => {
            defaults[comp.id] = {};
            if (lastSession?.data?.inputs?.[comp.id]) {
                defaults[comp.id] = lastSession.data.inputs[comp.id];
            } else {
                comp.parameters.forEach(p => {
                    if (p.isVisible) {
                        if (p.uiType === 'boolean') {
                            defaults[comp.id][p.key] = p.value === 'true' ? 'true' : 'false';
                        } else {
                            defaults[comp.id][p.key] = p.value || '';
                        }
                    }
                });
            }
            states[comp.id] = { id: comp.id, name: comp.name, status: 'idle', result: null };
          });
          
          setInputValues(defaults);
          setCompStates(states);
          setIsInitialized(true);
      };
      init();
  }, [app.id]);

  // 2. Auto-Save
  const inputsRef = useRef(inputValues);
  useEffect(() => { inputsRef.current = inputValues; }, [inputValues]);

  useEffect(() => {
      if (!isInitialized) return;
      const timer = setTimeout(async () => {
          setIsSaving(true);
          const session: Session = {
              id: SESSION_ID,
              appId: app.id,
              name: 'Latest Panel State',
              type: 'panel',
              data: { inputs: inputsRef.current },
              updatedAt: Date.now()
          };
          await saveSession(session);
          setIsSaving(false);
      }, SAVE_DELAY);
      return () => clearTimeout(timer);
  }, [inputValues, isInitialized, app.id]);


  const handleInputChange = (compId: string, key: string, val: string) => {
      setInputValues(prev => ({
          ...prev,
          [compId]: { ...prev[compId], [key]: val }
      }));
  };

  const handleFileChange = (compId: string, key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => handleInputChange(compId, key, reader.result as string);
        reader.readAsDataURL(file);
    }
  };

  const toggleStepCollapse = (stepId: string) => {
      setCollapsedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const runPipeline = async () => {
      setIsRunning(true);
      
      // Reset states but keep the structure
      setCompStates(prev => {
          const next = { ...prev };
          app.components.forEach(c => {
             next[c.id] = { 
                 id: c.id, 
                 name: c.name, 
                 status: 'idle', 
                 result: null, 
                 error: undefined,
                 startTime: undefined,
                 duration: undefined
             };
          });
          return next;
      });

      // Auto collapse all initially
      const initialCollapsed: Record<string, boolean> = {};
      app.components.forEach(c => initialCollapsed[c.id] = true);
      setCollapsedSteps(initialCollapsed);

      const context = {
          '$session_id': SESSION_ID,
          '$timestamp': Date.now().toString()
      };

      try {
          // Track start times for duration calc
          const startTimes: Record<string, number> = {};

          await executeApp(
              app.id, 
              inputValues,
              (compId, status, result, error) => {
                  setCompStates(prev => {
                      const prevState = prev[compId];
                      const now = Date.now();
                      
                      if (status === 'running' && prevState.status !== 'running') {
                          startTimes[compId] = now;
                      }

                      let duration = prevState.duration;
                      if ((status === 'success' || status === 'error') && startTimes[compId]) {
                          duration = now - startTimes[compId];
                      }

                      // Auto expand current running or just finished step
                      if (status === 'running' || status === 'error') {
                          setCollapsedSteps(curr => ({ ...curr, [compId]: false }));
                      }
                      
                      return {
                          ...prev,
                          [compId]: { 
                              id: compId, 
                              name: app.components.find(c => c.id === compId)?.name || 'Unknown',
                              status, 
                              result, 
                              error,
                              startTime: startTimes[compId],
                              duration
                          }
                      };
                  });
              },
              context
          );
      } catch (e) {
          console.error("Pipeline failed", e);
      } finally {
          setIsRunning(false);
      }
  };

  // Log success history
  useEffect(() => {
      if (!isRunning) {
          const lastComp = app.components[app.components.length - 1];
          const lastState = compStates[lastComp?.id];
          if (lastState?.status === 'success') {
               setHistory(prev => {
                  if (prev[0]?.ts && Date.now() - prev[0].ts < 1000) return prev; 
                  return [{ ts: Date.now(), result: lastState.result, status: 'success' }, ...prev];
               });
          }
      }
  }, [isRunning, compStates, app.components]);

  if (!isInitialized) {
      return (
          <div className="flex h-full items-center justify-center text-zinc-500 bg-background bg-dot-pattern">
              <RefreshCw className="w-6 h-6 animate-spin mr-3 text-primary" /> 初始化面板...
          </div>
      );
  }

  const renderInput = (comp: any, param: ParamDefinition) => {
      const val = inputValues[comp.id]?.[param.key] || '';
      switch (param.uiType) {
          case 'textarea':
              return <Textarea label={param.label} placeholder={param.value} value={val} onChange={e => handleInputChange(comp.id, param.key, e.target.value)} className="bg-black/20" />;
          case 'select':
              return <Select label={param.label} options={param.options || []} value={val} onChange={e => handleInputChange(comp.id, param.key, e.target.value)} className="bg-black/20" />;
          case 'boolean':
              return (
                  <div className="flex items-center justify-between mt-6 p-3 rounded-lg border border-white/5 bg-black/20 hover:border-white/10 transition-colors">
                      <label className="text-sm font-medium text-zinc-200 cursor-pointer select-none">{param.label}</label>
                      <Switch checked={val === 'true'} onChange={(checked) => handleInputChange(comp.id, param.key, checked ? 'true' : 'false')} />
                  </div>
              );
          case 'file':
              return (
                  <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{param.label}</label>
                      <label className={`flex items-center justify-between w-full px-4 py-3 bg-black/20 border border-dashed rounded-lg cursor-pointer transition-all group ${val ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}>
                            <div className="flex items-center gap-3 text-sm">
                                <div className={`p-2 rounded-md ${val ? 'bg-primary/20 text-primary' : 'bg-white/5 text-zinc-500'}`}><Upload className="w-4 h-4" /></div>
                                <span className={val ? 'text-zinc-200 font-medium' : 'text-zinc-500'}>{val ? '已选择文件' : '上传文件'}</span>
                            </div>
                            {val && <FileCheck className="w-4 h-4 text-primary animate-in zoom-in" />}
                            <input type="file" className="hidden" onChange={(e) => handleFileChange(comp.id, param.key, e)} />
                      </label>
                  </div>
              );
          default:
              return <Input label={param.label} type={param.uiType === 'input' ? 'text' : param.uiType} placeholder={param.value} value={val} onChange={e => handleInputChange(comp.id, param.key, e.target.value)} className="bg-black/20" />;
      }
  };

  return (
    <div className="flex h-full overflow-hidden bg-background bg-dot-pattern">
      {/* Left Column: Inputs */}
      <div className="w-[400px] xl:w-[450px] flex flex-col glass-panel border-r border-white/10 z-10 shrink-0 backdrop-blur-xl">
          <div className="h-16 border-b border-white/5 flex justify-between items-center px-5 shrink-0 bg-white/5">
              <div className="flex items-center gap-3 overflow-hidden">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="px-0 w-8 shrink-0 text-zinc-400 hover:text-white rounded-full">
                      <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex flex-col overflow-hidden">
                      <h2 className="text-sm font-bold text-white leading-tight truncate">{app.name}</h2>
                      <p className="text-[10px] text-zinc-500 truncate uppercase tracking-wider">运行配置 (Config)</p>
                  </div>
              </div>
              <div className={`shrink-0 flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-all font-mono ${isSaving ? 'bg-primary/10 text-primary border-primary/20' : 'bg-black/20 text-zinc-600 border-white/5'}`}>
                  {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>}
                  {isSaving ? '保存中' : '已保存'}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
              {app.components.map((comp, idx) => {
                  const visibleParams = comp.parameters.filter(p => p.isVisible);
                  if (visibleParams.length === 0) return null;
                  return (
                      <div key={comp.id} className="space-y-4 animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                          <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-xs font-mono text-zinc-400 shadow-inner">{idx + 1}</div>
                              <span className="text-sm font-bold text-zinc-200 tracking-tight">{comp.name}</span>
                          </div>
                          <div className="space-y-5 pl-3 border-l border-dashed border-white/10 ml-3">
                              {visibleParams.map(param => <div key={param.id} className="pl-4">{renderInput(comp, param)}</div>)}
                          </div>
                      </div>
                  );
              })}
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20 backdrop-blur-sm">
              <Button size="lg" className="w-full rounded-xl shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] border border-primary/50 text-base font-bold tracking-wide h-12" onClick={runPipeline} disabled={isRunning} variant="primary">
                  {isRunning ? <><RefreshCw className="w-5 h-5 animate-spin mr-2" /> 处理中...</> : <><Play className="w-5 h-5 mr-2 fill-current" /> 运行应用</>}
              </Button>
          </div>
      </div>

      {/* Right Column: Timeline Results */}
      <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="h-14 flex items-center justify-between px-6 shrink-0 border-b border-white/5 bg-black/20 backdrop-blur">
              <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">执行时间轴 (Timeline)</span>
              </div>
              <Button variant="ghost" size="sm" icon={History} onClick={() => setShowHistory(!showHistory)} className="text-zinc-500 hover:text-white">日志</Button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-black/40">
               {/* Empty State */}
               {!isRunning && Object.values(compStates).every(s => s.status === 'idle') && (
                   <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-6 select-none">
                       <div className="w-24 h-24 rounded-full border border-dashed border-zinc-800 flex items-center justify-center">
                           <Activity className="w-10 h-10 opacity-20" />
                       </div>
                       <div className="text-center space-y-2">
                           <h4 className="text-zinc-500 font-medium">准备就绪</h4>
                           <p className="text-xs text-zinc-700 font-mono">填写参数并点击运行以开始。</p>
                       </div>
                   </div>
               )}

               {/* Step Timeline */}
               <div className="space-y-4 max-w-5xl mx-auto pb-10">
                   {app.components.map((comp, idx) => {
                       const state = compStates[comp.id];
                       const isIdle = state.status === 'idle';
                       const isRunningStep = state.status === 'running';
                       const isSuccess = state.status === 'success';
                       const isError = state.status === 'error';
                       const isCollapsed = collapsedSteps[comp.id];

                       if (isIdle && !isRunning) return null; // Only show relevant steps? Or show all as pending. 
                       // Let's show all for structure, but dim pending ones.
                       
                       return (
                           <div key={comp.id} className={`rounded-xl border transition-all duration-300 overflow-hidden ${isIdle ? 'opacity-50 border-white/5 bg-transparent' : 'opacity-100 border-white/10 bg-surface'}`}>
                               {/* Step Header */}
                               <div 
                                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors ${isRunningStep ? 'bg-primary/5' : ''}`}
                                    onClick={() => toggleStepCollapse(comp.id)}
                               >
                                    <div className="flex items-center gap-4">
                                        {/* Status Icon */}
                                        <div className="shrink-0">
                                            {isIdle && <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />}
                                            {isRunningStep && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
                                            {isSuccess && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                            {isError && <AlertCircle className="w-5 h-5 text-red-500" />}
                                        </div>
                                        
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${isRunningStep ? 'text-primary' : 'text-zinc-200'}`}>
                                                    {idx + 1}. {comp.name}
                                                </span>
                                                {state.duration && (
                                                    <span className="text-[10px] text-zinc-600 font-mono flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded">
                                                        <Clock className="w-2.5 h-2.5" /> {(state.duration / 1000).toFixed(2)}s
                                                    </span>
                                                )}
                                            </div>
                                            {isRunningStep && <span className="text-[10px] text-primary/70 animate-pulse">正在执行请求...</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="p-1 text-zinc-500">
                                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180 transition-transform" />}
                                        </div>
                                    </div>
                               </div>

                               {/* Step Result Content */}
                               {!isCollapsed && (
                                   <div className="border-t border-white/5 bg-black/20 min-h-[100px] max-h-[600px] relative flex flex-col animate-in slide-in-from-top-2 duration-200">
                                        {/* Pass height logic to ResultRenderer or handle scroll here */}
                                        <div className="overflow-y-auto custom-scrollbar p-0 flex-1">
                                            <ResultRenderer 
                                                result={state.result} 
                                                status={state.status} 
                                                error={state.error} 
                                                duration={state.duration}
                                            />
                                        </div>
                                   </div>
                               )}
                           </div>
                       );
                   })}
               </div>
          </div>

          {/* History Drawer */}
          <div className={`absolute top-0 right-0 bottom-0 w-80 glass-panel border-l border-white/10 shadow-2xl z-30 transition-transform duration-300 ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-black/40">
                  <span className="font-bold text-sm text-zinc-200">执行历史</span>
                  <button onClick={() => setShowHistory(false)} className="p-1 text-zinc-500 hover:text-white rounded-md hover:bg-white/10"><X className="w-4 h-4"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {history.length === 0 && <p className="text-zinc-600 text-xs text-center py-10 font-mono">暂无日志记录。</p>}
                  {history.map((h, i) => (
                      <div key={i} className="p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/20 transition-all cursor-pointer group">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] text-zinc-500 font-mono">{new Date(h.ts).toLocaleTimeString()}</span>
                              <Badge variant="success" className="text-[10px] h-4 px-1">Success</Badge>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono line-clamp-2 opacity-70 group-hover:opacity-100">
                              Result available.
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};
