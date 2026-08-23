import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  ChevronRight, 
  DollarSign, 
  Download, 
  HelpCircle, 
  TrendingUp, 
  FileSpreadsheet,
  FileText,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { FinancialCategory, FinancialTransaction } from '../../types';
import { toast } from 'sonner';

interface DRETabProps {
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
  onShowUncategorized?: (txIds: string[]) => void;
}

export const DRETab: React.FC<DRETabProps> = ({ categories, transactions, onShowUncategorized }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Mapas para resolução rápida de categoria por ID e por Nome
  const { catById, catByName } = useMemo(() => {
    const byId = new Map<string, FinancialCategory>();
    const byName = new Map<string, FinancialCategory>();
    categories.forEach(c => {
      if (c.id) byId.set(c.id, c);
      if (c.nome) byName.set(c.nome.trim().toLowerCase(), c);
      if (c.name) byName.set(c.name.trim().toLowerCase(), c);
    });
    return { catById: byId, catByName: byName };
  }, [categories]);

  // Matrix para DRE: categoriaId -> [janeiroVal, fevereiroVal, ...]
  // e cálculo de lançamentos não classificados
  const { dreMatrix, uncategorizedTxs, uncategorizedReceitas, uncategorizedDespesas } = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    const unReceitas = new Array(12).fill(0);
    const unDespesas = new Array(12).fill(0);
    const unTxs: FinancialTransaction[] = [];

    // Inicializa todas as categorias
    categories.forEach(c => {
      matrix[c.id] = new Array(12).fill(0);
    });

    // Preenche com os valores das transações
    transactions.forEach(t => {
      if (t.status === 'IGNORADO') return;
      if (t.type === 'TRANSFERENCIA' || t.isTransfer) return;

      // Tenta encontrar a categoria por ID ou por Nome
      let matchedCat: FinancialCategory | undefined;
      if (t.categoryId && catById.has(t.categoryId)) {
        matchedCat = catById.get(t.categoryId);
      } else if (t.categoryName && catByName.has(t.categoryName.trim().toLowerCase())) {
        matchedCat = catByName.get(t.categoryName.trim().toLowerCase());
      }

      // Exclui transações cuja categoria tenha excludeFromDRE === true
      if (matchedCat?.excludeFromDRE) return;

      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate.getFullYear() === selectedYear) {
        const monthIndex = tDate.getMonth();
        if (monthIndex < 0 || monthIndex >= 12) return;

        if (matchedCat && matrix[matchedCat.id]) {
          matrix[matchedCat.id][monthIndex] += Math.abs(t.amount);
        } else {
          // Lançamento sem categoria mapeada no DRE
          unTxs.push(t);
          if (t.type === 'RECEITA') {
            unReceitas[monthIndex] += Math.abs(t.amount);
          } else if (t.type === 'DESPESA') {
            unDespesas[monthIndex] += Math.abs(t.amount);
          }
        }
      }
    });

    return { 
      dreMatrix: matrix, 
      uncategorizedTxs: unTxs, 
      uncategorizedReceitas: unReceitas, 
      uncategorizedDespesas: unDespesas 
    };
  }, [categories, transactions, selectedYear, catById, catByName]);

  // Calculations for Locacoes Entradas (Faturamento de Locações)
  const monthlyLocacoesEntrada = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => !c.excludeFromDRE && c.grupo === 'locacao' && c.natureza === 'entrada').forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Deduções Operacionais (Soma de saídas de locação)
  const monthlyLocacoesSaida = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => !c.excludeFromDRE && c.grupo === 'locacao' && c.natureza === 'saida').forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Faturamento Líquido de Locações
  const monthlyLocacoesLiquido = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      totals[i] = monthlyLocacoesEntrada[i] - monthlyLocacoesSaida[i];
    }
    return totals;
  }, [monthlyLocacoesEntrada, monthlyLocacoesSaida]);

  // Receitas de Caixa (Entradas do Caixa)
  const monthlyCaixaEntras = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'entrada').forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Receita Bruta Total
  const monthlyReceitaBrutaTotal = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      totals[i] = monthlyLocacoesLiquido[i] + monthlyCaixaEntras[i];
    }
    return totals;
  }, [monthlyLocacoesLiquido, monthlyCaixaEntras]);

  // Despesas Operacionais Fixas
  const monthlyDespesasFixas = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'fixo').forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Despesas Operacionais Variáveis
  const monthlyDespesasVariaveis = useMemo(() => {
    const totals = new Array(12).fill(0);
    categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'variavel').forEach(c => {
      const row = dreMatrix[c.id] || [];
      for (let i = 0; i < 12; i++) {
        totals[i] += row[i] || 0;
      }
    });
    return totals;
  }, [categories, dreMatrix]);

  // Resultado Líquido Operacional (Lucro)
  const monthlyResultadoLiquido = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      totals[i] = monthlyReceitaBrutaTotal[i] - monthlyDespesasFixas[i] - monthlyDespesasVariaveis[i];
    }
    return totals;
  }, [monthlyReceitaBrutaTotal, monthlyDespesasFixas, monthlyDespesasVariaveis]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const isFutureMonth = (monthIndex: number) => {
    if (selectedYear > currentYear) return true;
    if (selectedYear < currentYear) return false;
    return monthIndex > currentMonth;
  };

  const formatCurrencyValue = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  const formatCurrency = (val: number, monthIndex?: number) => {
    if (val === 0) {
      if (monthIndex !== undefined && isFutureMonth(monthIndex)) {
        return <span className="text-slate-350">—</span>;
      }
      return <span className="text-slate-300 italic font-normal">R$ 0</span>;
    }
    return formatCurrencyValue(val);
  };

  const calculateSum = (arr: number[]) => arr.reduce((acc, curr) => acc + curr, 0);

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Por favor, habilite popups para exportar o PDF.");
      return;
    }

    const locacoesEntradaCats = categories.filter(c => !c.excludeFromDRE && c.grupo === 'locacao' && c.natureza === 'entrada');
    const locacoesSaidaCats = categories.filter(c => !c.excludeFromDRE && c.grupo === 'locacao' && c.natureza === 'saida');
    const caixaEntradaCats = categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'entrada');
    const caixaSaidaFixaCats = categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'fixo');
    const caixaSaidaVariavelCats = categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'variavel');

    const generateRows = (cats: FinancialCategory[], indentClass = 'pl-8') => {
      return cats.map(cat => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #475569;">
          <td style="padding: 6px 12px; ${indentClass === 'pl-8' ? 'padding-left: 32px;' : 'padding-left: 48px;'} text-align: left;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${cat.color || '#94a3b8'}; margin-right: 6px;"></span>
            ${cat.nome || cat.name}
          </td>
          ${months.map((_, mIdx) => {
            const val = dreMatrix[cat.id] ? dreMatrix[cat.id][mIdx] : 0;
            return `<td style="padding: 6px 4px; text-align: center;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`;
          }).join('')}
          <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${calculateSum(dreMatrix[cat.id] || []).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
        </tr>
      `).join('');
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>DRE Gerencial Imobiliário - ${selectedYear}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #1e293b; background: white; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; }
            .sub { color: #64748b; font-size: 12px; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: center; border-bottom: 2px solid #cbd5e1; padding: 8px 4px; color: #475569; font-size: 10px; text-transform: uppercase; font-weight: bold; }
            .section-header { background: #f8fafc; font-weight: bold; color: #0f172a; text-transform: uppercase; font-size: 11px; }
            .subtotal { background: #f1f5f9; font-weight: bold; color: #1e293b; font-size: 11px; }
            .netprofit { background: #cbd5e1; font-weight: 900; color: #0f172a; font-size: 12px; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Demonstração de Resultado do Exercício (DRE)</div>
              <div class="sub">Modelo Gerencial Imobiliário</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: bold;">Exercício Financeiro</div>
              <div class="sub" style="font-size: 14px; font-weight: 800; color: #2563eb;">Ano: ${selectedYear}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left; padding-left: 12px;">Fluxo de Caixa / Pró-labore</th>
                ${months.map((m, idx) => `<th>${m}</th>`).join('')}
                <th style="text-align: right; padding-right: 12px;">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              <!-- 1. FATURAMENTO LOCACOES -->
              <tr class="section-header">
                <td style="padding: 10px 12px; text-align: left;">1. Faturamento Bruto de Locações (+)</td>
                ${monthlyLocacoesEntrada.map(val => `<td style="padding: 10px 4px; text-align: center; color: #059669;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #059669;">${calculateSum(monthlyLocacoesEntrada).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>
              ${generateRows(locacoesEntradaCats)}

              <!-- 2. DEDUCOES LOCACOES -->
              <tr class="section-header">
                <td style="padding: 10px 12px; text-align: left;">2. Deduções Operacionais / Repasses (-)</td>
                ${monthlyLocacoesSaida.map(val => `<td style="padding: 10px 4px; text-align: center; color: #e11d48;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #e11d48;">${calculateSum(monthlyLocacoesSaida).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>
              ${generateRows(locacoesSaidaCats)}

              <!-- 3. LIQUIDO LOCACOES -->
              <tr class="subtotal" style="background-color: #f0fdf4;">
                <td style="padding: 10px 12px; text-align: left;">3. Margem Líquida da Carteira (1 - 2)</td>
                ${monthlyLocacoesLiquido.map(val => `<td style="padding: 10px 4px; text-align: center; color: #047857;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #047857;">${calculateSum(monthlyLocacoesLiquido).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>

              <!-- 4. RECEITAS CAIXA -->
              <tr class="section-header">
                <td style="padding: 10px 12px; text-align: left;">4. Receitas Secundárias / Caixa (+)</td>
                ${monthlyCaixaEntras.map(val => `<td style="padding: 10px 4px; text-align: center; color: #2563eb;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #2563eb;">${calculateSum(monthlyCaixaEntras).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>
              ${generateRows(caixaEntradaCats)}

              <!-- 5. RECEITA BRUTA TOTAL -->
              <tr class="subtotal" style="background-color: #eff6ff;">
                <td style="padding: 10px 12px; text-align: left;">5. Receita Operacional Bruta Real (3 + 4)</td>
                ${monthlyReceitaBrutaTotal.map(val => `<td style="padding: 10px 4px; text-align: center; color: #1d4ed8;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #1d4ed8;">${calculateSum(monthlyReceitaBrutaTotal).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>

              <!-- 6. DESPESAS FIXAS -->
              <tr class="section-header">
                <td style="padding: 10px 12px; text-align: left;">6. Despesas Operacionais Fixas (-)</td>
                ${monthlyDespesasFixas.map(val => `<td style="padding: 10px 4px; text-align: center; color: #e11d48;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #e11d48;">${calculateSum(monthlyDespesasFixas).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>
              ${generateRows(caixaSaidaFixaCats)}

              <!-- 7. DESPESAS VARIAVEIS -->
              <tr class="section-header">
                <td style="padding: 10px 12px; text-align: left;">7. Despesas Operacionais Variáveis (-)</td>
                ${monthlyDespesasVariaveis.map(val => `<td style="padding: 10px 4px; text-align: center; color: #e11d48;">${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`).join('')}
                <td style="padding: 10px 12px; text-align: right; color: #e11d48;">${calculateSum(monthlyDespesasVariaveis).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              </tr>
              ${generateRows(caixaSaidaVariavelCats)}

              <!-- 8. LIQUIDO OPERACIONAL -->
              <tr class="netprofit">
                <td style="padding: 12px; text-align: left;">(=) Resultado Líquido Executado (Lucro Líquido)</td>
                ${monthlyResultadoLiquido.map(val => `
                  <td style="padding: 12px 4px; text-align: center; color: ${val >= 0 ? '#10b981' : '#ef4444'};">
                    ${val === 0 ? '—' : val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </td>
                `).join('')}
                <td style="padding: 12px; text-align: right; color: ${calculateSum(monthlyResultadoLiquido) >= 0 ? '#10b981' : '#ef4444'};">
                  ${calculateSum(monthlyResultadoLiquido).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const totalUncategorizedDespesas = calculateSum(uncategorizedDespesas);
  const totalUncategorizedReceitas = calculateSum(uncategorizedReceitas);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-md font-black text-slate-900 tracking-tight uppercase">DRE Gerencial Imobiliário</h2>
          <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium mt-0.5">Demonstração de resultados operacional focado na separação de carteira de locação e custos de caixa.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Imprimir Relatório
          </button>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
            <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
          </select>
        </div>
      </div>

      {/* Cards de Resumo Executivo / Auditoria DRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Faturamento Bruto Locações</span>
          <span className="text-lg font-black text-teal-700 mt-1 block">
            {formatCurrencyValue(calculateSum(monthlyLocacoesEntrada))}
          </span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 block">Líquido: {formatCurrencyValue(calculateSum(monthlyLocacoesLiquido))}</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Receitas Operacionais Caixa</span>
          <span className="text-lg font-black text-blue-700 mt-1 block">
            {formatCurrencyValue(calculateSum(monthlyCaixaEntras))}
          </span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 block">Comissões e Honorários</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Despesas Operacionais Totais</span>
          <span className="text-lg font-black text-rose-600 mt-1 block">
            {formatCurrencyValue(calculateSum(monthlyDespesasFixas) + calculateSum(monthlyDespesasVariaveis))}
          </span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 block">
            Fixas: {formatCurrencyValue(calculateSum(monthlyDespesasFixas))} | Var: {formatCurrencyValue(calculateSum(monthlyDespesasVariaveis))}
          </span>
        </div>

        <div className={`p-4 rounded-2xl border shadow-xs ${
          calculateSum(monthlyResultadoLiquido) >= 0 
            ? 'bg-emerald-50/50 border-emerald-200' 
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Lucro Líquido Acumulado</span>
          <span className={`text-lg font-black mt-1 block ${
            calculateSum(monthlyResultadoLiquido) >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {formatCurrencyValue(calculateSum(monthlyResultadoLiquido))}
          </span>
          <span className="text-[10px] font-bold text-slate-600 mt-1 block">Exercício {selectedYear}</span>
        </div>
      </div>

      {/* Banner de Auditoria de Conciliação se houver lançamentos sem categoria */}
      {uncategorizedTxs.length > 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-extrabold uppercase tracking-wide">
                Atenção: Existem {uncategorizedTxs.length} lançamento(s) sem categoria associada no exercício de {selectedYear}
              </p>
              <p className="font-medium text-amber-800">
                Esses lançamentos somam <strong>{formatCurrencyValue(totalUncategorizedDespesas)}</strong> em despesas e <strong>{formatCurrencyValue(totalUncategorizedReceitas)}</strong> em receitas. Para que eles componham as rubricas específicas do DRE, acesse a aba <strong>Lançamentos</strong> e atribua a respectiva categoria.
              </p>
            </div>
          </div>
          {onShowUncategorized && (
            <button
              type="button"
              onClick={() => onShowUncategorized(uncategorizedTxs.map(t => t.id))}
              className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer whitespace-nowrap self-end sm:self-center"
            >
              <span>Ver e regularizar agora</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>100% dos lançamentos do exercício {selectedYear} estão categorizados e conciliados com as rubricas do DRE.</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1240px]">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black text-slate-450 uppercase tracking-widest text-center">
                <th className="px-5 py-4.5 text-left min-w-[280px]">Rubricas de Gestão Financeira</th>
                {months.map(m => (
                  <th key={m} className="px-3 py-4.5 w-24">{m}</th>
                ))}
                <th className="px-5 py-4.5 w-32 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-755">
              
              {/* 1. FATURAMENTO LOCACOES */}
              <tr className="bg-teal-50/20 border-t border-slate-200">
                <td className="px-5 py-3 font-extrabold text-slate-800 uppercase text-[10.5px]">1. Faturamento Bruto de Locações (+)</td>
                {monthlyLocacoesEntrada.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center text-teal-600 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-extrabold text-teal-600 font-sans">
                  {formatCurrency(calculateSum(monthlyLocacoesEntrada))}
                </td>
              </tr>

              {/* Detalhamento de locações entradas */}
              {categories.filter(c => !c.excludeFromDRE && c.grupo === 'locacao' && c.natureza === 'entrada').map(cat => (
                <tr key={cat.id} className="hover:bg-slate-55/40 text-slate-500 font-medium">
                  <td className="px-5 py-2 pl-10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nome || cat.name}
                  </td>
                  {months.map((_, mIdx) => {
                    const value = dreMatrix[cat.id] ? dreMatrix[cat.id][mIdx] : 0;
                    return (
                      <td key={mIdx} className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">
                        {formatCurrency(value, mIdx)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-2 text-right font-bold text-slate-600">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* 2. DEDUCOES LOCACOES */}
              <tr className="bg-rose-50/15 border-t border-slate-200">
                <td className="px-5 py-3 font-extrabold text-slate-800 uppercase text-[10.5px]">2. Deduções Operacionais / Repasses (-)</td>
                {monthlyLocacoesSaida.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center text-rose-500 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-extrabold text-rose-500 font-sans">
                  {formatCurrency(calculateSum(monthlyLocacoesSaida))}
                </td>
              </tr>

              {/* Detalhamento de locações saidas */}
              {categories.filter(c => !c.excludeFromDRE && c.grupo === 'locacao' && c.natureza === 'saida').map(cat => (
                <tr key={cat.id} className="hover:bg-slate-55/40 text-slate-500 font-medium">
                  <td className="px-5 py-2 pl-10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nome || cat.name}
                  </td>
                  {months.map((_, mIdx) => {
                    const value = dreMatrix[cat.id] ? dreMatrix[cat.id][mIdx] : 0;
                    return (
                      <td key={mIdx} className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">
                        {formatCurrency(value, mIdx)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-2 text-right font-bold text-slate-600">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* 3. MARGEM DA CARTEIRA LOCACOES */}
              <tr className="bg-emerald-50/40 border-t border-slate-200">
                <td className="px-5 py-3.5 font-black text-emerald-800 uppercase text-[10.5px]">3. Margem Líquida da Carteira de Locação (1 - 2)</td>
                {monthlyLocacoesLiquido.map((val, idx) => (
                  <td key={idx} className="px-3 py-3.5 text-center text-emerald-600 font-bold font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3.5 text-right font-black text-emerald-600 font-sans">
                  {formatCurrency(calculateSum(monthlyLocacoesLiquido))}
                </td>
              </tr>

              {/* 4. RECEITAS CAIXA */}
              <tr className="bg-blue-50/15 border-t border-slate-200">
                <td className="px-5 py-3 font-extrabold text-slate-800 uppercase text-[10.5px]">4. Receitas Secundárias / Caixa (+)</td>
                {monthlyCaixaEntras.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center text-blue-600 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-extrabold text-blue-600 font-sans">
                  {formatCurrency(calculateSum(monthlyCaixaEntras))}
                </td>
              </tr>

              {/* Detalhamento de caixa entradas */}
              {categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'entrada').map(cat => (
                <tr key={cat.id} className="hover:bg-slate-55/40 text-slate-500 font-medium">
                  <td className="px-5 py-2 pl-10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nome || cat.name}
                  </td>
                  {months.map((_, mIdx) => {
                    const value = dreMatrix[cat.id] ? dreMatrix[cat.id][mIdx] : 0;
                    return (
                      <td key={mIdx} className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">
                        {formatCurrency(value, mIdx)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-2 text-right font-bold text-slate-600">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* 5. RECEITA BRUTA OPERACIONAL REAL */}
              <tr className="bg-indigo-50/40 border-y border-indigo-100">
                <td className="px-5 py-3.5 font-black text-indigo-900 uppercase text-[10.5px]">5. Receita Operacional Bruta Real (3 + 4)</td>
                {monthlyReceitaBrutaTotal.map((val, idx) => (
                  <td key={idx} className="px-3 py-3.5 text-center text-indigo-600 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3.5 text-right font-black text-indigo-600 font-sans">
                  {formatCurrency(calculateSum(monthlyReceitaBrutaTotal))}
                </td>
              </tr>

              {/* 6. DESPESAS FIXAS */}
              <tr className="bg-rose-50/10 border-t border-slate-200">
                <td className="px-5 py-3 font-extrabold text-slate-800 uppercase text-[10.5px]">6. Despesas Operacionais Fixas (-)</td>
                {monthlyDespesasFixas.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center text-rose-500 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-extrabold text-rose-500 font-sans">
                  {formatCurrency(calculateSum(monthlyDespesasFixas))}
                </td>
              </tr>

              {/* Detalhamento de caixa despesas fixas */}
              {categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'fixo').map(cat => (
                <tr key={cat.id} className="hover:bg-slate-55/40 text-slate-500 font-medium">
                  <td className="px-5 py-2 pl-10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nome || cat.name}
                  </td>
                  {months.map((_, mIdx) => {
                    const value = dreMatrix[cat.id] ? dreMatrix[cat.id][mIdx] : 0;
                    return (
                      <td key={mIdx} className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">
                        {formatCurrency(value, mIdx)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-2 text-right font-bold text-slate-600">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* 7. DESPESAS VARIAVEIS */}
              <tr className="bg-rose-50/10 border-t border-slate-200">
                <td className="px-5 py-3 font-extrabold text-slate-800 uppercase text-[10.5px]">7. Despesas Operacionais Variáveis (-)</td>
                {monthlyDespesasVariaveis.map((val, idx) => (
                  <td key={idx} className="px-3 py-3 text-center text-rose-500 font-sans">{formatCurrency(val, idx)}</td>
                ))}
                <td className="px-5 py-3 text-right font-extrabold text-rose-500 font-sans">
                  {formatCurrency(calculateSum(monthlyDespesasVariaveis))}
                </td>
              </tr>

              {/* Detalhamento de caixa despesas variaveis */}
              {categories.filter(c => !c.excludeFromDRE && c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'variavel').map(cat => (
                <tr key={cat.id} className="hover:bg-slate-55/40 text-slate-500 font-medium">
                  <td className="px-5 py-2 pl-10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nome || cat.name}
                  </td>
                  {months.map((_, mIdx) => {
                    const value = dreMatrix[cat.id] ? dreMatrix[cat.id][mIdx] : 0;
                    return (
                      <td key={mIdx} className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">
                        {formatCurrency(value, mIdx)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-2 text-right font-bold text-slate-600">
                    {formatCurrency(calculateSum(dreMatrix[cat.id] || []))}
                  </td>
                </tr>
              ))}

              {/* 8. RESULTADO LIQUIDO OPERACIONAL REAL */}
              <tr className="bg-slate-900 text-white border-t-2 border-slate-400">
                <td className="px-5 py-4 font-black uppercase text-xs">(=) Resultado Líquido Executado (Lucro Líquido)</td>
                {monthlyResultadoLiquido.map((val, idx) => (
                  <td key={idx} className={`px-3 py-4 text-center font-black font-sans text-xs ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(val, idx)}
                  </td>
                ))}
                <td className={`px-5 py-4 text-right font-black font-sans text-xs ${calculateSum(monthlyResultadoLiquido) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrencyValue(calculateSum(monthlyResultadoLiquido))}
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
