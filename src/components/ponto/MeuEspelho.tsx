import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { usePontoMes, useSolicitarAjuste } from "../../hooks/useQueries";
import { UserProfile, PontoRegistro } from "../../types";
import { toast } from "sonner";

interface MeuEspelhoProps {
  profile: UserProfile | null;
}

export const formatMinutesToHHMM = (totalMinutes: number): string => {
  const isNegative = totalMinutes < 0;
  const absMin = Math.abs(totalMinutes);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  return `${isNegative ? "-" : ""}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatMinutesToHoursFriendly = (totalMinutes: number): string => {
  const isNegative = totalMinutes < 0;
  const absMin = Math.abs(totalMinutes);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  return `${isNegative ? "-" : ""}${h}h ${m}m`;
};

export const MeuEspelho: React.FC<MeuEspelhoProps> = ({ profile }) => {
  const userId = profile?.uid || "";
  const userName = profile?.displayName || "Colaborador";
  const agencyId = profile?.companyId || "default_agency";
  const jornada = profile?.jornadaDiariaMinutos || 480;

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-indexed

  const { data: registros = [], isLoading } = usePontoMes(userId, selectedYear, selectedMonth);
  const solicitarAjusteMutation = useSolicitarAjuste();

  // Adjustment Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [targetRegId, setTargetRegId] = useState("");
  const [campoAjuste, setCampoAjuste] = useState<"entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida">("entrada");
  const [valorAtual, setValorAtual] = useState("");
  const [valorSolicitado, setValorSolicitado] = useState("");
  const [motivo, setMotivo] = useState("");

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(v => v - 1);
    } else {
      setSelectedMonth(v => v - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(v => v + 1);
    } else {
      setSelectedMonth(v => v + 1);
    }
  };

  // Generate days array for the selected month
  const diasDoMes = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [selectedYear, selectedMonth]);

  // Turn registrations into a map indexed by date String (YYYY-MM-DD)
  const registrosMap = useMemo(() => {
    const map = new Map<string, PontoRegistro>();
    registros.forEach(r => {
      map.set(r.date, r);
    });
    return map;
  }, [registros]);

  // Calc totals
  const totais = useMemo(() => {
    let totalTrabalhadas = 0;
    let totalExtras = 0;
    let diasTrabalhados = 0;

    registros.forEach(r => {
      if (r.horasTrabalhadas !== undefined) {
        totalTrabalhadas += r.horasTrabalhadas;
        diasTrabalhados++;
      }
      if (r.horasExtras !== undefined) {
        totalExtras += r.horasExtras;
      }
    });

    return { totalTrabalhadas, totalExtras, diasTrabalhados };
  }, [registros]);

  const handleOpenAjuste = (date: string, regId: string, campo: typeof campoAjuste, currentVal?: string) => {
    setTargetDate(date);
    setTargetRegId(regId);
    setCampoAjuste(campo);
    setValorAtual(currentVal || "");
    setValorSolicitado(currentVal || "");
    setMotivo("");
    setIsModalOpen(true);
  };

  const handleSaveAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorSolicitado || !valorSolicitado.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      toast.error("Formato de hora inválido. Use HH:mm");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Descreva o motivo para a liberação da correção.");
      return;
    }

    solicitarAjusteMutation.mutate({
      registroId: targetRegId,
      userId,
      userName,
      agencyId,
      data: targetDate,
      campo: campoAjuste,
      valorAtual,
      valorSolicitado,
      motivo
    }, {
      onSuccess: () => {
        setIsModalOpen(false);
      }
    });
  };

  const getWeekDayName = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return weekDays[d.getDay()];
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Seletor do Mês */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800">Período de Apuração</h3>
        </div>
        
        <div className="flex items-center gap-3 self-center sm:self-auto">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-50 border border-slate-250 rounded-lg text-slate-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
            {monthNames[selectedMonth - 1]} de {selectedYear}
          </span>

          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-50 border border-slate-250 rounded-lg text-slate-600 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Trabalhado</span>
            <h4 className="text-lg font-bold text-slate-700 mt-0.5">
              {formatMinutesToHoursFriendly(totais.totalTrabalhadas)}
            </h4>
          </div>
        </div>

        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4`}>
          <div className={`p-3 rounded-lg ${totais.totalExtras >= 0 ? "bg-indigo-50 text-indigo-600" : "bg-red-50 text-red-600"}`}>
            {totais.totalExtras >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Saldo Banco de Horas</span>
            <h4 className={`text-lg font-bold mt-0.5 ${totais.totalExtras >= 0 ? "text-indigo-600" : "text-amber-600"}`}>
              {formatMinutesToHoursFriendly(totais.totalExtras)}
            </h4>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
          <div className="bg-sky-50 text-sky-600 p-3 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Dias Registrados</span>
            <h4 className="text-lg font-bold text-slate-700 mt-0.5">
              {totais.diasTrabalhados} Dias
            </h4>
          </div>
        </div>
      </div>

      {/* Tabela do Espelho */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-600 text-xs border-collapse">
            <thead>
              <tr className="bg-slate-55 border-b border-slate-100 font-bold text-slate-500 text-xxs uppercase tracking-wider">
                <th className="py-4 px-4 w-28">Dia</th>
                <th className="py-4 px-3">Entrada</th>
                <th className="py-4 px-3">S. Almoço</th>
                <th className="py-4 px-3">R. Almoço</th>
                <th className="py-4 px-3">Saída</th>
                <th className="py-4 px-3">Trabalhado</th>
                <th className="py-4 px-3">Saldo</th>
                <th className="py-4 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <span className="animate-pulse">Buscando espelho de ponto...</span>
                  </td>
                </tr>
              ) : diasDoMes.map(dia => {
                const diaStr = String(dia).padStart(2, '0');
                const pDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${diaStr}`;
                const reg = registrosMap.get(pDate);
                const wName = getWeekDayName(pDate);
                const isWeekend = wName === "Sáb" || wName === "Dom";

                const regId = `${userId}_${pDate}`;

                if (!reg) {
                  return (
                    <tr key={dia} className={`bg-slate-50/45 hover:bg-slate-100/80 transition-colors ${isWeekend ? "bg-slate-110/30 font-semibold" : ""}`}>
                      <td className="py-3.5 px-4 font-semibold text-slate-400 font-mono">
                        {diaStr}/{String(selectedMonth).padStart(2, '0')} <span className="text-xxs font-normal">({wName})</span>
                      </td>
                      <td colSpan={4} className="py-3.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
                          Sem registro
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 font-mono">--:--</td>
                      <td className="py-3.5 px-3 text-slate-400 font-mono">--:--</td>
                      <td className="py-3.5 px-4">
                        <button
                          id={`btn-new-adjust-${dia}`}
                          onClick={() => handleOpenAjuste(pDate, regId, "entrada")}
                          className="text-sky-600 hover:underline font-bold text-xxs bg-sky-50 px-2.5 py-1 rounded-lg"
                        >
                          Solicitar Ajuste
                        </button>
                      </td>
                    </tr>
                  );
                }

                // Format worked hours and extras
                const trabalhadoStr = reg.horasTrabalhadas !== undefined 
                  ? formatMinutesToHHMM(reg.horasTrabalhadas) 
                  : "--:--";
                const saldoStr = reg.horasExtras !== undefined 
                  ? (reg.horasExtras >= 0 ? "+" : "") + formatMinutesToHHMM(reg.horasExtras) 
                  : "--:--";

                return (
                  <tr key={dia} className={`hover:bg-slate-55/50 ${isWeekend ? "bg-slate-50/30" : ""} ${reg.status === "ajuste_pendente" ? "bg-sky-50/20" : ""}`}>
                    <td className="py-3 px-4 font-semibold text-slate-700 font-mono">
                      {diaStr}/{String(selectedMonth).padStart(2, '0')} <span className="text-slate-400 text-xxs font-normal">({wName})</span>
                    </td>
                    
                    {/* ENTRADA */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 group">
                        <span className="font-semibold text-slate-700 font-mono">{reg.entrada || "--:--"}</span>
                        <button 
                          onClick={() => handleOpenAjuste(pDate, reg.id, "entrada", reg.entrada)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 text-[10px] leading-none ml-1 underline cursor-pointer"
                        >
                          Ajustar
                        </button>
                      </div>
                    </td>

                    {/* SAIDA ALMOCO */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 group">
                        <span className="font-semibold text-slate-700 font-mono">{reg.saidaAlmoco || "--:--"}</span>
                        <button 
                          onClick={() => handleOpenAjuste(pDate, reg.id, "saidaAlmoco", reg.saidaAlmoco)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 text-[10px] leading-none ml-1 underline cursor-pointer"
                        >
                          Ajustar
                        </button>
                      </div>
                    </td>

                    {/* RETORNO ALMOCO */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 group">
                        <span className="font-semibold text-slate-700 font-mono">{reg.retornoAlmoco || "--:--"}</span>
                        <button 
                          onClick={() => handleOpenAjuste(pDate, reg.id, "retornoAlmoco", reg.retornoAlmoco)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 text-[10px] leading-none ml-1 underline cursor-pointer"
                        >
                          Ajustar
                        </button>
                      </div>
                    </td>

                    {/* SAIDA */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 group">
                        <span className="font-semibold text-slate-700 font-mono">{reg.saida || "--:--"}</span>
                        <button 
                          onClick={() => handleOpenAjuste(pDate, reg.id, "saida", reg.saida)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 text-[10px] leading-none ml-1 underline cursor-pointer"
                        >
                          Ajustar
                        </button>
                      </div>
                    </td>

                    {/* TRABALHADO */}
                    <td className="py-3 px-3 font-bold text-slate-700 font-mono">
                      {trabalhadoStr}
                    </td>

                    {/* SALDO */}
                    <td className={`py-3 px-3 font-bold font-mono ${reg.horasExtras && reg.horasExtras < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {saldoStr}
                    </td>

                    {/* STATUS DE SEGUNDO PLANO */}
                    <td className="py-3 px-4">
                      {reg.status === "completo" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          Completo
                        </span>
                      )}
                      {reg.status === "incompleto" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-705">
                          Incompleto
                        </span>
                      )}
                      {reg.status === "ajuste_pendente" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 animate-pulse">
                          Ajuste Pendente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Linha de Totais da Tabela */}
            {!isLoading && registros.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200 text-slate-700 font-bold">
                <tr>
                  <td className="py-4 px-4 uppercase text-xxs tracking-wider">Total Geral</td>
                  <td colSpan={4}></td>
                  <td className="py-4 px-3 font-mono">{formatMinutesToHHMM(totais.totalTrabalhadas)}</td>
                  <td className={`py-4 px-3 font-mono ${totais.totalExtras < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {totais.totalExtras >= 0 ? "+" : ""}{formatMinutesToHHMM(totais.totalExtras)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal para Solicitar Ajuste */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-600" />
              <h3 className="text-base font-bold text-slate-800">Pedir Correção no Dia {targetDate.split('-').reverse().join('/')}</h3>
            </div>
            
            <form onSubmit={handleSaveAjuste} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Campo a ajustar
                </label>
                <select
                  value={campoAjuste}
                  onChange={(e: any) => setCampoAjuste(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saidaAlmoco">Saída Almoço</option>
                  <option value="retornoAlmoco">Retorno Almoço</option>
                  <option value="saida">Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Valor Atual
                </label>
                <input
                  type="text"
                  disabled
                  value={valorAtual || "Não registrado"}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-100 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Hora Solicitada (HH:mm)
                </label>
                <input
                  type="text"
                  placeholder="08:00"
                  value={valorSolicitado}
                  onChange={(e) => setValorSolicitado(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Justificativa
                </label>
                <textarea
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Justifique o motivo para a liberação da correção"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 bg-slate-50 rounded-lg text-xs font-bold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={solicitarAjusteMutation.isPending}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 disabled:opacity-50"
                >
                  {solicitarAjusteMutation.isPending ? "Processando..." : "Enviar Solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
