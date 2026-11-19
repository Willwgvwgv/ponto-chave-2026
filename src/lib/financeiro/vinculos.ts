/**
 * Vínculos automáticos do financeiro novo.
 *
 * Funções puras: recebem uma venda (com os splits) ou uma comissão de locação e
 * devolvem a lista de lançamentos que DEVEM existir no financeiro para ela.
 * Quem grava é `sincronizarVinculos.ts`.
 *
 * Regras:
 * - Cada lançamento tem um ID fixo, montado a partir da origem. Rodar de novo
 *   nunca duplica: o mesmo ID é atualizado.
 * - Só vale para vendas e locações a partir de INICIO_FINANCEIRO_OFICIAL.
 *   O que é anterior fica como está.
 */
import type { Sale, BrokerSplit, Comissao } from "../../types";
import { getClientePagou, getDataPrevista, totalPagoPara } from "../rentalPaymentSchedule";

/** Primeiro dia em que o financeiro do Ponto Chave passa a ser o oficial. */
export const INICIO_FINANCEIRO_OFICIAL = "2027-01-01";

export const CATEGORIA_HONORARIOS_VENDA = "Honorários de Venda";
export const CATEGORIA_COMISSAO_CORRETOR_VENDA = "Comissão de Corretor (Venda)";
export const CATEGORIA_HONORARIOS_LOCACAO = "Honorários de Locação";
export const CATEGORIA_REPASSE_LOCACAO = "Repasse de Corretor (Locação)";

export type OrigemVinculo = "venda" | "locacao";

export interface LancamentoPlanejado {
  id: string;                        // ID fixo do documento em financial_transactions
  origem: OrigemVinculo;
  refId: string;                     // ID da venda ou da comissão de locação
  chave: string;                     // parte do lançamento (ex.: "parcela-2", "corretor-abc")
  type: "RECEITA" | "DESPESA";
  amount: number;                    // sempre positivo
  date: string;                      // YYYY-MM-DD
  description: string;
  categoryName: string;
  /** AGENDADO = ainda vai acontecer (a receber / a pagar). PENDENTE = aconteceu, falta conciliar. */
  status: "AGENDADO" | "PENDENTE";
  accountId?: string;                // conta sugerida (ex.: conta de recebimento da locação)
  pessoa?: string;                   // cliente ou corretor
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const limparId = (s: string) => String(s || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);

export const idVinculo = (origem: OrigemVinculo, refId: string, chave: string) =>
  `fin_${origem}_${limparId(refId)}_${limparId(chave)}`;

const somarMeses = (iso: string, meses: number): string => {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m) return iso;
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d || 1, ultimo));
  return alvo.toISOString().slice(0, 10);
};

const situacao = (data: string, aconteceu: boolean, hoje: string): "AGENDADO" | "PENDENTE" =>
  aconteceu || (data && data <= hoje) ? "PENDENTE" : "AGENDADO";

/** A venda entra no financeiro novo? */
export const vendaNoFinanceiroNovo = (sale: Pick<Sale, "sale_date">): boolean =>
  !!sale.sale_date && sale.sale_date >= INICIO_FINANCEIRO_OFICIAL;

/** A locação entra no financeiro novo? Usa o mês de referência (ou o vencimento). */
export const locacaoNoFinanceiroNovo = (c: Pick<Comissao, "mesReferencia" | "vencimento">): boolean => {
  const ref = c.mesReferencia ? `${c.mesReferencia}-01` : (c.vencimento || "");
  return !!ref && ref >= INICIO_FINANCEIRO_OFICIAL;
};

/**
 * Venda → honorários a receber (à vista ou entrada + parcelas) e comissão de cada corretor a pagar.
 * Venda cancelada ou rascunho não gera nada (os lançamentos que existiam são cancelados na sincronização).
 */
