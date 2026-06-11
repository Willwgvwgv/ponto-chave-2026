import React from "react";
import { RentalFinancialViewModel } from "../../lib/legacyCommissionAdapter";
import { Calendar, CheckCircle2, Circle, DollarSign, ArrowRightLeft, Wallet, AlertCircle } from "lucide-react";

interface RepasseTimelineProps {
  rental: RentalFinancialViewModel;
}

export const RepasseTimeline: React.FC<RepasseTimelineProps> = ({ rental }) => {
  const getCreatedAtStr = () => {
    if (!rental.legacyDoc.createdAt) return "Competência aberta";
    try {
      const d = new Date(rental.legacyDoc.createdAt);
      if (isNaN(d.getTime())) return rental.legacyDoc.createdAt.substring(0, 10);
      return d.toLocaleDateString("pt-BR");
    } catch {
      return "Competência aberta";
    }
  };

  const getRecebimentoDateStr = () => {
    if (rental.dataRecebimento) {
      try {
        const parts = rental.dataRecebimento.split("-");
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return rental.dataRecebimento;
      } catch {
        return rental.dataRecebimento;
      }
    }
    return rental.legacyDoc.vencimento ? `Previsto para ${rental.legacyDoc.vencimento.split("-").reverse().join("/")}` : "";
  };

  const totalCalculado = rental.distribuicao.reduce((acc, curr) => acc + curr.valor, 0);
  const totalPagoRepasses = rental.repasses.reduce((acc, curr) => acc + curr.valor, 0);
  const countTotalRepasses = rental.distribuicao.length;
  const countPagosRepasses = rental.distribuicao.filter(d => (d.totalPago || 0) >= d.valor).length;

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const steps = [
    {
      title: "Comissão Calculada",
      description: `Divisão de rateio calculada em ${getCreatedAtStr()}`,
      detail: `Competência: ${rental.competencia.label}`,
      completed: ["calculada", "aguardando_pagamento", "em_distribuicao", "repasses_pendentes", "concluida"].includes(rental.statusFinanceiro),
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-50 border-blue-200",
    },
    {
      title: "Aguardando Pagamento",
      description: ["aguardando_pagamento", "em_distribuicao", "repasses_pendentes", "concluida"].includes(rental.statusFinanceiro)
        ? `Lançado nas cobranças pendentes`
        : "Aguardando o fluxo de repasse iniciar",
      detail: undefined,
      completed: ["aguardando_pagamento", "em_distribuicao", "repasses_pendentes", "concluida"].includes(rental.statusFinanceiro),
      icon: DollarSign,
      color: "text-amber-500",
      bg: "bg-amber-50 border-amber-200",
    },
    {
      title: "Distribuição da Comissão",
      description: ["em_distribuicao", "repasses_pendentes", "concluida"].includes(rental.statusFinanceiro)
        ? "Split de rateio liberado para repasses"
        : "Aguardando liberação da distribuição",
      detail: `Faturamento Retido Imobiliária: ${formatBRL(rental.legacyDoc.valorFidelite || 0)}`,
      completed: ["em_distribuicao", "repasses_pendentes", "concluida"].includes(rental.statusFinanceiro),
      icon: ArrowRightLeft,
      color: "text-purple-500",
      bg: "bg-purple-50 border-purple-200",
    },
    {
      title: "Repasses Pendentes",
      description: ["repasses_pendentes", "concluida"].includes(rental.statusFinanceiro)
        ? "Pagamentos sendo efetuados individualmente"
        : "Pendente de início de pagamentos",
      detail: `Concluídos: ${countPagosRepasses} de ${countTotalRepasses} corretores`,
      completed: ["repasses_pendentes", "concluida"].includes(rental.statusFinanceiro),
      icon: Wallet,
      color: "text-orange-500",
      bg: "bg-orange-50 border-orange-200",
    },
    {
      title: "Comissão Concluída",
      description: rental.statusFinanceiro === "concluida"
        ? "Todos os repasses e divisões foram quitados e encerrados"
        : `${countPagosRepasses} de ${countTotalRepasses} pagos`,
      detail: `Distribuído: ${formatBRL(totalPagoRepasses)} / Total: ${formatBRL(totalCalculado)}`,
      completed: rental.statusFinanceiro === "concluida",
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-50 border-green-200",
    },
  ];

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[30px] shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-105 pb-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
          ⏳
        </div>
        <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Histórico de Linha do Tempo</h3>
      </div>

      <div className="relative pl-6 space-y-8">
        {/* Connecting line */}
        <div className="absolute left-[35px] top-4 bottom-4 w-0.5 bg-slate-100" />

        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          return (
            <div key={idx} className="relative flex gap-4 select-none">
              {/* Checkbox point */}
              <div className="absolute left-[-22px] top-1 z-10">
                {step.completed ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-4 border-white shadow-sm ring-2 ring-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border-4 border-white shadow-sm ring-2 ring-slate-150">
                    <Circle className="w-2 h-2 opacity-50" />
                  </div>
                )}
              </div>

              {/* Icon Container */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                step.completed ? `${step.bg} ${step.color}` : "bg-slate-50 border-slate-100 text-slate-350"
              }`}>
                <StepIcon className="w-5 h-5" />
              </div>

              {/* Text context */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-black tracking-tight ${step.completed ? "text-slate-800" : "text-slate-400 font-semibold"}`}>
                    {step.title}
                  </h4>
                </div>
                <p className={`text-[11px] leading-relaxed mt-0.5 ${step.completed ? "text-slate-500 font-medium" : "text-slate-350 italic"}`}>
                  {step.description}
                </p>
                {step.detail && (
                  <span className="inline-block text-[9px] bg-slate-50 border border-slate-100 font-mono font-medium text-slate-550 rounded-[8px] px-2 py-0.5 mt-1">
                    {step.detail}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
