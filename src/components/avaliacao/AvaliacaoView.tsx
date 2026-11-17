import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, MapPin, Plus, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, RefreshCw, FileDown, Trash2,
  ExternalLink, Copy, Home, Building2, TrendingUp, Landmark, Newspaper, ListChecks, Ban,
} from "lucide-react";
import { auth, db, collection, doc, getDocs, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from "../../firebase";
import { cn } from "../../lib/utils";
import { ConfirmModal } from "../ui/ConfirmModal";
import {
  TIPOS_IMOVEL, aluguelSeAplica, calcularInvestimento, brl, num, pct, descricaoCurta, limparParaFirestore,
  type ImovelAvaliado, type ParametrosInvestimento, type TipoImovel,
} from "./calculos";
import { gerarPdfAvaliacao } from "./gerarPdfAvaliacao";

interface Props {
  isAdmin: boolean;
  user: any;
  profile: any;
  companySettings: any;
}

type Frente = "localizacao" | "comparaveis" | "aluguel" | "mercado" | "bairro" | "sintese";
type Status = "aguardando" | "rodando" | "ok" | "erro" | "nao_se_aplica";

const ROTULO_FRENTE: Record<Frente, string> = {
  localizacao: "Localização e entorno (mapa)",
  comparaveis: "Comparáveis de venda",
  aluguel: "Aluguel na região",
  mercado: "Mercado, ITBI e FipeZap",
  bairro: "Notícias do bairro",
  sintese: "Notas, resumo e anúncio",
};

const COLECAO = "avaliacoes_imoveis";

const imovelVazio = (): ImovelAvaliado => ({
  tipo: "casa", endereco: "", bairro: "", cidade: "", uf: "GO",
  areaConstruida: null, areaTerreno: null, areaHa: null, quartos: null, suites: null, vagas: null,
  padrao: "", conservacao: "", idade: null, precoPedido: null, linkAnuncio: "", observacoes: "",
});

const paramsPadrao = (): ParametrosInvestimento => ({
  precoBase: null, itbiPct: 2, itbiOrigem: "padrao", cartorioPct: 1.5, entradaPct: 20, taxaAnualPct: 12,
  prazoMeses: 360, admPct: 10, vacanciaMeses: 1,
});

async function chamarApi(caminho: string, corpo: any) {
  const u = (auth as any).currentUser;
  if (!u) throw new Error("Faça login novamente.");
  const token = await u.getIdToken();
  const r = await fetch(caminho, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 504) throw new Error("A pesquisa demorou demais e foi interrompida. Tente esta parte de novo.");
    throw new Error(j?.error || `Erro ${r.status}`);
  }
  return j;
}

function valorizacaoDe(res: any): { pct: number | null; origem: string } {
  const f = res?.mercado?.fipezap;
  if (f?.venda12m != null) return { pct: f.venda12m, origem: `FipeZap ${f.local} 12 meses` };
  const ipca = res?.localizacao?.indicadores?.ipca12m?.valor;
  if (ipca != null) return { pct: ipca, origem: "IPCA 12 meses (conservador, sem dado local)" };
  return { pct: null, origem: "" };
}

function paramsDosResultados(base: ParametrosInvestimento, im: ImovelAvaliado, res: any): ParametrosInvestimento {
  const p = { ...base };
  if (p.precoBase == null) p.precoBase = im.precoPedido ?? res?.comparaveis?.valor?.provavel ?? null;
  if (p.itbiOrigem !== "manual" && res?.mercado?.itbi?.aliquotaPct != null) {
    p.itbiPct = res.mercado.itbi.aliquotaPct;
    p.itbiOrigem = "pesquisa";
  }
  return p;
}

function investimentoDe(p: ParametrosInvestimento, res: any) {
  const v = valorizacaoDe(res);
  return calcularInvestimento(
    p,
    res?.aluguel?.estimativa?.provavel ?? null,
    res?.localizacao?.indicadores?.selic?.valor ?? null,
    v.pct,
    v.origem
  );
}

// ---------------- componentes pequenos ----------------
const Campo: React.FC<{ rotulo: string; children: React.ReactNode; dica?: string; className?: string }> = ({ rotulo, children, dica, className }) => (
  <label className={cn("block", className)}>
    <span className="text-xs font-semibold text-slate-600">{rotulo}</span>
    <div className="mt-1">{children}</div>
    {dica && <span className="text-[11px] text-slate-400">{dica}</span>}
  </label>
);
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

const NumInput: React.FC<{ value: number | null; onChange: (v: number | null) => void; placeholder?: string; step?: string }> = ({ value, onChange, placeholder, step }) => (
  <input
    type="number"
    inputMode="decimal"
    step={step || "any"}
    className={inputCls}
    value={value ?? ""}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
  />
);

const Card: React.FC<{ titulo: string; icone?: React.ReactNode; children: React.ReactNode; acao?: React.ReactNode }> = ({ titulo, icone, children, acao }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">{icone}{titulo}</h3>
      {acao}
    </div>
    {children}
  </div>
);

const Limitacao: React.FC<{ texto?: string }> = ({ texto }) =>
  texto ? (
    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
      {texto}
    </p>
  ) : null;

const Link: React.FC<{ url: string; children?: React.ReactNode }> = ({ url, children }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
    {children || "abrir"} <ExternalLink className="h-3 w-3" />
  </a>
);

