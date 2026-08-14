import React from "react";
import { RentalFinancialViewModel } from "../../lib/legacyCommissionAdapter";
import { DollarSign, Shield, Users } from "lucide-react";
import { formatPersonName } from "../../lib/utils";

interface DistributionCardProps {
  rental: RentalFinancialViewModel;
}

export const DistributionCard: React.FC<DistributionCardProps> = ({ rental }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isFidelite = (name: string) => {
    return name.toLowerCase().includes("fidelité") || name.toLowerCase().includes("fidelite");
  };

  const getRoleLabel = (papel: string) => {
    if (papel === "locacao") return "Locador";
    if (papel === "captador") return "Captador";
    return "Auxiliar";
  };

  const getAvatarStyles = (name: string, papel: string) => {
    if (isFidelite(name)) {
      return { bg: "bg-emerald-600 text-white", initial: "F" };
    }
    if (papel === "captador") {
      return { bg: "bg-blue-600 text-white", initial: name.charAt(0).toUpperCase() };
    }
    if (papel === "locacao") {
      return { bg: "bg-purple-600 text-white", initial: name.charAt(0).toUpperCase() };
    }
    return { bg: "bg-slate-500 text-white", initial: name.charAt(0).toUpperCase() };
  };

  // Administration amount (Fidelité)
  const imobiliariaVal = rental.legacyDoc.valorFidelite || 0;
  const imobiliariaPct = rental.legacyDoc.porcentagemFidelite || 0;

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[30px] shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Distribuição da Comissão</h3>
        </div>
        <span className="text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-xl">
          SPLIT DE RATEIO
        </span>
      </div>

      <div className="space-y-4">
        {/* Imobiliária (Fidelité) Fee */}
        <div className="bg-slate-50 border border-slate-100/60 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
              F
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Fidelité Imobiliária
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
              </p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Taxa de Intermediação ({imobiliariaPct}%)
              </p>
            </div>
          </div>
          <span className="text-sm font-black text-slate-800">{formatCurrency(imobiliariaVal)}</span>
        </div>

        {/* Other participants splits */}
        {rental.distribuicao.length === 0 ? (
          <p className="text-xs text-slate-450 italic text-center py-4">Nenhum outro participante cadastrado no rateio.</p>
        ) : (
          <div className="space-y-3">
            {rental.distribuicao.map((rt, idx) => {
              const { bg, initial } = getAvatarStyles(rt.corretorNome, rt.papel);
              const isBrokerFullyPaid = (rt.totalPago || 0) >= rt.valor;

              return (
                <div key={idx} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-2xl hover:border-slate-300 hover:bg-slate-50/20 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center text-xs font-black`}>
                      {initial}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{formatPersonName(rt.corretorNome)}</span>
                      <span className="text-[10px] text-slate-405 font-bold uppercase tracking-wider block">
                        {getRoleLabel(rt.papel)} • {rt.porcentagem || 0}% do rateio
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-slate-800 block">
                      {formatCurrency(rt.valor)}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      isBrokerFullyPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-650"
                    }`}>
                      {isBrokerFullyPaid ? "pago" : `pendente: ${formatCurrency(Math.max(0, rt.valor - (rt.totalPago || 0)))}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
