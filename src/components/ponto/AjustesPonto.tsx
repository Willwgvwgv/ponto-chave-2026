import React, { useState, useMemo } from "react";
import { 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Clock, 
  User,
  History,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useAjustesPendentes, useResponderAjuste, useTeam } from "../../hooks/useQueries";
import { UserProfile, SolicitacaoAjustePonto } from "../../types";

interface AjustesPontoProps {
  profile: UserProfile | null;
}

export const AjustesPonto: React.FC<AjustesPontoProps> = ({ profile }) => {
  const agencyId = profile?.companyId || "default_agency";
  const currentAdminName = profile?.displayName || profile?.email || "Administrador";

  const { data: ajustes = [], isLoading } = useAjustesPendentes(agencyId);
  const { data: team = [] } = useTeam(agencyId);
  const responderAjusteMutation = useResponderAjuste();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Separate pending and completed adjustments
  const pendentes = useMemo(() => {
    return ajustes.filter(a => a.status === "pendente");
  }, [ajustes]);

  const respondidos = useMemo(() => {
    return ajustes.filter(a => a.status === "aprovado" || a.status === "rejeitado");
  }, [ajustes]);

  // Find user's defined daily journey (or fallback to 480)
  const getUserJourney = (userId: string) => {
    const user = team.find(u => u.uid === userId);
    return user?.jornadaDiariaMinutos || 480;
  };

  const handleResolve = (ajuste: SolicitacaoAjustePonto, action: "aprovado" | "rejeitado") => {
    const userJornada = getUserJourney(ajuste.userId);
    responderAjusteMutation.mutate({
      ajusteId: ajuste.id,
      registroId: ajuste.registroId,
      userId: ajuste.userId,
      agencyId,
      campo: ajuste.campo,
      valorSolicitado: ajuste.valorSolicitado,
      status: action,
      respondidoPor: currentAdminName,
      jornadaDiariaMinutos: userJornada
    });
  };

  const campoLabels = {
    entrada: "Entrada",
    saidaAlmoco: "Saída Almoço",
    retornoAlmoco: "Retorno Almoço",
    saida: "Saída"
  };

  const formatDateShort = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Lista de Pendentes */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Clock className="w-5 h-5 text-sky-600 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-800">Correções Pendentes de Aprovação</h3>
          <span className="ml-1.5 inline-flex items-center justify-center bg-sky-100 text-sky-800 text-xxs font-bold px-2 py-0.5 rounded-full">
            {pendentes.length} pendentes
          </span>
        </div>

        {pendentes.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center text-slate-400 text-xs">
            Show! Nenhuma solicitação de ajuste pendente de aprovação.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendentes.map((ajuste) => (
              <div 
                key={ajuste.id} 
                className="bg-white rounded-xl border border-sky-00 border-l-4 border-l-sky-500 shadow-sm p-4 space-y-4 hover:shadow transition"
              >
                {/* Header do card */}
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {ajuste.userName}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Dia {formatDateShort(ajuste.data)} • Solicitado em {new Date(ajuste.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-xxs uppercase font-bold bg-sky-50 text-sky-700 rounded-md">
                    {campoLabels[ajuste.campo]}
                  </span>
                </div>

                {/* Comparação de Valores */}
                <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-center border border-slate-100">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Valor Anterior</span>
                    <span className="text-xs font-bold text-slate-500 font-mono italic">{ajuste.valorAtual || "--:--"}</span>
                  </div>
                  <div className="border-l border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Novo Solicitado</span>
                    <span className="text-xs font-black text-rose-600 font-mono">{ajuste.valorSolicitado}</span>
                  </div>
                </div>

                {/* Justificativa */}
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">Motivo:</span>
                  <p className="italic text-slate-500">"{ajuste.motivo}"</p>
                </div>

                {/* Ações */}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    id={`btn-reject-${ajuste.id}`}
                    onClick={() => handleResolve(ajuste, "rejeitado")}
                    disabled={responderAjusteMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-650 font-bold text-xs rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    Rejeitar
                  </button>
                  <button
                    id={`btn-approve-${ajuste.id}`}
                    onClick={() => handleResolve(ajuste, "aprovado")}
                    disabled={responderAjusteMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aprovar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico Resolvido */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
        <button
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          className="w-full px-5 py-4 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between text-left transition"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Histórico de Ajustes Respondidos ({respondidos.length})
            </h4>
          </div>
          {isHistoryOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isHistoryOpen && (
          <div className="p-4 divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {respondidos.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Nenhum ajuste respondido anteriormente.</p>
            ) : (
              respondidos.map((ajuste) => {
                const isApproved = ajuste.status === "aprovado";
                return (
                  <div key={ajuste.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{ajuste.userName}</span>
                        <span className="text-slate-400 text-xxs">• Dia {formatDateShort(ajuste.data)}</span>
                      </div>
                      <p className="text-xxs text-slate-550 italic">
                        Campo: <span className="font-semibold text-slate-650">{campoLabels[ajuste.campo]}</span> • Solicitou {ajuste.valorSolicitado} (Atual: {ajuste.valorAtual || "--:--"})
                      </p>
                      {ajuste.respondidoPor && (
                        <p className="text-[10px] text-slate-400">
                          Respondido por: <span className="font-semibold">{ajuste.respondidoPor}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xxs font-bold bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xxs font-bold bg-red-50 text-red-700">
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          Rejeitado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
};
