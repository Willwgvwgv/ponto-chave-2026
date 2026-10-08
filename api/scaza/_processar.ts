// Interpreta os avisos da Scaza e atualiza o acompanhamento de energia das locações.
//
// "conta.atualizada" traz a conta (Login1 = UC, Login2 = CPF/CNPJ, Login3 = nascimento)
// e a lista "faturas" com as faturas EM ABERTO naquele momento. Daí:
//   - fatura na lista            → mês do vencimento fica "em aberto" (ou "atrasado" se vencida)
//   - mês que a Scaza tinha marcado como aberto e saiu da lista → "pago"
//   - mês da última fatura encontrada que não está na lista     → "pago"

export const COLECAO_ENERGIA = "energia_locacoes";
const NOME_SCAZA = "Scaza (automático)";

const soDigitos = (v: any) => String(v ?? "").replace(/\D/g, "");
const semZerosEsq = (v: string) => v.replace(/^0+/, "");

const mesDe = (iso: any): string | null => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  if (!m || m[1] === "0001") return null;
  return `${m[1]}-${m[2]}`;
};

// "05/09/1975" → "1975-09-05"
const nascimentoIso = (v: any): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export interface ResultadoProcessamento {
  processado: boolean;
  motivo?: string;
  energiaId?: string;
  inquilino?: string;
  mesesAtualizados?: string[];
}

// Remove do registro o que não precisamos guardar (dados do operador da Scaza e
// configuração interna do serviço, que inclui credenciais de terceiros).
export function limparCorpo(corpo: any): any {
  if (!corpo || typeof corpo !== "object") return corpo;
  const c = JSON.parse(JSON.stringify(corpo));
  if (c.dados && typeof c.dados === "object") {
    delete c.dados.Operador;
    if (c.dados.conta && typeof c.dados.conta === "object") {
      const tipo = c.dados.conta.Tipo;
      c.dados.conta.Tipo = tipo ? { Id: tipo.Id, Descricao: tipo.Descricao } : tipo;
    }
  }
  return c;
}

function acharLocacao(docs: any[], conta: any, contaId: number): { doc: any | null; motivo?: string } {
  const porConta = docs.find(d => d.data().scaza?.contaId === contaId);
  if (porConta) return { doc: porConta };

  const ucs = new Set<string>();
  const uc1 = semZerosEsq(soDigitos(conta?.Login1));
  if (uc1) ucs.add(uc1);
  try {
    const extras = JSON.parse(conta?.InformacoesExtras || "{}");
    const nova = semZerosEsq(soDigitos(extras?.nova_unidade_consumidora));
    if (nova) ucs.add(nova);
  } catch {}
  if (ucs.size) {
    const porUc = docs.filter(d => ucs.has(semZerosEsq(soDigitos(d.data().unidadeConsumidora))));
    if (porUc.length === 1) return { doc: porUc[0] };
    if (porUc.length > 1) return { doc: null, motivo: "mais de uma locação com a mesma UC" };
  }

  const cpf = soDigitos(conta?.Login2);
  if (cpf) {
    const porCpf = docs.filter(d => soDigitos(d.data().cpf) === cpf);
    if (porCpf.length === 1) return { doc: porCpf[0] };
    if (porCpf.length > 1) {
      // Mesmo inquilino em mais de um imóvel: só vincula se apenas um ainda está sem UC.
      const semUc = porCpf.filter(d => !soDigitos(d.data().unidadeConsumidora));
      if (semUc.length === 1) return { doc: semUc[0] };
      return { doc: null, motivo: "inquilino com mais de uma locação; informe a UC na locação certa" };
    }
  }
  return { doc: null, motivo: "nenhuma locação com esta UC ou CPF" };
}

