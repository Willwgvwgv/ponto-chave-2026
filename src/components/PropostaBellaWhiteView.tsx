import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  FileText, 
  User, 
  DollarSign, 
  CheckSquare, 
  Printer, 
  Save, 
  Trash2, 
  Plus, 
  FolderOpen,
  Info,
  Layers,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, handleFirestoreError, OperationType } from "../firebase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Custom Input com mascara para valores em Real (BRL)
interface BrlInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const BrlInput: React.FC<BrlInputProps> = ({ value, onChange, placeholder, className, disabled }) => {
  const [displayValue, setDisplayValue] = useState<string>("");

  const formatBRLString = (valStr: string) => {
    let clean = valStr.replace(/[^\d,]/g, "");
    const parts = clean.split(",");
    if (parts.length > 2) {
      clean = parts[0] + "," + parts.slice(1).join("");
    }
    let integerPart = parts[0];
    let decimalPart = parts[1];

    if (decimalPart !== undefined) {
      decimalPart = decimalPart.slice(0, 2);
    }

    if (integerPart) {
      const parsedInt = parseInt(integerPart, 10);
      if (!isNaN(parsedInt)) {
        integerPart = new Intl.NumberFormat("pt-BR").format(parsedInt);
      }
    }
    let result = integerPart;
    if (decimalPart !== undefined) {
      result += "," + decimalPart;
    }
    return result ? "R$ " + result : "";
  };

  const parseBRLString = (formattedStr: string): number => {
    let clean = formattedStr.replace(/[R$\s.]/g, "");
    clean = clean.replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    const parsedCurrent = parseBRLString(displayValue);
    if (Math.abs(parsedCurrent - value) > 0.009 || (value === 0 && displayValue !== "")) {
      if (value === 0) {
        setDisplayValue("");
      } else {
        const parentFormatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
        setDisplayValue(parentFormatted);
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setDisplayValue("");
      onChange(0);
      return;
    }
    const formatted = formatBRLString(raw);
    setDisplayValue(formatted);
    onChange(parseBRLString(formatted));
  };

  const handleBlur = () => {
    if (value > 0) {
      const standard = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
      setDisplayValue(standard);
    } else {
      setDisplayValue("");
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => e.target.select()}
      placeholder={placeholder || "R$ 0,00"}
      className={className}
      disabled={disabled}
    />
  );
};

interface PropostaComprador {
  nome: string;
  nacionalidade: string;
  estadoCivil: string;
  dataNascimento: string;
  profissao: string;
  identidade: string;
  cpf: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  telefones: string;
  email: string;
  rendaBruta: number;
  tipoRenda: "FORMAL" | "INFORMAL" | "";
}

const defaultComprador = (): PropostaComprador => ({
  nome: "",
  nacionalidade: "Brasileiro(a)",
  estadoCivil: "Solteiro(a)",
  dataNascimento: "",
  profissao: "",
  identidade: "",
  cpf: "",
  endereco: "",
  bairro: "",
  cep: "",
  cidade: "",
  estado: "",
  telefones: "",
  email: "",
  rendaBruta: 0,
  tipoRenda: "FORMAL",
});

interface PropostaBellaWhiteProps {
  companySettings?: any;
  currentUser?: any;
}

export const PropostaBellaWhiteView: React.FC<PropostaBellaWhiteProps> = ({ companySettings, currentUser }) => {
  // Saved proposals state list
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tabIndex, setTabIndex] = useState<number>(0);

  // Form states matching 1-1 the original Bella White PDF fields
  const [bloco, setBloco] = useState<string>("");
  const [apartamento, setApartamento] = useState<string>("");
  const [regimeCasamento, setRegimeCasamento] = useState<string>("");

  const [comprador1, setComprador1] = useState<PropostaComprador>(defaultComprador());
  const [comprador2, setComprador2] = useState<PropostaComprador>(defaultComprador());

  const [precoImovel, setPrecoImovel] = useState<number>(250000);

  // Forma de pagto
  const [sinalValor, setSinalValor] = useState<number>(10000);
  const [sinalParcelas, setSinalParcelas] = useState<number>(1);
  const [sinalParcelaValor, setSinalParcelaValor] = useState<number>(10000);
  const [sinalDataPrimeira, setSinalDataPrimeira] = useState<string>("");

  const [finConstrutoraValor, setFinConstrutoraValor] = useState<number>(20000);
  const [finConstrutoraParcelas, setFinConstrutoraParcelas] = useState<number>(12);
  const [finConstrutoraParcelaValor, setFinConstrutoraParcelaValor] = useState<number>(1666.66);
  const [finConstrutoraData, setFinConstrutoraData] = useState<string>("");

  const [intermediariasValor, setIntermediariasValor] = useState<number>(0);
  const [intermediariasParcelas, setIntermediariasParcelas] = useState<number>(0);
  const [intermediariasTipo, setIntermediariasTipo] = useState<string>("TRIMESTRAIS");
  const [intermediariasParcelaValor, setIntermediariasParcelaValor] = useState<number>(0);
  const [intermediariasData, setIntermediariasData] = useState<string>("");

  const [finBancarioValor, setFinBancarioValor] = useState<number>(220000);

  // Intermediacao corretagem
  const [comissaoValor, setComissaoValor] = useState<number>(15000);
  const [imobiliariaNome, setImobiliariaNome] = useState<string>("Fidelité Negócios Imobiliários");
  const [imobiliariaCreci, setImobiliariaCreci] = useState<string>("33.456-J");
  const [corretorNome, setCorretorNome] = useState<string>("");
  const [corretorCreci, setCorretorCreci] = useState<string>("");
  
  const [comissaoDestinoTotal, setComissaoDestinoTotal] = useState<number>(15500);
  const [comissaoDestinoImobiliaria, setComissaoDestinoImobiliaria] = useState<number>(7500);
  const [comissaoDestinoCorretor, setComissaoDestinoCorretor] = useState<number>(8000);
  
  const [observacoes, setObservacoes] = useState<string>("");

  // Checklist
  const [checklistC1, setChecklistC1] = useState<Record<string, boolean>>({
    rgCpf: true,
    certidao: false,
    endereco: true,
    renda: true,
    restricao: true,
    imposto: false,
  });
  const [checklistC2, setChecklistC2] = useState<Record<string, boolean>>({
    rgCpf: false,
    certidao: false,
    endereco: false,
    renda: false,
    restricao: false,
    imposto: false,
  });

  const [cidadeData, setCidadeData] = useState<string>("Bela Vista de Goiás - GO");
  const [dataProposta, setDataProposta] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Auto-calculated fields
  useEffect(() => {
    // Se parcelas do sinal mudar, recalcula valor parcelas
    if (sinalParcelas > 0) {
      setSinalParcelaValor(Number((sinalValor / sinalParcelas).toFixed(2)));
    } else {
      setSinalParcelaValor(0);
    }
  }, [sinalValor, sinalParcelas]);

  useEffect(() => {
    // Se parcelas da Construtora mudar, recalcula valor
    if (finConstrutoraParcelas > 0) {
      setFinConstrutoraParcelaValor(Number((finConstrutoraValor / finConstrutoraParcelas).toFixed(2)));
    } else {
      setFinConstrutoraParcelaValor(0);
    }
  }, [finConstrutoraValor, finConstrutoraParcelas]);

  useEffect(() => {
    // Se parcelas intermediarias mudar
    if (intermediariasParcelas > 0) {
      setIntermediariasParcelaValor(Number((intermediariasValor / intermediariasParcelas).toFixed(2)));
    } else {
      setIntermediariasParcelaValor(0);
    }
  }, [intermediariasValor, intermediariasParcelas]);

  // Load corretores & autofill info
  useEffect(() => {
    if (currentUser?.displayName && !corretorNome) {
      setCorretorNome(currentUser.displayName);
    }
  }, [currentUser]);

