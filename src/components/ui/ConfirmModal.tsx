import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'red' | 'blue' | 'green';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirmar',
  cancelText = 'Cancelar', 
  confirmColor = 'red',
  onConfirm, 
  onCancel
}) => {
  if (!isOpen) return null;
  
  const colors = {
    red: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500',
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    green: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-fadeIn z-10 transition-all">
        <h3 className="font-extrabold text-slate-800 text-lg mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-1.5 px-4 text-white rounded-xl font-bold text-sm transition-colors focus:outline-none focus:ring-2 ${colors[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
