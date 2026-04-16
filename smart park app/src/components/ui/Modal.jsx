import { X } from 'lucide-react';
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  const titleId = useId();
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      {/* Backdrop — above app chrome (Navbar/BottomNav use z-[1300]) */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`
          relative z-10 w-full sm:max-w-md bg-navy-800 border border-white/10
          rounded-t-3xl sm:rounded-2xl p-6
          animate-slide-up shadow-2xl
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id={titleId} className="text-lg font-bold text-white min-w-0 pr-2">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>,
    document.body
  );
}
