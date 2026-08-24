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

async function runAudit() {
  console.log('--- INICIANDO AUDITORIA DO CARTÃO CRESOL (JULHO/2026) ---');
  
  // 1. Localizar conta Cartão Cresol
  const accountsSnap = await getDocs(collection(db, 'bank_accounts'));
  let cresolAccount: any = null;
  accountsSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && (data.name.toLowerCase().includes('cresol') || data.name.toLowerCase().includes('cartao cresol'))) {
      cresolAccount = { id: doc.id, ...data };
    }
  });

  if (!cresolAccount) {
    console.log('Contas encontradas no banco:', accountsSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
    console.error('Conta Cartão Cresol não localizada!');
    return;
  }

  console.log(`Conta encontrada: ${cresolAccount.name} (ID: ${cresolAccount.id})`);

  // 2. Buscar transações da conta
  const txSnap = await getDocs(query(
    collection(db, 'financial_transactions'),
    where('accountId', '==', cresolAccount.id)
  ));

  const julyTxs: any[] = [];
  txSnap.forEach(doc => {
    const data = doc.data();
    if (data.date && data.date >= '2026-07-01' && data.date <= '2026-07-31') {
      julyTxs.push({ id: doc.id, ...data });
    }
  });

  julyTxs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  console.log(`\nTotal de transações em Julho/2026: ${julyTxs.length}`);

  let match202607 = 0;
  let divergent = 0;
  const divergentList: any[] = [];

  julyTxs.forEach((tx, idx) => {
    const amt = Math.abs(tx.amount || 0);
    const ccMonth = tx.creditCardMonth;
    const isMatch = ccMonth === '2026-07';

    if (isMatch) {
      match202607++;
    } else {
      divergent++;
      divergentList.push({
        index: idx + 1,
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: amt,
        creditCardMonth: ccMonth || null,
        creditCardStatus: tx.creditCardStatus || null
      });
    }

    console.log(
      `#${idx + 1} | Data: ${tx.date} | Valor: R$ ${amt.toFixed(2)} | creditCardMonth: ${ccMonth ?? '(AUSENTE)'} | Status: ${tx.creditCardStatus ?? '(AUSENTE)'} | Desc: ${tx.description}`
    );
  });

  console.log('\n--- RESUMO DA AUDITORIA ---');
  console.log(`Total de lançamentos em Julho/2026: ${julyTxs.length}`);
  console.log(`Lançamentos com creditCardMonth == "2026-07": ${match202607}`);
  console.log(`Lançamentos com creditCardMonth diferente ou ausente: ${divergent}`);
  if (divergent > 0) {
    console.log('\nLançamentos divergentes/ausentes:');
    console.dir(divergentList, { depth: null });
  }
}

runAudit().catch(err => {
  console.error('Erro durante auditoria:', err);
});
