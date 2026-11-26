/**
 * Grava no financeiro (financial_transactions) os lançamentos planejados em `vinculos.ts`.
 *
 * Segurança dos dados:
 * - Lançamento CONCILIADO nunca é alterado nem apagado. Se a origem mudou, ele só
 *   ganha a marca `vinculoDivergente` para alguém conferir.
 * - Lançamento que deixou de existir na origem:
 *     previsão (AGENDADO) → removido, era só previsão;
 *     já aconteceu (PENDENTE) → vira CANCELADO com o motivo, não some.
 * - Conta e categoria escolhidas à mão no financeiro são mantidas.
 * - Lançamentos antigos (anteriores ao financeiro novo, IDs tx_auto_*) não são tocados.
 * - Falha aqui nunca impede salvar a venda ou a locação: só avisa no console.
 */
import { db, collection, getDocs, query, where, doc, setDoc, updateDoc, deleteDoc, getDoc, limit } from "../../firebase";
import type { Sale, BrokerSplit, Comissao } from "../../types";
import { LancamentoPlanejado, OrigemVinculo, planejarVenda, planejarLocacao, vendaNoFinanceiroNovo, locacaoNoFinanceiroNovo } from "./vinculos";

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const cacheCategorias = new Map<string, string>();

async function categoriaId(companyId: string, nome: string, tipo: "RECEITA" | "DESPESA"): Promise<string> {
  const k = `${companyId}|${nome}`;
  if (cacheCategorias.has(k)) return cacheCategorias.get(k)!;
  const snap = await getDocs(query(collection(db, "financial_categories"), where("companyId", "==", companyId), where("name", "==", nome)));
  let id: string;
  if (!snap.empty) {
    id = snap.docs[0].id;
  } else {
    id = `cat_${tipo.toLowerCase()}_${nome.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "_").toLowerCase()}`;
    await setDoc(doc(db, "financial_categories", id), {
      companyId, name: nome, nome, type: tipo,
      natureza: tipo === "RECEITA" ? "entrada" : "saida",
      grupo: nome.includes("Locação") ? "locacao" : "caixa",
      origem: nome.includes("Locação") ? "locacao" : "venda",
      comportamento: "variavel",
      group: tipo === "RECEITA" ? "Receitas" : "Comissões",
      color: tipo === "RECEITA" ? "#2563eb" : "#e11d48", icon: "Tag",
      isDefault: true, createdAt: new Date().toISOString()
    });
  }
  cacheCategorias.set(k, id);
  return id;
}

async function contaPadrao(companyId: string): Promise<string> {
  const snap = await getDocs(query(collection(db, "bank_accounts"), where("companyId", "==", companyId), limit(20)));
  const corrente = snap.docs.find(d => (d.data() as any).accountType !== "CREDITO");
  return corrente?.id || "sem_conta";
}

export interface ResultadoSincronizacao {
  criados: number;
  atualizados: number;
  removidos: number;
  cancelados: number;
  divergentes: number;
}