export function planejarVenda(sale: Sale, splits: BrokerSplit[], hoje: string): LancamentoPlanejado[] {
  if (!vendaNoFinanceiroNovo(sale)) return [];
  if (sale.status === "CANCELLED" || sale.status === "DRAFT") return [];

  const out: LancamentoPlanejado[] = [];
  const imovel = sale.property_address || "Venda";
  const cliente = sale.client_name || "";
  const base = { origem: "venda" as const, refId: sale.id, categoryName: CATEGORIA_HONORARIOS_VENDA, type: "RECEITA" as const, pessoa: cliente };

  if (sale.is_installment && (sale.installment_count || 0) > 0) {
    if ((sale.entrada_value || 0) > 0) {
      const date = sale.sale_date;
      out.push({ ...base, id: idVinculo("venda", sale.id, "entrada"), chave: "entrada", amount: r2(sale.entrada_value!),
        date, status: situacao(date, false, hoje), description: `Entrada dos honorários — ${imovel}` });
    }
    const n = sale.installment_count || 0;
    const primeira = sale.first_installment_date || sale.sale_date;
    for (let i = 1; i <= n; i++) {
      const date = somarMeses(primeira, i - 1);
      out.push({ ...base, id: idVinculo("venda", sale.id, `parcela-${i}`), chave: `parcela-${i}`, amount: r2(sale.installment_value || 0),
        date, status: situacao(date, false, hoje), description: `Honorários parcela ${i}/${n} — ${imovel}` });
    }
  } else if ((sale.total_commission || 0) > 0) {
    const date = sale.sale_date;
    out.push({ ...base, id: idVinculo("venda", sale.id, "honorarios"), chave: "honorarios", amount: r2(sale.total_commission),
      date, status: situacao(date, false, hoje), description: `Honorários — ${imovel}` });
  }

  for (const sp of splits) {
    const valor = r2((sp.calculated_value || 0) - (sp.discount_value || 0));
    if (valor <= 0) continue;
    const pago = String(sp.status).toUpperCase() === "PAID" || !!sp.paid;
    const date = (pago && sp.payment_date) || sp.forecast_date || sale.sale_date;
    const chave = `corretor-${sp.id || sp.broker_id}`;
    out.push({
      id: idVinculo("venda", sale.id, chave), origem: "venda", refId: sale.id, chave,
      type: "DESPESA", amount: valor, date, status: pago ? "PENDENTE" : "AGENDADO",
      categoryName: CATEGORIA_COMISSAO_CORRETOR_VENDA, pessoa: sp.broker_name,
      description: `Comissão ${sp.broker_name || "corretor"} — ${imovel}`
    });
  }
  return out.filter(l => l.amount > 0);
}

/**
 * Locação → 1º aluguel recebido do cliente, cada repasse feito ao corretor (saída)
 * e o saldo que ainda falta repassar a cada corretor (a pagar).
 */
export function planejarLocacao(c: Comissao, hoje: string): LancamentoPlanejado[] {
  if (!locacaoNoFinanceiroNovo(c)) return [];
  const out: LancamentoPlanejado[] = [];
  const imovel = c.imovel || "Locação";
  const base = { origem: "locacao" as const, refId: c.id };

  const recebeu = getClientePagou(c);
  const valorRecebido = r2(c.primeiroAluguel || 0);
  if (valorRecebido > 0) {
    const date = (recebeu && c.dataRecebimento) || c.vencimento || hoje;
    out.push({ ...base, id: idVinculo("locacao", c.id, "recebimento"), chave: "recebimento", type: "RECEITA",
      amount: valorRecebido, date, status: recebeu ? "PENDENTE" : "AGENDADO", categoryName: CATEGORIA_HONORARIOS_LOCACAO,
      accountId: c.contaBancariaRecebimento || undefined, pessoa: c.inquilino,
      description: `1º aluguel — ${imovel}` });
  }

  for (const p of c.pagamentosCorretores || []) {
    if (p.tipo !== "pagamento" && p.tipo !== "adiantamento") continue;
    const chave = `repasse-${p.id}`;
    out.push({ ...base, id: idVinculo("locacao", c.id, chave), chave, type: "DESPESA", amount: r2(p.valor),
      date: p.data || hoje, status: "PENDENTE", categoryName: CATEGORIA_REPASSE_LOCACAO, pessoa: p.corretorNome,
      description: `${p.tipo === "adiantamento" ? "Adiantamento" : "Repasse"} ${p.corretorNome} — ${imovel}` });
  }

  const encerrada = c.statusFinanceiro === "concluida";
  if (!encerrada) {
    for (const rt of c.rateio || []) {
      const falta = r2((rt.valor || 0) - totalPagoPara(c.pagamentosCorretores, rt.corretorId));
      if (falta <= 0) continue;
      const chave = `a-pagar-${rt.corretorId}`;
      out.push({ ...base, id: idVinculo("locacao", c.id, chave), chave, type: "DESPESA", amount: falta,
        date: getDataPrevista(c, rt) || c.vencimento || hoje, status: "AGENDADO", categoryName: CATEGORIA_REPASSE_LOCACAO,
        pessoa: rt.corretorNome, description: `A repassar ${rt.corretorNome} — ${imovel}` });
    }
  }
  return out;
}
