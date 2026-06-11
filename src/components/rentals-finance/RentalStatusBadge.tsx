import React from "react";

export type FinancialStatus = "calculada" | "aguardando_pagamento" | "em_distribuicao" | "repasses_pendentes" | "concluida";

interface RentalStatusBadgeProps {
  status: FinancialStatus;
  className?: string;
}

export const RentalStatusBadge: React.FC<RentalStatusBadgeProps> = ({ status, className = "" }) => {
  const configs: Record<FinancialStatus, { bg: string; text: string; label: string; icon: string }> = {
    calculada: {
      bg: "bg-slate-100 border-slate-200/80",
      text: "text-slate-600",
      label: "Comissão Calculada",
      icon: "📊",
    },
    aguardando_pagamento: {
      bg: "bg-amber-50 border-amber-200/85",
      text: "text-amber-700",
      label: "Aguardando Pagamento",
      icon: "⏳",
    },
    em_distribuicao: {
      bg: "bg-purple-50 border-purple-200/80",
      text: "text-purple-700",
      label: "Em Distribuição",
      icon: "🔄",
    },
    repasses_pendentes: {
      bg: "bg-orange-50 border-orange-200/80",
      text: "text-orange-700",
      label: "Repasses Pendentes",
      icon: "⏰",
    },
    concluida: {
      bg: "bg-emerald-600 border-emerald-700/50 text-white",
      text: "text-white",
      label: "Concluída",
      icon: "✅",
    },
  };

  const config = configs[status] || configs.calculada;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border select-none leading-none ${config.bg} ${config.text} ${className}`}
    >
      <span className="text-[12px]">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};
