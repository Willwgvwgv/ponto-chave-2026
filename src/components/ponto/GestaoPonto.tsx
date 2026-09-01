import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Download,
  Printer,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { useTeam, usePontoMes, calcularHoras } from "../../hooks/useQueries";
import { UserProfile, PontoRegistro, CompanySettings } from "../../types";
import { formatMinutesToHHMM, formatMinutesToHoursFriendly } from "./MeuEspelho";
import { FolhaPontoPrint } from "./FolhaPontoPrint";
import { getJornadaDescription, getExpectedDailyMinutes } from "../../utils/jornadaUtils";

interface GestaoPontoProps {
  profile: UserProfile | null;
  companySettings: CompanySettings | null;
}

export const GestaoPonto: React.FC<GestaoPontoProps> = ({ profile, companySettings }) => {
  const agencyId = profile?.companyId || "default_agency";

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showPrintModal, setShowPrintModal] = useState(false);

  const { data: team = [] } = useTeam(agencyId);

  // Set default selected user to first contributor or self
  const activeCollaborators = useMemo(() => {
    return team.filter(u => u.status !== "blocked");
  }, [team]);

  const selectedCollaborator = useMemo(() => {
    if (!selectedUserId && activeCollaborators.length > 0) {
      const defaultId = activeCollaborators[0].uid || activeCollaborators[0].id || "";
      setSelectedUserId(defaultId);
      return activeCollaborators[0];
    }
    return activeCollaborators.find(u => (u.uid === selectedUserId || u.id === selectedUserId)) || null;
  }, [activeCollaborators, selectedUserId]);

  const { data: registros = [], isLoading } = usePontoMes(selectedUserId, selectedYear, selectedMonth);

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

  const diasDoMes = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => i + 1);
  }, [selectedYear, selectedMonth]);

  const registrosMap = useMemo(() => {
    const map = new Map<string, PontoRegistro>();
    registros.forEach(r => {
      map.set(r.date, r);
    });
    return map;
  }, [registros]);

  const totais = useMemo(() => {
    let totalTrabalhadas = 0;
    let totalExtrasPositivas = 0;
    let totalFaltasNegativas = 0;
    let totalSaldoNet = 0;
    let diasTrabalhados = 0;

    registros.forEach(r => {
      const calc = calcularHoras(r, selectedCollaborator || 480, r.date);
      if (calc.trabalhadas > 0 || r.horasTrabalhadas) {
        const worked = calc.trabalhadas || r.horasTrabalhadas || 0;
        const extra = calc.extras !== undefined ? calc.extras : (r.horasExtras || 0);
        totalTrabalhadas += worked;
        diasTrabalhados++;
        totalSaldoNet += extra;
        if (extra > 0) {
          totalExtrasPositivas += extra;
        } else {
          totalFaltasNegativas += Math.abs(extra);
        }
      }
    });

    return { totalTrabalhadas, totalExtrasPositivas, totalFaltasNegativas, totalSaldoNet, diasTrabalhados };
  }, [registros, selectedCollaborator]);

  const getWeekDayName = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return weekDays[d.getDay()];
  };

  const handleExportCSV = () => {
    if (!selectedCollaborator) return;
    
    const headers = ["Data", "Entrada", "Saída Almoço", "Retorno", "Saída", "Horas Trabalhadas", "Saldo"];
    const csvRows = [headers.join(";")];
    
    diasDoMes.forEach(dia => {
      const diaStr = String(dia).padStart(2, '0');
      const pDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${diaStr}`;
      const reg = registrosMap.get(pDate);
      const wName = getWeekDayName(pDate);
      
      if (reg) {
        const calc = calcularHoras(reg, selectedCollaborator || 480, pDate);
        const worked = calc.trabalhadas || reg.horasTrabalhadas || 0;
        const extra = calc.extras !== undefined ? calc.extras : (reg.horasExtras || 0);

        const row = [
          `${diaStr}/${String(selectedMonth).padStart(2, '0')}/${selectedYear} (${wName})`,
          reg.entrada || "",
          reg.saidaAlmoco || "",
          reg.retornoAlmoco || "",
          reg.saida || "",
          formatMinutesToHHMM(worked),
          (extra >= 0 ? "+" : "") + formatMinutesToHHMM(extra)
        ];
        csvRows.push(row.map(cell => `"${cell}"`).join(";"));
      } else {
        const row = [
          `${diaStr}/${String(selectedMonth).padStart(2, '0')}/${selectedYear} (${wName})`,
          "", "", "", "", "", ""
        ];
        csvRows.push(row.map(cell => `"${cell}"`).join(";"));
      }
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `folha_ponto_${(selectedCollaborator.displayName || "co-worker").replace(/\s+/g, '_')}_${selectedYear}_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Controles de Filtros */}
      <div className="flex flex-col md:flex-row gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-sm md:items-center">
        
        {/* Dropdown de Colaborador */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            Colaborador
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
          >
            {activeCollaborators.map((u, idx) => {
              const val = u.uid || u.id || `colab-${idx}`;
              const colabName = u.displayName || (u as any).name || (u as any).nome || u.email || "Colaborador sem nome";
              const isAdm = u.role === "admin" || (u as any).originalRole === "admin";
              return (
                <option key={val} value={val}>
                  {colabName} {isAdm ? "(Admin)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Seletor Mês/Ano */}
        <div className="flex flex-col">
          <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 matches-label mb-1.5">
            Mês de Apuração
          </label>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 w-28 text-center">
              {monthNames[selectedMonth - 1]} / {selectedYear}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="md:self-end flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={registros.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          
          <button
            onClick={() => setShowPrintModal(true)}
            disabled={registros.length === 0 || !selectedCollaborator}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir Folha (Assinatura)
          </button>
        </div>
      </div>

      {/* Se não houver colaborador */}
      {!selectedCollaborator ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
          Nenhum colaborador encontrado na empresa para exibição de ponto.
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Horas Trabalhadas</span>
                <h4 className="text-base font-bold text-slate-700 mt-0.5">
                  {formatMinutesToHoursFriendly(totais.totalTrabalhadas)}
                </h4>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Horas Extras</span>
                <h4 className="text-base font-bold text-indigo-600 mt-0.5">
                  {formatMinutesToHoursFriendly(totais.totalExtrasPositivas)}
                </h4>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
              <div className="bg-amber-50 text-amber-600 p-3 rounded-lg">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Faltas (Banco Negativo)</span>
                <h4 className="text-base font-bold text-amber-600 mt-0.5">
                  {formatMinutesToHoursFriendly(totais.totalFaltasNegativas)}
                </h4>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${totais.totalSaldoNet >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-650"}`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Saldo Net Período</span>
                <h4 className={`text-base font-bold mt-0.5 ${totais.totalSaldoNet >= 0 ? "text-emerald-700" : "text-amber-600"}`}>
                  {totais.totalSaldoNet >= 0 ? "+" : ""}{formatMinutesToHoursFriendly(totais.totalSaldoNet)}
                </h4>
              </div>
            </div>
          </div>

          {/* Tabela do Espelho do Colaborador Selecionado */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Folha Mensal: {selectedCollaborator.displayName || selectedCollaborator.email}
              </h3>
              <p className="text-xxs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full uppercase border border-slate-100">
                {getJornadaDescription(selectedCollaborator)}
              </p>
            </div>
            
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
                        Buscando dados de apuração do colaborador...
                      </td>
                    </tr>
                  ) : diasDoMes.map(dia => {
                    const diaStr = String(dia).padStart(2, '0');
                    const pDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${diaStr}`;
                    const reg = registrosMap.get(pDate);
                    const wName = getWeekDayName(pDate);
                    const isWeekend = wName === "Sáb" || wName === "Dom";

                    if (!reg) {
                      return (
                        <tr key={dia} className={`hover:bg-slate-50/50 ${isWeekend ? "bg-slate-50/30" : ""}`}>
                          <td className="py-3 px-4 font-semibold text-slate-400 font-mono">
                            {diaStr}/{String(selectedMonth).padStart(2, '0')} <span className="text-xxs font-normal">({wName})</span>
                          </td>
                          <td colSpan={5} className="py-3 px-3 text-slate-400 italic">
                            Sem registro
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">
                              Ausente
                            </span>
                          </td>
                          <td className="py-3 px-4"></td>
                        </tr>
                      );
                    }

                    const calc = calcularHoras(reg, selectedCollaborator || 480, pDate);
                    const hasCalc = calc.trabalhadas > 0 || reg.horasTrabalhadas !== undefined;
                    const workedMin = calc.trabalhadas || reg.horasTrabalhadas || 0;
                    const extraMin = calc.extras !== undefined ? calc.extras : (reg.horasExtras !== undefined ? reg.horasExtras : 0);

                    const trabalhadoStr = hasCalc 
                      ? formatMinutesToHHMM(workedMin) 
                      : "--:--";
                    const saldoStr = hasCalc 
                      ? (extraMin >= 0 ? "+" : "") + formatMinutesToHHMM(extraMin) 
                      : "--:--";

                    return (
                      <tr key={dia} className={`hover:bg-slate-55/50 ${isWeekend ? "bg-slate-50/30" : ""}`}>
                        <td className="py-3 px-4 font-semibold text-slate-700 font-mono">
                          {diaStr}/{String(selectedMonth).padStart(2, '0')} <span className="text-slate-400 text-xxs font-normal">({wName})</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-705">{reg.entrada || "--:--"}</td>
                        <td className="py-3 px-3 font-semibold text-slate-705">{reg.saidaAlmoco || "--:--"}</td>
                        <td className="py-3 px-3 font-semibold text-slate-705">{reg.retornoAlmoco || "--:--"}</td>
                        <td className="py-3 px-3 font-semibold text-slate-705">{reg.saida || "--:--"}</td>
                        <td className="py-3 px-3 font-bold text-slate-700">{trabalhadoStr}</td>
                        <td className={`py-3 px-3 font-bold ${reg.horasExtras && reg.horasExtras < 0 ? "text-amber-600" : "text-emerald-700"}`}>
                          {saldoStr}
                        </td>
                        <td className="py-3 px-4">
                          {reg.status === "completo" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              Completo
                            </span>
                          )}
                          {reg.status === "incompleto" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                              Incompleto
                            </span>
                          )}
                          {reg.status === "ajuste_pendente" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 animate-pulse">
                              Correção Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showPrintModal && selectedCollaborator && (
        <FolhaPontoPrint
          collaborator={selectedCollaborator}
          companySettings={companySettings}
          year={selectedYear}
          month={selectedMonth}
          registros={registros}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
};
