import React, { useMemo } from "react";
import { DollarSign, BarChart3, TrendingUp, Calendar, ArrowUpRight, TrendingDown, Clock } from "lucide-react";
import { Sale, BrokerSplit } from "../../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import { round2 } from "../../hooks/useQueries";
import { toast } from "sonner";

interface CommissionDashboardProps {
  sales: Sale[];
  splits: BrokerSplit[];
  onOpenCreateForm: () => void;
}

export const CommissionDashboard: React.FC<CommissionDashboardProps> = ({
  sales,
  splits,
  onOpenCreateForm
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Filtrar dados ativos
  const activeSales = useMemo(() => sales.filter(s => s.status === "ACTIVE"), [sales]);
  const activeSplits = useMemo(() => splits.filter(s => {
    const parent = sales.find(v => v.id === s.sale_id);
    return parent ? parent.status === "ACTIVE" : true;
  }), [splits, sales]);

  // Alertas de Notas Fiscais pendentes de emissão (DRE)
  const nfAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return activeSales
      .filter(s => s.data_vencimento_nf && !s.nf_emitida)
      .map(s => {
        const deadlineDate = new Date(s.data_vencimento_nf + "T00:00:00");
        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          sale: s,
          diffDays
        };
      })
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [activeSales]);

  const isEmpty = activeSales.length === 0;

  if (isEmpty) {
    return (
      <div id="commission-dashboard-empty-container" className="w-full flex flex-col items-center justify-center p-4 md:p-12 text-center animate-fade-in-up">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes softPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.4s ease forwards;
          }
          .animate-soft-pulse {
            animation: softPulse 3s infinite ease-in-out;
          }
        ` }} />

        {/* Ícone animado */}
        <div className="w-[120px] h-[120px] rounded-full border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center mb-6 animate-soft-pulse shrink-0 font-bold">
          <TrendingUp className="w-16 h-16 text-slate-200" />
        </div>

        {/* Título e Subtítulo */}
        <h3 className="text-xl font-black text-slate-700 tracking-tight mb-2">
          Nenhuma venda registrada ainda
        </h3>
        <p className="text-sm text-slate-400 max-w-[400px] leading-relaxed mx-auto mb-8">
          Lance sua primeira venda para começar a visualizar receitas, repasses e o painel de comissões da equipe.
        </p>

        {/* Card de primeiros passos */}
        <div className="w-full max-w-[480px] bg-white border border-slate-100 rounded-[16px] p-6 shadow-sm text-left mb-8 mx-auto">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-5">
            📋 Como começar
          </h4>
          
          <div className="space-y-6">
            {/* Passo 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0 text-sm">
                1
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-800 text-sm leading-tight">Cadastre os corretores da equipe</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Acesse Config. Usuários e ative a permissão de comissões para cada corretor
                </p>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("change-tab", { detail: "users" }))}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-all mt-1 p-0 bg-transparent border-none text-left"
                >
                  Ir para Config. Usuários &rarr;
                </button>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0 text-sm">
                2
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-800 text-sm leading-tight">Lance sua primeira venda</h5>
                <p className="text-xs text-slate-500 leading-relaxed flex-initial">
                  Informe o imóvel, valor, comissão e divida os repasses de comissão entre os corretores envolvidos
                </p>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0 text-sm">
                3
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-800 text-sm leading-tight">Acompanhe repasses e gere relatórios</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  O painel atualiza automaticamente com receitas, repasses pendentes e agenda de pagamentos
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botão principal de ação */}
        <div className="w-full md:w-auto px-4 md:px-0">
          <button
            onClick={onOpenCreateForm}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
          >
            + Lançar primeira venda
          </button>
        </div>

        {/* Link secundário */}
        <button
          type="button"
          onClick={() => toast.info("Em breve: tutorial interativo do módulo de comissões")}
          className="text-sm text-blue-500 hover:text-blue-700 underline cursor-pointer mt-4 font-semibold bg-transparent border-none"
        >
          Ver tutorial do módulo de comissões &rarr;
        </button>
      </div>
    );
  }

  // Cálculos consolidados para os indicadores principais
  const totals = useMemo(() => {
    let faturamentoComissaoTotal = 0; // Soma das comissões brutas geradas nas vendas
    let pagoTotal = 0;              // Soma dos splits pagos
    let pendenteTotal = 0;          // Soma dos splits pendentes e saldo restante de parciais

    activeSales.forEach(s => {
      faturamentoComissaoTotal += (s.total_commission || 0);
    });

    activeSplits.forEach(sp => {
      if (sp.status === "PAID") {
        pagoTotal += (sp.calculated_value || 0);
      } else if (sp.status === "PENDING" || sp.status === "PARTIAL") {
        pendenteTotal += (sp.calculated_value || 0);
      }
    });

    return {
      faturamentoComissaoTotal: round2(faturamentoComissaoTotal),
      pagoTotal: round2(pagoTotal),
      pendenteTotal: round2(pendenteTotal),
      ticketMedioVendas: activeSales.length > 0 ? round2(activeSales.reduce((acc, s) => acc + s.sale_value, 0) / activeSales.length) : 0,
      vendasQtd: activeSales.length
    };
  }, [activeSales, activeSplits]);

  // Distribuição por corretor (Grafico de Pizza)
  const brokerDistribution = useMemo(() => {
    const brokerTotals: Record<string, { name: string; value: number }> = {};
    activeSplits.forEach(sp => {
      const brokerName = sp.broker_name || "Corretor";
      const val = sp.calculated_value || 0;
      if (!brokerTotals[sp.broker_id]) {
        brokerTotals[sp.broker_id] = { name: brokerName, value: 0 };
      }
      brokerTotals[sp.broker_id].value += val;
    });

    return Object.values(brokerTotals)
      .map(item => ({ name: item.name, value: round2(item.value) }))
      .sort((a, b) => b.value - a.value);
  }, [activeSplits]);

  // Faturamento por cargo/papel (Gráfico de Barras)
  const roleDistribution = useMemo(() => {
    const roles = {
      VENDEDOR: { name: "Vendas", value: 0 },
      CAPTADOR: { name: "Captações", value: 0 },
      GESTOR: { name: "Cargos de Gestão", value: 0 }
    };

    activeSplits.forEach(sp => {
      const roleKey = sp.role as keyof typeof roles;
      if (roles[roleKey]) {
        roles[roleKey].value += (sp.calculated_value || 0);
      }
    });

    return Object.values(roles).map(r => ({ name: r.name, value: round2(r.value) }));
  }, [activeSplits]);

  // Próximos Pagamentos Pendentes Cronológicos
  const nextPendingSplits = useMemo(() => {
    return activeSplits
      .filter(sp => sp.status !== "PAID")
      .sort((a, b) => new Date(a.forecast_date).getTime() - new Date(b.forecast_date).getTime())
      .slice(0, 5);
  }, [activeSplits]);

  const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#7c3aed", "#ec4899", "#14b8a6"];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease forwards;
        }
      ` }} />
      
      {/* Notificações de Prazos de Nota Fiscal */}
      {nfAlerts.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 md:p-6 space-y-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100/80 text-amber-705 rounded-xl mt-0.5 shrink-0">
              <Clock className="w-5 h-5 font-bold animate-pulse text-amber-700" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-amber-900 tracking-tight">Prazos de Emissão de Nota Fiscal (DRE)</h4>
              <p className="text-xs text-amber-750 font-medium leading-relaxed">
                Prazos limites de emissão de NF identificados. Emita a nota fiscal para cada venda ativa para evitar pendências fiscais no relatório de resultados do DRE.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {nfAlerts.map(({ sale, diffDays }) => {
              const overdue = diffDays < 0;
              const isToday = diffDays === 0;
              const formattedDate = sale.data_vencimento_nf
                ? sale.data_vencimento_nf.split("-").reverse().join("/")
                : "";

              return (
                <div
                  key={sale.id}
                  className={`bg-white border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow transition-all ${
                    overdue
                      ? "border-red-150 bg-red-50/10 hover:border-red-250"
                      : isToday
                      ? "border-orange-150 bg-orange-50/10 hover:border-orange-250"
                      : "border-slate-150 hover:border-slate-200"
                  }`}
                >
                  <div className="space-y-1 max-w-[70%]">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Imóvel</span>
                    <strong className="text-xs font-black text-slate-800 block truncate">{sale.property_address}</strong>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Comprador: {sale.client_name}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block">Vencimento</span>
                    <strong className={`text-xs font-black block mt-0.5 ${overdue ? "text-red-600" : isToday ? "text-orange-600" : "text-slate-700"}`}>
                      {formattedDate}
                    </strong>
                    
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest mt-1.5 border ${
                      overdue
                        ? "bg-red-55 text-red-700 border-red-100"
                        : isToday
                        ? "bg-orange-55 text-orange-700 border-orange-100"
                        : "bg-slate-55 text-slate-600 border-slate-100"
                    }`}>
                      {overdue ? "ATRASADO" : isToday ? "HOJE" : `${diffDays} dia${diffDays > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Indicadores Principais (Bento Style Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Receita Gerada */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between group hover:border-blue-150 hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Receita Bruta Gerada</span>
            <strong className="text-xl font-black text-slate-800 leading-none block">
              {formatCurrency(totals.faturamentoComissaoTotal)}
            </strong>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Sobre {totals.vendasQtd} vendas</p>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Repasses Concluídos */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between group hover:border-emerald-150 hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Repasses Concluídos</span>
            <strong className="text-xl font-black text-emerald-600 leading-none block">
              {formatCurrency(totals.pagoTotal)}
            </strong>
            <div className="text-[10px] text-emerald-500 font-bold uppercase flex items-center gap-1.5">
              <ArrowUpRight className="w-3 h-3" />
              Sincronizado via TED/PIX
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Repasses Pendentes */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between group hover:border-amber-150 hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Saldo Pendente</span>
            <strong className="text-xl font-black text-amber-600 leading-none block">
              {formatCurrency(totals.pendenteTotal)}
            </strong>
            <p className="text-[10px] text-amber-500 font-bold uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Aguardando faturamento
            </p>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Ticket Médio de Vendas */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between group hover:border-purple-150 hover:shadow-md transition-all">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Ticket Médio Venda</span>
            <strong className="text-xl font-black text-slate-800 leading-none block">
              {formatCurrency(totals.ticketMedioVendas)}
            </strong>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Preço médio por lote / imóvel</p>
          </div>
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Seção de Gráficos Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Repasses por Cargo */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Comissões por Cargo</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Divisão de faturamento baseado no papel na venda</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 650, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), "Faturamento de Repasses"]}
                  contentStyle={{ background: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px" }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Corretor */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Divisão por Profissional</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total acumulado de repasses por corretor (ativo)</p>
          </div>
          <div className="h-64 flex flex-col sm:flex-row items-center gap-4 justify-center">
            {brokerDistribution.length > 0 ? (
              <>
                <div className="h-full w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={brokerDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {brokerDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [formatCurrency(value), "Total"]}
                        contentStyle={{ background: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px" }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {brokerDistribution.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="font-semibold text-slate-700 truncate max-w-32">{item.name}</span>
                      </div>
                      <strong className="font-black text-slate-800">{formatCurrency(item.value)}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center w-full">
                <div className="border-2 border-dashed border-slate-100 rounded-full w-24 h-24 flex flex-col items-center justify-center mx-auto mb-3">
                  <span className="text-slate-200 font-extrabold text-[9px] uppercase tracking-wide">Sem dados</span>
                </div>
                <strong className="text-xs font-black text-slate-700 block text-center">Nenhum repasse consolidado</strong>
                <span className="text-[10px] text-slate-400 mt-1 max-w-[200px] text-center">Os dados aparecerão após o primeiro pagamento registrado</span>
              </div>
            )}
          </div>
        </div>

        {/* Listagem lateral de Próximas previsões */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Agenda de Próximos Pagamentos</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Estimativa de liberação cronológica de comissões pendentes</p>
            </div>
            <span className="text-[9px] bg-slate-50 text-slate-500 font-black tracking-widest uppercase border border-slate-150 px-2.5 py-1 rounded-full">
              Próximos fluxos
            </span>
          </div>

          <div className="divide-y divide-slate-100 font-sans">
            {nextPendingSplits.length > 0 ? (
              nextPendingSplits.map((item) => {
                const parts = item.forecast_date.split("-");
                const formattedForecast = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.forecast_date;

                return (
                  <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0 animate-fadeIn text-sm">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex flex-col items-center justify-center text-amber-700">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-xs font-extrabold text-slate-800 uppercase tracking-tight block">
                          {item.broker_name}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-semibold">{item.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 sm:text-right">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Liberação Prevista</span>
                        <span className="text-xs font-black text-slate-700">{formattedForecast}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Valor do Repasse</span>
                        <strong className="text-xs sm:text-sm font-black text-amber-600">
                          {formatCurrency(item.calculated_value)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 flex flex-col items-center justify-center">
                <Calendar className="w-12 h-12 text-slate-200 mb-2 font-bold" />
                <strong className="text-sm font-black text-slate-700 block">Nenhum pagamento agendado</strong>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  As previsões de pagamento aparecem após lançar vendas parceladas ou com repasses pendentes
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
