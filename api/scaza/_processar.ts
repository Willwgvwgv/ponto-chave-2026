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
    for (const chave of ["conta", "Conta"]) {
      const conta = c.dados[chave];
      if (conta && typeof conta === "object" && conta.Tipo) {
        conta.Tipo = { Id: conta.Tipo.Id, Descricao: conta.Tipo.Descricao };
      }
    }
  }
  return c;
}

// Só mexe nas locações da empresa ligada à Scaza. Sem a empresa definida, não aplica
// (evita casar UC/CPF com locação de outra empresa do sistema).
async function locacoesDaEmpresa(adminDb: any): Promise<any[] | null> {
  const empresa = (process.env.SCAZA_COMPANY_ID || "").trim();
  if (!empresa) return null;
  const snap = await adminDb.collection(COLECAO_ENERGIA).where("companyId", "==", empresa).get();
  return snap.docs;
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

  const docs = await locacoesDaEmpresa(adminDb);
  if (!docs) return { processado: false, motivo: "falta definir SCAZA_COMPANY_ID na Vercel" };
  if (!docs.length) return { processado: false, motivo: "nenhuma locação na empresa definida em SCAZA_COMPANY_ID; confira o valor" };
  const { doc, motivo } = acharLocacao(docs, conta, contaId);
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
  // CPF e nascimento da Scaza são do TITULAR da conta de luz, que pode ser o proprietário.
  // Ficam guardados à parte; só completam a locação quando o CPF é o do próprio inquilino.
  const cpf = soDigitos(conta.Login2);
  const nasc = nascimentoIso(conta.Login3);
  atualizacao.scaza.titularCpf = cpf || null;
  atualizacao.scaza.titularNascimento = nasc;
  if (cpf && soDigitos(atual.cpf) === cpf && !atual.dataNascimento && nasc) atualizacao.dataNascimento = nasc;

  await doc.ref.set(atualizacao, { merge: true });

  return {
    processado: true,
    energiaId: doc.id,
    inquilino: atual.inquilino || null,
    mesesAtualizados: Array.from(new Set(alterados)).sort(),
    motivo: confiavel ? undefined : "conta com falha ou inconsistência na Scaza; situação dos meses não alterada"
  };
}

// "emissao_boleto.concluida": guarda o link do PDF do boleto na locação, pela fatura.
export async function processarBoletoConcluido(adminDb: any, dados: any): Promise<ResultadoProcessamento> {
  const conta = dados?.Conta;
  const contaId = Number(conta?.Id || 0);
  const faturaId = Number(dados?.FaturaId || 0);
  const link = String(dados?.LinkBoleto || "").trim();
  const sucesso = String(dados?.Status?.Descricao || "").toLowerCase() === "sucesso";
  if (!sucesso || !link) return { processado: false, motivo: "boleto não emitido pela Scaza" };
  if (!/^https:\/\/[^\s"'<>]+$/i.test(link)) return { processado: false, motivo: "link do boleto inválido" };
  if (!conta || !contaId || !faturaId) return { processado: false, motivo: "aviso sem conta ou fatura" };

  const docs = await locacoesDaEmpresa(adminDb);
  if (!docs) return { processado: false, motivo: "falta definir SCAZA_COMPANY_ID na Vercel" };
  const { doc, motivo } = acharLocacao(docs, conta, contaId);
  if (!doc) return { processado: false, motivo };

  await doc.ref.set({
    scaza: {
      contaId,
      boletos: { [String(faturaId)]: { link, emitidoEm: String(dados?.DataRetorno || new Date().toISOString()) } }
    },
    updatedAt: new Date().toISOString()
  }, { merge: true });
  return { processado: true, energiaId: doc.id, inquilino: doc.data()?.inquilino || null };
}

export async function processarAviso(adminDb: any, topico: string | null, dados: any): Promise<ResultadoProcessamento> {
  try {
    if (topico === "conta.atualizada") return await processarContaAtualizada(adminDb, dados);
    if (topico === "emissao_boleto.concluida") return await processarBoletoConcluido(adminDb, dados);
    if (topico === "emissao_boleto.criada") return { processado: false, motivo: "pedido de boleto registrado; aguardando conclusão" };
    return { processado: false, motivo: "tópico ainda não tratado" };
  } catch (e: any) {
    console.error("scaza: falha ao processar aviso", e);
    return { processado: false, motivo: "erro ao processar: " + String(e?.message || e).slice(0, 200) };
  }
}

// Vínculo manual pelo painel: liga a conta da Scaza do aviso a uma locação escolhida.
export async function vincularConta(adminDb: any, dados: any, energiaId: string): Promise<string | null> {
  const contaId = Number(dados?.idConta || dados?.conta?.Id || dados?.Conta?.Id || 0);
  if (!contaId) return "aviso sem conta da Scaza";
  const docs = await locacoesDaEmpresa(adminDb);
  if (!docs) return "falta definir SCAZA_COMPANY_ID na Vercel";
  const alvo = docs.find(d => d.id === energiaId);
  if (!alvo) return "locação não encontrada";
  for (const d of docs) {
    if (d.id !== energiaId && d.data().scaza?.contaId === contaId) {
      await d.ref.set({ scaza: { contaId: null } }, { merge: true });
    }
  }
  await alvo.ref.set({ scaza: { contaId } }, { merge: true });
  return null;
}
