import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  ChevronRight, 
  DollarSign, 
  Download, 
  HelpCircle, 
  TrendingUp, 
  FileSpreadsheet
} from 'lucide-react';
import { FinancialCategory, FinancialTransaction } from '../../types';

interface DRETabProps {
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
}

export const DRETab: React.FC<DRETabProps> = ({ categories, transactions }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Matrix para DRE: categoriaId -> [janeiroVal, fevereiroVal, ...]
  const dreMatrix = useMemo(() => {
    const matrix: Record<string, number[]> = {};

    // Inicializa as categorias
    categories.forEach(c => {
      matrix[c.id] = new Array(12).fill(0);
    });

    // Preenche com os valores das transações
    transactions.forEach(t => {
      if (t.status === 'IGNORADO') return;
      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate.getFullYear() === selectedYear) {
        const monthIndex = tDate.getMonth();
        if (t.categoryId && matrix[t.categoryId]) {
          matrix[t.categoryId][monthIndex] += Math.abs(t.amount);
        }
      }
    });

    return matrix;
  }, [categories, transactions, selectedYear]);

  // Totais mensais de Receitas calculados dinamicamente
  const monthlyTotalReceitas = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => c.type === 'RECEITA').forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Custos variáveis / Comissões a Corretores
  const monthlyDespesasVariaveis = useMemo(() => {
    const totals = new Array(12).fill(0);
    // Agrupa apenas a despesa de 'Comissões a Corretores Externos' como variável
    categories.filter(c => c.name.includes('Comissões')).forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Despesas Operacionais / Infraestrutura e Pessoal (menos comissões)
  const monthlyDespesasOperacionais = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => c.type === 'DESPESA' && !c.name.includes('Comissões')).forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const isFutureMonth = (monthIndex: number) => {
    if (selectedYear > currentYear) return true;
    if (selectedYear < currentYear) return false;
    return monthIndex > currentMonth;
  };

  const formatCurrency = (val: number, monthIndex?: number) => {
    if (val === 0) {
      if (monthIndex !== undefined && isFutureMonth(monthIndex)) {
        return '—';
      }
      return <span className="text-slate-300 italic font-normal">R$ 0</span>;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(val);
  };

  const calculateSum = (arr: number[]) => arr.reduce((acc, curr) => acc + curr, 0);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
                <th className="px-5 py-4 text-left min-w-[240px]">Rubricas do DRE</th>
                {months.map(m => (
                  <th key={m} className="px-3 py-4 w-24">{m}</th>
                ))}
                <th className="px-5 py-4 w-28 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 text-[11px] font-medium text-slate-700">
              {/* SEÇÃO 1: RECEITA BRUTA */}
              <tr className="bg-slate-50/40 border-t border-slate-200">
                <td className="px-5 py-3 font-black text-slate-900 uppercase">Receita Operacional Bruta</td>
                {monthlyTotalReceitas.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center font-black text-teal-600 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-black text-teal-600 font-sans">
                  {formatCurrency(calculateSum(monthlyTotalReceitas))}
                </td>
              </tr>

              {/* Detalhamento das Receitas */}
              {categories.filter(c => c.type === 'RECEITA').map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/30">
                  <td className="px-5 py-2 text-slate-500 pl-8 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </td>
                  {dreMatrix[cat.id]?.map((val, idx) => (
                    <td key={idx} className="px-3 py-2 text-center text-slate-400 font-semibold font-sans">{formatCurrency(val, idx)}</td>
                  ))}
                  <td className="px-5 py-2 text-right text-slate-500 font-bold font-sans">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* Custos Variáveis */}
              <tr className="bg-slate-50/20">
                <td className="px-5 py-3 font-black text-slate-800 uppercase">(-) Custos Variáveis (Comissões)</td>
                {monthlyDespesasVariaveis.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center font-black text-rose-500 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-black text-rose-500 font-sans">
                  {formatCurrency(calculateSum(monthlyDespesasVariaveis))}
                </td>
              </tr>

              {/* Margem de Contribuição */}
              <tr className="bg-blue-50/30">
                <td className="px-5 py-3 font-black text-slate-900 uppercase">(=) Margem de Contribuição</td>
                {monthlyTotalReceitas.map((val, idx) => {
                  const variance = val - monthlyDespesasVariaveis[idx];
                  return (
                    <td key={idx} className={`px-3 py-3 text-center font-black font-sans ${variance >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                      {formatCurrency(variance, idx)}
                    </td>
                  );
                })}
                <td className="px-5 py-3 text-right font-black text-teal-700 font-sans">
                  {formatCurrency(calculateSum(monthlyTotalReceitas) - calculateSum(monthlyDespesasVariaveis))}
                </td>
              </tr>

              {/* Despesas Fixas */}
              <tr className="bg-slate-50/20">
                <td className="px-5 py-3 font-black text-slate-800 uppercase">(-) Despesas Administrativas / Fixas</td>
                {monthlyDespesasOperacionais.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center font-black text-rose-500 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-black text-rose-500 font-sans">
                  {formatCurrency(calculateSum(monthlyDespesasOperacionais))}
                </td>
              </tr>

              {/* Detalhamento das Despesas Administrativas */}
              {categories.filter(c => c.type === 'DESPESA' && !c.name.includes('Comissões')).map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/30">
                  <td className="px-5 py-2 text-slate-500 pl-8 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </td>
                  {dreMatrix[cat.id]?.map((val, idx) => (
                    <td key={idx} className="px-3 py-2 text-center text-slate-400 font-semibold font-sans">{formatCurrency(val, idx)}</td>
                  ))}
                  <td className="px-5 py-2 text-right text-slate-500 font-bold font-sans">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* RESULTADO LÍQUIDO DO EXERCÍCIO */}
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td className="px-5 py-4 font-black text-slate-900 text-xs uppercase tracking-tight">(=) Resultado Líquido Operacional (Lucro)</td>
                {monthlyTotalReceitas.map((val, idx) => {
                  const net = val - monthlyDespesasVariaveis[idx] - monthlyDespesasOperacionais[idx];
                  return (
                    <td key={idx} className={`px-3 py-4 text-center font-black text-xs font-sans ${net >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                      {formatCurrency(net, idx)}
                    </td>
                  );
                })}
                <td className="px-5 py-4 text-right font-black text-teal-600 text-xs font-sans">
                  {formatCurrency(calculateSum(monthlyTotalReceitas) - calculateSum(monthlyDespesasVariaveis) - calculateSum(monthlyDespesasOperacionais))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
