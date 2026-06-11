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
  Users
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

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

export const formatMesReferencia = (mes: string): string => {
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
    return Number(((aluguelMensal * porcentagemCaptadores) / 105).toFixed(2)); // adjusted slightly or kept proportional
    return Number(((aluguelMensal * porcentagemCaptadores) / 100).toFixed(2));
  }, [aluguelMensal, porcentagemCaptadores]);

  const valorRepasseCorretores = useMemo(() => {
    return Number((aluguelMensal - valorFidelite).toFixed(2));
  }, [aluguelMensal, valorFidelite]);

  const computedRateios = useMemo(() => {
    const locadorCount = rateios.filter(r => r.papel === "locacao").length;
    const captadorCount = rateios.filter(r => r.papel === "captador").length;

    return rateios.map(r => {
      if (r.papel === "locacao") {
        return {
          ...r,
          porcentagem: porcentagemLocador,
          valor: valorLocadorValue
        };
      } else if (r.papel === "captador" || r.papel === "locador") {
        const pct = captadorCount > 0 ? Number((porcentagemCaptadores / captadorCount).toFixed(2)) : 0;
        const val = captadorCount > 0 ? Number((valorCaptadoresValue / captadorCount).toFixed(2)) : 0;
        return {
          ...r,
          porcentagem: pct,
          valor: val
        };
      }
      return r;
    });
  }, [rateios, porcentagemLocador, valorLocadorValue, porcentagemCaptadores, valorCaptadoresValue]);

  const countAtraso = useMemo(() => {
    // legacy backward compat atraso trigger
    return monthlyModels.filter(r => r.statusFinanceiro === "aguardando" && r.legacyDoc.status === "atraso").length;
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
          parts.push(`${d.corretorNome} ${pct}%`);
        }
      });
    }
    
    return parts.join(" · ");
  };

  // FILTERED MODELS BY MONTH REFERENCE (SINCE PILLS ARE REMOVED)
  const currentFiltered = monthlyModels;

  // CARD 1 VALUE — Comissões Primeiro Aluguel
  const card1Value = useMemo(() => {
    return currentFiltered.reduce((acc, r) => acc + (r.legacyDoc.primeiroAluguel || r.valorAluguel || 0), 0);
  }, [currentFiltered]);

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
        (r.distribuicao || []).some(rt => (rt.corretorNome || "").toLowerCase().includes(searchLower));

      if (filterStatus === "TUDO") return matchText;
      if (filterStatus === "PENDENTE") {
        return matchText && r.statusFinanceiro !== "concluido";
      }
      if (filterStatus === "ATRASO") {
        return matchText && r.statusFinanceiro === "aguardando" && r.legacyDoc.status === "atraso";
      }
      if (filterStatus === "PAGO") {
        return matchText && r.statusFinanceiro === "concluido";
      }
      return matchText;
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
      alert("Selecione um corretor para incluir como captador.");
      return;
    }
    const brokerObj = team.find(t => t.id === brokerId);
    if (!brokerObj) return;

    if (rateios.some(rt => rt.corretorId === brokerId)) {
      alert("Este corretor já está adicionado no rateio.");
      return;
    }

    const newRateio: RateioComissao = {
      corretorId: brokerId,
      corretorNome: brokerObj.name,
      papel: "captador",
      porcentagem: 0,
      valor: 0
    };

    setRateios([...rateios, newRateio]);
    setSelectedCaptadorId("");
  };

  const handleRemoveBrokerFromRateio = (id: string) => {
    setRateios(rateios.filter(rt => rt.corretorId !== id));
  };

  const handleSaveRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imovel || !inquilino) {
      alert("Por favor, preencha o imóvel e inquilino.");
      return;
    }

    if (porcentagemFidelite + porcentagemLocador > 100) {
      alert("A soma das porcentagens da Imobiliária e do Locador não pode ultrapassar 100%.");
      return;
    }

    const hasLocadorBroker = rateios.some(r => r.papel === "locador" || r.papel === "locacao");
    if (porcentagemLocador > 0 && !hasLocadorBroker) {
      alert("Por favor, selecione um Corretor Locador, já que o percentual do locador é maior que 0%.");
      return;
    }

    const hasCaptadorBroker = rateios.some(r => r.papel === "captador");
    if (porcentagemCaptadores > 0 && !hasCaptadorBroker) {
      alert(`Por favor, adicione pelo menos um Corretor Captador para receber a parte de captação (${porcentagemCaptadores}%).`);
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
      
      {/* Tab Menu local */}
      {!selectedRental && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          <div className="flex bg-slate-50 p-1 rounded-2xl w-fit border border-slate-100 shadow-sm">
            <button 
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                activeTab === "dashboard" ? "bg-white text-emerald-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              Dashboard de Comissões
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("list")}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                activeTab === "list" ? "bg-white text-emerald-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              Histórico de Repasses
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("create")}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                activeTab === "create" ? "bg-white text-emerald-600 shadow-sm font-black" : "text-slate-400 hover:text-slate-700"
              }`}
            >
              Nova Locação
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comp. Referência:</span>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer min-w-[140px]"
            >
              <option value="TODOS">Todos os Meses</option>
              {uniqueMonths.map(m => (
                <option key={m} value={m}>{formatMesReferencia(m)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* RENTAL DETAIL VIEW */}
      {selectedRental ? (
        <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl space-y-8 animate-fade-in select-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-6 shrink-0">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setSelectedRentalId(null); setEditingRentalId(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-505 hover:text-slate-800 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <button 
                type="button"
                onClick={() => {
                  setEditingRentalId(selectedRental.id);
                  setSelectedRentalId(null);
                  setActiveTab("create");
                }}
                className="px-4 py-2 border border-blue-500 text-blue-600 hover:bg-blue-50 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-2 transition-all"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar Parâmetros
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <RentalStatusBadge status={selectedRental.statusFinanceiro} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Refactored domain representation cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CompetenceCard rental={selectedRental} isSelected />
                <DistributionCard rental={selectedRental} />
              </div>

              {/* Vertical timeline card */}
              <RepasseTimeline rental={selectedRental} />

              {/* Detail list splits */}
              <div className="bg-white border border-slate-100 p-6 rounded-[30px] space-y-4 shadow-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">Execução da Distribuição Financeira</h3>
                  <span className="text-[10px] font-bold text-slate-400">Restante para equipe: <strong>{formatCurrency(selectedRental.legacyDoc.valorRepasseCorretores)}</strong></span>
                </div>
                
                {selectedRental.distribuicao.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sem integrantes associados no rateio da distribuição.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {selectedRental.distribuicao.map((rt, idx) => {
                      const totalPagoCorretor = selectedRental.repasses
                        ?.filter(p => p.corretorId === rt.corretorId)
                        ?.reduce((sum, current) => {
                          if (current.tipo === 'pagamento' || current.tipo === 'adiantamento') return sum + current.valor;
                          return sum - current.valor;
                        }, 0) || 0;

                      const saldoRestante = Math.max(0, rt.valor - totalPagoCorretor);
                      const isBrokerFullyPaid = totalPagoCorretor >= rt.valor;

                      const isFidelity = rt.corretorNome.toLowerCase().includes("fidelité") || rt.corretorNome.toLowerCase().includes("fidelite");
                      let avatarBg = "bg-slate-500 text-white";
                      if (isFidelity) {
                        avatarBg = "bg-emerald-600 text-white";
                      } else if (rt.papel === "captador") {
                        avatarBg = "bg-blue-650 text-white";
                      } else if (rt.papel === "locacao") {
                        avatarBg = "bg-purple-650 text-white";
                      }

                      return (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold`}>
                              {rt.corretorNome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{rt.corretorNome}</p>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                                {rt.papel === "locacao" ? "Locador" : rt.papel === "captador" ? "Captador" : "Auxiliar"} • {rt.porcentagem || 0}% de distribuição
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 justify-between sm:justify-end text-right">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Comprometido</span>
                              <span className="text-xs font-bold text-slate-850">{formatCurrency(rt.valor)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Distribuído</span>
                              <span className={`text-xs font-bold ${isBrokerFullyPaid ? "text-emerald-600" : "text-amber-600"}`}>
                                {formatCurrency(totalPagoCorretor)}
                              </span>
                            </div>
                            <div className="min-w-[120px]">
                              {isBrokerFullyPaid ? (
                                <span className="text-[8px] bg-emerald-50 text-emerald-600 font-extrabold tracking-widest uppercase px-3 py-2 rounded-xl border border-emerald-100 flex items-center gap-1 Justify-center">
                                  <Check className="w-3.5 h-3.5" /> Concluído
                                </span>
                              ) : (
                                <button 
                                  onClick={() => handleOpenPayModal(rt, selectedRental)}
                                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-1 px-3 shadow-md shadow-emerald-500/10"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Repassar ({formatCurrency(saldoRestante)})</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Side Controller Card for Status Financeiro and Payments history */}
            <div className="space-y-6">
              {/* Status Flow Transition controller card */}
              <div className="bg-slate-50 border border-slate-205 p-6 rounded-[30px] space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest border-b border-slate-200 pb-2">Controle da Comissão</h3>

                <div className="space-y-3">
                  {/* Transition actions */}
                  {selectedRental.statusFinanceiro === "calculada" && (
                    <button
                      onClick={() => handleUpdateStatusFinanceiro("aguardando_pagamento")}
                      className="w-full py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-slate-500/15"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Definir como Aguardando Pagamento</span>
                    </button>
                  )}

                  {selectedRental.statusFinanceiro === "aguardando_pagamento" && (
                    <button
                      onClick={() => handleUpdateStatusFinanceiro("em_distribuicao")}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-purple-500/15"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Liberar Distribuição</span>
                    </button>
                  )}

                  {selectedRental.statusFinanceiro === "em_distribuicao" && (
                    <button
                      onClick={() => handleUpdateStatusFinanceiro("repasses_pendentes")}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>Iniciar Repasses</span>
                    </button>
                  )}

                  {selectedRental.statusFinanceiro === "repasses_pendentes" && (
                    <button
                      onClick={() => {
                        setConfirmState({
                          open: true,
                          title: "Finalizar Controle de Comissão",
                          message: "Isso marcará a comissão como totalmente liquidada/concluída. Confirmar?",
                          confirmColor: "green",
                          onConfirm: () => {
                            setConfirmState(prev => ({ ...prev, open: false }));
                            handleUpdateStatusFinanceiro("concluida");
                          }
                        });
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finalizar Comissão</span>
                    </button>
                  )}

                  {selectedRental.statusFinanceiro === "concluida" ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center space-y-1.5 text-xs">
                      <span className="text-xl">🎉</span>
                      <p className="font-extrabold text-emerald-800 uppercase tracking-wide">Comissão Concluída</p>
                      <p className="text-[10px] text-emerald-600 font-semibold leading-relaxed">Todos os repasses e divisões de comissão desta locação foram quitados.</p>
                      <button
                        onClick={() => handleUpdateStatusFinanceiro("repasses_pendentes")}
                        className="text-[9px] text-slate-455 font-black uppercase tracking-wider block mx-auto pt-2 hover:underline"
                      >
                        Reabrir Repasses
                      </button>
                    </div>
                  ) : (
                    /* General rollback to calculated state */
                    <button
                      onClick={() => handleUpdateStatusFinanceiro("calculada")}
                      className="w-full py-2 bg-slate-105 hover:bg-slate-205 border border-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Resetar para Calculada
                    </button>
                  )}
                </div>
              </div>

              {/* History payments log to team */}
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-[30px] space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">Histórico de Repasses</h3>
                </div>

                {!selectedRental.legacyDoc.pagamentosCorretores || selectedRental.legacyDoc.pagamentosCorretores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-12">Nenhum repasse ou pagamento registrado para a equipe.</p>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {selectedRental.legacyDoc.pagamentosCorretores.map((pay, pIdx) => {
                      const participant = selectedRental.distribuicao.find(rt => rt.corretorId === pay.corretorId);
                      const papelLabel = participant 
                        ? (participant.papel === "locacao" ? "Locador" : participant.papel === "captador" ? "Captador" : "Auxiliar")
                        : "";

                      return (
                        <div key={pIdx} className="space-y-3">
                          {pIdx > 0 && <div className="border-t border-slate-200/50 my-2" />}
                          <div className="bg-white p-3 border border-slate-100 rounded-2xl shadow-sm space-y-1.5 text-xs">
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-800 flex flex-col">
                                <span className="flex items-center gap-1.5 font-bold">
                                  <span className="text-emerald-500">✅</span>
                                  <span>{pay.corretorNome}</span>
                                </span>
                                {papelLabel && (
                                  <span className="text-[10px] text-slate-450 font-semibold mt-0.5 ml-5">{papelLabel}</span>
                                )}
                              </span>
                              <span className="text-emerald-600 font-black">{formatCurrency(pay.valor)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                              <span className="ml-5">{pay.tipo === "pagamento" ? "Repasse" : pay.tipo === "adiantamento" ? "Adiantamento" : "Desconto"}</span>
                              <span>{pay.data}</span>
                            </div>
                            {pay.observacao && (
                              <p className="text-[10px] text-slate-500 italic border-t border-slate-50 pt-1 leading-relaxed ml-5">
                                {pay.observacao}
                              </p>
                            )}
                            <p className="text-[8px] text-slate-400 text-right">Cadastrado por {pay.registradoPorNome}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "create" ? (
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
                      {team.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
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
                        {team.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
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

                {rateios.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold text-center italic py-6">Insira os corretores responsáveis nos respectivos campos acima.</p>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {computedRateios.map((rt, idx) => {
                      return (
                        <div key={`${rt.corretorId}-${rt.papel}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-xs select-none hover:bg-slate-50/50 transition-all">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800">{rt.corretorNome}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                rt.papel === "locador" || rt.papel === "locacao" ? "bg-amber-100 border-amber-300 text-amber-600" : "bg-emerald-100 border-emerald-300 text-emerald-600"
                              }`}>
                                {rt.papel === "locador" || rt.papel === "locacao" ? "Locador" : "Captador"}
                              </span>
                              <span>•</span>
                              <span>{Number(rt.porcentagem).toFixed(2).replace(/\.00$/, "")}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 font-bold">
                            <span className="font-extrabold text-slate-850 font-mono">{formatCurrency(rt.valor)}</span>
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
      ) : activeTab === "dashboard" ? (
        /* RENTAL DASHBOARD SCREEN */
        <div className="space-y-6 animate-fade-in select-none">
          {/* Simple summary above the list */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 border border-slate-100 p-4 px-6 rounded-[24px]">
            <p className="text-xs font-semibold text-slate-500">
              {monthlyModels.length} {monthlyModels.length === 1 ? 'competência' : 'competências'} | <strong className="text-slate-700">{formatCurrency(monthlyModels.reduce((acc, r) => acc + (r.legacyDoc.valorFidelite || 0), 0))}</strong> em comissões
            </p>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">Visão Geral</span>
          </div>

          {/* 4 Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 — Comissões Primeiro Aluguel */}
            <div 
              onClick={() => handleCardClick("CARD1")}
              className={`p-5 rounded-2xl bg-blue-50/70 hover:bg-blue-50 border border-blue-200/80 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between ${
                activeCardFilter === "CARD1" ? "ring-2 ring-blue-500 ring-offset-1 border-blue-500 bg-blue-100/40" : ""
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider font-sans">
                  {activeCardFilter === "CARD1" ? "★ FILTRANDO" : "Primeiro Aluguel"}
                </span>
                <h4 className="text-xl font-extrabold text-slate-800 font-mono tracking-tight">{formatCurrency(card1Value)}</h4>
                <p className="text-[9px] font-semibold text-slate-400 font-sans">Total das comissões</p>
              </div>
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Home className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2 — Comissões Imobiliária */}
            <div 
              onClick={() => handleCardClick("CARD2")}
              className={`p-5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/80 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between ${
                activeCardFilter === "CARD2" ? "ring-2 ring-emerald-500 ring-offset-1 border-emerald-500 bg-emerald-100/40" : ""
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider font-sans">
                  {activeCardFilter === "CARD2" ? "★ FILTRANDO" : "Imobiliária"}
                </span>
                <h4 className="text-xl font-extrabold text-slate-800 font-mono tracking-tight">{formatCurrency(card2Value)}</h4>
                <p className="text-[9px] font-semibold text-slate-400 font-sans">Comissão retida</p>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3 — Comissões Corretores */}
            <div 
              onClick={() => handleCardClick("CARD3")}
              className={`p-5 rounded-2xl bg-purple-50/70 hover:bg-purple-50 border border-purple-200/80 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between ${
                activeCardFilter === "CARD3" ? "ring-2 ring-purple-500 ring-offset-1 border-purple-500 bg-purple-100/40" : ""
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider font-sans">
                  {activeCardFilter === "CARD3" ? "★ FILTRANDO" : "Corretores"}
                </span>
                <h4 className="text-xl font-extrabold text-slate-800 font-mono tracking-tight">{formatCurrency(card3Value)}</h4>
                <p className="text-[9px] font-semibold text-slate-400 font-sans">Comissão captadores</p>
              </div>
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4 — Repasses */}
            <div 
              onClick={() => handleCardClick("CARD4")}
              className={`p-5 rounded-2xl bg-orange-50/70 hover:bg-orange-50 border border-orange-200/80 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between ${
                activeCardFilter === "CARD4" ? "ring-2 ring-orange-500 ring-offset-1 border-orange-500 bg-orange-100/40" : ""
              }`}
            >
              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider font-sans">
                  {activeCardFilter === "CARD4" ? "★ FILTRANDO" : "Repasses"}
                </span>
                <div className="space-y-0.5 font-sans">
                  <p className="text-[11px] font-extrabold text-emerald-600 font-mono tracking-tight">
                    {formatCurrency(card4Data.pagos)} <span className="text-[9px] uppercase font-black text-slate-400">Pagos</span>
                  </p>
                  <p className="text-[11px] font-extrabold text-orange-600 font-mono tracking-tight">
                    {formatCurrency(card4Data.aPagar)} <span className="text-[9px] uppercase font-black text-slate-400">A pagar</span>
                  </p>
                </div>
                <p className="text-[9px] font-semibold text-slate-400 font-sans">Pagos / A pagar</p>
              </div>
              <div className="p-3 bg-orange-100 text-orange-600 rounded-xl shrink-0">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Quick List under dashboard */}
          <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[32px] shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center pb-4 border-b border-slate-100 gap-4">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Contratos de Locação Recentes</h3>
                <p className="text-[10px] text-slate-400 font-bold">Listando as competências de locação com base nos filtros selecionados</p>
              </div>
              <button 
                onClick={() => setActiveTab("list")}
                className="text-[11px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-all self-start lg:self-auto"
              >
                Ver Histórico Completo <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Filtered rental models rendering */}
            {monthlyModels.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10 border border-dashed border-slate-200 rounded-3xl">Nenhuma competência financeira cadastrada.</p>
            ) : currentFiltered.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10 border border-dashed border-slate-200 rounded-3xl">Nenhum contrato corresponde a este filtro de comissão.</p>
            ) : currentFiltered.filter(r => {
              if (!activeCardFilter) return true;
              if (activeCardFilter === "CARD1") return true;
              if (activeCardFilter === "CARD2") return (r.legacyDoc.porcentagemFidelite ?? 40) > 0;
              if (activeCardFilter === "CARD3") return (r.legacyDoc.rateio || []).some(item => item.papel === "captador");
              if (activeCardFilter === "CARD4") {
                return (r.distribuicao || []).some(d => (d.totalPago || 0) < (d.valor || 0));
              }
              return true;
            }).length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10 border border-dashed border-slate-200 rounded-3xl">Nenhum contrato corresponde ao card de destaque selecionado.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {currentFiltered
                  .filter(r => {
                    if (!activeCardFilter) return true;
                    if (activeCardFilter === "CARD1") return true;
                    if (activeCardFilter === "CARD2") return (r.legacyDoc.porcentagemFidelite ?? 40) > 0;
                    if (activeCardFilter === "CARD3") return (r.legacyDoc.rateio || []).some(item => item.papel === "captador");
                    if (activeCardFilter === "CARD4") {
                      return (r.distribuicao || []).some(d => (d.totalPago || 0) < (d.valor || 0));
                    }
                    return true;
                  })
                  .slice(0, 8)
                  .map((r, rIdx) => {
                    return (
                      <div 
                        key={r.id} 
                        onClick={() => setSelectedRentalId(r.id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50/50 border border-slate-100/80 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all duration-250 select-none shadow-sm gap-4"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 block">
                            {r.imovel} <span className="text-slate-400 font-normal">—</span> <span className="text-blue-600 font-bold">{r.competencia.label}</span>
                          </p>
                          <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">INQUILINO: {r.inquilino ? r.inquilino.toUpperCase() : "NÃO INFORMADO"}</span>
                          <span className="text-xs text-slate-400 block truncate">
                            {getDistributionSummaryString(r)}
                          </span>
                        </div>
                        <div className="flex items-center gap-5 justify-between sm:justify-end shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">ADMINISTRAÇÃO</span>
                            <span className="text-xs font-black text-slate-800 block">{formatCurrency(r.legacyDoc.valorFidelite)}</span>
                          </div>
                          <RentalStatusBadge status={r.statusFinanceiro} />
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* RENTAL LIST SCREEN */
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6 animate-fade-in select-none">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={filterText} 
                onChange={e => setFilterText(e.target.value)} 
                placeholder="Buscar por moradia, inquilino ou corretores..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-205 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
              />
            </div>
            
            <div className="flex gap-2 items-center font-sans">
              {["TUDO", "PENDENTE", "ATRASO", "PAGO"].map(st => {
                const isActive = filterStatus === st;
                let btnClass = "";
                if (isActive) {
                  if (st === "ATRASO") {
                    btnClass = "bg-red-600 text-white shadow-sm font-black";
                  } else {
                    btnClass = "bg-slate-900 text-white shadow-sm font-black";
                  }
                } else {
                  if (st === "ATRASO" && countAtraso > 0) {
                    btnClass = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-105";
                  } else {
                    btnClass = "bg-slate-50 text-slate-450 hover:text-slate-800 border border-slate-100";
                  }
                }

                let labelNode: React.ReactNode = "";
                if (st === "TUDO") labelNode = "Todos";
                else if (st === "PENDENTE") labelNode = "Pendência";
                else if (st === "ATRASO") {
                  labelNode = (
                    <span className="flex items-center gap-1.5">
                      Atrasados
                      {countAtraso > 0 && (
                        <span className={`px-1.5 py-0.5 text-[8px] rounded-full font-bold leading-none ${
                          isActive ? "bg-white text-red-600" : "bg-red-600 text-white animate-pulse"
                        }`}>
                          {countAtraso}
                        </span>
                      )}
                    </span>
                  );
                }
                else if (st === "PAGO") labelNode = "Encerrados";

                return (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center gap-1 leading-none ${btnClass}`}
                  >
                    {labelNode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Restructured principal list representation */}
          {filteredRentals.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-20 italic border border-dashed border-slate-150 rounded-3xl">Nenhuma competência correspondente encontrada.</p>
          ) : (
            <div className="space-y-4">
              {filteredRentals.map((r, idx) => {
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRentalId(r.id)}
                    className="p-5 bg-white border border-slate-100 hover:border-slate-300 rounded-[24px] shadow-sm select-none hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5 flex-wrap pb-0.5">
                        <span>{r.imovel}</span>
                        <span className="text-slate-350 font-semibold">—</span>
                        <span className="text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-[9px] tracking-wide">{r.competencia.label}</span>
                      </h4>
                      <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block leading-tight">INQUILINO: {r.inquilino ? r.inquilino.toUpperCase() : "NÃO INFORMADO"}</span>
                      <span className="text-xs text-slate-400 block truncate pb-1">
                        {getDistributionSummaryString(r)}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-455 font-bold pt-1 border-t border-slate-100/60">
                        <span>Primeiro Aluguel: <strong className="text-slate-700">{formatCurrency(r.legacyDoc.primeiroAluguel || r.valorAluguel || 0)}</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>Comissão Total: <strong className="text-indigo-650">{formatCurrency(r.legacyDoc.valorFidelite || 0)}</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>Distribuído até agora: <strong className="text-emerald-600">{formatCurrency(r.repasses.reduce((acc, curr) => acc + (curr.tipo === "desconto" ? -curr.valor : curr.valor), 0))}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <RentalStatusBadge status={r.statusFinanceiro} />

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedRentalId(r.id)}
                          className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                          Gerenciar
                        </button>
                        <button
                          onClick={() => {
                            setConfirmState({
                              open: true,
                              title: "Apagar Registro de Locação",
                              message: "Tem certeza que deseja desvincular e excluir esta competência financeira de locação? Esta operação apagará os históricos de pagamentos a corretores.",
                              confirmColor: "red",
                              onConfirm: () => {
                                setConfirmState(prev => ({ ...prev, open: false }));
                                onDeleteRental(r.id);
                              }
                            });
                          }}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE REGISTRO REPASSE CORRETOR */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsPayModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 space-y-6 animate-scale-up select-none text-left">
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest border-b border-light pb-2 flex items-center gap-1.5">
              <span>💸</span> Registrar Repasse Financeiro
            </h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Corretor Contemplado</span>
                <p className="text-xs font-bold text-slate-700 font-sans mt-0.5">{payBrokerName} ({payBrokerRole})</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Devido</span>
                  <p className="text-xs font-black text-slate-800">{formatCurrency(payBrokerTotalDue)}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Já Pago</span>
                  <p className="text-xs font-black text-emerald-600">{formatCurrency(payBrokerAlreadyPaid)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor do Repasse (R$)</label>
                  <input 
                    type="number" 
                    value={payValue || ""} 
                    onChange={e => setPayValue(Number(e.target.value))} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-550/30"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data do Pagamento</label>
                  <input 
                    type="date" 
                    value={payDate} 
                    onChange={e => setPayDate(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-550/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Modalidade do Fluxo</label>
                <select
                  value={payType}
                  onChange={e => setPayType(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="pagamento">Pagamento de Repasse</option>
                  <option value="adiantamento">Adiantamento de Rateio</option>
                  <option value="desconto_adiantamento">Desconto de Adiantamento</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Anotações (Comprovante / Chave Pix / etc)</label>
                <input 
                  type="text" 
                  value={payNotes} 
                  onChange={e => setPayNotes(e.target.value)} 
                  placeholder="Ex: Identificação comprovante PIX Banco do Brasil" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2"
                />
              </div>
            </div>
 
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-550 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSavePayment}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-md shadow-emerald-500/10 transition-all font-bold"
              >
                Confirmar Repasse
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
