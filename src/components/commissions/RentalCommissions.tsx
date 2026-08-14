import React, { useState, useMemo } from "react";
import { 
  DollarSign, 
  Building, 
  User, 
  Calendar, 
  ChevronRight, 
  ArrowLeft, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Check, 
  Briefcase,
  ChevronDown,
  Pencil,
  ArrowRightLeft,
  Wallet,
  Shield,
  FileText,
  Banknote,
  Clock,
  Home,
  Building2,
  Users,
  Landmark,
  SlidersHorizontal
} from "lucide-react";
import { Comissao, RateioComissao, PagamentoCorretor, ComissoneUser, UserProfile } from "../../types";
import { ConfirmModal } from "../ui/ConfirmModal";
import { toast } from "sonner";
import { 
  toViewModel, 
  fromViewModel, 
  RentalFinancialViewModel, 
  parseCompetence,
  DistribuicaoItem,
  RepasseItem
} from "../../lib/legacyCommissionAdapter";
import { RentalStatusBadge, FinancialStatus } from "../rentals-finance/RentalStatusBadge";
import { CompetenceCard } from "../rentals-finance/CompetenceCard";
import { DistributionCard } from "../rentals-finance/DistributionCard";
import { RepasseTimeline } from "../rentals-finance/RepasseTimeline";
import { formatPersonName } from "../../lib/utils";

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

export const formatMesReferencia = (mes: string): string => {
  if (!mes || !mes.includes('-')) return mes;
  const [ano, month] = mes.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${meses[parseInt(month) - 1]} / ${ano}`;
};

export const formatMesReferenciaCurto = (mes: string): string => {
  if (!mes || !mes.includes('-')) return mes;
  const [ano, month] = mes.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(month) - 1]}/${ano}`;
};

interface RentalCommissionsProps {
  rentals: Comissao[];
  team: ComissoneUser[];
  userProfile: UserProfile;
  initialData?: {
    imovel?: string;
    inquilino?: string;
    aluguelMensal?: number;
    processId?: string;
  } | null;
  onClearInitialData?: () => void;
  onCreateRental: (rental: Omit<Comissao, "id"> & { id?: string; processId?: string }) => void;
  onUpdateRental: (rental: Comissao) => void;
  onDeleteRental: (id: string) => void;
}

