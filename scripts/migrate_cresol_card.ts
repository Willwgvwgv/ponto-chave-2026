import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let saStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
if (!saStr.trim().startsWith('{')) saStr = '{' + saStr;
if (!saStr.trim().endsWith('}')) saStr = saStr + '}';
const sa = JSON.parse(saStr);

const cleanStr = (val: any): string => {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/[\r\n\s\t'",]/g, '');
};

const databaseId = cleanStr(process.env.VITE_FIREBASE_DATABASE_ID) || "ai-studio-44ae2ba8-8a58-4205-8f05-6b2cdd615644";

if (getApps().length === 0) {
  initializeApp({
    credential: cert(sa),
    projectId: sa.project_id
  });
}

const db = getFirestore(databaseId);

export function getCardStatementMonth(dateStr: string, closingDay: number = 10): string {
  const parts = dateStr.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (day > closingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export function getInitialCreditCardStatus(dateStr: string, closingDay: number = 10): 'FATURA_ABERTA' | 'FATURA_FECHADA' {
  const statementYm = getCardStatementMonth(dateStr, closingDay);
  const [stmtY, stmtM] = statementYm.split('-').map(Number);
  const closingDate = new Date(stmtY, stmtM - 1, closingDay, 23, 59, 59);
  const today = new Date();
  return today > closingDate ? 'FATURA_FECHADA' : 'FATURA_ABERTA';
}

async function run(execute: boolean = false) {
  console.log(`\n================================================================`);
  console.log(`INVESTIGAÇÃO DE CAMINHOS E MIGRAÇÃO CRESOL -> CARTÃO CRESOL`);
  console.log(`Modo: ${execute ? 'EXECUÇÃO REAL' : 'SIMULAÇÃO / DIAGNÓSTICO (DRY-RUN)'}`);
  console.log(`================================================================`);

  const companyId = "company";
  console.log(`\n--- 1. CONTAGEM POR CAMINHOS NO FIRESTORE (Database: ${databaseId}) ---`);

  // 1.1 Raiz
  const rootAccSnap = await db.collection("bank_accounts").get();
  const rootTxSnap = await db.collection("financial_transactions").get();
  const rootCatSnap = await db.collection("financial_categories").get();
  console.log(`[RAIZ] bank_accounts: ${rootAccSnap.size} documentos`);
  console.log(`[RAIZ] financial_transactions: ${rootTxSnap.size} documentos`);
  console.log(`[RAIZ] financial_categories: ${rootCatSnap.size} documentos`);

  // 1.2 Subcoleção dentro de companies/company
  const companyDocRef = db.collection("companies").doc(companyId);
  const subCols = await companyDocRef.listCollections();
  console.log(`[SUBCOLEÇÕES em companies/${companyId}]:`, subCols.map(s => s.id));

  const subAccSnap = await db.collection(`companies/${companyId}/bank_accounts`).get();
  const subTxSnap = await db.collection(`companies/${companyId}/financial_transactions`).get();
  const subCatSnap = await db.collection(`companies/${companyId}/financial_categories`).get();
  console.log(`[SUBCOLEÇÃO] companies/${companyId}/bank_accounts: ${subAccSnap.size} documentos`);
  console.log(`[SUBCOLEÇÃO] companies/${companyId}/financial_transactions: ${subTxSnap.size} documentos`);
  console.log(`[SUBCOLEÇÃO] companies/${companyId}/financial_categories: ${subCatSnap.size} documentos`);

  // 1.3 Collection Groups
  const cgAccSnap = await db.collectionGroup("bank_accounts").get();
  const cgTxSnap = await db.collectionGroup("financial_transactions").get();
  const cgCatSnap = await db.collectionGroup("financial_categories").get();
  console.log(`[COLLECTION GROUP] bank_accounts (global): ${cgAccSnap.size} documentos`);
  console.log(`[COLLECTION GROUP] financial_transactions (global): ${cgTxSnap.size} documentos`);
  console.log(`[COLLECTION GROUP] financial_categories (global): ${cgCatSnap.size} documentos`);

  // Determinar qual caminho contém dados
  let accounts: any[] = [];
  let transactions: any[] = [];
  let categories: any[] = [];
  let isSubcollection = false;

  if (subTxSnap.size > 0 || subAccSnap.size > 0) {
    console.log(`\n=> Usando estrutura de SUBCOLEÇÕES (companies/${companyId}/...)`);
    isSubcollection = true;
    subAccSnap.forEach(d => accounts.push({ id: d.id, ...d.data() }));
    subTxSnap.forEach(d => transactions.push({ id: d.id, ...d.data() }));
    subCatSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
  } else if (rootTxSnap.size > 0 || rootAccSnap.size > 0) {
    console.log(`\n=> Usando estrutura da RAIZ (collection/doc)`);
    rootAccSnap.forEach(d => accounts.push({ id: d.id, ...d.data() }));
    rootTxSnap.forEach(d => transactions.push({ id: d.id, ...d.data() }));
    rootCatSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
  } else if (cgTxSnap.size > 0) {
    console.log(`\n=> Usando documentos encontrados via COLLECTION GROUP`);
    cgAccSnap.forEach(d => accounts.push({ id: d.id, path: d.ref.path, ...d.data() }));
    cgTxSnap.forEach(d => transactions.push({ id: d.id, path: d.ref.path, ...d.data() }));
    cgCatSnap.forEach(d => categories.push({ id: d.id, path: d.ref.path, ...d.data() }));
  } else {
    console.log(`\n=> NENHUM documento financeiro encontrado em nenhum dos caminhos (Raiz, Subcoleção ou Collection Group).`);
  }

  // Análise das Contas
  const cresolCC = accounts.find(a => a.name?.toLowerCase().includes("cresol") && a.accountType !== 'CREDITO');
  const cresolCartao = accounts.find(a => a.name?.toLowerCase().includes("cresol") && a.accountType === 'CREDITO');

  console.log(`\n--- 2. DETECÇÃO DE CONTAS ---`);
  console.log(`Conta Corrente Cresol: ${cresolCC ? `"${cresolCC.name}" (ID: ${cresolCC.id})` : 'Não encontrada'}`);
  console.log(`Conta Cartão Cresol: ${cresolCartao ? `"${cresolCartao.name}" (ID: ${cresolCartao.id})` : 'Não encontrada'}`);

  const targetKeywords = [
    "180 SEGUROS",
    "CELULARES",
    "CRECI FIDELITE",
    "MARKETING DIGITAL",
    "MJ MARKETING",
    "DEFINIR A COMPRA - MILENAR",
    "AMAZOM MUSIC",
    "MATERIAL OBRA FIDELITE"
  ];

  const matched = transactions.filter(t => {
    const descUpper = (t.description || "").toUpperCase();
    return targetKeywords.some(kw => descUpper.includes(kw));
  });

  console.log(`\n--- 3. DETECÇÃO DE LANÇAMENTOS ALVO ---`);
  console.log(`Total de lançamentos correspondentes encontrados: ${matched.length}`);

  if (execute && matched.length > 0) {
    console.log("\nExecutando migração no caminho identificado...");
    // Ação real quando existirem registros
  }
}

const isExecute = process.argv.includes('--execute');
run(isExecute).catch(console.error);
