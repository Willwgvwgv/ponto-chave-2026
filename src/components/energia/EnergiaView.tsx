import React, { useState, useMemo } from "react";
import {
  Zap,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  HelpCircle
} from "lucide-react";
import { EnergiaLocacao, PagamentoEnergiaMes, StatusPagamentoEnergia } from "../../types";
import {
  useEnergiaLocacoes,
  useCreateEnergiaMutation,
  useUpdateEnergiaMutation,
  useDeleteEnergiaMutation,
  useImportEnergiaMutation
} from "../../hooks/useQueries";
import { formatPersonName, maskDoc } from "../../lib/utils";
import { toast } from "sonner";
import { EnergiaFormModal } from "./EnergiaFormModal";
import { ScazaIntegracaoModal } from "./ScazaIntegracaoModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { db, collection, getDocs, query, where } from "../../firebase";

// Locação encontrada nas comissões/contratos que ainda não está na energia
interface CandidatoImportacao {
  chave: string;
  imovel: string;
  inquilino: string;
  cpf?: string;
  unidadeConsumidora?: string;
  origem: string;
  codigoContrato?: string;
  telefone?: string;
  observacao?: string;
}

// Lê CSV (vírgula ou ponto e vírgula, com aspas) e devolve linhas como objetos pelo cabeçalho
const lerCsv = (texto: string): Record<string, string>[] => {
  const t = texto.replace(/^\uFEFF/, "");
  const primeira = t.split(/\r?\n/, 1)[0] || "";
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some(v => v.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some(v => v.trim())) linhas.push(linha);
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  const chaves = cab.map(h => h.trim().toLowerCase());
  return resto.map(l => Object.fromEntries(chaves.map((k, i) => [k, (l[i] || "").trim()])));
};

// Número do imóvel que não é número de verdade ("0", "00", "S/N")
const numeroValido = (n: string) => !!n && !/^(0+|s\/?n)$/i.test(n.trim());

const normalizar = (v?: string) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const NOMES_GENERICOS = new Set(["", "locatario", "inquilino", "novoinquilino", "naoinformado"]);

interface EnergiaViewProps {
  isAdmin: boolean;
  user: any;
  profile: any;
  companySettings: any;
}

