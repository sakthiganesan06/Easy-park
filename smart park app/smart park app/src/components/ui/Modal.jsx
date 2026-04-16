import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={`
          relative w-full sm:max-w-md bg-navy-800 border border-white/10
          rounded-t-3xl sm:rounded-2xl p-6
          animate-slide-up z-10
          max-h-[85vh] overflow-y-auto
          ${className}
        `}
      >
        {/* Handle bar for mobile */}
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
