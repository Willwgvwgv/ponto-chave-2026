import React, { useState, useMemo } from 'react';
import { BankAccount, FinancialCategory, FinancialTransaction } from '../../types';
import { 
  AlertCircle, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Filter, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Landmark,
  CalendarClock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ContasPagarReceberTabProps {
  accounts: BankAccount[];
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
}

export const ContasPagarReceberTab: React.FC<ContasPagarReceberTabProps> = ({
  accounts,
  categories,
  transactions
}) => {
  // Filtros de visualização
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'DESPESA' | 'RECEITA'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Helpers de Data
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const next7DaysStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const currentMonthEndStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, []);

  // Mapeamentos rápidos
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // 1. Filtrar transações pendentes/não conciliadas (exclui CONCILIADO, IGNORADO, CANCELADO)
  const openTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Regra técnica: status diferente de CONCILIADO, IGNORADO e CANCELADO
      if (t.status === 'CONCILIADO' || t.status === 'IGNORADO' || t.status === 'CANCELADO') {
        return false;
      }
      return true;
    });
  }, [transactions]);

  // 2. Cálculos dos Cards de Resumo
  const summaryMetrics = useMemo(() => {
    let vencidosPagar = 0;
    let vencidosReceber = 0;
    let vencidosCount = 0;

    let venceHojePagar = 0;
    let venceHojeReceber = 0;
    let venceHojeCount = 0;

    let prox7DiasPagar = 0;
    let prox7DiasReceber = 0;
    let prox7DiasCount = 0;

    let mesPagar = 0;
    let mesReceber = 0;
    let mesCount = 0;

    openTransactions.forEach(t => {
      const txDate = t.date || '';
      const amount = Math.abs(t.amount || 0);
      const isReceita = t.type === 'RECEITA';

      // 1. Vencidos: date < hoje
      if (txDate < todayStr) {
        vencidosCount++;
        if (isReceita) {
          vencidosReceber += amount;
        } else {
          vencidosPagar += amount;
        }
      }

      // 2. Vence Hoje: date === hoje
      if (txDate === todayStr) {
        venceHojeCount++;
        if (isReceita) {
          venceHojeReceber += amount;
        } else {
          venceHojePagar += amount;
        }
      }

      // 3. Próximos 7 dias: hoje < date <= hoje + 7
      if (txDate > todayStr && txDate <= next7DaysStr) {
        prox7DiasCount++;
        if (isReceita) {
          prox7DiasReceber += amount;
        } else {
          prox7DiasPagar += amount;
        }
      }

      // 4. Restante do Mês Corrente: date >= hoje e date <= fim do mês corrente
      if (txDate >= todayStr && txDate <= currentMonthEndStr) {
        mesCount++;
        if (isReceita) {
          mesReceber += amount;
        } else {
          mesPagar += amount;
        }
      }
    });

    return {
      vencidos: { totalPagar: vencidosPagar, totalReceber: vencidosReceber, count: vencidosCount },
      venceHoje: { totalPagar: venceHojePagar, totalReceber: venceHojeReceber, count: venceHojeCount },
      prox7Dias: { totalPagar: prox7DiasPagar, totalReceber: prox7DiasReceber, count: prox7DiasCount },
      mesCorrente: { totalPagar: mesPagar, totalReceber: mesReceber, count: mesCount }
    };
  }, [openTransactions, todayStr, next7DaysStr, currentMonthEndStr]);

  // 3. Lançamentos filtrados e ordenados por data crescente (mais antigos/vencidos primeiro)
  const filteredList = useMemo(() => {
    return openTransactions
      .filter(t => {
        // Filtro por Conta Bancária
        if (selectedAccountId !== 'ALL' && t.accountId !== selectedAccountId) {
          return false;
        }

        // Filtro por Tipo (Despesa / Receita)
        if (selectedType !== 'ALL' && t.type !== selectedType) {
          return false;
        }

        // Filtro por Busca Textual (descrição, categoria, observações)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const desc = (t.description || '').toLowerCase();
          const catName = (t.categoryName || categoryMap.get(t.categoryId || '')?.name || '').toLowerCase();
          const notes = (t.notes || '').toLowerCase();
          if (!desc.includes(q) && !catName.includes(q) && !notes.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.date || '9999-99-99';
        const dateB = b.date || '9999-99-99';
        return dateA.localeCompare(dateB);
      });
  }, [openTransactions, selectedAccountId, selectedType, searchTerm, categoryMap]);

  // Helper de Formatação de Moeda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Helper de Formatação de Data
  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. CARDS DE RESUMO SUPERIOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: VENCIDOS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Vencidos
            </span>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
              {summaryMetrics.vencidos.count} {summaryMetrics.vencidos.count === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">A Pagar (Despesas)</span>
              <span className="text-xl font-black text-rose-600">
                {formatCurrency(summaryMetrics.vencidos.totalPagar)}
              </span>
            </div>
            {summaryMetrics.vencidos.totalReceber > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">A Receber:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(summaryMetrics.vencidos.totalReceber)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Data anterior a hoje ({formatDateBR(todayStr)})</div>
        </div>

        {/* CARD 2: VENCE HOJE */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Vence Hoje
            </span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
              {summaryMetrics.venceHoje.count} {summaryMetrics.venceHoje.count === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">A Pagar (Despesas)</span>
              <span className="text-xl font-black text-amber-600">
                {formatCurrency(summaryMetrics.venceHoje.totalPagar)}
              </span>
            </div>
            {summaryMetrics.venceHoje.totalReceber > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">A Receber:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(summaryMetrics.venceHoje.totalReceber)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Vencimento em {formatDateBR(todayStr)}</div>
        </div>

        {/* CARD 3: PRÓXIMOS 7 DIAS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Próximos 7 Dias
            </span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
              {summaryMetrics.prox7Dias.count} {summaryMetrics.prox7Dias.count === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">A Pagar (Despesas)</span>
              <span className="text-xl font-black text-slate-800">
                {formatCurrency(summaryMetrics.prox7Dias.totalPagar)}
              </span>
            </div>
            {summaryMetrics.prox7Dias.totalReceber > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">A Receber:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(summaryMetrics.prox7Dias.totalReceber)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Até {formatDateBR(next7DaysStr)}</div>
        </div>

        {/* CARD 4: RESTANTE DO MÊS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" />
              Restante do Mês
            </span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-full border border-slate-200">
              {summaryMetrics.mesCorrente.count} {summaryMetrics.mesCorrente.count === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">A Pagar</span>
                <span className="text-base font-black text-rose-600">
                  {formatCurrency(summaryMetrics.mesCorrente.totalPagar)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">A Receber</span>
                <span className="text-base font-black text-emerald-600">
                  {formatCurrency(summaryMetrics.mesCorrente.totalReceber)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Até {formatDateBR(currentMonthEndStr)}</div>
        </div>

      </div>

      {/* 2. BARRA DE FILTROS E BUSCA */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Filtros à Esquerda */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          {/* Seletor de Conta */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Landmark className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer pr-2"
            >
              <option value="ALL">Todas as Contas ({accounts.length})</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} {acc.accountType === 'CREDITO' ? '(Cartão)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Tipo (Despesa / Receita / Todos) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedType === 'ALL'
                  ? 'bg-white text-slate-800 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedType('DESPESA')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedType === 'DESPESA'
                  ? 'bg-white text-rose-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              <ArrowDownLeft className="w-3 h-3" />
              A Pagar (Despesas)
            </button>
            <button
              onClick={() => setSelectedType('RECEITA')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedType === 'RECEITA'
                  ? 'bg-white text-emerald-600 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" />
              A Receber (Receitas)
            </button>
          </div>

        </div>

        {/* Busca Textual à Direita */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

      </div>

      {/* 3. LISTAGEM DOS LANÇAMENTOS NÃO CONCILIADOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Lançamentos em Aberto
            </h3>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
              {filteredList.length} encontrados
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Ordenado por data de vencimento (crescente)
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">Nenhum lançamento pendente encontrado</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Todas as contas filtradas estão conciliadas ou não há lançamentos correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Conta</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((tx) => {
                  const isReceita = tx.type === 'RECEITA';
                  const isVencido = (tx.date || '') < todayStr;
                  const isHoje = tx.date === todayStr;
                  const acc = accountMap.get(tx.accountId);
                  const cat = categoryMap.get(tx.categoryId || '');
                  const catName = tx.categoryName || cat?.name || 'Sem Categoria';

                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVencido ? 'bg-rose-50/20' : isHoje ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Data / Vencimento */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-xs ${
                            isVencido ? 'text-rose-600' : isHoje ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {formatDateBR(tx.date)}
                          </span>
                          {isVencido && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold uppercase">
                              Vencido
                            </span>
                          )}
                          {isHoje && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold uppercase">
                              Hoje
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Descrição */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`p-1 rounded-md ${
                            isReceita ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {isReceita ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              {tx.description || '(Sem descrição)'}
                            </span>
                            {tx.notes && (
                              <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                                {tx.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200/60">
                          {catName}
                        </span>
                      </td>

                      {/* Conta Bancária */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {acc?.name || tx.accountId}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          tx.status === 'AGENDADO'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {tx.status || 'PENDENTE'}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-black text-xs">
                        <span className={isReceita ? 'text-emerald-600' : 'text-rose-600'}>
                          {isReceita ? '+' : '-'} {formatCurrency(Math.abs(tx.amount || 0))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
