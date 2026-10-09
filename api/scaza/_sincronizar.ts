// Sincronização sob demanda com a API da Scaza:
//   1) login (SCAZA_LOGIN / SCAZA_SENHA)
//   2) lista os imóveis/contas da Scaza e liga cada conta de energia à locação (UC / CPF)
//   3) consulta os débitos de todas as contas e atualiza as faturas em aberto de cada locação
import {
  acharLocacao,
  aplicarFaturasEmAberto,
  locacoesDaEmpresa,
  nascimentoIso,
  soDigitos,
  type FaturaAberta
} from "./_processar.js";

const BASE = "https://api.scaza.com.br/integracao";
const TIMEOUT_MS = 20000;

async function chamar(caminho: string, init: RequestInit & { token?: string } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (init.token) headers["token-auth"] = init.token;
    const r = await fetch(`${BASE}/${caminho}`, { ...init, headers, signal: ctrl.signal });
    const texto = await r.text();
    let json: any = null;
    try { json = JSON.parse(texto); } catch {}
    return { status: r.status, json };
  } finally {
    clearTimeout(t);
  }
}

// Lê campo ignorando maiúsculas/minúsculas (a API mistura "Login1" e "login1").
const campo = (o: any, ...nomes: string[]) => {
  if (!o || typeof o !== "object") return undefined;
  const chaves = Object.keys(o);
  for (const n of nomes) {
    const k = chaves.find(c => c.toLowerCase() === n.toLowerCase());
    if (k !== undefined && o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
};

export async function logarScaza(): Promise<string> {
  const usuario = (process.env.SCAZA_LOGIN || "").trim();
  const senha = process.env.SCAZA_SENHA || "";
  if (!usuario || !senha) throw new Error("Faltam as variáveis SCAZA_LOGIN e SCAZA_SENHA na Vercel.");
  const { status, json } = await chamar("logar", { method: "POST", body: JSON.stringify({ usuario, senha }) });
  const token = campo(json?.resultado, "token1", "token");
  if (status !== 200 || !token) throw new Error("A Scaza recusou o login. Confira SCAZA_LOGIN e SCAZA_SENHA.");
  return String(token);
}

// "23/10/2023 12:00:00" ou ISO → "2023-10-23"
const dataIso = (v: any): string | null => {
  const s = String(v || "").trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m && m[1] !== "0001") return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

// Acha a lista de imóveis na resposta, venha ela como array direto ou dentro de um objeto.
const listaDe = (json: any): any[] => {
  const r = json?.resultado ?? json;
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object") {
    for (const v of Object.values(r)) if (Array.isArray(v)) return v as any[];
  }
  return [];
};

const ehEnergia = (conta: any) => {
  const tipo = campo(conta, "tipo");
  const desc = String(campo(tipo, "descricao") || campo(conta, "tipoDescricao") || "");
  const tipoId = Number(campo(tipo, "id") ?? campo(conta, "tipoId") ?? 0);
  if (desc) return /energia/i.test(desc);
  return tipoId === 1 || tipoId === 0; // 1 = Energia - Equatorial (GO); sem tipo: tenta mesmo assim
};

// Consulta débitos na Scaza e agrupa por conta. "filtro" pode limitar por imoveisId.
async function consultarDebitos(token: string, filtro: { imoveisId?: number[] }): Promise<Map<number, FaturaAberta[]>> {
  const hoje = new Date().toISOString().slice(0, 10);
  const deb = await chamar("consultar-debitos", {
    method: "POST",
    token,
    body: JSON.stringify({
      imoveisIdIntegracao: [], imoveisId: filtro.imoveisId || [], tiposDeContaId: [],
      somenteInadimplentes: false, vencimentoInicio: null, vencimentoFim: null
    })
  });
  if (deb.status !== 200 || !Array.isArray(deb.json?.resultado)) {
    throw new Error("A Scaza não devolveu os débitos agora. Tente de novo em alguns minutos.");
  }
  const porConta = new Map<number, FaturaAberta[]>();
  for (const d of deb.json.resultado) {
    const contaId = Number(campo(d, "contaId") || 0);
    const venc = dataIso(campo(d, "vencimento"));
    if (!contaId || !venc) continue;
    const valor = Number(campo(d, "valor"));
    const lista = porConta.get(contaId) || [];
    lista.push({
      id: null,
      vencimento: venc,
      valor: Number.isFinite(valor) ? valor : null,
      vencida: venc < hoje,
      referencia: campo(d, "informacoesAdicionais") ? String(campo(d, "informacoesAdicionais")) : null
    });
    porConta.set(contaId, lista);
  }
  return porConta;
}

// Aplica as faturas em aberto na locação (em memória). Devolve a lista gravada.
function aplicarDebitos(atual: any, novas: FaturaAberta[], agora: string): FaturaAberta[] {
  const anteriores: FaturaAberta[] = atual.scaza?.faturasEmAberto || [];
  // Mantém o id da fatura (usado para achar o boleto) quando vencimento e valor batem.
  const faturas = novas.map(f => {
    const igual = anteriores.find(a => a.vencimento === f.vencimento && a.valor === f.valor);
    return igual?.id ? { ...f, id: igual.id } : f;
  });
  const pagamentos = { ...(atual.pagamentos || {}) };
  aplicarFaturasEmAberto(pagamentos, faturas, agora);
  atual.pagamentos = pagamentos;
  atual.scaza = { ...(atual.scaza || {}), faturasEmAberto: faturas, ultimaAtualizacao: agora, situacaoConfiavel: true };
  return faturas;
}

export interface ResumoSincronizacao {
  contasEnergia: number;
  vinculadasAgora: number;
  jaVinculadas: number;
  semLocacao: { imovel: string; motivo: string }[];
  listagemImoveis: "ok" | "falhou";
  locacoesAtualizadas: number;
  comFaturaEmAberto: number;
}

export async function sincronizarScaza(adminDb: any): Promise<ResumoSincronizacao> {
  const docs = await locacoesDaEmpresa(adminDb);
  if (!docs) throw new Error("Falta definir SCAZA_COMPANY_ID na Vercel.");
  const token = await logarScaza();
  const agora = new Date().toISOString();

  // Estado em memória das locações (para a ligação e os débitos usarem o mesmo dado).
  const estado = new Map<string, any>(docs.map(d => [d.id, { ...(d.data() || {}) }]));
  const refs = new Map<string, any>(docs.map(d => [d.id, d.ref]));
  const mudou = new Set<string>();
  const docsVivos = () => docs.map(d => ({ id: d.id, ref: d.ref, data: () => estado.get(d.id) }));

  const resumo: ResumoSincronizacao = {
    contasEnergia: 0, vinculadasAgora: 0, jaVinculadas: 0, semLocacao: [],
    listagemImoveis: "ok", locacoesAtualizadas: 0, comFaturaEmAberto: 0
  };

  // 2) Liga as contas de energia da Scaza às locações
  let imoveis: any[] = [];
  try {
    const r = await chamar("listar-imoveis", { method: "GET", token });
    if (r.status !== 200) throw new Error(String(r.status));
    imoveis = listaDe(r.json);
  } catch {
    resumo.listagemImoveis = "falhou";
  }

  for (const imovel of imoveis) {
    const contas = campo(imovel, "contas");
    if (!Array.isArray(contas)) continue;
    const descImovel = String(campo(imovel, "descricao") || "").trim();
    for (const c of contas) {
      if (!ehEnergia(c)) continue;
      const contaId = Number(campo(c, "id") || 0);
      if (!contaId) continue;
      resumo.contasEnergia++;
      const contaNorm = {
        Login1: campo(c, "login1"),
        Login2: campo(c, "login2"),
        Login3: campo(c, "login3"),
        InformacoesExtras: campo(c, "informacoesExtras")
      };
      const { doc, motivo } = acharLocacao(docsVivos(), contaNorm, contaId);
      if (!doc) {
        resumo.semLocacao.push({ imovel: descImovel || `conta ${contaId}`, motivo: motivo || "sem locação" });
        continue;
      }
      const atual = estado.get(doc.id);
      const scaza = { ...(atual.scaza || {}) };
      if (scaza.contaId === contaId) resumo.jaVinculadas++;
      else resumo.vinculadasAgora++;
      scaza.contaId = contaId;
      scaza.imovelId = Number(campo(imovel, "id") || 0) || scaza.imovelId || null;
      if (descImovel) scaza.imovelDescricao = descImovel;
      const cpf = soDigitos(contaNorm.Login2);
      const nasc = nascimentoIso(contaNorm.Login3);
      if (cpf) scaza.titularCpf = cpf;
      if (nasc) scaza.titularNascimento = nasc;
      atual.scaza = scaza;
      const uc = soDigitos(contaNorm.Login1);
      if (!soDigitos(atual.unidadeConsumidora) && uc) atual.unidadeConsumidora = uc;
      mudou.add(doc.id);
    }
  }

  // 3) Débitos de todas as contas
  const porConta = await consultarDebitos(token, {});
  for (const [id, atual] of estado) {
    const contaId = Number(atual.scaza?.contaId || 0);
    if (!contaId) continue;
    const faturas = aplicarDebitos(atual, porConta.get(contaId) || [], agora);
    mudou.add(id);
    if (faturas.length) resumo.comFaturaEmAberto++;
  }

  // Grava em lotes
  const ids = Array.from(mudou);
  for (let i = 0; i < ids.length; i += 400) {
    const lote = adminDb.batch();
    for (const id of ids.slice(i, i + 400)) {
      const atual = estado.get(id);
      const dados: Record<string, any> = { scaza: atual.scaza, pagamentos: atual.pagamentos || {}, updatedAt: agora };
      if (atual.unidadeConsumidora) dados.unidadeConsumidora = atual.unidadeConsumidora;
      lote.set(refs.get(id), dados, { merge: true });
    }
    await lote.commit();
  }
  resumo.locacoesAtualizadas = ids.length;
  return resumo;
}

// ---------------------------------------------------------------------------
// Cadastro de uma locação na Scaza (imóvel + conta de energia Equatorial GO)
// ---------------------------------------------------------------------------
const TIPO_ENERGIA_EQUATORIAL_GO = 1;

// idIntegracao numérico estável a partir do id da locação no Ponto Chave.
const idIntegracaoDe = (energiaId: string) => {
  let h = 0;
  for (const ch of energiaId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 100000000 + (h % 900000000);
};

const dataBr = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

export interface DadosCadastroScaza {
  unidadeConsumidora: string;
  cpfCnpj: string;
  nascimento?: string | null; // YYYY-MM-DD (obrigatória quando a UC está num CPF)
}

export interface ResultadoCadastroScaza {
  jaExistia: boolean;
  contaId: number;
  imovelId: number | null;
  faturasEmAberto: number;
}

export async function cadastrarNaScaza(adminDb: any, energiaId: string, dados: DadosCadastroScaza): Promise<ResultadoCadastroScaza> {
  const docs = await locacoesDaEmpresa(adminDb);
  if (!docs) throw new Error("Falta definir SCAZA_COMPANY_ID na Vercel.");
  const doc = docs.find(d => d.id === energiaId);
  if (!doc) throw new Error("Locação não encontrada.");
  const atual: any = { ...(doc.data() || {}) };
  if (atual.scaza?.contaId) throw new Error("Esta locação já está ligada a uma conta da Scaza.");

  const uc = soDigitos(dados.unidadeConsumidora);
  const doc_ = soDigitos(dados.cpfCnpj);
  const nascBr = dataBr(dados.nascimento);
  if (!uc) throw new Error("Informe a unidade consumidora.");
  if (doc_.length !== 11 && doc_.length !== 14) throw new Error("Informe o CPF ou CNPJ do titular da conta de luz.");
  if (doc_.length === 11 && !nascBr) throw new Error("Para conta no CPF, informe a data de nascimento do titular.");

  const token = await logarScaza();
  const agora = new Date().toISOString();

  // Evita duplicar: se a UC já está cadastrada na Scaza, só liga.
  let contaId = 0;
  let imovelId: number | null = null;
  let jaExistia = false;
  try {
    const r = await chamar("listar-imoveis", { method: "GET", token });
    if (r.status === 200) {
      for (const im of listaDe(r.json)) {
        const contas = campo(im, "contas");
        if (!Array.isArray(contas)) continue;
        const achada = contas.find((c: any) => ehEnergia(c) && soDigitos(campo(c, "login1")).replace(/^0+/, "") === uc.replace(/^0+/, ""));
        if (achada) {
          contaId = Number(campo(achada, "id") || 0);
          imovelId = Number(campo(im, "id") || 0) || null;
          jaExistia = !!contaId;
          break;
        }
      }
    }
  } catch {}

  const idIntegracao = Number(atual.scaza?.idIntegracao) || idIntegracaoDe(energiaId);
  if (!contaId) {
    const conta = {
      tipo: { id: TIPO_ENERGIA_EQUATORIAL_GO },
      login1: uc,
      login2: doc_,
      login3: nascBr,
      login4: "",
      gerarMaloteAutomatico: false
    };
    const corpo = {
      idIntegracao,
      descricao: String(atual.imovel || "Imóvel").slice(0, 200),
      contas: [conta],
      nomeCobrancaInquilino: String(atual.inquilino || "").slice(0, 200)
    };
    let r = await chamar("adicionar-imovel", { method: "POST", token, body: JSON.stringify(corpo) });
    let resultado = r.json?.resultado;
    // Se o imóvel já existir com esse idIntegracao, adiciona só a conta.
    if (r.status !== 200 || !resultado) {
      const r2 = await chamar("adicionar-conta", {
        method: "POST",
        token,
        body: JSON.stringify({
          imovelIdIntegracao: idIntegracao, tipoId: TIPO_ENERGIA_EQUATORIAL_GO,
          login1: uc, login2: doc_, login3: nascBr, login4: "", gerarMaloteAutomatico: false
        })
      });
      if (r2.status !== 200 || !r2.json?.resultado) {
        const msg = campo(r.json, "erro", "mensagem", "message") || campo(r2.json, "erro", "mensagem", "message");
        throw new Error(msg ? `A Scaza recusou o cadastro: ${String(msg).slice(0, 200)}` : "A Scaza recusou o cadastro.");
      }
      contaId = Number(campo(r2.json.resultado, "id") || 0);
      imovelId = Number(campo(r2.json.resultado, "idImovel") || 0) || null;
    } else {
      imovelId = Number(campo(resultado, "id") || 0) || null;
      const contas = campo(resultado, "contas");
      const c = Array.isArray(contas) ? contas[0] : null;
      contaId = Number(campo(c, "id") || 0);
    }
    if (!contaId) throw new Error("A Scaza cadastrou, mas não devolveu o número da conta. Clique em Atualizar agora na Integração Scaza.");
  }

  atual.scaza = {
    ...(atual.scaza || {}),
    contaId,
    imovelId,
    idIntegracao: jaExistia ? (atual.scaza?.idIntegracao ?? null) : idIntegracao,
    imovelDescricao: atual.scaza?.imovelDescricao || atual.imovel || null,
    titularCpf: doc_,
    titularNascimento: dados.nascimento || null,
    cadastradaEm: agora
  };

  // Débitos que a Scaza já tiver (numa conta nova, costumam chegar depois, pelo aviso).
  let faturas: FaturaAberta[] = [];
  try {
    const porConta = await consultarDebitos(token, imovelId ? { imoveisId: [imovelId] } : {});
    faturas = aplicarDebitos(atual, porConta.get(contaId) || [], agora);
  } catch {}

  const gravar: Record<string, any> = { scaza: atual.scaza, pagamentos: atual.pagamentos || {}, updatedAt: agora };
  if (!soDigitos(atual.unidadeConsumidora)) gravar.unidadeConsumidora = uc;
  await doc.ref.set(gravar, { merge: true });

  return { jaExistia, contaId, imovelId, faturasEmAberto: faturas.length };
}
