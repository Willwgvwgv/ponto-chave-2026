import React, { useState, useMemo } from "react";
import {
  Zap,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  CalendarX,
  Edit,
  Trash2,
  SlidersHorizontal
} from "lucide-react";
import { EnergiaLocacao, StatusEnergiaLocacao } from "../../types";
import {
  useEnergiaLocacoes,
  useCreateEnergiaMutation,
  useUpdateEnergiaMutation,
  useDeleteEnergiaMutation
} from "../../hooks/useQueries";
import { formatPersonName } from "../../lib/utils";
import { toast } from "sonner";
import { EnergiaFormModal } from "./EnergiaFormModal";
import { ConfirmModal } from "../ui/ConfirmModal";

interface EnergiaViewProps {
  isAdmin: boolean;
  user: any;
  profile: any;
  companySettings: any;
}

// Quantos dias faltam para o vencimento (negativo = já venceu). Mesmo cálculo
// usado em DespejoView.getDaysRemaining, para manter o padrão já existente
// no sistema de "prazo que não pode passar".
const getDiasRestantes = (dataVencimento: string): number => {
  if (!dataVencimento) return NaN;
  const limite = new Date(dataVencimento + "T23:59:59");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = limite.getTime() - hoje.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

// Texto automático de prazo pedido pelo usuário: "Vence em X dias" / "Vence
// hoje" / "Vence amanhã" / "Vencida há X dias".
const formatPrazoLabel = (dataVencimento: string): string => {
  if (!dataVencimento) return "Sem data";
  const dias = getDiasRestantes(dataVencimento);
  if (dias < 0) return `Vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
};

const formatDateBR = (val?: string) => {
  if (!val) return "-";
  const [ano, mes, dia] = val.split("-");
  if (!ano || !mes || !dia) return val;
  return `${dia}/${mes}/${ano}`;
};

// Status "efetivo" para exibição/filtro: TRANSFERIDA sempre prevalece sobre o
// cálculo de data (regra explícita pedida — uma energia já transferida nunca
// aparece como vencida, mesmo que a data cadastrada já tenha passado).
type StatusEfetivo = "transferida" | "vencida" | "sem_data" | "em_dia";

const getStatusEfetivo = (e: EnergiaLocacao): StatusEfetivo => {
  if (e.status === "transferida") return "transferida";
  if (!e.dataVencimento) return "sem_data";
  const dias = getDiasRestantes(e.dataVencimento);
  if (dias < 0) return "vencida";
  return "em_dia";
};

type FiltroEnergia = "TODAS" | "VENCIDAS" | "HOJE" | "7_DIAS" | "30_DIAS" | "TRANSFERIDAS" | "SEM_DATA";

export const EnergiaView: React.FC<EnergiaViewProps> = ({ isAdmin, profile, companySettings }) => {
  const companyId = profile?.companyId || companySettings?.id || "default_agency";

  const { data: energias = [], isLoading } = useEnergiaLocacoes(companyId);
  const createMutation = useCreateEnergiaMutation();
  const updateMutation = useUpdateEnergiaMutation();
  const deleteMutation = useDeleteEnergiaMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [filtro, setFiltro] = useState<FiltroEnergia>("TODAS");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnergia, setEditingEnergia] = useState<EnergiaLocacao | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Indicadores do topo — pedidos explicitamente: Vencidas / até 7 dias / até
  // 30 dias / Transferidas. "Até 7 dias" e "até 30 dias" contam só quem ainda
  // não venceu e não foi transferido (senão uma locação vencida apareceria
  // duplicada nos dois cards).
  const indicadores = useMemo(() => {
    let vencidas = 0;
    let ate7 = 0;
    let ate30 = 0;
    let transferidas = 0;

    energias.forEach(e => {
      const statusEfetivo = getStatusEfetivo(e);
      if (statusEfetivo === "transferida") {
        transferidas++;
        return;
      }
      if (statusEfetivo === "vencida") {
        vencidas++;
        return;
      }
      if (statusEfetivo === "em_dia") {
        const dias = getDiasRestantes(e.dataVencimento!);
        if (dias <= 7) ate7++;
        if (dias <= 30) ate30++;
      }
    });

    return { vencidas, ate7, ate30, transferidas };
  }, [energias]);

  const filteredEnergias = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();

    return energias.filter(e => {
      const matchBusca =
        !termo ||
        (e.imovel || "").toLowerCase().includes(termo) ||
        (e.inquilino || "").toLowerCase().includes(termo) ||
        (e.unidadeConsumidora || "").toLowerCase().includes(termo);

      if (!matchBusca) return false;

      const statusEfetivo = getStatusEfetivo(e);
      const dias = e.dataVencimento ? getDiasRestantes(e.dataVencimento) : NaN;

      switch (filtro) {
        case "TODAS":
          return true;
        case "VENCIDAS":
          return statusEfetivo === "vencida";
        case "HOJE":
          return statusEfetivo === "em_dia" && dias === 0;
        case "7_DIAS":
          return statusEfetivo === "em_dia" && dias <= 7;
        case "30_DIAS":
          return statusEfetivo === "em_dia" && dias <= 30;
        case "TRANSFERIDAS":
          return statusEfetivo === "transferida";
        case "SEM_DATA":
          return statusEfetivo === "sem_data";
        default:
          return true;
      }
    });
  }, [energias, searchTerm, filtro]);

  const handleOpenNew = () => {
    setEditingEnergia(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (e: EnergiaLocacao) => {
    setEditingEnergia(e);
    setIsFormOpen(true);
  };

  const handleSave = (data: Omit<EnergiaLocacao, "id" | "createdAt" | "updatedAt" | "companyId" | "criadoPor" | "criadoPorNome">) => {
    if (editingEnergia) {
      updateMutation.mutate({ ...editingEnergia, ...data });
    } else {
      if (!profile?.uid) {
        toast.error("Aguarde o carregamento do seu perfil antes de salvar.");
        return;
      }
      createMutation.mutate({
        ...data,
        companyId,
        criadoPor: profile.uid,
        criadoPorNome: profile.displayName || "Usuário"
      });
    }
    setIsFormOpen(false);
    setEditingEnergia(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    deleteMutation.mutate({ id: deleteTargetId, companyId });
    setDeleteTargetId(null);
  };

  const deleteTarget = deleteTargetId ? energias.find(e => e.id === deleteTargetId) : null;

  const statusBadge = (e: EnergiaLocacao) => {
    const statusEfetivo = getStatusEfetivo(e);
    if (statusEfetivo === "transferida") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Transferida
        </span>
      );
    }
    if (statusEfetivo === "vencida") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3" /> Vencida
        </span>
      );
    }
    if (statusEfetivo === "sem_data") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
          <CalendarX className="w-3 h-3" /> Sem data
        </span>
      );
    }
    const dias = getDiasRestantes(e.dataVencimento!);
    const urgente = dias <= 7;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${urgente ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
        <Clock className="w-3 h-3" /> Em dia
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none pt-1">
        <div className="flex items-center gap-3">
          <div className="w-3 h-8 bg-amber-500 rounded-full" />
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            Acompanhamento de Energia
          </h1>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold tracking-wide shadow-md shadow-amber-500/20 cursor-pointer transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          NOVA ENERGIA
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setFiltro(filtro === "VENCIDAS" ? "TODAS" : "VENCIDAS")}
          className={`text-left bg-white border rounded-2xl p-5 shadow-xs transition-all cursor-pointer ${filtro === "VENCIDAS" ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-200/80 hover:border-rose-200"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Vencidas</span>
            <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-3">{indicadores.vencidas}</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro(filtro === "7_DIAS" ? "TODAS" : "7_DIAS")}
          className={`text-left bg-white border rounded-2xl p-5 shadow-xs transition-all cursor-pointer ${filtro === "7_DIAS" ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200/80 hover:border-amber-200"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Vence em até 7 dias</span>
            <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-3">{indicadores.ate7}</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro(filtro === "30_DIAS" ? "TODAS" : "30_DIAS")}
          className={`text-left bg-white border rounded-2xl p-5 shadow-xs transition-all cursor-pointer ${filtro === "30_DIAS" ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200/80 hover:border-blue-200"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Vence em até 30 dias</span>
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-3">{indicadores.ate30}</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro(filtro === "TRANSFERIDAS" ? "TODAS" : "TRANSFERIDAS")}
          className={`text-left bg-white border rounded-2xl p-5 shadow-xs transition-all cursor-pointer ${filtro === "TRANSFERIDAS" ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200/80 hover:border-emerald-200"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Transferidas</span>
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-3">{indicadores.transferidas}</p>
        </button>
      </div>

      {/* Filtros + busca */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 md:p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por imóvel, inquilino ou unidade consumidora..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider mr-1">
            <SlidersHorizontal className="w-3 h-3 inline -mt-0.5 mr-1" />
            FILTRAR:
          </span>
          {([
            ["TODAS", "Todas"],
            ["VENCIDAS", "Vencidas"],
            ["HOJE", "Vence hoje"],
            ["7_DIAS", "Próximos 7 dias"],
            ["30_DIAS", "Próximos 30 dias"],
            ["TRANSFERIDAS", "Transferidas"],
            ["SEM_DATA", "Sem data"]
          ] as [FiltroEnergia, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFiltro(value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all ${
                filtro === value
                  ? "bg-amber-100 text-amber-800 border border-amber-200 shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 pl-6 pr-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Imóvel</th>
                <th className="py-3.5 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Locatário</th>
                <th className="py-3.5 px-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Unidade Consumidora</th>
                <th className="py-3.5 px-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Vencimento</th>
                <th className="py-3.5 px-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="py-3.5 pr-6 pl-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap w-[100px] sticky right-0 z-10 bg-slate-50 border-l border-slate-100">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">Carregando...</td>
                </tr>
              ) : filteredEnergias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400 italic">
                    Nenhum acompanhamento de energia encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEnergias.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-4 pl-6 pr-4">
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[240px]">{e.imovel}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-xs font-medium text-slate-700 truncate max-w-[200px]">
                        {e.inquilino ? formatPersonName(e.inquilino) : "Não informado"}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-xs font-mono text-slate-600">{e.unidadeConsumidora || "-"}</p>
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <p className="text-xs font-bold text-slate-700">{formatDateBR(e.dataVencimento)}</p>
                      {e.status !== "transferida" && e.dataVencimento && (
                        <p className={`text-[10px] font-bold mt-0.5 ${getDiasRestantes(e.dataVencimento) < 0 ? "text-rose-600" : getDiasRestantes(e.dataVencimento) <= 7 ? "text-amber-600" : "text-slate-400"}`}>
                          {formatPrazoLabel(e.dataVencimento)}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {statusBadge(e)}
                    </td>
                    <td className="py-4 pr-6 pl-4 text-right whitespace-nowrap sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-l border-slate-100">
                      <div className="flex items-center justify-end gap-0.5">
                        {/* Editar e excluir exigem admin da empresa — mesma regra aplicada
                            em firestore.rules (allow update, delete: ... isCompanyAdmin(...)).
                            Mostrar o botão para quem não é admin resultaria em erro de
                            permissão do Firestore ao tentar salvar/excluir. */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(e)}
                            title="Editar"
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(e.id)}
                            title="Excluir"
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {!isAdmin && (
                          <span className="text-[11px] text-slate-300 italic px-2">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <EnergiaFormModal
          initial={editingEnergia}
          onSave={handleSave}
          onClose={() => { setIsFormOpen(false); setEditingEnergia(null); }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Excluir acompanhamento de energia?"
        message={`Deseja realmente excluir o acompanhamento de energia de "${deleteTarget?.imovel || "este imóvel"}"? Esta ação não pode ser desfeita.`}
        confirmColor="red"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
