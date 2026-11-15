'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  headerAccent?: string;
}

export function NeoModal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  headerAccent,
}: NeoModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[96vw] h-[92vh]',
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full ${sizeClasses} max-h-[92vh] flex flex-col rounded-lg bg-[var(--m-panel)] border border-[var(--m-line)] shadow-2xl shadow-black/70 overflow-hidden text-[var(--m-text)] relative`}
      >
        {/* Optional Header Accent Bar */}
        {headerAccent && (
          <div className="h-1 w-full" style={{ backgroundColor: headerAccent }} />
        )}

        {/* Modal Header */}
        {(title || subtitle) && (
          <div className="flex items-center justify-between border-b border-[var(--m-line)] px-5 py-3.5 bg-[var(--m-panel)]/90">
            <div>
              {title && (
                <h3 className="font-bold text-base sm:text-lg text-[var(--m-text)] uppercase tracking-wide">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-[var(--m-dim)] font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded flex items-center justify-center text-[var(--m-dim)] hover:text-[var(--m-text)] hover:bg-[var(--m-raised)] transition-colors"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
