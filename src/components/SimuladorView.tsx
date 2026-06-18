import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { 
  Calculator, 
  Share2, 
  Printer, 
  Coins, 
  User, 
  MapPin, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  Info, 
  Percent, 
  RefreshCw,
  PhoneCall,
  Sparkles,
  ArrowRight,
  Trash2,
  Save
} from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db, collection, getDocs } from "../firebase";
import { Building2 } from "lucide-react";

interface SimuladorViewProps {
  companySettings?: {
    name?: string;
    subtitle?: string;
    logoUrl?: string;
  };
  currentUser?: {
    displayName?: string;
    email?: string;
  };
}

// Custom input component that masks numeric values into real BRL currency format dynamically as the user types
interface BrlInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  prefix?: React.ReactNode;
}

const BrlInput: React.FC<BrlInputProps> = ({ value, onChange, placeholder, className, disabled, prefix }) => {
  const [displayValue, setDisplayValue] = useState<string>("");

  const formatBRLString = (valStr: string) => {
    // strip non-digits except comma
    let clean = valStr.replace(/[^\d,]/g, "");

    // ensure only one comma exists
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

  // Keep displayValue synchronized with value changes from parent (e.g., reset, calculations)
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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  if (prefix) {
    return (
      <div className="relative w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {prefix}
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder || "R$ 0,00"}
          className={cn(className, "pl-9")}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder || "R$ 0,00"}
      className={className}
      disabled={disabled}
    />
  );
};

interface SavedSimulation {
  id: string;
  clienteNome: string;
  tipo: "terreno" | "bancario";
  valorTotal: number;
  data: string;
  dadosCompletos: {
    clienteNome: string;
    empreendimento: string;
    loteInfo: string;
    metragem: number;
    valorM2: number;
    valorTotal: number;
    recalcMetragemOnTotalChange: boolean;
    entradaValor: number;
    parcelasQtd: number;
    tipoAmortizacao: "fixo" | "price" | "sac";
    taxaJuros: number;
    indexador: string;
    temBaloes: boolean;
    balaoPeriodicidade: "semestral" | "anual";
    balaoQtd: number;
    balaoValor: number;
    modoSimulacao: "terreno" | "bancario";
    tipoImovel: "apartamento" | "casa";
    valorImovel: number;
    subsidioFederal: number;
    subsidioMunicipal: number;
    fgtsCliente: number;
    valorFinanciamento: number;
    prazoFinanciamentoMeses: number;
    taxaAnualBanco: number;
    parcelaBanco: number;
    parcelarEntrada: boolean;
    valorImobiliaria: number;
    parcelasImobiliaria: number;
    valorConstrutora: number;
    parcelasConstrutora: number;
  }
}

