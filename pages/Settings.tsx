
import React, { useEffect, useState } from 'react';
import { FolderOpen, Save, Database, HardDrive, CheckCircle2, Sliders, Lock, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Card, Switch } from '../components/ui/Common';
import { useSettingsStore } from '../store/useSettingsStore';

// Helper to access backend methods
const getBackend = () => (window as any).go?.main?.App;

const SettingsPage: React.FC = () => {
  const { defaultSavePath, autoSaveResult, envVars, setDefaultSavePath, setAutoSaveResult, setEnvVar, deleteEnvVar, loadSettings } = useSettingsStore();

  // Local state for new env var input
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSelectDirectory = async () => {
      const backend = getBackend();
      if (backend && backend.SelectDirectory) {
          try {
              const path = await backend.SelectDirectory();
              if (path) {
                  setDefaultSavePath(path);
              }
          } catch (e) {
              console.error("Failed to select directory", e);
          }
      } else {
          // Fallback for web mode / testing
          const mockPath = prompt("输入本地路径 (Web 模式):", defaultSavePath);
          if (mockPath) setDefaultSavePath(mockPath);
      }
  };

  const handleAddEnv = () => {
      if (newKey.trim() && newValue.trim()) {
          setEnvVar(newKey.trim().toUpperCase(), newValue.trim());
          setNewKey('');
          setNewValue('');
      }
  };

  const toggleVisibility = (key: string) => {
      setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar p-8 md:p-12 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-8">
             <div className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-zinc-400">
                 <Sliders className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">系统设置 (Settings)</h1>
                <p className="text-zinc-400 mt-1 text-sm">管理应用偏好与数据存储配置。</p>
             </div>
        </div>

        {/* Storage Settings */}
        <Card title="存储设置 (Storage)" variant="glass">
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        本地默认保存目录
                    </label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input 
                                value={defaultSavePath || ''} 
                                readOnly 
                                placeholder="未设置"
                                className="bg-black/40 font-mono text-zinc-300 border-white/10" 
                            />
                        </div>
                        <Button 
                            variant="secondary" 
                            onClick={handleSelectDirectory} 
                            icon={FolderOpen} 
                            className="shrink-0 whitespace-nowrap bg-white/5 border-white/10 hover:bg-white/10"
                        >
                            选择目录
                        </Button>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        用于存放运行结果生成的文件（图片、视频、CSV 等）。
                    </p>
                </div>

                <div className="h-px bg-white/5"></div>

                <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-primary/10 rounded-lg text-primary border border-primary/20">
                            <Save className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-zinc-200">自动保存结果</h4>
                            <p className="text-xs text-zinc-500 mt-0.5">开启后，运行产生的结果文件将自动保存到默认目录。</p>
                        </div>
                    </div>
                    <Switch 
                        checked={autoSaveResult}
                        onChange={(val) => setAutoSaveResult(val)}
                    />
                </div>
            </div>
        </Card>

        {/* Environment Variables */}
        <Card title="环境变量 (Environment Variables)" variant="glass">
             <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                 <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                 <p>在此定义的变量可全局使用。在构建应用时使用 <code>{`{{env.KEY_NAME}}`}</code> 进行引用。例如：API Keys, Base URLs。</p>
             </div>

             <div className="space-y-3">
                 {/* List Existing */}
                 {Object.entries(envVars).map(([key, val]) => (
                     <div key={key} className="flex items-center gap-3 p-2 rounded-lg bg-black/20 border border-white/5 group">
                         <div className="w-1/3 shrink-0 px-2 font-mono text-sm text-zinc-300 font-bold truncate" title={key}>
                             {key}
                         </div>
                         <div className="flex-1 flex items-center gap-2 px-2 font-mono text-sm text-zinc-500 bg-black/40 rounded py-1.5 border border-white/5 relative">
                             <span className="truncate w-full block">
                                 {visibleKeys[key] ? val : '•••••••••••••••••••••'}
                             </span>
                         </div>
                         <button 
                             onClick={() => toggleVisibility(key)}
                             className="p-2 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-colors"
                         >
                             {visibleKeys[key] ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                         </button>
                         <button 
                             onClick={() => deleteEnvVar(key)}
                             className="p-2 text-zinc-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                         >
                             <Trash2 className="w-4 h-4"/>
                         </button>
                     </div>
                 ))}

                 {/* Add New */}
                 <div className="flex items-center gap-3 p-2 rounded-lg border border-dashed border-white/10 bg-white/5 mt-2">
                     <div className="w-1/3 shrink-0">
                         <Input 
                             placeholder="变量名 (KEY)" 
                             value={newKey}
                             onChange={e => setNewKey(e.target.value.toUpperCase())}
                             className="bg-black/40 font-mono text-xs h-9"
                         />
                     </div>
                     <div className="flex-1">
                         <Input 
                             placeholder="变量值 (Value)" 
                             type="password"
                             value={newValue}
                             onChange={e => setNewValue(e.target.value)}
                             className="bg-black/40 font-mono text-xs h-9"
                         />
                     </div>
                     <Button 
                         size="sm" 
                         onClick={handleAddEnv}
                         disabled={!newKey || !newValue}
                         className="h-9 px-3"
                         icon={Plus}
                     >
                         添加
                     </Button>
                 </div>
             </div>
        </Card>

        {/* Database Tools */}
        <Card title="系统维护 (System)" variant="glass">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col gap-4 group hover:bg-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3 text-zinc-300">
                        <div className="p-2 bg-white/5 rounded-lg text-zinc-400 group-hover:text-white transition-colors">
                            <Database className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm">本地数据库 (Local DB)</span>
                    </div>
                    <div className="text-xs text-zinc-500 space-y-1.5 font-mono bg-black/40 p-3 rounded-lg border border-white/5">
                        <div className="flex justify-between"><span>状态:</span> <span className="text-green-400">活跃</span></div>
                        <div className="flex justify-between"><span>大小:</span> <span>1.2 MB</span></div>
                        <div className="flex justify-between"><span>记录:</span> <span>1,024</span></div>
                    </div>
                </div>

                <div className="p-5 bg-black/20 border border-white/5 rounded-xl flex flex-col gap-4 group hover:bg-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3 text-zinc-300">
                        <div className="p-2 bg-white/5 rounded-lg text-zinc-400 group-hover:text-white transition-colors">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm">文件缓存 (Cache)</span>
                    </div>
                    <div className="text-xs text-zinc-500 space-y-1.5 font-mono bg-black/40 p-3 rounded-lg border border-white/5">
                        <div className="flex justify-between"><span>文件数:</span> <span>45 items</span></div>
                        <div className="flex justify-between"><span>临时占用:</span> <span>12.5 MB</span></div>
                        <div className="flex justify-between"><span>路径:</span> <span className="truncate max-w-[100px]">/tmp/omni...</span></div>
                    </div>
                    <div className="flex gap-2 mt-auto">
                        <Button size="sm" variant="danger" className="w-full text-xs h-8 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400">清除缓存</Button>
                    </div>
                </div>
            </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
