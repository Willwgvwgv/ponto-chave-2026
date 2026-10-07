import React, { useState, useEffect, useMemo } from "react";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Printer, 
  FileDown, 
  Trash2, 
  Copy, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Bookmark, 
  LayoutTemplate, 
  Building2, 
  User, 
  DollarSign, 
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check
} from "lucide-react";
import { 
  ContratoLocacao, 
  ContratoModelo, 
  ContractStatus, 
  GuaranteeType 
} from "./types/contractTypes";
import { VisualContractEditor } from "./editor/VisualContractEditor";
import { 
  INITIAL_PREDEFINED_TEMPLATES, 
  DEFAULT_STYLE_SETTINGS,
  RESIDENTIAL_CAUCAO_BLOCKS 
} from "./utils/defaultContractTemplates";
import { printContractDocument } from "./utils/contractPdfGenerator";
import { formatCurrencyBRL } from "./utils/contractVariableResolver";
import { CurrencyInput } from "../ui/CurrencyInput";
import { CompanySettings, UserProfile } from "../../types";
import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  setDoc,
  getDocs
} from "../../firebase";
import { toast } from "sonner";

interface ContratosLocacaoViewProps {
  isAdmin: boolean;
  user: any;
  profile: UserProfile | null;
  companySettings?: CompanySettings | null;
}

