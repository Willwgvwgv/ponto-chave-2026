import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ChevronRight,
  Sparkles,
  Info,
  CalendarDays
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { BankAccount, FinancialTransaction } from '../../types';

interface FluxoCaixaTabProps {
  accounts: BankAccount[];
  transactions: FinancialTransaction[];
  upcomingSalesCommissions: { propertyAddress: string; amount: number; date: string }[];
  upcomingBrokerPayouts: { brokerName: string; amount: number; date: string }[];
}

export const FluxoCaixaTab: React.FC<FluxoCaixaTabProps> = ({
  accounts,
  transactions,
  upcomingSalesCommissions, // Contratos de vendas pendentes (Receitas previstas)
  upcomingBrokerPayouts     // Splits de corretores pendentes (Despesas previstas)
}) => {
  const [projectionDays, setProjectionDays] = useState<30 | 60 | 90>(30);

  // Saldo inicial consolidado
  const initialBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [accounts]);

  // Projeção diária para os próximos X dias
  const projectionData = useMemo(() => {
    const data = [];
    let runningBalance = initialBalance;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mapeia dias futuros
    for (let i = 0; i <= projectionDays; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];

      // 1. Receitas previstas (vendas comissão) e despesas previstas (splits)
      let inflow = 0;
      let outflow = 0;

      upcomingSalesCommissions.forEach(item => {
        if (item.date === dateStr) {
          inflow += item.amount;
        }
      });

      upcomingBrokerPayouts.forEach(item => {
        if (item.date === dateStr) {
          outflow += item.amount;
        }
      });

      // 2. Transações agendadas do próprio financeiro (status === PENDENTE ou AGENDADO)
      transactions.forEach(t => {
        if (t.status === 'IGNORADO' || t.status === 'CANCELADO') return;
        if (t.type === 'TRANSFERENCIA' || t.isTransfer) return;
        if ((t.status === 'PENDENTE' || t.status === 'AGENDADO') && t.date === dateStr) {
          if (t.type === 'RECEITA') {
            inflow += Math.abs(t.amount);
          } else if (t.type === 'DESPESA') {
            outflow += Math.abs(t.amount);
          }
        }
      });

      runningBalance = runningBalance + inflow - outflow;

      data.push({
        date: dateStr,
        label: targetDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
        Entradas: inflow,
        Saídas: outflow,
        Saldo: runningBalance
      });
    }

    return data;
  }, [initialBalance, projectionDays, upcomingSalesCommissions, upcomingBrokerPayouts, transactions]);

  // Resumo de previsões acumuladas do lote selecionado
  const totals = useMemo(() => {
    let inflowSum = 0;
    let outflowSum = 0;

    projectionData.forEach(d => {
      inflowSum += d.Entradas;
      outflowSum += d.Saídas;
    });

    return {
      entradas: inflowSum,
      saidas: outflowSum,
      saldoFinal: initialBalance + inflowSum - outflowSum
    };
  }, [projectionData, initialBalance]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-end">
        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 w-fit">
          {([30, 60, 90] as const).map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setProjectionDays(days)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${projectionDays === days ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-705'}`}
            >
              Próximos {days} dias
            </button>
          ))}
        </div>
      </div>

      {/* Cartões de Prospecção */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Saldo Inicial Corrente</p>
          <p className="text-xl font-black text-slate-800 mt-2 tracking-tight">
            {formatCurrency(initialBalance)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-500 font-bold">
            <CalendarDays className="w-3.5 h-3.5" />
            Hoje
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Entradas Previstas ({projectionDays}d)</p>
          <p className="text-xl font-black text-teal-600 mt-2 tracking-tight">
            + {formatCurrency(totals.entradas)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-teal-600 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            Contratos em Carteira
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Saídas Previstas ({projectionDays}d)</p>
          <p className="text-xl font-black text-rose-500 mt-2 tracking-tight">
            - {formatCurrency(totals.saidas)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-rose-500 font-bold">
            <TrendingDown className="w-3.5 h-3.5" />
            Repasses Pendentes
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-855 rounded-3xl p-6 border border-slate-800 shadow-xl text-white">
          <p className="text-[10px] opacity-75 font-extrabold uppercase tracking-widest">Saldo Final Projetado</p>
          <p className="text-xl font-black mt-2 tracking-tight">
            {formatCurrency(totals.saldoFinal)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] font-bold text-sky-450">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Estimativa de caixa final
          </div>
        </div>
      </div>

      {/* Gráfico de Projeção */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Linha do Saldo Acumulado Projetado</h3>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Flutuação diária estimada do saldo total das contas</p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip 
                contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', fontSize: '11px' }} 
              />
              <Area type="monotone" dataKey="Saldo" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaldo)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lista de Transações de Projecção Futura */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Próximos Recebíveis e Repasses de Carteira</h3>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Relação analítica dos eventos cronológicos previstos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Receitas Futuras */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              Previsão de Receita (Vendas ({projectionDays} dias))
            </h4>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {upcomingSalesCommissions.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic">Nenhum recebível futuro identificado.</p>
              ) : (
                upcomingSalesCommissions.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl transition-all border border-slate-100">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-400 block">{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight block max-w-xs truncate">{item.propertyAddress}</span>
                    </div>
                    <span className="text-xs font-black text-teal-600 font-mono">+ {formatCurrency(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Despesas Futuras */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
              Previsão de Repasses (Corretores ({projectionDays} dias))
            </h4>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {upcomingBrokerPayouts.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic">Nenhum repasse futuro identificado.</p>
              ) : (
                upcomingBrokerPayouts.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl transition-all border border-slate-100">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-400 block">{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight block max-w-xs truncate">{item.brokerName}</span>
                    </div>
                    <span className="text-xs font-black text-rose-500 font-mono">- {formatCurrency(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
