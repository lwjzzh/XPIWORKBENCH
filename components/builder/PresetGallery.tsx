
import React from 'react';
import { Bot, Zap, Globe, Cpu, CheckCircle2 } from 'lucide-react';
import { Component } from '../../types/schema';
import { Button } from '../ui/Common';

interface PresetGalleryProps {
  onSelect: (component: Component) => void;
  onCancel: () => void;
}

const PRESETS: Partial<Component>[] = [
  {
    name: '空白请求 (Empty Request)',
    description: '从头开始创建一个空白的 GET 请求。',
    apiConfig: {
      method: 'GET',
      url: '',
      headers: [],
      bodyType: 'none',
    },
    parameters: []
  },
  {
    name: 'OpenAI Chat',
    description: '使用 GPT-3.5 或 GPT-4 模型生成文本。',
    apiConfig: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json' },
        { id: 'h2', key: 'Authorization', value: 'Bearer {{api_key}}' }
      ],
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "{{prompt}}" }]
      }, null, 2)
    },
    parameters: [
      { id: 'p1', key: 'api_key', label: 'OpenAI API Key', uiType: 'password', required: true, value: '', isVisible: true },
      { id: 'p2', key: 'prompt', label: '提示词 (Prompt)', uiType: 'textarea', required: true, value: 'Hello, AI!', isVisible: true }
    ]
  },
  {
    name: 'n8n Webhook',
    description: '触发 n8n 自动化工作流。',
    apiConfig: {
      method: 'POST',
      url: 'https://n8n.example.com/webhook/{{webhook_id}}',
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json' }
      ],
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        data: "{{payload}}",
        timestamp: "{{timestamp}}"
      }, null, 2)
    },
    parameters: [
      { id: 'n1', key: 'webhook_id', label: 'Webhook UUID', uiType: 'input', required: true, value: '', isVisible: true },
      { id: 'n2', key: 'payload', label: '数据载荷 (Payload)', uiType: 'textarea', value: '', isVisible: true }
    ]
  },
  {
    name: 'RunningHub Task',
    description: '向 RunningHub API 提交任务。',
    apiConfig: {
      method: 'POST',
      url: 'https://www.runninghub.cn/task/create',
      headers: [
        { id: 'h1', key: 'Content-Type', value: 'application/json' },
        { id: 'h2', key: 'Authorization', value: 'Bearer {{token}}' }
      ],
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        taskName: "{{task_name}}",
        params: {}
      }, null, 2)
    },
    parameters: [
      { id: 'r1', key: 'token', label: 'RunningHub Token', uiType: 'password', value: '', isVisible: true },
      { id: 'r2', key: 'task_name', label: '任务名称', uiType: 'input', value: '', isVisible: true }
    ]
  }
];

export const PresetGallery: React.FC<PresetGalleryProps> = ({ onSelect, onCancel }) => {
  const handleSelect = (preset: Partial<Component>) => {
    const component: Component = {
      id: crypto.randomUUID(),
      name: preset.name || 'New Component',
      description: preset.description || '',
      apiConfig: preset.apiConfig!,
      parameters: preset.parameters?.map(f => ({ ...f, id: crypto.randomUUID() })) || []
    };
    onSelect(component);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
           <h3 className="text-xl font-bold text-white">选择组件模版</h3>
           <p className="text-sm text-zinc-400 mt-1">快速开始您的 API 配置。</p>
        </div>
        <Button variant="ghost" onClick={onCancel} className="hover:bg-white/10">取消</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESETS.map((preset, idx) => (
          <div 
            key={idx}
            className="group relative flex flex-col p-5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-all hover:scale-[1.02] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            onClick={() => handleSelect(preset)}
          >
            <div className="flex items-start justify-between mb-4">
               <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-primary group-hover:text-white group-hover:border-primary/50 transition-colors shadow-inner">
                  {idx === 0 ? <Cpu className="w-6 h-6"/> : idx === 1 ? <Bot className="w-6 h-6"/> : idx === 2 ? <Zap className="w-6 h-6"/> : <Globe className="w-6 h-6"/>}
               </div>
               <CheckCircle2 className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>
            
            <h4 className="font-semibold text-zinc-100 mb-1.5">{preset.name}</h4>
            <p className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">{preset.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