export async function processarContaAtualizada(adminDb: any, dados: any): Promise<ResultadoProcessamento> {
  const conta = dados?.conta;
  const faturas = dados?.faturas;
  const contaId = Number(dados?.idConta || conta?.Id || 0);
  if (!conta || !contaId || !Array.isArray(faturas)) {
    return { processado: false, motivo: "aviso de teste ou sem dados da conta" };
  }
  if (conta?.Tipo?.TipoConta && conta.Tipo.TipoConta.Descricao && conta.Tipo.TipoConta.Descricao !== "Energia") {
    return { processado: false, motivo: "conta que não é de energia" };
  }

  // Só mexe nas locações da empresa ligada à Scaza. Sem a empresa definida, não aplica
  // (evita casar UC/CPF com locação de outra empresa do sistema).
  const empresa = (process.env.SCAZA_COMPANY_ID || "").trim();
  if (!empresa) return { processado: false, motivo: "falta definir SCAZA_COMPANY_ID na Vercel" };
  const snap = await adminDb.collection(COLECAO_ENERGIA).where("companyId", "==", empresa).get();
  const { doc, motivo } = acharLocacao(snap.docs, conta, contaId);
  if (!doc) return { processado: false, motivo };

  const atual = doc.data() || {};
  const agora = new Date().toISOString();
  const confiavel = conta.Verificada !== false && !conta.EstaInconsistente && !(conta.QuantidadeDeFalhasConsecutivas > 0);

  const emAberto = faturas
    .filter((f: any) => f && f.Vencimento)
    .map((f: any) => ({
      id: Number(f.Id) || null,
      vencimento: String(f.Vencimento).slice(0, 10),
      valor: typeof f.Valor === "number" ? f.Valor : Number(f.Valor) || null,
      vencida: !!f.EstaVencida,
      referencia: f.Codigo ? String(f.Codigo) : null
    }));

  const pagamentos: Record<string, any> = { ...(atual.pagamentos || {}) };
  const alterados: string[] = [];
  const mesesAbertos = new Set<string>();

  if (confiavel) {
    // Agrupa por mês do vencimento; duas faturas no mesmo mês somam e vale a pior situação.
    const porMes = new Map<string, { vencida: boolean; valor: number | null; vencimento: string }>();
    for (const f of emAberto) {
      const mes = mesDe(f.vencimento);
      if (!mes) continue;
      const ant = porMes.get(mes);
      porMes.set(mes, {
        vencida: (ant?.vencida || false) || f.vencida,
        valor: f.valor == null && ant?.valor == null ? null : (ant?.valor || 0) + (f.valor || 0),
        vencimento: ant && ant.vencimento < f.vencimento ? ant.vencimento : f.vencimento
      });
    }
    for (const [mes, f] of porMes) {
      mesesAbertos.add(mes);
      pagamentos[mes] = {
        status: f.vencida ? "atrasado" : "em_aberto",
        verificadoEm: agora,
        verificadoPorNome: NOME_SCAZA,
        origem: "scaza",
        valor: f.valor,
        vencimento: f.vencimento
      };
      alterados.push(mes);
    }

    // Mês que a própria Scaza tinha marcado como aberto e não aparece mais → pago.
    for (const [mes, reg] of Object.entries<any>(pagamentos)) {
      if (reg?.origem === "scaza" && reg.status !== "pago" && !mesesAbertos.has(mes)) {
        pagamentos[mes] = { ...reg, status: "pago", verificadoEm: agora, verificadoPorNome: NOME_SCAZA };
        alterados.push(mes);
      }
    }

    // Última fatura encontrada pela Scaza que não está em aberto → paga.
    const mesUltima = mesDe(conta.UltimaFatura);
    if (mesUltima && !mesesAbertos.has(mesUltima) && pagamentos[mesUltima]?.status !== "pago") {
      pagamentos[mesUltima] = {
        status: "pago",
        verificadoEm: agora,
        verificadoPorNome: NOME_SCAZA,
        origem: "scaza",
        vencimento: String(conta.UltimaFatura).slice(0, 10)
      };
      alterados.push(mesUltima);
    }
  }

  const atualizacao: Record<string, any> = {
    pagamentos,
    scaza: {
      contaId,
      imovelId: Number(conta.ImovelId || conta.Imovel?.Id || 0) || null,
      imovelDescricao: conta.Imovel?.Descricao ? String(conta.Imovel.Descricao).trim() : null,
      ultimaAtualizacao: conta.UltimaAtualizacao || agora,
      ultimaFatura: conta.UltimaFatura ? String(conta.UltimaFatura).slice(0, 10) : null,
      faturasEmAberto: emAberto,
      situacaoConfiavel: confiavel
    },
    updatedAt: agora
  };
  // Completa dados que estiverem faltando na locação.
  const uc = soDigitos(conta.Login1);
  if (!soDigitos(atual.unidadeConsumidora) && uc) atualizacao.unidadeConsumidora = uc;
  const cpf = soDigitos(conta.Login2);
  if (!soDigitos(atual.cpf) && cpf) atualizacao.cpf = cpf;
  const nasc = nascimentoIso(conta.Login3);
  if (!atual.dataNascimento && nasc) atualizacao.dataNascimento = nasc;

  await doc.ref.set(atualizacao, { merge: true });

  return {
    processado: true,
    energiaId: doc.id,
    inquilino: atual.inquilino || null,
    mesesAtualizados: Array.from(new Set(alterados)).sort(),
    motivo: confiavel ? undefined : "conta com falha ou inconsistência na Scaza; situação dos meses não alterada"
  };
}