  // Read saved proposals from Firestore
  const loadSavedProposals = async () => {
    setIsLoading(true);
    try {
      const proposalsCollection = collection(db, "propostas_bella_white");
      const proposalSnapshot = await getDocs(proposalsCollection);
      const list: any[] = [];
      proposalSnapshot.forEach((docSnap: any) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setProposals(list);
    } catch (err) {
      console.error("Erro ao carregar propostas guardadas", err);
      // Fallback local se erro / offline
      const local = localStorage.getItem("propostas_bella_white_drafts");
      if (local) {
        setProposals(JSON.parse(local));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedProposals();
  }, []);

  // Save changes to cloud
  const handleSave = async () => {
    setIsSaving(true);
    const dataPayload = {
      bloco,
      apartamento,
      regimeCasamento,
      comprador1,
      comprador2,
      precoImovel,
      sinalValor,
      sinalParcelas,
      sinalParcelaValor,
      sinalDataPrimeira,
      finConstrutoraValor,
      finConstrutoraParcelas,
      finConstrutoraParcelaValor,
      finConstrutoraData,
      intermediariasValor,
      intermediariasParcelas,
      intermediariasTipo,
      intermediariasParcelaValor,
      intermediariasData,
      finBancarioValor,
      comissaoValor,
      imobiliariaNome,
      imobiliariaCreci,
      corretorNome,
      corretorCreci,
      comissaoDestinoTotal,
      comissaoDestinoImobiliaria,
      comissaoDestinoCorretor,
      observacoes,
      checklistC1,
      checklistC2,
      cidadeData,
      dataProposta,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (selectedProposalId) {
        // Update
        const docRef = doc(db, "propostas_bella_white", selectedProposalId);
        await updateDoc(docRef, dataPayload);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, "propostas_bella_white"), {
          ...dataPayload,
          createdAt: new Date().toISOString(),
        });
        setSelectedProposalId(docRef.id);
      }
      
      // Feedback & Reload
      await loadSavedProposals();
      alert("Proposta guardada com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar proposta", err);
      // Save locally as fallback
      const updatedLocalList = [...proposals];
      const fallbackId = selectedProposalId || `local-${Date.now()}`;
      const payloadWithId = { ...dataPayload, id: fallbackId, createdAt: new Date().toISOString() };
      
      const existingIdx = updatedLocalList.findIndex(p => p.id === fallbackId);
      if (existingIdx > -1) {
        updatedLocalList[existingIdx] = payloadWithId;
      } else {
        updatedLocalList.unshift(payloadWithId);
        setSelectedProposalId(fallbackId);
      }
      localStorage.setItem("propostas_bella_white_drafts", JSON.stringify(updatedLocalList));
      setProposals(updatedLocalList);
      alert("Proposta salva localmente (offline)!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedProposalId("");
    setBloco("");
    setApartamento("");
    setRegimeCasamento("");
    setComprador1(defaultComprador());
    setComprador2(defaultComprador());
    setPrecoImovel(250000);
    setSinalValor(12000);
    setSinalParcelas(1);
    setSinalDataPrimeira("");
    setFinConstrutoraValor(18000);
    setFinConstrutoraParcelas(18);
    setFinConstrutoraData("");
    setIntermediariasValor(0);
    setIntermediariasParcelas(0);
    setIntermediariasData("");
    setFinBancarioValor(220000);
    setComissaoValor(15000);
    setComissaoDestinoTotal(15000);
    setComissaoDestinoImobiliaria(7500);
    setComissaoDestinoCorretor(7500);
    setObservacoes("");
    setChecklistC1({
      rgCpf: true,
      certidao: false,
      endereco: true,
      renda: true,
      restricao: true,
      imposto: false,
    });
    setChecklistC2({
      rgCpf: false,
      certidao: false,
      endereco: false,
      renda: false,
      restricao: false,
      imposto: false,
    });
    setTabIndex(0);
  };

  const handleLoadProposal = (prop: any) => {
    setSelectedProposalId(prop.id);
    setBloco(prop.bloco || "");
    setApartamento(prop.apartamento || "");
    setRegimeCasamento(prop.regimeCasamento || "");
    setComprador1(prop.comprador1 || defaultComprador());
    setComprador2(prop.comprador2 || defaultComprador());
    setPrecoImovel(prop.precoImovel ?? 250000);
    setSinalValor(prop.sinalValor ?? 0);
    setSinalParcelas(prop.sinalParcelas ?? 1);
    setSinalDataPrimeira(prop.sinalDataPrimeira || "");
    setFinConstrutoraValor(prop.finConstrutoraValor ?? 0);
    setFinConstrutoraParcelas(prop.finConstrutoraParcelas ?? 1);
    setFinConstrutoraData(prop.finConstrutoraData || "");
    setIntermediariasValor(prop.intermediariasValor ?? 0);
    setIntermediariasParcelas(prop.intermediariasParcelas ?? 0);
    setIntermediariasTipo(prop.intermediariasTipo || "TRIMESTRAIS");
    setIntermediariasData(prop.intermediariasData || "");
    setFinBancarioValor(prop.finBancarioValor ?? 0);
    setComissaoValor(prop.comissaoValor ?? 0);
    setImobiliariaNome(prop.imobiliariaNome || "Fidelité Negócios Imobiliários");
    setImobiliariaCreci(prop.imobiliariaCreci || "33.456-J");
    setCorretorNome(prop.corretorNome || "");
    setCorretorCreci(prop.corretorCreci || "");
    setComissaoDestinoTotal(prop.comissaoDestinoTotal ?? 0);
    setComissaoDestinoImobiliaria(prop.comissaoDestinoImobiliaria ?? 0);
    setComissaoDestinoCorretor(prop.comissaoDestinoCorretor ?? 0);
    setObservacoes(prop.observacoes || "");
    setChecklistC1(prop.checklistC1 || { rgCpf: true, certidao: false, endereco: true, renda: true, restricao: true, imposto: false });
    setChecklistC2(prop.checklistC2 || { rgCpf: false, certidao: false, endereco: false, renda: false, restricao: false, imposto: false });
    setCidadeData(prop.cidadeData || "Bela Vista de Goiás - GO");
    setDataProposta(prop.dataProposta || format(new Date(), "yyyy-MM-dd"));
    setTabIndex(0);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza de que deseja excluir permanentemente esta proposta de compra?")) return;
    try {
      if (id.startsWith("local-")) {
        const localList = proposals.filter(p => p.id !== id);
        localStorage.setItem("propostas_bella_white_drafts", JSON.stringify(localList));
        setProposals(localList);
      } else {
        await deleteDoc(doc(db, "propostas_bella_white", id));
        await loadSavedProposals();
      }
      if (selectedProposalId === id) {
        handleCreateNew();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fmt = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDateLabel = (dtStr: string) => {
    if (!dtStr) return "__/__/____";
    try {
      const parts = dtStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return format(new Date(dtStr), "dd/MM/yyyy");
    } catch (e) {
      return dtStr;
    }
  };

  // Identical 4-page HTML Print Trigger
  const handlePrint = () => {
    const p1DateFormatted = comprador1.dataNascimento ? formatDateLabel(comprador1.dataNascimento) : "___/___/_____";
    const p2DateFormatted = comprador2.dataNascimento ? formatDateLabel(comprador2.dataNascimento) : "___/___/_____";
    const dataEmissaoCustom = dataProposta ? format(new Date(dataProposta + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "___ de ___________ de 202_";

    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      alert("Por favor libere os pop-ups do navegador para visualizar a impressão.");
      return;
    }

    const checkboxHtml = (checked: boolean) => {
      return checked 
        ? `<span style="display:inline-block; width:13px; height:13px; border:1.5px solid #000; background-color:#333; margin-right:6px; line-height:10px; text-align:center; color:#fff; font-size:10px; font-weight:bold; vertical-align:middle;">X</span>`
        : `<span style="display:inline-block; width:13px; height:13px; border:1.5px solid #000; margin-right:6px; vertical-align:middle;"></span>`;
    };

    const isInformalC1 = comprador1.tipoRenda === "INFORMAL";
    const isFormalC1 = comprador1.tipoRenda === "FORMAL";
    const isInformalC2 = comprador2.tipoRenda === "INFORMAL";
    const isFormalC2 = comprador2.tipoRenda === "FORMAL";

    // Build perfect CSS for printing (original style)
    const printContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta de Compra - Bella White</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      color: #000000;
      font-size: 11px;
      line-height: 1.25;
      background: #ffffff;
      padding: 20px;
    }

    /* Regras de Quebra de Página */
    .page-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      position: relative;
    }

    .page-break {
      page-break-after: always;
      position: relative;
      min-height: 1040px; /* Garante tamanho uniforme */
      padding: 25px 30px;
    }

    .page-break:last-child {
      page-break-after: avoid;
    }

    /* Custom Header */
    .header-doc {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .header-title h1 {
      font-size: 20px;
      font-weight: 800;
      color: #1b4d22;
      letter-spacing: -0.02em;
    }

    .header-title h2 {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 2px;
      letter-spacing: 0.05em;
    }

    .page-num {
      font-size: 16px;
      font-weight: 800;
      color: #000;
    }

    /* Paragraphs and sections */
    .welcome-text {
      font-size: 11.5px;
      text-align: justify;
      margin-bottom: 15px;
      font-weight: 500;
      color: #1e293b;
    }

    /* Table grid lines matching perfect layouts */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }

    .grid-table td {
      border: 1px solid #000000;
      padding: 5px 8px;
      vertical-align: top;
    }

    .grid-cell-label {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      display: block;
      margin-bottom: 2px;
    }

    .grid-cell-value {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      min-height: 14px;
    }

    .section-banner {
      background-color: #f1f5f9;
      font-weight: 800;
      font-size: 11px;
      padding: 6px 10px;
      border: 1.5px solid #000;
      border-bottom: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .obs-footer {
      font-size: 9px;
      color: #334155;
      text-align: justify;
      margin-top: 15px;
    }

    .obs-footer ol {
      margin-left: 14px;
    }

    .obs-footer li {
      margin-bottom: 4px;
    }

    /* Assinatura layouts */
    .signatures-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 40px;
      row-gap: 30px;
      margin-top: 40px;
    }

    .sig-line {
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 5px;
      font-size: 9.5px;
      font-weight: bold;
    }

    .sig-subtitle {
      font-size: 8.5px;
      font-weight: 500;
      color: #64748b;
      margin-top: 2px;
    }

    .checklist-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 15px;
    }

    .checklist-col {
      border: 1.5px solid #000;
      border-radius: 4px;
      padding: 10px;
    }

    .checklist-title {
      font-weight: 850;
      font-size: 11px;
      text-transform: uppercase;
      border-bottom: 1.5px solid #000;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    .checklist-item {
      margin-bottom: 8px;
      font-size: 9.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
    }

    /* Payment points list */
    .payments-desc-block {
      border: 1.5px solid #000;
      border-radius: 4px;
      padding: 12px;
      background: #fdfdfd;
      margin-bottom: 15px;
    }

    .payment-term {
      margin-bottom: 15px;
      border-bottom: 1px dashed #cccccc;
      padding-bottom: 12px;
    }

    .payment-term:last-child {
      margin-bottom: 0;
      border-bottom: none;
      padding-bottom: 0;
    }

    .payment-term h4 {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .payment-term p {
      font-size: 11px;
      color: #1e293b;
      line-height: 1.4;
    }

    .payment-term strong {
      text-decoration: underline;
    }

    @media print {
      body {
        padding: 0;
        background: none;
      }
      .page-break {
        border: none !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body onload="window.print()">
  <div class="page-container">
    
    <!-- PAGE 1 -->
    <div class="page-break">
      <div class="header-doc">
        <div class="header-title">
          <h1>PROPOSTA DE COMPRA</h1>
          <h2>CONDOMÍNIO RESIDENCIAL BELLA WHITE</h2>
        </div>
        <div class="page-num">1</div>
      </div>

      <div class="welcome-text">
        Prezado interessado, nos sentimos muito honrados em fazer parte da realização do seu grande sonho!
        Estamos perto de concretizar a conquista do seu imóvel no CONDOMÍNIO RESIDENCIAL BELLA WHITE. Para
        tanto, preencha a Proposta de Compra abaixo. Ressaltamos que as informações solicitadas são exclusivamente
        para uso interno do Departamento Comercial da Construtora Rio Manso e do Correspondente Bancário.
        Então, vamos lá! Por favor, nos informe:
      </div>

      <!-- INTERESSADO 1 -->
      <div class="section-banner">Dados do Interessado (1)</div>
      <table class="grid-table">
        <tr>
          <td colspan="4">
            <span class="grid-cell-label">NOME DO INTERESSADO (1):</span>
            <div class="grid-cell-value">${comprador1.nome || "Não informado"}</div>
          </td>
        </tr>
        <tr>
          <td style="width: 28%;">
            <span class="grid-cell-label">NACIONALIDADE</span>
            <div class="grid-cell-value">${comprador1.nacionalidade || "brasileiro(a)"}</div>
          </td>
          <td style="width: 25%;">
            <span class="grid-cell-label">ESTADO CIVIL</span>
            <div class="grid-cell-value">${comprador1.estadoCivil || "solteiro(a)"}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">DATA NASCIMENTO</span>
            <div class="grid-cell-value">${p1DateFormatted}</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">PROFISSÃO</span>
            <div class="grid-cell-value">${comprador1.profissao || "Não especificada"}</div>
          </td>
          <td>
            <span class="grid-cell-label">IDENTIDADE</span>
            <div class="grid-cell-value">${comprador1.identidade || "______-___"}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">CPF</span>
            <div class="grid-cell-value">${comprador1.cpf || "___.___.___-__"}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="grid-cell-label">ENDEREÇO</span>
            <div class="grid-cell-value">${comprador1.endereco || "Não preenchido"}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">BAIRRO</span>
            <div class="grid-cell-value">${comprador1.bairro || "________________"}</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">CEP</span>
            <div class="grid-cell-value">${comprador1.cep || "_____-___"}</div>
          </td>
          <td>
            <span class="grid-cell-label">CIDADE</span>
            <div class="grid-cell-value">${comprador1.cidade || "________________"}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">ESTADO</span>
            <div class="grid-cell-value">${comprador1.estado || "____"}</div>
          </td>
        </tr>
        <tr>
          <td colspan="4">
            <span class="grid-cell-label">TELEFONES (CELULAR E FIXO) + TELEFONE DE CONTATO(S)</span>
            <div class="grid-cell-value">${comprador1.telefones || "________________"}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="grid-cell-label">E-MAIL:</span>
            <div class="grid-cell-value">${comprador1.email || "________________"}</div>
          </td>
          <td>
            <span class="grid-cell-label">RENDA BRUTA INDIVIDUAL:</span>
            <div class="grid-cell-value">R$ ${fmt(comprador1.rendaBruta)}</div>
          </td>
          <td>
            <span class="grid-cell-label">TIPO DE RENDA:</span>
            <div style="font-size:9.5px; font-weight:bold; margin-top:3px;">
              ${checkboxHtml(isFormalC1)} FORMAL &nbsp;&nbsp;&nbsp;&nbsp; ${checkboxHtml(isInformalC1)} INFORMAL
            </div>
          </td>
        </tr>
      </table>

      <!-- INTERESSADO 2 -->
      <div class="section-banner">Dados do Interessado (2) OU CÔNJUGE</div>
      <table class="grid-table">
        <tr>
          <td colspan="4">
            <span class="grid-cell-label">NOME INTERESTADO (2) OU CÔNJUGE:</span>
            <div class="grid-cell-value">${comprador2.nome || "Não se aplica / Em branco"}</div>
          </td>
        </tr>
        <tr>
          <td style="width: 28%;">
            <span class="grid-cell-label">NACIONALIDADE</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.nacionalidade || "brasileiro(a)") : ""}</div>
          </td>
          <td style="width: 25%;">
            <span class="grid-cell-label">ESTADO CIVIL</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.estadoCivil || "solteiro(a)") : ""}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">DATA NASCIMENTO</span>
            <div class="grid-cell-value">${comprador2.nome ? p2DateFormatted : ""}</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">PROFISSÃO</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.profissao || "_________________") : ""}</div>
          </td>
          <td>
            <span class="grid-cell-label">IDENTIDADE</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.identidade || "_________________") : ""}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">CPF</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.cpf || "___.___.___-__") : ""}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="grid-cell-label">ENDEREÇO</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.endereco || "_________________") : ""}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">BAIRRO</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.bairro || "_________________") : ""}</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">CEP</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.cep || "_____-___") : ""}</div>
          </td>
          <td>
            <span class="grid-cell-label">CIDADE</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.cidade || "_________________") : ""}</div>
          </td>
          <td colspan="2">
            <span class="grid-cell-label">ESTADO</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.estado || "___") : ""}</div>
          </td>
        </tr>
        <tr>
          <td colspan="4">
            <span class="grid-cell-label">TELEFONES DE CONTATO</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.telefones || "_________________") : ""}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <span class="grid-cell-label">E-MAIL</span>
            <div class="grid-cell-value">${comprador2.nome ? (comprador2.email || "_________________") : ""}</div>
          </td>
          <td>
            <span class="grid-cell-label">RENDA BRUTA INDIVIDUAL</span>
            <div class="grid-cell-value">${comprador2.nome ? `R$ ${fmt(comprador2.rendaBruta)}` : ""}</div>
          </td>
          <td>
            <span class="grid-cell-label">TIPO DE RENDA</span>
            <div style="font-size:9.5px; font-weight:bold; margin-top:3px;">
              ${comprador2.nome ? `${checkboxHtml(isFormalC2)} FORMAL &nbsp;&nbsp;&nbsp;&nbsp; ${checkboxHtml(isInformalC2)} INFORMAL` : ""}
            </div>
          </td>
        </tr>
      </table>

      <!-- REGIME CASAMENTO & ALOCACAO -->
      <table class="grid-table" style="margin-top: 5px;">
        <tr>
          <td style="width: 50%;">
            <span class="grid-cell-label">REGIME DE CASAMENTO:</span>
            <div class="grid-cell-value">${regimeCasamento || "_________________"}</div>
          </td>
          <td style="width: 25%;">
            <span class="grid-cell-label">BLOCO</span>
            <div class="grid-cell-value" style="font-size:13px; font-weight:800;">${bloco || "_____"}</div>
          </td>
          <td style="width: 25%;">
            <span class="grid-cell-label">APARTAMENTO</span>
            <div class="grid-cell-value" style="font-size:13px; font-weight:800;">${apartamento || "_____"}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- PAGE 2 -->
    <div class="page-break">
      <div class="header-doc">
        <div class="header-title">
          <h1>PROPOSTA DE COMPRA</h1>
          <h2>CONDOMÍNIO RESIDENCIAL BELLA WHITE</h2>
        </div>
        <div class="page-num">2</div>
      </div>

      <table class="grid-table" style="margin-bottom: 20px;">
        <tr>
          <td>
            <span class="grid-cell-label">PROMITENTE VENDEDORA:</span>
            <div class="grid-cell-value" style="font-weight: 500; font-size:10px; line-height: 1.4;">
              <strong>CONSTRUTORA RIO MANSO LTDA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o número 05.124.311/0001-86, estabelecida na Avenida José Walter, Quadra 96, Lote 02, Setor Morada do Sol, Rio Verde – GO.
            </div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">PREÇO DO IMÓVEL:</span>
            <div style="font-size:18px; font-weight:850; padding:4px 0; color:#1b4d22; font-family: 'Inter', sans-serif;">
              R$ ${fmt(precoImovel)}
            </div>
          </td>
        </tr>
      </table>

      <div class="section-banner">FORMA DE PAGAMENTO DO PREÇO DO IMÓVEL:</div>
      <div class="payments-desc-block">
        
        <!-- SINAL -->
        <div class="payment-term">
          <h4>- SINAL de: R$ <strong>${fmt(sinalValor)}</strong></h4>
          <p>
            A ser pago mediante <strong>${sinalParcelas}</strong> prestações mensais e consecutivas no valor de
            <strong>R$ ${fmt(sinalParcelaValor)}</strong> cada uma, vencendo a primeira parcela em 
            <strong>${sinalDataPrimeira ? formatDateLabel(sinalDataPrimeira) : "__ /__ /____"}</strong> e as demais nos mesmos dias dos meses subsequentes.
          </p>
        </div>

        <!-- FINANCIAMENTO CONSTRUTORA -->
        <div class="payment-term">
          <h4>- FINANCIAMENTO CONSTRUTORA RIO MANSO de: R$ <strong>${fmt(finConstrutoraValor)}</strong></h4>
          <p>
            A serem pagos mediante <strong>${finConstrutoraParcelas}</strong> prestações mensais e consecutivas no valor de
            <strong>R$ ${fmt(finConstrutoraParcelaValor)}</strong> cada uma, vencendo a primeira parcela em 
            <strong>${finConstrutoraData ? formatDateLabel(finConstrutoraData) : "__ /__ /____"}</strong> e as demais nos mesmos dias dos meses subsequentes, sujeitas à atualização monetária anual e reajustes descritos abaixo.
          </p>
        </div>

        <!-- PARCELAS INTERMEDIARIAS -->
        <div class="payment-term">
          <h4>- PARCELAS INTERMEDIÁRIAS (se houver) de: R$ <strong>${fmt(intermediariasValor)}</strong></h4>
          <p>
            Mediante <strong>${intermediariasParcelas}</strong> parcelas <strong>${intermediariasTipo}</strong> no valor de
            <strong>R$ ${fmt(intermediariasParcelaValor)}</strong> cada uma, vencendo a primeira parcela em
            <strong>${intermediariasData ? formatDateLabel(intermediariasData) : "__ /__ /____"}</strong> e as demais parcelas nas mesmas datas, sujeitas a atualizações e juros legais.
          </p>
        </div>

        <!-- FINANCIAMENTO BANCARIO -->
        <div class="payment-term">
          <h4>- FINANCIAMENTO BANCÁRIO, SUBSÍDIO E FGTS (se houver):</h4>
          <p style="font-size:11.5px; line-height: 1.5; margin-top:5px;">
            Valor correspondente de R$ <strong style="font-size:13px; color:#1b4d22;">${fmt(finBancarioValor)}</strong> pagos mediante a contratação de financiamento bancário junto ao Agente Financeiro (CAIXA ECONÔMICA FEDERAL) no momento em que a Promitente Vendedora informar. Mencionados valores dependem de análise e aprovação cadastral e documental.
          </p>
        </div>

      </div>

      <div class="obs-footer">
        <strong>OBSERVAÇÕES QUANTO AO PREÇO</strong>
        <ol style="margin-top:4px;">
          <li>O não pagamento do sinal na data indicada no boleto bancário emitido pela PROMITENTE VENDEDORA implicará na rescisão automática do contrato, independente de prévia notificação, caso em que a unidade será liberada para nova venda.</li>
          <li>Tanto as parcelas de recursos próprios quanto o saldo de financiamento e FGTS serão reajustados mensalmente; sendo pelo INCC durante a construção e, após a construção, pelo IGPM/FGV.</li>
          <li>A partir do fim da construção, as parcelas que restarem serão acrescidas de juros de 1% (um por cento) ao mês, calculados pela Tabela PRICE (Sistema Francês de Amortização) desde a data de assinatura do presente contrato.</li>
          <li>Por "fim da construção" entende-se a emissão e averbação do Habite-se junto à matrícula do empreendimento.</li>
        </ol>
      </div>
    </div>

    <!-- PAGE 3 -->
    <div class="page-break">
      <div class="header-doc">
        <div class="header-title">
          <h1>PROPOSTA DE COMPRA</h1>
          <h2>CONDOMÍNIO RESIDENCIAL BELLA WHITE</h2>
        </div>
        <div class="page-num">3</div>
      </div>

      <div class="section-banner">INTERMEDIAÇÃO DE CORRETAGEM</div>
      <table class="grid-table">
        <tr>
          <td colspan="2">
            <span class="grid-cell-label">VALOR TOTAL DA COMISSÃO:</span>
            <div class="grid-cell-value" style="font-size: 15px; font-weight:800; color:#1d4ed8;">
              R$ ${fmt(comissaoValor)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="width: 70%;">
            <span class="grid-cell-label">IMOBILIÁRIA:</span>
            <div class="grid-cell-value">${imobiliariaNome || "FIDELITÉ IMOBILIÁRIA"}</div>
          </td>
          <td style="width: 30%;">
            <span class="grid-cell-label">CRECI IMOBILIÁRIA:</span>
            <div class="grid-cell-value">${imobiliariaCreci || "_____"}</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">CORRETOR (A) QUE INTERMEDIOU A VENDA:</span>
            <div class="grid-cell-value">${corretorNome || "_________________"}</div>
          </td>
          <td>
            <span class="grid-cell-label">CRECI CORRETOR:</span>
            <div class="grid-cell-value">${corretorCreci || "_____"}</div>
          </td>
        </tr>
      </table>

      <!-- FORMA DE PAGAMENTO INTERMEDIACAO -->
      <div class="section-banner" style="background-color: #f8fafc;">FORMA DE PAGAMENTO DA COMISSÃO:</div>
      <table class="grid-table">
        <tr>
          <td>
            <span class="grid-cell-label">• DO VALOR:</span>
            <div class="grid-cell-value">R$ ${fmt(comissaoDestinoTotal)}</div>
            <div style="font-size: 8.5px; color:#555; margin-top:2px;">pagamento de responsabilidade integral do CLIENTE diretamente à imobiliária e/ou corretor autorizado</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">• IMOBILIÁRIA:</span>
            <div class="grid-cell-value">R$ ${fmt(comissaoDestinoImobiliaria)}</div>
            <div style="font-size: 8.5px; color:#555; margin-top:2px;">pagamento correspondente de responsabilidade do CLIENTE, destinado diretamente à Imobiliária.</div>
          </td>
        </tr>
        <tr>
          <td>
            <span class="grid-cell-label">• CORRETOR:</span>
            <div class="grid-cell-value">R$ ${fmt(comissaoDestinoCorretor)}</div>
            <div style="font-size: 8.5px; color:#555; margin-top:2px;">pagamento correspondente de responsabilidade do CLIENTE, destinado diretamente ao Corretores credenciados.</div>
          </td>
        </tr>
      </table>

      <!-- SPACER COMPROMISSO -->
      <div style="border: 1px solid #000; padding:15px; border-radius:4px; margin-bottom: 20px;">
        <div style="min-height: 50px; border-bottom:1px solid #000; margin-bottom:5px;"></div>
        <div style="text-align:center; font-size:9px; font-weight:bold; text-transform:uppercase; color:#475569;">
          ASSINATURA DO RESPONSÁVEL DA IMOBILIÁRIA RESPONSÁVEL PELA VENDA <br/>
          <span style="font-size:8px; font-weight:500;">Corretor (a) responsável pela venda</span>
        </div>
      </div>

      <div class="section-banner">DESPESAS ACESSÓRIAS <span style="font-size: 7.5px; font-weight:500;">(utilizado para contratos que tiver Financiamento Bancário)</span></div>
      <table class="grid-table">
        <tr>
          <td>
            <span class="grid-cell-label">QUEM PAGA:</span>
            <div style="font-size:10px; font-weight:800; text-transform:uppercase; margin-bottom: 4px;">INTERESSADO ADQUIRENTE</div>
            <div style="font-size: 9.5px; color:#334155; text-align:justify; line-height:1.3;">
              Fica avençado que correrão por conta do INTERESSADO ADQUIRENTE o pagamento das despesas acessórias tais como a emissão e registro do contrato de financiamento, taxas incidentes, registros cartorários e avaliações bancárias.
            </div>
          </td>
        </tr>
      </table>

      <!-- OBSERVAÇÕES -->
      <div class="section-banner">OBSERVAÇÕES ADICIONAIS</div>
      <table class="grid-table">
        <tr>
          <td style="min-height: 120px;">
            <div style="font-size: 11px; white-space: pre-wrap; font-weight: 500; min-height:110px;">${observacoes || "Nenhuma observação acrescida."}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- PAGE 4 -->
    <div class="page-break">
      <div class="header-doc">
        <div class="header-title">
          <h1>PROPOSTA DE COMPRA</h1>
          <h2>CONDOMÍNIO RESIDENCIAL BELLA WHITE</h2>
        </div>
        <div class="page-num">4</div>
      </div>

      <div class="section-banner">AUTORIZAÇÃO PARA FORNECIMENTO DE DADOS CADASTRAIS E TRATAMENTO DE DADOS</div>
      <div style="border: 1px solid #000; padding:12px; font-size:9px; line-height:1.4; text-align:justify; margin-bottom:15px; background:#f9fafb;">
        <p style="margin-bottom:6px;"><strong>I.</strong> Pelo presente instrumento e na melhor forma de direito, o <strong>INTERESSADO ADQUIRENTE</strong> informa expressamente que <strong>AUTORIZA</strong> que a <strong>PROMITENTE VENDEDORA – AGENTE PROMOTORA</strong> forneça à instituição financeira e Correspondente Bancário os dados cadastrais a fim de se verificar e, uma vez aprovado, viabilizar a contratação do financiamento para pagamento do saldo devedor.</p>
        <p style="margin-bottom:6px;"><strong>II.</strong> Autoriza, ainda, que os dados fornecidos neste instrumento sejam repassados, processados e tratados por empresas terceiras especializadas na análise de crédito do proponente e obtenção de viabilidade comercial para continuidade do negócio, ficando certo e esclarecido que, caso haja retorno negativo sobre a análise de crédito, poderá a <strong>AGENTE PROMOTORA – VENDEDORA</strong> declinar do negócio.</p>
        <p><strong>III.</strong> A <strong>PROMITENTE VENDEDORA</strong> fornecerá e armazenará os documentos abaixo listados, ressalvada no direito de solicitar outros porventura exigidos.</p>
        <p style="font-weight:800; text-align:center; border-top:1px dashed #bbb; padding-top:6px; margin-top:8px; font-size:9.5px; text-transform:uppercase;">Ao assinar o presente instrumento o proponente declara estar expressamente ciente das informações aqui contidas.</p>
      </div>

      <div style="font-weight: 800; font-size:11px; text-transform: uppercase; margin-bottom: 5px;">
        Checklist de Documentos INDISPENSÁVEIS para a oficialização de Proposta:
      </div>

      <div class="checklist-container">
        <!-- COMPRADOR 1 CHECKLIST -->
        <div class="checklist-col">
          <div class="checklist-title">Interessado 1</div>
          <div class="checklist-item">${checkboxHtml(checklistC1.rgCpf)} RG, CPF ou CNH</div>
          <div class="checklist-item">${checkboxHtml(checklistC1.certidao)} Certidão de Casamento ou Nascimento</div>
          <div class="checklist-item">${checkboxHtml(checklistC1.endereco)} Comprovante de Endereço Mês Atual</div>
          <div class="checklist-item">${checkboxHtml(checklistC1.renda)} Comprovante de Renda Mês Atual</div>
          <div class="checklist-item">${checkboxHtml(checklistC1.restricao)} Consulta Restrição (Rio Manso)</div>
          <div class="checklist-item">${checkboxHtml(checklistC1.imposto)} Imposto de Renda completo</div>
        </div>

        <!-- COMPRADOR 2 CHECKLIST -->
        <div class="checklist-col">
          <div class="checklist-title">Cônjuge ou Interessado 2</div>
          <div class="checklist-item">${checkboxHtml(checklistC2.rgCpf)} RG, CPF ou CNH</div>
          <div class="checklist-item">${checkboxHtml(checklistC2.certidao)} Certidão de Casamento ou Nascimento</div>
          <div class="checklist-item">${checkboxHtml(checklistC2.endereco)} Comprovante de Endereço Mês Atual</div>
          <div class="checklist-item">${checkboxHtml(checklistC2.renda)} Comprovante de Renda Mês Atual</div>
          <div class="checklist-item">${checkboxHtml(checklistC2.restricao)} Consulta Restrição (Rio Manso)</div>
          <div class="checklist-item">${checkboxHtml(checklistC2.imposto)} Imposto de Renda completo</div>
        </div>
      </div>

      <!-- LOCAL & DATA -->
      <div style="margin-top: 35px; font-weight:800; font-size: 11.5px; text-align: center;">
        ${cidadeData}, ${dataEmissaoCustom}.
      </div>

      <!-- SIGNATURE LINES -->
      <div class="signatures-block">
        <div>
          <div class="sig-line">Interessado 1</div>
          <div class="sig-subtitle">Proponente Comprador Titular</div>
        </div>
        <div>
          <div class="sig-line">Interessado 2 ou Cônjuge</div>
          <div class="sig-subtitle">Cônjuge / Segundo Proponente</div>
        </div>
        <div>
          <div class="sig-line" style="margin-top:10px;">CONSTRUTORA RIO MANSO</div>
          <div class="sig-subtitle">Gerência Comercial / Representante</div>
        </div>
        <div>
          <div class="sig-line" style="margin-top:10px;">CORRETOR RESPONSÁVEL</div>
          <div class="sig-subtitle">Assinatura legível / CRECI credenciado</div>
        </div>
      </div>

    </div>

  </div>
</body>
</html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
      
      {/* SEÇÃO DA ESQUERDA: LISTA E DADOS (7 colunas) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Card: Cabeçalho com Seletor de Histórico */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
                <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                <span>Gerador de Contratos de Vendas</span>
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1">
                Bella White Proposta Oficial
              </h2>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Preencha e emita propostas de compra idênticas ao formulário impresso original da Construtora Rio Manso.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nova
              </button>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-sm shadow-indigo-100 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {isSaving ? "Gravando..." : "Gravar Rascunho"}
              </button>
            </div>
          </div>

          {/* List/Select de Rascunhos Cadastrados */}
          {proposals.length > 0 && (
            <div className="bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
              <label className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">
                Rascunhos de Propostas Salvas ({proposals.length})
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleLoadProposal(p)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      selectedProposalId === p.id 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold shadow-sm" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate max-w-[150px]">
                      {p.comprador1?.nome || "Proposta Sem Nome"}
                    </span>
                    {p.apartamento && (
                      <span className="text-[10px] bg-slate-150 px-1 rounded text-slate-500 font-mono">
                        Ap {p.apartamento}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="p-1 hover:text-red-500 text-slate-400 rounded-lg transition-colors ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Wizard Multi-Abas do Formulário */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          
          {/* Menu de Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/30 overflow-x-auto">
            {[
              { label: "1. Compradores", icon: User },
              { label: "2. Condições Comerciais", icon: DollarSign },
              { label: "3. Intermediação & Obs", icon: FileText },
              { label: "4. Checklist & Data", icon: CheckSquare }
            ].map((tab, idx) => (
              <button
                key={idx}
                onClick={() => setTabIndex(idx)}
                className={`flex items-center gap-1.5 py-3 px-4 text-[10px] font-black uppercase tracking-wider border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  tabIndex === idx 
                    ? "border-indigo-600 text-indigo-700 bg-white shadow-sm" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-6 space-y-6">

            {/* TAB 1: DADOS COMPRADOR 1 & COMPRADOR 2 */}
            {tabIndex === 0 && (
              <div className="space-y-6">
                
                {/* ID Imóvel */}
                <div className="bg-slate-50 p-4 rounded-2xl grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bloco</label>
                    <input
                      type="text"
                      value={bloco}
                      onChange={(e) => setBloco(e.target.value)}
                      placeholder="Ex: A"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Apartamento</label>
                    <input
                      type="text"
                      value={apartamento}
                      onChange={(e) => setApartamento(e.target.value)}
                      placeholder="Ex: 104"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Regime Casamento</label>
                    <input
                      type="text"
                      value={regimeCasamento}
                      onChange={(e) => setRegimeCasamento(e.target.value)}
                      placeholder="Comunhão Parcial"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Comprador 1 */}
                <div className="space-y-4">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>Dados do Interessado / Comprador Titular (1)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-8">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nome do Interessado</label>
                      <input
                        type="text"
                        value={comprador1.nome}
                        onChange={(e) => setComprador1({...comprador1, nome: e.target.value})}
                        placeholder="Nome Completo"
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">CPF</label>
                      <input
                        type="text"
                        value={comprador1.cpf}
                        onChange={(e) => setComprador1({...comprador1, cpf: e.target.value})}
                        placeholder="___.___.___-__"
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nacionalidade</label>
                      <input
                        type="text"
                        value={comprador1.nacionalidade}
                        onChange={(e) => setComprador1({...comprador1, nacionalidade: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Estado Civil</label>
                      <input
                        type="text"
                        value={comprador1.estadoCivil}
                        onChange={(e) => setComprador1({...comprador1, estadoCivil: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Data de Nascimento</label>
                      <input
                        type="date"
                        value={comprador1.dataNascimento}
                        onChange={(e) => setComprador1({...comprador1, dataNascimento: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Profissão</label>
                      <input
                        type="text"
                        value={comprador1.profissao}
                        onChange={(e) => setComprador1({...comprador1, profissao: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">RG / Identidade</label>
                      <input
                        type="text"
                        value={comprador1.identidade}
                        onChange={(e) => setComprador1({...comprador1, identidade: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Renda Bruta</label>
                      <BrlInput
                        value={comprador1.rendaBruta}
                        onChange={(val) => setComprador1({...comprador1, rendaBruta: val})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                      />
                    </div>

                    <div className="md:col-span-8">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Endereço Residencial</label>
                      <input
                        type="text"
                        value={comprador1.endereco}
                        onChange={(e) => setComprador1({...comprador1, endereco: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Bairro</label>
                      <input
                        type="text"
                        value={comprador1.bairro}
                        onChange={(e) => setComprador1({...comprador1, bairro: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">CEP</label>
                      <input
                        type="text"
                        value={comprador1.cep}
                        onChange={(e) => setComprador1({...comprador1, cep: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Cidade</label>
                      <input
                        type="text"
                        value={comprador1.cidade}
                        onChange={(e) => setComprador1({...comprador1, cidade: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">UF (Estado)</label>
                      <input
                        type="text"
                        value={comprador1.estado}
                        onChange={(e) => setComprador1({...comprador1, estado: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Tipo Renda</label>
                      <select
                        value={comprador1.tipoRenda}
                        onChange={(e) => setComprador1({...comprador1, tipoRenda: e.target.value as any})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-805 font-semibold"
                      >
                        <option value="FORMAL">Formal (Holerite / Pró Labore)</option>
                        <option value="INFORMAL">Informal (Autônomo / Extratos)</option>
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Telefones</label>
                      <input
                        type="text"
                        value={comprador1.telefones}
                        onChange={(e) => setComprador1({...comprador1, telefones: e.target.value})}
                        placeholder="Celular e Fixo"
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">E-mail</label>
                      <input
                        type="text"
                        value={comprador1.email}
                        onChange={(e) => setComprador1({...comprador1, email: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Comprador 2 */}
                <div className="space-y-4">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-500" />
                    <span>Dados do Interessado (2) OU CÔNJUGE</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-8">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nome do Cônjuge/Seg. Proponente</label>
                      <input
                        type="text"
                        value={comprador2.nome}
                        onChange={(e) => setComprador2({...comprador2, nome: e.target.value})}
                        placeholder="Nome Completo (Deixe em branco se solteiro sem 2º comprador)"
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">CPF</label>
                      <input
                        type="text"
                        value={comprador2.cpf}
                        onChange={(e) => setComprador2({...comprador2, cpf: e.target.value})}
                        placeholder="___.___.___-__"
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                        disabled={!comprador2.nome}
                      />
                    </div>

                    {comprador2.nome && (
                      <>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Nacionalidade</label>
                          <input
                            type="text"
                            value={comprador2.nacionalidade}
                            onChange={(e) => setComprador2({...comprador2, nacionalidade: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Estado Civil</label>
                          <input
                            type="text"
                            value={comprador2.estadoCivil}
                            onChange={(e) => setComprador2({...comprador2, estadoCivil: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Data de Nascimento</label>
                          <input
                            type="date"
                            value={comprador2.dataNascimento}
                            onChange={(e) => setComprador2({...comprador2, dataNascimento: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Profissão</label>
                          <input
                            type="text"
                            value={comprador2.profissao}
                            onChange={(e) => setComprador2({...comprador2, profissao: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">RG / Identidade</label>
                          <input
                            type="text"
                            value={comprador2.identidade}
                            onChange={(e) => setComprador2({...comprador2, identidade: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Renda Bruta</label>
                          <BrlInput
                            value={comprador2.rendaBruta}
                            onChange={(val) => setComprador2({...comprador2, rendaBruta: val})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                          />
                        </div>

                        <div className="md:col-span-8">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Endereço</label>
                          <input
                            type="text"
                            value={comprador2.endereco}
                            onChange={(e) => setComprador2({...comprador2, endereco: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Bairro</label>
                          <input
                            type="text"
                            value={comprador2.bairro}
                            onChange={(e) => setComprador2({...comprador2, bairro: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Tipo Renda</label>
                          <select
                            value={comprador2.tipoRenda}
                            onChange={(e) => setComprador2({...comprador2, tipoRenda: e.target.value as any})}
                            className="w-full bg-slate-50 border border-slate-100  focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-850 font-semibold"
                          >
                            <option value="FORMAL">Formal</option>
                            <option value="INFORMAL">Informal</option>
                          </select>
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Telefones</label>
                          <input
                            type="text"
                            value={comprador2.telefones}
                            onChange={(e) => setComprador2({...comprador2, telefones: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">E-mail</label>
                          <input
                            type="text"
                            value={comprador2.email}
                            onChange={(e) => setComprador2({...comprador2, email: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: CONDIÇÕES COMERCIAIS */}
            {tabIndex === 1 && (
              <div className="space-y-6">
                
                {/* Preço do Imóvel Principal */}
                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Preço Comercial do Imóvel</span>
                    <h3 className="text-sm text-slate-600 font-medium">Condomínio Residencial Bella White</h3>
                  </div>
                  <div className="w-full md:w-64">
                    <BrlInput
                      value={precoImovel}
                      onChange={setPrecoImovel}
                      className="w-full bg-white border border-emerald-200 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-lg font-black text-emerald-950 focus:outline-none"
                    />
                  </div>
                </div>

                {/* SINAL */}
                <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center justify-between">
                    <span>1. Condição de Entrada / SINAL</span>
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-lg text-[10px]">RECURSO PRÓPRIO</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Valor Total do Sinal (Sinal)</label>
                      <BrlInput
                        value={sinalValor}
                        onChange={setSinalValor}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-extrabold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Parcelas (Sinal)</label>
                      <input
                        type="number"
                        value={sinalParcelas || ""}
                        onChange={(e) => setSinalParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Vcto. 1ª Parcela</label>
                      <input
                        type="date"
                        value={sinalDataPrimeira}
                        onChange={(e) => setSinalDataPrimeira(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  {sinalParcelas > 1 && (
                    <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl font-medium">
                      ➔ Equivale a <span className="font-bold text-slate-800">{sinalParcelas} parcelas mensais</span> de <span className="font-extrabold text-indigo-600">R$ {fmt(sinalParcelaValor)}</span>
                    </div>
                  )}
                </div>

                {/* SINAL CONSTRUTORA */}
                <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center justify-between">
                    <span>2. Financiamento Direto Construtora Rio Manso</span>
                    <span className="bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-lg text-[10px]">PARCELAMENTO LONGO</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Saldo Financiado Construtora</label>
                      <BrlInput
                        value={finConstrutoraValor}
                        onChange={setFinConstrutoraValor}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-extrabold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Mesas / Parcelas</label>
                      <input
                        type="number"
                        value={finConstrutoraParcelas || ""}
                        onChange={(e) => setFinConstrutoraParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Data Início</label>
                      <input
                        type="date"
                        value={finConstrutoraData}
                        onChange={(e) => setFinConstrutoraData(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  {finConstrutoraParcelas > 0 && (
                    <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl font-medium">
                      ➔ Equivale a <span className="font-bold text-slate-800">{finConstrutoraParcelas}x de</span> <span className="font-extrabold text-amber-700">R$ {fmt(finConstrutoraParcelaValor)} / mês</span>
                    </div>
                  )}
                </div>

                {/* PARCELAS INTERMEDIARIAS */}
                <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center justify-between">
                    <span>3. Balões / Parcelas Intermediárias</span>
                    <span className="bg-purple-50 text-purple-700 font-bold px-2.5 py-0.5 rounded-lg text-[10px]">ANUAIS / SEMESTRAIS</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Valor Total Balões</label>
                      <BrlInput
                        value={intermediariasValor}
                        onChange={setIntermediariasValor}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-extrabold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Qtd Parcelas</label>
                      <input
                        type="number"
                        value={intermediariasParcelas || ""}
                        onChange={(e) => setIntermediariasParcelas(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Periodicidade</label>
                      <select
                        value={intermediariasTipo}
                        onChange={(e) => setIntermediariasTipo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                      >
                        <option value="TRIMESTRAIS">TRIMESTRAIS</option>
                        <option value="SEMESTRAIS">SEMESTRAIS</option>
                        <option value="ANUAIS">ANUAIS</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Primeiro Vcto.</label>
                      <input
                        type="date"
                        value={intermediariasData}
                        onChange={(e) => setIntermediariasData(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  {intermediariasParcelas > 0 && (
                    <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl font-medium">
                      ➔ Equivale a <span className="font-bold text-slate-800">{intermediariasParcelas}x intermediárias {intermediariasTipo.toLowerCase()} de</span> <span className="font-extrabold text-purple-700">R$ {fmt(intermediariasParcelaValor)}</span>
                    </div>
                  )}
                </div>

                {/* FGTS E FINANCIAMENTO BANCARIO */}
                <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center justify-between">
                    <span>4. Financiamento Bancário Estimado (Caixa Econômica)</span>
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-lg text-[10px]">CEF / RETORNO DIGITAL</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Valor Financiamento + Subsídio + FGTS</label>
                      <BrlInput
                        value={finBancarioValor}
                        onChange={setFinBancarioValor}
                        className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-extrabold"
                      />
                    </div>
                    <div className="bg-slate-50/70 p-3 rounded-xl flex items-center gap-2">
                      <Info className="w-5 h-5 text-indigo-500 shrink-0" />
                      <div className="text-[10px] text-slate-500 font-medium leading-relaxed">
                        Defina o valor simulado no correspondente. Este patamar constará na proposta impressa sob as condições da Caixa Federal.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balanço Geral de Consistência */}
                <div className="p-4 bg-slate-100/55 rounded-2xl flex flex-wrap items-center justify-between gap-4 font-bold text-xs text-slate-600">
                  <div className="space-y-1">
                    <span>Preço do Imóvel: <strong className="text-slate-800">R$ {fmt(precoImovel)}</strong></span>
                    <span className="block text-[10px] font-medium text-slate-400">Renda Conjunta: R$ {fmt(comprador1.rendaBruta + comprador2.rendaBruta)}/mês</span>
                  </div>
                  <div className="flex gap-4">
                    <span>Composição Comercial: <strong className="text-indigo-600 font-extrabold">R$ {fmt(sinalValor + finConstrutoraValor + intermediariasValor + finBancarioValor)}</strong></span>
                    {Math.abs(precoImovel - (sinalValor + finConstrutoraValor + intermediariasValor + finBancarioValor)) > 0.5 ? (
                      <span className="text-amber-600 font-black animate-pulse">
                        ⚠️ Diferença de R$ {fmt(Math.abs(precoImovel - (sinalValor + finConstrutoraValor + intermediariasValor + finBancarioValor)))}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-black">
                        ✓ Valores Batem!
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: CORRETAGEM & OBSERVAÇÕES */}
            {tabIndex === 2 && (
              <div className="space-y-6">
                
                {/* Intermediação de corretagem */}
                <div className="space-y-4">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>Detalhes de Corretagem (Comissão)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Valor da Comissão (R$)</label>
                      <BrlInput
                        value={comissaoValor}
                        onChange={(val) => {
                          setComissaoValor(val);
                          setComissaoDestinoTotal(val);
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-extrabold"
                      />
                    </div>
                    
                    <div className="md:col-span-5">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Imobiliária Responsável</label>
                      <input
                        type="text"
                        value={imobiliariaNome}
                        onChange={(e) => setImobiliariaNome(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Creci Imobiliária</label>
                      <input
                        type="text"
                        value={imobiliariaCreci}
                        onChange={(e) => setImobiliariaCreci(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>

                    <div className="md:col-span-8">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Corretor que Intermediou</label>
                      <input
                        type="text"
                        value={corretorNome}
                        onChange={(e) => setCorretorNome(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">CRECI Corretor</label>
                      <input
                        type="text"
                        value={corretorCreci}
                        onChange={(e) => setCorretorCreci(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Destinação do pagamento */}
                <div className="space-y-4">
                  <div className="text-xs font-black uppercase text-indigo-600 flex items-center justify-between">
                    <span>Destinação Própria das Frações da Comissão</span>
                    <span className="text-[10px] text-slate-400">Filtro de Responsabilidade</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Total Responsabilidade</label>
                      <BrlInput
                        value={comissaoDestinoTotal}
                        onChange={setComissaoDestinoTotal}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-850 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Fração Destinada à Imobiliária</label>
                      <BrlInput
                        value={comissaoDestinoImobiliaria}
                        onChange={setComissaoDestinoImobiliaria}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Fração Destinada ao Corretor</label>
                      <BrlInput
                        value={comissaoDestinoCorretor}
                        onChange={setComissaoDestinoCorretor}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Observações da tabela */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-indigo-600">Observações Adicionais (Contará na página 3)</label>
                  <textarea
                    rows={4}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Indique condições para repasse ou observações fiscais pertinentes..."
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm text-slate-700 font-medium focus:outline-none"
                  />
                </div>

              </div>
            )}

            {/* TAB 4: CHECKLIST E ASSINATURAS */}
            {tabIndex === 3 && (
              <div className="space-y-6">
                
                <div className="text-xs font-black uppercase text-indigo-600">
                  Checklist de Documentos de Validação
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Checklist Interessado 1 */}
                  <div className="p-4 bg-slate-50/60 rounded-3xl border border-slate-100 space-y-2.5">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b pb-1.5 mb-2">Interessado Principal (1)</span>
                    {Object.keys(checklistC1).map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 select-none">
                        <input
                          type="checkbox"
                          checked={checklistC1[key]}
                          onChange={(e) => setChecklistC1({...checklistC1, [key]: e.target.checked})}
                          className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-200 focus:ring-indigo-500"
                        />
                        <span className="capitalize">
                          {key === "rgCpf" && "RG, CPF ou CNH"}
                          {key === "certidao" && "Certidão de Casamento/Nascimento"}
                          {key === "endereco" && "Comprovante de Endereço Mês Atual"}
                          {key === "renda" && "Comprovante de Renda Mês Atual"}
                          {key === "restricao" && "Consulta de Restrição Rio Manso"}
                          {key === "imposto" && "Declaração de Imposto de Renda"}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Checklist Interessado 2 */}
                  <div className="p-4 bg-slate-50/60 rounded-3xl border border-slate-100 space-y-2.5">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-450 border-b pb-1.5 mb-2">Interessado 2 / Cônjuge</span>
                    {Object.keys(checklistC2).map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 select-none">
                        <input
                          type="checkbox"
                          checked={checklistC2[key]}
                          onChange={(e) => setChecklistC2({...checklistC2, [key]: e.target.checked})}
                          className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-200 focus:ring-indigo-500"
                        />
                        <span className="capitalize">
                          {key === "rgCpf" && "RG, CPF ou CNH"}
                          {key === "certidao" && "Certidão de Casamento/Nascimento"}
                          {key === "endereco" && "Comprovante de Endereço Mês Atual"}
                          {key === "renda" && "Comprovante de Renda Mês Atual"}
                          {key === "restricao" && "Consulta de Restrição Rio Manso"}
                          {key === "imposto" && "Declaração de Imposto de Renda"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* LOCAL E DATA */}
                <div className="space-y-4">
                  <div className="text-xs font-black uppercase text-indigo-600">
                    Localização & Data de Emissão da Proposta
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Local (Cidade/UF)</label>
                      <input
                        type="text"
                        value={cidadeData}
                        onChange={(e) => setCidadeData(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Data Proposta</label>
                      <input
                        type="date"
                        value={dataProposta}
                        onChange={(e) => setDataProposta(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
          
          {/* Footer do Wizard com navegação */}
          <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setTabIndex(prev => Math.max(0, prev - 1))}
              disabled={tabIndex === 0}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-500 cursor-pointer disabled:opacity-40"
            >
              Anterior
            </button>

            <span className="text-[10px] font-bold text-slate-450 uppercase">Formulário Digital — Página {tabIndex + 1} de 4</span>

            <button
              onClick={() => {
                if (tabIndex < 3) {
                  setTabIndex(tabIndex + 1);
                } else {
                  handlePrint();
                }
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {tabIndex < 3 ? "Avançar" : "Gerar e Imprimir Proposta (PDF)"}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* SEÇÃO DA DIREITA: PRÉVIA INTERATIVA DA PROPOSTA ORIGINAL (5 colunas) */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Banner de Info */}
        <div className="bg-indigo-50/60 p-5 rounded-3xl border border-indigo-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-indigo-900 uppercase">Pré-visualização do Formato Físico</h4>
            <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
              O layout abaixo simula o papel original que será enviado à Construtora e ao banco. Clique em imprimir para gerar o PDF A4 diagramado milimetricamente.
            </p>
          </div>
        </div>

        {/* Simulador visual da Proposta Papel */}
        <div className="bg-slate-200/90 rounded-3xl border border-slate-350 shadow-inner p-4 max-h-[780px] overflow-y-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Layers className="w-4 h-4" />
              <span>Espelho de Páginas Impressas</span>
            </span>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 shadow-sm rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir Proposta
            </button>
          </div>

          {/* PAGE 1 SIMULATION */}
          <div className="bg-white p-6 shadow-md border border-slate-300 rounded font-sans text-[9px] relative space-y-4 leading-tight selection:bg-indigo-100">
            <div className="absolute right-4 top-4 text-slate-500 font-black">Pág. 1</div>
            
            {/* Header */}
            <div className="border-b-2 border-black pb-2">
              <h3 className="font-extrabold text-xs text-green-900 uppercase">PROPOSTA DE COMPRA</h3>
              <h4 className="font-bold text-[9px] text-slate-800">CONDOMÍNIO RESIDENCIAL BELLA WHITE</h4>
            </div>

            <p className="text-slate-600 text-[8px] text-justify leading-relaxed">
              Prezado interessado, nos sentimos muito honrados em fazer parte da realização do seu grande sonho! Estamos perto de concretizar a conquista do seu imóvel no CONDOMÍNIO RESIDENCIAL BELLA WHITE ...
            </p>

            {/* Grid 1 */}
            <div className="border border-black divide-y divide-black">
              <div className="p-1 px-1.5">
                <span className="block text-[6.5px] font-black text-slate-500 uppercase">Nome do interessado (1):</span>
                <span className="font-extrabold text-[9px] text-slate-900 block min-h-3">{comprador1.nome || "(Campo Vazio)"}</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-black">
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] font-black text-slate-500">Nacionalidade</span>
                  <span className="font-bold text-[8.5px]">{comprador1.nacionalidade || "Brasileiro(a)"}</span>
                </div>
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] font-black text-slate-500">Estado Civil</span>
                  <span className="font-bold text-[8.5px]">{comprador1.estadoCivil || "Solteiro(a)"}</span>
                </div>
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] font-black text-slate-500">Data Nascimento</span>
                  <span className="font-bold text-[8.5px]">{comprador1.dataNascimento ? formatDateLabel(comprador1.dataNascimento) : "__/__/____"}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-black">
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] font-black text-slate-500">CPF</span>
                  <span className="font-bold text-[8.5px]">{comprador1.cpf || "___.___.___-__"}</span>
                </div>
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] font-black text-slate-500">Identidade</span>
                  <span className="font-bold text-[8.5px]">{comprador1.identidade || "_____-__"}</span>
                </div>
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] font-black text-slate-500">Renda Bruta</span>
                  <span className="font-bold text-[8.5px] text-emerald-850">R$ {fmt(comprador1.rendaBruta)}</span>
                </div>
              </div>
            </div>

            {/* Separador */}
            <div className="border border-black divide-y divide-black mt-2">
              <div className="p-1 bg-slate-100 font-extrabold text-[7.5px] uppercase">Cônjuge / Segundo Interessado</div>
              <div className="p-1 px-1.5">
                <span className="block text-[6.5px] text-slate-500">Nome do Interessado (2):</span>
                <span className="font-bold text-[9px] block min-h-3">{comprador2.nome || "(Sem Cônjuge Cadastrado)"}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 font-black text-[9px]">
              <div className="border border-black p-1">
                <span className="block text-[6px] text-slate-500">BLOCO:</span>
                <span className="text-slate-900 text-[10px]">{bloco || "___"}</span>
              </div>
              <div className="border border-black p-1 colspan-2">
                <span className="block text-[6px] text-slate-500">APARTAMENTO:</span>
                <span className="text-slate-900 text-[10px]">{apartamento || "___"}</span>
              </div>
            </div>
          </div>

          {/* PAGE 2 SIMULATION */}
          <div className="bg-white p-6 shadow-md border border-slate-300 rounded font-sans text-[9px] relative space-y-4 leading-tight">
            <div className="absolute right-4 top-4 text-slate-500 font-black">Pág. 2</div>
            
            <div className="border-b-2 border-black pb-2">
              <h3 className="font-extrabold text-xs text-green-900 uppercase">PROPOSTA DE COMPRA</h3>
              <h4 className="font-bold text-[9px] text-slate-850">CONDOMÍNIO RESIDENCIAL BELLA WHITE</h4>
            </div>

            <div className="border border-black p-1.5 text-[8.5px] bg-slate-50">
              <strong>Promitente Vendedora:</strong> Construtora Rio Manso LTDA — CNPJ 05.124.311/0001-86.
            </div>

            <div className="border border-black p-2 bg-emerald-50 text-center">
              <span className="block text-[7px] text-emerald-800 font-extrabold">PREÇO DO IMÓVEL:</span>
              <span className="text-sm font-black text-emerald-950">R$ {fmt(precoImovel)}</span>
            </div>

            <div className="border border-black divide-y divide-black">
              <div className="p-1 px-1.5 font-bold">
                <span className="block text-[6.5px] font-black text-slate-500">SINAL / ENTRADA:</span>
                R$ {fmt(sinalValor)} pago em {sinalParcelas}x de R$ {fmt(sinalParcelaValor)}
              </div>
              <div className="p-1 px-1.5 font-bold">
                <span className="block text-[6.5px] font-black text-slate-500">PARCELAMENTO CONSTRUTORA RIO MANSO:</span>
                R$ {fmt(finConstrutoraValor)} pago em {finConstrutoraParcelas}x de R$ {fmt(finConstrutoraParcelaValor)}
              </div>
              <div className="p-1 px-1.5 font-bold">
                <span className="block text-[6.5px] font-black text-slate-500">RECURSOS BANCÁRIOS (FGTS / CAIXA):</span>
                Estimativa de R$ {fmt(finBancarioValor)}
              </div>
            </div>
          </div>

          {/* PAGE 3 SIMULATION */}
          <div className="bg-white p-6 shadow-md border border-slate-300 rounded font-sans text-[9px] relative space-y-4 leading-tight">
            <div className="absolute right-4 top-4 text-slate-500 font-black">Pág. 3</div>
            
            <div className="border-b-2 border-black pb-2">
              <h3 className="font-extrabold text-xs text-green-900 uppercase">PROPOSTA DE COMPRA</h3>
              <h4 className="font-bold text-[9px] text-slate-850">CONDOMÍNIO RESIDENCIAL BELLA WHITE</h4>
            </div>

            <div className="border border-black p-1.5 bg-slate-50 text-[7.5px] uppercase font-black">
              Intermediação de Corretagem
            </div>

            <div className="border border-black divide-y divide-black">
              <div className="p-1 px-1.5">
                <span className="block text-[6.5px] font-black text-slate-500">Valor da Comissão:</span>
                <span className="font-bold text-[10px] text-blue-700">R$ {fmt(comissaoValor)}</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-black">
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] text-slate-500 font-black">Corretor Responsável</span>
                  <span className="font-extrabold">{corretorNome || "(Logado)"}</span>
                </div>
                <div className="p-1 px-1.5">
                  <span className="block text-[6.5px] text-slate-500 font-black">Creci Corretor</span>
                  <span className="font-bold">{corretorCreci || "_____"}</span>
                </div>
              </div>
            </div>

            <div className="border border-black p-2 text-justify">
              <span className="block text-[6.5px] text-slate-500 font-black">Observações da Proposta:</span>
              <p className="font-medium text-[8px] italic leading-relaxed text-slate-600">
                {observacoes || "Nenhuma cláusula ou observação especial adicionada."}
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
