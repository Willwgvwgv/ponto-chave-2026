import React, { useState, useEffect } from "react";
import { X, DollarSign, FileText, Upload } from "lucide-react";
import { BrokerSplit } from "../../types";
import { round2 } from "../../hooks/useQueries";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  split: BrokerSplit;
  onRegisterPayment: (
    splitId: string,
    paidValue: number,
    isPartial: boolean,
    remainingValue: number,
    newForecastDate: string,
    paymentMethod: "PIX" | "TED" | "CHEQUE",
    notes: string,
    receiptData: string | null
  ) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  split,
  onRegisterPayment
}) => {
  const [totalValue, setTotalValue] = useState(split.calculated_value || 0);
  const [paidValue, setPaidValue] = useState(split.calculated_value || 0);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "TED" | "CHEQUE">("PIX");
  const [notes, setNotes] = useState("");
  const [newForecastDate, setNewForecastDate] = useState("");
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (split) {
      setTotalValue(split.calculated_value);
      setPaidValue(split.calculated_value);
      // Previsão padrão daqui a 30 dias para o saldo restante, se aplicável
      const defaultRest = new Date();
      defaultRest.setDate(defaultRest.getDate() + 30);
      setNewForecastDate(defaultRest.toISOString().split("T")[0]);
      setNotes("");
      setReceiptBase64(null);
      setReceiptFileName(null);
    }
  }, [split]);

  if (!isOpen) return null;

  const isPartial = round2(paidValue) < round2(totalValue);
  const remainingValue = round2(totalValue - paidValue);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleFile = (file: File) => {
    if (!file) return;
    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.onerror = () => {
      console.error("Erro ao converter arquivo para base64");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (paidValue <= 0) {
      alert("O valor pago deve ser maior que zero.");
      return;
    }

    if (paidValue > totalValue) {
      alert("O valor pago não pode exceder o valor total do split.");
      return;
    }

    if (isPartial && !newForecastDate) {
      alert("Para pagamentos parciais, insira uma data de previsão para o saldo restante.");
      return;
    }

    onRegisterPayment(
      split.id,
      paidValue,
      isPartial,
      remainingValue,
      newForecastDate,
      paymentMethod,
      notes,
      receiptBase64
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Registrar Pagamento</h3>
          </div>
          <button onClick={onClose} className="p-1 px-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh] scrollbar-hide">
          
          <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl flex items-center justify-between">
            <div>
              <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Corretor</span>
              <strong className="text-sm font-extrabold text-slate-800">{split.broker_name}</strong>
              <span className="text-xs text-slate-500 font-medium ml-1.5 opacity-80">({split.role})</span>
            </div>
            <div className="text-right">
              <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Dívida Total</span>
              <strong className="text-base font-black text-slate-800">{formatCurrency(totalValue)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Valor Pago input */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Valor Pago (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={paidValue}
                  onChange={(e) => setPaidValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-950 font-black focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Altere para menos para registrar um <b>pagamento parcial</b>.
              </p>
            </div>

            {/* Método de pagamento */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Método de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-100 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
              >
                <option value="PIX">PIX</option>
                <option value="TED">TED / Transferência Bancária</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          {/* Seção Parcial */}
          {isPartial && (
            <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center text-xs text-orange-900 font-extrabold uppercase">
                <span>⚠️ Pagamento Parcial Detectado</span>
                <span className="bg-orange-100 text-orange-800 font-black px-2 py-0.5 rounded text-[9px]">
                  Restante: {formatCurrency(remainingValue)}
                </span>
              </div>
              
              <p className="text-[11px] text-orange-850 font-semibold">
                Um novo split de saldo devedor de <strong className="font-bold">{formatCurrency(remainingValue)}</strong> será automaticamente aberto para {split.broker_name} como parcela adiantada / complementar.
              </p>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-orange-800 mb-1">
                  Previsão de Pagamento do Restante
                </label>
                <input
                  type="date"
                  value={newForecastDate}
                  onChange={(e) => setNewForecastDate(e.target.value)}
                  className="w-full bg-white border border-orange-200 focus:border-orange-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Observações / Notas Internas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pagamento referente à primeira parcela da construtora"
              rows={2}
              className="w-full bg-slate-50 border border-slate-100 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 font-medium focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Arquivo drag drop comprovante */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Comprovante de Operação (Opcional)
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer group ${
                isDragOver ? "border-emerald-500 bg-emerald-50/40" : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
              }`}
              onClick={() => document.getElementById("receipt-file-input")?.click()}
            >
              <input
                id="receipt-file-input"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className={`w-6 h-6 ${isDragOver ? "text-emerald-500" : "text-slate-450 group-hover:text-emerald-600"} transition-colors`} />
              
              {receiptFileName ? (
                <div className="text-xs text-slate-800 font-bold flex items-center justify-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  {receiptFileName}
                </div>
              ) : (
                <>
                  <span className="text-xs text-slate-700 font-black">Arraste o arquivo ou toque para selecionar</span>
                  <span className="text-[10px] text-slate-405 font-medium">Imagens de recibo ou PDF até 5MB</span>
                </>
              )}
            </div>
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
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/15 transition-all text-center cursor-pointer"
            >
              Confirmar Pagamento
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
