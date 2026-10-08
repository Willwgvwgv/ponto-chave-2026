import React, { useState } from "react";
import { X, Zap } from "lucide-react";
import { EnergiaLocacao, StatusEnergiaLocacao } from "../../types";
import { maskCPF, stripDoc } from "../../lib/utils";

interface EnergiaFormModalProps {
  initial: EnergiaLocacao | null;
  onSave: (data: Omit<EnergiaLocacao, "id" | "createdAt" | "updatedAt" | "companyId" | "criadoPor" | "criadoPorNome">) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: StatusEnergiaLocacao; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_processo", label: "Em processo" },
  { value: "transferida", label: "Transferida" }
];
// Módulo acompanha principalmente locações já transferidas: novo cadastro começa como "Transferida".

export const EnergiaFormModal: React.FC<EnergiaFormModalProps> = ({ initial, onSave, onClose }) => {
  const [imovel, setImovel] = useState(initial?.imovel || "");
  const [inquilino, setInquilino] = useState(initial?.inquilino || "");
  const [unidadeConsumidora, setUnidadeConsumidora] = useState(initial?.unidadeConsumidora || "");
  const [cpf, setCpf] = useState(initial?.cpf ? maskCPF(initial.cpf) : "");
  const [dataNascimento, setDataNascimento] = useState(initial?.dataNascimento || "");
  const [dataVencimento, setDataVencimento] = useState(initial?.dataVencimento || "");
  const [status, setStatus] = useState<StatusEnergiaLocacao>(initial?.status || "transferida");
  const [diaVencimentoConta, setDiaVencimentoConta] = useState<string>(initial?.diaVencimentoConta ? String(initial.diaVencimentoConta) : "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes || "");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imovel.trim() || !inquilino.trim()) {
      setError("Preencha ao menos o imóvel e o locatário.");
      return;
    }
    setError("");

    // Sem data de vencimento conta como "sem_data" para fins de status
    // efetivo exibido na lista, mas o campo status gravado continua sendo o
    // escolhido aqui (pendente/em_processo/transferida) — "sem_data" e
    // "vencida" são calculados na tela, não um estado que se escolhe.
    onSave({
      imovel: imovel.trim(),
      inquilino: inquilino.trim(),
      unidadeConsumidora: unidadeConsumidora.trim(),
      cpf: cpf ? stripDoc(cpf) : undefined,
      dataNascimento: dataNascimento || undefined,
      dataVencimento: dataVencimento || undefined,
      status,
      diaVencimentoConta: diaVencimentoConta ? Math.min(31, Math.max(1, parseInt(diaVencimentoConta) || 0)) || undefined : undefined,
      observacoes: observacoes.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              {initial ? "Editar acompanhamento" : "Novo acompanhamento de energia"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Imóvel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={imovel}
              onChange={e => setImovel(e.target.value)}
              placeholder="Ex: Rua X, nº 100"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Locatário <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={inquilino}
              onChange={e => setInquilino(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Unidade Consumidora</label>
              <input
                type="text"
                value={unidadeConsumidora}
                onChange={e => setUnidadeConsumidora(e.target.value)}
                placeholder="Ex: 123456789"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={e => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Data de nascimento</label>
              <input
                type="date"
                value={dataNascimento}
                onChange={e => setDataNascimento(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Prazo para transferir
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={e => setDataVencimento(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label htmlFor="energia-dia-conta" className="block text-xs font-bold text-slate-700 mb-1.5">Dia de vencimento da conta de energia</label>
            <input
              id="energia-dia-conta"
              type="number"
              min={1}
              max={31}
              value={diaVencimentoConta}
              onChange={e => setDiaVencimentoConta(e.target.value)}
              placeholder="Ex.: 15"
              className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Transferência da conta para o inquilino</label>
            <div className="flex items-center gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    status === opt.value
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Ex: Aguardando transferência."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50/50 rounded-b-[28px]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-2xl cursor-pointer transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold tracking-wide shadow-md shadow-amber-500/20 cursor-pointer transition-all"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
};
