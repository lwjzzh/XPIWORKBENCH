
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon, X } from 'lucide-react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon: Icon, 
  size = 'md',
  className = '',
  ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)] hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.6)] border border-primary/50",
    secondary: "bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-200 backdrop-blur-sm",
    ghost: "hover:bg-white/5 text-zinc-400 hover:text-zinc-200",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`mr-2 ${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full group">
      {label && <label className="text-xs font-medium text-zinc-500 group-focus-within:text-primary transition-colors uppercase tracking-wider">{label}</label>}
      <input
        className={`flex h-10 w-full rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-700 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:bg-black/40 focus-visible:shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)] transition-all disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    </div>
  );
};

// --- Textarea ---
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, className = '', ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5 w-full group">
      {label && <label className="text-xs font-medium text-zinc-500 group-focus-within:text-primary transition-colors uppercase tracking-wider">{label}</label>}
      <textarea
        ref={ref}
        className={`flex min-h-[80px] w-full rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200 ring-offset-background placeholder:text-zinc-700 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:bg-black/40 focus-visible:shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)] transition-all disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = 'Textarea';

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full group">
      {label && <label className="text-xs font-medium text-zinc-500 group-focus-within:text-primary transition-colors uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <select
          className={`flex h-10 w-full appearance-none rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:bg-black/40 focus-visible:shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)] transition-all disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200 py-1">{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-600 group-hover:text-zinc-400 transition-colors">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>
    </div>
  );
};

// --- Switch ---
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, className = '' }) => {
  return (
    <label className={`relative inline-flex items-center cursor-pointer ${className}`}>
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white shadow-inner border border-white/5 peer-checked:border-primary/50"></div>
    </label>
  );
};

// --- Card (Glassmorphic) ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    variant?: 'default' | 'glass';
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, variant='default', ...props }) => {
  const contentPadding = className.includes('p-0') ? '' : 'p-6';
  const bgClass = variant === 'glass' 
    ? "glass-panel" 
    : "bg-surface border border-white/5";

  return (
    <div className={`rounded-xl shadow-sm ${bgClass} ${className}`} {...props}>
      {title && (
        <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b border-white/5">
          <h3 className="font-semibold leading-none tracking-tight text-zinc-100">{title}</h3>
        </div>
      )}
      <div className={contentPadding}>{children}</div>
    </div>
  );
};

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'outline' | 'success' | 'error'; className?: string }> = ({ children, variant = 'default', className = '' }) => {
  const styles = {
    default: "bg-primary/20 text-blue-300 border-transparent",
    outline: "text-zinc-400 border-zinc-700 bg-transparent",
    success: "bg-green-500/10 text-green-400 border-green-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <div className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${styles[variant]} ${className}`}>
      {children}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, width = 'md' }) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const widths = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    return createPortal(
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => { if(e.target === overlayRef.current) onClose(); }}
            ref={overlayRef}
        >
            <div className={`glass-panel rounded-xl shadow-2xl w-full mx-4 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-white/10 ${widths[width]}`} role="dialog">
                <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {footer && (
                    <div className="p-4 border-t border-white/5 bg-black/20 rounded-b-xl flex justify-end gap-3 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
