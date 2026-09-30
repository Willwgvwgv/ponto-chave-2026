import { Comissao, RateioComissao, PagamentoCorretor } from "../types";

// Regras de prazo e status das comissões de locação.
//
// - Cliente: paga o 1º aluguel até `vencimento`. `clientePagou` indica se já pagou
//   (para lançamentos antigos, sem esse campo, deduzimos pelo histórico).
// - Honorários: cada participante tem uma data prevista de repasse. Padrão:
//     corretores  → `dataPagamentoHonorarios` da locação (ou o vencimento, se vazio)
//     auxiliar    → último dia do mês (fechamento mensal, ex.: secretária)
//   Pode ser sobrescrito por participante em `rateio[i].dataPrevista`.
// - Atrasado só quando há algo realmente vencido: cliente que não pagou após o
//   vencimento, ou repasse com data prevista já passada.

export type RowStatus = "concluido" | "em_aberto" | "atrasado";

export interface Pendencia {
  corretorId: string;
  nome: string;
  papel: RateioComissao["papel"];
  saldo: number;
  dataPrevista: string; // YYYY-MM-DD ("" se não houver data)
  atrasado: boolean;
}

export interface StatusDetalhado {
  status: RowStatus;
  motivo: string;       // frase curta para a lista (ex.: "Falta Maely · 31/10")
  clientePagou: boolean;
  pendencias: Pendencia[];
  valorAtrasado: number;
}

export const hojeLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Recebe "YYYY-MM-DD" ou "YYYY-MM" e devolve o último dia daquele mês. */
export const ultimoDiaDoMes = (ref: string): string => {
  const [ano, mes] = (ref || "").split("-").map(Number);
  if (!ano || !mes) return "";
  const ultimo = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
};

export const formatDiaMes = (iso: string): string => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : "";
};

export const primeiroNome = (nome: string): string => {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

export const getClientePagou = (doc: Comissao): boolean => {
  if (typeof doc.clientePagou === "boolean") return doc.clientePagou;
  // Lançamentos antigos: se já houve recebimento registrado ou repasse feito, o cliente pagou.
  const sf = String(doc.statusFinanceiro || "");
  return !!doc.dataRecebimento ||
    (doc.pagamentosCorretores || []).length > 0 ||
    doc.status === "pago" ||
    ["recebido", "conciliado", "distribuindo", "concluido", "em_distribuicao", "repasses_pendentes", "concluida"].includes(sf);
};

export const getDataHonorarios = (doc: Comissao): string =>
  doc.dataPagamentoHonorarios || doc.vencimento || "";

export const getDataPrevistaPadrao = (doc: Pick<Comissao, "dataPagamentoHonorarios" | "vencimento" | "mesReferencia">, papel: RateioComissao["papel"]): string => {
  const base = doc.dataPagamentoHonorarios || doc.vencimento || "";
  if (papel === "auxiliar") return ultimoDiaDoMes(base || doc.mesReferencia || "");
  return base;
};

export const getDataPrevista = (doc: Comissao, rt: RateioComissao): string => {
  if (rt.dataPrevista) return rt.dataPrevista;
  // Linha mesclada (mesma pessoa em mais de um papel): se TODOS os papéis são auxiliar,
  // segue a regra de auxiliar; senão, a data dos honorários.
  const soAuxiliar = rt.composicao && rt.composicao.length > 0
    ? rt.composicao.every(c => c.papel === "auxiliar")
    : rt.papel === "auxiliar";
  return getDataPrevistaPadrao(doc, soAuxiliar ? "auxiliar" : "locacao");
};

export const totalPagoPara = (pagamentos: PagamentoCorretor[] | undefined, corretorId: string): number =>
  (pagamentos || [])
    .filter(p => p.corretorId === corretorId)
    .reduce((sum, p) => (p.tipo === "pagamento" || p.tipo === "adiantamento") ? sum + p.valor : sum - p.valor, 0);

export function getStatusDetalhado(doc: Comissao, hoje: string = hojeLocal()): StatusDetalhado {
  const clientePagou = getClientePagou(doc);

  const pendencias: Pendencia[] = (doc.rateio || [])
    .map(rt => {
      const saldo = Math.max(0, (rt.valor || 0) - totalPagoPara(doc.pagamentosCorretores, rt.corretorId));
      const dataPrevista = getDataPrevista(doc, rt);
      return {
        corretorId: rt.corretorId,
        nome: rt.corretorNome,
        papel: rt.papel,
        saldo,
        dataPrevista,
        atrasado: clientePagou && !!dataPrevista && dataPrevista < hoje
      };
    })
    .filter(p => p.saldo > 0.01);

  const encerrada = doc.statusFinanceiro === "concluida" || doc.status === "pago";
  if (encerrada || (clientePagou && pendencias.length === 0)) {
    return { status: "concluido", motivo: "Tudo pago", clientePagou: true, pendencias: [], valorAtrasado: 0 };
  }

  if (!clientePagou) {
    const venc = doc.vencimento || "";
    const vencido = !!venc && venc < hoje;
    const valorCliente = doc.primeiroAluguel || doc.aluguelMensal || 0;
    return {
      status: vencido ? "atrasado" : "em_aberto",
      motivo: vencido
        ? `Cliente não pagou · venceu ${formatDiaMes(venc)}`
        : `Aguardando cliente${venc ? ` · vence ${formatDiaMes(venc)}` : ""}`,
      clientePagou,
      pendencias,
      valorAtrasado: vencido ? valorCliente : 0
    };
  }

  const atrasadas = pendencias.filter(p => p.atrasado);
  const alvo = atrasadas.length > 0 ? atrasadas : pendencias;
  const quem = alvo.length === 1 ? `Falta ${primeiroNome(alvo[0].nome)}` : `Faltam ${alvo.length}`;
  const datas = alvo.map(p => p.dataPrevista).filter(Boolean).sort();
  const dataRef = atrasadas.length > 0 ? datas[0] : datas[0];
  const quando = dataRef ? (atrasadas.length > 0 ? ` · desde ${formatDiaMes(dataRef)}` : ` · ${formatDiaMes(dataRef)}`) : "";

  return {
    status: atrasadas.length > 0 ? "atrasado" : "em_aberto",
    motivo: `${quem}${quando}`,
    clientePagou,
    pendencias,
    valorAtrasado: atrasadas.reduce((s, p) => s + p.saldo, 0)
  };
}
