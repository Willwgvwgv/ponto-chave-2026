import React, { useState } from "react";
import { 
  X, 
  Send, 
  Check, 
  Copy, 
  ShieldCheck, 
  ExternalLink, 
  QrCode, 
  MessageSquare, 
  Mail, 
  Clock, 
  UserCheck,
  FileCheck2,
  Lock
} from "lucide-react";
import { ContratoLocacao } from "../types/contractTypes";
import { toast } from "sonner";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ContratoLocacao;
  onUpdateStatus: (newStatus: ContratoLocacao["status"], signatureUrl?: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateStatus
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const mockHash = (contract.id + (contract.numeroContrato || "LOC")).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toUpperCase();
  const signatureLink = `${window.location.origin}/#assinar-contrato?id=${contract.id}&hash=${mockHash}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signatureLink);
    setCopied(true);
    toast.success("Link de assinatura digital copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsapp = (phone?: string, name?: string) => {
    const text = encodeURIComponent(
      `Olá, ${name || "Senhor(a)"}!\nSegue o link oficial para assinatura digital do Contrato de Locação (${contract.numeroContrato || "Ponto Chave"}):\n\n${signatureLink}\n\nO documento possui plena validade jurídica pela Lei 14.063/2020.`
    );
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const handleSendToSign = () => {
    onUpdateStatus("aguardando_assinatura", signatureLink);
    toast.success("Contrato enviado para fluxo de assinatura digital!");
    onClose();
  };

  const handleMarkAsSigned = () => {
    onUpdateStatus("assinado", signatureLink);
    toast.success("Contrato marcado como totalmente assinado e formalizado!");
    onClose();
  };

  const locatario = contract.locatarios?.[0];
  const locador = contract.locador;
  const fiador = contract.fiadores?.[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Assinatura Digital do Contrato
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                ICP-Brasil e Lei Federal nº 14.063/2020 (Validade Jurídica Plena)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs">
          {/* Link box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Link de Assinatura com Autenticação
              </span>
              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                HASH: {mockHash}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={signatureLink}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-[11px] text-slate-600 select-all outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {/* Signatories List */}
          <div>
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-3">
              Signatários Vinculados
            </h3>

            <div className="space-y-2">
              {/* Locatário */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{locatario?.nome || "Locatário"}</div>
                    <div className="text-[10px] text-slate-400">
                      Locatário(a) • CPF: {locatario?.cpfCnpj || "Pendente"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendWhatsapp(locatario?.telefone, locatario?.nome)}
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                    title="Enviar link via WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    contract.status === "assinado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {contract.status === "assinado" ? "Assinado" : "Pendente"}
                  </span>
                </div>
              </div>

              {/* Locador */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{locador?.nome || "Locador"}</div>
                    <div className="text-[10px] text-slate-400">
                      Locador(a) • CPF: {locador?.cpfCnpj || "Pendente"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendWhatsapp(locador?.telefone, locador?.nome)}
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                    title="Enviar link via WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    contract.status === "assinado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {contract.status === "assinado" ? "Assinado" : "Pendente"}
                  </span>
                </div>
              </div>

              {/* Fiador se houver */}
              {contract.condicoes.modalidadeGarantia === "fiador" && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{fiador?.nome || "Fiador"}</div>
                      <div className="text-[10px] text-slate-400">
                        Fiador(a) Solidário(a) • CPF: {fiador?.cpfCnpj || "Pendente"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      contract.status === "assinado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {contract.status === "assinado" ? "Assinado" : "Pendente"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAsSigned}
              className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileCheck2 className="w-4 h-4" />
              Marcar como Assinado
            </button>

            <button
              onClick={handleSendToSign}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Iniciar Coleta de Assinaturas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
