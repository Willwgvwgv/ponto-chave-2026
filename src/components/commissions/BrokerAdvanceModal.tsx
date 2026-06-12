import React, { useState, useEffect } from "react";
import { X, TrendingDown, TrendingUp, RefreshCw, Calendar, DollarSign, FileText } from "lucide-react";

interface BrokerAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerId: string;
  brokerName: string;
  onSave: (data: {
    value: number;
    type: "Adiantamento" | "Desconto" | "Acerto";
    description: string;
    date: string;
  }) => void;
}

export const BrokerAdvanceModal: React.FC<BrokerAdvanceModalProps> = ({
  isOpen,
  onClose,
  brokerId,
  brokerName,
  onSave
}) => {
  const [value, setValue] = useState<number>(0);
  const [type, setType] = useState<"Adiantamento" | "Desconto" | "Acerto">("Adiantamento");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValue(0);
      setType("Adiantamento");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value <= 0) {
      alert("Por favor, insira um valor válido maior que zero.");
      return;
    }
    if (!description.trim()) {
      alert("Por favor, insira uma descrição do lançamento.");
      return;
    }
    if (!date) {
      alert("Por favor, selecione uma data.");
      return;
    }

    onSave({
      value,
      type,
      description,
      date
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            {type === "Adiantamento" && <TrendingUp className="w-5 h-5 text-indigo-600" />}
            {type === "Desconto" && <TrendingDown className="w-5 h-5 text-rose-600" />}
            {type === "Acerto" && <RefreshCw className="w-5 h-5 text-emerald-600" />}
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Lançar Movimentação</h3>
          </div>
          <button onClick={onClose} className="p-1 px-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl">
            <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Corretor Beneficiário</span>
            <strong className="text-sm font-extrabold text-slate-800">{brokerName}</strong>
          </div>

          {/* Tipo de movimentação */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Tipo de Operação
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType("Adiantamento")}
                className={`py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  type === "Adiantamento"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                Adiantar
              </button>
              <button
                type="button"
                onClick={() => setType("Desconto")}
                className={`py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  type === "Desconto"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                Desconto
              </button>
              <button
                type="button"
                onClick={() => setType("Acerto")}
                className={`py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  type === "Acerto"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                Acerto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Valor (R$) */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Valor (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={value || ""}
                  onChange={(e) => setValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-950 font-black focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Data */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Data do Lançamento
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Descrição / Justificativa
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Adiantamento solicitado por PIX para despesas pessoais"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 font-medium focus:outline-none transition-colors"
            />
          </div>

          {/* Info do Tipo */}
          <div className="p-3 bg-slate-50 rounded-2xl text-[10.5px] text-slate-500 font-medium leading-relaxed border border-slate-100">
            {type === "Adiantamento" && (
              <span>💡 Um <b>Adiantamento</b> de comissão aumenta o valor de débito (a descontar) e será deduzido do saldo líquido a pagar do corretor.</span>
            )}
            {type === "Desconto" && (
              <span>💡 Um <b>Desconto</b> de comissão deduzirá diretamente o saldo de recebíveis e o valor líquido a pagar do corretor.</span>
            )}
            {type === "Acerto" && (
              <span>💡 Um <b>Acerto</b> é uma compensação financeira que abate o débito atual/adiantamento lançado anteriormente.</span>
            )}
          </div>

          {/* Button Trigger Footer in Form */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              type="button"
              className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 bg-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/15 transition-all text-center cursor-pointer"
            >
              Lançar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
