
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { create } from 'zustand';

// --- Toast Store ---
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000); // Auto dismiss after 3s
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// --- Toast Component ---
export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] border backdrop-blur-xl animate-in slide-in-from-right-10 fade-in duration-300 min-w-[320px] max-w-[400px] ${
            toast.type === 'success' ? 'bg-black/60 border-green-500/30 text-green-400' :
            toast.type === 'error' ? 'bg-black/60 border-red-500/30 text-red-400' :
            'bg-black/60 border-white/10 text-zinc-200'
          }`}
        >
          {toast.type === 'success' && <div className="p-1 rounded-full bg-green-500/20"><CheckCircle2 className="w-4 h-4" /></div>}
          {toast.type === 'error' && <div className="p-1 rounded-full bg-red-500/20"><AlertCircle className="w-4 h-4" /></div>}
          {toast.type === 'info' && <div className="p-1 rounded-full bg-blue-500/20"><Info className="w-4 h-4" /></div>}
          
          <span className="text-sm font-medium flex-1 leading-snug">{toast.message}</span>
          
          <button onClick={() => removeToast(toast.id)} className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};
