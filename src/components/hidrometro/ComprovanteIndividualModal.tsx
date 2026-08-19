import React, { useState } from "react";
import { 
  X, 
  Send, 
  Printer, 
  Copy, 
  Check, 
  Droplet, 
  Building2, 
  Calendar, 
  User, 
  Phone, 
  Eye, 
  Image as ImageIcon,
  MessageCircle,
  Share2
} from "lucide-react";
import { FaturaHidrometro, LeituraUnidade, CompanySettings } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ComprovanteIndividualModalProps {
  isOpen: boolean;
  onClose: () => void;
  fatura: FaturaHidrometro | null;
  initialUnidadeId?: string | null;
  onOpenFotoViewer: (url: string, titulo: string, subtitulo: string) => void;
  companySettings?: CompanySettings | null;
}

const formatUnitLabel = (numStr: string) => {
  if (!numStr) return "Unidade";
  const trimmed = numStr.trim();
  if (/^(apto|apartamento|unidade|bloco|sala|loja)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `Apto ${trimmed}`;
};

export const ComprovanteIndividualModal: React.FC<ComprovanteIndividualModalProps> = ({
  isOpen,
  onClose,
  fatura,
  initialUnidadeId,
  onOpenFotoViewer,
  companySettings
}) => {
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(
    initialUnidadeId || (fatura?.leituras?.[0]?.unidadeId || "")
  );

  if (!isOpen || !fatura) return null;

  const currentLeitura =
    fatura.leituras.find((l) => l.unidadeId === selectedUnidadeId) ||
    fatura.leituras[0] ||
    null;

  if (!currentLeitura) return null;

  // WhatsApp Message Generator
  const generateWhatsAppMessage = () => {
    let msg = `*DEMONSTRATIVO DE CONSUMO DE ÁGUA - FIDELITÉ IMOBILIÁRIA*\n\n`;
    msg += `Olá ${currentLeitura.moradorNome || "Morador(a)"}!\n`;
    msg += `Seguem os dados da medição de água da sua unidade:\n\n`;
    msg += `🏢 *Edifício:* ${fatura.edificioNome}\n`;
    msg += `🚪 *Apartamento:* ${currentLeitura.numeroUnidade} ${currentLeitura.bloco ? `(${currentLeitura.bloco})` : ""}\n`;
    msg += `📅 *Mês de Referência:* ${fatura.mesAnoTexto || fatura.mesReferencia}\n`;
    msg += `--------------------------------\n`;
    msg += `🔢 *Leitura Anterior:* ${currentLeitura.leituraAnterior.toFixed(2)} m³\n`;
    msg += `🔢 *Leitura Atual:* ${currentLeitura.leituraAtual.toFixed(2)} m³\n`;
    msg += `💧 *Consumo no Mês:* ${currentLeitura.consumoM3.toFixed(2)} m³\n`;
    msg += `📊 *Tarifa por m³:* R$ ${fatura.tarifaM3Calculada.toFixed(2)}\n`;
    msg += `💵 *Valor do Consumo:* R$ ${currentLeitura.valorConsumoM3.toFixed(2)}\n`;
    if (currentLeitura.valorAreaComumRateio > 0) {
      msg += `🏢 *Rateio Área Comum:* R$ ${currentLeitura.valorAreaComumRateio.toFixed(2)}\n`;
    }
    msg += `💰 *VALOR TOTAL A PAGAR:* R$ ${currentLeitura.valorTotalAPagar.toFixed(2)}\n`;
    msg += `--------------------------------\n`;
    msg += `📸 _Foto da leitura do hidrômetro arquivada no sistema Fidelité Imobiliária._\n\n`;
    msg += `Qualquer dúvida, estamos à disposição!\n`;
    msg += `*Fidelité Imobiliária*`;
    return msg;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    toast.success("Mensagem do WhatsApp copiada!");
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    let cleanPhone = (currentLeitura.moradorTelefone || "").replace(/\D/g, "");
    if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(url, "_blank");
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 print:shadow-none print:rounded-none print:max-h-none print:w-full"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Comprovante & Envio Individual
                </h3>
                <p className="text-xs text-slate-500">
                  {fatura.edificioNome} • {fatura.mesAnoTexto || fatura.mesReferencia}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedUnidadeId}
                onChange={(e) => setSelectedUnidadeId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                {fatura.leituras.map((l) => (
                  <option key={l.unidadeId} value={l.unidadeId}>
                    {formatUnitLabel(l.numeroUnidade)} {l.moradorNome ? `- ${l.moradorNome}` : ""}
                  </option>
                ))}
              </select>

              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content / Printable Slip */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
            {/* Canhoto / Card Individual */}
            <div className="p-6 bg-gradient-to-br from-white to-blue-50/30 rounded-3xl border-2 border-blue-100 shadow-sm space-y-6">
              {/* Slip Header */}
              <div className="flex items-center justify-between border-b border-blue-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                      F
                    </span>
                    <span className="font-black text-slate-900 text-sm uppercase tracking-wider">
                      Fidelité Imobiliária
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">
                    Demonstrativo de Consumo de Água
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-lg font-black text-blue-900 block">
                    {formatUnitLabel(currentLeitura.numeroUnidade)}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {fatura.mesAnoTexto || fatura.mesReferencia}
                  </span>
                </div>
              </div>

              {/* Resident info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Edifício / Condomínio
                  </span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {fatura.edificioNome}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Morador / Inquilino
                  </span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {currentLeitura.moradorNome || "Não informado"}
                  </span>
                </div>
              </div>

              {/* Measurement Numbers */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Leitura Anterior
                  </span>
                  <span className="text-base font-black text-slate-700 font-mono mt-1 block">
                    {currentLeitura.leituraAnterior.toFixed(2)} m³
                  </span>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">
                    Leitura Atual
                  </span>
                  <span className="text-base font-black text-blue-900 font-mono mt-1 block">
                    {currentLeitura.leituraAtual.toFixed(2)} m³
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                  <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest block">
                    Consumo no Mês
                  </span>
                  <span className="text-base font-black text-emerald-800 font-mono mt-1 block">
                    {currentLeitura.consumoM3.toFixed(2)} m³
                  </span>
                </div>
              </div>

              {/* Financial values breakdown */}
              <div className="space-y-2 border-t border-blue-100 pt-4 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Valor do Consumo ({currentLeitura.consumoM3.toFixed(2)} m³ × R$ {fatura.tarifaM3Calculada.toFixed(2)})</span>
                  <span className="font-bold text-slate-800">R$ {currentLeitura.valorConsumoM3.toFixed(2)}</span>
                </div>

                {currentLeitura.valorAreaComumRateio > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Rateio da Área Comum</span>
                    <span className="font-bold text-slate-800">R$ {currentLeitura.valorAreaComumRateio.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-sm">
                  <span className="font-black text-slate-900 uppercase">Total a Pagar:</span>
                  <span className="text-xl font-black text-emerald-700">
                    R$ {currentLeitura.valorTotalAPagar.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Photo attachment preview if exists */}
              {currentLeitura.fotoHidrometroUrl && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Foto do Hidrômetro (Comprovante de Leitura)
                  </span>
                  <div
                    onClick={() =>
                      onOpenFotoViewer(
                        currentLeitura.fotoHidrometroUrl!,
                        `Hidrômetro Apto ${currentLeitura.numeroUnidade}`,
                        `Leitura: ${currentLeitura.leituraAtual} m³`
                      )
                    }
                    className="h-44 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer group relative flex items-center justify-center bg-slate-100"
                  >
                    <img
                      src={currentLeitura.fotoHidrometroUrl}
                      alt={`Hidrômetro ${currentLeitura.numeroUnidade}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold gap-1 transition-opacity">
                      <Eye className="w-4 h-4" />
                      <span>Clique para ampliar</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions for WhatsApp / Print */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
              <button
                onClick={handleCopyWhatsApp}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Copiar Mensagem
              </button>

              <button
                onClick={handleSendWhatsApp}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Enviar WhatsApp
              </button>

              <button
                onClick={handlePrintSlip}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Canhoto
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