export const RentalCommissions: React.FC<RentalCommissionsProps> = ({
  rentals,
  team,
  userProfile,
  initialData,
  onClearInitialData,
  onCreateRental,
  onUpdateRental,
  onDeleteRental
}) => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "list" | "create">(() => {
    return initialData?.imovel ? "create" : "dashboard";
  });
  
  // State variables for selected or legacy documents mapped through ViewModel
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("TUDO");
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("TODOS");
  const [activeCardFilter, setActiveCardFilter] = useState<"CARD1" | "CARD2" | "CARD3" | "CARD4" | null>(null);

  // Recebimento Manual Form state
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [receiptBank, setReceiptBank] = useState("");
  const [showReceiptFields, setShowReceiptFields] = useState(false);

  // Mapped rentals to ViewModels
  const convertedModels = useMemo(() => {
    return rentals.map(toViewModel);
  }, [rentals]);

  const uniqueMonths = useMemo(() => {
    const list = convertedModels
      .map(r => `${r.competencia.ano}-${String(r.competencia.mes).padStart(2, "0")}`)
      .filter((v, i, self) => v && self.indexOf(v) === i);
    return list.sort((a, b) => b.localeCompare(a));
  }, [convertedModels]);

  const monthlyModels = useMemo(() => {
    if (selectedMonthFilter === "TODOS") return convertedModels;
    return convertedModels.filter(r => {
      const cmpStr = `${r.competencia.ano}-${String(r.competencia.mes).padStart(2, "0")}`;
      return cmpStr === selectedMonthFilter;
    });
  }, [convertedModels, selectedMonthFilter]);

  const selectedRental = useMemo(() => {
    if (!selectedRentalId) return null;
    return convertedModels.find(r => r.id === selectedRentalId) || null;
  }, [convertedModels, selectedRentalId]);

  const editingRental = useMemo(() => {
    if (!editingRentalId) return null;
    return convertedModels.find(r => r.id === editingRentalId) || null;
  }, [convertedModels, editingRentalId]);

  // FORM STATES
  const [imovel, setImovel] = useState("");
  const [inquilino, setInquilino] = useState("");
  const [aluguelMensal, setAluguelMensal] = useState(0);
  const [primeiroAluguel, setPrimeiroAluguel] = useState(0);
  const [porcentagemFidelite, setPorcentagemFidelite] = useState(40);
  const [porcentagemLocador, setPorcentagemLocador] = useState(20);
  const [vencimento, setVencimento] = useState("");
  const [mesReferencia, setMesReferencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioComissao[]>([]);

  // Add broker to rateio form
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [selectedCaptadorId, setSelectedCaptadorId] = useState("");

  const porcentagemRepasse = useMemo(() => 100 - porcentagemFidelite, [porcentagemFidelite]);

  // Modal de pagamento
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmColor?: "red" | "blue" | "green";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    confirmColor: "red",
    onConfirm: () => {}
  });

  const [payBrokerId, setPayBrokerId] = useState("");
  const [payBrokerName, setPayBrokerName] = useState("");
  const [payBrokerRole, setPayBrokerRole] = useState("");
  const [payBrokerTotalDue, setPayBrokerTotalDue] = useState(0);
  const [payBrokerAlreadyPaid, setPayBrokerAlreadyPaid] = useState(0);
  const [payValue, setPayValue] = useState(0);
  const [payType, setPayType] = useState<'pagamento' | 'adiantamento' | 'desconto_adiantamento'>('pagamento');
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);

  // RESET FORM
  const resetForm = () => {
    setImovel("");
    setInquilino("");
    setAluguelMensal(0);
    setPrimeiroAluguel(0);
    setPorcentagemFidelite(40);
    setPorcentagemLocador(20);
    setVencimento("");
    setObservacoes("");
    setRateios([]);
    setSelectedBrokerId("");
    setSelectedCaptadorId("");
    setEditingRentalId(null);
    if (onClearInitialData) onClearInitialData();
  };

  // Prepopulate initial data or editing mode
  React.useEffect(() => {
    if (initialData?.imovel) {
      setImovel(initialData.imovel || "");
      setInquilino(initialData.inquilino || "");
      setAluguelMensal(initialData.aluguelMensal || 0);
      setPrimeiroAluguel(initialData.aluguelMensal || 0);
      setActiveTab("create");
    }
  }, [initialData]);

  React.useEffect(() => {
    if (editingRental) {
      setImovel(editingRental.imovel || "");
      setInquilino(editingRental.inquilino || "");
      setAluguelMensal(editingRental.valorAluguel || 0);
      setPrimeiroAluguel(editingRental.legacyDoc.primeiroAluguel || editingRental.valorAluguel || 0);
      setPorcentagemFidelite(editingRental.legacyDoc.porcentagemFidelite ?? 40);

      const locadorItem = editingRental.legacyDoc.rateio?.find(r => r.papel === "locador" || r.papel === "locacao");
      setPorcentagemLocador(locadorItem ? locadorItem.porcentagem : 20);
      
      setVencimento(editingRental.legacyDoc.vencimento || "");
      setMesReferencia(editingRental.legacyDoc.mesReferencia || "");
      setObservacoes(editingRental.legacyDoc.observacoes || "");
      setRateios(editingRental.legacyDoc.rateio || []);
    }
  }, [editingRental]);

  // DERIVED VALUES FROM FORM
  const porcentagemCaptadores = useMemo(() => {
    return Math.max(0, 100 - porcentagemFidelite - porcentagemLocador);
  }, [porcentagemFidelite, porcentagemLocador]);

  const valorFidelite = useMemo(() => {
    return Number(((aluguelMensal * porcentagemFidelite) / 100).toFixed(2));
  }, [aluguelMensal, porcentagemFidelite]);

  const valorLocadorValue = useMemo(() => {
    return Number(((aluguelMensal * porcentagemLocador) / 100).toFixed(2));
  }, [aluguelMensal, porcentagemLocador]);

  const valorCaptadoresValue = useMemo(() => {
    return Number(((aluguelMensal * porcentagemCaptadores) / 100).toFixed(2));
  }, [aluguelMensal, porcentagemCaptadores]);

  const valorRepasseCorretores = useMemo(() => {
    return Number((aluguelMensal - valorFidelite).toFixed(2));
  }, [aluguelMensal, valorFidelite]);

  const sumCaptadoresPct = useMemo(() => {
    return Number(rateios.filter(r => r.papel === "captador").reduce((sum, r) => sum + (r.porcentagem || 0), 0).toFixed(2));
  }, [rateios]);

  const computedRateios = useMemo(() => {
    return rateios.map(r => {
      if (r.papel === "locacao" || r.papel === "locador") {
        return {
          ...r,
          papel: "locacao" as const,
          porcentagem: porcentagemLocador,
          valor: valorLocadorValue
        };
      } else if (r.papel === "captador") {
        const pct = r.porcentagem !== undefined ? r.porcentagem : 0;
        const val = Number(((aluguelMensal * pct) / 100).toFixed(2));
        return {
          ...r,
          porcentagem: pct,
          valor: val
        };
      }
      return r;
    });
  }, [rateios, porcentagemLocador, valorLocadorValue, aluguelMensal]);

  // Status detection for each rental contract
  const getRowStatus = (r: RentalFinancialViewModel): "concluido" | "em_aberto" | "atrasado" => {
    const isConcluido = r.statusFinanceiro === "concluida" || r.legacyDoc.status === "pago";
    if (isConcluido) return "concluido";

    const isAtrasado = (
      r.legacyDoc.status === "atraso" || 
      (!!r.legacyDoc.vencimento && new Date(r.legacyDoc.vencimento + 'T23:59:59') < new Date())
    );
    if (isAtrasado) return "atrasado";

    return "em_aberto";
  };

  const getDistribuidoPct = (r: RentalFinancialViewModel): number => {
    const totalDevidoCorretores = r.legacyDoc.valorRepasseCorretores || 0;
    if (totalDevidoCorretores <= 0) return 100;
    const totalPago = r.repasses?.reduce((acc, curr) => acc + (curr.tipo === "desconto" ? -curr.valor : curr.valor), 0) || 0;
    const pct = Math.min(100, Math.round((totalPago / totalDevidoCorretores) * 100));
    return Math.max(0, pct);
  };

  const getBrokersList = (r: RentalFinancialViewModel) => {
    const list: { key: string; letter: string; name: string; bg: string }[] = [];
    
    // Fidelité
    if ((r.legacyDoc.porcentagemFidelite ?? 40) > 0) {
      list.push({
        key: "fidelite",
        letter: "F",
        name: "Fidelité",
        bg: "bg-emerald-600"
      });
    }

    // Rateio items
    (r.distribuicao || []).forEach((d, idx) => {
      const isFid = d.corretorNome.toLowerCase().includes("fidelit");
      if (!isFid && d.corretorNome) {
        const colors = ["bg-blue-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
        list.push({
          key: `broker-${idx}`,
          letter: d.corretorNome.trim().charAt(0).toUpperCase(),
          name: formatPersonName(d.corretorNome),
          bg: colors[idx % colors.length]
        });
      }
    });

    return list;
  };

  const countAtraso = useMemo(() => {
    return monthlyModels.filter(r => getRowStatus(r) === "atrasado").length;
  }, [monthlyModels]);

  const getDistributionSummaryString = (r: RentalFinancialViewModel): string => {
    const parts: string[] = [];
    const pctFidelite = r.legacyDoc.porcentagemFidelite !== undefined ? r.legacyDoc.porcentagemFidelite : 40;
    if (pctFidelite > 0) {
      parts.push(`Fidelité ${pctFidelite}%`);
    }
    
    if (r.distribuicao && r.distribuicao.length > 0) {
      r.distribuicao.forEach((d) => {
        const isFidName = d.corretorNome.toLowerCase().includes("fidelité") || d.corretorNome.toLowerCase().includes("fidelite");
        if (isFidName) {
          return;
        }
        const pct = d.porcentagem || 0;
        if (pct > 0) {
          parts.push(`${formatPersonName(d.corretorNome)} ${pct}%`);
        }
      });
    }
    
    return parts.join(" · ");
  };

  // FILTERED MODELS BY MONTH REFERENCE
  const currentFiltered = monthlyModels;

  // KPI 1 — Total Processado (Volume Total em 1º Aluguel)
  const totalProcessado = useMemo(() => {
    return currentFiltered.reduce((acc, r) => acc + (r.legacyDoc.primeiroAluguel || r.valorAluguel || 0), 0);
  }, [currentFiltered]);

  // KPI 1 Sub — Caixa Fidelité
  const totalFideliteCaixa = useMemo(() => {
    return currentFiltered.reduce((acc, r) => acc + (r.legacyDoc.valorFidelite || 0), 0);
  }, [currentFiltered]);

  // CARD 1 VALUE — Comissões Primeiro Aluguel
  const card1Value = totalProcessado;

  // CARD 2 VALUE — Comissões Imobiliária
  const card2Value = useMemo(() => {
    return currentFiltered.reduce((acc, r) => {
      const primeiroAluguel = r.legacyDoc.primeiroAluguel || r.valorAluguel || 0;
      const pctFidelite = r.legacyDoc.porcentagemFidelite !== undefined ? r.legacyDoc.porcentagemFidelite : 40;
      return acc + ((primeiroAluguel * pctFidelite) / 100);
    }, 0);
  }, [currentFiltered]);

  // CARD 3 VALUE — Comissões Corretores
  const card3Value = useMemo(() => {
    return currentFiltered.reduce((acc, r) => {
      const primeiroAluguel = r.legacyDoc.primeiroAluguel || r.valorAluguel || 0;
      const brokerSum = (r.legacyDoc.rateio || []).reduce((sum, item) => {
        if (item.papel === "captador") {
          return sum + ((primeiroAluguel * item.porcentagem) / 100);
        }
        return sum;
      }, 0);
      return acc + brokerSum;
    }, 0);
  }, [currentFiltered]);

  // CARD 4 VALUES — Repasses
  const card4Data = useMemo(() => {
    let pagos = 0;
    let aPagar = 0;
    currentFiltered.forEach(r => {
      (r.distribuicao || []).forEach(d => {
        pagos += (d.totalPago || 0);
        aPagar += Math.max(0, (d.valor || 0) - (d.totalPago || 0));
      });
    });
    return { pagos, aPagar };
  }, [currentFiltered]);

  // Operações pagas count
  const countOperacoesPagas = useMemo(() => {
    return currentFiltered.filter(r => getRowStatus(r) === "concluido").length;
  }, [currentFiltered]);

  // Aguardando repasse count
  const countAguardandoRepasse = useMemo(() => {
    return currentFiltered.filter(r => getRowStatus(r) === "em_aberto").length;
  }, [currentFiltered]);

  // Total atrasados valor
  const totalAtrasadosValor = useMemo(() => {
    return currentFiltered
      .filter(r => getRowStatus(r) === "atrasado")
      .reduce((acc, r) => acc + (r.legacyDoc.primeiroAluguel || r.valorAluguel || 0), 0);
  }, [currentFiltered]);

  // Progresso percentual para os cards de repasse
  const totalDevidoRepasses = card4Data.pagos + card4Data.aPagar;
  const pctConcluido = totalDevidoRepasses > 0 ? Math.min(100, Math.round((card4Data.pagos / totalDevidoRepasses) * 100)) : 0;
  const pctEmAberto = totalDevidoRepasses > 0 ? Math.min(100, Math.round((card4Data.aPagar / totalDevidoRepasses) * 100)) : 0;

  // Toggle card active filter
  const handleCardClick = (cardId: "CARD1" | "CARD2" | "CARD3" | "CARD4") => {
    if (activeCardFilter === cardId) {
      setActiveCardFilter(null);
    } else {
      setActiveCardFilter(cardId);
    }
  };

  // FILTERED RENTALS FOR THE RESTURED LIST
  const filteredRentals = useMemo(() => {
    return monthlyModels.filter(r => {
      const searchLower = filterText.toLowerCase();
      const matchText = 
        (r.imovel || "").toLowerCase().includes(searchLower) || 
        (r.inquilino || "").toLowerCase().includes(searchLower) ||
        `loc-${r.id}`.toLowerCase().includes(searchLower) ||
        (r.distribuicao || []).some(rt => (rt.corretorNome || "").toLowerCase().includes(searchLower));

      if (!matchText) return false;

      const st = getRowStatus(r);
      if (filterStatus === "TODOS" || filterStatus === "TUDO") return true;
      if (filterStatus === "CONCLUIDO" || filterStatus === "PAGO") return st === "concluido";
      if (filterStatus === "EM_ABERTO" || filterStatus === "PENDENTE") return st === "em_aberto";
      if (filterStatus === "ATRASADO" || filterStatus === "ATRASO") return st === "atrasado";
      return true;
    });
  }, [monthlyModels, filterText, filterStatus]);

  // ACTIONS
  const setLocadorBroker = (brokerId: string) => {
    const brokerObj = team.find(t => t.id === brokerId);
    if (!brokerObj) {
      setRateios(rateios.filter(r => r.papel !== "locacao"));
      return;
    }

    const cleanRateios = rateios.filter(r => r.papel !== "locacao");
    const newLocador: RateioComissao = {
      corretorId: brokerId,
      corretorNome: brokerObj.name,
      papel: "locacao",
      porcentagem: porcentagemLocador,
      valor: valorLocadorValue
    };
    setRateios([...cleanRateios, newLocador]);
  };

  const handleAddCaptador = (brokerId: string) => {
    if (!brokerId) {
      toast.error("Selecione um corretor para incluir como captador.");
      return;
    }
    const brokerObj = team.find(t => t.id === brokerId);
    if (!brokerObj) return;

    if (rateios.some(rt => rt.corretorId === brokerId)) {
      toast.error("Este corretor já está adicionado no rateio.");
      return;
    }

    const currentCaptadores = rateios.filter(r => r.papel === "captador");
    const newCount = currentCaptadores.length + 1;
    const equalPct = Number((porcentagemCaptadores / newCount).toFixed(2));

    const updatedRateios = rateios.map(rt => {
      if (rt.papel === "captador") {
        return {
          ...rt,
          porcentagem: equalPct,
          valor: Number(((aluguelMensal * equalPct) / 100).toFixed(2))
        };
      }
      return rt;
    });

    const newRateio: RateioComissao = {
      corretorId: brokerId,
      corretorNome: brokerObj.name,
      papel: "captador",
      porcentagem: equalPct,
      valor: Number(((aluguelMensal * equalPct) / 100).toFixed(2))
    };

    setRateios([...updatedRateios, newRateio]);
    setSelectedCaptadorId("");
  };

  const handleRemoveBrokerFromRateio = (id: string) => {
    const itemToRemove = rateios.find(rt => rt.corretorId === id);
    const papel = itemToRemove?.papel || "";
    const afterRemoval = rateios.filter(rt => rt.corretorId !== id);

    if (papel === "captador") {
      const remainingCaptadores = afterRemoval.filter(r => r.papel === "captador");
      const count = remainingCaptadores.length;
      const equalPct = count > 0 ? Number((porcentagemCaptadores / count).toFixed(2)) : 0;

      setRateios(afterRemoval.map(rt => {
        if (rt.papel === "captador") {
          return {
            ...rt,
            porcentagem: equalPct,
            valor: Number(((aluguelMensal * equalPct) / 100).toFixed(2))
          };
        }
        return rt;
      }));
    } else {
      setRateios(afterRemoval);
    }
  };

  const handleUpdateCaptadorPct = (brokerId: string, pctValue: number) => {
    setRateios(prev => prev.map(rt => {
      if (rt.corretorId === brokerId && rt.papel === "captador") {
        return {
          ...rt,
          porcentagem: pctValue,
          valor: Number(((aluguelMensal * pctValue) / 100).toFixed(2))
        };
      }
      return rt;
    }));
  };

  const handleBalanceCaptadores = () => {
    const captadores = rateios.filter(r => r.papel === "captador");
    const count = captadores.length;
    if (count === 0) return;
    const equalPct = Number((porcentagemCaptadores / count).toFixed(2));
    setRateios(prev => prev.map(rt => {
      if (rt.papel === "captador") {
        return {
          ...rt,
          porcentagem: equalPct,
          valor: Number(((aluguelMensal * equalPct) / 100).toFixed(2))
        };
      }
      return rt;
    }));
  };

  const handleSaveRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imovel || !inquilino) {
      toast.error("Por favor, preencha o imóvel e inquilino.");
      return;
    }

    if (porcentagemFidelite + porcentagemLocador > 100) {
      toast.error("A soma das porcentagens da Imobiliária e do Locador não pode ultrapassar 100%.");
      return;
    }

    const hasLocadorBroker = rateios.some(r => r.papel === "locador" || r.papel === "locacao");
    if (porcentagemLocador > 0 && !hasLocadorBroker) {
      toast.error("Por favor, selecione um Corretor Locador, já que o percentual do locador é maior que 0%.");
      return;
    }

    const hasCaptadorBroker = rateios.some(r => r.papel === "captador");
    if (porcentagemCaptadores > 0 && !hasCaptadorBroker) {
      toast.error(`Por favor, adicione pelo menos um Corretor Captador para receber a parte de captação (${porcentagemCaptadores}%).`);
      return;
    }

    if (hasCaptadorBroker && sumCaptadoresPct !== porcentagemCaptadores) {
      toast.error(`A soma das porcentagens dos captadores (${sumCaptadoresPct}%) deve ser igual a ${porcentagemCaptadores}%. Ajuste os valores ou utilize a opção de divisão igualitária.`);
      return;
    }

    const updatedRateiosWithRecalculatedValues = computedRateios;

    if (editingRental) {
      const updatedRec: Comissao = {
        ...editingRental.legacyDoc,
        imovel,
        inquilino,
        aluguelMensal,
        primeiroAluguel,
        porcentagemFidelite,
        valorFidelite,
        valorRepasseCorretores,
        vencimento: vencimento || new Date().toISOString().split("T")[0],
        mesReferencia,
        rateio: updatedRateiosWithRecalculatedValues,
        observacoes,
        updatedAt: new Date().toISOString()
      };
      onUpdateRental(updatedRec);
    } else {
      const rec: Omit<Comissao, "id"> & { id?: string; processId?: string } = {
        companyId: userProfile.companyId || "default_agency",
        imovel,
        inquilino,
        aluguelMensal,
        primeiroAluguel,
        porcentagemFidelite,
        valorFidelite,
        valorRepasseCorretores,
        vencimento: vencimento || new Date().toISOString().split("T")[0],
        mesReferencia,
        status: "pendente",
        statusFinanceiro: "aguardando",
        jaPagoCorretores: false,
        rateio: updatedRateiosWithRecalculatedValues,
        observacoes,
        criadoPor: userProfile.uid,
        criadoPorNome: userProfile.displayName || "Admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pagamentosCorretores: [],
        processId: initialData?.processId || undefined
      };
      onCreateRental(rec);
    }

    resetForm();
    setActiveTab("list");
  };

  const handleOpenPayModal = (rt: DistribuicaoItem, currentRental: RentalFinancialViewModel) => {
    const totalPago = currentRental.legacyDoc.pagamentosCorretores
      ?.filter(p => p.corretorId === rt.corretorId)
      ?.reduce((acc, curr) => {
        if (curr.tipo === "pagamento" || curr.tipo === "adiantamento") return acc + curr.valor;
        return acc - curr.valor;
      }, 0) || 0;

    const saldoDevido = Math.max(0, rt.valor - totalPago);

    setPayBrokerId(rt.corretorId);
    setPayBrokerName(rt.corretorNome);
    
    const roleLabel = rt.papel === "locacao" ? "Locador" : rt.papel === "captador" ? "Captador" : "Auxiliar";
    setPayBrokerRole(roleLabel);
    setPayBrokerTotalDue(rt.valor);
    setPayBrokerAlreadyPaid(totalPago);

    setPayValue(saldoDevido);
    setPayNotes("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setIsPayModalOpen(true);
  };

  const handleSavePayment = () => {
    if (!selectedRental) return;

    const newPayment: PagamentoCorretor = {
      id: "pay-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
      corretorId: payBrokerId,
      corretorNome: payBrokerName,
      tipo: payType,
      valor: payValue,
      data: payDate,
      observacao: payNotes,
      registradoPorUid: userProfile.uid,
      registradoPorNome: userProfile.displayName || "Administrador",
      registradoEm: Date.now()
    };

    const nextPayments = [...(selectedRental.legacyDoc.pagamentosCorretores || []), newPayment];

    const updatedRateio = selectedRental.legacyDoc.rateio.map(rt => {
      if (rt.corretorId === payBrokerId) {
        const brokerPago = nextPayments
          ?.filter(p => p.corretorId === rt.corretorId)
          ?.reduce((acc, curr) => {
            if (curr.tipo === "pagamento" || curr.tipo === "adiantamento") return acc + curr.valor;
            return acc - curr.valor;
          }, 0) || 0;

        return {
          ...rt,
          totalPago: Number(brokerPago.toFixed(2)),
          status: brokerPago >= rt.valor ? ("pago" as const) : ("pendente" as const)
        };
      }
      return rt;
    });

    let checksAllPaid = true;
    updatedRateio.forEach(rt => {
      if ((rt.totalPago || 0) < rt.valor) {
        checksAllPaid = false;
      }
    });

    const updatedRental: Comissao = {
      ...selectedRental.legacyDoc,
      pagamentosCorretores: nextPayments,
      rateio: updatedRateio,
      jaPagoCorretores: checksAllPaid,
      status: checksAllPaid ? "pago" : selectedRental.legacyDoc.status,
      statusFinanceiro: checksAllPaid ? "concluido" : selectedRental.statusFinanceiro,
      updatedAt: new Date().toISOString()
    };

    onUpdateRental(updatedRental);
    setIsPayModalOpen(false);
    toast.success("Pagamento registrado com sucesso");
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!selectedRental) return;
    const nextPayments = (selectedRental.legacyDoc.pagamentosCorretores || []).filter(p => p.id !== paymentId);

    const updatedRateio = selectedRental.legacyDoc.rateio.map(rt => {
      const brokerPago = nextPayments
        ?.filter(p => p.corretorId === rt.corretorId)
        ?.reduce((acc, curr) => {
          if (curr.tipo === "pagamento" || curr.tipo === "adiantamento") return acc + curr.valor;
          return acc - curr.valor;
        }, 0) || 0;

      return {
        ...rt,
        totalPago: Number(brokerPago.toFixed(2)),
        status: brokerPago >= rt.valor ? ("pago" as const) : ("pendente" as const)
      };
    });

    let checksAllPaid = true;
    updatedRateio.forEach(rt => {
      if ((rt.totalPago || 0) < rt.valor) {
        checksAllPaid = false;
      }
    });

    const updatedRental: Comissao = {
      ...selectedRental.legacyDoc,
      pagamentosCorretores: nextPayments,
      rateio: updatedRateio,
      jaPagoCorretores: checksAllPaid,
      status: checksAllPaid ? "pago" : "pendente",
      statusFinanceiro: checksAllPaid ? "concluida" : "repasses_pendentes",
      updatedAt: new Date().toISOString()
    };

    onUpdateRental(updatedRental);
    toast.success("Lançamento de repasse removido.");
  };

  const handleUpdateStatusFinanceiro = (nextStatus: FinancialStatus) => {
    if (!selectedRental) return;

    let updatedRec: Comissao = {
      ...selectedRental.legacyDoc,
      statusFinanceiro: nextStatus,
      updatedAt: new Date().toISOString()
    };

    if (nextStatus === "concluida") {
      // Auto pay all brokers (legacy "Marcar Pago Geral" or "Quitação geral")
      let updatedPayments = [...(selectedRental.legacyDoc.pagamentosCorretores || [])];
      const updatedRateio = selectedRental.legacyDoc.rateio.map(rt => {
        const currentPaid = updatedPayments
          ?.filter(p => p.corretorId === rt.corretorId)
          ?.reduce((sum, curr) => {
            if (curr.tipo === "pagamento" || curr.tipo === "adiantamento") return sum + curr.valor;
            return sum - curr.valor;
          }, 0) || 0;

        const diff = Math.max(0, rt.valor - currentPaid);
        if (diff > 0) {
          const newPay: PagamentoCorretor = {
            id: "pay-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
            corretorId: rt.corretorId,
            corretorNome: rt.corretorNome,
            tipo: "pagamento",
            valor: Number(diff.toFixed(2)),
            data: new Date().toISOString().split("T")[0],
            observacao: "Quitação automática por encerramento financeiro",
            registradoPorUid: userProfile.uid,
            registradoPorNome: userProfile.displayName || "Administrador",
            registradoEm: Date.now()
          };
          updatedPayments.push(newPay);
        }

        return {
          ...rt,
          totalPago: rt.valor,
          status: "pago" as const
        };
      });

      updatedRec = {
        ...updatedRec,
        status: "pago",
        jaPagoCorretores: true,
        rateio: updatedRateio,
        pagamentosCorretores: updatedPayments
      };
    } else {
      // rollback jaPagoCorretores status
      if (selectedRental.legacyDoc.status === "pago") {
        updatedRec.status = "pendente";
        updatedRec.jaPagoCorretores = false;
      }
    }

    onUpdateRental(updatedRec);
    setShowReceiptFields(false);
    toast.success(`Fluxo financeiro atualizado para: ${nextStatus.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      {!selectedRental && activeTab !== "create" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none pt-1">
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 bg-blue-600 rounded-full" />
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              Locação
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Competência Selector */}
            <div className="relative">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/70 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer transition-all shadow-xs">
                <Calendar className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedMonthFilter}
                  onChange={(e) => setSelectedMonthFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 cursor-pointer focus:outline-none pr-2"
                >
                  <option value="TODOS">Todas as Competências</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{formatMesReferencia(m)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Novo Repasse / Nova Locação button */}
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveTab("create");
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0f274a] hover:bg-[#1a3b68] text-white rounded-2xl text-xs font-bold tracking-wide shadow-md shadow-[#0f274a]/20 cursor-pointer transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Novo Repasse</span>
            </button>
          </div>
        </div>
      )}

      {/* RENTAL DETAIL VIEW (TELA 2 OTIMIZADA, LIMPA E INTUITIVA) */}
      {selectedRental ? (() => {
        const primeiroAluguel = selectedRental.legacyDoc.primeiroAluguel || selectedRental.valorAluguel || 0;
        const valorFidelite = selectedRental.legacyDoc.valorFidelite || 0;
        const porcentagemFidelite = selectedRental.legacyDoc.porcentagemFidelite ?? 40;
        const totalDevidoEquipe = selectedRental.legacyDoc.valorRepasseCorretores || 0;
        
        const pagamentos = selectedRental.legacyDoc.pagamentosCorretores || [];
        const totalPagoEquipe = pagamentos.reduce((acc, curr) => {
          if (curr.tipo === "desconto" || curr.tipo === "desconto_adiantamento") return acc - curr.valor;
          return acc + curr.valor;
        }, 0);

        const saldoPendenteEquipe = Math.max(0, totalDevidoEquipe - totalPagoEquipe);
        const percentualDistribuido = totalDevidoEquipe > 0 
          ? Math.min(100, Math.round((totalPagoEquipe / totalDevidoEquipe) * 100)) 
          : 100;

        return (
          <div className="space-y-6 animate-fade-in select-none">
            {/* Header com Navegação e Ações Rápidas */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start md:items-center gap-4">
                <button 
                  onClick={() => { setSelectedRentalId(null); setEditingRentalId(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight font-sans">
                        {selectedRental.imovel}
                      </h2>
                      <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-extrabold rounded-lg uppercase tracking-wider">
                        LOC-{selectedRental.id.slice(0, 5).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                      <span>Inquilino: <strong className="text-slate-700 font-semibold">{selectedRental.inquilino}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{selectedRental.competencia.label}</strong>
                      </span>
                      {selectedRental.legacyDoc.vencimento && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>Venc: <strong>{new Date(selectedRental.legacyDoc.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
                <RentalStatusBadge status={selectedRental.statusFinanceiro} />

                <button 
                  type="button"
                  onClick={() => {
                    setEditingRentalId(selectedRental.id);
                    setSelectedRentalId(null);
                    setActiveTab("create");
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  <span>Editar Parâmetros</span>
                </button>

                {selectedRental.statusFinanceiro !== "concluida" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmState({
                        open: true,
                        title: "Quitar Todos os Repasses",
                        message: "Deseja quitar integralmente todos os repasses pendentes desta locação e encerrar a comissão?",
                        confirmColor: "green",
                        onConfirm: () => {
                          setConfirmState(prev => ({ ...prev, open: false }));
                          handleUpdateStatusFinanceiro("concluida");
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Quitar Todos</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatusFinanceiro("repasses_pendentes")}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Reabrir Repasses</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 KPIs Cards Resumo Executivo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1º Aluguel */}
              <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">1º Aluguel</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-slate-900 font-sans">
                    {formatCurrency(primeiroAluguel)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Base contratual integral</p>
                </div>
              </div>

              {/* Retenção Fidelité */}
              <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Imobiliária ({porcentagemFidelite}%)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-emerald-600 font-sans">
                    {formatCurrency(valorFidelite)}
                  </div>
                  <p className="text-[11px] text-emerald-600/80 font-medium mt-0.5">Retido no Caixa Fidelité</p>
                </div>
              </div>

              {/* Repasses Equipe Devido */}
              <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Equipe</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-slate-900 font-sans">
                    {formatCurrency(totalDevidoEquipe)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {selectedRental.distribuicao.length} {selectedRental.distribuicao.length === 1 ? 'corretor' : 'corretores'} no rateio
                  </p>
                </div>
              </div>

              {/* Repasses Distribuídos / Progresso */}
              <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Repasses Pagos</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-slate-900 font-sans flex items-baseline gap-1.5">
                    <span>{formatCurrency(totalPagoEquipe)}</span>
                    <span className="text-xs font-bold text-slate-400">
                      / {formatCurrency(totalDevidoEquipe)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${percentualDistribuido === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${percentualDistribuido}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-600">{percentualDistribuido}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Split Principal: Divisão & Ações de Repasse (Esquerda) + Extrato de Pagamentos (Direita) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Coluna Esquerda: Lista de Beneficiários e Registro Direto (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight font-sans">
                        Divisão de Rateio & Pagamento de Repasses
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Valores por participante com atalho direto para registrar repasse
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
                      Split 100%
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Item Imobiliária Fidelité */}
                    <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100/80 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                          F
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">Fidelité Imobiliária</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md uppercase">
                              Imobiliária
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Taxa de intermediação ({porcentagemFidelite}%)
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-700 block">
                          {formatCurrency(valorFidelite)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-md inline-block mt-0.5">
                          Retido no Caixa
                        </span>
                      </div>
                    </div>

                    {/* Itens de Corretores */}
                    {selectedRental.distribuicao.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        Nenhum corretor cadastrado no rateio desta locação.
                      </div>
                    ) : (
                      selectedRental.distribuicao.map((rt, idx) => {
                        const totalPagoCorretor = pagamentos
                          ?.filter(p => p.corretorId === rt.corretorId)
                          ?.reduce((sum, current) => {
                            if (current.tipo === 'pagamento' || current.tipo === 'adiantamento') return sum + current.valor;
                            return sum - current.valor;
                          }, 0) || 0;

                        const saldoRestante = Math.max(0, rt.valor - totalPagoCorretor);
                        const isBrokerFullyPaid = totalPagoCorretor >= rt.valor - 0.01;

                        const roleLabel = rt.papel === "locacao" ? "Locador" : rt.papel === "captador" ? "Captador" : "Auxiliar";
                        const avatarBg = rt.papel === "locacao" 
                          ? "bg-purple-600 text-white" 
                          : "bg-blue-600 text-white";

                        return (
                          <div 
                            key={idx} 
                            className={`p-4 rounded-2xl border transition-all ${
                              isBrokerFullyPaid 
                                ? 'bg-slate-50/70 border-slate-200/80' 
                                : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                            } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                          >
                            {/* Left: Avatar + Name + Role */}
                            <div className="flex items-center gap-3 min-w-[180px]">
                              <div className={`w-10 h-10 rounded-2xl ${avatarBg} flex items-center justify-center font-bold text-sm shadow-xs shrink-0`}>
                                {rt.corretorNome.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">{formatPersonName(rt.corretorNome)}</span>
                                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                                    rt.papel === "locacao" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                                  }`}>
                                    {roleLabel}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 block mt-0.5">
                                  {rt.porcentagem || 0}% do rateio
                                </span>
                              </div>
                            </div>

                            {/* Middle: Numbers */}
                            <div className="grid grid-cols-3 gap-2 text-left sm:text-right border-y sm:border-y-0 border-slate-100 py-2 sm:py-0">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Devido</span>
                                <span className="text-xs font-extrabold text-slate-800">{formatCurrency(rt.valor)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pago</span>
                                <span className={`text-xs font-extrabold ${totalPagoCorretor > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                                  {formatCurrency(totalPagoCorretor)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo</span>
                                <span className={`text-xs font-extrabold ${saldoRestante > 0 ? "text-amber-600 font-black" : "text-slate-400"}`}>
                                  {formatCurrency(saldoRestante)}
                                </span>
                              </div>
                            </div>

                            {/* Right: Direct Pay Action */}
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              {isBrokerFullyPaid ? (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Quitado</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayModal(rt, selectedRental)}
                                    title="Lançar ajuste ou bônus adicional"
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayModal(rt, selectedRental)}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                                >
                                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                                  <span>Pagar {formatCurrency(saldoRestante)}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Extrato de Repasses Efetuados (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight font-sans">
                        Extrato de Repasses
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Histórico de pagamentos efetuados
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">
                      {pagamentos.length} {pagamentos.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>

                  {pagamentos.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Banknote className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Nenhum repasse efetuado ainda</p>
                      <p className="text-[11px] text-slate-400 max-w-[240px] mx-auto">
                        Utilize o botão verde <strong className="text-slate-600">Pagar</strong> ao lado para registrar o primeiro repasse desta locação.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {pagamentos.map((pay, pIdx) => {
                        const participant = selectedRental.distribuicao.find(rt => rt.corretorId === pay.corretorId);
                        const roleLabel = participant 
                          ? (participant.papel === "locacao" ? "Locador" : participant.papel === "captador" ? "Captador" : "Auxiliar")
                          : "";

                        return (
                          <div key={pIdx} className="bg-slate-50/80 border border-slate-200/80 p-3.5 rounded-2xl space-y-2 hover:border-slate-300 transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                                  ✓
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{formatPersonName(pay.corretorNome)}</p>
                                  {roleLabel && (
                                    <span className="text-[10px] text-slate-400 font-semibold">{roleLabel}</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-emerald-600 font-sans">
                                  {pay.tipo === "desconto" || pay.tipo === "desconto_adiantamento" ? "-" : ""}{formatCurrency(pay.valor)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmState({
                                      open: true,
                                      title: "Remover Repasse",
                                      message: `Deseja estornar/excluir este lançamento de ${formatCurrency(pay.valor)} para ${pay.corretorNome}?`,
                                      confirmColor: "red",
                                      onConfirm: () => {
                                        setConfirmState(prev => ({ ...prev, open: false }));
                                        handleDeletePayment(pay.id);
                                      }
                                    });
                                  }}
                                  title="Excluir lançamento"
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-200/50">
                              <span className="px-2 py-0.5 bg-slate-200/70 rounded-md font-semibold text-slate-700 uppercase tracking-wider text-[9px]">
                                {pay.tipo === "pagamento" ? "Repasse" : pay.tipo === "adiantamento" ? "Adiantamento" : "Desconto"}
                              </span>
                              <span>
                                {pay.data ? new Date(pay.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                              </span>
                            </div>

                            {pay.observacao && (
                              <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200/60 leading-relaxed font-normal">
                                {pay.observacao}
                              </p>
                            )}

                            {pay.registradoPorNome && (
                              <span className="text-[9px] text-slate-400 block text-right">
                                Registrado por {pay.registradoPorNome}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })() : activeTab === "create" ? (
        /* RENTAL FORM SCREEN */
        <form onSubmit={handleSaveRental} className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl space-y-6 animate-fade-in select-none">
          <div className="border-b border-slate-100 pb-4 shrink-0">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              {editingRental ? "Editar Locação Financeira" : "Novos Parâmetros de Locação"}
            </h2>
            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">
              {editingRental ? "Alterar dados de distribuição, imóvel e fluxo" : "Lançar configurações de faturamento e taxas do contrato de locação"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5 bg-slate-50/50 p-6 rounded-[28px] border border-slate-100">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b border-light pb-1">1. Registro de Contrato</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Endereço do Imóvel</label>
                  <input 
                    type="text" 
                    value={imovel} 
                    onChange={e => setImovel(e.target.value)} 
                    placeholder="Ex: Av. T-10, 150 - Setor Bueno" 
                    required 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome do Inquilino</label>
                  <input 
                    type="text" 
                    value={inquilino} 
                    onChange={e => setInquilino(e.target.value)} 
                    placeholder="Ex: João Ferreira Gomes" 
                    required 
                    className="w-full px-4 py-3 bg-white border border-slate-205 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor do Aluguel (R$)</label>
                    <input 
                      type="number" 
                      value={aluguelMensal || ""} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        setAluguelMensal(val);
                        setPrimeiroAluguel(val);
                      }} 
                      placeholder="3500" 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mês de Referência (Competência)</label>
                    <input 
                      type="month" 
                      value={mesReferencia} 
                      onChange={e => setMesReferencia(e.target.value)} 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primeiro Aluguel Bruto (R$)</label>
                  <input 
                    type="number" 
                    value={primeiroAluguel || ""} 
                    onChange={e => setPrimeiroAluguel(Number(e.target.value))} 
                    required 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">% Taxa Retida Imobiliária</label>
                    <input 
                      type="number" 
                      value={porcentagemFidelite || 0} 
                      onChange={e => setPorcentagemFidelite(Number(e.target.value))} 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">% Fat. Locador</label>
                    <input 
                      type="number" 
                      value={porcentagemLocador || 0} 
                      onChange={e => setPorcentagemLocador(Number(e.target.value))} 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">% Captadores (Automático)</label>
                  <input 
                    type="text" 
                    readOnly
                    value={`${porcentagemCaptadores}%`} 
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-500 font-mono select-none"
                  />
                </div>

                <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl text-xs space-y-2.5 shadow-sm">
                  <div className="flex justify-between items-center text-slate-650">
                    <span className="font-semibold">Faturamento Total do Contrato:</span>
                    <span className="font-bold text-slate-800 font-mono">{formatCurrency(aluguelMensal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-650">
                    <span>Taxa Retida Imobiliária ({porcentagemFidelite}%):</span>
                    <span className="font-bold text-indigo-600 font-mono">{formatCurrency(valorFidelite)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-650">
                    <span>Rateio Locador ({porcentagemLocador}%):</span>
                    <span className="font-bold text-amber-600 font-mono">{formatCurrency(valorLocadorValue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-650 font-bold text-emerald-600">
                    <span>Rateio Captadores ({porcentagemCaptadores}%):</span>
                    <span className="font-extrabold font-mono">{formatCurrency(valorCaptadoresValue)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 bg-slate-50/50 p-6 rounded-[28px] border border-slate-100 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b border-light pb-1">2. Distribuição de Splits</h3>

                <div className="space-y-3 bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Corretor Locador ({porcentagemLocador}%)</label>
                    <select
                      value={rateios.find(r => r.papel === "locador" || r.papel === "locacao")?.corretorId || ""}
                      onChange={e => setLocadorBroker(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                    >
                      <option value="">Buscar locador...</option>
                      {team.filter(b => b.permRateioLocacao !== false || b.permissions?.includes("rateio_locacao") || b.id === (rateios.find(r => r.papel === "locador" || r.papel === "locacao")?.corretorId)).map(b => (
                        <option key={b.id} value={b.id}>{formatPersonName(b.name)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Adicionar Corretor Captador ({porcentagemCaptadores}%)</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedCaptadorId}
                        onChange={e => setSelectedCaptadorId(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-bold focus:outline-none"
                      >
                        <option value="">Buscar captador...</option>
                        {team.filter(b => b.permRateioLocacao !== false || b.permissions?.includes("rateio_locacao") || b.id === selectedCaptadorId).map(b => (
                          <option key={b.id} value={b.id}>{formatPersonName(b.name)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddCaptador(selectedCaptadorId)}
                        className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md"
                      >
                        Incluir
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Rateio Alocado</span>
                    <span className="text-emerald-600 font-black font-mono">
                      {Math.min(100, porcentagemFidelite + porcentagemLocador)}% / 100%
                    </span>
                  </div>
                  <div className="w-full bg-slate-150 rounded-full h-2 overflow-hidden border border-slate-200/40">
                    <div 
                      className="h-full transition-all duration-300 bg-emerald-550" 
                      style={{ width: `${Math.min(100, porcentagemFidelite + porcentagemLocador)}%` }}
                    />
                  </div>
                </div>

                {rateios.filter(r => r.papel === "captador").length > 0 && sumCaptadoresPct !== porcentagemCaptadores && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 font-medium space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">⚠️ Rateio incompleto/excedente</span>
                      <span className="font-mono font-black px-1.5 py-0.5 bg-amber-100 rounded">
                        {sumCaptadoresPct}% de {porcentagemCaptadores}%
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-600 leading-snug">
                      A soma das porcentagens dos captadores precisa ser exatamente {porcentagemCaptadores}%. Atualmente está em {sumCaptadoresPct}%.
                    </p>
                    <button
                      type="button"
                      onClick={handleBalanceCaptadores}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm"
                    >
                      Dividir Igualmente ({Number(porcentagemCaptadores / rateios.filter(r => r.papel === "captador").length).toFixed(2).replace(/\.00$/, "")}% cada)
                    </button>
                  </div>
                )}

                {rateios.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold text-center italic py-6">Insira os corretores responsáveis nos respectivos campos acima.</p>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {computedRateios.map((rt, idx) => {
                      return (
                        <div key={`${rt.corretorId}-${rt.papel}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-xs select-none hover:bg-slate-50/50 transition-all">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800">{formatPersonName(rt.corretorNome)}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                rt.papel === "locador" || rt.papel === "locacao" ? "bg-amber-100 border-amber-300 text-amber-600" : "bg-emerald-100 border-emerald-300 text-emerald-600"
                              }`}>
                                {rt.papel === "locador" || rt.papel === "locacao" ? "Locador" : "Captador"}
                              </span>
                              
                              {rt.papel === "captador" ? (
                                <div className="flex items-center gap-1 ml-1">
                                  <span>•</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={rt.porcentagem || 0}
                                    onChange={(e) => handleUpdateCaptadorPct(rt.corretorId, Number(e.target.value))}
                                    className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-205 rounded text-center text-[10px] font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                                    placeholder="%"
                                  />
                                  <span className="text-[10px] font-bold text-slate-500">%</span>
                                </div>
                              ) : (
                                <>
                                  <span>•</span>
                                  <span>{Number(rt.porcentagem).toFixed(2).replace(/\.00$/, "")}%</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 font-bold">
                            <span className="font-extrabold text-slate-855 font-mono">{formatCurrency(rt.valor)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBrokerFromRateio(rt.corretorId)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vencimento da Parcela</label>
              <input 
                type="date" 
                value={vencimento} 
                onChange={e => setVencimento(e.target.value)} 
                required 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Diretrizes ou Anotações</label>
              <input 
                type="text" 
                value={observacoes} 
                onChange={e => setObservacoes(e.target.value)} 
                placeholder="Ex: Contrato de locatário captado via divulgação orgânica no Instagram" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button 
              type="button" 
              onClick={() => { 
                const wasEditing = !!editingRentalId;
                resetForm(); 
                setActiveTab(wasEditing ? "list" : "dashboard"); 
              }}
              className="px-6 py-3 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-lg shadow-emerald-500/15 font-bold"
            >
              {editingRentalId ? "Salvar Alterações" : "Criar Definições"}
            </button>
          </div>
        </form>
      ) : (
        /* RENTAL DASHBOARD & MAIN EXECUTIVE VIEW */
        <div className="space-y-6 animate-fade-in select-none">
          {/* Resumo Executivo (KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {/* Card 1 — Total Processado */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 font-sans">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Total Processado
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline">
                  <span className="text-xs font-bold text-slate-400 mr-1 font-mono">R$</span>
                  <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalProcessado)}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100/80">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-600 text-[11px] font-bold">
                  <Landmark className="w-3 h-3 text-slate-400" />
                  Caixa Fidelité: <strong className="text-slate-800 font-mono">{formatCurrency(totalFideliteCaixa)}</strong>
                </span>
              </div>
            </div>

            {/* Card 2 — Repasses Concluídos */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 font-sans">
                  Repasses Concluídos
                </span>
                <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline">
                  <span className="text-xs font-bold text-slate-400 mr-1 font-mono">R$</span>
                  <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(card4Data.pagos)}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                    {countOperacoesPagas}
                  </span>
                  operações pagas
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${pctConcluido}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Card 3 — Em Aberto */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 font-sans">
                  Em Aberto
                </span>
                <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline">
                  <span className="text-xs font-bold text-slate-400 mr-1 font-mono">R$</span>
                  <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(card4Data.aPagar)}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                    {countAguardandoRepasse}
                  </span>
                  aguardando repasse
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${pctEmAberto}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Card 4 — Atrasados */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 font-sans">
                  Atrasados
                  <span className="w-2 h-2 rounded-full bg-rose-600 inline-block"></span>
                </span>
                <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline">
                  <span className="text-xs font-bold text-rose-400 mr-1 font-mono">R$</span>
                  <span className="text-2xl font-black text-rose-600 font-mono tracking-tight">
                    {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAtrasadosValor)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between pt-1">
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold text-[10px]">
                    {countAtraso}
                  </span>
                  {countAtraso === 1 ? "contrato vencido" : "contratos vencidos"}
                </div>
                <button
                  type="button"
                  onClick={() => setFilterStatus(filterStatus === "ATRASADO" ? "TODOS" : "ATRASADO")}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer transition-all"
                >
                  Ver detalhes →
                </button>
              </div>
            </div>
          </div>

          {/* Filtros Inteligentes */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 md:p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={filterText} 
                onChange={e => setFilterText(e.target.value)} 
                placeholder="Buscar por imóvel, corretor ou locatário..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider mr-1">
                FILTRAR STATUS:
              </span>
              
              {/* Todos */}
              <button
                type="button"
                onClick={() => setFilterStatus("TODOS")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === "TODOS"
                    ? "bg-blue-100 text-blue-800 border border-blue-200 shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                }`}
              >
                Todos
              </button>

              {/* Concluído */}
              <button
                type="button"
                onClick={() => setFilterStatus("CONCLUIDO")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  filterStatus === "CONCLUIDO"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Concluído
              </button>

              {/* Em Aberto */}
              <button
                type="button"
                onClick={() => setFilterStatus("EM_ABERTO")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  filterStatus === "EM_ABERTO"
                    ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Em Aberto
              </button>

              {/* Atrasado */}
              <button
                type="button"
                onClick={() => setFilterStatus("ATRASADO")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  filterStatus === "ATRASADO"
                    ? "bg-rose-50 text-rose-800 border border-rose-200 shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Atrasado
              </button>

              {/* Reset filter */}
              {(filterText || filterStatus !== "TODOS") && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterText("");
                    setFilterStatus("TODOS");
                  }}
                  title="Limpar filtros"
                  className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-lg cursor-pointer transition-all ml-1"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Locações — Controle de Status Financeiro */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-3.5 pl-6 pr-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      IMÓVEL / REFERÊNCIA
                    </th>
                    <th className="py-3.5 px-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      COMPETÊNCIA
                    </th>
                    <th className="py-3.5 px-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      VALOR ALUGUEL
                    </th>
                    <th className="py-3.5 px-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      COMISSÃO TOTAL
                    </th>
                    <th className="py-3.5 px-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      STATUS
                    </th>
                    <th className="py-3.5 pr-6 pl-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRentals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400 italic">
                        Nenhum contrato de locação encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredRentals.map((r) => {
                      const rowStatus = getRowStatus(r);
                      const brokers = getBrokersList(r);
                      const distribuidoPct = getDistribuidoPct(r);

                      return (
                        <tr 
                          key={r.id}
                          onClick={() => setSelectedRentalId(r.id)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                        >
                          {/* IMÓVEL / REFERÊNCIA */}
                          <td className="py-4 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[#0f274a] text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {r.imovel}
                                </p>
                                <p className="text-xs text-slate-500 font-medium truncate">
                                  Inquilino: {r.inquilino ? formatPersonName(r.inquilino) : "Não informado"} · Cód: LOC-{r.id.slice(0, 4).toUpperCase()}
                                </p>
                                {/* Broker avatar letter bubbles */}
                                <div className="flex items-center -space-x-1 pt-1">
                                  {brokers.map((b) => (
                                    <div
                                      key={b.key}
                                      title={b.name}
                                      className={`w-5 h-5 rounded-full ${b.bg} text-white font-black text-[9px] flex items-center justify-center ring-2 ring-white shadow-xs`}
                                    >
                                      {b.letter}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* COMPETÊNCIA */}
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {r.competencia.label}
                            </span>
                          </td>

                          {/* VALOR ALUGUEL */}
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {formatCurrency(r.legacyDoc.primeiroAluguel || r.valorAluguel || 0)}
                            </span>
                          </td>

                          {/* COMISSÃO TOTAL */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-extrabold text-[#0f274a] font-mono">
                                {formatCurrency(r.legacyDoc.valorFidelite || 0)}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 mt-1">
                                {distribuidoPct}% Distribuído
                              </span>
                            </div>
                          </td>

                          {/* STATUS */}
                          <td className="py-4 px-4 text-center">
                            {rowStatus === "concluido" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 stroke-[3]" />
                                CONCLUÍDA
                              </span>
                            )}
                            {rowStatus === "em_aberto" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                EM ABERTO
                              </span>
                            )}
                            {rowStatus === "atrasado" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                ATRASADO
                              </span>
                            )}
                          </td>

                          {/* AÇÕES */}
                          <td className="py-4 pr-6 pl-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedRentalId(r.id)}
                                title="Ver detalhes da comissão"
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-all"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO DE REPASSE (INTUITIVO E ELEGANTE) */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsPayModalOpen(false)} 
          />
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 animate-scale-up select-none text-left border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight font-sans">
                    Registrar Pagamento de Repasse
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Lançamento financeiro para a equipe
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Beneficiary summary card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {payBrokerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{formatPersonName(payBrokerName)}</p>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md uppercase">
                        {payBrokerRole === "locacao" ? "Locador" : payBrokerRole === "captador" ? "Captador" : "Auxiliar"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Total rateio: <strong>{formatCurrency(payBrokerTotalDue)}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo a Pagar</span>
                  <span className="text-sm font-black text-amber-600 font-sans">
                    {formatCurrency(Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid))}
                  </span>
                </div>
              </div>

              {/* Quick Fill Pills */}
              {Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid) > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Atalho rápido:</span>
                  <button
                    type="button"
                    onClick={() => setPayValue(Number((Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid)).toFixed(2)))}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    Quitar Saldo ({formatCurrency(Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid))})
                  </button>
                  {Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid) > 100 && (
                    <button
                      type="button"
                      onClick={() => setPayValue(Number(((Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid)) / 2).toFixed(2)))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                    >
                      50% ({formatCurrency((Math.max(0, payBrokerTotalDue - payBrokerAlreadyPaid)) / 2)})
                    </button>
                  )}
                </div>
              )}

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Valor do Pagamento (R$) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      value={payValue || ""} 
                      onChange={e => setPayValue(Number(e.target.value))} 
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Data do Pagamento <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    value={payDate} 
                    onChange={e => setPayDate(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo de Operação
                </label>
                <select
                  value={payType}
                  onChange={e => setPayType(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="pagamento">Pagamento de Repasse (Padrão)</option>
                  <option value="adiantamento">Adiantamento de Comissão</option>
                  <option value="desconto_adiantamento">Desconto / Compensação</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Comprovante / Anotação PIX (Opcional)
                </label>
                <input 
                  type="text" 
                  value={payNotes} 
                  onChange={e => setPayNotes(e.target.value)} 
                  placeholder="Ex: Chave PIX Nubank ou nº do comprovante" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
 
            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSavePayment}
                disabled={!payValue || payValue <= 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirmar Pagamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmColor={confirmState.confirmColor}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};
