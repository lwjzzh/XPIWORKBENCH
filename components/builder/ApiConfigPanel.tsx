
import React, { useMemo, useState, KeyboardEvent, useRef } from 'react';
import { Plus, Trash, Zap, Code, FileJson, PlayCircle, XCircle, CheckCircle2, Loader2, ListPlus, Import, MousePointerClick, Variable } from 'lucide-react';
import { Component, ApiHeader, HttpMethod } from '../../types/schema';
import { Button, Input, Textarea, Select, Card, Badge, Switch, Modal } from '../ui/Common';
import { proxyRequest } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useSettingsStore } from '../../store/useSettingsStore';
import { interpolateString, interpolateJSON } from '../../services/workflowEngine';

interface ApiConfigPanelProps {
  component: Component;
  onUpdate: (updates: Partial<Component['apiConfig']>) => void;
}

interface FormDataEntry {
    id: string;
    key: string;
    value: string;
}

export const ApiConfigPanel: React.FC<ApiConfigPanelProps> = ({ component, onUpdate }) => {
  const { apiConfig, parameters } = component;
  const { addToast } = useToast();
  const { envVars } = useSettingsStore();
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // cURL Import State
  const [showCurlModal, setShowCurlModal] = useState(false);
  const [curlInput, setCurlInput] = useState('');

  // Track the last focused element to support "Smart Insert"
  const lastFocusedRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const formDataEntries: FormDataEntry[] = useMemo(() => {
      if (apiConfig.bodyType !== 'form-data' || !apiConfig.bodyTemplate) return [];
      try {
          const parsed = JSON.parse(apiConfig.bodyTemplate);
          return Array.isArray(parsed) ? parsed : [];
      } catch {
          return [];
      }
  }, [apiConfig.bodyType, apiConfig.bodyTemplate]);

  // --- Updates ---
  const updateHeader = (id: string, field: keyof ApiHeader, value: string) => {
    const newHeaders = apiConfig.headers.map(h => h.id === id ? { ...h, [field]: value } : h);
    onUpdate({ headers: newHeaders });
  };

  const addHeader = () => {
    const newHeaders = [...apiConfig.headers, { id: crypto.randomUUID(), key: '', value: '' }];
    onUpdate({ headers: newHeaders });
  };

  const removeHeader = (id: string) => {
    const newHeaders = apiConfig.headers.filter(h => h.id !== id);
    onUpdate({ headers: newHeaders });
  };

  const updateFormData = (newEntries: FormDataEntry[]) => {
      onUpdate({ bodyTemplate: JSON.stringify(newEntries) });
  };

  const addFormEntry = () => {
      updateFormData([...formDataEntries, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const updateFormEntry = (id: string, field: 'key' | 'value', val: string) => {
      updateFormData(formDataEntries.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  const removeFormEntry = (id: string) => {
      updateFormData(formDataEntries.filter(e => e.id !== id));
  };

  const detectedVariables = useMemo(() => {
    const text = `${apiConfig.url} ${JSON.stringify(apiConfig.headers)} ${apiConfig.bodyTemplate || ''}`;
    const regex = /{{\s*([a-zA-Z0-9_$.-]+)\s*}}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  }, [apiConfig]);

  // --- Smart Insert Logic ---
  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      lastFocusedRef.current = e.target;
  };

  const handleInsertVariable = (key: string) => {
      const el = lastFocusedRef.current;
      const variableTag = `{{${key}}}`;

      if (el && document.body.contains(el)) {
          // Attempt to insert at cursor position using native DOM methods
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          const text = el.value;
          const newText = text.substring(0, start) + variableTag + text.substring(end);
          
          // Update the DOM value directly (required for React to pick up the change event correctly)
          // Using setRangeText preserves undo history in some browsers
          try {
              el.setRangeText(variableTag, start, end, 'end');
              // Dispatch input event to notify React state handlers
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.focus(); // Refocus
          } catch (e) {
              // Fallback if setRangeText fails (e.g. non-text inputs), though unlikely for text/textarea
              // We rely on the user to have focused a valid input. 
              // If focus was lost, we might just copy to clipboard.
              navigator.clipboard.writeText(variableTag);
              addToast(`已复制: ${variableTag}`, 'info');
          }
      } else {
          // No active input found, fallback to clipboard
          navigator.clipboard.writeText(variableTag);
          addToast(`已复制: ${variableTag} (请粘贴到目标位置)`, 'info');
      }
  };

  // --- cURL Import Logic ---
  const handleImportCurl = () => {
      const curlText = curlInput.trim();
      if (!curlText) return;

      try {
          let method: HttpMethod = 'GET';
          let url = '';
          const headers: ApiHeader[] = [];
          let body = '';
          let bodyType = 'none';

          const oneLine = curlText.replace(/\\\n/g, ' ').replace(/\n/g, ' ');

          const urlMatch = oneLine.match(/'(http[^']+)'/) || oneLine.match(/"(http[^"]+)"/) || oneLine.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) url = urlMatch[1];

          const methodMatch = oneLine.match(/-X\s+([A-Z]+)/i) || oneLine.match(/--request\s+([A-Z]+)/i);
          if (methodMatch) {
              method = methodMatch[1].toUpperCase() as HttpMethod;
          }

          const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
          let hMatch;
          while ((hMatch = headerRegex.exec(oneLine)) !== null) {
              const pair = hMatch[1];
              const colonIndex = pair.indexOf(':');
              if (colonIndex > 0) {
                  headers.push({
                      id: crypto.randomUUID(),
                      key: pair.slice(0, colonIndex).trim(),
                      value: pair.slice(colonIndex + 1).trim()
                  });
              }
          }

          const dataMatch = oneLine.match(/(-d|--data|--data-raw)\s+['"]([^'"]+)['"]/);
          if (dataMatch) {
             body = dataMatch[2];
             if (method === 'GET') method = 'POST'; 
             try {
                 JSON.parse(body);
                 bodyType = 'json';
             } catch {
                 bodyType = 'none'; 
             }
          }

          if (url) {
              onUpdate({
                  method,
                  url,
                  headers,
                  bodyType: bodyType as any,
                  bodyTemplate: bodyType === 'json' ? body : undefined
              });
              setShowCurlModal(false);
              setCurlInput('');
              addToast('cURL 导入成功', 'success');
          } else {
              addToast('无法解析 URL', 'error');
          }

      } catch (e) {
          addToast('cURL 解析失败', 'error');
      }
  };

  // --- Test ---
  const handleTest = async () => {
      setIsTesting(true);
      setTestResponse(null);
      setTestError(null);

      try {
          const mockSystemContext: Record<string, any> = {
              '$session_id': 'test-session-uuid-1234',
              '$timestamp': Date.now().toString(),
              'env': envVars,
          };

          const testInputs: Record<string, any> = { ...mockSystemContext };
          parameters.forEach(p => {
              testInputs[p.key] = p.value || ''; 
          });

          // Use shared interpolation logic
          const finalUrl = interpolateString(apiConfig.url, testInputs);
          const finalHeaders: Record<string, string> = {};
          apiConfig.headers.forEach(h => {
              if (h.key) finalHeaders[h.key] = interpolateString(h.value, testInputs);
          });
          
          let finalBody = "";
          
          if (apiConfig.method !== 'GET') {
              if (apiConfig.bodyType === 'json' && apiConfig.bodyTemplate) {
                  finalBody = interpolateJSON(apiConfig.bodyTemplate, testInputs);
              } else if (apiConfig.bodyType === 'form-data') {
                  const entries = formDataEntries.map(e => ({
                      key: e.key,
                      value: interpolateString(e.value, testInputs)
                  }));
                  finalBody = JSON.stringify(entries);
                  finalHeaders['Content-Type'] = 'multipart/form-data';
              }
          }

          const res = await proxyRequest(apiConfig.method, finalUrl, finalHeaders, finalBody);
          
          if (!res.success) {
              throw new Error(res.error || `HTTP ${res.status} Error`);
          }

          let bodyData = res.body;
          try {
             if (bodyData && (bodyData.trim().startsWith('{') || bodyData.trim().startsWith('['))) {
                 bodyData = JSON.parse(bodyData);
             }
          } catch(e) {}

          setTestResponse({
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
              body: bodyData
          });
          addToast("请求执行成功", "success");

      } catch (e: any) {
          setTestError(e.message);
          addToast("请求执行失败", "error");
      } finally {
          setIsTesting(false);
      }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
          e.preventDefault();
          const target = e.target as HTMLTextAreaElement;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const value = target.value;
          target.value = value.substring(0, start) + '  ' + value.substring(end);
          target.selectionStart = target.selectionEnd = start + 2;
          onUpdate({ bodyTemplate: target.value });
      }
  };

  const handleFormatJSON = () => {
      try {
          const parsed = JSON.parse(apiConfig.bodyTemplate || '{}');
          onUpdate({ bodyTemplate: JSON.stringify(parsed, null, 2) });
          addToast("JSON 已格式化", "success");
      } catch (e) {
          addToast("无效的 JSON 格式", "error");
      }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-2 duration-200">
      
      {/* --- SMART INSERT PALETTE --- */}
      {parameters.length > 0 && (
          <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-black/60 backdrop-blur-md border-b border-white/5 flex items-center gap-3 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 mr-2">
                  <MousePointerClick className="w-3.5 h-3.5" /> 智能填入:
              </div>
              {parameters.map(p => (
                  <button
                      key={p.id}
                      onMouseDown={(e) => e.preventDefault()} // Prevent losing focus from the active input
                      onClick={() => handleInsertVariable(p.key)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs hover:bg-blue-500/20 hover:border-blue-500/40 transition-all shrink-0 group"
                      title="点击插入到光标位置"
                  >
                      <Variable className="w-3 h-3 text-blue-400 group-hover:text-blue-300" />
                      <span className="font-mono">{p.key}</span>
                  </button>
              ))}
          </div>
      )}

      {/* Endpoint Configuration */}
      <Card title="端点配置 (Endpoint)" variant="glass">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex gap-4">
            <div className="w-32 shrink-0">
                <Select 
                    label="Method"
                    options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => ({ label: m, value: m }))}
                    value={apiConfig.method}
                    onChange={(e) => onUpdate({ method: e.target.value as any })}
                />
            </div>
            <div className="flex-1 relative">
                 <Input 
                    label="URL (插值: {{var}})"
                    value={apiConfig.url}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                    onFocus={handleFocus}
                    className="font-mono text-blue-300 bg-black/40 border-white/10 pr-20"
                    placeholder="https://api.example.com/v1/resource"
                />
                <button 
                    onClick={() => setShowCurlModal(true)}
                    className="absolute top-7 right-2 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-zinc-300 px-2 py-1 rounded transition-colors border border-white/5 flex items-center gap-1"
                >
                    <Import className="w-3 h-3" /> cURL
                </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-white/5 rounded text-zinc-400">
                       <Zap className="w-4 h-4" />
                   </div>
                   <div>
                       <h4 className="text-sm font-medium text-zinc-200">流式响应 (Streaming)</h4>
                       <p className="text-[10px] text-zinc-500">
                           适用于 Server-Sent Events (SSE) 或分块传输的 API。
                       </p>
                   </div>
               </div>
               <Switch 
                    checked={apiConfig.stream || false}
                    onChange={(val) => onUpdate({ stream: val })}
               />
          </div>

          <div className="flex justify-end">
             <Button 
                onClick={handleTest} 
                variant="secondary" 
                className="h-9 text-xs px-3 whitespace-nowrap min-w-[6rem] border-white/10 bg-white/5 hover:bg-white/10"
                disabled={isTesting}
            >
                {isTesting ? <Loader2 className="w-3 h-3 animate-spin"/> : <><PlayCircle className="w-3 h-3 mr-2"/> 测试请求 (Test)</>}
             </Button>
          </div>
        </div>

        {/* Test Result Area */}
        {(testResponse || testError) && (
            <div className="mt-4 p-4 rounded-lg bg-black/40 border border-white/10 text-xs font-mono overflow-hidden animate-in slide-in-from-top-2 shadow-inner">
                <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${testError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        测试结果
                    </span>
                    <button onClick={() => { setTestResponse(null); setTestError(null); }} className="text-zinc-500 hover:text-white transition-colors"><XCircle className="w-4 h-4"/></button>
                </div>
                {testError ? (
                    <div className="text-red-400 p-2">{testError}</div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Badge variant={testResponse.status < 400 ? 'success' : 'error'}>
                                HTTP {testResponse.status}
                            </Badge>
                            <span className="text-zinc-500">{testResponse.statusText}</span>
                        </div>
                        <div className="max-h-[300px] overflow-auto text-blue-200 custom-scrollbar bg-black/20 p-3 rounded border border-white/5">
                            <pre>{typeof testResponse.body === 'string' ? testResponse.body : JSON.stringify(testResponse.body, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        )}
      </Card>

      {/* Headers Configuration */}
      <Card title="请求头 (Headers)" variant="glass">
        {apiConfig.headers.length === 0 && (
            <div className="text-sm text-zinc-600 mb-4 italic text-center py-2">暂无 Headers 配置。</div>
        )}
        {apiConfig.headers.map(h => (
            <div key={h.id} className="flex gap-3 mb-2 items-end">
                <div className="flex-1">
                    <Input placeholder="Key" value={h.key} onChange={(e) => updateHeader(h.id, 'key', e.target.value)} className="bg-black/20" onFocus={handleFocus} />
                </div>
                <div className="flex-1">
                    <Input placeholder="Value" value={h.value} onChange={(e) => updateHeader(h.id, 'value', e.target.value)} className="bg-black/20 font-mono text-blue-300" onFocus={handleFocus} />
                </div>
                <Button variant="ghost" onClick={() => removeHeader(h.id)} className="text-zinc-500 hover:text-red-400 mb-[1px] hover:bg-red-500/10">
                    <Trash className="w-4 h-4" />
                </Button>
            </div>
        ))}
        <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={addHeader} icon={Plus} className="w-full border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300">添加 Header</Button>
        </div>
      </Card>

      {/* Body Configuration */}
      <Card title="请求体 (Body)" variant="glass">
        <div className="mb-4 w-full">
            <Select 
                label="Content-Type"
                options={[
                    {label: 'JSON (application/json)', value: 'json'}, 
                    {label: 'Form Data (multipart/form-data)', value: 'form-data'},
                    {label: 'No Body', value: 'none'}
                ]}
                value={apiConfig.bodyType}
                onChange={(e) => onUpdate({ bodyType: e.target.value as any })}
            />
        </div>
        
        {/* JSON EDITOR */}
        {apiConfig.bodyType === 'json' && (
            <div className="space-y-2 group">
                <div className="relative">
                    <div className="absolute top-2 right-2 z-10 opacity-50 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button 
                            onClick={handleFormatJSON}
                            className="p-1.5 bg-black/40 rounded hover:bg-black/60 text-[10px] text-zinc-300 border border-white/10 backdrop-blur-sm"
                            title="格式化 JSON"
                        >
                            Format
                        </button>
                    </div>
                    <Textarea 
                        className="font-mono min-h-[300px] text-xs leading-relaxed bg-black/30 border-white/5 focus:border-primary/50 text-blue-300 selection:bg-blue-500/30"
                        value={apiConfig.bodyTemplate || ''}
                        onChange={(e) => onUpdate({ bodyTemplate: e.target.value })}
                        onKeyDown={handleKeyDown}
                        onFocus={handleFocus}
                        placeholder="{&#10;  &quot;key&quot;: &quot;{{value}}&quot;&#10;}"
                        spellCheck={false}
                    />
                    <div className="absolute bottom-2 right-2 text-zinc-600 pointer-events-none text-[10px]">
                        <FileJson className="w-3 h-3 inline-block mr-1" />
                        JSON Mode
                    </div>
                </div>
            </div>
        )}

        {/* FORM DATA EDITOR */}
        {apiConfig.bodyType === 'form-data' && (
            <div className="space-y-4">
                <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-3">
                    <div className="grid grid-cols-12 gap-3 text-[10px] font-bold text-zinc-500 mb-1 px-1 uppercase tracking-wider">
                        <div className="col-span-4">字段名 (Key)</div>
                        <div className="col-span-7">值 (Text or {"{{file}}"})</div>
                        <div className="col-span-1"></div>
                    </div>
                    {formDataEntries.map(entry => (
                        <div key={entry.id} className="grid grid-cols-12 gap-3 items-center">
                             <div className="col-span-4">
                                 <Input 
                                    placeholder="key" 
                                    value={entry.key} 
                                    onChange={e => updateFormEntry(entry.id, 'key', e.target.value)}
                                    className="h-8 text-xs bg-black/30"
                                    onFocus={handleFocus}
                                 />
                             </div>
                             <div className="col-span-7">
                                 <Input 
                                    placeholder="value" 
                                    value={entry.value} 
                                    onChange={e => updateFormEntry(entry.id, 'value', e.target.value)}
                                    className="h-8 text-xs font-mono text-blue-300 bg-black/30"
                                    onFocus={handleFocus}
                                 />
                             </div>
                             <div className="col-span-1 text-right">
                                 <Button variant="ghost" size="sm" onClick={() => removeFormEntry(entry.id)} className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400">
                                     <Trash className="w-3.5 h-3.5" />
                                 </Button>
                             </div>
                        </div>
                    ))}
                    <div className="pt-2">
                        <Button size="sm" variant="secondary" onClick={addFormEntry} icon={ListPlus} className="w-full border-dashed border-zinc-700 opacity-50 hover:opacity-100">
                            添加字段
                        </Button>
                    </div>
                </div>
            </div>
        )}
      </Card>

      {/* cURL Import Modal */}
      <Modal
         isOpen={showCurlModal}
         onClose={() => setShowCurlModal(false)}
         title="从 cURL 导入"
         width="lg"
         footer={
             <>
                 <Button variant="ghost" onClick={() => setShowCurlModal(false)}>取消</Button>
                 <Button onClick={handleImportCurl}>导入</Button>
             </>
         }
      >
          <div className="space-y-4">
              <p className="text-sm text-zinc-400">粘贴 cURL 命令以自动配置 API 请求。</p>
              <Textarea 
                 className="font-mono text-xs bg-black/40 min-h-[200px]"
                 placeholder="curl -X POST https://api.example.com/..."
                 value={curlInput}
                 onChange={(e) => setCurlInput(e.target.value)}
              />
          </div>
      </Modal>
    </div>
  );
};
