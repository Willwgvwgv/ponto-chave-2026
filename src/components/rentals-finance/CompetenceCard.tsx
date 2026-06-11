import React from "react";
import { RentalFinancialViewModel } from "../../lib/legacyCommissionAdapter";
import { RentalStatusBadge } from "./RentalStatusBadge";
import { Building, User, Calendar, DollarSign } from "lucide-react";

interface CompetenceCardProps {
  rental: RentalFinancialViewModel;
  isSelected?: boolean;
  onClick?: () => void;
}

export const CompetenceCard: React.FC<CompetenceCardProps> = ({ rental, isSelected = false, onClick }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-3xl border transition-all duration-300 cursor-pointer select-none space-y-4 ${
        isSelected
          ? "bg-emerald-50 border-emerald-400 shadow-md shadow-emerald-500/10"
          : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-md hover:shadow-slate-500/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Imóvel</h4>
            <p className="text-sm font-bold text-slate-800 line-clamp-1">{rental.imovel}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 text-slate-450 text-[10px] uppercase font-black tracking-widest bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
            <Calendar className="w-3.5 h-3.5" />
            <span>{rental.competencia.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-slate-100/80 pt-3 text-left">
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
            1º Aluguel
          </span>
          <p className="text-xs font-bold text-slate-700">
            {formatCurrency(rental.legacyDoc.primeiroAluguel || rental.legacyDoc.aluguelMensal || 0)}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
            Comissão Total
          </span>
          <p className="text-xs font-bold text-indigo-650">
            {formatCurrency(rental.legacyDoc.valorFidelite || 0)}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
            Distribuído
          </span>
          <p className="text-xs font-bold text-emerald-600">
            {formatCurrency(rental.repasses.reduce((acc, curr) => acc + (curr.tipo === "desconto" ? -curr.valor : curr.valor), 0))}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-slate-55 border-dashed">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status Financeiro:</span>
        <RentalStatusBadge status={rental.statusFinanceiro} />
      </div>
    </div>
  );
};
