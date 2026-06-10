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
  Download, 
  FileText, 
  Check, 
  Layers, 
  Briefcase,
  Pencil
} from "lucide-react";
import { Comissao, RateioComissao, PagamentoCorretor, ComissoneUser, UserProfile } from "../../types";
import { ConfirmModal } from "../ui/ConfirmModal";

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
  
  const [selectedRental, setSelectedRental] = useState<Comissao | null>(null);
  const [editingRental, setEditingRental] = useState<Comissao | null>(null);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("TUDO");
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("TODOS");

  const uniqueMonths = useMemo(() => {
    const list = rentals
      .map(r => r.mesReferencia)
      .filter((v, i, self) => v && self.indexOf(v) === i);
    return list.sort((a, b) => b.localeCompare(a));
  }, [rentals]);

  const monthlyRentals = useMemo(() => {
    if (selectedMonthFilter === "TODOS") return rentals;
    return rentals.filter(r => r.mesReferencia === selectedMonthFilter);
  }, [rentals, selectedMonthFilter]);

  // FORM STATES
  const [imovel, setImovel] = useState(initialData?.imovel || "");
  const [inquilino, setInquilino] = useState(initialData?.inquilino || "");
  const [aluguelMensal, setAluguelMensal] = useState(initialData?.aluguelMensal || 0);
  const [primeiroAluguel, setPrimeiroAluguel] = useState(initialData?.aluguelMensal || 0);
  const [porcentagemFidelite, setPorcentagemFidelite] = useState(editingRental?.porcentagemFidelite ?? 40);
  const [porcentagemRepasse, setPorcentagemRepasse] = useState(100 - (editingRental?.porcentagemFidelite ?? 40)); // 40% Fidelité retention, 60% repasse standard
  const [vencimento, setVencimento] = useState("");
  const [mesReferencia, setMesReferencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [observacoes, setObservacoes] = useState("");
  const [rateios, setRateios] = useState<RateioComissao[]>([]);

  const handleFideliteChange = (val: number) => {
    setPorcentagemFidelite(val);
    setPorcentagemRepasse(Math.max(0, 100 - val));
  };

  const handleRepasseChange = (val: number) => {
    setPorcentagemRepasse(val);
    setPorcentagemFidelite(Math.max(0, 100 - val));
  };

  // Add broker to rateio form
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [brokerRole, setBrokerRole] = useState<"captador" | "locacao" | "auxiliar" | "locador">("locacao");
  const [brokerPercent, setBrokerPercent] = useState<number>(100);
  const [brokerValue, setBrokerValue] = useState<number>(0);

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
    setPorcentagemRepasse(60);
    setVencimento("");
    setObservacoes("");
    setRateios([]);
    setSelectedBrokerId("");
    setBrokerRole("locacao");
    setBrokerPercent(100);
    setBrokerValue(0);
    setEditingRental(null);
    if (onClearInitialData) onClearInitialData();
  };

  useMemo(() => {
    if (initialData?.imovel) {
      setImovel(initialData.imovel || "");
      setInquilino(initialData.inquilino || "");
      setAluguelMensal(initialData.aluguelMensal || 0);
      setPrimeiroAluguel(initialData.aluguelMensal || 0);
      setActiveTab("create");
    }
  }, [initialData]);

  // DERIVED VALUES FROM FORM
  const valorFidelite = useMemo(() => {
    return Math.round((primeiroAluguel * porcentagemFidelite) / 100);
  }, [primeiroAluguel, porcentagemFidelite]);

  const valorRepasseCorretores = useMemo(() => {
    return primeiroAluguel - valorFidelite;
  }, [primeiroAluguel, valorFidelite]);

  // Sync value when pool total (valorRepasseCorretores) or percent changes
  React.useEffect(() => {
    setBrokerValue(Number(((valorRepasseCorretores * brokerPercent) / 100).toFixed(2)));
  }, [valorRepasseCorretores, brokerPercent]);

  const handleBrokerPercentChange = (pct: number) => {
    setBrokerPercent(pct);
    setBrokerValue(Number(((valorRepasseCorretores * pct) / 100).toFixed(2)));
  };

  const handleBrokerValueChange = (val: number) => {
    setBrokerValue(val);
    if (valorRepasseCorretores > 0) {
      setBrokerPercent(Number(((val * 100) / valorRepasseCorretores).toFixed(2)));
    } else {
      setBrokerPercent(0);
    }
  };

  // STATS
  const stats = useMemo(() => {
    let faturamentoFidelite = 0;
    let repassadoCorretores = 0;
    let pendenteRepasse = 0;
    let pagosTotal = 0;
    let pendentesTotal = 0;

    monthlyRentals.forEach(r => {
      const fidelidadeVal = r.valorFidelite || 0;
      faturamentoFidelite += fidelidadeVal;
      
      const rateioTotal = r.valorRepasseCorretores || 0;
      let pagoDesteRateio = 0;
      r.pagamentosCorretores?.forEach(p => {
        if (p.tipo === "pagamento" || p.tipo === "adiantamento") {
          pagoDesteRateio += p.valor;
        } else if (p.tipo === "desconto_adiantamento") {
          pagoDesteRateio -= p.valor;
        }
      });

      repassadoCorretores += pagoDesteRateio;
      pendenteRepasse += Math.max(0, rateioTotal - pagoDesteRateio);

      if (r.status === "pago") {
        pagosTotal++;
      } else {
        pendentesTotal++;
      }
    });

    const totalRetidoImobiliaria = faturamentoFidelite - repassadoCorretores;

    return {
      faturamentoFidelite,
      repassadoCorretores,
      pendenteRepasse,
      totalRetidoImobiliaria,
      pagosTotal,
      pendentesTotal
    };
  }, [monthlyRentals]);

  const countAtraso = useMemo(() => {
    return monthlyRentals.filter(r => r.status === "atraso").length;
  }, [monthlyRentals]);

  // FILTERED RENTALS
  const filteredRentals = useMemo(() => {
    return monthlyRentals.filter(r => {
      const searchLower = filterText.toLowerCase();
      const matchText = 
        (r.imovel || "").toLowerCase().includes(searchLower) || 
        (r.inquilino || "").toLowerCase().includes(searchLower) ||
        (r.rateio || []).some(rt => (rt.corretorNome || "").toLowerCase().includes(searchLower));

      if (filterStatus === "TUDO") return matchText;
      return matchText && r.status === filterStatus.toLowerCase();
    });
  }, [monthlyRentals, filterText, filterStatus]);

  // ACTIONS
  const handleAddBrokerToRateio = () => {
    const brokerObj = team.find(t => t.id === selectedBrokerId);
    if (!brokerObj) return;

    if (rateios.some(rt => rt.corretorId === selectedBrokerId)) {
      alert("Este corretor já foi adicionado.");
      return;
    }

    const val = Math.round(brokerValue) || Math.round((valorRepasseCorretores * brokerPercent) / 100);
    const newRateio: RateioComissao = {
      corretorId: selectedBrokerId,
      corretorNome: brokerObj.name,
      papel: brokerRole,
      porcentagem: brokerPercent,
      valor: val
    };

    setRateios([...rateios, newRateio]);
    setSelectedBrokerId("");
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

    const totalRateioPercent = rateios.reduce((acc, r) => acc + (r.porcentagem || 0), 0);
    if (rateios.length > 0 && Math.abs(totalRateioPercent - 100) > 0.1) {
      alert(`As porcentagens dos corretores somam ${totalRateioPercent}%. Devem somar exatamente 100%.`);
      return;
    }

    const updatedRateiosWithRecalculatedValues = rateios.map(r => ({
      ...r,
      valor: Math.round((valorRepasseCorretores * (r.porcentagem || 0)) / 100)
    }));

    if (editingRental) {
      const updatedRec: Comissao = {
        ...editingRental,
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

  const handleOpenPayModal = (rt: RateioComissao, currentRental: Comissao) => {
    // Calcular quanto já foi pago para este corretor
    const totalPago = currentRental.pagamentosCorretores
      ?.filter(p => p.corretorId === rt.corretorId)
      ?.reduce((acc, curr) => {
        if (curr.tipo === "pagamento" || curr.tipo === "adiantamento") return acc + curr.valor;
        return acc - curr.valor;
      }, 0) || 0;

    const saldoDevido = Math.max(0, rt.valor - totalPago);

    setPayBrokerId(rt.corretorId);
    setPayBrokerName(rt.corretorNome);
    setPayValue(saldoDevido);
    setPayNotes("");
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

    const nextPayments = [...(selectedRental.pagamentosCorretores || []), newPayment];

    // Verificar se todos os corretores já receberam seu valor total de rateio
    let checksAllPaid = true;
    selectedRental.rateio.forEach(rt => {
      const brokerPago = nextPayments
        ?.filter(p => p.corretorId === rt.corretorId)
        ?.reduce((acc, curr) => {
          if (curr.tipo === "pagamento" || curr.tipo === "adiantamento") return acc + curr.valor;
          return acc - curr.valor;
        }, 0) || 0;
      if (brokerPago < rt.valor) {
        checksAllPaid = false;
      }
    });

    const updatedRental: Comissao = {
      ...selectedRental,
      pagamentosCorretores: nextPayments,
      jaPagoCorretores: checksAllPaid,
      // Se todos os corretores estão pagos e a fidelidade foi paga, podemos marcar opcionalmente status como pago geral
      status: checksAllPaid ? "pago" : selectedRental.status,
      updatedAt: new Date().toISOString()
    };

    onUpdateRental(updatedRental);
    setSelectedRental(updatedRental);
    setIsPayModalOpen(false);
  };

  const handleToggleRentalStatus = (r: Comissao) => {
    const nextStatus = r.status === "pago" ? "pendente" : "pago";
    onUpdateRental({
      ...r,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });
    if (selectedRental?.id === r.id) {
      setSelectedRental({ ...selectedRental, status: nextStatus });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Menu local */}
      {!selectedRental && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-slate-50 p-1 rounded-2xl w-fit border border-slate-100 shadow-sm">
            <button 
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                activeTab === "dashboard" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-450 hover:text-slate-700"
              }`}
            >
              Dashboard Locações
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("list")}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                activeTab === "list" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-450 hover:text-slate-700"
              }`}
            >
              Locações e Repasses
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("create")}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                activeTab === "create" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-450 hover:text-slate-700"
              }`}
            >
              Nova Comissão de Locação
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês Referência:</span>
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
        <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl space-y-8 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-6 shrink-0">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setSelectedRental(null); setEditingRental(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <button 
                type="button"
                onClick={() => {
                  setEditingRental(selectedRental);
                  setImovel(selectedRental.imovel || "");
                  setInquilino(selectedRental.inquilino || "");
                  setAluguelMensal(selectedRental.aluguelMensal || 0);
                  setPrimeiroAluguel(selectedRental.primeiroAluguel || selectedRental.aluguelMensal || 0);
                  setPorcentagemFidelite(selectedRental.porcentagemFidelite ?? 40);
                  setPorcentagemRepasse(100 - (selectedRental.porcentagemFidelite ?? 40));
                  
                  setVencimento(selectedRental.vencimento || "");
                  setMesReferencia(selectedRental.mesReferencia || "");
                  setObservacoes(selectedRental.observacoes || "");
                  setRateios(selectedRental.rateio || []);
                  
                  setSelectedRental(null);
                  setActiveTab("create");
                }}
                className="px-4 py-2 border border-blue-500 text-blue-600 hover:bg-blue-50 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar Comissão
              </button>
            </div>
            <div className="text-right">
              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl leading-none ${
                selectedRental.status === "pago" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600 animate-pulse"
              }`}>
                Comissão {selectedRental.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* General Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4">
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest border-b border-slate-200 pb-2">Informações da Locação</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imóvel</span>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed">{selectedRental.imovel}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inquilino</span>
                    <p className="text-xs font-bold text-slate-800">{selectedRental.inquilino}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 pt-2">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aluguel Nominal</span>
                    <p className="text-xs font-bold text-slate-800">{formatCurrency(selectedRental.aluguelMensal)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">1º Aluguel</span>
                    <p className="text-xs font-bold text-slate-800">{formatCurrency(selectedRental.primeiroAluguel)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fidelidade %</span>
                    <p className="text-xs font-bold text-slate-800">{selectedRental.porcentagemFidelite}%</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Crédito Fidelidade</span>
                    <p className="text-xs font-bold text-emerald-600">{formatCurrency(selectedRental.valorFidelite)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimento</span>
                    <p className="text-xs font-bold text-slate-800">{selectedRental.vencimento}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mês de Referência</span>
                    <p className="text-xs font-bold text-blue-600">{formatMesReferencia(selectedRental.mesReferencia)}</p>
                  </div>
                </div>
                {selectedRental.observacoes && (
                  <div className="pt-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notas</span>
                    <p className="text-xs text-slate-600 italic leading-relaxed">{selectedRental.observacoes}</p>
                  </div>
                )}
              </div>

              {/* Splits List */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl space-y-4 shadow-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Rateio e Divisão entre Corretores</h3>
                  <span className="text-[10px] font-bold text-slate-400">Total a repassar: <strong>{formatCurrency(selectedRental.valorRepasseCorretores)}</strong></span>
                </div>
                
                {selectedRental.rateio.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sem corretores associados a esta divisão.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {selectedRental.rateio.map((rt, idx) => {
                      const totalPagoCorretor = selectedRental.pagamentosCorretores
                        ?.filter(p => p.corretorId === rt.corretorId)
                        ?.reduce((sum, current) => {
                          if (current.tipo === 'pagamento' || current.tipo === 'adiantamento') return sum + current.valor;
                          return sum - current.valor;
                        }, 0) || 0;

                      const saldoRestante = Math.max(0, rt.valor - totalPagoCorretor);
                      const isBrokerFullyPaid = totalPagoCorretor >= rt.valor;

                      return (
                        <div key={idx} className="flex items-center justify-between py-4 select-none">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                              {rt.corretorNome.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{rt.corretorNome}</p>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {rt.papel === "locacao" ? "Locator" : rt.papel === "captador" ? "Captador" : "Auxiliar"} • {rt.porcentagem}% do split
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Devido</span>
                              <span className="text-xs font-bold text-slate-800">{formatCurrency(rt.valor)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Pago</span>
                              <span className={`text-xs font-bold ${isBrokerFullyPaid ? "text-emerald-600" : "text-amber-600"}`}>
                                {formatCurrency(totalPagoCorretor)}
                              </span>
                            </div>
                            <div className="w-28">
                              {isBrokerFullyPaid ? (
                                <span className="text-[8px] bg-emerald-50 text-emerald-600 font-black tracking-widest uppercase px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1.5 justify-center">
                                  <Check className="w-3 h-3" /> Concluído
                                </span>
                              ) : (
                                <button 
                                  onClick={() => handleOpenPayModal(rt, selectedRental)}
                                  className="w-full py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all"
                                >
                                  Pagar Saldo ({formatCurrency(saldoRestante)})
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

            {/* Log de pagamentos */}
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-light pb-2">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest">Histórico de Repasses</h3>
                <button 
                  onClick={() => handleToggleRentalStatus(selectedRental)}
                  className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all ${
                    selectedRental.status === "pago"
                      ? "bg-slate-100 text-slate-600 border-slate-200"
                      : "bg-emerald-500 text-white border-transparent"
                  }`}
                >
                  {selectedRental.status === "pago" ? "Marcar Pendente" : "Marcar Pago Geral"}
                </button>
              </div>

              {!selectedRental.pagamentosCorretores || selectedRental.pagamentosCorretores.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-12">Nenhum pagamento registrado ainda para os corretores.</p>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {selectedRental.pagamentosCorretores.map((pay, pIdx) => {
                    return (
                      <div key={pIdx} className="bg-white p-3 border border-slate-100 rounded-2xl shadow-sm space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-800">{pay.corretorNome}</span>
                          <span className="text-emerald-600 font-extrabold">{formatCurrency(pay.valor)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                          <span>{pay.tipo === "pagamento" ? "Repasse" : pay.tipo === "adiantamento" ? "Adiantamento" : "Desconto"}</span>
                          <span>{pay.data}</span>
                        </div>
                        {pay.observacao && (
                          <p className="text-[10px] text-slate-500 italic border-t border-slate-50 pt-1 leading-relaxed">
                            {pay.observacao}
                          </p>
                        )}
                        <p className="text-[8px] text-slate-400 text-right">Por {pay.registradoPorNome}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "create" ? (
        /* RENTAL FORM SCREEN */
        <form onSubmit={handleSaveRental} className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl space-y-6 animate-fade-in">
          <div className="border-b border-slate-100 pb-4 shrink-0">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              {editingRental ? "Editar Comissão de Locação" : "Criação de Repasse de Locação"}
            </h2>
            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">
              {editingRental ? "Alterar dados de comissão e rateio de locação" : "Lançar repasse do primeiro aluguel de imóvel (Fidelidade/Taxa de Intermediação)"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco 1: Imóvel e Valores */}
            <div className="space-y-5 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b border-light pb-1">1. Contrato de Locação</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Endereço do Imóvel</label>
                  <input 
                    type="text" 
                    value={imovel} 
                    onChange={e => setImovel(e.target.value)} 
                    placeholder="Ex: Rua dos Bobos, 0" 
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
                    placeholder="Ex: Pedro de Alcântara" 
                    required 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
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
                      placeholder="3000" 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mês Referência (Competência)</label>
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
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primeiro aluguel (R$)</label>
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
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">% de Retenção da Fidelité</label>
                    <input 
                      type="number" 
                      value={porcentagemFidelite || 0} 
                      onChange={e => handleFideliteChange(Number(e.target.value))} 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">% de Repasse aos Corretores (Pool)</label>
                    <input 
                      type="number" 
                      value={porcentagemRepasse || 0} 
                      onChange={e => handleRepasseChange(Number(e.target.value))} 
                      required 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
                    />
                  </div>
                </div>

                {/* Box de Resumo Financeiro Visual (Fundo Azul Claro) */}
                <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl text-xs space-y-2.5 shadow-sm">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-semibold">Valor do Aluguel:</span>
                    <span className="font-bold text-slate-800 font-mono">{formatCurrency(primeiroAluguel)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Retenção Fidelité ({porcentagemFidelite}%):</span>
                    <span className="font-bold text-red-600 font-mono">- {formatCurrency(valorFidelite)}</span>
                  </div>
                  <div className="border-t border-sky-200/50 pt-2 flex justify-between items-center text-emerald-600 font-bold">
                    <span>Pool Corretores ({porcentagemRepasse}%):</span>
                    <span className="font-extrabold text-emerald-600 font-mono">= {formatCurrency(valorRepasseCorretores)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Rateio entre Corretores */}
            <div className="space-y-5 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b border-light pb-1">2. Rateio do Pool</h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 border border-slate-100 rounded-2xl shadow-sm">
                  <div className="col-span-1 md:col-span-4">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Escolher Corretor</label>
                    <select
                      value={selectedBrokerId}
                      onChange={e => setSelectedBrokerId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    >
                      <option value="">Selecione...</option>
                      {team.map(b => {
                        const roleLabel = b.role === "ADMIN" ? "Admin" : b.role === "BROKER" ? "Corretor" : b.role === "MANAGER" ? "Gerente" : b.role;
                        return (
                          <option key={b.id} value={b.id}>{b.name} ({roleLabel})</option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Função</label>
                    <select
                      value={brokerRole}
                      onChange={e => setBrokerRole(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    >
                      <option value="locacao">Locador</option>
                      <option value="captador">Captador</option>
                      <option value="auxiliar">Auxiliar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Porcentagem (%)</label>
                    <input 
                      type="number" 
                      value={brokerPercent || ""} 
                      onChange={e => handleBrokerPercentChange(Number(e.target.value))} 
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor (R$)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={brokerValue || ""} 
                      onChange={e => handleBrokerValueChange(Number(e.target.value))} 
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddBrokerToRateio}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-500/15 font-bold"
                    >
                      Incluir
                    </button>
                  </div>
                </div>

                {/* Barra de progresso do Pool */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Progresso de Alocação</span>
                    {(() => {
                      const sumPercent = rateios.reduce((acc, r) => acc + (r.porcentagem || 0), 0);
                      let textColor = "text-amber-600";
                      if (sumPercent === 100) textColor = "text-emerald-600";
                      else if (sumPercent > 100) textColor = "text-red-600";
                      return (
                        <span className={`${textColor} font-extrabold`}>
                          {sumPercent}% / 100%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="w-full bg-slate-150 rounded-full h-2 overflow-hidden border border-slate-200/40">
                    {(() => {
                      const sumPercent = rateios.reduce((acc, r) => acc + (r.porcentagem || 0), 0);
                      let barColor = "bg-amber-500";
                      if (sumPercent === 100) barColor = "bg-emerald-500";
                      else if (sumPercent > 100) barColor = "bg-red-500";
                      return (
                        <div 
                          className={`h-full transition-all duration-350 ${barColor}`} 
                          style={{ width: `${Math.min(100, sumPercent)}%` }}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Grid rateios adicionados */}
                {rateios.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold text-center italic py-6">Adicione os corretores do rateio acima.</p>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {rateios.map((rt, idx) => {
                      const computedVal = Math.round((valorRepasseCorretores * (rt.porcentagem || 0)) / 100);
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-xs select-none hover:bg-slate-50/50 transition-all">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800">{rt.corretorNome}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              <span className="px-1.5 py-0.5 bg-slate-100/80 rounded text-[9px] text-slate-500 font-bold border border-slate-200/50">
                                {rt.papel === "locacao" ? "Locador" : rt.papel === "captador" ? "Captador" : "Auxiliar"}
                              </span>
                              <span>•</span>
                              <span>{rt.porcentagem}% do pool</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-extrabold text-slate-850 font-mono">{formatCurrency(computedVal)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBrokerFromRateio(rt.corretorId)}
                              className="p-1.5 text-danger hover:bg-danger-light rounded-full transition-all text-red-500 hover:bg-red-50"
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
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vencimento</label>
              <input 
                type="date" 
                value={vencimento} 
                onChange={e => setVencimento(e.target.value)} 
                required 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observações ou Metas</label>
              <input 
                type="text" 
                value={observacoes} 
                onChange={e => setObservacoes(e.target.value)} 
                placeholder="Ex e.g. contrato locação fechado via portal secundário" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button 
              type="button" 
              onClick={() => { 
                const wasEditing = !!editingRental;
                resetForm(); 
                setActiveTab(wasEditing ? "list" : "dashboard"); 
              }}
              className="px-6 py-3 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-lg shadow-emerald-500/15 font-bold"
            >
              {editingRental ? "Salvar Alterações" : "Salvar Comissão de Locação"}
            </button>
          </div>
        </form>
      ) : activeTab === "dashboard" ? (
        /* RENTAL DASHBOARD SCREEN */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Box 1 */}
            <div className="bg-white border border-slate-100 rounded-[30px] p-6 shadow-sm space-y-2 select-none relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 font-black uppercase text-[7px] text-slate-300">Receitas</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total retido pela imobiliária</h3>
                  <p className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                    {formatCurrency(stats.totalRetidoImobiliaria)}
                  </p>
                </div>
              </div>
            </div>

            {/* Box 2 */}
            <div className="bg-white border border-slate-100 rounded-[30px] p-6 shadow-sm space-y-2 select-none relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 font-black uppercase text-[7px] text-slate-300">Resíduos</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total repassado a corretores</h3>
                  <p className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                    {formatCurrency(stats.repassadoCorretores)}
                  </p>
                </div>
              </div>
            </div>

            {/* Box 3 */}
            <div className="bg-white border border-slate-100 rounded-[30px] p-6 shadow-sm space-y-2 select-none relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 font-black uppercase text-[7px] text-slate-300">Compromisso</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repasses pendentes</h3>
                  <p className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                    {formatCurrency(stats.pendenteRepasse)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick List under dashboard */}
          <div className="bg-white border border-slate-100 p-6 md:p-8 rounded-[32px] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Contratos de Locação Recentes ({monthlyRentals.length})</h3>
              <button 
                onClick={() => setActiveTab("list")}
                className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-all"
              >
                Ver Todos <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {monthlyRentals.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10 border border-dashed border-slate-200 rounded-2xl">Não há comissões de locação cadastradas.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {monthlyRentals.slice(0, 5).map((r, rIdx) => {
                  return (
                    <div 
                      key={rIdx} 
                      onClick={() => setSelectedRental(r)}
                      className="flex items-center justify-between py-4 hover:bg-slate-50/50 rounded-2xl px-4 -mx-4 cursor-pointer transition-all"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">{r.imovel}</p>
                        <span className="text-[10px] text-slate-450 uppercase font-black tracking-widest block">Inquilino: {r.inquilino}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">ADMINISTRAÇÃO</span>
                          <span className="text-xs font-black text-slate-800">{formatCurrency(r.valorFidelite)}</span>
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                          r.status === "pago" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        }`}>
                          {r.status}
                        </span>
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
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={filterText} 
                onChange={e => setFilterText(e.target.value)} 
                placeholder="Buscar por imóvel, inquilino ou corretor..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold transition-all"
              />
            </div>
            
            <div className="flex gap-2 items-center font-sans">
              {["TUDO", "PENDENTE", "ATRASO", "PAGO"].map(st => {
                const isActive = filterStatus === st;
                let btnClass = "";
                if (isActive) {
                  if (st === "ATRASO") {
                    btnClass = "bg-red-600 text-white shadow-sm";
                  } else {
                    btnClass = "bg-slate-900 text-white shadow-sm";
                  }
                } else {
                  if (st === "ATRASO" && countAtraso > 0) {
                    btnClass = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100";
                  } else {
                    btnClass = "bg-slate-50 text-slate-400 hover:text-slate-800 border border-slate-100";
                  }
                }

                let labelNode: React.ReactNode = "";
                if (st === "TUDO") labelNode = "Todos";
                else if (st === "PENDENTE") labelNode = "Pendente";
                else if (st === "ATRASO") {
                  labelNode = (
                    <span className="flex items-center gap-1">
                      Atrasadas
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
                else if (st === "PAGO") labelNode = "Pagas";

                return (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center gap-1 ${btnClass}`}
                  >
                    {labelNode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List Table */}
          {filteredRentals.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-20 italic">Nenhuma comissão de locação correspondente encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="pb-4 pl-4">Imóvel</th>
                    <th className="pb-4">Inquilino</th>
                    <th className="pb-4 text-right">Aluguel mensal</th>
                    <th className="pb-4 text-center">Mês de referência</th>
                    <th className="pb-4 text-center">Status</th>
                    <th className="pb-4 text-right pr-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {filteredRentals.map((r, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-50/40 cursor-pointer transition-colors" onClick={() => setSelectedRental(r)}>
                        <td className="py-4 pl-4">
                          <p className="font-bold text-slate-800 max-w-xs truncate">{r.imovel}</p>
                        </td>
                        <td className="py-4 font-semibold text-slate-700">
                          {r.inquilino}
                        </td>
                        <td className="py-4 text-right font-semibold text-slate-700">
                          {formatCurrency(r.aluguelMensal)}
                        </td>
                        <td className="py-4 text-center font-bold text-slate-500">
                          {formatMesReferencia(r.mesReferencia)}
                        </td>
                        <td className="py-4 text-center">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl leading-none ${
                            r.status === "pago" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600 animate-pulse"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-4 text-right pr-4" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setSelectedRental(r)}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                            >
                              Repasses
                            </button>
                            <button
                              onClick={() => {
                                setConfirmState({
                                  open: true,
                                  title: "Apagar comissão de locação",
                                  message: "Tem certeza que deseja apagar esta comissão de locação? Esta ação não pode ser desfeita.",
                                  confirmColor: "red",
                                  onConfirm: () => {
                                    setConfirmState(prev => ({ ...prev, open: false }));
                                    onDeleteRental(r.id);
                                  }
                                });
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-500 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE PAGAMENTO CORRETOR */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsPayModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 space-y-6 animate-scale-up">
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest border-b border-light pb-2">Registrar Repasse de Locação</h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Favorecido (Corretor)</span>
                <p className="text-xs font-bold text-slate-700">{payBrokerName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor (R$)</label>
                  <input 
                    type="number" 
                    value={payValue || ""} 
                    onChange={e => setPayValue(Number(e.target.value))} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data de Lançamento</label>
                  <input 
                    type="date" 
                    value={payDate} 
                    onChange={e => setPayDate(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo de Registro</label>
                <select
                  value={payType}
                  onChange={e => setPayType(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                >
                  <option value="pagamento">Pagamento Integral (Quitação)</option>
                  <option value="adiantamento">Adiantamento Parcial</option>
                  <option value="desconto_adiantamento">Desconto de Adiantamento</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observação (Opcional)</label>
                <input 
                  type="text" 
                  value={payNotes} 
                  onChange={e => setPayNotes(e.target.value)} 
                  placeholder="Ex: Transferido via PIX chave celular" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSavePayment}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-md"
              >
                Confirmar Lançamento
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
