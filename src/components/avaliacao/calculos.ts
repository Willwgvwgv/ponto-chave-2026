// Contas da avaliação feitas no navegador, de forma transparente (sem IA).

export type TipoImovel = "apartamento" | "casa" | "lote" | "lote_condominio" | "rural" | "comercial";

export const TIPOS_IMOVEL: { id: TipoImovel; rotulo: string }[] = [
  { id: "casa", rotulo: "Casa" },
  { id: "apartamento", rotulo: "Apartamento" },
  { id: "lote", rotulo: "Lote urbano" },
  { id: "lote_condominio", rotulo: "Lote em condomínio" },
  { id: "rural", rotulo: "Rural (chácara/sítio/fazenda)" },
  { id: "comercial", rotulo: "Comercial" },
];

export interface ImovelAvaliado {
  tipo: TipoImovel;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  areaConstruida: number | null;
  areaTerreno: number | null;
  areaHa: number | null;
  quartos: number | null;
  suites: number | null;
  vagas: number | null;
  padrao: string;
  conservacao: string;
  idade: number | null;
  precoPedido: number | null;
  linkAnuncio: string;
  observacoes: string;
}

export interface ParametrosInvestimento {
  precoBase: number | null; // preço de compra considerado
  itbiPct: number;
  itbiOrigem: "pesquisa" | "padrao" | "manual";
  cartorioPct: number;
  entradaPct: number;
  taxaAnualPct: number;
  prazoMeses: number;
  admPct: number; // taxa de administração da locação
  vacanciaMeses: number;
}

export const aluguelSeAplica = (tipo: TipoImovel) => tipo !== "lote" && tipo !== "lote_condominio" && tipo !== "rural";

export function calcularInvestimento(p: ParametrosInvestimento, aluguelMensal: number | null, selicPct: number | null, valorizacaoAnualPct: number | null, valorizacaoOrigem: string) {
  if (!p.precoBase || p.precoBase <= 0) return null;
  const preco = p.precoBase;
  const itbi = (preco * p.itbiPct) / 100;
  const cartorio = (preco * p.cartorioPct) / 100;
  const custoAquisicao = preco + itbi + cartorio;

  const entrada = (preco * p.entradaPct) / 100;
  const financiado = preco - entrada;
  const n = Math.max(1, Math.round(p.prazoMeses));
  const iMes = Math.pow(1 + p.taxaAnualPct / 100, 1 / 12) - 1;
  const amortizacao = financiado / n;
  const primeiraParcela = amortizacao + financiado * iMes;
  const ultimaParcela = amortizacao + amortizacao * iMes;
  const totalJuros = (iMes * financiado * (n + 1)) / 2;

  let renda: any = null;
  if (aluguelMensal && aluguelMensal > 0) {
    const mesesOcupados = Math.max(0, 12 - p.vacanciaMeses);
    const brutoAno = aluguelMensal * 12;
    const liquidoAno = aluguelMensal * mesesOcupados * (1 - p.admPct / 100);
    renda = {
      aluguelMensal,
      brutaPct: (brutoAno / preco) * 100,
      liquidaPct: (liquidoAno / custoAquisicao) * 100,
      liquidoAno,
      selicPct,
      comparacao:
        selicPct != null
          ? (liquidoAno / custoAquisicao) * 100 >= selicPct
            ? "rende igual ou acima da Selic"
            : "rende abaixo da Selic (o ganho dependeria da valorização)"
          : null,
      // IPTU e condomínio não entram porque normalmente são pagos pelo inquilino.
    };
  }

  let revenda3a: any = null;
  if (valorizacaoAnualPct != null) {
    const valor3a = preco * Math.pow(1 + valorizacaoAnualPct / 100, 3);
    revenda3a = { valorizacaoAnualPct, origem: valorizacaoOrigem, valor3a, ganhoBruto: valor3a - custoAquisicao };
  }

  return {
    preco,
    itbi,
    cartorio,
    custoAquisicao,
    financiamento: { entrada, financiado, n, taxaAnualPct: p.taxaAnualPct, primeiraParcela, ultimaParcela, totalJuros },
    renda,
    revenda3a,
  };
}

export const brl = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v)
    ? "-"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec, maximumFractionDigits: dec });

export const num = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? "-" : v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const pct = (v: number | null | undefined, dec = 1) => (v == null || !Number.isFinite(v) ? "-" : `${num(v, dec)}%`);

export function descricaoCurta(im: ImovelAvaliado) {
  const tipo = TIPOS_IMOVEL.find((t) => t.id === im.tipo)?.rotulo || im.tipo;
  return `${tipo} - ${[im.endereco, im.bairro, im.cidade && `${im.cidade}${im.uf ? "/" + im.uf : ""}`].filter(Boolean).join(", ")}`;
}

// Firestore não aceita undefined; também derruba funções e NaN.
export function limparParaFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v)));
}
