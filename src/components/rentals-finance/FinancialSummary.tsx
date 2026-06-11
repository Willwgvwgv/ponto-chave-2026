import React, { useMemo } from "react";
import { RentalFinancialViewModel } from "../../lib/legacyCommissionAdapter";
import { Building, DollarSign, AlertCircle } from "lucide-react";

interface FinancialSummaryProps {
  rentals: RentalFinancialViewModel[];
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({ rentals }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const stats = useMemo(() => {
    let faturamentoFidelite = 0;
    let repassadoCorretores = 0;
    let pendenteRepasse = 0;

    rentals.forEach((r) => {
      faturamentoFidelite += r.legacyDoc.valorFidelite || 0;

      // Sum from individual repasses
      const totalPagoDeste = r.repasses.reduce((acc, pay) => acc + pay.valor, 0);
      const rateioTotal = r.legacyDoc.valorRepasseCorretores || 0;

      repassadoCorretores += totalPagoDeste;
      pendenteRepasse += Math.max(0, rateioTotal - totalPagoDeste);
    });

    const totalRepasse = repassadoCorretores + pendenteRepasse;
    const totalRetidoPct = faturamentoFidelite > 0 ? (faturamentoFidelite / (faturamentoFidelite + totalRepasse || 1)) * 100 : 0;
    const repassadoPct = totalRepasse > 0 ? (repassadoCorretores / totalRepasse) * 100 : 0;
    const pendentePct = totalRepasse > 0 ? (pendenteRepasse / totalRepasse) * 100 : 0;

    return {
      faturamentoFidelite,
      repassadoCorretores,
      pendenteRepasse,
      totalRetidoPct,
      repassadoPct,
      pendentePct,
    };
  }, [rentals]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
      {/* Box 1 */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-[30px] p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 font-black uppercase text-[7px] text-emerald-600/40">Faturamento Realizado</div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700/80">Total retido pela imobiliária</h3>
            <p className="text-2xl font-black text-emerald-800 tracking-tight mt-1">
              {formatCurrency(stats.faturamentoFidelite)}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-emerald-750">
            <span>Retido de Faturamento</span>
            <span>{stats.totalRetidoPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-emerald-250/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.totalRetidoPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Box 2 */}
      <div className="bg-blue-50 border border-blue-100 rounded-[30px] p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 font-black uppercase text-[7px] text-blue-600/40">Resíduos Pagos</div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-700/80">Total repassado a corretores</h3>
            <p className="text-2xl font-black text-blue-800 tracking-tight mt-1">
              {formatCurrency(stats.repassadoCorretores)}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-blue-750">
            <span>Pago do Total Rateio</span>
            <span>{stats.repassadoPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.repassadoPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Box 3 */}
      <div className="bg-orange-50 border border-orange-100 rounded-[30px] p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 font-black uppercase text-[7px] text-orange-600/40">Comprometido</div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 text-orange-600 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-700/80">Repasses pendentes</h3>
            <p className="text-2xl font-black text-orange-800 tracking-tight mt-1">
              {formatCurrency(stats.pendenteRepasse)}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-orange-755 font-semibold">
            <span>Pendente do Total Rateio</span>
            <span>{stats.pendentePct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-orange-200/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-orange-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats.pendentePct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
