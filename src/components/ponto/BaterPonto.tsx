import React, { useState, useEffect } from "react";
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle 
} from "lucide-react";
import { usePontoHoje, useRegistrarPonto, useSolicitarAjuste } from "../../hooks/useQueries";
import { UserProfile, PontoRegistro } from "../../types";
import { toast } from "sonner";

interface BaterPontoProps {
  profile: UserProfile | null;
}

export const BaterPonto: React.FC<BaterPontoProps> = ({ profile }) => {
  const userId = profile?.uid || "";
  const userName = profile?.displayName || "Colaborador";
  const agencyId = profile?.companyId || "default_agency";
  const jornada = profile?.jornadaDiariaMinutos || 480;

  // Real-time clock state
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: pontoHoje, isLoading } = usePontoHoje(userId);
  const registrarPontoMutation = useRegistrarPonto();
  const solicitarAjusteMutation = useSolicitarAjuste();

  // Modal for adjustment
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campoAjuste, setCampoAjuste] = useState<"entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida">("entrada");
  const [valorSolicitado, setValorSolicitado] = useState("");
  const [motivo, setMotivo] = useState("");

  const formatTime = (date: Date) => {
    return date.toTimeString().split(" ")[0]; // HH:mm:ss
  };

  const formatDateLong = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('pt-BR', options);
  };

  // Determine current active button (sequence: Entrada -> Saída Almoço -> Retorno Almoço -> Saída)
  let nextPunch: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida" | "none" = "entrada";

  if (pontoHoje) {
    if (!pontoHoje.entrada) {
      nextPunch = "entrada";
    } else if (!pontoHoje.saidaAlmoco) {
      nextPunch = "saidaAlmoco";
    } else if (!pontoHoje.retornoAlmoco) {
      nextPunch = "retornoAlmoco";
    } else if (!pontoHoje.saida) {
      nextPunch = "saida";
    } else {
      nextPunch = "none";
    }
  }

  const handlePunch = (campo: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida") => {
    const hhmm = time.toTimeString().split(" ")[0].slice(0, 5); // "HH:mm"
    const campoLabels = {
      entrada: "Entrada",
      saidaAlmoco: "Saída Almoço",
      retornoAlmoco: "Retorno Almoço",
      saida: "Saída"
    };
    
    registrarPontoMutation.mutate({
      userId,
      userName,
      agencyId,
      campo,
      horario: hhmm,
      jornadaDiariaMinutos: jornada
    }, {
      onSuccess: () => {
        toast.success(`Ponto registrado: ${campoLabels[campo]} às ${hhmm}`);
      },
      onError: (err: any) => {
        toast.error(`Erro ao registrar ponto: ${err?.message || err}`);
      }
    });
  };

  // Verification of invalid order of punch times
  const checkTimeInconsistency = (): boolean => {
    if (!pontoHoje) return false;
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const ent = pontoHoje.entrada ? toMin(pontoHoje.entrada) : null;
    const salm = pontoHoje.saidaAlmoco ? toMin(pontoHoje.saidaAlmoco) : null;
    const ralm = pontoHoje.retornoAlmoco ? toMin(pontoHoje.retornoAlmoco) : null;
    const sai = pontoHoje.saida ? toMin(pontoHoje.saida) : null;

    if (ent !== null && salm !== null && salm <= ent) return true;
    if (salm !== null && ralm !== null && ralm <= salm) return true;
    if (ralm !== null && sai !== null && sai <= ralm) return true;
    if (ent !== null && sai !== null && sai <= ent) return true;

    return false;
  };

  const hasInconsistency = checkTimeInconsistency();

  const handleOpenAjusteModal = (campo: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida") => {
    setCampoAjuste(campo);
    setValorSolicitado(pontoHoje?.[campo] || "");
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
      toast.error("Por favor, descreva o motivo da correção.");
      return;
    }

    const regId = `${userId}_${new Date().toLocaleDateString('en-CA')}`;

    solicitarAjusteMutation.mutate({
      registroId: regId,
      userId,
      userName,
      agencyId,
      data: new Date().toLocaleDateString('en-CA'),
      campo: campoAjuste,
      valorAtual: pontoHoje?.[campoAjuste] || "",
      valorSolicitado,
      motivo
    }, {
      onSuccess: () => {
        setIsModalOpen(false);
      }
    });
  };

  const buttonsConf = [
    { key: "entrada", label: "ENTRADA", color: "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-100 disabled:text-emerald-400 border border-emerald-600 text-white" },
    { key: "saidaAlmoco", label: "SAÍDA ALMOÇO", color: "bg-sky-600 hover:bg-sky-700 disabled:bg-sky-100 disabled:text-sky-400 border border-sky-600 text-white" },
    { key: "retornoAlmoco", label: "RETORNO ALMOÇO", color: "bg-sky-600 hover:bg-sky-700 disabled:bg-sky-100 disabled:text-sky-400 border border-sky-600 text-white" },
    { key: "saida", label: "SAÍDA", color: "bg-rose-600 hover:bg-rose-700 disabled:bg-rose-100 disabled:text-rose-400 border border-rose-600 text-white" },
  ] as const;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 font-sans py-4 p-4">
      {/* Relógio Digital */}
      <div className="text-center rounded-2xl bg-white shadow-sm border border-slate-100 p-8 flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full mb-3 uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          Fuso Horário Local
        </div>
        <h2 className="text-5xl font-mono font-bold text-slate-800 tracking-tight">
          {formatTime(time)}
        </h2>
        <p className="text-slate-500 font-medium text-sm mt-2 capitalize">
          {formatDateLong(time)}
        </p>
      </div>

      {/* Painel do Bater Ponto */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-800">Registrar Ponto Eletrônico</h3>
          <p className="text-xs text-slate-500 mt-0.5">Selecione o início ou fim da sua jornada no dia de hoje.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {buttonsConf.map((btn) => {
            const isPunchActive = nextPunch === btn.key;
            const valorReg = pontoHoje?.[btn.key as keyof PontoRegistro] as string | undefined;
            const isRegistered = !!valorReg;

            if (isRegistered) {
              return (
                <div
                  key={btn.key}
                  className="py-4 px-4 text-center rounded-xl font-bold flex flex-col items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-700 shadow-sm"
                >
                  <span className="text-emerald-600 text-sm mb-1">✅</span>
                  <span className="text-[10px] tracking-wider uppercase text-emerald-800 font-bold">{btn.label}</span>
                  <span className="text-xs font-mono font-bold text-emerald-600 mt-1">{valorReg}</span>
                </div>
              );
            }

            return (
              <button
                key={btn.key}
                id={`btn-punch-${btn.key}`}
                disabled={!isPunchActive || registrarPontoMutation.isPending}
                onClick={() => handlePunch(btn.key)}
                className={`py-4 px-4 text-center rounded-xl font-bold flex flex-col items-center justify-center transition-all duration-200 ${
                  isPunchActive
                    ? btn.color + " shadow-md hover:scale-[1.02]"
                    : "bg-slate-50 border border-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Clock className="w-5 h-5 mb-1.5" />
                <span className="text-xs tracking-wider uppercase">{btn.label}</span>
              </button>
            );
          })}
        </div>

        {/* Resumo do dia */}
        <div className="border-t border-slate-100 pt-6 space-y-3.5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Registros Efetuados Hoje</span>
            <span className="text-[10px] font-normal text-slate-400 font-sans normal-case">Legenda: ✅ Registrado / ⏳ Pendente</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Entrada", key: "entrada" },
              { label: "S. Almoço", key: "saidaAlmoco" },
              { label: "R. Almoço", key: "retornoAlmoco" },
              { label: "Saída", key: "saida" },
            ].map((reg) => {
              const valor = pontoHoje?.[reg.key as keyof PontoRegistro] as string | undefined;
              return (
                <div key={reg.key} className="bg-slate-50 border border-slate-100 rounded-lg p-3 relative flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{reg.label}</span>
                  <span className="text-sm font-semibold text-slate-700 mt-1 font-mono">{valor || "--:--"}</span>
                  
                  {/* Indicator icons */}
                  {valor ? (
                    <div className="absolute top-1 right-1 text-emerald-600 select-none text-[10px]" title="Preenchido">
                      ✅
                    </div>
                  ) : (
                    <div className="absolute top-1 right-1 text-slate-300 select-none text-[10px]" title="Pendente">
                      ⏳
                    </div>
                  )}

                  {!valor && (
                    <button
                      id={`btn-solicitar-ajuste-${reg.key}`}
                      onClick={() => handleOpenAjusteModal(reg.key as any)}
                      className="text-[10px] text-sky-600 hover:underline mt-1 font-semibold"
                    >
                      Ajustar
                    </button>
                  )}
                  {valor && (
                    <button 
                      onClick={() => handleOpenAjusteModal(reg.key as any)}
                      className="text-[9px] text-slate-400 hover:text-sky-600 mt-1 underline"
                    >
                      Pedir Correção
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inconsistências */}
        {hasInconsistency && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-805">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-amber-900">Horários inconsistentes detectados!</p>
                <p className="text-amber-700 leading-relaxed">
                  A ordem cronológica dos seus pontos indica conflito (ex: saída antes da entrada).
                </p>
              </div>
            </div>
            <button
              onClick={() => handleOpenAjusteModal("entrada")}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"
            >
              Solicitar Ajuste
            </button>
          </div>
        )}
      </div>

      {/* Modal de Solicitação de Ajuste */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-600" />
              <h3 className="text-base font-bold text-slate-800">Solicitar Ajuste de Horário</h3>
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
                  Hora Correta (HH:mm)
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
                  Motivo da Solicitação
                </label>
                <textarea
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Esqueci de registrar / erro ao bater"
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
                  {solicitarAjusteMutation.isPending ? "Gravando..." : "Enviar Solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
