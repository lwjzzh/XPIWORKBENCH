
import React, { useState, useMemo } from 'react';
import { FileJson, Eye, Image as ImageIcon, Film, Music, Copy, Check, Terminal, FileText, Code2, Monitor } from 'lucide-react';

interface ResultRendererProps {
  result: any;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
  duration?: number;
}

// --- Helper: Media Detection ---
const getMediaFromObject = (obj: any): { type: 'image' | 'video' | 'audio', url: string }[] => {
  if (!obj) return [];
  const media: { type: 'image' | 'video' | 'audio', url: string }[] = [];
  
  const traverse = (item: any, depth = 0) => {
    if (depth > 10 || !item) return; 
    
    if (typeof item === 'string') {
        if (item.match(/\.(jpeg|jpg|gif|png|webp|bmp)($|\?)/i) || item.startsWith('data:image')) {
            media.push({ type: 'image', url: item });
        } else if (item.match(/\.(mp4|webm|ogg|mov)($|\?)/i)) {
            media.push({ type: 'video', url: item });
        } else if (item.match(/\.(mp3|wav|m4a)($|\?)/i)) {
            media.push({ type: 'audio', url: item });
        }
        return;
    }

    if (typeof item === 'object') {
      if (item.image_url) media.push({ type: 'image', url: item.image_url });
      if (item.video_url) media.push({ type: 'video', url: item.video_url });
      if (item.audio_url) media.push({ type: 'audio', url: item.audio_url });
      if (item.url && typeof item.url === 'string') traverse(item.url, depth + 1);
      Object.values(item).forEach(val => traverse(val, depth + 1));
    }
  };

  traverse(obj);
  return media.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
};

const getTextContent = (obj: any): string => {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (obj.content && typeof obj.content === 'string') return obj.content;
    if (obj.text && typeof obj.text === 'string') return obj.text;
    if (obj.message && typeof obj.message === 'string') return obj.message;
    if (obj.message?.content) return getTextContent(obj.message.content);
    if (obj.choices && Array.isArray(obj.choices)) return obj.choices.map((c: any) => getTextContent(c.message || c.text || c)).join('\n\n');
    try { return JSON.stringify(obj, null, 2); } catch { return '[Invalid Object]'; }
};

export const ResultRenderer: React.FC<ResultRendererProps> = ({ result, status, error, duration }) => {
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [copied, setCopied] = useState(false);

  const mediaItems = useMemo(() => status === 'success' && result ? getMediaFromObject(result) : [], [result, status]);
  const textContent = useMemo(() => status === 'success' && result ? getTextContent(result) : '', [result, status]);

  const handleCopy = () => {
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'idle') {
    return (
      <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-zinc-600 opacity-50">
        <Monitor className="w-12 h-12 mb-3 stroke-[1.5]" />
        <p className="text-sm font-mono tracking-wide">WAITING FOR SIGNAL...</p>
      </div>
    );
  }

  if (status === 'error') {
     return (
        <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-5 text-red-200 text-sm font-mono overflow-auto h-full shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]">
            <div className="flex items-center gap-2 mb-3 text-red-400 font-bold uppercase tracking-widest text-xs border-b border-red-500/20 pb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_red]"></span>
                System Error
            </div>
            <pre className="whitespace-pre-wrap">{error || 'Unknown error occurred'}</pre>
        </div>
     );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Toolbar - Integrated style */}
      <div className="flex items-center justify-between px-2 pb-4 shrink-0">
         <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/5">
             <button 
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${viewMode === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
             >
                <Eye className="w-3 h-3" /> Preview
             </button>
             <button 
                onClick={() => setViewMode('json')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${viewMode === 'json' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
             >
                <Code2 className="w-3 h-3" /> Raw JSON
             </button>
         </div>

         <div className="flex items-center gap-3">
             {status === 'running' && (
                 <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary animate-pulse uppercase tracking-wider">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                     Processing
                 </span>
             )}
             {status === 'success' && duration && (
                 <span className="text-[10px] text-zinc-600 font-mono bg-white/5 px-2 py-1 rounded">{duration}ms</span>
             )}
             <button 
                onClick={handleCopy}
                className="text-zinc-500 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-md"
                title="Copy Output"
             >
                 {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
             </button>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
         {viewMode === 'preview' ? (
             <div className="space-y-6 animate-in fade-in duration-300">
                 {/* Text Content */}
                 {textContent ? (
                     <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-sans text-zinc-300 leading-relaxed selection:bg-primary/30 selection:text-white">
                         {textContent}
                         {status === 'running' && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-primary animate-pulse"/>}
                     </div>
                 ) : !mediaItems.length && (
                     <div className="flex flex-col items-center justify-center h-32 text-zinc-700">
                        <FileText className="w-8 h-8 mb-2 opacity-20" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">No Text Output</span>
                     </div>
                 )}

                 {/* Media Grid */}
                 {mediaItems.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-white/5 pt-6">
                         {mediaItems.map((media, idx) => (
                             <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-lg transition-all hover:border-primary/30 hover:shadow-primary/5">
                                 {media.type === 'image' && (
                                     <div className="relative aspect-video flex items-center justify-center bg-black/20">
                                         <img src={media.url} alt="Result" className="w-full h-full object-contain" />
                                         <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 border border-white/5 font-bold uppercase tracking-wider">
                                             <ImageIcon className="w-3 h-3" /> Image
                                         </div>
                                     </div>
                                 )}
                                 {media.type === 'video' && (
                                     <div className="relative aspect-video bg-black">
                                        <video src={media.url} controls className="w-full h-full" />
                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 border border-white/5 font-bold uppercase tracking-wider pointer-events-none">
                                             <Film className="w-3 h-3" /> Video
                                         </div>
                                     </div>
                                 )}
                                 {media.type === 'audio' && (
                                     <div className="p-4 flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/5">
                                             <Music className="w-5 h-5" />
                                         </div>
                                         <div className="flex-1">
                                             <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">Audio Output</div>
                                             <audio src={media.url} controls className="h-8 w-full max-w-[240px] opacity-80 hover:opacity-100 transition-opacity" />
                                         </div>
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 )}
             </div>
         ) : (
             <div className="bg-black/30 p-4 rounded-xl border border-white/5 font-mono text-xs text-blue-300 whitespace-pre-wrap break-all shadow-inner">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
             </div>
         )}
      </div>
    </div>
  );
};
