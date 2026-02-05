
import React, { useRef, useEffect, useState } from 'react';
import { Plus, Box, Settings2, Trash2, Zap, GripVertical } from 'lucide-react';
import { Component } from '../../types/schema';
import { Badge } from '../ui/Common';

interface AppAssemblerProps {
  components: Component[];
  onAddComponent: () => void;
  onEditComponent: (id: string) => void;
  onDeleteComponent: (id: string) => void;
  onReorderComponents: (fromIndex: number, toIndex: number) => void;
}

export const AppAssembler: React.FC<AppAssemblerProps> = ({ 
  components, 
  onAddComponent, 
  onEditComponent, 
  onDeleteComponent,
  onReorderComponents
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Auto-scroll to end when adding components
  useEffect(() => {
    // Only scroll if not dragging and a new component was likely added (length increased)
    // For simplicity, we just check if we are not dragging.
    if (containerRef.current && draggedIndex === null) {
        // Optional: logic to detect addition vs initial load could be added here
        // containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [components.length, draggedIndex]);

  // --- DnD Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); // Necessary to allow dropping
      if (draggedIndex === null || draggedIndex === index) return;
      setDragOverIndex(index);
  };

  const handleDragLeave = () => {
      // setDragOverIndex(null); 
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
          onReorderComponents(draggedIndex, index);
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
  };

  const handleDragEnd = () => {
      setDraggedIndex(null);
      setDragOverIndex(null);
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-transparent h-full flex items-center px-10 relative select-none" ref={containerRef}>
        
        {/* START NODE */}
        <div className="flex items-center gap-4 shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center text-zinc-600 font-mono text-xs select-none shadow-xl hover:border-primary/50 hover:text-primary transition-colors cursor-default backdrop-blur-sm">
                START
            </div>
            <div className="h-0.5 w-12 bg-zinc-800"></div>
        </div>

        {/* COMPONENT NODES */}
        {components.map((comp, index) => {
          const isDragging = draggedIndex === index;
          const isOver = dragOverIndex === index;
          
          return (
          <div 
            key={comp.id} 
            className={`flex items-center gap-4 shrink-0 transition-all duration-300 ${isDragging ? 'opacity-30 scale-95 grayscale' : 'opacity-100'} ${isOver ? 'translate-x-4' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            {/* Drop Indicator Line (Visual Feedback) */}
            {isOver && draggedIndex !== null && index < draggedIndex && (
                <div className="w-1 h-32 rounded-full bg-primary absolute -left-2 z-50 shadow-[0_0_10px_#3b82f6]"></div>
            )}
            {isOver && draggedIndex !== null && index > draggedIndex && (
                <div className="w-1 h-32 rounded-full bg-primary absolute -right-2 z-50 shadow-[0_0_10px_#3b82f6]"></div>
            )}

            {/* The Card Node */}
            <div 
                className={`group relative w-[280px] h-[160px] glass-panel rounded-2xl p-5 cursor-default flex flex-col justify-between border-transparent hover:border-white/10 transition-all ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
                onClick={(e) => { e.stopPropagation(); onEditComponent(comp.id); }}
            >
                {/* Drag Handle */}
                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing text-zinc-400 p-1">
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Header */}
                <div className="flex justify-between items-start pl-6"> 
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center shadow-inner shrink-0">
                            <Box className="w-5 h-5 text-primary" />
                         </div>
                         <div className="flex flex-col min-w-0">
                             <div className="text-[10px] font-mono text-zinc-500 mb-0.5 tracking-wider">STEP {index + 1}</div>
                             <h3 className="font-semibold text-zinc-100 truncate w-[140px] text-sm">{comp.name}</h3>
                         </div>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-2 pl-2">
                     <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono border-white/10 bg-black/20 shrink-0">{comp.apiConfig.method}</Badge>
                        <span className="text-[10px] text-zinc-500 truncate font-mono opacity-70 flex-1" title={comp.apiConfig.url}>
                            {comp.apiConfig.url || '未配置 URL'}
                        </span>
                     </div>
                     <div className="text-[10px] text-zinc-400">
                         {comp.parameters.length > 0 ? (
                             <span className="flex items-center gap-1">
                                 <Zap className="w-3 h-3 text-yellow-500/70" /> {comp.parameters.length} 个参数已配置
                             </span>
                         ) : (
                             <span className="italic opacity-50">无参数</span>
                         )}
                     </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                         onClick={(e) => { e.stopPropagation(); onDeleteComponent(comp.id); }}
                         className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                         title="删除步骤"
                     >
                         <Trash2 className="w-3.5 h-3.5" />
                     </button>
                     <button 
                         onClick={(e) => { e.stopPropagation(); onEditComponent(comp.id); }}
                         className="p-1.5 rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/10 transition-colors"
                         title="配置步骤"
                     >
                         <Settings2 className="w-3.5 h-3.5" />
                     </button>
                </div>
            </div>

            {/* Connector */}
            <div className="h-0.5 w-12 bg-zinc-800 flex items-center justify-center">
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
            </div>

          </div>
        )})}

        {/* ADD BUTTON */}
        <div className="shrink-0 animate-in fade-in duration-500">
            <button 
                onClick={onAddComponent}
                className="w-16 h-16 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-primary hover:bg-primary/5 text-zinc-600 hover:text-primary transition-all flex items-center justify-center group"
                title="添加步骤"
            >
                <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </button>
        </div>
        
        {/* Spacer for right padding */}
        <div className="w-20 shrink-0"></div>
    </div>
  );
};
