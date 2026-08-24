import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Carregar configuração do Firebase
const configPath = path.resolve('firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export async function runFullAudit() {
  console.log('================================================================');
  console.log('     AUDITORIA DETALHADA: CARTÃO CRESOL E CONTAS FINANCEIRAS    ');
  console.log('================================================================\n');

  // 1. Localizar TODAS as contas bancárias para diferenciar Corrente vs Cartão
  const accountsSnap = await getDocs(collection(db, 'bank_accounts'));
  const allAccounts: any[] = [];
  accountsSnap.forEach(doc => {
    allAccounts.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Contas cadastradas (${allAccounts.length}):`);
  allAccounts.forEach(a => {
    console.log(`- [${a.accountType || 'CORRENTE'}] "${a.name}" (ID: ${a.id}, Fechamento: dia ${a.closingDay || 'N/A'}, Vencimento: dia ${a.dueDay || 'N/A'})`);
  });

  // Localizar especificamente a conta do CARTÃO CRESOL
  const cardCresolAccount = allAccounts.find(a => 
    (a.accountType === 'CREDITO' || a.name.toLowerCase().includes('cartão') || a.name.toLowerCase().includes('cartao')) &&
    a.name.toLowerCase().includes('cresol')
  ) || allAccounts.find(a => a.accountType === 'CREDITO');

  // Localizar a conta corrente Cresol
  const checkingCresolAccount = allAccounts.find(a => 
    a.accountType !== 'CREDITO' && !a.name.toLowerCase().includes('cartão') && a.name.toLowerCase().includes('cresol')
  );

  console.log('\n--- IDENTIFICAÇÃO DAS CONTAS ---');
  console.log(`Cartão de Crédito Cresol: ${cardCresolAccount ? `"${cardCresolAccount.name}" (ID: ${cardCresolAccount.id})` : 'NÃO ENCONTRADO'}`);
  console.log(`Conta Corrente Cresol: ${checkingCresolAccount ? `"${checkingCresolAccount.name}" (ID: ${checkingCresolAccount.id})` : 'NÃO ENCONTRADO'}`);

  // =========================================================================
  // TAREFA 1: Lançamentos reais do CARTÃO CRESOL em Julho/2026
  // =========================================================================
  if (cardCresolAccount) {
    console.log('\n=================================================================');
    console.log(`TAREFA 1: Lançamentos do Cartão Cresol (${cardCresolAccount.name}) em Julho/2026`);
    console.log('=================================================================');

    const cardTxSnap = await getDocs(query(
      collection(db, 'financial_transactions'),
      where('accountId', '==', cardCresolAccount.id)
    ));

    const cardJulyTxs: any[] = [];
    cardTxSnap.forEach(doc => {
      const data = doc.data();
      if (data.date && data.date >= '2026-07-01' && data.date <= '2026-07-31') {
        cardJulyTxs.push({ id: doc.id, ...data });
      }
    });

    cardJulyTxs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    console.log(`Total de transações encontradas com data em Julho/2026 no Cartão: ${cardJulyTxs.length}`);

    let match202607 = 0;
    let divergentCount = 0;
    const divergentList: any[] = [];

    cardJulyTxs.forEach((tx, idx) => {
      const amt = Math.abs(tx.amount || 0);
      const ccMonth = tx.creditCardMonth;
      const isMatch = ccMonth === '2026-07';

      if (isMatch) {
        match202607++;
      } else {
        divergentCount++;
        divergentList.push({
          num: idx + 1,
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: amt,
          creditCardMonth: ccMonth || '(ausente)',
          creditCardStatus: tx.creditCardStatus || '(ausente)',
          movedFromMonth: tx.movedFromMonth || null
        });
      }

      console.log(
        `#${String(idx + 1).padStart(2, '0')} | Data: ${tx.date} | Valor: R$ ${amt.toFixed(2).padStart(8, ' ')} | creditCardMonth: ${(ccMonth || 'AUSENTE').padEnd(8, ' ')} | Status: ${(tx.creditCardStatus || 'N/A').padEnd(14, ' ')} | Desc: ${tx.description}`
      );
    });

    console.log('\n--- RESUMO TAREFA 1 ---');
    console.log(`Total de lançamentos em Julho/2026: ${cardJulyTxs.length}`);
    console.log(`Lançamentos com creditCardMonth == "2026-07": ${match202607}`);
    console.log(`Lançamentos com creditCardMonth diferente ou ausente: ${divergentCount}`);
    if (divergentList.length > 0) {
      console.log('Detalhes dos divergentes:', JSON.stringify(divergentList, null, 2));
    }
  }

  // =========================================================================
  // TAREFA 2: Investigar os 5 lançamentos na conta corrente "Cresol"
  // (MATERIAL OBRA FIDELITE, 180 SEGUROS, BMB *Allrede, PLACAS E PAINEIS, JOÃO CAMBOTA)
  // =========================================================================
  console.log('\n=================================================================');
  console.log('TAREFA 2: Verificação dos 5 lançamentos na Conta Corrente');
  console.log('=================================================================');

  const allTxSnap = await getDocs(collection(db, 'financial_transactions'));
  const allTxs: any[] = [];
  allTxSnap.forEach(doc => {
    allTxs.push({ id: doc.id, ...doc.data() });
  });

  const targetKeywords = [
    'MATERIAL OBRA FIDELITE',
    '180 SEGUROS',
    'BMB *ALLREDE',
    'PLACAS E PAINEIS',
    'JOÃO CAMBOTA',
    'JOAO CAMBOTA'
  ];

  const found5Txs = allTxs.filter(t => {
    const desc = (t.description || '').toUpperCase();
    return targetKeywords.some(kw => desc.includes(kw));
  });

  console.log(`Lançamentos correspondentes encontrados em todo o banco: ${found5Txs.length}`);
  found5Txs.forEach((tx, idx) => {
    const acc = allAccounts.find(a => a.id === tx.accountId);
    console.log(`\n[Item ${idx + 1}] ID: ${tx.id}`);
    console.log(`  Descrição: ${tx.description}`);
    console.log(`  Data: ${tx.date}`);
    console.log(`  Valor: R$ ${Math.abs(tx.amount || 0).toFixed(2)} (${tx.type})`);
    console.log(`  Conta Atual: "${acc?.name || 'N/A'}" (ID: ${tx.accountId}, Tipo: ${acc?.accountType || 'CORRENTE'})`);
    console.log(`  creditCardMonth: ${tx.creditCardMonth || '(NÃO DEFINIDO - NUNCA MIGRADO)'}`);
    console.log(`  creditCardStatus: ${tx.creditCardStatus || '(NÃO DEFINIDO)'}`);
    console.log(`  Status: ${tx.status}`);
  });

  // =========================================================================
  // TAREFA 3: Investigar lançamento "MANUTENÇÃO /CASAS DE ALUGUEIS"
  // =========================================================================
  console.log('\n=================================================================');
  console.log('TAREFA 3: Rastreamento de "MANUTENÇÃO /CASAS DE ALUGUEIS"');
  console.log('=================================================================');

  const manutencaoTxs = allTxs.filter(t => 
    (t.description || '').toUpperCase().includes('MANUTENÇÃO /CASAS') ||
    (t.description || '').toUpperCase().includes('MANUTENCAO /CASAS') ||
    (t.description || '').toUpperCase().includes('CASAS DE ALUGUEIS')
  ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  console.log(`Total de ocorrências de "MANUTENÇÃO /CASAS DE ALUGUEIS" encontradas: ${manutencaoTxs.length}`);
  manutencaoTxs.forEach((tx, idx) => {
    const acc = allAccounts.find(a => a.id === tx.accountId);
    console.log(`\n[Ocorrência ${idx + 1}] ID: ${tx.id}`);
    console.log(`  Data: ${tx.date}`);
    console.log(`  Descrição: ${tx.description}`);
    console.log(`  Valor: R$ ${Math.abs(tx.amount || 0).toFixed(2)}`);
    console.log(`  Conta: "${acc?.name || 'N/A'}" (ID: ${tx.accountId})`);
    console.log(`  creditCardMonth atual: ${tx.creditCardMonth || 'N/A'}`);
    console.log(`  movedFromMonth: ${tx.movedFromMonth || 'N/A'}`);
    console.log(`  movedAt: ${tx.movedAt || 'N/A'}`);
    console.log(`  movedHistory: ${JSON.stringify(tx.movedHistory || [], null, 2)}`);
    console.log(`  recurrenceGroupId: ${tx.recurrenceGroupId || 'N/A'}`);
  });

  console.log('\n=================================================================');
  console.log('                       FIM DA AUDITORIA                          ');
  console.log('=================================================================\n');
}

runFullAudit().catch(err => console.error('Erro na auditoria:', err));
