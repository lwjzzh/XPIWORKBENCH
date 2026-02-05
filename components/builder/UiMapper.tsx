
import React, { useState } from 'react';
import { Plus, Trash, AlertCircle, Link as LinkIcon, X, User, ArrowDownToLine, ChevronRight, CheckCircle2, Puzzle } from 'lucide-react';
import { Component, ParamDefinition, ParamUiType } from '../../types/schema';
import { Button, Input, Select, Switch } from '../ui/Common';

interface UiMapperProps {
  component: Component;
  onUpdate: (params: ParamDefinition[]) => void;
  detectedVariables: string[];
  previousComponents?: Component[];
}

interface ParamEditorItemProps {
    param: ParamDefinition;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdate: (id: string, updates: Partial<ParamDefinition>) => void;
    onRemove: (id: string) => void;
    isOrphan?: boolean;
}

// Extract component outside to prevent re-mounting on every render (Fixes input focus loss)
const ParamEditorItem: React.FC<ParamEditorItemProps> = ({ param, isExpanded, onToggle, onUpdate, onRemove, isOrphan }) => {
    const isRef = param.value.includes('{{') && param.value.includes('.response');
    
    return (
      <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'bg-white/5 border-primary/30 shadow-lg' : isOrphan ? 'bg-blue-500/5 border-blue-500/20' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
          {/* Header / Summary View */}
          <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={onToggle}
          >
              <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg border ${param.isVisible ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}>
                      {param.isVisible ? <User className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                      <div className="flex items-center gap-2">
                          <span className={`text-sm font-mono font-bold ${isOrphan ? 'text-blue-200' : 'text-zinc-200'}`}>{param.key}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5 uppercase">{param.uiType}</span>
                          {isOrphan && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/10 uppercase tracking-wider">未映射</span>}
                      </div>
                      <div className="text-xs text-zinc-500 truncate max-w-[200px]">
                          {param.label} {param.value && <span className="font-mono text-zinc-600"> = {param.value}</span>}
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                   <button 
                      onClick={(e) => { e.stopPropagation(); onRemove(param.id); }}
                      className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                   >
                       <Trash className="w-4 h-4" />
                   </button>
                   <ChevronRight className={`w-4 h-4 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
          </div>

          {/* Expanded Editor */}
          {isExpanded && (
              <div className="p-4 border-t border-white/5 space-y-4 bg-black/20 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                      <Input 
                          label="显示名称 (Label)" 
                          value={param.label} 
                          onChange={e => onUpdate(param.id, { label: e.target.value })} 
                          className="bg-black/40"
                      />
                      <Select 
                          label="控件类型 (UI Type)"
                          value={param.uiType}
                          onChange={e => onUpdate(param.id, { uiType: e.target.value as ParamUiType })}
                          options={[
                              { label: '文本输入 (Input)', value: 'input' },
                              { label: '多行文本 (Textarea)', value: 'textarea' },
                              { label: '数字 (Number)', value: 'number' },
                              { label: '布尔开关 (Boolean)', value: 'boolean' },
                              { label: '文件上传 (File)', value: 'file' },
                              { label: '下拉选择 (Select)', value: 'select' },
                              { label: '隐藏参数 (Hidden)', value: 'input' },
                          ]}
                          className="bg-black/40"
                      />
                  </div>
                  
                  <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                           <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">默认值 / 引用 (Value)</label>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-600">用户可见?</span>
                              <Switch checked={param.isVisible} onChange={v => onUpdate(param.id, { isVisible: v })} />
                           </div>
                      </div>
                      <div className="relative">
                          <Input 
                              value={param.value} 
                              onChange={e => onUpdate(param.id, { value: e.target.value })} 
                              className={`bg-black/40 font-mono ${isRef ? 'text-purple-400 border-purple-500/30' : 'text-zinc-300'}`}
                              placeholder={param.isVisible ? "可选默认值" : "必须填写值"}
                          />
                      </div>
                      {isRef && (
                          <p className="text-[10px] text-zinc-500">
                              提示: 添加 <code>.data.fieldName</code> 后缀来提取上一步结果中的特定字段。
                          </p>
                      )}
                  </div>

                  {(param.uiType === 'select' || param.uiType === 'radio') && (
                      <Input 
                          label="选项列表 (逗号分隔)"
                          defaultValue={param.options?.map(o => o.value).join(',') || ''}
                          onBlur={e => onUpdate(param.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean).map(s => ({label:s, value:s})) })}
                          className="bg-black/40 border-dashed"
                          placeholder="Option A, Option B, Option C"
                      />
                  )}
              </div>
          )}
      </div>
    );
};

export const UiMapper: React.FC<UiMapperProps> = ({ component, onUpdate, detectedVariables, previousComponents = [] }) => {
  const { parameters } = component;
  const [editingParamId, setEditingParamId] = useState<string | null>(null);

  // --- Logic Helpers ---

  const missingVariables = detectedVariables.filter(v => 
      !parameters.find(p => p.key === v) && !v.startsWith('$') && !v.startsWith('env.')
  );

  const orphanedParameters = parameters.filter(p => 
      !detectedVariables.includes(p.key)
  );

  const mappedParameters = parameters.filter(p => 
      detectedVariables.includes(p.key)
  );

  // --- Actions ---

  const createParam = (key: string, type: 'user' | 'ref' = 'user', refSource?: { id: string, name: string }) => {
    const newParam: ParamDefinition = {
      id: crypto.randomUUID(),
      key: key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      uiType: 'input',
      value: '',
      isVisible: true,
    };

    if (type === 'ref' && refSource) {
        newParam.value = `{{${refSource.id}.response}}`; 
        newParam.isVisible = false; 
        newParam.label = `Ref: ${refSource.name}`;
    }

    onUpdate([...parameters, newParam]);
    if (type === 'user') setEditingParamId(newParam.id);
  };

  const updateParam = (id: string, updates: Partial<ParamDefinition>) => {
    onUpdate(parameters.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeParam = (id: string) => {
    onUpdate(parameters.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-2 duration-200 pb-10">
      
      {/* 1. MISSING VARIABLES (High Priority) */}
      {missingVariables.length > 0 && (
          <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 mb-1 px-1">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">待配置参数 ({missingVariables.length})</span>
              </div>
              
              {missingVariables.map(v => (
                  <div key={v} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-3 shadow-[0_0_20px_-5px_rgba(245,158,11,0.1)]">
                      <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                              <div className="font-mono text-sm font-bold text-amber-200 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                  {`{{${v}}}`}
                              </div>
                              <span className="text-xs text-amber-500/80">API 中检测到未定义变量</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <Button 
                             size="sm" 
                             onClick={() => createParam(v, 'user')}
                             className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border-amber-500/20 justify-start"
                             icon={User}
                          >
                             设为用户输入
                          </Button>

                          <div className="relative group">
                              <Button 
                                size="sm" 
                                className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/20 justify-start"
                                icon={ArrowDownToLine}
                              >
                                 引用前序步骤
                              </Button>
                              <div className="absolute top-full left-0 right-0 z-10 pt-2 hidden group-hover:block hover:block">
                                   <div className="bg-zinc-900 border border-white/10 rounded-lg shadow-xl p-2 max-h-60 overflow-y-auto custom-scrollbar">
                                       {previousComponents.length > 0 ? previousComponents.map(pc => (
                                           <button 
                                                key={pc.id}
                                                onClick={() => createParam(v, 'ref', { id: pc.id, name: pc.name })}
                                                className="w-full text-left px-3 py-2 hover:bg-white/10 rounded text-xs text-zinc-300 flex justify-between"
                                           >
                                               <span className="truncate">{pc.name}</span>
                                               <span className="text-zinc-600 font-mono">STEP</span>
                                           </button>
                                       )) : <div className="p-2 text-xs text-zinc-500">无前序步骤可用</div>}
                                   </div>
                              </div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* 2. MAPPED PARAMETERS */}
      <div className="space-y-3">
          <div className="flex items-center justify-between px-1 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2 text-zinc-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">已绑定参数 ({mappedParameters.length})</span>
              </div>
          </div>
          
          {mappedParameters.length === 0 && (
              <div className="text-center py-4 text-zinc-600 text-xs italic">
                  暂无已绑定的 API 参数
              </div>
          )}

          <div className="space-y-3">
              {mappedParameters.map(p => (
                  <ParamEditorItem 
                      key={p.id} 
                      param={p} 
                      isExpanded={editingParamId === p.id}
                      onToggle={() => setEditingParamId(editingParamId === p.id ? null : p.id)}
                      onUpdate={updateParam}
                      onRemove={removeParam}
                  />
              ))}
          </div>
      </div>

      {/* 3. AVAILABLE VARIABLES (Previously Orphaned) */}
      {/* Changed semantics from "Orphaned/Error" to "Available/Ready to Use" */}
      <div className="space-y-3 pt-4 border-t border-white/5">
           <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-blue-400">
                  <Puzzle className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">可用变量 ({orphanedParameters.length})</span>
              </div>
              {/* Moved Manual Add Button Here */}
              <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => createParam(`var_${parameters.length + 1}`)} 
                  icon={Plus}
                  className="h-7 text-[10px] px-2"
              >
                  新建变量
              </Button>
          </div>
          
          {orphanedParameters.length === 0 && (
              <div className="text-center py-4 text-zinc-700 text-xs italic bg-white/5 rounded-lg border border-dashed border-white/5">
                  点击上方“新建变量”来预定义参数。
              </div>
          )}

          <div className="space-y-3">
              {orphanedParameters.map(p => (
                   <ParamEditorItem 
                      key={p.id} 
                      param={p} 
                      isExpanded={editingParamId === p.id}
                      onToggle={() => setEditingParamId(editingParamId === p.id ? null : p.id)}
                      onUpdate={updateParam}
                      onRemove={removeParam}
                      isOrphan={true}
                  />
              ))}
          </div>
          
          {orphanedParameters.length > 0 && (
              <div className="p-3 rounded bg-blue-900/10 border border-blue-500/20 text-[10px] text-blue-300 flex gap-2 items-start">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <p>这些变量已定义但尚未在 API 请求中使用。请前往 <b>1. API 请求</b> 标签页，使用 <code>{`{{变量名}}`}</code> 将它们插入到 URL 或 Body 中。</p>
              </div>
          )}
      </div>

    </div>
  );
};