const ListaNoticias: React.FC<{ titulo: string; itens?: any[] }> = ({ titulo, itens }) => (
  <div className="mt-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
    {itens && itens.length > 0 ? (
      <ul className="mt-1 space-y-2">
        {itens.map((n, i) => (
          <li key={i} className="text-sm text-slate-700">
            <span className="font-medium">{n.titulo}</span>
            {n.data && <span className="text-slate-400"> · {n.data}</span>}
            {n.resumo && <span className="block text-xs text-slate-500">{n.resumo}</span>}
            <Link url={n.url}>fonte</Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-1 text-xs text-slate-400">Nada encontrado com fonte.</p>
    )}
  </div>
);

// ---------------- tela principal ----------------
export const AvaliacaoView: React.FC<Props> = ({ isAdmin, user, profile, companySettings }) => {
  const companyId = profile?.companyId || companySettings?.id || "default_agency";
  const [modo, setModo] = useState<"lista" | "form" | "resultado">("lista");
  const [lista, setLista] = useState<any[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [imovel, setImovel] = useState<ImovelAvaliado>(imovelVazio());
  const [docId, setDocId] = useState<string | null>(null);
  const [resultados, setResultados] = useState<any>({});
  const [status, setStatus] = useState<Partial<Record<Frente, Status>>>({});
  const [erros, setErros] = useState<Partial<Record<Frente, string>>>({});
  const [params, setParams] = useState<ParametrosInvestimento>(paramsPadrao());
  const [aba, setAba] = useState<"resumo" | "comparaveis" | "aluguel" | "investimento" | "entorno" | "mercado" | "anuncio">("resumo");
  const [excluir, setExcluir] = useState<any | null>(null);
  // Corretor e CRECI do PDF: lembrados neste navegador; aproveita o que já foi
  // digitado no Termo de Intermediação, e por último o nome do usuário.
  const salvoTermo = (() => {
    try { return JSON.parse(localStorage.getItem("pc_termo_corretor") || "{}"); } catch { return {}; }
  })();
  const [creci, setCreci] = useState<string>(() => {
    try { return localStorage.getItem("avaliacao_creci") || salvoTermo.corretorCreci || ""; } catch { return ""; }
  });
  const [corretorNome, setCorretorNome] = useState<string>(() => {
    try {
      return localStorage.getItem("avaliacao_corretor") || salvoTermo.corretorNome || profile?.displayName || profile?.name || user?.displayName || "";
    } catch { return ""; }
  });

  const set = <K extends keyof ImovelAvaliado>(k: K, v: ImovelAvaliado[K]) => setImovel((p) => ({ ...p, [k]: v }));

  const carregarLista = async () => {
    setCarregandoLista(true);
    try {
      const snap = await getDocs(query(collection(db, COLECAO), where("companyId", "==", companyId)));
      const itens = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      itens.sort((a: any, b: any) => (b.criadoEmMs || 0) - (a.criadoEmMs || 0));
      setLista(itens);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível carregar as avaliações salvas.");
    } finally {
      setCarregandoLista(false);
    }
  };

  useEffect(() => {
    carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const salvar = async (id: string | null, res: any, st: any, p: ParametrosInvestimento, im: ImovelAvaliado) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, COLECAO, id), limparParaFirestore({ imovel: im, resultados: res, status: st, params: p, atualizadoEm: serverTimestamp() }) as any);
    } catch (e) {
      console.error("[avaliacao] salvar", e);
      toast.error("A avaliação rodou, mas não foi possível salvar no histórico.");
    }
  };

  const corpoImovel = (im: ImovelAvaliado) => ({ ...im });

  const rodarFrente = async (f: Frente, im: ImovelAvaliado, acc: any, pBase: ParametrosInvestimento): Promise<any> => {
    setStatus((s) => ({ ...s, [f]: "rodando" }));
    setErros((e) => ({ ...e, [f]: undefined }));
    try {
      let dados: any;
      if (f === "localizacao") {
        dados = await chamarApi("/api/avaliacao/localizar", { endereco: im.endereco, bairro: im.bairro, cidade: im.cidade, uf: im.uf });
      } else if (f === "sintese") {
        const p = paramsDosResultados(pBase, im, acc);
        const j = await chamarApi("/api/avaliacao/pesquisar", { frente: "sintese", imovel: corpoImovel(im), resultados: { ...acc, investimento: investimentoDe(p, acc) } });
        dados = j.dados;
      } else {
        const j = await chamarApi("/api/avaliacao/pesquisar", { frente: f, imovel: corpoImovel(im) });
        dados = j.dados;
      }
      acc[f] = dados;
      setResultados((r: any) => ({ ...r, [f]: dados }));
      setStatus((s) => ({ ...s, [f]: "ok" }));
      return dados;
    } catch (e: any) {
      setStatus((s) => ({ ...s, [f]: "erro" }));
      setErros((x) => ({ ...x, [f]: e?.message || "Erro" }));
      return null;
    }
  };

  const iniciar = async () => {
    const im = imovel;
    if (!im.cidade.trim()) return toast.error("Informe a cidade.");
    if (!im.endereco.trim() && !im.bairro.trim()) return toast.error("Informe o endereço ou ao menos o bairro.");
    const temArea = im.tipo === "rural" ? im.areaHa : im.tipo === "lote" || im.tipo === "lote_condominio" ? im.areaTerreno : im.areaConstruida || im.areaTerreno;
    if (!temArea) toast.warning("Sem a área do imóvel o sistema mostra o preço por m² da região, mas não calcula o valor.");

    const statusInicial: Partial<Record<Frente, Status>> = {
      localizacao: "aguardando", comparaveis: "aguardando", mercado: "aguardando", bairro: "aguardando",
      aluguel: aluguelSeAplica(im.tipo) ? "aguardando" : "nao_se_aplica", sintese: "aguardando",
    };
    setStatus(statusInicial);
    setErros({});
    setResultados({});
    const p0 = paramsPadrao();
    setParams(p0);
    setAba("resumo");
    setModo("resultado");

    let id: string | null = null;
    try {
      const ref = await addDoc(collection(db, COLECAO), limparParaFirestore({
        companyId,
        criadoPor: user?.uid,
        criadoPorNome: profile?.displayName || user?.displayName || user?.email || "",
        criadoEm: serverTimestamp(),
        criadoEmMs: Date.now(),
        imovel: im,
        resultados: {},
        status: statusInicial,
        params: p0,
      }) as any);
      id = ref.id;
      setDocId(id);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível criar o registro no histórico. A avaliação vai rodar mesmo assim.");
    }

    const acc: any = {};
    const frentes: Frente[] = ["localizacao", "comparaveis", "mercado", "bairro"];
    if (aluguelSeAplica(im.tipo)) frentes.push("aluguel");
    await Promise.all(frentes.map((f) => rodarFrente(f, im, acc, p0)));
    await rodarFrente("sintese", im, acc, p0);

    const pFinal = paramsDosResultados(p0, im, acc);
    setParams(pFinal);
    const stFinal: any = {};
    (Object.keys(statusInicial) as Frente[]).forEach((f) => (stFinal[f] = statusInicial[f] === "nao_se_aplica" ? "nao_se_aplica" : acc[f] ? "ok" : "erro"));
    await salvar(id, acc, stFinal, pFinal, im);
    carregarLista();
    toast.success("Avaliação concluída.");
  };

  const refazer = async (f: Frente) => {
    const acc = { ...resultados };
    await rodarFrente(f, imovel, acc, params);
    const pFinal = paramsDosResultados(params, imovel, acc);
    setParams(pFinal);
    const st: any = { ...status };
    if (acc[f]) st[f] = "ok";
    await salvar(docId, acc, st, pFinal, imovel);
  };

  const abrir = (av: any) => {
    setImovel({ ...imovelVazio(), ...av.imovel });
    setResultados(av.resultados || {});
    setStatus(av.status || {});
    setErros({});
    setParams({ ...paramsPadrao(), ...(av.params || {}) });
    setDocId(av.id);
    setAba("resumo");
    setModo("resultado");
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await deleteDoc(doc(db, COLECAO, excluir.id));
      setLista((l) => l.filter((x) => x.id !== excluir.id));
      toast.success("Avaliação excluída.");
    } catch {
      toast.error("Sem permissão para excluir esta avaliação.");
    }
    setExcluir(null);
  };

  const investimento = useMemo(() => investimentoDe(params, resultados), [params, resultados]);
  const rodando = Object.values(status).some((s) => s === "rodando" || s === "aguardando");

  const baixarPdf = () => {
    if (!corretorNome.trim()) {
      toast.error("Informe o nome do corretor para sair no PDF.");
      return;
    }
    try {
      localStorage.setItem("avaliacao_creci", creci.trim());
      localStorage.setItem("avaliacao_corretor", corretorNome.trim());
    } catch {}
    try {
      gerarPdfAvaliacao({
        imovel,
        resultados,
        investimento,
        empresa: companySettings,
        corretor: { nome: corretorNome, creci },
        data: new Date(),
      });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar o PDF.");
    }
  };

  const copiar = (s: string) => {
    navigator.clipboard?.writeText(s).then(() => toast.success("Copiado."), () => toast.error("Não foi possível copiar."));
  };

  // ================= LISTA =================
  if (modo === "lista") {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Avaliação de Imóvel</h1>
            <p className="text-sm text-slate-500">Estudo de preço com anúncios reais, mapa do entorno e indicadores oficiais.</p>
          </div>
          <button
            onClick={() => { setImovel(imovelVazio()); setModo("form"); }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Nova avaliação
          </button>
        </div>

        {carregandoLista ? (
          <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">Nenhuma avaliação feita ainda.</p>
            <p className="text-xs text-slate-400">Informe o endereço e os dados do imóvel; o sistema busca comparáveis e monta o estudo.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lista.map((av) => {
              const r = av.resultados || {};
              return (
                <div key={av.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <button onClick={() => abrir(av)} className="w-full text-left">
                    <p className="text-sm font-semibold text-slate-800">{descricaoCurta({ ...imovelVazio(), ...av.imovel })}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {av.criadoEmMs ? new Date(av.criadoEmMs).toLocaleDateString("pt-BR") : ""} · {av.criadoPorNome}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                      {r.sintese?.notaFinal != null && <span className="rounded bg-blue-50 px-2 py-0.5 font-bold text-blue-700">Nota {r.sintese.notaFinal}</span>}
                      {r.comparaveis?.valor && <span>Valor provável {brl(r.comparaveis.valor.provavel)}</span>}
                    </div>
                  </button>
                  {(isAdmin || av.criadoPor === user?.uid) && (
                    <button onClick={() => setExcluir(av)} className="mt-2 inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" /> excluir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <ConfirmModal
          isOpen={!!excluir}
          title="Excluir avaliação"
          message="Esta avaliação será removida do histórico."
          confirmText="Excluir"
          onConfirm={confirmarExclusao}
          onCancel={() => setExcluir(null)}
        />
      </div>
    );
  }

  // ================= FORMULÁRIO =================
  if (modo === "form") {
    const t = imovel.tipo;
    const construido = t === "casa" || t === "apartamento" || t === "comercial";
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <button onClick={() => setModo("lista")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold text-slate-900">Nova avaliação</h1>

        <Card titulo="Imóvel" icone={<Home className="h-4 w-4 text-blue-600" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Tipo" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {TIPOS_IMOVEL.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => set("tipo", x.id as TipoImovel)}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium", t === x.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                  >
                    {x.rotulo}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo rotulo="Endereço (rua, número, quadra/lote)" className="sm:col-span-2">
              <input className={inputCls} value={imovel.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua 10, Qd 5 Lt 12" />
            </Campo>
            <Campo rotulo="Bairro / loteamento / setor">
              <input className={inputCls} value={imovel.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </Campo>
            <div className="grid grid-cols-[1fr_70px] gap-2">
              <Campo rotulo="Cidade">
                <input className={inputCls} value={imovel.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Bela Vista de Goiás" />
              </Campo>
              <Campo rotulo="UF">
                <input className={inputCls} maxLength={2} value={imovel.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
              </Campo>
            </div>
          </div>
        </Card>

        <Card titulo="Características" icone={<Building2 className="h-4 w-4 text-blue-600" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            {construido && (
              <Campo rotulo={t === "apartamento" ? "Área útil (m²)" : "Área construída (m²)"}>
                <NumInput value={imovel.areaConstruida} onChange={(v) => set("areaConstruida", v)} />
              </Campo>
            )}
            {t !== "rural" && t !== "apartamento" && (
              <Campo rotulo="Área do terreno (m²)">
                <NumInput value={imovel.areaTerreno} onChange={(v) => set("areaTerreno", v)} />
              </Campo>
            )}
            {t === "rural" && (
              <Campo rotulo="Área total (hectares)" dica="1 alqueire goiano = 4,84 ha">
                <NumInput value={imovel.areaHa} onChange={(v) => set("areaHa", v)} />
              </Campo>
            )}
            {construido && (
              <>
                <Campo rotulo="Quartos"><NumInput value={imovel.quartos} onChange={(v) => set("quartos", v)} step="1" /></Campo>
                <Campo rotulo="Suítes"><NumInput value={imovel.suites} onChange={(v) => set("suites", v)} step="1" /></Campo>
                <Campo rotulo="Vagas"><NumInput value={imovel.vagas} onChange={(v) => set("vagas", v)} step="1" /></Campo>
                <Campo rotulo="Idade aproximada (anos)"><NumInput value={imovel.idade} onChange={(v) => set("idade", v)} step="1" /></Campo>
                <Campo rotulo="Padrão">
                  <select className={inputCls} value={imovel.padrao} onChange={(e) => set("padrao", e.target.value)}>
                    <option value="">-</option><option>econômico</option><option>médio</option><option>alto</option>
                  </select>
                </Campo>
                <Campo rotulo="Conservação">
                  <select className={inputCls} value={imovel.conservacao} onChange={(e) => set("conservacao", e.target.value)}>
                    <option value="">-</option><option>precisa de reforma</option><option>regular</option><option>bom</option><option>novo/reformado</option>
                  </select>
                </Campo>
              </>
            )}
            <Campo rotulo="Preço pedido pelo proprietário (R$)">
              <NumInput value={imovel.precoPedido} onChange={(v) => set("precoPedido", v)} />
            </Campo>
            <Campo rotulo="Link do anúncio deste imóvel (opcional)" className="sm:col-span-2">
              <input className={inputCls} value={imovel.linkAnuncio} onChange={(e) => set("linkAnuncio", e.target.value)} placeholder="https://" />
            </Campo>
            <Campo rotulo="Observações (diferenciais, documentação, infraestrutura)" className="sm:col-span-3">
              <textarea className={cn(inputCls, "min-h-[80px]")} value={imovel.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Ex.: esquina, escriturado, rua asfaltada, poço artesiano" />
            </Campo>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Leva de 1 a 3 minutos. As pesquisas rodam ao mesmo tempo.</p>
          <button onClick={iniciar} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <Search className="h-4 w-4" /> Avaliar
          </button>
        </div>
      </div>
    );
  }

  // ================= RESULTADO =================
  const comp = resultados.comparaveis;
  const alug = resultados.aluguel;
  const merc = resultados.mercado;
  const bairro = resultados.bairro;
  const loc = resultados.localizacao;
  const sint = resultados.sintese;
  const u = comp?.unidade === "ha" ? "ha" : "m²";

  const ABAS: { id: typeof aba; rot: string }[] = [
    { id: "resumo", rot: "Resumo" },
    { id: "comparaveis", rot: "Comparáveis" },
    ...(aluguelSeAplica(imovel.tipo) ? [{ id: "aluguel" as const, rot: "Aluguel" }] : []),
    { id: "investimento", rot: "Investimento" },
    { id: "entorno", rot: "Entorno" },
    { id: "mercado", rot: "Mercado" },
    { id: "anuncio", rot: "Anúncio" },
  ];

  const setP = <K extends keyof ParametrosInvestimento>(k: K, v: ParametrosInvestimento[K]) =>
    setParams((p) => ({ ...p, [k]: v, ...(k === "itbiPct" ? { itbiOrigem: "manual" as const } : {}) }));

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => { setModo("lista"); }} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Avaliações
        </button>
        <div className="flex items-center gap-2">
          <input className={cn(inputCls, "w-44 py-1.5 text-xs")} placeholder="Corretor no PDF" aria-label="Nome do corretor no PDF" value={corretorNome} onChange={(e) => setCorretorNome(e.target.value)} />
          <input className={cn(inputCls, "w-24 py-1.5 text-xs")} placeholder="CRECI" aria-label="CRECI no PDF" value={creci} onChange={(e) => setCreci(e.target.value)} />
          <button
            disabled={rodando}
            onClick={baixarPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <FileDown className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-lg font-bold text-slate-900">{descricaoCurta(imovel)}</h1>
      </div>

      {/* andamento */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(ROTULO_FRENTE) as Frente[]).filter((f) => status[f]).map((f) => (
          <div key={f} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="flex items-center gap-2 text-slate-700">
              {status[f] === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {(status[f] === "rodando" || status[f] === "aguardando") && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {status[f] === "erro" && <AlertTriangle className="h-4 w-4 text-rose-500" />}
              {status[f] === "nao_se_aplica" && <Ban className="h-4 w-4 text-slate-300" />}
              {ROTULO_FRENTE[f]}
            </span>
            {status[f] === "erro" && (
              <button onClick={() => refazer(f)} className="inline-flex items-center gap-1 text-blue-600" title={erros[f]}>
                <RefreshCw className="h-3.5 w-3.5" /> tentar de novo
              </button>
            )}
          </div>
        ))}
      </div>
      {Object.entries(erros).filter(([, v]) => v).map(([f, v]) => (
        <p key={f} className="text-xs text-rose-600">{ROTULO_FRENTE[f as Frente]}: {v}</p>
      ))}

      {/* abas */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold", aba === a.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}
          >
            {a.rot}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Nota</p>
              <p className="text-4xl font-black text-blue-600">{sint?.notaFinal ?? "-"}</p>
              {sint && sint.pesoConsiderado < 100 && <p className="text-[11px] text-slate-400">calculada sobre {sint.pesoConsiderado}% dos pesos (frentes sem dado ficam fora)</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Valor provável</p>
              {comp?.valor ? (
                <>
                  <p className="text-2xl font-bold text-slate-900">{brl(comp.valor.provavel)}</p>
                  <p className="text-sm text-slate-600">Faixa {brl(comp.valor.minimo)} a {brl(comp.valor.maximo)}</p>
                  <p className="text-xs text-slate-500">{comp.estatisticas.quantidade} comparáveis · confiança {comp.confianca}</p>
                  {comp.diferencaPedidoPct != null && (
                    <p className={cn("mt-1 text-sm font-semibold", comp.diferencaPedidoPct > 5 ? "text-rose-600" : comp.diferencaPedidoPct < -5 ? "text-emerald-600" : "text-slate-700")}>
                      Preço pedido {brl(imovel.precoPedido)}: {comp.diferencaPedidoPct >= 0 ? "+" : ""}{num(comp.diferencaPedidoPct, 1)}% em relação ao valor provável
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">{status.comparaveis === "ok" ? "Sem base suficiente para calcular." : "Aguardando comparáveis..."}</p>
              )}
            </div>
          </div>
          {sint && (
            <>
              {sint.argumento && (
                <Card titulo="Argumento para o proprietário" icone={<ListChecks className="h-4 w-4 text-blue-600" />}>
                  <p className="text-sm text-slate-800">{sint.argumento}</p>
                </Card>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card titulo="Pontos fortes"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{sint.forcas.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Card>
                <Card titulo="Riscos"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{sint.riscos.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Card>
              </div>
              <Card titulo="Notas por frente">
                <div className="space-y-2">
                  {Object.entries(sint.notas).map(([k, v]: any) => (
                    <div key={k} className="flex gap-3 text-sm">
                      <span className="w-10 shrink-0 text-right font-bold text-blue-600">{v.nota ?? "-"}</span>
                      <div>
                        <span className="font-semibold text-slate-700">{{ valor: "Valor", renda: "Renda", entorno: "Entorno", investimento: "Investimento", mercado: "Mercado" }[k as string]} </span>
                        <span className="text-xs text-slate-400">(peso {v.peso}%)</span>
                        <p className="text-xs text-slate-500">{v.justificativa}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {status.sintese === "ok" && <button onClick={() => refazer("sintese")} className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600"><RefreshCw className="h-3.5 w-3.5" /> refazer notas com os dados atuais</button>}
              </Card>
            </>
          )}
          <p className="text-[11px] text-slate-400">Estudo de mercado para apoio à negociação. Não é laudo de avaliação (NBR 14653) nem PTAM, e não é recomendação de investimento.</p>
        </div>
      )}

      {aba === "comparaveis" && (
        <Card titulo="Comparáveis de venda" icone={<Home className="h-4 w-4 text-blue-600" />} acao={status.comparaveis === "ok" ? <button onClick={() => refazer("comparaveis")} className="text-xs text-blue-600">pesquisar de novo</button> : null}>
          {comp ? (
            <>
              {comp.itens.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr><th className="py-2 pr-2">Imóvel</th><th className="pr-2">Bairro</th><th className="pr-2 text-right">Área ({u})</th><th className="pr-2 text-right">Preço</th><th className="pr-2 text-right">R$/{u}</th><th>Fonte</th></tr>
                    </thead>
                    <tbody>
                      {comp.itens.map((c: any, i: number) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-2 pr-2">{c.titulo}{c.situacao === "vendido" && <span className="ml-1 rounded bg-emerald-50 px-1 text-emerald-700">vendido</span>}</td>
                          <td className="pr-2">{c.bairro}</td>
                          <td className="pr-2 text-right">{num(c.area, u === "ha" ? 2 : 0)}</td>
                          <td className="pr-2 text-right">{brl(c.preco)}</td>
                          <td className="pr-2 text-right font-semibold">{brl(c.precoUnidade)}</td>
                          <td><Link url={c.url}>{c.fonte || "ver"}</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-slate-500">Nenhum comparável válido encontrado.</p>}
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p>Média: <b>{brl(comp.estatisticas.media)}/{u}</b></p>
                <p>Mediana: <b>{brl(comp.estatisticas.mediana)}/{u}</b></p>
                <p>Fator de oferta: <b>{comp.fatorOferta.percentual}%</b> <span className="text-xs text-slate-500">{comp.fatorOferta.motivo}</span></p>
                <p>Ajustes somados: <b>{comp.ajusteTotal > 0 ? "+" : ""}{comp.ajusteTotal}%</b></p>
              </div>
              {comp.ajustes.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {comp.ajustes.map((a: any, i: number) => <li key={i}><b>{a.percentual > 0 ? "+" : ""}{a.percentual}% {a.fator}:</b> {a.motivo}</li>)}
                </ul>
              )}
              {comp.valor && <p className="mt-2 text-xs text-slate-500">Cálculo: {comp.valor.calculo}</p>}
              {comp.descartados?.length > 0 && (
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer">{comp.descartados.length} item(ns) descartado(s)</summary>
                  <ul className="mt-1 list-disc pl-5">{comp.descartados.map((d: any, i: number) => <li key={i}>{d.titulo}: {d.motivo}</li>)}</ul>
                </details>
              )}
              <Limitacao texto={comp.limitacoes} />
            </>
          ) : <p className="text-sm text-slate-500">{status.comparaveis === "erro" ? "Falhou. Use 'tentar de novo' acima." : "Pesquisando..."}</p>}
        </Card>
      )}

      {aba === "aluguel" && (
        <Card titulo="Aluguel na região" icone={<Landmark className="h-4 w-4 text-blue-600" />}>
          {alug ? (
            <>
              {alug.estimativa && (
                <div className="mb-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-sm">Aluguel estimado: <b>{brl(alug.estimativa.provavel)}</b> <span className="text-slate-500">(faixa {brl(alug.estimativa.minimo)} a {brl(alug.estimativa.maximo)})</span></p>
                  <p className="text-xs text-slate-500">{alug.estimativa.calculo}</p>
                </div>
              )}
              {alug.itens.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500"><tr><th className="py-2 pr-2">Imóvel</th><th className="pr-2">Bairro</th><th className="pr-2 text-right">Área</th><th className="pr-2 text-right">Aluguel</th><th className="pr-2 text-right">Cond.</th><th>Fonte</th></tr></thead>
                    <tbody>
                      {alug.itens.map((c: any, i: number) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-2 pr-2">{c.titulo}</td><td className="pr-2">{c.bairro}</td>
                          <td className="pr-2 text-right">{num(c.area)}</td><td className="pr-2 text-right font-semibold">{brl(c.aluguel)}</td>
                          <td className="pr-2 text-right">{brl(c.condominio)}</td><td><Link url={c.url}>{c.fonte || "ver"}</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-slate-500">Nenhum anúncio de aluguel válido.</p>}
              <Limitacao texto={alug.limitacoes} />
            </>
          ) : <p className="text-sm text-slate-500">{status.aluguel === "erro" ? "Falhou." : "Pesquisando..."}</p>}
        </Card>
      )}

      {aba === "investimento" && (
        <div className="space-y-4">
          <Card titulo="Parâmetros da simulação" icone={<TrendingUp className="h-4 w-4 text-blue-600" />}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Campo rotulo="Preço de compra (R$)" dica={imovel.precoPedido ? "preço pedido" : "valor provável"}><NumInput value={params.precoBase} onChange={(v) => setP("precoBase", v)} /></Campo>
              <Campo rotulo="ITBI (%)" dica={params.itbiOrigem === "pesquisa" ? "alíquota pesquisada do município" : params.itbiOrigem === "manual" ? "informado por você" : "padrão 2%: confirme na prefeitura"}><NumInput value={params.itbiPct} onChange={(v) => setP("itbiPct", v ?? 0)} /></Campo>
              <Campo rotulo="Escritura e registro (%)" dica="estimativa; confirme no cartório"><NumInput value={params.cartorioPct} onChange={(v) => setP("cartorioPct", v ?? 0)} /></Campo>
              <Campo rotulo="Entrada (%)"><NumInput value={params.entradaPct} onChange={(v) => setP("entradaPct", v ?? 0)} /></Campo>
              <Campo rotulo="Juros (% ao ano)" dica="use a taxa do banco do cliente"><NumInput value={params.taxaAnualPct} onChange={(v) => setP("taxaAnualPct", v ?? 0)} /></Campo>
              <Campo rotulo="Prazo (meses)"><NumInput value={params.prazoMeses} onChange={(v) => setP("prazoMeses", v ?? 360)} step="1" /></Campo>
              {aluguelSeAplica(imovel.tipo) && (
                <>
                  <Campo rotulo="Administração (%)"><NumInput value={params.admPct} onChange={(v) => setP("admPct", v ?? 0)} /></Campo>
                  <Campo rotulo="Vacância (meses/ano)"><NumInput value={params.vacanciaMeses} onChange={(v) => setP("vacanciaMeses", v ?? 0)} /></Campo>
                </>
              )}
            </div>
            <button onClick={() => salvar(docId, resultados, status, params, imovel).then(() => toast.success("Parâmetros salvos."))} className="mt-3 text-xs font-semibold text-blue-600">salvar parâmetros</button>
          </Card>
          {investimento ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card titulo="Custo de aquisição">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Preço</dt><dd>{brl(investimento.preco)}</dd></div>
                  <div className="flex justify-between"><dt>ITBI ({pct(params.itbiPct, 2)})</dt><dd>{brl(investimento.itbi)}</dd></div>
                  <div className="flex justify-between"><dt>Escritura e registro</dt><dd>{brl(investimento.cartorio)}</dd></div>
                  <div className="flex justify-between border-t pt-1 font-bold"><dt>Total</dt><dd>{brl(investimento.custoAquisicao)}</dd></div>
                </dl>
              </Card>
              <Card titulo="Financiamento (SAC)">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Entrada</dt><dd>{brl(investimento.financiamento.entrada)}</dd></div>
                  <div className="flex justify-between"><dt>Financiado</dt><dd>{brl(investimento.financiamento.financiado)}</dd></div>
                  <div className="flex justify-between"><dt>1ª parcela</dt><dd className="font-bold">{brl(investimento.financiamento.primeiraParcela, 2)}</dd></div>
                  <div className="flex justify-between"><dt>Última parcela</dt><dd>{brl(investimento.financiamento.ultimaParcela, 2)}</dd></div>
                  <div className="flex justify-between"><dt>Total de juros</dt><dd>{brl(investimento.financiamento.totalJuros)}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-slate-400">Sem seguros (MIP/DFI) e taxa de administração do banco.</p>
              </Card>
              {investimento.renda && (
                <Card titulo="Renda de aluguel">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt>Aluguel considerado</dt><dd>{brl(investimento.renda.aluguelMensal)}</dd></div>
                    <div className="flex justify-between"><dt>Rentabilidade bruta</dt><dd>{pct(investimento.renda.brutaPct, 2)} a.a.</dd></div>
                    <div className="flex justify-between"><dt>Rentabilidade líquida</dt><dd className="font-bold">{pct(investimento.renda.liquidaPct, 2)} a.a.</dd></div>
                    {investimento.renda.selicPct != null && <div className="flex justify-between"><dt>Selic (Banco Central)</dt><dd>{pct(investimento.renda.selicPct, 2)}</dd></div>}
                  </dl>
                  {investimento.renda.comparacao && <p className="mt-2 text-xs text-slate-600">Líquido {investimento.renda.comparacao}.</p>}
                  <p className="mt-1 text-[11px] text-slate-400">Líquida = aluguel × meses ocupados − administração, sobre o custo total de aquisição. IPTU e condomínio ficam com o inquilino.</p>
                </Card>
              )}
              {investimento.revenda3a && (
                <Card titulo="Revenda em 3 anos">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt>Valorização usada</dt><dd>{pct(investimento.revenda3a.valorizacaoAnualPct, 2)} a.a.</dd></div>
                    <div className="flex justify-between"><dt>Valor projetado</dt><dd>{brl(investimento.revenda3a.valor3a)}</dd></div>
                    <div className="flex justify-between"><dt>Diferença sobre o custo total</dt><dd>{brl(investimento.revenda3a.ganhoBruto)}</dd></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-slate-400">Fonte da valorização: {investimento.revenda3a.origem}. Projeção, não garantia.</p>
                </Card>
              )}
            </div>
          ) : <p className="text-sm text-slate-500">Informe o preço de compra para simular.</p>}
        </div>
      )}

      {aba === "entorno" && (
        <div className="space-y-4">
          <Card titulo="Localização" icone={<MapPin className="h-4 w-4 text-blue-600" />}>
            {loc?.encontrado ? (
              <>
                <iframe
                  title="Mapa do imóvel"
                  className="h-64 w-full rounded-xl border-0"
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${loc.lat},${loc.lon}&z=15&output=embed`}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Ponto encontrado pelo {loc.precisao}: {loc.enderecoEncontrado}{" "}
                  <Link url={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`}>Google Maps</Link>
                </p>
                {loc.precisao !== "endereço" && <Limitacao texto={`O endereço exato não foi achado no mapa; as distâncias abaixo partem do centro do ${loc.precisao}.`} />}
              </>
            ) : loc ? <Limitacao texto={loc.aviso} /> : <p className="text-sm text-slate-500">{status.localizacao === "erro" ? "Falhou." : "Localizando..."}</p>}
          </Card>
          {loc?.entorno && (
            <Card titulo="O que tem perto (distância em linha reta)">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500"><tr><th className="py-2 pr-2">Categoria</th><th className="pr-2 text-right">500 m</th><th className="pr-2 text-right">1 km</th><th className="pr-2 text-right">2 km</th><th>Mais próximos</th></tr></thead>
                  <tbody>
                    {loc.entorno.map((c: any) => (
                      <tr key={c.id} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-2 font-medium">{c.rotulo}</td>
                        <td className="pr-2 text-right">{c.ate500m}</td><td className="pr-2 text-right">{c.ate1km}</td><td className="pr-2 text-right">{c.ate2km}</td>
                        <td>{c.maisProximos.length ? c.maisProximos.map((p: any) => `${p.nome} (${num(p.distanciaM)} m)`).join("; ") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{loc.fonteEntorno}</p>
            </Card>
          )}
          {loc?.avisoEntorno && <Limitacao texto={loc.avisoEntorno} />}
          <Card titulo="Notícias do bairro" icone={<Newspaper className="h-4 w-4 text-blue-600" />}>
            {bairro ? (
              <>
                <ListaNoticias titulo="Segurança" itens={bairro.seguranca} />
                <ListaNoticias titulo="Infraestrutura e obras" itens={bairro.infraestrutura} />
                <ListaNoticias titulo="Vetores de crescimento" itens={bairro.crescimento} />
                <ListaNoticias titulo="Pontos de atenção" itens={bairro.negativos} />
                <Limitacao texto={bairro.limitacoes} />
              </>
            ) : <p className="text-sm text-slate-500">{status.bairro === "erro" ? "Falhou." : "Pesquisando..."}</p>}
          </Card>
        </div>
      )}

      {aba === "mercado" && (
        <Card titulo="Mercado" icone={<TrendingUp className="h-4 w-4 text-blue-600" />}>
          {merc ? (
            <div className="space-y-2 text-sm">
              <p>Classificação: <b>{merc.classificacao}</b> <span className="text-xs text-slate-500">{merc.motivoClassificacao}</span></p>
              <p>Estoque de ofertas: {merc.estoque ? <><b>{num(merc.estoque.quantidade)}</b> anúncios no {merc.estoque.portal} ({merc.estoque.filtro}) <Link url={merc.estoque.url} /></> : <span className="text-slate-400">não encontrado</span>}</p>
              <p>FipeZap: {merc.fipezap ? <>{merc.fipezap.local}: venda <b>{pct(merc.fipezap.venda12m, 2)}</b>{merc.fipezap.locacao12m != null && <>, locação <b>{pct(merc.fipezap.locacao12m, 2)}</b></>} em 12 meses ({merc.fipezap.periodo}) <Link url={merc.fipezap.url} /></> : <span className="text-slate-400">não encontrado</span>}</p>
              <p>ITBI: {merc.itbi ? <><b>{pct(merc.itbi.aliquotaPct, 2)}</b> {merc.itbi.obs} <Link url={merc.itbi.url} /></> : <span className="text-slate-400">não encontrado (simulação usa 2%)</span>}</p>
              {loc?.indicadores?.selic && <p>Selic meta: <b>{pct(loc.indicadores.selic.valor, 2)}</b> <span className="text-xs text-slate-500">({loc.indicadores.selic.data}, Banco Central)</span></p>}
              {loc?.indicadores?.ipca12m && <p>IPCA 12 meses: <b>{pct(loc.indicadores.ipca12m.valor, 2)}</b> <span className="text-xs text-slate-500">({loc.indicadores.ipca12m.data}, Banco Central)</span></p>}
              <ListaNoticias titulo="Notícias do mercado local" itens={merc.noticias} />
              <Limitacao texto={merc.limitacoes} />
            </div>
          ) : <p className="text-sm text-slate-500">{status.mercado === "erro" ? "Falhou." : "Pesquisando..."}</p>}
        </Card>
      )}

      {aba === "anuncio" && (
        <Card titulo="Anúncio para portal">
          {sint?.anuncio?.texto ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-500">Título</p><button onClick={() => copiar(sint.anuncio.titulo)} className="inline-flex items-center gap-1 text-xs text-blue-600"><Copy className="h-3.5 w-3.5" />copiar</button></div>
                <p className="text-sm font-semibold">{sint.anuncio.titulo}</p>
              </div>
              <div>
                <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-500">Texto</p><button onClick={() => copiar(sint.anuncio.texto)} className="inline-flex items-center gap-1 text-xs text-blue-600"><Copy className="h-3.5 w-3.5" />copiar</button></div>
                <p className="whitespace-pre-line text-sm text-slate-700">{sint.anuncio.texto}</p>
              </div>
              <div>
                <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-500">Versão curta (WhatsApp/Marketplace)</p><button onClick={() => copiar(sint.anuncio.curto)} className="inline-flex items-center gap-1 text-xs text-blue-600"><Copy className="h-3.5 w-3.5" />copiar</button></div>
                <p className="whitespace-pre-line text-sm text-slate-700">{sint.anuncio.curto}</p>
              </div>
              <p className="text-[11px] text-slate-400">Feito só com os dados que você informou e o que o mapa encontrou. Confira antes de publicar.</p>
            </div>
          ) : <p className="text-sm text-slate-500">{status.sintese === "erro" ? "Falhou." : "Gerando..."}</p>}
        </Card>
      )}
    </div>
  );
};

export default AvaliacaoView;