export const SimuladorView: React.FC<SimuladorViewProps> = ({ companySettings, currentUser }) => {
  // History state
  const [historico, setHistorico] = useState<SavedSimulation[]>([]);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("simulacoes_historico");
      if (stored) {
        setHistorico(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Erro ao carregar histórico", e);
    }
  }, []);

  // Save/Load/Delete action handlers
  const salvarSimulacao = () => {
    try {
      const nomeSimulacao = clienteNome.trim() || "Cliente sem Nome";
      const novaSimulacao: SavedSimulation = {
        id: Math.random().toString(36).substring(2, 11),
        clienteNome: nomeSimulacao,
        tipo: modoSimulacao,
        valorTotal: modoSimulacao === "terreno" ? valorTotal : valorImovel,
        data: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }),
        dadosCompletos: {
          clienteNome,
          empreendimento,
          loteInfo,
          metragem,
          valorM2,
          valorTotal,
          recalcMetragemOnTotalChange,
          entradaValor,
          parcelasQtd,
          tipoAmortizacao,
          taxaJuros,
          indexador,
          temBaloes,
          balaoPeriodicidade,
          balaoQtd,
          balaoValor,
          modoSimulacao,
          tipoImovel,
          valorImovel,
          subsidioFederal,
          subsidioMunicipal,
          fgtsCliente,
          valorFinanciamento,
          prazoFinanciamentoMeses,
          taxaAnualBanco,
          parcelaBanco,
          parcelarEntrada,
          valorImobiliaria,
          parcelasImobiliaria,
          valorConstrutora,
          parcelasConstrutora
        }
      };

      const novoHistorico = [novaSimulacao, ...historico].slice(0, 10);
      setHistorico(novoHistorico);
      localStorage.setItem("simulacoes_historico", JSON.stringify(novoHistorico));
      toast.success("Simulação salva com sucesso!");
    } catch (e) {
      console.error("Erro ao salvar simulação", e);
      toast.error("Erro ao salvar simulação.");
    }
  };

  const carregarSimulacao = (sim: SavedSimulation) => {
    try {
      const d = sim.dadosCompletos;
      if (d.clienteNome !== undefined) setClienteNome(d.clienteNome);
      if (d.empreendimento !== undefined) setEmpreendimento(d.empreendimento);
      if (d.loteInfo !== undefined) setLoteInfo(d.loteInfo);
      if (d.metragem !== undefined) setMetragem(d.metragem);
      if (d.valorM2 !== undefined) setValorM2(d.valorM2);
      if (d.valorTotal !== undefined) setValorTotal(d.valorTotal);
      if (d.recalcMetragemOnTotalChange !== undefined) setRecalcMetragemOnTotalChange(d.recalcMetragemOnTotalChange);
      if (d.entradaValor !== undefined) setEntradaValor(d.entradaValor);
      if (d.parcelasQtd !== undefined) setParcelasQtd(d.parcelasQtd);
      if (d.tipoAmortizacao !== undefined) setTipoAmortizacao(d.tipoAmortizacao);
      if (d.taxaJuros !== undefined) setTaxaJuros(d.taxaJuros);
      if (d.indexador !== undefined) setIndexador(d.indexador);
      if (d.temBaloes !== undefined) setTemBaloes(d.temBaloes);
      if (d.balaoPeriodicidade !== undefined) setBalaoPeriodicidade(d.balaoPeriodicidade);
      if (d.balaoQtd !== undefined) setBalaoQtd(d.balaoQtd);
      if (d.balaoValor !== undefined) setBalaoValor(d.balaoValor);
      if (d.modoSimulacao !== undefined) setModoSimulacao(d.modoSimulacao);
      if (d.tipoImovel !== undefined) setTipoImovel(d.tipoImovel);
      if (d.valorImovel !== undefined) setValorImovel(d.valorImovel);
      if (d.subsidioFederal !== undefined) setSubsidioFederal(d.subsidioFederal);
      if (d.subsidioMunicipal !== undefined) setSubsidioMunicipal(d.subsidioMunicipal);
      if (d.fgtsCliente !== undefined) setFgtsCliente(d.fgtsCliente);
      if (d.valorFinanciamento !== undefined) setValorFinanciamento(d.valorFinanciamento);
      if (d.prazoFinanciamentoMeses !== undefined) setPrazoFinanciamentoMeses(d.prazoFinanciamentoMeses);
      if (d.taxaAnualBanco !== undefined) setTaxaAnualBanco(d.taxaAnualBanco);
      if (d.parcelaBanco !== undefined) setParcelaBanco(d.parcelaBanco);
      if (d.parcelarEntrada !== undefined) setParcelarEntrada(d.parcelarEntrada);
      if (d.valorImobiliaria !== undefined) setValorImobiliaria(d.valorImobiliaria);
      if (d.parcelasImobiliaria !== undefined) setParcelasImobiliaria(d.parcelasImobiliaria);
      if (d.valorConstrutora !== undefined) setValorConstrutora(d.valorConstrutora);
      if (d.parcelasConstrutora !== undefined) setParcelasConstrutora(d.parcelasConstrutora);

      toast.success(`Simulação de ${sim.clienteNome} carregada!`);
    } catch (e) {
      console.error("Erro ao carregar simulação", e);
      toast.error("Erro ao carregar simulação.");
    }
  };

  const excluirSimulacao = (id: string) => {
    try {
      const novoHistorico = historico.filter(s => s.id !== id);
      setHistorico(novoHistorico);
      localStorage.setItem("simulacoes_historico", JSON.stringify(novoHistorico));
      toast.success("Simulação removida do histórico.");
    } catch (e) {
      console.error("Erro ao excluir simulação", e);
      toast.error("Erro ao excluir simulação.");
    }
  };

  // Input states
  const [clienteNome, setClienteNome] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [loteInfo, setLoteInfo] = useState("");
  
  const [metragem, setMetragem] = useState<number>(300);
  const [valorM2, setValorM2] = useState<number>(500);
  const [valorTotal, setValorTotal] = useState<number>(150000);
  const [recalcMetragemOnTotalChange, setRecalcMetragemOnTotalChange] = useState(false);

  const [entradaValor, setEntradaValor] = useState<number>(15000);
  
  // Installments states
  const [parcelasQtd, setParcelasQtd] = useState<number>(120);
  const [tipoAmortizacao, setTipoAmortizacao] = useState<"fixo" | "price" | "sac">("fixo");
  const [taxaJuros, setTaxaJuros] = useState<number>(0);
  const [indexador, setIndexador] = useState("Sem reajuste (Fixas)");

  // Balloons states (Balões / Anuais)
  const [temBaloes, setTemBaloes] = useState(false);
  const [balaoPeriodicidade, setBalaoPeriodicidade] = useState<"semestral" | "anual">("anual");
  const [balaoQtd, setBalaoQtd] = useState<number>(5);
  const [balaoValor, setBalaoValor] = useState<number>(5000);

  // ===== MODO DE SIMULAÇÃO =====
  const [modoSimulacao, setModoSimulacao] = useState<"terreno" | "bancario">("terreno");

  // ===== CAMPOS DO MODO BANCÁRIO =====
  const [tipoImovel, setTipoImovel] = useState<"apartamento" | "casa">("apartamento");
  const [valorImovel, setValorImovel] = useState<number>(200000);
  const [subsidioFederal, setSubsidioFederal] = useState<number>(0);
  const [subsidioMunicipal, setSubsidioMunicipal] = useState<number>(0);
  const [fgtsCliente, setFgtsCliente] = useState<number>(0);
  const [valorFinanciamento, setValorFinanciamento] = useState<number>(0);
  const [prazoFinanciamentoMeses, setPrazoFinanciamentoMeses] = useState<number>(360);
  const [taxaAnualBanco, setTaxaAnualBanco] = useState<number>(9.5);
  const [parcelaBanco, setParcelaBanco] = useState<number>(0);

  // States for Entry installments (Imobiliária and Construtora)
  const [parcelarEntrada, setParcelarEntrada] = useState<boolean>(false);
  const [valorImobiliaria, setValorImobiliaria] = useState<number>(0);
  const [parcelasImobiliaria, setParcelasImobiliaria] = useState<number>(1);
  const [valorConstrutora, setValorConstrutora] = useState<number>(0);
  const [parcelasConstrutora, setParcelasConstrutora] = useState<number>(1);

  // Estados adicionais para proposta aprimorada (Fidelité)
  const [corretorResponsavel, setCorretorResponsavel] = useState<string>("");
  const [usarLogoEmpresa, setUsarLogoEmpresa] = useState<boolean>(true);
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const [entradaVista, setEntradaVista] = useState<number>(12000); // R$ 12.000,00 padrão
  const [parcelasConstrutoraProposta, setParcelasConstrutoraProposta] = useState<number>(18); // 18x padrão
  const [corretoresList, setCorretoresList] = useState<{ id: string; name: string }[]>([]);

  // Carregar corretores cadastrados no banco de dados "users"
  useEffect(() => {
    async function loadCorretores() {
      try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        const list: { id: string; name: string }[] = [];
        querySnapshot.forEach((docSnap: any) => {
          const data = docSnap.data();
          if (data && (data.name || data.displayName)) {
            list.push({ 
              id: docSnap.id, 
              name: data.name || data.displayName 
            });
          }
        });
        
        // Remove duplicates & sort
        const uniqueListMap = new Map<string, string>();
        list.forEach(item => uniqueListMap.set(item.name, item.id));
        const sortedUniqueList: { id: string; name: string }[] = Array.from(uniqueListMap.entries())
          .map(([name, id]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
          
        setCorretoresList(sortedUniqueList);
        if (sortedUniqueList.length > 0 && !corretorResponsavel) {
          const matched = sortedUniqueList.find(c => c.name.toLowerCase() === (currentUser?.displayName || "").toLowerCase());
          setCorretorResponsavel(matched ? matched.name : sortedUniqueList[0].name);
        }
      } catch (err) {
        console.error("Erro ao carregar corretores", err);
        // Fallback robusto
        const fallbackList = [
          { id: "fallback-1", name: "William Guimarães Viana" },
          { id: "fallback-2", name: "Estefani Tavares" },
          { id: "fallback-3", name: "Corretor Fidelité" }
        ];
        setCorretoresList(fallbackList);
        if (!corretorResponsavel) {
          setCorretorResponsavel(currentUser?.displayName || "William Guimarães Viana");
        }
      }
    }
    loadCorretores();
  }, [currentUser]);



  // Helper formats
  const fmt = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  const handleMetragemChange = (val: number) => {
    setMetragem(val);
    setValorTotal(val * valorM2);
  };

  const handleValorM2Change = (val: number) => {
    setValorM2(val);
    setValorTotal(metragem * val);
  };

  const handleValorTotalChange = (val: number) => {
    const currentEntryPct = valorTotal > 0 ? (entradaValor / valorTotal) : 0.10;
    const currentBalaoPct = (temBaloes && valorTotal > 0) ? ((balaoValor * balaoQtd) / valorTotal) : 0;

    setValorTotal(val);

    // Keep entry value proportional to the new total
    const novaEntrada = Math.round(val * currentEntryPct * 100) / 100;
    setEntradaValor(novaEntrada);

    // Keep individual balloon values proportional to the new total
    if (temBaloes && balaoQtd > 0) {
      const novoTotalBaloes = val * currentBalaoPct;
      const novoBalaoValor = Math.round((novoTotalBaloes / balaoQtd) * 100) / 100;
      setBalaoValor(novoBalaoValor);
    }

    if (recalcMetragemOnTotalChange) {
      if (valorM2 > 0) {
        setMetragem(Math.round((val / valorM2) * 100) / 100);
      }
    } else {
      if (metragem > 0) {
        setValorM2(Math.round((val / metragem) * 100) / 100);
      }
    }
  };

  const valorM2Calculado = useMemo(() => {
    return metragem > 0 ? valorTotal / metragem : 0;
  }, [metragem, valorTotal]);

  // Sync entry changes when total updates, keeping pct constant or vice-versa
  const entradaPct = useMemo(() => {
    if (valorTotal <= 0) return 0;
    return (entradaValor / valorTotal) * 100;
  }, [entradaValor, valorTotal]);

  const handleEntradaPctClick = (pct: number) => {
    const val = valorTotal * (pct / 100);
    setEntradaValor(Math.round(val * 100) / 100);
  };

  const handleEntradaPctChange = (pctValue: number) => {
    const val = valorTotal * (pctValue / 100);
    setEntradaValor(Math.round(val * 100) / 100);
  };

  // Calculator logic
  const totalBaloes = useMemo(() => {
    if (!temBaloes) return 0;
    return balaoQtd * balaoValor;
  }, [temBaloes, balaoQtd, balaoValor]);

  // Sync balloon percentage changes (total of balloons relative to the total value of the lot)
  const balaoPct = useMemo(() => {
    if (valorTotal <= 0) return 0;
    return (totalBaloes / valorTotal) * 100;
  }, [totalBaloes, valorTotal]);

  const handleBalaoValorChange = (val: number) => {
    setBalaoValor(val);
  };

  const handleBalaoPctChange = (pctValue: number) => {
    const totalBaloesDesejado = valorTotal * (pctValue / 100);
    const valCadaBalao = totalBaloesDesejado / Math.max(1, balaoQtd);
    setBalaoValor(Math.round(valCadaBalao * 100) / 100);
  };

  const valorFinanciado = useMemo(() => {
    const saldo = valorTotal - entradaValor - totalBaloes;
    return Math.max(0, saldo);
  }, [valorTotal, entradaValor, totalBaloes]);

  const mensaisPct = useMemo(() => {
    if (valorTotal <= 0) return 0;
    return (valorFinanciado / valorTotal) * 100;
  }, [valorFinanciado, valorTotal]);

  const results = useMemo(() => {
    const pv = valorFinanciado;
    const n = Math.max(1, parcelasQtd);
    const i = (taxaJuros || 0) / 100; // mensal

    let primeiraParcela = 0;
    let ultimaParcela = 0;
    let totalPagarSerie = 0;
    const parcelasLista: { num: number; valor: number; amortizacao: number; juros: number; saldoDevedor: number }[] = [];
    const parcelasListaCompleta: { num: number; valor: number; amortizacao: number; juros: number; saldoDevedor: number }[] = [];

    if (pv <= 0) {
      return {
        primeiraParcela: 0,
        ultimaParcela: 0,
        totalPagarSerie: 0,
        parcelasLista: [],
        parcelasListaCompleta: [],
        saldoExcedido: false
      };
    }

    if (tipoAmortizacao === "price") {
      // Tabela PRICE (Compound interest formula)
      if (i > 0) {
        const pmt = pv * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
        primeiraParcela = pmt;
        ultimaParcela = pmt;
        totalPagarSerie = pmt * n;
        
        let saldoDevedor = pv;
        for (let k = 1; k <= n; k++) {
          const juros = saldoDevedor * i;
          const amortizacao = pmt - juros;
          saldoDevedor = Math.max(0, saldoDevedor - amortizacao);
          parcelasListaCompleta.push({ num: k, valor: pmt, amortizacao, juros, saldoDevedor });
          if (k <= 10 || k === n) {
            parcelasLista.push({ num: k, valor: pmt, amortizacao, juros, saldoDevedor });
          }
        }
      } else {
        const pmt = pv / n;
        primeiraParcela = pmt;
        ultimaParcela = pmt;
        totalPagarSerie = pv;
        
        for (let k = 1; k <= n; k++) {
          const item = { num: k, valor: pmt, juros: 0, amortizacao: pmt, saldoDevedor: pv - (k * pmt) };
          parcelasListaCompleta.push(item);
          if (k <= 10 || k === n) {
            parcelasLista.push(item);
          }
        }
      }
    } else if (tipoAmortizacao === "sac") {
      // Tabela SAC (Amortização Constante - Decrescentes)
      const amort = pv / n;
      let saldoDevedor = pv;
      totalPagarSerie = 0;

      for (let k = 1; k <= n; k++) {
        const juros = saldoDevedor * i;
        const pmt = amort + juros;
        totalPagarSerie += pmt;
        saldoDevedor = Math.max(0, saldoDevedor - amort);

        if (k === 1) primeiraParcela = pmt;
        if (k === n) ultimaParcela = pmt;

        parcelasListaCompleta.push({ num: k, valor: pmt, amortizacao: amort, juros, saldoDevedor });
        if (k <= 10 || k === n) {
          parcelasLista.push({ num: k, valor: pmt, amortizacao: amort, juros, saldoDevedor });
        }
      }
    } else {
      // Método Fixo / Linear
      // No refrigério de terrenos, às vezes aplica-se juros simples globais ou sem juros compostos.
      // Se tiver juros, adiciona juros nominais no PV todo ou trata como fixas sem capitalização.
      // Vamos somar juros nominal simples: (juros ao mês * n)
      const jurosTotalNominal = pv * (i * n);
      const totalPagar = pv + jurosTotalNominal;
      const pmt = totalPagar / n;
      primeiraParcela = pmt;
      ultimaParcela = pmt;
      totalPagarSerie = totalPagar;

      for (let k = 1; k <= n; k++) {
        const item = { num: k, valor: pmt, juros: pv * i, amortizacao: pv / n, saldoDevedor: Math.max(0, pv - (k * (pv/n))) };
        parcelasListaCompleta.push(item);
        if (k <= 10 || k === n) {
          parcelasLista.push({ num: k, valor: pmt, juros: pv * i, amortizacao: pv / n, saldoDevedor: Math.max(0, pv - (k * (pv/n))) });
        }
      }
    }

    const saldoExcedido = (entradaValor + totalBaloes) > valorTotal;

    return {
      primeiraParcela,
      ultimaParcela,
      totalPagarSerie,
      parcelasLista,
      parcelasListaCompleta,
      saldoExcedido
    };
  }, [valorFinanciado, parcelasQtd, tipoAmortizacao, taxaJuros, entradaValor, totalBaloes, valorTotal]);

  // ===== CÁLCULOS DO MODO BANCÁRIO =====
  const totalSubsidios = useMemo(() => {
    return (subsidioFederal || 0) + (subsidioMunicipal || 0);
  }, [subsidioFederal, subsidioMunicipal]);

  const entradaBolso = useMemo(() => {
    // Quanto o cliente realmente paga do bolso, no ato.
    // Valor do imóvel - Subsídios - FGTS - Financiamento liberado pelo banco
    const restante = (valorImovel || 0) - totalSubsidios - (fgtsCliente || 0) - (valorFinanciamento || 0);
    return Math.max(0, restante);
  }, [valorImovel, totalSubsidios, fgtsCliente, valorFinanciamento]);

  // Manter entrada à vista compatível com a entrada total após subsídios
  useEffect(() => {
    if (entradaBolso > 0) {
      if (entradaVista > entradaBolso) {
        setEntradaVista(entradaBolso);
      }
    } else {
      setEntradaVista(0);
    }
  }, [entradaBolso, entradaVista]);

  // Sincronização automática para manter o parcelamento da entrada coerente com o total do bolso
  useEffect(() => {
    if (entradaBolso > 0) {
      // Por padrão, a parte da imobiliária (ex: comissão ou sinal de venda)
      // é de 6% do valor do imóvel (padrão Brasil), até o limite máximo da entrada total.
      const defaultImob = Math.min(entradaBolso, Math.round((valorImovel || 0) * 0.06));
      setValorImobiliaria(defaultImob);
      setValorConstrutora(Math.max(0, entradaBolso - defaultImob));
    } else {
      setValorImobiliaria(0);
      setValorConstrutora(0);
    }
  }, [entradaBolso, valorImovel]);

  const handleValorImobiliariaChange = (val: number) => {
    const cleanVal = Math.min(entradaBolso, Math.max(0, val));
    setValorImobiliaria(cleanVal);
    setValorConstrutora(Math.max(0, entradaBolso - cleanVal));
  };

  const handleValorConstrutoraChange = (val: number) => {
    const cleanVal = Math.min(entradaBolso, Math.max(0, val));
    setValorConstrutora(cleanVal);
    setValorImobiliaria(Math.max(0, entradaBolso - cleanVal));
  };

  const parcelaImobiliariaValor = useMemo(() => {
    if (parcelasImobiliaria <= 0) return 0;
    return valorImobiliaria / parcelasImobiliaria;
  }, [valorImobiliaria, parcelasImobiliaria]);

  const parcelaConstrutoraValor = useMemo(() => {
    if (parcelasConstrutora <= 0) return 0;
    return valorConstrutora / parcelasConstrutora;
  }, [valorConstrutora, parcelasConstrutora]);

  // A parcela do banco agora é um estado editável diretamente pelo usuário (sem cálculo automático via fórmula PRICE)

  const totalFinanciamentoPago = useMemo(() => {
    // Total que o cliente pagará pro banco ao longo do prazo (com juros)
    return parcelaBanco * (prazoFinanciamentoMeses || 0);
  }, [parcelaBanco, prazoFinanciamentoMeses]);

  const custoTotalBancario = useMemo(() => {
    // Custo total real pro cliente: entrada do bolso + FGTS (que é do cliente) + total pago ao banco
    // NOTA: subsídios NÃO entram (são "grátis" pro cliente)
    return entradaBolso + (fgtsCliente || 0) + totalFinanciamentoPago;
  }, [entradaBolso, fgtsCliente, totalFinanciamentoPago]);

  const totalCobertura = useMemo(() => {
    // Confere se a soma das fontes cobre o valor do imóvel
    // Pode dar negativo se a soma exceder, ou positivo se faltar
    return (valorImovel || 0) - (totalSubsidios + (fgtsCliente || 0) + (valorFinanciamento || 0) + entradaBolso);
  }, [valorImovel, totalSubsidios, fgtsCliente, valorFinanciamento, entradaBolso]);

  const zerarSimulador = () => {
    setClienteNome("");
    setEmpreendimento("");
    setLoteInfo("");
    setMetragem(300);
    setValorM2(500);
    setValorTotal(150000);
    setEntradaValor(15000);
    setParcelasQtd(120);
    setTipoAmortizacao("fixo");
    setTaxaJuros(0);
    setIndexador("Sem reajuste (Fixas)");
    setTemBaloes(false);
    setBalaoQtd(5);
    setBalaoValor(5000);
    
    // Reset modo bancário
    setTipoImovel("apartamento");
    setValorImovel(200000);
    setSubsidioFederal(0);
    setSubsidioMunicipal(0);
    setFgtsCliente(0);
    setValorFinanciamento(0);
    setPrazoFinanciamentoMeses(360);
    setTaxaAnualBanco(9.5);
    setParcelaBanco(0);
    setParcelarEntrada(false);
    setValorImobiliaria(0);
    setParcelasImobiliaria(1);
    setValorConstrutora(0);
    setParcelasConstrutora(1);
    
    // Reset novos campos Fidelité
    setEntradaVista(12000);
    setParcelasConstrutoraProposta(18);
    setUsarLogoEmpresa(true);
    setCustomLogoUrl("");
  };

  // WhatsApp formatted string copy text
  const copiarWhatsApp = async () => {
    try {
      const enterpriseName = empreendimento || "Loteamento Especial";
      const userSales = corretorResponsavel || currentUser?.displayName || "Consultor de Vendas";
      const dateStr = format(new Date(), "dd/MM/yyyy HH:mm");
      
      let msg = "";
      if (modoSimulacao === "bancario") {
        const subHeaderTexto = tipoImovel === "casa" ? "Casa" : "Apartamento";
        msg = `*🏢 SIMULAÇÃO DE CRÉDITO HABITACIONAL* \n`;
        msg += `*${companySettings?.name || "IMOBILIÁRIA"}* \n\n`;
        
        if (clienteNome) {
          msg += `Olá, *${clienteNome}*! Segue o plano simulado para aquisição do seu *${subHeaderTexto}*:\n\n`;
        } else {
          msg += `Olá! Segue uma simulação de plano de financiamento habitacional:\n\n`;
        }
        
        msg += `*📌 Informações Principais:*\n`;
        if (empreendimento) {
          msg += `• *Empreendimento:* ${empreendimento}\n`;
        }
        if (loteInfo) {
          msg += `• *Localização/Nº:* ${loteInfo}\n`;
        }
        msg += `• *Tipo de Imóvel:* ${subHeaderTexto}\n`;
        msg += `• *VALOR DO IMÓVEL:* *${fmt(valorImovel)}*\n\n`;
        
        msg += `*💳 Composição Estimada do Fluxo:*\n`;
        if (totalSubsidios > 0) {
          msg += `• *Subsídios Governamentais:* *${fmt(totalSubsidios)}* (Federal: ${fmt(subsidioFederal)} · Municipal: ${fmt(subsidioMunicipal)})\n`;
        }
        if (fgtsCliente > 0) {
          msg += `• *Utilização de FGTS:* *${fmt(fgtsCliente)}*\n`;
        }
        if (valorFinanciamento > 0) {
          msg += `• *Financiamento Bancário:* *${fmt(valorFinanciamento)}* em ${prazoFinanciamentoMeses} meses\n`;
          if (parcelaBanco > 0) {
            msg += `• *Parcela Mensal Estimada:* *${fmt(parcelaBanco)}/mês* (Tabela PRICE, taxa de ${taxaAnualBanco}% a.a.)\n`;
          }
        }
        
        msg += `\n*✨ COMPOSIÇÃO DE ENTRADA DO BOLSO (ATO):* *${fmt(entradaBolso)}*\n`;
        if (parcelarEntrada) {
          msg += `• *Parte Imobiliária (Sinal):* *${fmt(valorImobiliaria)}* em *${parcelasImobiliaria}x de ${fmt(parcelaImobiliariaValor)}/mês*\n`;
          msg += `• *Parte Construtora (Saldo):* *${fmt(valorConstrutora)}* em *${parcelasConstrutora}x de ${fmt(parcelaConstrutoraValor)}/mês*\n`;
        }
        msg += `\n`;
        
        msg += `*Fale conosco para darmos início à sua análise de crédito com segurança!* 🚀\n`;
        msg += `_Simulado por ${userSales} em ${dateStr}_`;
      } else {
        msg = `*🏢 SIMULAÇÃO DE COMPRA DE TERRENO* \n`;
        msg += `*${companySettings?.name || "IMOBILIÁRIA"}* \n\n`;
        
        if (clienteNome) {
          msg += `Olá, *${clienteNome}*! Segue o plano personalizado de simulação do seu lote:\n\n`;
        } else {
          msg += `Olá! Segue uma simulação de plano de pagamento personalizado:\n\n`;
        }

        msg += `*📌 Informações Principais:*\n`;
        msg += `• *Empreendimento:* ${enterpriseName}\n`;
        if (loteInfo) msg += `• *Localização/Lote:* ${loteInfo}\n`;
        msg += `• *Área Total:* ${metragem} m²\n`;
        msg += `• *Valor do m²:* ${fmt(valorM2Calculado)}\n`;
        msg += `• *VALOR TOTAL DO TERRENO:* *${fmt(valorTotal)}*\n\n`;

        msg += `*💳 Condição de Pagamento:*\n`;
        msg += `• *Entrada:* *${fmt(entradaValor)}* (${entradaPct.toFixed(1)}%)\n`;
        
        if (temBaloes) {
          msg += `• *Reforço / Balões:* ${balaoQtd} parcelas ${balaoPeriodicidade}s de *${fmt(balaoValor)}* (Total: ${fmt(totalBaloes)})\n`;
        }
        
        msg += `• *Saldo a Parcelar:* ${fmt(valorFinanciado)}\n`;

        const pmtStr = tipoAmortizacao === "sac" 
          ? `${parcelasQtd}x decrescentes de *${fmt(results.primeiraParcela)}* até *${fmt(results.ultimaParcela)}* (Tabela SAC)`
          : `${parcelasQtd}x fixas de *${fmt(results.primeiraParcela)}* (${tipoAmortizacao === "price" ? "Tabela PRICE" : "Financiamento Direto"})`;

        msg += `• *Plano de Parcelas:* ${pmtStr}\n`;
        if (taxaJuros > 0) msg += `• *Juros Mensal:* ${taxaJuros}% a.m.\n`;
        msg += `• *Reajuste:* ${indexador}\n\n`;
        
        msg += `*📊 Resumo Geral:* \n`;
        const custoTotalReal = entradaValor + totalBaloes + (tipoAmortizacao === "sac" ? results.totalPagarSerie : (results.primeiraParcela * parcelasQtd));
        msg += `• Investimento Total: *${fmt(custoTotalReal)}*\n\n`;

        msg += `*Fale conosco para reservar seu lote ou para assinar a proposta!* 🚀\n`;
        msg += `_Simulado por ${userSales} em ${dateStr}_`;
      }

      await navigator.clipboard.writeText(msg);
      toast.error("Proposta copiada com sucesso para o seu clipboard! Basta colar no chat do WhatsApp de seu cliente.");
    } catch (e) {
      console.error("Erro ao copiar para o clipboard:", e);
      toast.error("Não foi possível copiar automaticamente. Verifique as permissões do navegador ou copie manualmente.");
    }
  };

  // HTML Print Window Trigger
  const imprimirProposta = () => {
    const enterpriseName = empreendimento || "Empreendimento";
    const userSales = corretorResponsavel || currentUser?.displayName || "Consultor de Vendas";
    const nomeCliente = clienteNome.trim() || "Cliente Interessado";
    const localizacaoTexto = loteInfo ? `${enterpriseName} — ${loteInfo}` : enterpriseName;
    const dataEmissao = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    
    const logoSrc = (usarLogoEmpresa && companySettings?.logoUrl) 
      ? companySettings.logoUrl 
      : customLogoUrl;

    const logoHtml = logoSrc 
      ? `<div style="background-color: #ffffff; padding: 8px 18px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 6px; border: 1px solid #e2e8f0;"><img src="${logoSrc}" style="max-height: 42px; width: auto; max-width: 170px; display: block; object-fit: contain;" alt="Logo" /></div>`
      : `<div style="background-color: #ffffff; padding: 6px 14px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; border: 2px solid #0f3a6b; color: #0f3a6b; font-weight: 900; font-size: 15px; margin-bottom: 6px; font-family: 'Inter', sans-serif; letter-spacing: 0.05em; text-transform: uppercase;">FIDELITÉ</div>`;

    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      toast.error("Bloqueador de pop-ups ativo. Permita pop-ups para imprimir a proposta.");
      return;
    }

    if (modoSimulacao === "bancario") {
      // ==== PDF LAYOUT FOR FINANCIAL MODE (BANCÁRIO) ====
      const valorEntradaBruto = Math.max(0, (valorImovel || 0) - (valorFinanciamento || 0));
      const itensResumoModoBancario = [
        `<tr><td style="padding: 10px 16px; color: #334155; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Valor apartamento / imóvel</td><td style="padding: 10px 16px; text-align: right; color: #0F172A; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-variant-numeric: tabular-nums;">${fmt(valorImovel)}</td></tr>`,
        `<tr><td style="padding: 10px 16px; color: #475569; border-bottom: 1px solid #e2e8f0;">Valor financiamento liberado</td><td style="padding: 10px 16px; text-align: right; color: #475569; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-variant-numeric: tabular-nums;">${fmt(valorFinanciamento)}</td></tr>`,
        `<tr style="background-color: #f8fafc;"><td style="padding: 11px 16px; color: #1e293b; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-top: 1px solid #e2e8f0;">Valor entrada (Diferença)</td><td style="padding: 11px 16px; text-align: right; color: #0f172a; border-bottom: 1px solid #cbd5e1; border-top: 1px solid #e2e8f0; font-weight: 850; font-variant-numeric: tabular-nums;">${fmt(valorEntradaBruto)}</td></tr>`,
        `<tr><td style="padding: 9px 16px; color: #2563eb; border-bottom: 1px solid #f1f5f9; padding-left: 24px;">Subsídio Federal</td><td style="padding: 9px 16px; text-align: right; color: #2563eb; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-variant-numeric: tabular-nums;">${fmt(subsidioFederal)}</td></tr>`,
        `<tr><td style="padding: 9px 16px; color: #2563eb; border-bottom: 1px solid #f1f5f9; padding-left: 24px;">Municipal</td><td style="padding: 9px 16px; text-align: right; color: #2563eb; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-variant-numeric: tabular-nums;">${fmt(subsidioMunicipal)}</td></tr>`,
        `<tr style="background-color: #eff6ff;"><td style="padding: 10px 16px; color: #1d4ed8; font-weight: 700; border-bottom: 1px solid #bfdbfe; padding-left: 24px;">Valor total de Subsídios</td><td style="padding: 10px 16px; text-align: right; color: #1d4ed8; border-bottom: 1px solid #bfdbfe; font-weight: 800; font-variant-numeric: tabular-nums;">${fmt(totalSubsidios)}</td></tr>`,
        `<tr><td style="padding: 10px 16px; color: #475569; border-bottom: 1px solid #e2e8f0;">FGTS</td><td style="padding: 10px 16px; text-align: right; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-variant-numeric: tabular-nums;">${fmt(fgtsCliente)}</td></tr>`,
        `<tr style="background-color: #eff6ff;"><td style="padding: 14px 16px; color: #1e40af; font-weight: 850; border-top: 2px solid #bfdbfe;">Entrada descontando Subsídios</td><td style="padding: 14px 16px; text-align: right; color: #1e40af; font-weight: 900; font-size: 16px; border-top: 2px solid #bfdbfe; font-variant-numeric: tabular-nums;">${fmt(entradaBolso)}</td></tr>`
      ];

      if (parcelarEntrada) {
        itensResumoModoBancario.push(
          `<tr style="background-color: #f0f9ff;"><td style="padding: 11px 16px; color: #0369a1; font-weight: 700; border-top: 1px dashed #bae6fd; padding-left: 24px;">└ Partições: Sinal Imobiliária</td><td style="padding: 11px 16px; text-align: right; color: #0369a1; border-top: 1px dashed #bae6fd; font-weight: 800; font-variant-numeric: tabular-nums;">${fmt(valorImobiliaria)} em ${parcelasImobiliaria}x de ${fmt(parcelaImobiliariaValor)}/mês</td></tr>`,
          `<tr style="background-color: #eff6ff;"><td style="padding: 11px 16px; color: #1e40af; font-weight: 700; border-top: 1px dashed #bfdbfe; padding-left: 24px;">└ Partições: Saldo Construtora</td><td style="padding: 11px 16px; text-align: right; color: #1e40af; border-top: 1px dashed #bfdbfe; font-weight: 800; font-variant-numeric: tabular-nums;">${fmt(valorConstrutora)} em ${parcelasConstrutora}x of ${fmt(parcelaConstrutoraValor)}/mês</td></tr>`
        );
      }

      const subHeaderTexto = tipoImovel === "casa" ? "Casa Residencial" : "Apartamento";

      printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Bancária - ${nomeCliente}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: white;
      color: #0f172a;
      font-size: 14px;
      line-height: 1.5;
    }
    .page { max-width: 760px; margin: 0 auto; padding: 30px; }
    @page { 
      size: A4; 
      margin: 10mm 15mm; 
    }
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none !important; }
      .page { padding: 0; max-width: 100%; margin: 0; }
    }
    .hero-bar {
      background: #0f3a6b;
      color: white;
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 16px;
    }
    .hero-bar .titulo-bloco { flex: 1; }
    .hero-bar .badge {
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.9;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .hero-bar h1 {
      font-size: 22px;
      font-weight: 950;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .hero-bar .empresa {
      text-align: right;
      font-size: 11px;
      opacity: 0.9;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
    }
    .hero-bar .empresa .nome {
      font-size: 14px;
      font-weight: 700;
      opacity: 1;
      margin-top: 2px;
      margin-bottom: 2px;
    }
    .section { padding: 20px 0; }
    .section-label {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.1em;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .cliente-nome {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .cliente-localizacao {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .card-valor-principal {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      padding: 18px 24px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-valor-principal .label {
      font-size: 9px;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .card-valor-principal .valor {
      font-size: 32px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.03em;
      margin-top: 2px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .card-valor-principal .badge-tipo {
      background-color: #dbeafe;
      color: #1e40af;
      font-size: 10px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .plano-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 10px;
    }
    .plano-card { border-radius: 12px; padding: 14px 16px; border: 1px solid rgba(0,0,0,0.03); }
    .plano-card.entrada { background: #0f3a6b; color: white; }
    .plano-card.mensal { background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); color: white; border: none; }
    .plano-card .micro-label {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .plano-card.entrada .micro-label { color: rgba(255, 255, 255, 0.85); }
    .plano-card.mensal .micro-label { color: rgba(255, 255, 255, 0.85); }
    .plano-card .valor-plano {
      font-size: 20px;
      font-weight: 900;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }
    .plano-card.entrada .valor-plano { color: white; }
    .plano-card.mensal .valor-plano { color: white; }
    .plano-card .meta-plano { font-size: 10px; margin-top: 2px; font-weight: 500; }
    .plano-card.entrada .meta-plano { color: rgba(255, 255, 255, 0.9); }
    .plano-card.mensal .meta-plano { color: rgba(255, 255, 255, 0.9); }
    
    .fontes-de-pagamento {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .fonte-item {
      padding: 10px 14px;
      border-radius: 12px;
      background-color: #f8fafc;
      border: 1px solid #f1f5f9;
    }
    .fonte-item .tipo {
      font-size: 8px;
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .fonte-item .valor {
      font-size: 15px;
      font-weight: 750;
      color: #334155;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }
    
    .resumo-tabela {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      border-collapse: collapse;
      overflow: hidden;
      margin-top: 10px;
    }
    .resumo-tabela td { font-size: 12.5px; }
    .proximos-passos {
      background: #f8fafc;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-top: 12px;
    }
    .passo-linha {
      display: flex;
      gap: 10px;
      font-size: 12.5px;
      color: #475569;
      margin-top: 6px;
    }
    .passo-linha .numero {
      color: #1e40af;
      font-weight: 800;
      min-width: 14px;
    }
    .footer {
      padding: 20px 0 0 0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      margin-top: 20px;
    }
    .footer .consultor {
      color: #475569;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .btn-print {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e40af;
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .aviso-cobertura {
      margin-top: 10px;
      padding: 10px 14px;
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      font-size: 11px;
      color: #991b1b;
    }
    .fluxo-comercial-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 15px;
    }
    .fluxo-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .fluxo-card-title {
      font-size: 9px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .fluxo-item {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: #475569;
      margin-bottom: 4px;
    }
    .fluxo-item strong {
      color: #0F172A;
    }
    .fluxo-total-line {
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 750;
      color: #0f3a6b;
    }
    .fluxo-destaque-verde {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .fluxo-destaque-verde .fluxo-card-title {
      color: #166534;
    }
    .fluxo-destaque-laranja {
      background: #fff7ed;
      border: 1px solid #fed7aa;
    }
    .fluxo-destaque-laranja .fluxo-card-title {
      color: #9a3412;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero-bar">
      <div class="titulo-bloco">
        <div class="badge">PROPOSTA DE AQUISIÇÃO</div>
        <h1>Financiamento Habitacional</h1>
      </div>
      <div class="empresa">
        ${logoHtml}
        ${!companySettings?.logoUrl ? `<div class="nome">${companySettings?.name || "Fidelité"}</div>` : ''}
        <div style="font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">${companySettings?.subtitle || "Negócios Imobiliários"}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">PROPONENTE</div>
      <div class="cliente-nome">${nomeCliente}</div>
      <div class="cliente-localizacao">${localizacaoTexto}</div>
      
      <div class="card-valor-principal">
        <div>
          <div class="label">VALOR DE VENDA DO IMÓVEL</div>
          <div class="valor">${fmt(valorImovel)}</div>
        </div>
        <span class="badge-tipo">${subHeaderTexto}</span>
      </div>
    </div>

    <div class="section" style="padding-top: 0;">
      <div class="section-label">SEU FLUXO FINANCEIRO</div>
      
      <div class="plano-grid">
        <div class="plano-card entrada">
          <div class="micro-label">ENTRADA DO BOLSO</div>
          <div class="valor-plano">${fmt(entradaBolso)}</div>
          <div class="meta-plano">Pague direto ao vendedor</div>
        </div>
        <div class="plano-card mensal">
          <div class="micro-label">ESTIMATIVA PARCELA DO BANCO</div>
          <div class="valor-plano">${parcelaBanco > 0 ? fmt(parcelaBanco) : 'R$ 0,00'}</div>
          <div class="meta-plano">${prazoFinanciamentoMeses}x · Tabela PRICE (${taxaAnualBanco}% a.a.)</div>
        </div>
      </div>
      
      ${Math.abs(totalCobertura) > 1 ? `
        <div class="aviso-cobertura">
          ⚠️ <b>Aviso de Diferença:</b> A soma das condições financeiras (Financiamento, Subsídios, FGTS e Entrada) possui uma diferença de <b>${fmt(Math.abs(totalCobertura))}</b> com relação ao valor de venda do imóvel.
        </div>
      ` : ''}
      
      <div class="section-label" style="margin-top: 24px;">DETALHAMENTO DO CÁLCULO DA ENTRADA</div>
      <table class="resumo-tabela">
        ${itensResumoModoBancario.join('')}
      </table>

      <div class="section-label" style="margin-top: 28px;">RESUMO DO FLUXO FINANCEIRO DA AQUISIÇÃO</div>
      <div class="fluxo-comercial-grid">
        <!-- Card 1 -->
        <div class="fluxo-card">
          <div>
            <div class="fluxo-card-title">Card 1 - Dados do Imóvel</div>
            <div class="fluxo-item"><span>Empreendimento</span><strong>${enterpriseName}</strong></div>
            <div class="fluxo-item"><span>Tipo do imóvel</span><strong>${subHeaderTexto}</strong></div>
          </div>
          <div class="fluxo-total-line" style="color: #0f3a6b;">
            <span>Valor do imóvel</span>
            <span>${fmt(valorImovel)}</span>
          </div>
        </div>

        <!-- Card 2 -->
        <div class="fluxo-card">
          <div>
            <div class="fluxo-card-title">Card 2 - Composição Financeira</div>
            <div class="fluxo-item"><span>Valor do imóvel</span><span>${fmt(valorImovel)}</span></div>
            <div class="fluxo-item"><span>Financiamento bancário</span><span>${fmt(valorFinanciamento)}</span></div>
            ${subsidioFederal > 0 ? `<div class="fluxo-item"><span>Subsídio Federal</span><span>${fmt(subsidioFederal)}</span></div>` : ''}
            ${subsidioMunicipal > 0 ? `<div class="fluxo-item"><span>Subsídio Municipal</span><span>${fmt(subsidioMunicipal)}</span></div>` : ''}
            ${totalSubsidios > 0 ? `<div class="fluxo-item" style="color: #2563eb; font-weight: 600;"><span>Total de subsídios</span><span>${fmt(totalSubsidios)}</span></div>` : ''}
            <div class="fluxo-item" style="border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 4px;"><span>Entrada necessária</span><span>${fmt(Math.max(0, valorImovel - valorFinanciamento))}</span></div>
          </div>
          <div class="fluxo-total-line" style="color: #1e3a8a; font-weight: 800; background: #eff6ff; padding: 4px 8px; border-radius: 4px;">
            <span>Entrada pós subsídios</span>
            <span>${fmt(entradaBolso)}</span>
          </div>
        </div>

        <!-- Card 3 -->
        <div class="fluxo-card fluxo-destaque-verde">
          <div>
            <div class="fluxo-card-title">Card 3 - Condição da Entrada</div>
            <div class="fluxo-item"><span style="color: #15803d; font-weight: 600;">Entrada à vista (sinal)</span><strong style="color: #166534;">${fmt(entradaVista)}</strong></div>
          </div>
          <div class="fluxo-total-line" style="border-color: #bbf7d0; color: #166534; font-weight: 800;">
            <div style="display:flex; flex-direction:column; width:100%;">
              <div style="display:flex; justify-content:space-between; width:100%">
                <span>Saldo da entrada</span>
                <span>${fmt(Math.max(0, entradaBolso - entradaVista))}</span>
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #15803d; text-align: center; margin-top: 8px; background: rgba(255,255,255,0.6); padding: 4px; border-radius: 4px;">
                "Saldo parcelado conforme condição comercial"
              </div>
            </div>
          </div>
        </div>

        <!-- Card 4 -->
        <div class="fluxo-card fluxo-destaque-laranja">
          <div>
            <div class="fluxo-card-title">Card 4 - Parcelamento com Construtora</div>
            <div class="fluxo-item"><span style="color: #c2410c; font-weight: 600;">Parcelamento acordado</span><strong style="color: #9a3412;">${parcelasConstrutoraProposta}x parcelas</strong></div>
          </div>
          <div class="fluxo-total-line" style="border-color: #fed7aa; color: #9a3412; font-weight: 950; display:flex; flex-direction:column; align-items:center;">
            <span style="font-size: 8px; font-weight: 700; text-transform:uppercase; color: #c2410c; margin-bottom: 2px;">Valor aproximado</span>
            <div style="font-size:16px;">${fmt(parcelasConstrutoraProposta > 0 ? Math.max(0, (entradaBolso - entradaVista) / parcelasConstrutoraProposta) : 0)}<span style="font-size:10px; font-weight:500;">/mês</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="proximos-passos">
      <div class="section-label">PRÓXIMOS PASSOS PARA CRÉDITO HABITACIONAL</div>
      <div class="passo-linha"><span class="numero">1.</span><span>Envie seus documentos de renda e identificação para análise</span></div>
      <div class="passo-linha"><span class="numero">2.</span><span>Aguarde aprovação da carta de crédito com o banco parceiro</span></div>
      <div class="passo-linha"><span class="numero">3.</span><span>Assine o contrato de compra e venda e agende a vistoria do imóvel</span></div>
    </div>

    <div class="footer">
      <div class="consultor">${userSales}</div>
      <div>Proposta emitida em ${dataEmissao}</div>
      <div style="margin-top: 6px;">Fluxo financeiro aproximado sujeito a variações de taxa de juros reais e seguro habitacional obrigatório do agente financeiro contratado.</div>
    </div>
  </div>

  <button class="btn-print no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
  
  <script>
    window.onload = function() { 
      setTimeout(function() { window.focus(); }, 100);
    };
  </script>
</body>
</html>`);
      printWindow.document.close();
      return;
    }

    // ==== PDF LAYOUT FOR TERRAIN MODE ====
    const totalParcelas = tipoAmortizacao === "sac" 
      ? results.totalPagarSerie 
      : (results.primeiraParcela * parcelasQtd);
    
    const custoTotalReal = entradaValor + totalBaloes + totalParcelas;
    
    // Mensagem condicional sobre juros
    const mensagemJuros = (taxaJuros || 0) === 0
      ? ''
      : `<div style="margin-top: 12px; padding: 10px 14px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 6px; font-size: 11px; color: #78350f;">
           ⓘ Plano com taxa de <b>${taxaJuros}% ao mês</b> (${tipoAmortizacao === "price" ? "Tabela PRICE" : tipoAmortizacao === "sac" ? "Tabela SAC" : "Financiamento Direto"}).
         </div>`;

    // Linha de balões no resumo
    const linhaBaloesResumo = temBaloes && totalBaloes > 0
      ? `<tr><td style="padding: 10px 16px; color: #475569; border-bottom: 1px solid #f1f5f9;">${balaoQtd} ${balaoPeriodicidade === 'anual' ? 'reforços anuais' : 'reforços semestrais'} de ${fmt(balaoValor)}</td><td style="padding: 10px 16px; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; font-weight: 500;">${fmt(totalBaloes)}</td></tr>`
      : '';
    
    // Elegant small compact side-by-side balloons card (BALÕES MENORES)
    const cardBaloes = temBaloes && totalBaloes > 0
      ? `<div style="margin-top: 12px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
           <div>
             <div style="font-size: 9px; font-weight: 800; color: #b45309; letter-spacing: 0.05em; text-transform: uppercase;">Reforços / Balões</div>
             <div style="font-size: 11.5px; color: #d97706; margin-top: 2px; font-weight: 500;">${balaoQtd}x ${balaoPeriodicidade === 'anual' ? 'anuais' : 'semestrais'} de ${fmt(balaoValor)}</div>
           </div>
           <div style="font-size: 18px; font-weight: 800; color: #78350f; font-variant-numeric: tabular-nums;">${fmt(totalBaloes)}</div>
         </div>`
      : '';

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta - ${nomeCliente}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: white;
      color: #0f172a;
      font-size: 14px;
      line-height: 1.5;
    }
    .page { max-width: 760px; margin: 0 auto; padding: 30px; }
    @page { 
      size: A4; 
      margin: 10mm 15mm; 
    }
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none !important; }
      .page { padding: 0; max-width: 100%; margin: 0; }
    }
    .hero-bar {
      background: #0f3a6b;
      color: white;
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 16px;
    }
    .hero-bar .titulo-bloco { flex: 1; }
    .hero-bar .badge {
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .hero-bar h1 {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .hero-bar .empresa {
      text-align: right;
      font-size: 11px;
      opacity: 0.9;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
    }
    .hero-bar .empresa .nome {
      font-size: 14px;
      font-weight: 700;
      opacity: 1;
      margin-top: 2px;
      margin-bottom: 2px;
    }
    .section { padding: 20px 0; }
    .section-label {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.1em;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .cliente-nome {
      font-size: 18px;
      font-weight: 850;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .cliente-localizacao {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .card-valor-principal {
      background: #eff6ff;
      border-radius: 16px;
      padding: 18px 24px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-valor-principal .label {
      font-size: 9px;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .card-valor-principal .valor {
      font-size: 32px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.03em;
      margin-top: 2px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .card-valor-principal .meta {
      font-size: 11px;
      color: #1e40af;
      margin-top: 6px;
      font-weight: 600;
    }
    .plano-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 10px;
    }
    .plano-card { border-radius: 12px; padding: 14px 16px; }
    .plano-card.entrada { background: #ecfdf5; }
    .plano-card.mensal { background: #f1f5f9; }
    .plano-card .micro-label {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .plano-card.entrada .micro-label { color: #065f46; }
    .plano-card.mensal .micro-label { color: #475569; }
    .plano-card .valor-plano {
      font-size: 20px;
      font-weight: 900;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }
    .plano-card.entrada .valor-plano { color: #064e3b; }
    .plano-card.mensal .valor-plano { color: #0f172a; }
    .plano-card .meta-plano { font-size: 10px; margin-top: 2px; font-weight: 500; }
    .plano-card.entrada .meta-plano { color: #065f46; }
    .plano-card.mensal .meta-plano { color: #475569; }
    .resumo-tabela {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      border-collapse: collapse;
      overflow: hidden;
      margin-top: 10px;
    }
    .resumo-tabela td { font-size: 12.5px; }
    .resumo-tabela .total-row td {
      background: #f1f5f9;
      font-weight: 850;
      padding: 12px 16px;
      font-size: 13.5px;
      color: #0f172a;
    }
    .proximos-passos {
      background: #f8fafc;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-top: 12px;
    }
    .passo-linha {
      display: flex;
      gap: 10px;
      font-size: 12.5px;
      color: #475569;
      margin-top: 6px;
    }
    .passo-linha .numero {
      color: #1e40af;
      font-weight: 800;
      min-width: 14px;
    }
    .footer {
      padding: 20px 0 0 0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      margin-top: 20px;
    }
    .footer .consultor {
      color: #475569;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .btn-print {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e40af;
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero-bar">
      <div class="titulo-bloco">
        <div class="badge">PROPOSTA PERSONALIZADA</div>
        <h1>Investimento em Terreno</h1>
      </div>
      <div class="empresa">
        ${logoHtml}
        ${!companySettings?.logoUrl ? `<div class="nome">${companySettings?.name || "Fidelité"}</div>` : ''}
        <div style="font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">${companySettings?.subtitle || "Negócios Imobiliários"}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">PROPOSTA PARA</div>
      <div class="cliente-nome">${nomeCliente}</div>
      <div class="cliente-localizacao">${localizacaoTexto}</div>
      
      <div class="card-valor-principal">
        <div>
          <div class="label">VALOR DO TERRENO</div>
          <div class="valor">${fmt(valorTotal)}</div>
          <div class="meta">${metragem} m² · ${fmt(valorM2Calculado)}/m²</div>
        </div>
      </div>
    </div>

    <div class="section" style="padding-top: 0;">
      <div class="section-label">SEU PLANO DE PAGAMENTO</div>
      
      <div class="plano-grid">
        <div class="plano-card entrada">
          <div class="micro-label">ENTRADA</div>
          <div class="valor-plano">${fmt(entradaValor)}</div>
          <div class="meta-plano">${entradaPct.toFixed(1)}% · à vista</div>
        </div>
        <div class="plano-card mensal">
          <div class="micro-label">PARCELAS MENSAIS</div>
          <div class="valor-plano">${fmt(results.primeiraParcela)}</div>
          <div class="meta-plano">${parcelasQtd}x · ${tipoAmortizacao === "sac" ? "decrescente (SAC)" : tipoAmortizacao === "price" ? "PRICE" : (taxaJuros > 0 ? "fixas com juros" : "sem juros")}</div>
        </div>
      </div>
      
      ${cardBaloes}
      
      <div class="section-label" style="margin-top: 20px;">RESUMO DO INVESTIMENTO</div>
      <table class="resumo-tabela">
        <tr>
          <td style="padding: 10px 16px; color: #475569; border-bottom: 1px solid #f1f5f9;">Valor do terreno</td>
          <td style="padding: 10px 16px; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; font-weight: 500;">${fmt(valorTotal)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #475569; border-bottom: 1px solid #f1f5f9;">Entrada à vista</td>
          <td style="padding: 10px 16px; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; font-weight: 500;">${fmt(entradaValor)}</td>
        </tr>
        ${linhaBaloesResumo}
        <tr>
          <td style="padding: 10px 16px; color: #475569; border-bottom: 1px solid #f1f5f9;">${parcelasQtd} parcelas de ${fmt(results.primeiraParcela)}</td>
          <td style="padding: 10px 16px; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; font-weight: 500;">${fmt(totalParcelas)}</td>
        </tr>
        <tr class="total-row">
          <td>Total ao final</td>
          <td style="text-align: right; font-variant-numeric: tabular-nums;">${fmt(custoTotalReal)}</td>
        </tr>
      </table>
      
      ${mensagemJuros}
    </div>

    <div class="proximos-passos">
      <div class="section-label">PRÓXIMOS PASSOS</div>
      <div class="passo-linha"><span class="numero">1.</span><span>Reserve seu lote com um sinal simbólico</span></div>
      <div class="passo-linha"><span class="numero">2.</span><span>Assine o contrato com a entrada</span></div>
      <div class="passo-linha"><span class="numero">3.</span><span>Comece a investir no seu futuro</span></div>
    </div>

    <div class="footer">
      <div class="consultor">${userSales}</div>
      <div>Proposta emitida em ${dataEmissao}</div>
      <div style="margin-top: 6px;">Valores ilustrativos. Sujeitos a alteração sem aviso prévio.</div>
    </div>
  </div>

  <button class="btn-print no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
  
  <script>
    window.onload = function() { 
      setTimeout(function() { window.focus(); }, 100);
    };
  </script>
</body>
</html>`);

    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* 1. Left Panel - Configurations */}
      <div className="lg:col-span-5 space-y-6 overflow-y-auto max-h-[80vh] pr-2 scrollbar-hide w-full">
        
        {/* TOGGLE DE MODO DE SIMULAÇÃO */}
        <div className="bg-slate-50 p-1 rounded-2xl border border-slate-150 shadow-sm flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setModoSimulacao("terreno")}
            className={cn(
              "flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-transparent",
              modoSimulacao === "terreno"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-100 border-blue-600"
                : "bg-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            Terreno / Loteamento
          </button>
          <button
            type="button"
            onClick={() => setModoSimulacao("bancario")}
            className={cn(
              "flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-transparent",
              modoSimulacao === "bancario"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100 border-indigo-600"
                : "bg-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Coins className="w-3.5 h-3.5" />
            Imóvel Financiado
          </button>
        </div>

        {/* Card: Proponente */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-blue-600 font-bold uppercase tracking-widest text-[10px]">
            <User className="w-4 h-4" />
            <span>Dados da Simulação</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nome do Cliente
              </label>
              <input 
                type="text" 
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Empreendimento
                </label>
                <input 
                  type="text" 
                  value={empreendimento}
                  onChange={(e) => setEmpreendimento(e.target.value)}
                  placeholder="Ex: Residencial Bela Vista"
                  className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Lote / Quadra
                </label>
                <input 
                  type="text" 
                  value={loteInfo}
                  onChange={(e) => setLoteInfo(e.target.value)}
                  placeholder="Ex: Qd C, Lote 15"
                  className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {modoSimulacao === "terreno" && (
          <>
            {/* Card: Metragem e m² */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-blue-600 font-bold uppercase tracking-widest text-[10px]">
              <MapPin className="w-4 h-4" />
              <span>Dimensões e Valor de Venda</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Tamanho (m²)
              </label>
              <input 
                type="number" 
                value={metragem || ""}
                onChange={(e) => handleMetragemChange(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Valor do m² (R$)
              </label>
              <BrlInput 
                value={valorM2}
                onChange={(val) => handleValorM2Change(Math.max(0, val))}
                className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
              />
              {valorM2 > 0 && (
                <div className="text-[10px] text-blue-600 font-extrabold mt-1.5 animate-fadeIn">
                  ➔ {fmt(valorM2)} / m²
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Valor Total do Terreno (R$ - Editável)
            </label>
            <BrlInput 
              value={valorTotal}
              onChange={(val) => handleValorTotalChange(Math.max(0, val))}
              prefix={<DollarSign className="w-4 h-4 text-slate-400" />}
              className="w-full bg-blue-50 border border-blue-200 focus:border-blue-500 rounded-xl pr-3 py-2.5 text-sm text-blue-900 font-bold focus:outline-none transition-colors"
            />
            {valorTotal > 0 && (
              <div className="text-xs text-blue-700 font-extrabold mt-1.5 animate-fadeIn bg-blue-50/50 px-2.5 py-1 rounded-lg border border-blue-100 inline-block">
                Valor Real: <span className="text-blue-900 font-black">{fmt(valorTotal)}</span>
              </div>
            )}

            {/* Dynamic Sync Options & Quick Actions */}
            <div className="mt-2.5 bg-slate-50/70 p-3 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-start gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">
                  Quando eu mudar o <b>valor total</b>, o que devo manter fixo?
                </p>
              </div>
              <div className="space-y-1.5 ml-1 flex flex-col">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="total_sync"
                    checked={!recalcMetragemOnTotalChange}
                    onChange={() => setRecalcMetragemOnTotalChange(false)}
                    className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                  />
                  <span>Manter <b>tamanho ({metragem} m²)</b> — recalcula o valor do m²</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="total_sync"
                    checked={recalcMetragemOnTotalChange}
                    onChange={() => setRecalcMetragemOnTotalChange(true)}
                    className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                  />
                  <span>Manter <b>valor por m² ({fmt(valorM2)})</b> — recalcula a área do lote</span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    // Recalcula a área com base no total e valor m² atuais de forma automática
                    if (valorM2 > 0) {
                      setMetragem(Math.round((valorTotal / valorM2) * 100) / 100);
                    }
                  }}
                  className="bg-white hover:bg-blue-50 text-[10px] text-blue-600 px-2 rounded-lg border border-slate-200 transition-all font-semibold py-1 flex items-center gap-1 shadow-sm"
                  title="Recalcula o tamanho do lote com base no valor total atual dividido pelo valor do m²"
                >
                  <RefreshCw className="w-3 h-3" /> Restaurar área: {valorM2 > 0 ? (valorTotal / valorM2).toFixed(2) : "0.00"} m²
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Recalcula o valor do m² com base no total e metragem atuais de forma automática
                    if (metragem > 0) {
                      setValorM2(Math.round((valorTotal / metragem) * 100) / 100);
                    }
                  }}
                  className="bg-white hover:bg-slate-50 text-[10px] text-slate-600 px-2 rounded-lg border border-slate-200 transition-all font-semibold py-1 flex items-center gap-1 shadow-sm"
                  title="Recalcula o valor do m² com base no valor total atual dividido pela área"
                >
                  <RefreshCw className="w-3 h-3" /> Restaurar m²: {metragem > 0 ? fmt(valorTotal / metragem) : "0.00"}/m²
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Entrada */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-blue-600 font-bold uppercase tracking-widest text-[10px]">
            <Coins className="w-4 h-4" />
            <span>Valor de Entrada</span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-8">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Valor da Entrada (R$)
                </label>
                <BrlInput 
                  value={entradaValor}
                  onChange={(val) => setEntradaValor(Math.min(valorTotal, Math.max(0, val)))}
                  prefix={<DollarSign className="w-4 h-4 text-slate-400" />}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl pr-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                />
                {entradaValor > 0 && (
                  <div className="text-[10px] text-blue-600 font-extrabold mt-1.5 animate-fadeIn">
                    ➔ {fmt(entradaValor)}
                  </div>
                )}
              </div>

              <div className="col-span-4">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Porcentagem (%)
                </label>
                <div className="relative">
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="number" 
                    value={parseFloat(entradaPct.toFixed(2)) || 0}
                    onChange={(e) => handleEntradaPctChange(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Quick entry percentage tags */}
            <div className="flex gap-2.5 flex-wrap">
              {[10, 15, 20, 30, 50].map(pct => (
                <button
                  key={pct}
                  onClick={() => handleEntradaPctClick(pct)}
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${
                    Math.abs(entradaPct - pct) < 0.5 
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100" 
                      : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card: Balloons / Balões */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-blue-600 font-bold uppercase tracking-widest text-[10px]">
              <Calendar className="w-4 h-4" />
              <span>Balões Intermediários (Opcional)</span>
            </div>
            
            <button
              onClick={() => setTemBaloes(!temBaloes)}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl cursor-pointer transition-all border ${
                temBaloes
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-slate-50 text-slate-400 border-slate-100"
              }`}
            >
              {temBaloes ? "Ativado" : "Desativado"}
            </button>
          </div>

          {temBaloes && (
            <div className="space-y-4 pt-1 animate-fadeIn">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Periodicidade dos Balões
                  </label>
                  <select
                    value={balaoPeriodicidade}
                    onChange={(e: any) => setBalaoPeriodicidade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="semestral">Semestral (6 meses)</option>
                    <option value="anual">Anual (12 meses)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Quantidade de Balões
                  </label>
                  <input
                    type="number"
                    value={balaoQtd || ""}
                    onChange={(e) => setBalaoQtd(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-8">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Valor de Cada Balão (R$)
                  </label>
                  <BrlInput 
                    value={balaoValor}
                    onChange={(val) => handleBalaoValorChange(Math.max(0, val))}
                    prefix={<DollarSign className="w-4 h-4 text-slate-400" />}
                    className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl pr-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                  />
                  {balaoValor > 0 && (
                    <div className="text-[10px] text-amber-600 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(balaoValor)} cada balão
                    </div>
                  )}
                </div>

                <div className="col-span-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Porcentagem (%)
                  </label>
                  <div className="relative">
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="number"
                      value={parseFloat(balaoPct.toFixed(2)) || 0}
                      onChange={(e) => handleBalaoPctChange(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-2xl flex items-center justify-between text-xs text-amber-800 font-semibold">
                <span>Total em Balões:</span>
                <span>{fmt(totalBaloes)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card: Installments Options */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-blue-600 font-bold uppercase tracking-widest text-[10px]">
            <CheckCircle className="w-4 h-4" />
            <span>Condição de Financiamento Direto</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Quantidade de Parcelas Mensais
              </label>
              <input
                type="number"
                value={parcelasQtd || ""}
                onChange={(e) => setParcelasQtd(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none"
              />
              <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
                {[12, 24, 36, 60, 120, 180, 240].map(p => (
                  <button 
                    key={p} 
                    onClick={() => setParcelasQtd(p)}
                    className="text-[9px] font-bold bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-500 cursor-pointer"
                  >
                    {p}x
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Amortização / Juros
                </label>
                <select
                  value={tipoAmortizacao}
                  onChange={(e: any) => setTipoAmortizacao(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none"
                >
                  <option value="fixo">Nominal / Fixas</option>
                  <option value="price">Tabela PRICE</option>
                  <option value="sac">Tabela SAC (Decrescentes)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Juros Mensal (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={taxaJuros}
                  onChange={(e) => setTaxaJuros(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Indexador / Correção Anual
              </label>
              <select
                value={indexador}
                onChange={(e: any) => setIndexador(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none"
              >
                <option value="Sem reajuste (Fixas)">Sem reajuste (Fixas)</option>
                <option value="IGP-M + 0.5% a.m.">IGP-M + 0.5% a.m.</option>
                <option value="IPCA Anual">IPCA Anual</option>
                <option value="Índice de Poupança (TR)">Índice de Poupança (TR)</option>
                <option value="IPCA + 0.6% a.m.">IPCA + 0.6% a.m.</option>
              </select>
            </div>
          </div>
        </div>
      </>
    )}

        {modoSimulacao === "bancario" && (
          <>
            {/* Card: Dados do Imóvel Financiado */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
                <Coins className="w-4 h-4" />
                <span>Dados do Imóvel</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Tipo de Imóvel
                  </label>
                  <select
                    value={tipoImovel}
                    onChange={(e) => setTipoImovel(e.target.value as "apartamento" | "casa")}
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                  >
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Valor do Imóvel (R$)
                  </label>
                  <BrlInput
                    value={valorImovel}
                    onChange={(val) => setValorImovel(Math.max(0, val))}
                    placeholder="200000"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                  />
                  {valorImovel > 0 && (
                    <div className="text-[10px] text-indigo-600 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(valorImovel)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card: Composição do Pagamento */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
                <Sparkles className="w-4 h-4" />
                <span>Composição do Pagamento</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Preencha apenas o que se aplica ao caso (MCMV, Pró-cotista, SBPE...). Campos vazios são ignorados.
              </p>

              {/* Subsídios */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Subsídio Federal (R$)
                  </label>
                  <BrlInput
                    value={subsidioFederal}
                    onChange={(val) => setSubsidioFederal(Math.max(0, val))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                  />
                  {subsidioFederal > 0 && (
                    <div className="text-[10px] text-indigo-600 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(subsidioFederal)}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Subsídio Municipal (R$)
                  </label>
                  <BrlInput
                    value={subsidioMunicipal}
                    onChange={(val) => setSubsidioMunicipal(Math.max(0, val))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                  />
                  {subsidioMunicipal > 0 && (
                    <div className="text-[10px] text-indigo-600 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(subsidioMunicipal)}
                    </div>
                  )}
                </div>
              </div>

              {/* FGTS */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  FGTS Disponível (R$)
                </label>
                <BrlInput
                  value={fgtsCliente}
                  onChange={(val) => setFgtsCliente(Math.max(0, val))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                />
                {fgtsCliente > 0 && (
                  <div className="text-[10px] text-indigo-600 font-extrabold mt-1.5 animate-fadeIn">
                    ➔ {fmt(fgtsCliente)}
                  </div>
                )}
              </div>

              {/* Financiamento bancário */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-2">
                  Financiamento Bancário
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Valor Liberado pelo Banco (R$)
                  </label>
                  <BrlInput
                    value={valorFinanciamento}
                    onChange={(val) => setValorFinanciamento(Math.max(0, val))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none transition-colors animate-pulse-subtle"
                  />
                  {valorFinanciamento > 0 && (
                    <div className="text-[10px] text-indigo-600 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(valorFinanciamento)}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1 font-extrabold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                    <span>Valor da Parcela Mensal (R$ - Editável)</span>
                  </label>
                  <BrlInput
                    value={parcelaBanco}
                    onChange={(val) => setParcelaBanco(Math.max(0, val))}
                    placeholder="586.89"
                    className="w-full bg-indigo-50 border border-indigo-200 focus:border-indigo-500 text-indigo-950 font-black rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-colors"
                  />
                  {parcelaBanco > 0 && (
                    <div className="text-[10px] text-indigo-700 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(parcelaBanco)} / mês
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">
                    Insira diretamente a parcela aprovada. Não calculamos via fórmulas porque você já tem as aprovações reais do banco!
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Prazo (meses)
                    </label>
                    <input
                      type="number"
                      value={prazoFinanciamentoMeses || ""}
                      onChange={(e) => setPrazoFinanciamentoMeses(parseInt(e.target.value) || 0)}
                      placeholder="360"
                      className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Taxa Anual (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={taxaAnualBanco || ""}
                      onChange={(e) => setTaxaAnualBanco(parseFloat(e.target.value) || 0)}
                      placeholder="4.0"
                      className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Parcelamento da Entrada (Opcional) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-blue-600 font-bold uppercase tracking-widest text-[10px]">
                  <Calculator className="w-4 h-4" />
                  <span>Parcelamento da Entrada (Opcional)</span>
                </div>
                {/* Switch Toggle */}
                <button
                  onClick={() => setParcelarEntrada(!parcelarEntrada)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    parcelarEntrada ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      parcelarEntrada ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Ative para dividir o valor da entrada restante (<span className="font-bold text-slate-700">{fmt(entradaBolso)}</span>) entre comissão/sinal da imobiliária e o saldo com a construtora.
              </p>

              {parcelarEntrada && (
                <div className="space-y-4 pt-2 animate-fadeIn text-slate-700">
                  {/* Resumo da Entrada Total */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold">Valor da Entrada Total:</span>
                    <span className="text-sm font-black text-slate-800">{fmt(entradaBolso)}</span>
                  </div>

                  {/* Split Grid */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Parte da Imobiliária */}
                    <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-2xl space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                        🏢 PARTE DA IMOBILIÁRIA (Sinal / Comissão)
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Valor da Entrada Imobiliária (R$)
                        </label>
                        <BrlInput
                          value={valorImobiliaria}
                          onChange={(val) => handleValorImobiliariaChange(val)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none transition-colors"
                        />
                        {valorImobiliaria > 0 && (
                          <div className="text-[10px] text-blue-600 font-extrabold mt-1">
                            ➔ {fmt(valorImobiliaria)}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Quantidade de Parcelas (Imobiliária)
                        </label>
                        <select
                          value={parcelasImobiliaria}
                          onChange={(e) => setParcelasImobiliaria(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                        >
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((p) => (
                            <option key={p} value={p}>
                              {p}x {p === 1 ? "(À Vista)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {parcelasImobiliaria > 1 && valorImobiliaria > 0 && (
                        <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-800 font-black animate-fadeIn">
                          <span>Valor da Parcela:</span>
                          <span>{fmt(parcelaImobiliariaValor)} /mês</span>
                        </div>
                      )}
                    </div>

                    {/* Parte da Construtora */}
                    <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                        🏗️ PARTE DA CONSTRUTORA (Ato / Parcelado)
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Valor com Construtora (R$)
                        </label>
                        <BrlInput
                          value={valorConstrutora}
                          onChange={(val) => handleValorConstrutoraChange(val)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-200/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none transition-colors"
                        />
                        {valorConstrutora > 0 && (
                          <div className="text-[10px] text-indigo-600 font-extrabold mt-1">
                            ➔ {fmt(valorConstrutora)}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Quantidade de Parcelas (Construtora)
                        </label>
                        <select
                          value={parcelasConstrutora}
                          onChange={(e) => setParcelasConstrutora(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white border border-slate-200/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none transition-colors"
                        >
                          {[1, 6, 12, 18, 24, 30, 36, 48, 60, 72, 84, 100, 120].map((p) => (
                            <option key={p} value={p}>
                              {p}x {p === 1 ? "(À Vista)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {parcelasConstrutora > 1 && valorConstrutora > 0 && (
                        <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs text-indigo-800 font-black animate-fadeIn">
                          <span>Valor da Parcela:</span>
                          <span>{fmt(parcelaConstrutoraValor)} /mês</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card: Corretor Responsável */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
                <User className="w-4 h-4" />
                <span>Corretor Responsável</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Selecione o Corretor
                </label>
                <select
                  value={corretorResponsavel}
                  onChange={(e) => setCorretorResponsavel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                >
                  {corretoresList.length > 0 ? (
                    corretoresList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Nenhum corretor encontrado</option>
                  )}
                </select>
              </div>
            </div>

            {/* Card: Condições da Proposta Fidelité */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
                <Calculator className="w-4 h-4" />
                <span>Detalhamento da Proposta (Fidelité)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ajuste as condições comerciais de entrada à vista e parcelamento restante direto com a Construtora.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Entrada à Vista (Sinal)
                  </label>
                  <BrlInput
                    value={entradaVista}
                    onChange={(val) => setEntradaVista(Math.min(entradaBolso, Math.max(0, val)))}
                    placeholder="12000"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none transition-colors"
                  />
                  {entradaVista > 0 && (
                    <div className="text-[10px] text-indigo-600 font-extrabold mt-1.5 animate-fadeIn">
                      ➔ {fmt(entradaVista)}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Qtd. Parcelas (Construtora)
                  </label>
                  <input
                    type="number"
                    value={parcelasConstrutoraProposta || ""}
                    onChange={(e) => setParcelasConstrutoraProposta(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="18"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Card: Configuração de Logotipo */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
                <Building2 className="w-4 h-4" />
                <span>Configuração de Logotipo</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-bold">Usar logo da empresa</span>
                  <button
                    onClick={() => setUsarLogoEmpresa(!usarLogoEmpresa)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      usarLogoEmpresa ? "bg-indigo-500" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        usarLogoEmpresa ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  {usarLogoEmpresa 
                    ? "Exibindo logotipo padrão ou da empresa cadastrada no sistema." 
                    : "Utilizando logotipo personalizado definido abaixo."}
                </p>
                {!usarLogoEmpresa && (
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                      URL da Imagem da Logo personalizada
                    </label>
                    <input
                      type="text"
                      value={customLogoUrl}
                      onChange={(e) => setCustomLogoUrl(e.target.value)}
                      placeholder="https://exemplo.com/logo.png"
                      className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Save Simulation Button */}
        <button
          onClick={salvarSimulacao}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3.5 text-xs font-black uppercase tracking-widest transition-all cursor-pointer text-center mb-3 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/15"
        >
          <Save className="w-4 h-4" />
          Salvar Simulação
        </button>

        {/* Clean Reset Button */}
        <button
          onClick={zerarSimulador}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl py-3.5 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer text-center mb-5"
        >
          Limpar Simulador
        </button>

        {/* Histórico de Simulações */}
        {historico.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Histórico de Simulações
            </h3>
            <div className="space-y-3">
              {historico.map((sim) => (
                <div 
                  key={sim.id}
                  className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-blue-200 transition-colors pointer-events-auto"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-800 truncate max-w-[150px]" title={sim.clienteNome}>
                        {sim.clienteNome}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-wider text-white",
                        sim.tipo === "terreno" ? "bg-emerald-600" : "bg-purple-600"
                      )}>
                        {sim.tipo === "terreno" ? "Terreno" : "Crédito"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mt-1.5">
                      <span>{sim.data}</span>
                      <span className="text-slate-700 font-extrabold">{fmt(sim.valorTotal)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100/60 pt-2.5">
                    <button
                      type="button"
                      onClick={() => carregarSimulacao(sim)}
                      className="flex-1 bg-white hover:bg-blue-50 border border-slate-200 text-blue-600 hover:text-blue-700 font-black py-1.5 px-3 rounded-lg text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                    >
                      Carregar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirSimulacao(sim.id)}
                      className="bg-white hover:bg-red-50 border border-slate-200 text-slate-400 hover:text-red-600 font-bold p-1.5 rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Right Panel - Live Preview proposal */}
      <div className="lg:col-span-7 flex flex-col space-y-6">
        
        {modoSimulacao === "terreno" && (
          <div id="simulacao-proposta-pdf" className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden flex-1 flex flex-col">
          
          {/* Branded Header card */}
          <div className="p-8 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {companySettings?.logoUrl ? (
                  <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-150 shadow-sm flex items-center justify-center">
                    <img src={companySettings.logoUrl} alt="Logo" className="max-h-10 object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-lg shadow-blue-100">
                    {companySettings?.name ? companySettings.name.charAt(0) : "P"}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-800 leading-none">
                    {companySettings?.name || "PONTO CHAVE"}
                  </h3>
                  <p className="text-[7px] uppercase tracking-[0.2em] font-black text-blue-500 mt-1 leading-none">
                    {companySettings?.subtitle || "GESTÃO • PROCESSOS"}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <span className="inline-flex px-2.5 py-1 text-[8px] font-bold text-blue-600 uppercase tracking-widest bg-blue-100/60 rounded-full">
                  Proposta Exclusiva
                </span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Gerado em {format(new Date(), "dd/MM/yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Proposal main body content */}
          <div className="p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            
            {/* Warning if total sum has issues */}
            {results.saldoExcedido && (
              <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-red-800 text-xs flex gap-2 items-start shrink-0">
                <Info className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Atenção ao cálculo do fluxo:</strong> A soma do valor de entrada e balões intermediários ultrapassa o valor total do lote! Reduza a entrada ou ajuste o preço.
                </div>
              </div>
            )}

            {/* Client info header card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  PROPROPENTE / INTERESSADO
                </span>
                <span className="text-sm font-bold text-slate-800 truncate block">
                  {clienteNome || "Ainda não identificado"}
                </span>
              </div>
              <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  OBJETO DA NEGOCIAÇÃO
                </span>
                <span className="text-sm font-bold text-slate-800 truncate block">
                  {empreendimento ? `${empreendimento} ${loteInfo ? `· (${loteInfo})` : ""}` : "Geral / Sob Consulta"}
                </span>
              </div>
            </div>

            {/* Bento Grid Metrics summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 text-center flex flex-col justify-between">
                <div>
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Área do Lote
                  </span>
                  <span className="text-base font-black text-slate-800">{metragem} m²</span>
                </div>
                <span className="block text-[8px] text-blue-500 font-bold mt-1">
                  {fmt(valorM2Calculado)}/m²
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-center shadow-inner flex flex-col justify-between">
                <div>
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    VALOR DO TERRENO
                  </span>
                  <span className="text-base font-black text-blue-600">{fmt(valorTotal)}</span>
                </div>
                <span className="block text-[8px] text-slate-400 font-bold mt-1">Valor de Venda</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 text-center flex flex-col justify-between">
                <div>
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Entrada (Sinal)
                  </span>
                  <span className="text-base font-black text-slate-800">{fmt(entradaValor)}</span>
                </div>
                <span className="block text-[8px] text-amber-600 font-bold mt-1">
                  {entradaPct.toFixed(1)}% de entrada
                </span>
              </div>

              <div className={cn(
                "p-4 rounded-2xl border text-center flex flex-col justify-between transition-all",
                temBaloes 
                  ? "bg-indigo-50/40 border-indigo-200" 
                  : "bg-slate-50/40 border-slate-200/60 opacity-60"
              )}>
                <div>
                  <span className={cn(
                    "block text-[8px] font-bold uppercase tracking-widest mb-1",
                    temBaloes ? "text-indigo-700" : "text-slate-400"
                  )}>
                    REFORÇO / BALÕES
                  </span>
                  <span className={cn(
                    "text-base font-black",
                    temBaloes ? "text-indigo-800" : "text-slate-500"
                  )}>
                    {temBaloes ? `${balaoQtd}x ${fmt(balaoValor)}` : "R$ 0,00"}
                  </span>
                </div>
                <span className={cn(
                  "block text-[8px] font-bold mt-1",
                  temBaloes ? "text-indigo-600" : "text-slate-400"
                )}>
                  {temBaloes ? `Total: ${fmt(totalBaloes)} (${balaoPct.toFixed(1)}%)` : "Desativado"}
                </span>
              </div>

              <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200 text-center flex flex-col justify-between">
                <div>
                  <span className="block text-[8px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                    SÉRIE MENSAL
                  </span>
                  <span className="text-base font-black text-amber-800">{fmt(results.primeiraParcela)}</span>
                </div>
                <span className="block text-[8px] text-amber-600 font-bold mt-1">
                  {parcelasQtd} parcelas ({mensaisPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Detailed summary bullet points */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                DETALHE DO PLANO PROPOSTO
              </h4>
              
              <div className="p-6 bg-slate-50 rounded-[24px] space-y-3.5 border border-slate-100">
                <div className="flex gap-3 text-sm text-slate-700 font-medium">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs flex-shrink-0 font-bold">1</div>
                  <div className="flex-1 text-left">
                    Entrada de <strong className="text-slate-800">{fmt(entradaValor)}</strong> paga à vista no ato de fechamento do negócio ({entradaPct.toFixed(1)}%).
                  </div>
                </div>
                
                {temBaloes && (
                  <div className="flex gap-3 text-sm text-slate-700 font-medium">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs flex-shrink-0 font-bold">2</div>
                    <div className="flex-1 text-left">
                      Reforço financeiro com <strong className="text-slate-800">{balaoQtd} parcelas {balaoPeriodicidade}s (balões)</strong> de <strong className="text-slate-800">{fmt(balaoValor)}</strong>. Total em balões: {fmt(totalBaloes)} ({balaoPct.toFixed(1)}%).
                    </div>
                  </div>
                )}

                <div className="flex gap-3 text-sm text-slate-700 font-medium">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs flex-shrink-0 font-bold">
                    {temBaloes ? "3" : "2"}
                  </div>
                  <div className="flex-1 text-left">
                    Saldo restante parcelado em <strong className="text-slate-800">{parcelasQtd} pagamentos mensais</strong> de <strong className="text-slate-800">{fmt(results.primeiraParcela)}</strong> ({mensaisPct.toFixed(1)}%)
                    {tipoAmortizacao === "sac" && ` (reajustas decrescentes de acordo com a tabela SAC, finalizando em ${fmt(results.ultimaParcela)})`}.
                    {taxaJuros > 0 ? ` Taxa de juros mensal de ${taxaJuros}% aplicada.` : " Financiamento sem incidência de juros."}
                  </div>
                </div>

                <div className="flex gap-3 text-sm text-slate-700 font-medium pt-2 border-t border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs flex-shrink-0 font-bold">•</div>
                  <div className="flex-1 text-xs text-slate-500 text-left">
                    Ajuste regular e correção financeira anual calculada com base no indexador comercial: <strong className="text-slate-700">{indexador}</strong>.
                  </div>
                </div>
              </div>
            </div>

            {/* Illustrative timeline visualization */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                HISTÓRICO RELEVANTE (EXEMPLO DE FLUXO)
              </h4>

              <div className="border border-slate-100 rounded-3xl overflow-hidden text-left bg-white text-xs divide-y divide-slate-50">
                <div className="grid grid-cols-4 px-4 py-2.5 bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[9px]">
                  <div>Etapa / Lançamento</div>
                  <div>Tipo de Operação</div>
                  <div className="text-right">Valor Líquido</div>
                  <div className="text-right">Saldo Devedor</div>
                </div>
                
                {/* Row: Entry */}
                <div className="grid grid-cols-4 px-4 py-3 items-center">
                  <div className="font-semibold text-slate-800">Ato de Compra</div>
                  <div><span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold text-[9px]">ENTRADA</span></div>
                  <div className="text-right font-medium text-slate-800">{fmt(entradaValor)}</div>
                  <div className="text-right text-slate-500">{fmt(valorTotal - entradaValor)}</div>
                </div>

                {/* Rows: Installments previews */}
                {results.parcelasLista.slice(0, 3).map((p, idx) => (
                  <div key={idx} className="grid grid-cols-4 px-4 py-2.5 items-center">
                    <div className="text-slate-600">Parcela {p.num} de {parcelasQtd}</div>
                    <div className="text-slate-500">Mensalidade {idx === 0 ? "Inicial" : ""}</div>
                    <div className="text-right text-slate-700">{fmt(p.valor)}</div>
                    <div className="text-right text-slate-400">{fmt(p.saldoDevedor)}</div>
                  </div>
                ))}

                {/* Show dot dot dot if installments > 3 */}
                {parcelasQtd > 3 && (
                  <div className="grid grid-cols-4 px-4 py-2.5 items-center bg-slate-50/30">
                    <div className="text-slate-400">...</div>
                    <div className="text-slate-400">Mensalidades Intermediárias</div>
                    <div className="text-right text-slate-400">...</div>
                    <div className="text-right text-slate-400">...</div>
                  </div>
                )}

                {/* Row: Last installment */}
                {results.parcelasLista.length > 0 && results.parcelasLista[results.parcelasLista.length - 1].num > 3 && (
                  <div className="grid grid-cols-4 px-4 py-2.5 items-center">
                    <div className="text-slate-600">Parcela {parcelasQtd} de {parcelasQtd}</div>
                    <div className="text-slate-500">Mensalidade Final</div>
                    <div className="text-right text-slate-700">
                      {fmt(results.parcelasLista[results.parcelasLista.length - 1].valor)}
                    </div>
                    <div className="text-right text-slate-400">
                      {fmt(results.parcelasLista[results.parcelasLista.length - 1].saldoDevedor)}
                    </div>
                  </div>
                )}
                
                {/* Total consolidado */}
                <div className="grid grid-cols-4 px-4 py-3 bg-purple-50/20 font-bold items-center">
                  <div className="text-purple-800 font-extrabold text-xs">INVESTIMENTO REAL</div>
                  <div className="text-slate-400 text-[10px] font-normal">Soma das parcelas</div>
                  <div className="text-right text-purple-800 text-xs">
                    {fmt(entradaValor + totalBaloes + (tipoAmortizacao === "sac" ? results.totalPagarSerie : (results.primeiraParcela * parcelasQtd)))}
                  </div>
                  <div className="text-right text-indigo-600">Quitação Total</div>
                </div>
              </div>
            </div>
            
          </div>

          {/* Action trigger footer panel */}
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 shrink-0 justify-end">
            <button
              onClick={copiarWhatsApp}
              className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Copiar p/ WhatsApp
            </button>
            <button
              onClick={imprimirProposta}
              className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Imprimir ou Salvar PDF
            </button>
          </div>

        </div>
        )}

        {modoSimulacao === "bancario" && (
          <div id="simulacao-proposta-pdf" className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden flex-1 flex flex-col">
            
            {/* Branded Header card */}
            <div className="p-8 bg-blue-50/50 border-b border-slate-100 shrink-0">
               <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {companySettings?.logoUrl ? (
                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-150 shadow-sm flex items-center justify-center">
                      <img src={companySettings.logoUrl} alt="Logo" className="max-h-10 object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-lg shadow-blue-100">
                      {companySettings?.name ? companySettings.name.charAt(0) : "P"}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-slate-800 leading-none">
                      {companySettings?.name || "Fidelité"}
                    </h3>
                    <p className="text-[7.5px] uppercase tracking-[0.2em] font-black text-blue-600 mt-1.5 leading-none">
                      {companySettings?.subtitle || "NEGÓCIOS IMOBILIÁRIOS"}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="inline-flex px-2.5 py-1 text-[8px] font-bold text-blue-700 uppercase tracking-widest bg-blue-100/60 rounded-full">
                    Financiamento Habitacional
                  </span>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Gerado em {format(new Date(), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
            </div>

            {/* Proposal main body content */}
            <div className="p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
              {/* Client info header card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    PROPROPENTE / INTERESSADO
                  </span>
                  <span className="text-sm font-bold text-slate-800 truncate block">
                    {clienteNome || "Ainda não identificado"}
                  </span>
                </div>
                <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    OBJETO DA SIMULAÇÃO
                  </span>
                  <span className="text-sm font-bold text-slate-800 truncate block">
                    {empreendimento ? `${empreendimento} ${loteInfo ? `· (${loteInfo})` : ""}` : (tipoImovel === "casa" ? "Casa Residencial" : "Apartamento")}
                  </span>
                </div>
              </div>

              {/* Card herói: Valor do Imóvel */}
              <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl flex justify-between items-center">
                <div>
                  <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    VALOR DE VENDA DO IMÓVEL
                  </span>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">
                    {fmt(valorImovel)}
                  </div>
                </div>
                 <span className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                  {tipoImovel === "casa" ? "Casa" : "Apartamento"}
                </span>
              </div>

              {/* SEU FLUXO FINANCEIRO */}
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Seu Fluxo Financeiro
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card Entrada do bolso */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl p-5 shadow-lg shadow-blue-700/5 col-span-1 sm:col-span-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-blue-100/90 leading-none">
                          Entrada do Bolso
                        </div>
                        <div className="text-2.5xl font-black mt-2 font-sans tracking-tight leading-none text-white tabular-nums">
                          {fmt(entradaBolso)}
                        </div>
                      </div>
                      {parcelarEntrada && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-100 border border-blue-400 text-[8px] font-black uppercase tracking-widest">
                          Fluxo Parcelado
                        </span>
                      )}
                    </div>
                    {parcelarEntrada ? (
                      <div className="mt-4 pt-4 border-t border-blue-500/40 grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                          <span className="block text-[8px] uppercase tracking-widest text-blue-200 font-extrabold mb-1">🏢 Imobiliária (Comissão)</span>
                          <strong className="text-sm text-white font-black">{fmt(valorImobiliaria)}</strong>
                          <span className="block text-[10px] text-blue-100/80 mt-1 font-medium bg-blue-700/30 px-1.5 py-0.5 rounded inline-block">{parcelasImobiliaria}x de {fmt(parcelaImobiliariaValor)}</span>
                        </div>
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                          <span className="block text-[8px] uppercase tracking-widest text-blue-200 font-extrabold mb-1">🏗️ Construtora (Saldo)</span>
                          <strong className="text-sm text-white font-black">{fmt(valorConstrutora)}</strong>
                          <span className="block text-[10px] text-blue-100/80 mt-1 font-medium bg-blue-700/30 px-1.5 py-0.5 rounded inline-block">{parcelasConstrutora}x de {fmt(parcelaConstrutoraValor)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-blue-100/80 mt-2 font-medium">
                        Pague direto ao vendedor
                      </div>
                    )}
                  </div>

                  {/* Card Estimativa Parcela do Banco */}
                  <div className="bg-gradient-to-br from-blue-800 to-blue-600 text-white rounded-3xl p-5 shadow-lg shadow-blue-700/5">
                    <div className="text-[8px] font-black uppercase tracking-widest text-blue-100/90 leading-none">
                      Estimativa Parcela do Banco
                    </div>
                    <div className="text-2.5xl font-black mt-2 font-sans tracking-tight leading-none text-white tabular-nums">
                      {parcelaBanco > 0 ? fmt(parcelaBanco) : "R$ 0,00"}
                    </div>
                    <div className="text-[10px] text-blue-100/80 mt-2 font-medium">
                      {prazoFinanciamentoMeses}x · Tabela PRICE ({taxaAnualBanco}% a.a.)
                    </div>
                  </div>
                </div>
              </div>

              {/* Composição do pagamento */}
              <div className="space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cálculo do Fluxo de Entrada (Conforme Planilha)
                </div>

                <div className="bg-slate-50/80 border border-slate-100 rounded-[28px] p-5 space-y-4 shadow-sm">
                  {/* Step 1: Valor apartamento */}
                  <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor apartamento / imóvel</span>
                    <span className="text-sm font-extrabold text-slate-800 tabular-nums">{fmt(valorImovel)}</span>
                  </div>

                  {/* Step 2: Valor financiamento liberado */}
                  <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor financiamento liberado</span>
                    <span className="text-sm font-semibold text-slate-600 tabular-nums font-mono">
                      {valorFinanciamento > 0 ? `- ${fmt(valorFinanciamento)}` : fmt(0)}
                    </span>
                  </div>

                  {/* Step 3: Valor entrada (Bruto) */}
                  <div className="flex justify-between items-center py-2.5 px-4 bg-slate-100/70 rounded-2xl">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Valor entrada (Diferença)</span>
                    <span className="text-sm font-black text-slate-900 tabular-nums font-mono">
                      {fmt(Math.max(0, (valorImovel || 0) - (valorFinanciamento || 0)))}
                    </span>
                  </div>

                  {/* Step 4 & 5: Subsídios detalhados */}
                  {(subsidioFederal > 0 || subsidioMunicipal > 0) && (
                    <div className="space-y-2 pl-3 border-l-2 border-purple-200 bg-purple-50/20 p-2.5 rounded-r-xl">
                      {subsidioFederal > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-600 font-medium">Subsídio Federal</span>
                          <span className="font-bold text-purple-700 tabular-nums font-mono">- {fmt(subsidioFederal)}</span>
                        </div>
                      )}
                      {subsidioMunicipal > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-purple-600 font-medium">Municipal (Subsídio)</span>
                          <span className="font-bold text-purple-700 tabular-nums font-mono">- {fmt(subsidioMunicipal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-1 py-1 px-2.5 bg-purple-100/60 rounded-lg text-xs font-bold text-purple-800">
                        <span>Valor total de Subsídios</span>
                        <span className="font-black font-mono tabular-nums">{fmt(totalSubsidios)}</span>
                      </div>
                    </div>
                  )}

                  {/* Step 6: FGTS */}
                  {fgtsCliente > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">FGTS</span>
                      <span className="text-sm font-bold text-blue-700 tabular-nums font-mono">- {fmt(fgtsCliente)}</span>
                    </div>
                  )}

                  {/* Step 7: Entrada descontando Subsídios */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl p-5 shadow-lg shadow-blue-700/10">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-85 leading-none">
                      Entrada descontando Subsídios
                    </div>
                    <div className="text-3.5xl font-black mt-1.5 font-sans tracking-tight leading-none tabular-nums">
                      {fmt(entradaBolso)}
                    </div>
                    {parcelaBanco > 0 && (
                      <div className="text-xs opacity-95 mt-2.5 font-medium leading-relaxed">
                        Seu financiamento com o banco de <b>{fmt(valorFinanciamento)}</b> em <b>{prazoFinanciamentoMeses}x</b> gerará estimativa de parcela de <b>{fmt(parcelaBanco)}/mês</b> (Tabela PRICE, taxa de {taxaAnualBanco}% a.a.).
                      </div>
                    )}
                  </div>

                  {/* RESUMO DO FLUXO FINANCEIRO DA AQUISIÇÃO (4 Cards) */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div className="text-[11px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>Resumo do Fluxo Financeiro da Aquisição</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Card 1 - Dados do Imóvel */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                        <div>
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Card 1 - Dados do Imóvel
                          </span>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Empreendimento:</span>
                              <span className="font-semibold text-slate-800">{empreendimento || "Bella White"}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Tipo:</span>
                              <span className="font-semibold text-slate-800 capitalize">{tipoImovel === "casa" ? "Casa" : "Apartamento"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-baseline">
                          <span className="text-xs font-bold text-slate-500">Valor do Imóvel:</span>
                          <span className="text-base font-black text-indigo-600 font-sans">{fmt(valorImovel)}</span>
                        </div>
                      </div>

                      {/* Card 2 - Composição Financeira */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-2">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Card 2 - Composição Financeira
                        </span>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Valor do Imóvel:</span>
                            <span className="font-medium text-slate-700">{fmt(valorImovel)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Financiamento Bancário:</span>
                            <span className="font-medium text-slate-700">{fmt(valorFinanciamento)}</span>
                          </div>
                          {subsidioFederal > 0 && (
                            <div className="flex justify-between text-purple-600 font-medium">
                              <span>Subsídio Federal:</span>
                              <span>{fmt(subsidioFederal)}</span>
                            </div>
                          )}
                          {subsidioMunicipal > 0 && (
                            <div className="flex justify-between text-purple-600 font-medium">
                              <span>Subsídio Municipal:</span>
                              <span>{fmt(subsidioMunicipal)}</span>
                            </div>
                          )}
                          {totalSubsidios > 0 && (
                            <div className="flex justify-between text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                              <span>Total de Subsídios:</span>
                              <span>{fmt(totalSubsidios)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">Entrada Necessária:</span>
                            <span className="font-bold text-slate-800">{fmt(Math.max(0, valorImovel - valorFinanciamento))}</span>
                          </div>
                          <div className="flex justify-between p-1.5 bg-indigo-50 text-indigo-800 rounded font-black text-xs">
                            <span>Entrada após Subsídios:</span>
                            <span>{fmt(entradaBolso)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3 - Condição da Entrada */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 rounded-3xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                        <div>
                          <span className="block text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-2.5">
                            Card 3 - Condição da Entrada
                          </span>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-emerald-700 font-medium font-bold">Entrada à Vista (Sinal):</span>
                              <span className="font-black text-emerald-950">{fmt(entradaVista)}</span>
                            </div>
                            <div className="flex justify-between text-xs pt-1.5 border-t border-emerald-100/60">
                              <span className="text-teal-700 font-bold">Saldo da Entrada:</span>
                              <span className="font-extrabold text-teal-900">{fmt(Math.max(0, entradaBolso - entradaVista))}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 p-2 bg-emerald-100/40 rounded-xl text-center">
                          <p className="text-[10px] text-emerald-800 font-bold tracking-wide leading-tight">
                            "Saldo parcelado conforme condição comercial"
                          </p>
                        </div>
                      </div>

                      {/* Card 4 - Parcelamento com Construtora */}
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 rounded-3xl border border-amber-150 shadow-sm flex flex-col justify-between">
                        <div>
                          <span className="block text-[9px] font-black text-amber-800 uppercase tracking-widest mb-2">
                            Card 4 - Parcelamento com Construtora
                          </span>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-amber-700 font-medium">Parcelamento:</span>
                              <span className="font-black text-amber-950 bg-amber-100 px-2 py-0.5 rounded text-xs tracking-tight">
                                {parcelasConstrutoraProposta} meses (x)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-amber-200/50 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                            Valor Aproximado da Parcela
                          </span>
                          <div className="text-lg font-black text-amber-900 leading-none">
                            {fmt(parcelasConstrutoraProposta > 0 ? Math.max(0, (entradaBolso - entradaVista) / parcelasConstrutoraProposta) : 0)} <span className="text-xs font-semibold text-amber-800">/mês</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Aviso se a soma não bate */}
                {Math.abs(totalCobertura) > 1 && (
                  <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-red-800 text-xs flex gap-2 items-start shrink-0">
                    <Info className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Aviso de diferença:</strong> A somatória das fontes (entrada, subsídios, FGTS, financiamento) {totalCobertura > 0 ? "não atinge" : "excede"} o valor do imóvel em <strong className="font-bold">{fmt(Math.abs(totalCobertura))}</strong>. Ajuste os valores se desejar um fluxo fechado.
                    </div>
                  </div>
                )}
              </div>

            {/* Action trigger footer panel */}
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 shrink-0 justify-end">
              <button
                onClick={copiarWhatsApp}
                className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                Copiar p/ WhatsApp
              </button>
              <button
                onClick={imprimirProposta}
                className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Imprimir ou Salvar PDF
              </button>
            </div>

          </div>
        )}

        {/* Dynamic consultant note */}
        <div className="p-4 bg-slate-50 rounded-2xl text-[10px] font-semibold text-slate-400 text-center uppercase tracking-widest">
          Consultor responsável pela simulação: <strong className="text-slate-600">{currentUser?.displayName || "—"}</strong>
        </div>

      </div>
    </div>
  );
};