export const ContratosLocacaoView: React.FC<ContratosLocacaoViewProps> = ({
  isAdmin,
  user,
  profile,
  companySettings
}) => {
  const companyId = profile?.companyId || "default";

  // Navigation inside contracts
  const [activeTab, setActiveTab] = useState<"contratos" | "modelos">("contratos");
  
  // Data states
  const [contratos, setContratos] = useState<ContratoLocacao[]>([]);
  const [modelos, setModelos] = useState<ContratoModelo[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor mode
  const [activeEditingContract, setActiveEditingContract] = useState<ContratoLocacao | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  // Wizard Modal for "Novo Contrato"
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  // Wizard form data
  const [novoContratoForm, setNovoContratoForm] = useState({
    titulo: "",
    tipoLocacao: "residencial" as ContratoLocacao["tipoLocacao"],
    locatarioNome: "",
    locatarioCpf: "",
    locatarioEmail: "",
    locatarioTelefone: "",
    locadorNome: "",
    locadorCpf: "",
    locatarioRg: "",
    locatarioEstadoCivil: "",
    locatarioProfissao: "",
    locatarioNacionalidade: "brasileiro(a)",
    locatarioEndereco: "",
    imovelComplemento: "",
    imovelEstado: "GO",
    imovelCep: "",
    imovelTipo: "Casa",
    indiceReajuste: "IGP-M" as ContratoLocacao["condicoes"]["indiceReajuste"],
    seguroIncendio: 0,
    cidadeForo: companySettings?.city || "",
    imovelEndereco: "",
    imovelNumero: "",
    imovelBairro: "",
    imovelCidade: companySettings?.city || "Goiânia",
    valorAluguel: 2500,
    diaVencimento: 10,
    prazoMeses: 30,
    dataInicio: new Date().toISOString().split("T")[0],
    modalidadeGarantia: "caucao" as GuaranteeType,
    // Compra e venda
    valorVenda: 0,
    valorSinal: 0,
    valorFinanciado: 0,
    bancoFinanciamento: "Caixa Econômica Federal",
    prazoDocumentacaoDias: 15,
    comissaoPercent: 6,
    comissaoPagaPor: "VENDEDOR" as "VENDEDOR" | "COMPRADOR"
  });

  // Modelo escolhido no assistente é de compra e venda? (muda os campos e textos do formulário)
  const modeloSelecionado = modelos.find((m) => m.id === selectedTemplateId);
  const isVenda = modeloSelecionado?.tipoDocumento === "venda";

  // 1. Subscribe to Contratos in Firestore
  useEffect(() => {
    const qContratos = query(
      collection(db, "contratos_locacao"),
      where("companyId", "==", companyId)
    );

    const unsubscribeContratos = onSnapshot(qContratos, (snapshot) => {
      const list: ContratoLocacao[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ContratoLocacao);
      });
      // Sort newest first
      list.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt || 0).getTime();
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
      setContratos(list);
      setLoading(false);
    }, (err) => {
      console.warn("Firestore listener contratos_locacao:", err);
      setLoading(false);
    });

    return () => unsubscribeContratos();
  }, [companyId]);

  // 2. Subscribe to Modelos in Firestore + Predefined defaults
  useEffect(() => {
    const qModelos = query(
      collection(db, "contratos_modelos"),
      where("companyId", "==", companyId)
    );

    const unsubscribeModelos = onSnapshot(qModelos, (snapshot) => {
      const customModelos: ContratoModelo[] = [];
      snapshot.forEach((doc) => {
        customModelos.push({ id: doc.id, ...doc.data() } as ContratoModelo);
      });

      // Combine predefined system templates with company's custom templates
      setModelos([...INITIAL_PREDEFINED_TEMPLATES, ...customModelos]);
    }, (err) => {
      console.warn("Firestore listener contratos_modelos:", err);
      setModelos(INITIAL_PREDEFINED_TEMPLATES);
    });

    return () => unsubscribeModelos();
  }, [companyId]);

  // Filtered contracts list
  const filteredContratos = useMemo(() => {
    return contratos.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (typeFilter !== "todos" && c.tipoLocacao !== typeFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (c.titulo || "").toLowerCase().includes(term);
        const matchNum = (c.numeroContrato || "").toLowerCase().includes(term);
        const matchInquilino = (c.locatarios?.[0]?.nome || "").toLowerCase().includes(term);
        const matchImovel = (c.imovel?.endereco || "").toLowerCase().includes(term);
        return matchTitle || matchNum || matchInquilino || matchImovel;
      }
      return true;
    });
  }, [contratos, statusFilter, typeFilter, searchTerm]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = contratos.length;
    const ativos = contratos.filter((c) => c.status === "ativo" || c.status === "assinado").length;
    const rascunhos = contratos.filter((c) => c.status === "rascunho").length;
    const aguardandoAssinatura = contratos.filter((c) => c.status === "aguardando_assinatura").length;
    return { total, ativos, rascunhos, aguardandoAssinatura };
  }, [contratos]);

  // Save new reusable template handler
  const handleSaveTemplate = async (
    newTemplateData: Omit<ContratoModelo, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      await addDoc(collection(db, "contratos_modelos"), {
        ...newTemplateData,
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Modelo registrado com sucesso!");
    } catch (err) {
      console.error("Erro ao registrar modelo:", err);
      toast.error("Erro ao salvar modelo no Firestore.");
    }
  };

  // Start new contract flow
  const handleOpenNewContractWizard = (preselectedTemplateId?: string) => {
    const defaultTemplate = modelos.find((m) => m.isPadrao) || modelos[0];
    const idEscolhido = preselectedTemplateId || defaultTemplate?.id || "modelo-padrao-caucao";
    const abrindoVenda = modelos.find((m) => m.id === idEscolhido)?.tipoDocumento === "venda";
    setSelectedTemplateId(idEscolhido);
    setWizardStep(1);
    setNovoContratoForm({
      titulo: abrindoVenda ? "Contrato de Compra e Venda" : "Contrato de Locação Residencial",
      tipoLocacao: "residencial",
      locatarioNome: "",
      locatarioCpf: "",
      locatarioEmail: "",
      locatarioTelefone: "",
      locadorNome: "",
      locadorCpf: "",
      locatarioRg: "",
      locatarioEstadoCivil: "",
      locatarioProfissao: "",
      locatarioNacionalidade: "brasileiro(a)",
      locatarioEndereco: "",
      imovelComplemento: "",
      imovelEstado: "GO",
      imovelCep: "",
      imovelTipo: "Casa",
      indiceReajuste: "IGP-M" as const,
      seguroIncendio: 0,
      cidadeForo: companySettings?.city || "",
      imovelEndereco: "",
      imovelNumero: "",
      imovelBairro: "",
      imovelCidade: companySettings?.city || "Goiânia",
      valorAluguel: 2500,
      diaVencimento: 10,
      prazoMeses: 30,
      dataInicio: new Date().toISOString().split("T")[0],
      modalidadeGarantia: "caucao",
      valorVenda: 0,
      valorSinal: 0,
      valorFinanciado: 0,
      bancoFinanciamento: "Caixa Econômica Federal",
      prazoDocumentacaoDias: 15,
      comissaoPercent: 6,
      comissaoPagaPor: "VENDEDOR"
    });
    setIsNewContractModalOpen(true);
  };

  // Submit and create new contract
  const handleCreateContractFromWizard = async () => {
    const chosenTemplate = modelos.find((m) => m.id === selectedTemplateId) || modelos[0];
    const ehVenda = chosenTemplate?.tipoDocumento === "venda";

    if (ehVenda) {
      if (!novoContratoForm.locatarioNome.trim() || !novoContratoForm.imovelEndereco.trim()) {
        toast.error("Informe o nome do comprador e o endereço do imóvel.");
        return;
      }
    }
    
    // Auto-generate number LOC-YYYY-XXXX (VEN- para compra e venda)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractNumber = `${ehVenda ? "VEN" : "LOC"}-${new Date().getFullYear()}-${randomSuffix}`;

    const dataFim = (() => {
      try {
        const d = new Date(novoContratoForm.dataInicio);
        d.setMonth(d.getMonth() + novoContratoForm.prazoMeses);
        return d.toISOString().split("T")[0];
      } catch {
        return "";
      }
    })();

    const newContractData: Omit<ContratoLocacao, "id"> = {
      companyId,
      numeroContrato: contractNumber,
      titulo: novoContratoForm.titulo || (ehVenda ? `Compra e Venda - ${novoContratoForm.locatarioNome || "Novo Comprador"}` : `Locação - ${novoContratoForm.locatarioNome || "Novo Inquilino"}`),
      tipoLocacao: chosenTemplate?.tipoLocacao || novoContratoForm.tipoLocacao,
      tipoDocumento: ehVenda ? "venda" : "locacao",
      status: "rascunho",
      modeloOrigemId: chosenTemplate.id,
      modeloOrigemNome: chosenTemplate.nome,
      locador: {
        id: `loc_${Date.now()}`,
        role: "locador",
        // Locação: quem assina é a imobiliária, como administradora e procuradora
        // do proprietário (contrato de administração à parte). Venda: vendedor.
        nome: ehVenda ? novoContratoForm.locadorNome : (companySettings?.name || ""),
        cpfCnpj: ehVenda ? (novoContratoForm.locadorCpf || "") : (companySettings?.cnpj || ""),
        endereco: ehVenda ? "" : (companySettings?.address || "")
      },
      locatarios: [
        {
          id: `locat_${Date.now()}`,
          role: "locatario",
          nome: novoContratoForm.locatarioNome || (ehVenda ? "Comprador" : "Locatário"),
          cpfCnpj: novoContratoForm.locatarioCpf || "",
          email: novoContratoForm.locatarioEmail,
          telefone: novoContratoForm.locatarioTelefone,
          rg: ehVenda ? "" : novoContratoForm.locatarioRg.trim(),
          estadoCivil: ehVenda ? "" : novoContratoForm.locatarioEstadoCivil.trim(),
          profissao: ehVenda ? "" : novoContratoForm.locatarioProfissao.trim(),
          nacionalidade: ehVenda ? "" : novoContratoForm.locatarioNacionalidade.trim(),
          endereco: ehVenda ? "" : novoContratoForm.locatarioEndereco.trim()
        }
      ],
      fiadores: [],
      imovel: {
        endereco: novoContratoForm.imovelEndereco || "Rua a definir",
        numero: novoContratoForm.imovelNumero || "",
        complemento: novoContratoForm.imovelComplemento.trim(),
        bairro: novoContratoForm.imovelBairro || "Setor Bueno",
        cidade: novoContratoForm.imovelCidade || "Goiânia",
        estado: novoContratoForm.imovelEstado.trim() || "GO",
        cep: novoContratoForm.imovelCep.trim(),
        tipoImovel: ehVenda
          ? (novoContratoForm.tipoLocacao === "comercial" ? "Sala Comercial" : "Apartamento Residencial")
          : (novoContratoForm.imovelTipo.trim() || "Casa"),
        destinacao: (chosenTemplate?.tipoLocacao || novoContratoForm.tipoLocacao) === "comercial" ? "comercial" : "residencial"
      },
      condicoes: {
        valorAluguel: novoContratoForm.valorAluguel,
        diaVencimento: novoContratoForm.diaVencimento,
        dataInicio: novoContratoForm.dataInicio,
        dataTermino: dataFim,
        prazoMeses: novoContratoForm.prazoMeses,
        indiceReajuste: ehVenda ? "IPCA" : novoContratoForm.indiceReajuste,
        seguroIncendioAnual: ehVenda ? 0 : (novoContratoForm.seguroIncendio || 0),
        modalidadeGarantia: novoContratoForm.modalidadeGarantia,
        valorGarantia: novoContratoForm.valorAluguel * 3,
        multaAtrasoPercent: 10,
        jurosMoraPercent: 1,
        multaRescisoriaMeses: 3,
        cidadeForo: (ehVenda ? "" : novoContratoForm.cidadeForo.trim()) || novoContratoForm.imovelCidade || "Goiânia",
        estadoForo: "Goiás",
        // Firestore não aceita undefined: só grava os campos de venda quando é venda
        ...(ehVenda ? {
          valorVenda: novoContratoForm.valorVenda || 0,
          valorSinal: novoContratoForm.valorSinal || 0,
          // vazio = o que falta depois do sinal
          valorFinanciado: novoContratoForm.valorFinanciado || Math.max(0, (novoContratoForm.valorVenda || 0) - (novoContratoForm.valorSinal || 0)),
          bancoFinanciamento: novoContratoForm.bancoFinanciamento || "",
          prazoDocumentacaoDias: novoContratoForm.prazoDocumentacaoDias || 0,
          comissaoPercent: novoContratoForm.comissaoPercent || 0,
          comissaoPagaPor: novoContratoForm.comissaoPagaPor
        } : {})
      },
      blocks: chosenTemplate.blocks,
      styleSettings: chosenTemplate.styleSettings || DEFAULT_STYLE_SETTINGS,
      versoes: [
        {
          id: `v_init_${Date.now()}`,
          versionNumber: 1,
          createdAt: new Date().toISOString(),
          createdByUid: user?.uid || "system",
          createdByName: profile?.displayName || "Usuário",
          description: `Criação inicial a partir do modelo ${chosenTemplate.nome}`,
          blocksSnapshot: chosenTemplate.blocks,
          styleSettingsSnapshot: chosenTemplate.styleSettings || DEFAULT_STYLE_SETTINGS
        }
      ],
      criadoPorUid: user?.uid || "system",
      criadoPorNome: profile?.displayName || "Usuário",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, "contratos_locacao"), newContractData);
      const createdContract: ContratoLocacao = {
        id: docRef.id,
        ...newContractData
      };
      setIsNewContractModalOpen(false);
      toast.success("Contrato criado com sucesso! Abrindo editor visual...");
      setActiveEditingContract(createdContract);
    } catch (err) {
      console.error("Erro ao criar contrato:", err);
      toast.error("Erro ao salvar contrato no banco de dados.");
    }
  };

  // Duplicate contract
  const handleDuplicateContract = async (original: ContratoLocacao) => {
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const duplicateData: Omit<ContratoLocacao, "id"> = {
        ...original,
        numeroContrato: `LOC-${new Date().getFullYear()}-${randomSuffix}`,
        titulo: `${original.titulo} (Cópia)`,
        status: "rascunho",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        criadoPorUid: user?.uid || "system",
        criadoPorNome: profile?.displayName || "Usuário"
      };

      await addDoc(collection(db, "contratos_locacao"), duplicateData);
      toast.success("Contrato duplicado com sucesso!");
    } catch (err) {
      console.error("Erro ao duplicar contrato:", err);
      toast.error("Falha ao duplicar contrato.");
    }
  };

  // Delete contract
  const handleDeleteContract = async (contractId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este contrato de locação?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "contratos_locacao", contractId));
      toast.success("Contrato excluído.");
    } catch (err) {
      console.error("Erro ao excluir contrato:", err);
      toast.error("Falha ao excluir contrato.");
    }
  };

  // IF VISUAL EDITOR IS ACTIVE: Render full-screen Canva Editor!
  if (activeEditingContract) {
    return (
      <VisualContractEditor
        initialContract={activeEditingContract}
        companySettings={companySettings}
        currentUser={profile}
        onBack={() => setActiveEditingContract(null)}
        onSaveTemplate={handleSaveTemplate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Contratos de Locação
              </h1>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Editor Visual
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Crie, personalize e gerencie contratos de locação profissionais com editor visual estilo Canva, 
              preenchimento dinâmico de dados cadastrais e geração de documentos com validade jurídica.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenNewContractWizard()}
              className="py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato de Locação
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total de Contratos</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          </div>

          <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Ativos / Assinados</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{stats.ativos}</div>
          </div>

          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Aguardando Assinatura</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.aguardandoAssinatura}</div>
          </div>

          <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Rascunhos no Editor</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{stats.rascunhos}</div>
          </div>
        </div>
      </div>

      {/* Tabs: Contratos vs Galeria de Modelos */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("contratos")}
          className={`py-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "contratos"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          Todos os Contratos ({contratos.length})
        </button>

        <button
          onClick={() => setActiveTab("modelos")}
          className={`py-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "modelos"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          Galeria de Modelos ({modelos.length})
        </button>
      </div>

      {/* VIEW 1: TAB CONTRATOS */}
      {activeTab === "contratos" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por inquilino, imóvel ou número..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none"
              >
                <option value="todos">Todos os Status</option>
                <option value="rascunho">Rascunho</option>
                <option value="aguardando_assinatura">Aguardando Assinatura</option>
                <option value="assinado">Assinado</option>
                <option value="ativo">Ativo</option>
                <option value="finalizado">Finalizado</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
                <option value="temporada">Temporada</option>
              </select>
            </div>
          </div>

          {/* Contracts Table / List */}
          {filteredContratos.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Nenhum contrato de locação encontrado
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                Comece criando seu primeiro contrato de locação utilizando os modelos oficiais da Lei do Inquilinato.
              </p>
              <button
                onClick={() => handleOpenNewContractWizard()}
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Contrato
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Contrato</th>
                      <th className="py-3.5 px-4">Locatário / Inquilino</th>
                      <th className="py-3.5 px-4">Imóvel</th>
                      <th className="py-3.5 px-4">Aluguel & Vigência</th>
                      <th className="py-3.5 px-4">Garantia</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContratos.map((c) => {
                      const locatario = c.locatarios?.[0];
                      const valor = formatCurrencyBRL(c.condicoes?.valorAluguel);

                      const statusBadge = (() => {
                        switch (c.status) {
                          case "assinado":
                          case "ativo":
                            return <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Assinado</span>;
                          case "aguardando_assinatura":
                            return <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Aguardando Assinatura</span>;
                          case "finalizado":
                            return <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Finalizado</span>;
                          default:
                            return <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[10px]">Rascunho</span>;
                        }
                      })();

                      return (
                        <tr 
                          key={c.id}
                          className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                          onClick={() => setActiveEditingContract(c)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {c.titulo}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {c.numeroContrato || "LOC"} • {c.tipoLocacao.toUpperCase()}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {locatario?.nome || "Locatário não informado"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              CPF: {locatario?.cpfCnpj || "---"}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 truncate max-w-xs font-medium">
                              {c.imovel?.endereco || "Endereço não informado"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {c.imovel?.bairro ? `${c.imovel.bairro}, ` : ""}{c.imovel?.cidade || "Goiânia"}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">
                              {valor}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Venc. dia {c.condicoes?.diaVencimento || 10} • {c.condicoes?.prazoMeses || 30} meses
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="capitalize font-medium text-slate-700">
                              {c.condicoes?.modalidadeGarantia === "caucao" ? "Caução (3x)" : c.condicoes?.modalidadeGarantia === "credpago" ? "CredPago" : c.condicoes?.modalidadeGarantia || "Caução"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {statusBadge}
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setActiveEditingContract(c)}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                title="Abrir no Editor Visual"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => printContractDocument(c, companySettings)}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Imprimir / Exportar PDF"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDuplicateContract(c)}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Duplicar Contrato"
                              >
                                <Copy className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteContract(c.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Contrato"
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
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TAB GALERIA DE MODELOS */}
      {activeTab === "modelos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Modelos de Contratos Disponíveis
              </h2>
              <p className="text-xs text-slate-500">
                Selecione um modelo para iniciar uma nova locação ou personalize as cláusulas para sua imobiliária.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modelos.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-lg transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {m.categoria || "Residencial"}
                    </span>
                    {m.isPadrao && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Padrão
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors mb-1.5">
                    {m.nome}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    {m.descricao}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                    <span>{m.blocks.length} seções & cláusulas</span>
                    <span>•</span>
                    <span>Fonte: {m.styleSettings?.fontFamily || "Inter"}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenNewContractWizard(m.id)}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    Usar Este Modelo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WIZARD MODAL: NOVO CONTRATO DE LOCAÇÃO */}
      {isNewContractModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {isVenda ? "Novo Contrato de Compra e Venda" : "Novo Contrato de Locação"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Selecione o modelo e informe os dados principais para carregar no Editor Visual.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewContractModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
              {/* 1. Escolha do Modelo */}
              <div>
                <label className="block text-slate-800 font-bold mb-1.5">
                  Modelo Base do Contrato*
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const novoId = e.target.value;
                    setSelectedTemplateId(novoId);
                    const venda = modelos.find((m) => m.id === novoId)?.tipoDocumento === "venda";
                    setNovoContratoForm((prev) => {
                      const titulosPadrao = ["", "Contrato de Locação Residencial", "Contrato de Compra e Venda"];
                      return {
                        ...prev,
                        titulo: titulosPadrao.includes(prev.titulo) ? (venda ? "Contrato de Compra e Venda" : "Contrato de Locação Residencial") : prev.titulo
                      };
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.categoria})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Título */}
              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  Título do Contrato / Identificação Interna*
                </label>
                <input
                  type="text"
                  value={novoContratoForm.titulo}
                  onChange={(e) => setNovoContratoForm({ ...novoContratoForm, titulo: e.target.value })}
                  placeholder="Ex: Contrato de Locação Residencial - Apto 302"
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              {/* 3. Partes */}
              {isVenda ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label htmlFor="nc-comprador" className="block text-slate-800 font-bold mb-1">Nome do Comprador*</label>
                    <input id="nc-comprador" type="text" value={novoContratoForm.locatarioNome}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioNome: e.target.value })}
                      placeholder="Nome completo do comprador" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-comprador-cpf" className="block text-slate-800 font-bold mb-1">CPF/CNPJ do Comprador</label>
                    <input id="nc-comprador-cpf" type="text" value={novoContratoForm.locatarioCpf}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioCpf: e.target.value })}
                      placeholder="000.000.000-00" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-vendedor" className="block text-slate-800 font-bold mb-1">Nome do Vendedor</label>
                    <input id="nc-vendedor" type="text" value={novoContratoForm.locadorNome}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locadorNome: e.target.value })}
                      placeholder="Nome completo do proprietário" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-vendedor-cpf" className="block text-slate-800 font-bold mb-1">CPF/CNPJ do Vendedor</label>
                    <input id="nc-vendedor-cpf" type="text" value={novoContratoForm.locadorCpf}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locadorCpf: e.target.value })}
                      placeholder="000.000.000-00" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Nome do Locatário (Inquilino)*
                  </label>
                  <input
                    type="text"
                    required
                    value={novoContratoForm.locatarioNome}
                    onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioNome: e.target.value })}
                    placeholder="Nome completo do inquilino"
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    CPF/CNPJ do Locatário
                  </label>
                  <input
                    type="text"
                    value={novoContratoForm.locatarioCpf}
                    onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioCpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
              </div>
              )}

              {/* 4. Imóvel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">
                    Endereço do Imóvel*
                  </label>
                  <input
                    type="text"
                    required
                    value={novoContratoForm.imovelEndereco}
                    onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelEndereco: e.target.value })}
                    placeholder="Rua, avenida (número e complemento abaixo)"
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={novoContratoForm.imovelBairro}
                    onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelBairro: e.target.value })}
                    placeholder="Setor Bueno"
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* 5. Valores */}
              {isVenda ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="nc-valor-venda" className="block text-slate-800 font-bold mb-1">Valor da Venda*</label>
                      <CurrencyInput id="nc-valor-venda" value={novoContratoForm.valorVenda || ""}
                        onChange={(v) => setNovoContratoForm({ ...novoContratoForm, valorVenda: v })}
                        className="w-full p-2 border border-slate-300 rounded-xl outline-none font-bold" />
                    </div>
                    <div>
                      <label htmlFor="nc-sinal" className="block text-slate-800 font-bold mb-1">Sinal</label>
                      <CurrencyInput id="nc-sinal" value={novoContratoForm.valorSinal || ""}
                        onChange={(v) => setNovoContratoForm({ ...novoContratoForm, valorSinal: v })}
                        className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                    </div>
                    <div>
                      <label htmlFor="nc-financiado" className="block text-slate-800 font-bold mb-1">Valor Financiado</label>
                      <CurrencyInput id="nc-financiado" value={novoContratoForm.valorFinanciado || ""}
                        onChange={(v) => setNovoContratoForm({ ...novoContratoForm, valorFinanciado: v })}
                        placeholder={novoContratoForm.valorVenda ? `${formatCurrencyBRL(Math.max(0, novoContratoForm.valorVenda - (novoContratoForm.valorSinal || 0)))} (automático)` : "venda − sinal"}
                        className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                    </div>
                  </div>
                  {/* Só avisa quando o financiado foi digitado (vazio = calculado como venda − sinal) */}
                  {novoContratoForm.valorVenda > 0 && (novoContratoForm.valorFinanciado || 0) > 0 &&
                    Math.abs(novoContratoForm.valorVenda - (novoContratoForm.valorSinal || 0) - (novoContratoForm.valorFinanciado || 0)) > 0.01 && (
                    <p className="text-[11px] font-medium text-amber-700">
                      Sinal + financiado = {formatCurrencyBRL((novoContratoForm.valorSinal || 0) + (novoContratoForm.valorFinanciado || 0))}, diferente do valor da venda ({formatCurrencyBRL(novoContratoForm.valorVenda)}).
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="nc-banco" className="block text-slate-800 font-bold mb-1">Banco do Financiamento</label>
                      <input id="nc-banco" type="text" value={novoContratoForm.bancoFinanciamento}
                        onChange={(e) => setNovoContratoForm({ ...novoContratoForm, bancoFinanciamento: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                    </div>
                    <div>
                      <label htmlFor="nc-prazo-doc" className="block text-slate-800 font-bold mb-1">Prazo p/ Documentação (dias úteis)</label>
                      <input id="nc-prazo-doc" type="number" min="0" value={novoContratoForm.prazoDocumentacaoDias || ""}
                        onChange={(e) => setNovoContratoForm({ ...novoContratoForm, prazoDocumentacaoDias: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                    </div>
                    <div>
                      <label htmlFor="nc-comissao" className="block text-slate-800 font-bold mb-1">Comissão (%)</label>
                      <div className="flex gap-2">
                        <input id="nc-comissao" type="number" min="0" step="0.5" value={novoContratoForm.comissaoPercent || ""}
                          onChange={(e) => setNovoContratoForm({ ...novoContratoForm, comissaoPercent: parseFloat(e.target.value) || 0 })}
                          className="w-20 p-2 border border-slate-300 rounded-xl outline-none" />
                        <select aria-label="Comissão paga por" value={novoContratoForm.comissaoPagaPor}
                          onChange={(e) => setNovoContratoForm({ ...novoContratoForm, comissaoPagaPor: e.target.value as "VENDEDOR" | "COMPRADOR" })}
                          className="flex-1 min-w-0 p-2 border border-slate-300 rounded-xl outline-none bg-white">
                          <option value="VENDEDOR">paga pelo vendedor</option>
                          <option value="COMPRADOR">paga pelo comprador</option>
                        </select>
                      </div>
                      {novoContratoForm.valorVenda > 0 && novoContratoForm.comissaoPercent > 0 && (
                        <p className="text-[11px] text-slate-500 mt-1">= {formatCurrencyBRL(novoContratoForm.valorVenda * novoContratoForm.comissaoPercent / 100)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Valor do Aluguel*
                  </label>
                  <CurrencyInput
                    value={novoContratoForm.valorAluguel || ""}
                    onChange={(v) => setNovoContratoForm({ ...novoContratoForm, valorAluguel: v })}
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={novoContratoForm.diaVencimento}
                    onChange={(e) => setNovoContratoForm({ ...novoContratoForm, diaVencimento: parseInt(e.target.value) || 10 })}
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Prazo em Meses
                  </label>
                  <input
                    type="number"
                    value={novoContratoForm.prazoMeses}
                    onChange={(e) => setNovoContratoForm({ ...novoContratoForm, prazoMeses: parseInt(e.target.value) || 30 })}
                    className="w-full p-2 border border-slate-300 rounded-xl outline-none"
                  />
                </div>
              </div>
              )}

              {/* Dados completos para os modelos de locação (qualificação, imóvel e condições) */}
              {!isVenda && (
              <>
              <p className="pt-3 border-t border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">Condições</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="nc-inicio" className="block text-slate-800 font-bold mb-1">Início da locação</label>
                    <input id="nc-inicio" type="date" value={novoContratoForm.dataInicio}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, dataInicio: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-indice" className="block text-slate-800 font-bold mb-1">Índice de reajuste</label>
                    <select id="nc-indice" value={novoContratoForm.indiceReajuste}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, indiceReajuste: e.target.value as typeof novoContratoForm.indiceReajuste })}
                      className="w-full p-2 border border-slate-300 rounded-xl outline-none bg-white">
                      <option value="IGP-M">IGP-M/FGV</option>
                      <option value="IPCA">IPCA/IBGE</option>
                      <option value="INPC">INPC/IBGE</option>
                      <option value="FIPE-ZAP">FIPE-ZAP</option>
                      <option value="FIXO">Sem reajuste</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="nc-seguro" className="block text-slate-800 font-bold mb-1">Seguro incêndio (anual)</label>
                    <CurrencyInput id="nc-seguro" value={novoContratoForm.seguroIncendio || ""}
                      onChange={(v) => setNovoContratoForm({ ...novoContratoForm, seguroIncendio: v })}
                      className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-foro" className="block text-slate-800 font-bold mb-1">Comarca do foro</label>
                    <input id="nc-foro" type="text" value={novoContratoForm.cidadeForo}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, cidadeForo: e.target.value })}
                      placeholder="Bela Vista de Goiás" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
              </div>

              <p className="pt-3 border-t border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">Locatário — demais dados</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="nc-locat-rg" className="block text-slate-800 font-bold mb-1">RG</label>
                    <input id="nc-locat-rg" type="text" value={novoContratoForm.locatarioRg}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioRg: e.target.value })}
                      placeholder="0000000 SSP/GO" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-locat-ec" className="block text-slate-800 font-bold mb-1">Estado civil</label>
                    <input id="nc-locat-ec" type="text" value={novoContratoForm.locatarioEstadoCivil}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioEstadoCivil: e.target.value })}
                      placeholder="solteiro(a)" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-locat-prof" className="block text-slate-800 font-bold mb-1">Profissão</label>
                    <input id="nc-locat-prof" type="text" value={novoContratoForm.locatarioProfissao}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioProfissao: e.target.value })}
                      placeholder="" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-locat-nac" className="block text-slate-800 font-bold mb-1">Nacionalidade</label>
                    <input id="nc-locat-nac" type="text" value={novoContratoForm.locatarioNacionalidade}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioNacionalidade: e.target.value })}
                      placeholder="brasileiro(a)" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-locat-tel" className="block text-slate-800 font-bold mb-1">Telefone</label>
                    <input id="nc-locat-tel" type="text" value={novoContratoForm.locatarioTelefone}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioTelefone: e.target.value })}
                      placeholder="(62) 90000-0000" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-locat-email" className="block text-slate-800 font-bold mb-1">E-mail</label>
                    <input id="nc-locat-email" type="text" value={novoContratoForm.locatarioEmail}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioEmail: e.target.value })}
                      placeholder="" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label htmlFor="nc-locat-end" className="block text-slate-800 font-bold mb-1">Endereço atual do locatário</label>
                    <input id="nc-locat-end" type="text" value={novoContratoForm.locatarioEndereco}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, locatarioEndereco: e.target.value })}
                      placeholder="Rua, nº, bairro, cidade - UF" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
              </div>

              <p className="pt-3 border-t border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">Imóvel — demais dados</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="nc-im-num" className="block text-slate-800 font-bold mb-1">Número</label>
                    <input id="nc-im-num" type="text" value={novoContratoForm.imovelNumero}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelNumero: e.target.value })}
                      placeholder="" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-im-comp" className="block text-slate-800 font-bold mb-1">Complemento</label>
                    <input id="nc-im-comp" type="text" value={novoContratoForm.imovelComplemento}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelComplemento: e.target.value })}
                      placeholder="Qd, Lt, casa, apto" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-im-tipo" className="block text-slate-800 font-bold mb-1">Tipo do imóvel</label>
                    <input id="nc-im-tipo" type="text" value={novoContratoForm.imovelTipo}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelTipo: e.target.value })}
                      placeholder="Casa" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-im-cep" className="block text-slate-800 font-bold mb-1">CEP</label>
                    <input id="nc-im-cep" type="text" value={novoContratoForm.imovelCep}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelCep: e.target.value })}
                      placeholder="00000-000" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label htmlFor="nc-im-cid" className="block text-slate-800 font-bold mb-1">Cidade</label>
                    <input id="nc-im-cid" type="text" value={novoContratoForm.imovelCidade}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelCidade: e.target.value })}
                      placeholder="" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label htmlFor="nc-im-uf" className="block text-slate-800 font-bold mb-1">UF</label>
                    <input id="nc-im-uf" type="text" value={novoContratoForm.imovelEstado}
                      onChange={(e) => setNovoContratoForm({ ...novoContratoForm, imovelEstado: e.target.value })}
                      placeholder="GO" className="w-full p-2 border border-slate-300 rounded-xl outline-none" />
                  </div>
              </div>
              </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={() => setIsNewContractModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleCreateContractFromWizard}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md rounded-xl cursor-pointer transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Criar e Abrir no Editor Visual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
