import React, { useState, useMemo } from "react";
import { 
  Building2, 
  User, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  ExternalLink, 
  Calendar, 
  DollarSign, 
  Scale, 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  X, 
  Paperclip,
  Check,
  AlertCircle
} from "lucide-react";
import { Despejo, IndenizacaoCredPago } from "../types";
import { 
  useDespejos, 
  useCreateDespejoMutation, 
  useUpdateDespejoMutation, 
  useDeleteDespejoMutation 
} from "../hooks/useQueries";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ConfirmModal } from "./ui/ConfirmModal";

interface DespejoViewProps {
  isAdmin: boolean;
  user: any;
  profile: any;
  companySettings: any;
}

export const DespejoView = ({ isAdmin, user, companySettings }: DespejoViewProps) => {
  const companyId = companySettings?.id || user?.companyId || "default_agency";
  
  // Queries
  const { data: despejos = [], isLoading } = useDespejos(companyId);
  const createMutation = useCreateDespejoMutation();
  const updateMutation = useUpdateDespejoMutation();
  const deleteMutation = useDeleteDespejoMutation();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedDespejo, setSelectedDespejo] = useState<Despejo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form (Wizard) State
  const [wizardStep, setWizardStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields State
  const [locadorNome, setLocadorNome] = useState("");
  const [locadorNacionalidade, setLocadorNacionalidade] = useState("Brasileiro(a)");
  const [locadorEstadoCivil, setLocadorEstadoCivil] = useState("Casado(a)");
  const [locadorRG, setLocadorRG] = useState("");
  const [locadorCPF, setLocadorCPF] = useState("");
  const [locadorEmail, setLocadorEmail] = useState("");
  const [locadorEndereco, setLocadorEndereco] = useState("");

  const [imovelEndereco, setImovelEndereco] = useState("");
  const [imovelComarca, setImovelComarca] = useState("");
  const [imovelEstado, setImovelEstado] = useState("");

  const [inquilinoNome, setInquilinoNome] = useState("");
  const [inquilinoNacionalidade, setInquilinoNacionalidade] = useState("Brasileiro(a)");
  const [inquilinoEstadoCivil, setInquilinoEstadoCivil] = useState("Solteiro(a)");
  const [inquilinoRG, setInquilinoRG] = useState("");
  const [inquilinoCPF, setInquilinoCPF] = useState("");
  const [inquilinoEmail, setInquilinoEmail] = useState("");
  const [inquilinoEndereco, setInquilinoEndereco] = useState("");

  const [contratoDataInicio, setContratoDataInicio] = useState("");
  const [contratoDataTermino, setContratoDataTermino] = useState("");
  const [contratoValorMensal, setContratoValorMensal] = useState<number>(0);
  const [contratoDiaVencimento, setContratoDiaVencimento] = useState<number>(10);
  const [contratoIndiceReajuste, setContratoIndiceReajuste] = useState("IPCA");
  const [contratoEncargos, setContratoEncargos] = useState("Condomínio e IPTU");
  const [contratoInadimplenciaTotal, setContratoInadimplenciaTotal] = useState<number>(0);

  const [credPagoContratoNum, setCredPagoContratoNum] = useState("");
  const [credPagoIndenizacoes, setCredPagoIndenizacoes] = useState<IndenizacaoCredPago[]>([]);
  const [credPagoDataExoneracao, setCredPagoDataExoneracao] = useState("");
  const [credPagoDataNotificacao, setCredPagoDataNotificacao] = useState("");
  const [credPagoDataLimite, setCredPagoDataLimite] = useState("");

  // Subform for Indenizacoes CredPago
  const [tempIndenizacaoData, setTempIndenizacaoData] = useState("");
  const [tempIndenizacaoValor, setTempIndenizacaoValor] = useState<number>(0);

  const [advogadoNome, setAdvogadoNome] = useState("");
  const [advogadoOAB, setAdvogadoOAB] = useState("");
  const [processoNumero, setProcessoNumero] = useState("");
  const [portalTJLink, setPortalTJLink] = useState("");
  const [caucionado, setCaucionado] = useState(true);
  const [caucaoValor, setCaucaoValor] = useState<number>(0);

  const [anexoContratoUrl, setAnexoContratoUrl] = useState("");
  const [anexoExoneracaoUrl, setAnexoExoneracaoUrl] = useState("");
  const [anexoNotificacaoUrl, setAnexoNotificacaoUrl] = useState("");
  const [anexoInicialUrl, setAnexoInicialUrl] = useState("");
  
  const [statusVal, setStatusVal] = useState<Despejo["status"]>("NOTIFICADO");
  const [observacoes, setObservacoes] = useState("");

  // Helper date conversions
  const getDaysRemaining = (limitDateStr: string): number => {
    if (!limitDateStr) return 0;
    const limitDate = new Date(limitDateStr + "T23:59:59");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = limitDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const formatDate = (val: string) => {
    if (!val) return "-";
    const [year, month, day] = val.split("-");
    if (!year || !month || !day) return val;
    return `${day}/${month}/${year}`;
  };

  // Auto-calculated fields
  const handleNotificacaoDateChange = (val: string) => {
    setCredPagoDataNotificacao(val);
    if (val) {
      const d = new Date(val + "T12:00:00");
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 30);
        setCredPagoDataLimite(d.toISOString().split("T")[0]);
      } else {
        setCredPagoDataLimite("");
      }
    } else {
      setCredPagoDataLimite("");
    }
  };

  const handleAluguelChange = (val: number) => {
    setContratoValorMensal(val);
    setCaucaoValor(val * 3);
  };

  // Add temp indenizacao
  const handleAddIndenizacao = () => {
    if (!tempIndenizacaoData || tempIndenizacaoValor <= 0) {
      toast.error("Preencha data e valor da indenização");
      return;
    }
    const newIdx: IndenizacaoCredPago = {
      id: "ind-" + Math.random().toString(36).substring(2, 9),
      data: tempIndenizacaoData,
      valor: tempIndenizacaoValor
    };
    setCredPagoIndenizacoes([...credPagoIndenizacoes, newIdx]);
    setTempIndenizacaoData("");
    setTempIndenizacaoValor(0);
    toast.success("Indenização registrada na lista!");
  };

  const handleRemoveIndenizacao = (id: string) => {
    setCredPagoIndenizacoes(credPagoIndenizacoes.filter(x => x.id !== id));
  };

  // Open Wizard
  const handleOpenWizard = (despejoToEdit?: Despejo) => {
    if (despejoToEdit) {
      setEditingId(despejoToEdit.id);
      setLocadorNome(despejoToEdit.locadorNome || "");
      setLocadorNacionalidade(despejoToEdit.locadorNacionalidade || "Brasileiro(a)");
      setLocadorEstadoCivil(despejoToEdit.locadorEstadoCivil || "Casado(a)");
      setLocadorRG(despejoToEdit.locadorRG || "");
      setLocadorCPF(despejoToEdit.locadorCPF || "");
      setLocadorEmail(despejoToEdit.locadorEmail || "");
      setLocadorEndereco(despejoToEdit.locadorEndereco || "");

      setImovelEndereco(despejoToEdit.imovelEndereco || "");
      setImovelComarca(despejoToEdit.imovelComarca || "");
      setImovelEstado(despejoToEdit.imovelEstado || "");

      setInquilinoNome(despejoToEdit.inquilinoNome || "");
      setInquilinoNacionalidade(despejoToEdit.inquilinoNacionalidade || "Brasileiro(a)");
      setInquilinoEstadoCivil(despejoToEdit.inquilinoEstadoCivil || "Solteiro(a)");
      setInquilinoRG(despejoToEdit.inquilinoRG || "");
      setInquilinoCPF(despejoToEdit.inquilinoCPF || "");
      setInquilinoEmail(despejoToEdit.inquilinoEmail || "");
      setInquilinoEndereco(despejoToEdit.inquilinoEndereco || "");

      setContratoDataInicio(despejoToEdit.contratoDataInicio || "");
      setContratoDataTermino(despejoToEdit.contratoDataTermino || "");
      setContratoValorMensal(despejoToEdit.contratoValorMensal || 0);
      setContratoDiaVencimento(despejoToEdit.contratoDiaVencimento || 10);
      setContratoIndiceReajuste(despejoToEdit.contratoIndiceReajuste || "IPCA");
      setContratoEncargos(despejoToEdit.contratoEncargos || "");
      setContratoInadimplenciaTotal(despejoToEdit.contratoInadimplenciaTotal || 0);

      setCredPagoContratoNum(despejoToEdit.credPagoContratoNum || "");
      setCredPagoIndenizacoes(despejoToEdit.credPagoIndenizacoes || []);
      setCredPagoDataExoneracao(despejoToEdit.credPagoDataExoneracao || "");
      setCredPagoDataNotificacao(despejoToEdit.credPagoDataNotificacao || "");
      setCredPagoDataLimite(despejoToEdit.credPagoDataLimite || "");

      setAdvogadoNome(despejoToEdit.advogadoNome || "");
      setAdvogadoOAB(despejoToEdit.advogadoOAB || "");
      setProcessoNumero(despejoToEdit.processoNumero || "");
      setPortalTJLink(despejoToEdit.portalTJLink || "");
      setCaucionado(despejoToEdit.caucionado !== false);
      setCaucaoValor(despejoToEdit.caucaoValor || (despejoToEdit.contratoValorMensal * 3) || 0);

      setAnexoContratoUrl(despejoToEdit.anexoContratoUrl || "");
      setAnexoExoneracaoUrl(despejoToEdit.anexoExoneracaoUrl || "");
      setAnexoNotificacaoUrl(despejoToEdit.anexoNotificacaoUrl || "");
      setAnexoInicialUrl(despejoToEdit.anexoInicialUrl || "");
      
      setStatusVal(despejoToEdit.status || "NOTIFICADO");
      setObservacoes(despejoToEdit.observacoes || "");
    } else {
      setEditingId(null);
      setLocadorNome("");
      setLocadorNacionalidade("Brasileiro(a)");
      setLocadorEstadoCivil("Casado(a)");
      setLocadorRG("");
      setLocadorCPF("");
      setLocadorEmail("");
      setLocadorEndereco("");

      setImovelEndereco("");
      setImovelComarca("");
      setImovelEstado("");

      setInquilinoNome("");
      setInquilinoNacionalidade("Brasileiro(a)");
      setInquilinoEstadoCivil("Solteiro(a)");
      setInquilinoRG("");
      setInquilinoCPF("");
      setInquilinoEmail("");
      setInquilinoEndereco("");

      setContratoDataInicio("");
      setContratoDataTermino("");
      setContratoValorMensal(0);
      setContratoDiaVencimento(10);
      setContratoIndiceReajuste("IPCA");
      setContratoEncargos("Condomínio e IPTU");
      setContratoInadimplenciaTotal(0);

      setCredPagoContratoNum("");
      setCredPagoIndenizacoes([]);
      setCredPagoDataExoneracao("");
      setCredPagoDataNotificacao("");
      setCredPagoDataLimite("");

      setAdvogadoNome("");
      setAdvogadoOAB("");
      setProcessoNumero("");
      setPortalTJLink("");
      setCaucionado(true);
      setCaucaoValor(0);

      setAnexoContratoUrl("");
      setAnexoExoneracaoUrl("");
      setAnexoNotificacaoUrl("");
      setAnexoInicialUrl("");
      
      setStatusVal("NOTIFICADO");
      setObservacoes("");
    }
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const handleNextStep = () => {
    if (wizardStep === 1) {
      if (!locadorNome || !inquilinoNome || !imovelEndereco || !imovelComarca || !imovelEstado) {
        const missing = [];
        if (!locadorNome) missing.push("Nome do Locador");
        if (!inquilinoNome) missing.push("Nome do Inquilino");
        if (!imovelEndereco) missing.push("Endereço do Imóvel");
        if (!imovelComarca) missing.push("Comarca Judicial");
        if (!imovelEstado) missing.push("Estado (UF)");
        toast.error(`Por favor, preencha os campos obrigatórios da Etapa 1: ${missing.join(", ")}`);
        return;
      }
    } else if (wizardStep === 2) {
      if (!contratoValorMensal || contratoValorMensal <= 0) {
        toast.error("Por favor, preencha o Valor Aluguel Mensal com um valor válido maior que zero (*)");
        return;
      }
    } else if (wizardStep === 3) {
      if (!credPagoDataNotificacao) {
        toast.error("Por favor, preencha a Data de Notificação ao Inquilino (*)");
        return;
      }
    }
    setWizardStep(prev => Math.min(prev + 1, 4));
  };

  const handleSaveDespejo = async () => {
    // Validate required fields
    const missingFields: string[] = [];
    if (!locadorNome) missingFields.push("Nome do Locador (Etapa 1)");
    if (!inquilinoNome) missingFields.push("Nome do Inquilino (Etapa 1)");
    if (!imovelEndereco) missingFields.push("Endereço do Imóvel (Etapa 1)");
    if (!imovelComarca) missingFields.push("Comarca Judicial (Etapa 1)");
    if (!imovelEstado) missingFields.push("Estado do Imóvel (Etapa 1)");
    if (!contratoValorMensal || contratoValorMensal <= 0) missingFields.push("Valor do Aluguel Mensal (Etapa 2)");
    if (!credPagoDataNotificacao) missingFields.push("Data Notificação ao Inquilino (Etapa 3)");
    if (!advogadoNome) missingFields.push("Advogado Responsável (Etapa 4)");
    if (!advogadoOAB) missingFields.push("OAB da Inscrição (Etapa 4)");

    if (missingFields.length > 0) {
      toast.error(`Erro de Validação! Preencha os campos obrigatórios: ${missingFields.join(", ")}`);
      return;
    }

    const payload: Omit<Despejo, "id"> & { id?: string } = {
      id: editingId || undefined,
      companyId,
      status: statusVal,
      locadorNome,
      locadorNacionalidade,
      locadorEstadoCivil,
      locadorRG,
      locadorCPF,
      locadorEmail,
      locadorEndereco,
      imovelEndereco,
      imovelComarca,
      imovelEstado,
      inquilinoNome,
      inquilinoNacionalidade,
      inquilinoEstadoCivil,
      inquilinoRG,
      inquilinoCPF,
      inquilinoEmail,
      inquilinoEndereco,
      contratoDataInicio,
      contratoDataTermino,
      contratoValorMensal,
      contratoDiaVencimento,
      contratoIndiceReajuste,
      contratoEncargos,
      contratoInadimplenciaTotal,
      credPagoContratoNum,
      credPagoIndenizacoes,
      credPagoDataExoneracao,
      credPagoDataNotificacao,
      credPagoDataLimite,
      advogadoNome,
      advogadoOAB,
      processoNumero,
      portalTJLink,
      caucionado,
      caucaoValor,
      anexoContratoUrl,
      anexoExoneracaoUrl,
      anexoNotificacaoUrl,
      anexoInicialUrl,
      observacoes
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ ...payload, id: editingId } as Despejo);
        // Update selected if open
        if (selectedDespejo?.id === editingId) {
          setSelectedDespejo({ ...payload, id: editingId } as Despejo);
        }
      } else {
        await createMutation.mutateAsync(payload);
      }
      setIsWizardOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar caso de despejo:", error);
      toast.error(`Erro ao salvar caso de despejo: ${error?.message || error}`);
    }
  };

  const handleDeleteDespejo = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  // Calculations for stats
  const stats = useMemo(() => {
    let totalCount = 0;
    let urgentCount = 0;
    let liminaresCount = 0;
    let despejosCount = 0;

    despejos.forEach(d => {
      totalCount++;
      
      const isConcluido = d.status === "DESPEJO_REALIZADO";
      const remainingResult = getDaysRemaining(d.credPagoDataLimite);

      if (!isConcluido && remainingResult <= 5) {
        urgentCount++;
      }
      if (d.status === "LIMINAR_CONCEDIDA") {
        liminaresCount++;
      }
      if (d.status === "DESPEJO_REALIZADO") {
        despejosCount++;
      }
    });

    return { totalCount, urgentCount, liminaresCount, despejosCount };
  }, [despejos]);

  // Filtered List
  const filteredAndSearchedDespejos = useMemo(() => {
    return despejos.filter(d => {
      const matchesSearch = 
        d.locadorNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.inquilinoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.imovelEndereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.processoNumero && d.processoNumero.includes(searchTerm));

      if (!matchesSearch) return false;

      const remainingResult = getDaysRemaining(d.credPagoDataLimite);
      const isConcluido = d.status === "DESPEJO_REALIZADO";

      if (filterStatus === "TODOS") return true;
      if (filterStatus === "NOTIFICADO") return d.status === "NOTIFICADO";
      if (filterStatus === "PRAZO_VENCENDO") {
        return !isConcluido && remainingResult >= 0 && remainingResult < 5;
      }
      if (filterStatus === "AJUIZADO") return d.status === "AJUIZADO";
      if (filterStatus === "LIMINAR_CONCEDIDA") return d.status === "LIMINAR_CONCEDIDA";
      if (filterStatus === "DESPEJO_REALIZADO") return d.status === "DESPEJO_REALIZADO";

      return true;
    });
  }, [despejos, searchTerm, filterStatus]);

  // Step names dictionary
  const STEP_NAMES = [
    { key: "NOTIFICADO", label: "Notificado" },
    { key: "PRAZO_VENCIDO", label: "Prazo Vencido" },
    { key: "AJUIZADO", label: "Ajuizado" },
    { key: "LIMINAR_CONCEDIDA", label: "Liminar Concedida" },
    { key: "DESPEJO_REALIZADO", label: "Despejo Realizado" }
  ];

  // Fast inline stepper advance in Detail tab
  const handleAdvanceStatus = async (item: Despejo, newStatus: Despejo["status"]) => {
    const updated = { ...item, status: newStatus };
    await updateMutation.mutateAsync(updated);
    setSelectedDespejo(updated);
    toast.success(`Status atualizado para: ${STEP_NAMES.find(x => x.key === newStatus)?.label}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            Controle de Exoneração e Ações de Despejo
          </h2>
          <p className="text-sm text-slate-400">
            Gerencie as notificações, prazos limites de garantia e trâmites judiciais de despejos assistidos pela CredPago.
          </p>
        </div>
        <button
          onClick={() => handleOpenWizard()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm hover:shadow transition-all text-sm self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Processo de Despejo
        </button>
      </div>

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em Andamento */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Em Andamento</span>
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount - stats.despejosCount}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Prazos Vencendo em < 5 Dias */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden">
          {stats.urgentCount > 0 && (
            <div className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </div>
          )}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Prazos de Garantia &lt; 5d</span>
            <span className={`text-2xl font-extrabold ${stats.urgentCount > 0 ? "text-red-600" : "text-slate-800"}`}>
              {stats.urgentCount}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${stats.urgentCount > 0 ? "bg-red-50 border-red-100 text-red-600 animate-pulse" : "bg-slate-50 border-slate-100 text-slate-500"}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Liminares Concedidas */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Liminares Concedidas</span>
            <span className="text-2xl font-extrabold text-indigo-600">{stats.liminaresCount}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Despejos Realizados */}
        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Despejos Concluídos</span>
            <span className="text-2xl font-extrabold text-emerald-600">{stats.despejosCount}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Filters & Search Bar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Rapid Filters */}
        <div className="flex flex-wrap gap-1.5 self-start w-full md:w-auto">
          {["TODOS", "NOTIFICADO", "PRAZO_VENCENDO", "AJUIZADO", "LIMINAR_CONCEDIDA", "DESPEJO_REALIZADO"].map(st => {
            const label = st === "TODOS" ? "Todos" : 
                          st === "NOTIFICADO" ? "Notificados" : 
                          st === "PRAZO_VENCENDO" ? "Prazos Vencendo" : 
                          st === "AJUIZADO" ? "Ajuizados" : 
                          st === "LIMINAR_CONCEDIDA" ? "Liminares" : "Despejados";
            const isActive = filterStatus === st;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? "bg-slate-800 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-900 bg-slate-100/60 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Pesquisar imóvel, inquilino ou processo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Table & Details Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Main List */}
        <div className="xl:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Lista de Casos</h3>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest bg-slate-100 px-2 py-1 rounded-md">
              {filteredAndSearchedDespejos.length} {filteredAndSearchedDespejos.length === 1 ? "registro" : "registros"}
            </span>
          </div>

          {isLoading ? (
            <div className="m-12 text-center text-slate-400 text-xs">Carregando ações de despejo...</div>
          ) : filteredAndSearchedDespejos.length === 0 ? (
            <div className="m-12 text-center text-slate-500 text-xs py-8 flex flex-col items-center justify-center gap-2">
              <Building2 className="w-8 h-8 text-slate-300" />
              Nenhuma ação de despejo encontrada com os filtros e busca selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                    <th className="p-4">Cód / Imóvel</th>
                    <th className="p-4">Inquilino</th>
                    <th className="p-4">Prazo Gar.</th>
                    <th className="p-4">Status / Evolução</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSearchedDespejos.map(item => {
                    const diffDays = getDaysRemaining(item.credPagoDataLimite);
                    const isConcluido = item.status === "DESPEJO_REALIZADO";
                    const isUrgent = !isConcluido && diffDays <= 5;

                    return (
                      <tr 
                        key={item.id}
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer text-xs ${selectedDespejo?.id === item.id ? "bg-indigo-50/20" : ""}`}
                        onClick={() => setSelectedDespejo(item)}
                      >
                        <td className="p-4 max-w-[200px]">
                          <div className="font-black text-slate-800 truncate block uppercase tracking-tight">{item.imovelComarca || "Geral"}</div>
                          <div className="text-slate-400 text-[10px] truncate block font-medium">{item.imovelEndereco}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-black text-slate-800 uppercase block">{item.inquilinoNome}</div>
                          <div className="text-[10px] text-slate-400 block">CredPago: {item.credPagoContratoNum || "-"}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-black text-slate-800">{formatDate(item.credPagoDataLimite)}</div>
                          {!isConcluido ? (
                            <div className={`text-[10px] font-extrabold ${isUrgent ? "text-red-600 animate-pulse" : diffDays <= 12 ? "text-orange-500" : "text-slate-400"}`}>
                              {diffDays < 0 ? `Vencido há ${Math.abs(diffDays)} dias` : `${diffDays} dias restantes`}
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Resolvido
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            item.status === "NOTIFICADO" ? "bg-blue-50 border border-blue-100 text-blue-600" :
                            item.status === "PRAZO_VENCIDO" ? "bg-red-50 border border-red-100 text-red-600" :
                            item.status === "AJUIZADO" ? "bg-amber-50 border border-amber-100 text-amber-600" :
                            item.status === "LIMINAR_CONCEDIDA" ? "bg-indigo-50 border border-indigo-100 text-indigo-700" :
                            "bg-emerald-50 border border-emerald-100 text-emerald-600"
                          }`}>
                            {item.status === "NOTIFICADO" ? "Notificado" :
                             item.status === "PRAZO_VENCIDO" ? "Prazo Vencido" :
                             item.status === "AJUIZADO" ? "Ajuizado" :
                             item.status === "LIMINAR_CONCEDIDA" ? "Liminar Concedida" :
                             "Despejo Realizado"}
                          </span>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleOpenWizard(item)}
                              className="p-1 px-2 border border-slate-200 rounded-lg hover:border-slate-300 text-slate-600 hover:text-slate-800 bg-white shadow-sm font-semibold transition-all text-[10px] cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteDespejo(item.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Side Details Panel */}
        <div className="xl:col-span-1 bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Detalhes da Ação</h3>
            {selectedDespejo && (
              <button 
                onClick={() => handleAdvanceStatus(selectedDespejo, selectedDespejo.status)} 
                className="text-[10px] text-indigo-600 hover:underline font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                Atualizar Histórico
              </button>
            )}
          </div>

          {!selectedDespejo ? (
            <div className="text-center text-slate-400 text-xs py-12 flex flex-col items-center justify-center gap-1.5">
              <FileText className="w-6 h-6 text-slate-300" />
              Selecione um processo na tabela ao lado para ver os detalhes completos em 3 colunas, documentos anexados e realizar a progressão do stepper de forma interativa.
            </div>
          ) : (
            <div className="space-y-6">
              {/* STATUS STEPPER PROGRESSOR */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1.5">Evolução do Processo</span>
                
                {/* Visual horizontal/vertical hybrid stepper */}
                <div className="flex flex-col gap-2">
                  {STEP_NAMES.map((step, idx) => {
                    const isSelected = selectedDespejo.status === step.key;
                    const currentIndex = STEP_NAMES.findIndex(x => x.key === selectedDespejo.status);
                    const isCompleted = idx <= currentIndex;

                    return (
                      <button
                        key={step.key}
                        onClick={() => handleAdvanceStatus(selectedDespejo, step.key as Despejo["status"])}
                        className={`flex items-center gap-2.5 p-2 rounded-lg text-left text-xs font-semibold select-none border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-sm font-extrabold" 
                            : isCompleted 
                              ? "bg-indigo-50/60 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] shrink-0 font-extrabold ${
                          isSelected 
                            ? "bg-white text-indigo-700 border-white" 
                            : isCompleted 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="flex-1 truncate">{step.label}</span>
                        {isCompleted && !isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COUNTDOWN REMAINING FOR NEW GUARANTEE */}
              {selectedDespejo.status === "NOTIFICADO" && (
                <div className={`p-4 rounded-xl border border-dashed flex flex-col gap-1 items-center justify-center text-center ${
                  getDaysRemaining(selectedDespejo.credPagoDataLimite) <= 5 
                    ? "bg-red-50 border-red-200 text-red-700 animate-pulse" 
                    : "bg-orange-50 border-orange-200 text-orange-850"
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-wider">Apresentação de Nova Garantia</span>
                  <div className="text-xl font-black">
                    {getDaysRemaining(selectedDespejo.credPagoDataLimite) < 0 
                      ? "Prazo de 30 Dias Vencido!"
                      : `${getDaysRemaining(selectedDespejo.credPagoDataLimite)} dias restantes`
                    }
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    Limite: {formatDate(selectedDespejo.credPagoDataLimite)} (Notificação em {formatDate(selectedDespejo.credPagoDataNotificacao)})
                  </span>
                </div>
              )}

              {/* 3-COLUMN DETAIL STRUCTURE LAYOUTED IN THIS PANEL */}
              {/* Partes */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1">Partes Envolvidas</span>
                <div className="text-xs space-y-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Locador (Proprietário)</span>
                    <p className="font-extrabold text-slate-800 uppercase block">{selectedDespejo.locadorNome}</p>
                    <p className="text-[10px] text-slate-400 font-medium">CPF: {selectedDespejo.locadorCPF} · RG: {selectedDespejo.locadorRG}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{selectedDespejo.locadorEmail}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Inquilino (Requerido)</span>
                    <p className="font-extrabold text-slate-800 uppercase block">{selectedDespejo.inquilinoNome}</p>
                    <p className="text-[10px] text-slate-400 font-medium">CPF: {selectedDespejo.inquilinoCPF} · RG: {selectedDespejo.inquilinoRG}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{selectedDespejo.inquilinoEmail}</p>
                  </div>
                </div>
              </div>

              {/* Imóvel e Contrato */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1">Imóvel e Garantia</span>
                <div className="text-xs space-y-1.5">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Imóvel</span>
                    <span className="font-bold text-slate-800">{selectedDespejo.imovelEndereco}</span>
                    <div className="text-[10px] font-medium text-slate-450 uppercase">{selectedDespejo.imovelComarca} / {selectedDespejo.imovelEstado}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Valor Aluguel</span>
                      <strong className="text-slate-800">{formatCurrency(selectedDespejo.contratoValorMensal)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Inadimplência Histórica</span>
                      <strong className="text-red-600">{formatCurrency(selectedDespejo.contratoInadimplenciaTotal)}</strong>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-semibold">Fiança CredPago</span>
                    <div className="text-xs font-bold text-slate-800">Contrato CredPago nº {selectedDespejo.credPagoContratoNum || "NÃO INFORMADO"}</div>
                    
                    {/* Indenizacoes */}
                    {selectedDespejo.credPagoIndenizacoes?.length > 0 && (
                      <div className="p-2 border border-slate-150 bg-slate-50 rounded-lg text-[10px] space-y-1 max-h-32 overflow-y-auto">
                        <span className="font-black text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-200">Indenizações da Fiadora</span>
                        {selectedDespejo.credPagoIndenizacoes.map(ind => (
                          <div key={ind.id} className="flex justify-between font-medium">
                            <span>{formatDate(ind.data)}</span>
                            <span className="font-bold text-slate-700">{formatCurrency(ind.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dados Jurídicos e Documentos */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1">Trâmite Jurídico e Anexos</span>
                <div className="text-xs space-y-2">
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 block">Advogado Responsável</span>
                    <p className="font-extrabold text-slate-800 uppercase block">{selectedDespejo.advogadoNome} (OAB/{selectedDespejo.advogadoOAB})</p>
                    
                    {selectedDespejo.processoNumero && (
                      <p className="text-[10px] font-black text-slate-600 pt-0.5">Processo: {selectedDespejo.processoNumero}</p>
                    )}
                    
                    {selectedDespejo.portalTJLink && (
                      <a
                        href={selectedDespejo.portalTJLink}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5 pt-1"
                      >
                        Acessar Portal do TJ <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-medium text-slate-400 block">Caução do Despejo (Lei do Inquilinato)</span>
                    <p className="font-black text-slate-800">
                      {selectedDespejo.caucionado ? "Caucionado de " + formatCurrency(selectedDespejo.caucaoValor) : "Dispensa de Caução Solicitada"}
                    </p>
                    <p className="text-[9px] text-slate-450 leading-tight font-medium">
                      O valor legal equivale a 3 meses de aluguel (R$ {selectedDespejo.contratoValorMensal * 3}) para viabilizar liminar.
                    </p>
                  </div>

                  {/* Anexos */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Documentos Anexados</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {selectedDespejo.anexoContratoUrl ? (
                        <a 
                          href={selectedDespejo.anexoContratoUrl} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="flex items-center gap-1 p-1.5 border border-slate-200 hover:border-slate-300 rounded-lg bg-white font-semibold text-[9px] text-slate-600 truncate block"
                        >
                          <Paperclip className="w-3 h-3 text-indigo-500" /> Locação
                        </a>
                      ) : (
                        <div className="flex items-center gap-1 p-1.5 border border-slate-100 rounded-lg bg-slate-50 font-bold text-[9px] text-slate-400 truncate opacity-60">
                          Falta Contrato
                        </div>
                      )}

                      {selectedDespejo.anexoExoneracaoUrl ? (
                        <a 
                          href={selectedDespejo.anexoExoneracaoUrl} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="flex items-center gap-1 p-1.5 border border-slate-200 hover:border-slate-300 rounded-lg bg-white font-semibold text-[9px] text-slate-600 truncate block"
                        >
                          <Paperclip className="w-3 h-3 text-indigo-500" /> Exoneração
                        </a>
                      ) : (
                        <div className="flex items-center gap-1 p-1.5 border border-slate-100 rounded-lg bg-slate-50 font-bold text-[9px] text-slate-400 truncate opacity-60">
                          Falta Exoneração
                        </div>
                      )}

                      {selectedDespejo.anexoNotificacaoUrl ? (
                        <a 
                          href={selectedDespejo.anexoNotificacaoUrl} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="flex items-center gap-1 p-1.5 border border-slate-200 hover:border-slate-300 rounded-lg bg-white font-semibold text-[9px] text-slate-600 truncate block"
                        >
                          <Paperclip className="w-3 h-3 text-indigo-500" /> Notificação
                        </a>
                      ) : (
                        <div className="flex items-center gap-1 p-1.5 border border-slate-100 rounded-lg bg-slate-50 font-bold text-[9px] text-slate-400 truncate opacity-60">
                          Falta Notificação
                        </div>
                      )}

                      {selectedDespejo.anexoInicialUrl ? (
                        <a 
                          href={selectedDespejo.anexoInicialUrl} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="flex items-center gap-1 p-1.5 border border-slate-200 hover:border-slate-300 rounded-lg bg-white font-semibold text-[9px] text-slate-600 truncate block"
                        >
                          <Paperclip className="w-3 h-3 text-indigo-500" /> Petição Inicial
                        </a>
                      ) : (
                        <div className="flex items-center gap-1 p-1.5 border border-slate-100 rounded-lg bg-slate-50 font-bold text-[9px] text-slate-400 truncate opacity-60">
                          Falta Inicial
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedDespejo.observacoes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs text-slate-500">
                  <span className="font-bold text-slate-700 block mb-0.5">Observações Gerais</span>
                  {selectedDespejo.observacoes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WIZARD MODAL FORM */}
      <AnimatePresence>
        {isWizardOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-4xl border border-slate-150 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {editingId ? "Editar Processo de Despejo" : "Novo Processo de Despejo"} · CredPago
                  </h3>
                  <p className="text-[11px] text-slate-400">Ponto Chave de Exonerações e Vistorias Integradas</p>
                </div>
                <button
                  onClick={() => setIsWizardOpen(false)}
                  className="p-1 px-2 text-slate-400 hover:text-slate-600 font-bold border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              {/* Progress Indicator for Wizard Steps */}
              <div className="bg-white border-b border-slate-100/60 p-4 grid grid-cols-4 gap-2 text-center text-xs select-none">
                {[
                  { step: 1, label: "Partes & Qualificação" },
                  { step: 2, label: "Dados do Contrato" },
                  { step: 3, label: "Garantia CredPago" },
                  { step: 4, label: "Trâmite Jurídico" }
                ].map((item) => (
                  <div
                    key={item.step}
                    className={`pb-1 border-b-2 font-bold transition-all text-[11px] tracking-tight ${
                      wizardStep === item.step 
                        ? "border-indigo-650 text-indigo-700" 
                        : wizardStep > item.step 
                          ? "border-emerald-500 text-emerald-600" 
                          : "border-slate-100 text-slate-400"
                    }`}
                  >
                    Etapa {item.step} · {item.label}
                  </div>
                ))}
              </div>

              {/* Form Content Scrollable */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
                
                {/* STEP 1: QUALIFICAÇÃO DAS PARTES */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    {/* Locador */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-indigo-650 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-4 h-4" /> Locador / Proprietário
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1 md:col-span-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Nome Completo *</label>
                          <input
                            type="text"
                            value={locadorNome}
                            onChange={(e) => setLocadorNome(e.target.value)}
                            placeholder="Nome do Locador"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Nacionalidade</label>
                          <input
                            type="text"
                            value={locadorNacionalidade}
                            onChange={(e) => setLocadorNacionalidade(e.target.value)}
                            placeholder="Ex: Brasileiro(a)"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Estado Civil</label>
                          <input
                            type="text"
                            value={locadorEstadoCivil}
                            onChange={(e) => setLocadorEstadoCivil(e.target.value)}
                            placeholder="Ex: Casado(a)"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">RG</label>
                          <input
                            type="text"
                            value={locadorRG}
                            onChange={(e) => setLocadorRG(e.target.value)}
                            placeholder="Ex: 0.000.000-0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">CPF</label>
                          <input
                            type="text"
                            value={locadorCPF}
                            onChange={(e) => setLocadorCPF(e.target.value)}
                            placeholder="Ex: 000.000.000-00"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">E-mail</label>
                          <input
                            type="email"
                            value={locadorEmail}
                            onChange={(e) => setLocadorEmail(e.target.value)}
                            placeholder="email@locador.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Endereço Completo</label>
                          <input
                            type="text"
                            value={locadorEndereco}
                            onChange={(e) => setLocadorEndereco(e.target.value)}
                            placeholder="Av, Rua, Nº, CEP, Bairro, Cidade, UF"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Inquilino */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" /> Inquilino (Requerido)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Nome do Inquilino *</label>
                          <input
                            type="text"
                            value={inquilinoNome}
                            onChange={(e) => setInquilinoNome(e.target.value)}
                            placeholder="Nome Completo"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Nacionalidade</label>
                          <input
                            type="text"
                            value={inquilinoNacionalidade}
                            onChange={(e) => setInquilinoNacionalidade(e.target.value)}
                            placeholder="Ex: Brasileiro(a)"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Estado Civil</label>
                          <input
                            type="text"
                            value={inquilinoEstadoCivil}
                            onChange={(e) => setInquilinoEstadoCivil(e.target.value)}
                            placeholder="Ex: Solteiro(a)"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">RG</label>
                          <input
                            type="text"
                            value={inquilinoRG}
                            onChange={(e) => setInquilinoRG(e.target.value)}
                            placeholder="Ex: 0.000.000-0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">CPF</label>
                          <input
                            type="text"
                            value={inquilinoCPF}
                            onChange={(e) => setInquilinoCPF(e.target.value)}
                            placeholder="Ex: 000.000.000-00"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">E-mail</label>
                          <input
                            type="email"
                            value={inquilinoEmail}
                            onChange={(e) => setInquilinoEmail(e.target.value)}
                            placeholder="email@inquilino.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-3">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Endereço Completo</label>
                          <input
                            type="text"
                            value={inquilinoEndereco}
                            onChange={(e) => setInquilinoEndereco(e.target.value)}
                            placeholder="Endereço do imóvel com cep"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Imóvel */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-purple-600" /> Imóvel Objeto da Locação
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Endereço Completo do Imóvel *</label>
                          <input
                            type="text"
                            value={imovelEndereco}
                            onChange={(e) => setImovelEndereco(e.target.value)}
                            placeholder="Rua, Av, Número, CEP, Bairro"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Comarca Judicial *</label>
                          <input
                            type="text"
                            value={imovelComarca}
                            onChange={(e) => setImovelComarca(e.target.value)}
                            placeholder="Ex: Goiânia"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Estado (UF) *</label>
                          <input
                            type="text"
                            value={imovelEstado}
                            onChange={(e) => setImovelEstado(e.target.value)}
                            placeholder="Ex: GO"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: DADOS DO CONTRATO */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Data de Início do Contrato</label>
                        <input
                          type="date"
                          value={contratoDataInicio}
                          onChange={(e) => setContratoDataInicio(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Data de Término do Contrato</label>
                        <input
                          type="date"
                          value={contratoDataTermino}
                          onChange={(e) => setContratoDataTermino(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Valor Aluguel Mensal (R$) *</label>
                        <input
                          type="number"
                          value={contratoValorMensal || ""}
                          onChange={(e) => handleAluguelChange(Number(e.target.value))}
                          placeholder="0,00"
                          className="w-full bg-slate-55 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Dia de Vencimento</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={contratoDiaVencimento}
                          onChange={(e) => setContratoDiaVencimento(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Índice de Reajuste</label>
                        <input
                          type="text"
                          value={contratoIndiceReajuste}
                          onChange={(e) => setContratoIndiceReajuste(e.target.value)}
                          placeholder="Ex: IPCA, IGPM"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Encargos de Locação (IPTU, Condominio)</label>
                        <input
                          type="text"
                          value={contratoEncargos}
                          onChange={(e) => setContratoEncargos(e.target.value)}
                          placeholder="Ex: IPTU e Taxa de Condomínio"
                          className="w-full bg-slate-55 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 pt-3 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-red-650 block uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Inadimplência Histórica Acumulada (R$)
                      </label>
                      <input
                        type="number"
                        value={contratoInadimplenciaTotal || ""}
                        onChange={(e) => setContratoInadimplenciaTotal(Number(e.target.value))}
                        placeholder="Ex: 14500.00 (Valor total devido pelo inquilino até a exoneração)"
                        className="w-full md:w-1/3 bg-slate-55 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-red-600 focus:outline-none focus:border-red-400"
                      />
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Insira o valor nominal total inadimplido que fundamentou a comunicação e ativação da fiadora.
                      </span>
                    </div>
                  </div>
                )}

                {/* STEP 3: GARANTIA CRED PAGO */}
                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Número do Contrato CredPago</label>
                        <input
                          type="text"
                          value={credPagoContratoNum}
                          onChange={(e) => setCredPagoContratoNum(e.target.value)}
                          placeholder="Ex: CP-123456"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Data da Exoneração da Garantia</label>
                        <input
                          type="date"
                          value={credPagoDataExoneracao}
                          onChange={(e) => setCredPagoDataExoneracao(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Data Notificação ao Inquilino *</label>
                        <input
                          type="date"
                          value={credPagoDataNotificacao}
                          onChange={(e) => handleNotificacaoDateChange(e.target.value)}
                          className="w-full bg-slate-55 border border-slate-250 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                      <div className="flex gap-2 items-center">
                        <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Prazo Final para Nova Garantia</span>
                          <strong className="text-sm text-indigo-800">
                            {credPagoDataLimite ? formatDate(credPagoDataLimite) + " (30 dias após notificação)" : "Informe a data de notificação para calcular automaticamente"}
                          </strong>
                        </div>
                      </div>
                      {credPagoDataLimite && getDaysRemaining(credPagoDataLimite) <= 5 && (
                        <span className="bg-red-500 text-white font-extrabold uppercase text-[9px] px-2 py-1 rounded-lg tracking-wider animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> URGENTE
                        </span>
                      )}
                    </div>

                    {/* Dynamic List of Indenizações CredPago */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">Indenizações Realizadas pela CredPago</h4>
                      
                      <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl flex flex-col md:flex-row gap-3 items-end">
                        <div className="space-y-1 flex-1">
                          <label className="text-[9px] font-bold text-slate-450 block uppercase">Data da Indenização</label>
                          <input
                            type="date"
                            value={tempIndenizacaoData}
                            onChange={(e) => setTempIndenizacaoData(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1 flex-1">
                          <label className="text-[9px] font-bold text-slate-450 block uppercase">Valor Pago (R$)</label>
                          <input
                            type="number"
                            value={tempIndenizacaoValor || ""}
                            onChange={(e) => setTempIndenizacaoValor(Number(e.target.value))}
                            placeholder="0.00"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddIndenizacao}
                          className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                        >
                          Adicionar Indenização
                        </button>
                      </div>

                      {/* Indenizacoes List table */}
                      {credPagoIndenizacoes.length > 0 ? (
                        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                          <div className="p-2.5 bg-slate-100 border-b border-slate-150 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                            Lista de Indenizações
                          </div>
                          <div className="divide-y divide-slate-100 text-xs">
                            {credPagoIndenizacoes.map(item => (
                              <div key={item.id} className="flex justify-between items-center p-2.5 hover:bg-slate-50/50">
                                <span className="font-medium text-slate-700">Pago em {formatDate(item.data)}</span>
                                <div className="flex gap-3 items-center">
                                  <strong className="text-slate-800">{formatCurrency(item.valor)}</strong>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIndenizacao(item.id)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold block bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center">
                          Nenhuma indenização registrada nas coberturas da CredPago. Use o subformulário acima para inserir pagamentos recebidos.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 4: TRÂMITE JURÍDICO */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Advogado Responsável *</label>
                        <input
                          type="text"
                          value={advogadoNome}
                          onChange={(e) => setAdvogadoNome(e.target.value)}
                          placeholder="Ex: Dr. Fulano de Tal"
                          className="w-full bg-slate-55 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">OAB da Inscrição *</label>
                        <input
                          type="text"
                          value={advogadoOAB}
                          onChange={(e) => setAdvogadoOAB(e.target.value)}
                          placeholder="Ex: 12345/GO"
                          className="w-full bg-slate-55 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Número do Processo CNJ (PJe/Projudi)</label>
                        <input
                          type="text"
                          value={processoNumero}
                          onChange={(e) => setProcessoNumero(e.target.value)}
                          placeholder="Ex: 5000123-45.2026.8.09.0051"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block uppercase">Link do Portal do Tribunal (TJ comarca)</label>
                        <input
                          type="text"
                          value={portalTJLink}
                          onChange={(e) => setPortalTJLink(e.target.value)}
                          placeholder="Ex: https://pje.tjgo.jus.br/"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2.5">
                      <div className="flex items-center gap-1.5 select-none">
                        <input
                          type="checkbox"
                          id="caucionado_check"
                          checked={caucionado}
                          onChange={(e) => setCaucionado(e.target.checked)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="caucionado_check" className="text-xs font-black text-slate-800 uppercase tracking-tight cursor-pointer">
                          Prestar Caução Legal (Art. 59, §1º da Lei 8.245/91)
                        </label>
                      </div>

                      {caucionado ? (
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                          <span className="text-[10px] text-slate-450 uppercase tracking-widest font-bold">Valor da Caução Auto-calculado (3x Aluguel)</span>
                          <div className="text-base text-indigo-750 font-black">
                            {formatCurrency(caucaoValor || (contratoValorMensal * 3))}
                          </div>
                          <span className="text-[9px] text-slate-450 font-semibold block leading-tight">
                            Comprovada por guia judicial anexada aos autos para deferimento de liminar de desocupação em 15 dias.
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-red-50/40 border border-red-100 rounded-xl flex gap-1.5 items-start">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-[10px] text-red-850 font-medium">
                            <strong>Atenção:</strong> Dispensa de caução solicitada em juízo com base no Artigo 300 do CPC (Tutela de Urgência em razão do débito expressivo que supera o montante caucionário). Sujeito à homologação judicial do magistrado.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Files - URLs upload links */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-black text-indigo-650 uppercase tracking-wider">Documentos do Processo (Anexos - URLs)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Contrato de Locação original</label>
                          <input
                            type="text"
                            value={anexoContratoUrl}
                            onChange={(e) => setAnexoContratoUrl(e.target.value)}
                            placeholder="https://exemplo.com/contrato.pdf"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Termo de Exoneração (CredPago)</label>
                          <input
                            type="text"
                            value={anexoExoneracaoUrl}
                            onChange={(e) => setAnexoExoneracaoUrl(e.target.value)}
                            placeholder="https://exemplo.com/exoneracao.pdf"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Notificação Extrajudicial de Despejo</label>
                          <input
                            type="text"
                            value={anexoNotificacaoUrl}
                            onChange={(e) => setAnexoNotificacaoUrl(e.target.value)}
                            placeholder="https://exemplo.com/notificacao.pdf"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Petição Inicial (Assinada pelo Advogado)</label>
                          <input
                            type="text"
                            value={anexoInicialUrl}
                            onChange={(e) => setAnexoInicialUrl(e.target.value)}
                            placeholder="https://exemplo.com/inicial.pdf"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 block uppercase">Estado / Status da Ação de Despejo</label>
                      <select
                        value={statusVal}
                        onChange={(e) => setStatusVal(e.target.value as Despejo["status"])}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800"
                      >
                        <option value="NOTIFICADO">Notificado à Desocupar ou Trocar Garantia</option>
                        <option value="PRAZO_VENCIDO">Prazo Escoado (Vencido)</option>
                        <option value="AJUIZADO">Ação de Despejo Ajuizada</option>
                        <option value="LIMINAR_CONCEDIDA">Liminar de Desocupação Concedida</option>
                        <option value="DESPEJO_REALIZADO">Despejo Realizado (Caso Resolvido)</option>
                      </select>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-slate-500 block uppercase">Observações Gerais</label>
                      <textarea
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        placeholder="Informações e observações livres relativas ao caso de evicção..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none h-20"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons with Step flow */}
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-between items-center select-none">
                <button
                  type="button"
                  onClick={() => setWizardStep(prev => Math.max(prev - 1, 1))}
                  disabled={wizardStep === 1}
                  className={`flex items-center gap-2 p-2 px-3 border border-slate-300 rounded-xl text-xs font-bold leading-tight cursor-pointer ${
                    wizardStep === 1 ? "opacity-40" : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>

                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Etapa {wizardStep} de 4
                </div>

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white p-2 px-4 rounded-xl text-xs font-bold leading-tight cursor-pointer"
                  >
                    Próximo <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveDespejo}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 px-6 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:shadow hover:scale-[1.01] transition-all cursor-pointer"
                  >
                    Salvar Caso de Despejo
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirmar Exclusão"
        message="Você tem certeza de que deseja remover permanentemente este processo de despejo?"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={async () => {
          if (deleteTargetId) {
            await deleteMutation.mutateAsync({ id: deleteTargetId, companyId });
            if (selectedDespejo?.id === deleteTargetId) {
              setSelectedDespejo(null);
            }
          }
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
      />
    </div>
  );
};
