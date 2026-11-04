'use client';

import React from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 text-amber-700 font-semibold mb-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>

        <p className="mt-3 rounded-md border-l-2 border-l-amber-500 bg-amber-50/50 p-3 text-sm leading-relaxed text-slate-700">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3 font-mono text-xs">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
          >
            CANCEL
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
          >
            {isLoading ? 'EXECUTING...' : 'CONFIRM ACTION'}
          </button>
        </div>
      </div>
    </div>
  );
};
