import { Comissao, RateioComissao, PagamentoCorretor } from "../types";

export interface DistribuicaoItem {
  corretorId: string;
  corretorNome: string;
  papel: "captador" | "locacao" | "auxiliar";
  valor: number;
  porcentagem?: number;
  totalPago?: number;
  status?: "pendente" | "pago";
}

export interface RepasseItem {
  id: string;
  corretorId: string;
  corretorNome: string;
  tipo: "pagamento" | "adiantamento" | "desconto";
  valor: number;
  data: string;
  observacao?: string;
  registradoPorUid: string;
  registradoPorNome: string;
  registradoEm: number;
}

export interface RentalFinancialViewModel {
  id: string;
  imovel: string;
  inquilino: string;
  competencia: { mes: number; ano: number; label: string };
  valorAluguel: number;
  statusFinanceiro: "calculada" | "aguardando_pagamento" | "em_distribuicao" | "repasses_pendentes" | "concluida";
  dataRecebimento?: string;
  contaBancariaRecebimento?: string;
  distribuicao: DistribuicaoItem[];
  repasses: RepasseItem[];
  legacyDoc: Comissao;
}

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export function parseCompetence(mesReferencia: string) {
  if (!mesReferencia || !mesReferencia.includes("-")) {
    return { mes: 6, ano: 2026, label: "Jun/2026" };
  }
  const [yearStr, monthStr] = mesReferencia.split("-");
  const ano = parseInt(yearStr, 10);
  const mes = parseInt(monthStr, 10);
  const label = `${MONTHS_PT[mes - 1] || "Jun"}/${ano}`;
  return { mes, ano, label };
}

export function toViewModel(comissao: Comissao): RentalFinancialViewModel {
  let statusFin: "calculada" | "aguardando_pagamento" | "em_distribuicao" | "repasses_pendentes" | "concluida" = "calculada";

  if (comissao.statusFinanceiro) {
    const s = comissao.statusFinanceiro as string;
    if (s === "calculada" || s === "aguardando_pagamento" || s === "em_distribuicao" || s === "repasses_pendentes" || s === "concluida") {
      statusFin = s as any;
    } else {
      // Legacy mapping
      switch (s) {
        case "aguardando":
          statusFin = "aguardando_pagamento";
          break;
        case "recebido":
        case "conciliado":
          statusFin = "em_distribuicao";
          break;
        case "distribuindo":
          statusFin = "repasses_pendentes";
          break;
        case "concluido":
          statusFin = "concluida";
          break;
        default:
          statusFin = "calculada";
      }
    }
  } else {
    if (comissao.status === "pago" || comissao.jaPagoCorretores) {
      statusFin = "concluida";
    } else {
      statusFin = "em_distribuicao"; // Fallback to "recibido" equivalent
    }
  }

  return {
    id: comissao.id,
    imovel: comissao.imovel,
    inquilino: comissao.inquilino,
    competencia: parseCompetence(comissao.mesReferencia),
    valorAluguel: comissao.aluguelMensal || comissao.primeiroAluguel,
    statusFinanceiro: statusFin,
    dataRecebimento: comissao.dataRecebimento,
    contaBancariaRecebimento: comissao.contaBancariaRecebimento,
    distribuicao: (comissao.rateio || []).map(r => ({
      corretorId: r.corretorId,
      corretorNome: r.corretorNome,
      papel: r.papel,
      valor: r.valor,
      porcentagem: r.porcentagem,
      totalPago: r.totalPago || 0,
      status: r.status || "pendente"
    })),
    repasses: (comissao.pagamentosCorretores || []).map(p => ({
      id: p.id,
      corretorId: p.corretorId,
      corretorNome: p.corretorNome,
      tipo: p.tipo === "desconto_adiantamento" ? "desconto" : p.tipo as any,
      valor: p.valor,
      data: p.data,
      observacao: p.observacao,
      registradoPorUid: p.registradoPorUid,
      registradoPorNome: p.registradoPorNome,
      registradoEm: p.registradoEm
    })),
    legacyDoc: comissao
  };
}

export function fromViewModel(view: RentalFinancialViewModel): Comissao {
  const comissao = view.legacyDoc;
  return {
    ...comissao,
    id: view.id,
    imovel: view.imovel,
    inquilino: view.inquilino,
    mesReferencia: `${view.competencia.ano}-${String(view.competencia.mes).padStart(2, "0")}`,
    aluguelMensal: view.valorAluguel,
    primeiroAluguel: view.valorAluguel,
    statusFinanceiro: view.statusFinanceiro,
    dataRecebimento: view.dataRecebimento,
    contaBancariaRecebimento: view.contaBancariaRecebimento,
    status: view.statusFinanceiro === "concluida" ? "pago" : "pendente",
    jaPagoCorretores: view.statusFinanceiro === "concluida",
    rateio: view.distribuicao.map(d => ({
      corretorId: d.corretorId,
      corretorNome: d.corretorNome,
      papel: d.papel,
      valor: d.valor,
      porcentagem: d.porcentagem,
      totalPago: d.totalPago,
      status: d.status
    })),
    pagamentosCorretores: view.repasses.map(r => ({
      id: r.id,
      corretorId: r.corretorId,
      corretorNome: r.corretorNome,
      tipo: r.tipo === "desconto" ? "desconto_adiantamento" : r.tipo as any,
      valor: r.valor,
      data: r.data,
      observacao: r.observacao,
      registradoPorUid: r.registradoPorUid,
      registradoPorNome: r.registradoPorNome,
      registradoEm: r.registradoEm
    }))
  };
}