async function aplicar(companyId: string, origem: OrigemVinculo, refId: string, planejados: LancamentoPlanejado[]): Promise<ResultadoSincronizacao> {
  const res: ResultadoSincronizacao = { criados: 0, atualizados: 0, removidos: 0, cancelados: 0, divergentes: 0 };
  const agora = new Date().toISOString();

  const existentesSnap = await getDocs(query(
    collection(db, "financial_transactions"),
    where("companyId", "==", companyId),
    where("vinculoRef", "==", `${origem}:${refId}`)
  ));
  const existentes = new Map<string, any>();
  existentesSnap.docs.forEach(d => existentes.set(d.id, d.data() as any));

  let conta: string | null = null;

  for (const p of planejados) {
    const atual = existentes.get(p.id) ?? (await getDoc(doc(db, "financial_transactions", p.id)).then(s => (s.exists() ? s.data() : undefined)));
    existentes.delete(p.id);

    if (atual?.status === "CONCILIADO") {
      const mudou = Math.abs(Math.abs(atual.amount) - p.amount) > 0.009 || atual.vinculoDivergente;
      if (mudou && !atual.vinculoDivergente) {
        await updateDoc(doc(db, "financial_transactions", p.id), {
          vinculoDivergente: `Valor na origem mudou para ${p.amount.toFixed(2)} depois da conciliação (${agora.slice(0, 10)})`
        });
        res.divergentes++;
      }
      continue;
    }

    const valor = p.type === "DESPESA" ? -Math.abs(p.amount) : Math.abs(p.amount);
    const comum = {
      companyId,
      date: p.date,
      description: p.description,
      amount: valor,
      type: p.type,
      status: p.status,
      origin: "AUTOMATICO",
      commissionRef: p.refId,
      vinculo: { origem: p.origem, refId: p.refId, chave: p.chave, pessoa: p.pessoa || "" },
      vinculoRef: `${p.origem}:${p.refId}`, // campo simples para busca
      atualizadoEm: agora
    };

    if (atual) {
      const iguais = atual.date === comum.date && atual.description === comum.description &&
        Math.abs((atual.amount || 0) - valor) < 0.009 && atual.status === comum.status && atual.type === comum.type;
      if (!iguais) {
        await updateDoc(doc(db, "financial_transactions", p.id), comum);
        res.atualizados++;
      }
    } else {
      if (!p.accountId && conta === null) conta = await contaPadrao(companyId);
      await setDoc(doc(db, "financial_transactions", p.id), {
        ...comum,
        accountId: p.accountId || conta,
        categoryId: await categoriaId(companyId, p.categoryName, p.type),
        categoryName: p.categoryName,
        createdAt: agora
      });
      res.criados++;
    }
  }

  // O que sobrou existia antes e não existe mais na origem.
  for (const [id, data] of existentes) {
    if (data.status === "CONCILIADO") {
      if (!data.vinculoDivergente) {
        await updateDoc(doc(db, "financial_transactions", id), {
          vinculoDivergente: `Removido na origem depois da conciliação (${agora.slice(0, 10)})`
        });
        res.divergentes++;
      }
    } else if (data.status === "AGENDADO") {
      await deleteDoc(doc(db, "financial_transactions", id));
      res.removidos++;
    } else if (data.status !== "CANCELADO") {
      await updateDoc(doc(db, "financial_transactions", id), {
        status: "CANCELADO",
        notes: `${data.notes ? data.notes + " · " : ""}Cancelado automaticamente: removido na origem em ${agora.slice(0, 10)}`,
        atualizadoEm: agora
      });
      res.cancelados++;
    }
  }
  return res;
}

/** Sincroniza uma venda. Busca a venda e os splits direto do banco. */
export async function sincronizarVenda(saleId: string, companyId: string): Promise<ResultadoSincronizacao | null> {
  try {
    const s = await getDoc(doc(db, "sales", saleId));
    const sale = s.exists() ? ({ id: saleId, ...(s.data() as any) } as Sale) : null;
    // Venda apagada: planejado vazio → previsões saem e o que já aconteceu fica cancelado.
    if (sale && !vendaNoFinanceiroNovo(sale)) return null;
    const splitsSnap = sale ? await getDocs(query(collection(db, "broker_splits"), where("sale_id", "==", saleId))) : null;
    const splits = splitsSnap ? splitsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as BrokerSplit) : [];
    const planejados = sale ? planejarVenda(sale, splits, hojeISO()) : [];
    return await aplicar(companyId, "venda", saleId, planejados);
  } catch (err) {
    console.warn("[financeiro] não foi possível sincronizar a venda", saleId, err);
    return null;
  }
}

/** Sincroniza uma comissão de locação. Recebe o documento já salvo (ou null se foi apagado). */
export async function sincronizarLocacao(comissaoId: string, companyId: string, comissao: Comissao | null): Promise<ResultadoSincronizacao | null> {
  try {
    if (comissao && !locacaoNoFinanceiroNovo(comissao)) return null;
    const planejados = comissao ? planejarLocacao({ ...comissao, id: comissaoId }, hojeISO()) : [];
    return await aplicar(companyId, "locacao", comissaoId, planejados);
  } catch (err) {
    console.warn("[financeiro] não foi possível sincronizar a locação", comissaoId, err);
    return null;
  }
}