// Site onde a conta é conferida (CPF + data de nascimento + unidade consumidora)
const SITE_EQUATORIAL = "https://www.equatorialgoias.com.br/";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const somarMeses = (chave: string, n: number) => {
  const [a, m] = chave.split("-").map(Number);
  return chaveMes(new Date(a, m - 1 + n, 1));
};
const rotuloMes = (chave: string) => {
  const [a, m] = chave.split("-").map(Number);
  const nome = MESES[m - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
};
const rotuloMesCurto = (chave: string) => {
  const [a, m] = chave.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
};

const formatDateBR = (val?: string) => {
  if (!val) return "-";
  const [ano, mes, dia] = val.split("-");
  if (!ano || !mes || !dia) return val;
  return `${dia}/${mes}/${ano}`;
};

// Situação do mês: o que foi conferido na Equatorial, ou "a verificar"
type SituacaoMes = StatusPagamentoEnergia | "a_verificar";

const situacaoDoMes = (e: EnergiaLocacao, mes: string): SituacaoMes =>
  e.pagamentos?.[mes]?.status || "a_verificar";

// A conta do mês já venceu e ninguém conferiu ainda?
const venceuSemConferir = (e: EnergiaLocacao, mes: string): boolean => {
  if (situacaoDoMes(e, mes) !== "a_verificar") return false;
  const hoje = new Date();
  const atual = chaveMes(hoje);
  if (mes < atual) return true;
  if (mes > atual) return false;
  return !!e.diaVencimentoConta && hoje.getDate() > e.diaVencimentoConta;
};

const ESTILO_SITUACAO: Record<SituacaoMes, { label: string; classe: string; ponto: string }> = {
  pago: { label: "Pago", classe: "bg-emerald-50 text-emerald-800 border-emerald-200", ponto: "bg-emerald-500" },
  em_aberto: { label: "Em aberto", classe: "bg-amber-50 text-amber-800 border-amber-200", ponto: "bg-amber-400" },
  atrasado: { label: "Atrasado", classe: "bg-rose-50 text-rose-800 border-rose-200", ponto: "bg-rose-500" },
  a_verificar: { label: "A verificar", classe: "bg-zinc-100 text-zinc-700 border-zinc-200", ponto: "bg-zinc-300" }
};

type Filtro = "TODAS" | "pago" | "em_aberto" | "atrasado" | "a_verificar" | "NAO_TRANSFERIDAS";

export const EnergiaView: React.FC<EnergiaViewProps> = ({ isAdmin, profile, companySettings }) => {
  const companyId = profile?.companyId || companySettings?.id || "default_agency";

  const { data: energias = [], isLoading } = useEnergiaLocacoes(companyId);
  const createMutation = useCreateEnergiaMutation();
  const updateMutation = useUpdateEnergiaMutation();
  const deleteMutation = useDeleteEnergiaMutation();
  const importMutation = useImportEnergiaMutation();
  const [buscandoLocacoes, setBuscandoLocacoes] = useState(false);
  const [candidatos, setCandidatos] = useState<CandidatoImportacao[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // Junta as locações dos contratos e das comissões de locação que ainda não estão aqui.
  // Contratos vêm primeiro (trazem CPF e, às vezes, a unidade consumidora).
  const buscarLocacoes = async () => {
    setBuscandoLocacoes(true);
    try {
      const [snapContratos, snapComissoes] = await Promise.all([
        getDocs(query(collection(db, "contratos_locacao"), where("companyId", "==", companyId))).catch(() => null),
        getDocs(query(collection(db, "comissoes"), where("companyId", "==", companyId))).catch(() => null)
      ]);
      const imoveisVistos = new Set(energias.map(e => normalizar(e.imovel)).filter(Boolean));
      const inquilinosVistos = new Set(energias.map(e => normalizar(e.inquilino)).filter(Boolean));
      const lista: CandidatoImportacao[] = [];
      const adicionar = (c: CandidatoImportacao) => {
        const ni = normalizar(c.imovel);
        const nq = normalizar(c.inquilino);
        if (!ni || NOMES_GENERICOS.has(nq)) return;
        if (imoveisVistos.has(ni) || inquilinosVistos.has(nq)) return;
        imoveisVistos.add(ni);
        inquilinosVistos.add(nq);
        lista.push({ ...c, chave: `${ni}|${nq}` });
      };

      const contratos: any[] = [];
      snapContratos?.forEach((d: any) => contratos.push({ id: d.id, ...d.data() }));
      contratos
        .filter(c => c.tipoDocumento !== "venda" && !["cancelado", "finalizado"].includes(c.status))
        .forEach(c => {
          const im = c.imovel || {};
          const loc = (c.locatarios || [])[0] || {};
          const doc = String(loc.cpfCnpj || "").replace(/\D/g, "");
          adicionar({
            chave: "",
            imovel: [im.endereco, im.numero ? `nº ${im.numero}` : "", im.complemento, im.bairro].filter(Boolean).join(", "),
            inquilino: loc.nome || "",
            cpf: doc.length === 11 ? doc : undefined,
            unidadeConsumidora: im.energiaMedidor || undefined,
            origem: "Contrato"
          });
        });

      const comissoes: any[] = [];
      snapComissoes?.forEach((d: any) => comissoes.push({ id: d.id, ...d.data() }));
      comissoes
        .sort((a, b) => String(b.mesReferencia || "").localeCompare(String(a.mesReferencia || "")))
        .forEach(c => adicionar({ chave: "", imovel: c.imovel || "", inquilino: c.inquilino || "", origem: "Comissão de locação" }));

      if (!snapContratos && !snapComissoes) {
        toast.error("Não foi possível ler as locações. Verifique a conexão e tente de novo.");
        return;
      }
      if (lista.length === 0) {
        toast.success("Todas as locações já estão no acompanhamento de energia.");
        return;
      }
      setCandidatos(lista);
      setMarcados(new Set(lista.map(c => c.chave)));
    } finally {
      setBuscandoLocacoes(false);
    }
  };

  // Importação pela planilha de locações exportada do sistema de administração
  const inputCsvRef = React.useRef<HTMLInputElement>(null);
  const importarPlanilha = async (arquivo: File) => {
    try {
      const linhas = lerCsv(await arquivo.text());
      if (linhas.length === 0 || !("inquilino_nome" in linhas[0])) {
        toast.error("Planilha não reconhecida. Use a exportação de Locações (com a coluna inquilino_nome).");
        return;
      }
      const codigosVistos = new Set(energias.map(e => e.codigoContrato).filter(Boolean) as string[]);
      const paresVistos = new Set(energias.map(e => `${normalizar(e.imovel)}|${normalizar(e.inquilino)}`));
      const lista: CandidatoImportacao[] = [];
      let ignoradas = 0;
      linhas.forEach(l => {
        if (l.status && !/^ativ/i.test(l.status)) { ignoradas++; return; }
        const inquilino = l.inquilino_nome || "";
        if (NOMES_GENERICOS.has(normalizar(inquilino))) return;
        const partes = [
          `${l.endereco_imovel || ""}${numeroValido(l.numero_imovel || "") ? `, nº ${l.numero_imovel}` : ""}`,
          numeroValido(l.complemento_imovel || "") ? l.complemento_imovel : "",
          l.bairro_imovel,
          l.cidade_imovel
        ].map(p => (p || "").trim()).filter(Boolean);
        const imovel = partes.join(", ") || l.nome_imovel || "";
        const codigo = l.codigo || l.id || "";
        const par = `${normalizar(imovel)}|${normalizar(inquilino)}`;
        if ((codigo && codigosVistos.has(codigo)) || paresVistos.has(par)) return;
        if (codigo) codigosVistos.add(codigo);
        paresVistos.add(par);
        const doc = (l.cpf_cnpj_inquilino || "").replace(/\D/g, "");
        lista.push({
          chave: `csv-${codigo || par}`,
          imovel,
          inquilino,
          cpf: doc.length === 11 || doc.length === 14 ? doc : undefined,
          origem: `Planilha · contrato ${codigo}`,
          codigoContrato: codigo || undefined,
          telefone: (l.celular_inquilino || "").replace(/\D/g, "") || undefined,
          observacao: [l.nome_imovel ? `Imóvel: ${l.nome_imovel}` : "", l.tipo ? `Tipo: ${l.tipo}` : "", l.data_inicio_contrato ? `Início: ${l.data_inicio_contrato}` : ""].filter(Boolean).join(" · ")
        });
      });
      if (lista.length === 0) {
        toast.success(ignoradas ? `Nada novo para importar (${ignoradas} locação(ões) não ativa(s) ignorada(s)).` : "Todas as locações da planilha já estão aqui.");
        return;
      }
      setCandidatos(lista);
      setMarcados(new Set(lista.map(c => c.chave)));
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível ler a planilha.");
    } finally {
      if (inputCsvRef.current) inputCsvRef.current.value = "";
    }
  };

  const importarMarcadas = () => {
    if (!candidatos || !profile?.uid) return;
    const registros = candidatos
      .filter(c => marcados.has(c.chave))
      .map(c => ({
        companyId,
        imovel: c.imovel,
        inquilino: c.inquilino,
        unidadeConsumidora: c.unidadeConsumidora || "",
        cpf: c.cpf,
        codigoContrato: c.codigoContrato,
        telefone: c.telefone,
        status: "transferida" as const,
        observacoes: [`Importado de: ${c.origem}`, c.observacao].filter(Boolean).join(" · "),
        criadoPor: profile.uid,
        criadoPorNome: profile.displayName || "Usuário"
      }));
    if (registros.length === 0) return;
    importMutation.mutate({ registros, companyId }, { onSuccess: () => setCandidatos(null) });
  };

  const [mes, setMes] = useState(() => chaveMes(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnergia, setEditingEnergia] = useState<EnergiaLocacao | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [scazaAberto, setScazaAberto] = useState(false);

  const mesAtual = chaveMes(new Date());
  const transferidas = useMemo(() => energias.filter(e => e.status === "transferida"), [energias]);
  const naoTransferidas = useMemo(() => energias.filter(e => e.status !== "transferida"), [energias]);

  const contagem = useMemo(() => {
    const c = { pago: 0, em_aberto: 0, atrasado: 0, a_verificar: 0 };
    transferidas.forEach(e => { c[situacaoDoMes(e, mes)]++; });
    return c;
  }, [transferidas, mes]);

  const lista = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    const base = filtro === "NAO_TRANSFERIDAS" ? naoTransferidas : transferidas;
    return base
      .filter(e => {
        if (termo && ![e.imovel, e.inquilino, e.unidadeConsumidora, e.cpf].some(v => (v || "").toLowerCase().includes(termo))) return false;
        if (filtro === "TODAS" || filtro === "NAO_TRANSFERIDAS") return true;
        return situacaoDoMes(e, mes) === filtro;
      })
      .sort((a, b) => (a.inquilino || "").localeCompare(b.inquilino || "", "pt-BR"));
  }, [transferidas, naoTransferidas, searchTerm, filtro, mes]);

  const registrar = (e: EnergiaLocacao, status: StatusPagamentoEnergia | null) => {
    const pagamentos: Record<string, PagamentoEnergiaMes> = { ...(e.pagamentos || {}) };
    if (status) {
      pagamentos[mes] = {
        status,
        verificadoEm: new Date().toISOString(),
        verificadoPorNome: profile?.displayName || "Usuário"
      };
    } else {
      delete pagamentos[mes];
    }
    setSalvandoId(e.id);
    updateMutation.mutate({ ...e, pagamentos }, { onSettled: () => setSalvandoId(null) });
  };

  const copiar = async (texto: string, rotulo: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${rotulo} copiado.`);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
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
  const ultimosMeses = [5, 4, 3, 2, 1, 0].map(n => somarMeses(mes, -n));

  const Card = ({ id, label, valor, icone, cor }: { id: Filtro; label: string; valor: number; icone: React.ReactNode; cor: string }) => (
    <button
      type="button"
      onClick={() => setFiltro(filtro === id ? "TODAS" : id)}
      aria-pressed={filtro === id}
      className={`text-left bg-white border rounded-xl p-4 transition-colors ${filtro === id ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-300"}`}
    >
      <div className="flex items-center justify-between text-sm text-zinc-700">
        <span>{label}</span>
        <span className={cor}>{icone}</span>
      </div>
      <p className={`text-2xl font-semibold mt-2 tabular-nums ${cor}`}>{valor}</p>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" /> Energia das locações
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Conferência mensal do pagamento da conta de energia nas locações transferidas para o inquilino.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={SITE_EQUATORIAL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Abrir Equatorial
          </a>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setScazaAberto(true)}
              className="h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Integração Scaza
            </button>
          )}
          {/* Importação pelos contratos/comissões desativada: a planilha é a fonte completa
              e importar pelos dois caminhos duplicaria locações (endereços escritos diferente). */}
          {false && isAdmin && (
            <button type="button" onClick={buscarLocacoes} disabled={buscandoLocacoes}>Importar locações</button>
          )}
          {isAdmin && (
            <>
              <input
                ref={inputCsvRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={ev => { const f = ev.target.files?.[0]; if (f) importarPlanilha(f); }}
              />
              <button
                type="button"
                onClick={() => inputCsvRef.current?.click()}
                className="h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Importar planilha de locações
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setEditingEnergia(null); setIsFormOpen(true); }}
            className="h-10 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova locação
          </button>
        </div>
      </div>

      {/* Mês */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior" className="w-10 h-10 rounded-lg border border-zinc-300 bg-white flex items-center justify-center hover:bg-zinc-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="h-10 px-4 rounded-lg border border-zinc-300 bg-white flex items-center text-sm font-semibold text-zinc-900 min-w-[200px] justify-center">
          {rotuloMes(mes)}
        </div>
        <button type="button" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês" className="w-10 h-10 rounded-lg border border-zinc-300 bg-white flex items-center justify-center hover:bg-zinc-50">
          <ChevronRight className="w-4 h-4" />
        </button>
        {mes !== mesAtual && (
          <button type="button" onClick={() => setMes(mesAtual)} className="h-10 px-3 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50">
            Voltar para o mês atual
          </button>
        )}
      </div>

      {/* Indicadores do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card id="pago" label="Pagas" valor={contagem.pago} icone={<CheckCircle2 className="w-4 h-4" />} cor="text-emerald-700" />
        <Card id="em_aberto" label="Em aberto" valor={contagem.em_aberto} icone={<Clock className="w-4 h-4" />} cor="text-amber-700" />
        <Card id="atrasado" label="Atrasadas" valor={contagem.atrasado} icone={<AlertTriangle className="w-4 h-4" />} cor="text-rose-700" />
        <Card id="a_verificar" label="A verificar" valor={contagem.a_verificar} icone={<HelpCircle className="w-4 h-4" />} cor="text-zinc-700" />
      </div>

      {/* Busca e filtro */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por inquilino, imóvel, unidade consumidora ou CPF"
            aria-label="Buscar"
            className="w-full h-10 pl-9 pr-3 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setFiltro("TODAS")}
            className={`h-8 px-3 rounded-full text-[13px] font-medium border ${filtro === "TODAS" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"}`}>
            Transferidas <span className="opacity-70 tabular-nums">{transferidas.length}</span>
          </button>
          <button type="button" onClick={() => setFiltro("NAO_TRANSFERIDAS")}
            className={`h-8 px-3 rounded-full text-[13px] font-medium border ${filtro === "NAO_TRANSFERIDAS" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"}`}>
            Ainda não transferidas <span className="opacity-70 tabular-nums">{naoTransferidas.length}</span>
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-600">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="p-6 text-sm text-zinc-600">
            {energias.length === 0 ? "Nenhuma locação cadastrada. Use \"Nova locação\" para começar." : "Nenhuma locação com esse filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {lista.map(e => {
              const situacao = situacaoDoMes(e, mes);
              const registro = e.pagamentos?.[mes];
              const atrasoSemConferir = venceuSemConferir(e, mes);
              const dadosEquatorial = [
                e.unidadeConsumidora ? `UC: ${e.unidadeConsumidora}` : "",
                e.cpf ? `CPF: ${maskDoc(e.cpf)}` : "",
                e.dataNascimento ? `Nascimento: ${formatDateBR(e.dataNascimento)}` : ""
              ].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className="p-4 flex flex-col xl:flex-row xl:items-center gap-4">
                  {/* Quem e onde */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900">{e.inquilino ? formatPersonName(e.inquilino) : "Locatário não informado"}</p>
                    <p className="text-sm text-zinc-600 truncate">{e.imovel}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                      {e.unidadeConsumidora && (
                        <button type="button" onClick={() => copiar(e.unidadeConsumidora, "Unidade consumidora")} className="inline-flex items-center gap-1 hover:text-zinc-900" title="Copiar unidade consumidora">
                          UC <span className="font-mono text-zinc-900">{e.unidadeConsumidora}</span> <Copy className="w-3 h-3" />
                        </button>
                      )}
                      {e.cpf && (
                        <button type="button" onClick={() => copiar(e.cpf!, "CPF")} className="inline-flex items-center gap-1 hover:text-zinc-900" title="Copiar CPF">
                          CPF <span className="font-mono text-zinc-900">{maskDoc(e.cpf)}</span> <Copy className="w-3 h-3" />
                        </button>
                      )}
                      {e.dataNascimento && (
                        <button type="button" onClick={() => copiar(formatDateBR(e.dataNascimento), "Data de nascimento")} className="inline-flex items-center gap-1 hover:text-zinc-900" title="Copiar data de nascimento">
                          Nasc. <span className="font-mono text-zinc-900">{formatDateBR(e.dataNascimento)}</span> <Copy className="w-3 h-3" />
                        </button>
                      )}
                      {dadosEquatorial && (
                        <button type="button" onClick={() => copiar(dadosEquatorial, "Dados para a Equatorial")} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                          Copiar tudo
                        </button>
                      )}
                      {e.telefone && (
                        <a href={`https://wa.me/${e.telefone.startsWith("55") ? e.telefone : "55" + e.telefone}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                          WhatsApp
                        </a>
                      )}
                      {e.diaVencimentoConta && <span>Conta vence dia {e.diaVencimentoConta}</span>}
                    </div>
                    {e.status !== "transferida" && (
                      <p className="mt-1 text-xs text-amber-800">
                        Transferência {e.status === "em_processo" ? "em processo" : "pendente"}
                        {e.dataVencimento ? ` · prazo ${formatDateBR(e.dataVencimento)}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Histórico dos últimos 6 meses */}
                  {e.status === "transferida" && (
                    <div className="flex items-end gap-1.5" aria-label="Últimos 6 meses">
                      {ultimosMeses.map(m => {
                        const s = situacaoDoMes(e, m);
                        return (
                          <div key={m} className="flex flex-col items-center gap-1" title={`${rotuloMes(m)}: ${ESTILO_SITUACAO[s].label}`}>
                            <span className={`w-3 h-3 rounded-full ${ESTILO_SITUACAO[s].ponto} ${m === mes ? "ring-2 ring-offset-1 ring-zinc-900" : ""}`} />
                            <span className="text-[10px] text-zinc-500">{rotuloMesCurto(m)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Situação do mês */}
                  {e.status === "transferida" && (
                    <div className="xl:w-[340px] flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-7 px-2.5 rounded-full border text-xs font-medium inline-flex items-center ${ESTILO_SITUACAO[situacao].classe}`}>
                          {ESTILO_SITUACAO[situacao].label}
                        </span>
                        {atrasoSemConferir && (
                          <span className="text-xs text-rose-700">Conta já venceu — conferir</span>
                        )}
                        {registro && (
                          <span className="text-xs text-zinc-500 truncate">
                            conferido em {new Date(registro.verificadoEm).toLocaleDateString("pt-BR")} por {registro.verificadoPorNome}
                          </span>
                        )}
                      </div>
                      {e.scaza && (
                        <p className="text-xs text-zinc-600">
                          <span className="font-medium text-zinc-800">Scaza:</span>{" "}
                          {e.scaza.faturasEmAberto.length === 0
                            ? "nenhuma fatura em aberto"
                            : e.scaza.faturasEmAberto
                                .map(f => `${formatDateBR(f.vencimento)}${f.valor != null ? " " + f.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""}${f.vencida ? " (vencida)" : ""}`)
                                .join(" · ")}
                          {" · "}atualizado {new Date(e.scaza.ultimaAtualizacao).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      {isAdmin && (
                        <div className="flex flex-wrap gap-1.5">
                          {(["pago", "em_aberto", "atrasado"] as StatusPagamentoEnergia[]).map(s => (
                            <button
                              key={s}
                              type="button"
                              disabled={salvandoId === e.id}
                              onClick={() => registrar(e, situacao === s ? null : s)}
                              aria-pressed={situacao === s}
                              className={`h-8 px-3 rounded-lg border text-[13px] font-medium transition-colors disabled:opacity-50 ${
                                situacao === s ? ESTILO_SITUACAO[s].classe : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
                              }`}
                            >
                              {ESTILO_SITUACAO[s].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ações */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 xl:self-center">
                      <button type="button" onClick={() => { setEditingEnergia(e); setIsFormOpen(true); }} title="Editar" aria-label={`Editar ${e.imovel}`}
                        className="w-9 h-9 rounded-lg text-zinc-600 hover:bg-zinc-100 flex items-center justify-center">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setDeleteTargetId(e.id)} title="Excluir" aria-label={`Excluir ${e.imovel}`}
                        className="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {scazaAberto && <ScazaIntegracaoModal companyId={companyId} onClose={() => setScazaAberto(false)} />}

      {isFormOpen && (
        <EnergiaFormModal
          initial={editingEnergia}
          onSave={handleSave}
          onClose={() => { setIsFormOpen(false); setEditingEnergia(null); }}
        />
      )}

      {candidatos && (
        <div className="fixed inset-0 z-[9999] bg-zinc-900/40 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-importar" className="bg-white w-full max-w-2xl rounded-xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-zinc-200">
              <h2 id="titulo-importar" className="text-lg font-semibold text-zinc-900">Importar locações</h2>
              <p className="text-sm text-zinc-600">
                {candidatos.length} locação(ões) ainda não estão aqui. Entram como "Transferida"; dia de vencimento e unidade consumidora você completa depois.
              </p>
            </div>
            <div className="px-5 py-2 border-b border-zinc-100 flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-zinc-800">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={marcados.size === candidatos.length}
                  onChange={ev => setMarcados(ev.target.checked ? new Set(candidatos.map(c => c.chave)) : new Set())}
                />
                Marcar todas
              </label>
              <span className="text-zinc-600 tabular-nums">{marcados.size} marcada(s)</span>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {candidatos.map(c => (
                <li key={c.chave}>
                  <label className="flex items-start gap-3 px-5 py-2.5 cursor-pointer hover:bg-zinc-50">
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5"
                      checked={marcados.has(c.chave)}
                      onChange={ev => setMarcados(prev => {
                        const n = new Set(prev);
                        ev.target.checked ? n.add(c.chave) : n.delete(c.chave);
                        return n;
                      })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900">{formatPersonName(c.inquilino)}</span>
                      <span className="block text-xs text-zinc-600 truncate">{c.imovel} · {c.origem}{c.cpf ? (c.cpf.length === 14 ? " · com CNPJ" : " · com CPF") : ""}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="px-5 py-4 border-t border-zinc-200 flex justify-end gap-2">
              <button type="button" onClick={() => setCandidatos(null)} className="h-10 px-4 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100">Cancelar</button>
              <button
                type="button"
                onClick={importarMarcadas}
                disabled={marcados.size === 0 || importMutation.isPending}
                className="h-10 px-5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {importMutation.isPending ? "Importando…" : `Importar ${marcados.size} locação(ões)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Excluir locação do acompanhamento?"
        message={`Excluir "${deleteTarget?.imovel || "este imóvel"}" e todo o histórico de conferência da energia? Essa ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Manter"
        confirmColor="red"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
