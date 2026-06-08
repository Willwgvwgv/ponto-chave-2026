import React, { useState } from "react";
import { X, Calendar } from "lucide-react";

interface ForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  onSave: (newDate: string) => void;
  brokerName: string;
}

export const ForecastModal: React.FC<ForecastModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  onSave,
  brokerName
}) => {
  const [newDate, setNewDate] = useState(currentDate || new Date().toISOString().split("T")[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Reagendar Previsão</h3>
          </div>
          <button onClick={onClose} className="p-1 px-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 font-medium">
            Selecione uma nova data de previsão de pagamento para a comissão de <strong className="text-slate-800 font-bold">{brokerName}</strong>.
          </p>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Previsão de Pagamento
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            type="button"
            className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 bg-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onSave(newDate);
              onClose();
            }}
            type="button"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
          >
            Salvar
          </button>
        </div>

      </div>
    </div>
  );
};
