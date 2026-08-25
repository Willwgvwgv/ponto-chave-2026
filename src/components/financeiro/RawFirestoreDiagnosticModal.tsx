import React, { useState, useMemo } from 'react';
import { BankAccount, FinancialTransaction } from '../../types';
import { Terminal, Copy, Check, X, ShieldAlert, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';

interface RawFirestoreDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  transactions: FinancialTransaction[];
}

export const RawFirestoreDiagnosticModal: React.FC<RawFirestoreDiagnosticModalProps> = ({
  isOpen,
  onClose,
  accounts,
  transactions
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'cresol_account' | 'marketing_180seguros' | 'five_txs' | 'july_card' | 'manutencao' | 'all_accounts'>('marketing_180seguros');

  // 1. Identificar Contas Cresol (Cartão e Corrente)
  const cresolCardAccount = useMemo(() => {
    return accounts.find(a => 
      (a.accountType === 'CREDITO' || (a.name || '').toLowerCase().includes('cart') || (a.name || '').toLowerCase().includes('crédito')) &&
      (a.name || '').toLowerCase().includes('cresol')
    ) || accounts.find(a => a.accountType === 'CREDITO');
  }, [accounts]);

  const cresolCheckingAccount = useMemo(() => {
    return accounts.find(a => 
      a.accountType !== 'CREDITO' && 
      !(a.name || '').toLowerCase().includes('cart') && 
      (a.name || '').toLowerCase().includes('cresol')
    );
  }, [accounts]);

  // 2. Localizar os 5 lançamentos específicos
  const targetKeywords = [
    'MATERIAL OBRA FIDELITE',
    '180 SEGUROS',
    'BMB *ALLREDE',
    'PLACAS E PAINEIS',
    'JOÃO CAMBOTA',
    'JOAO CAMBOTA'
  ];

  const fiveTransactions = useMemo(() => {
    return transactions.filter(t => {
      const desc = (t.description || '').toUpperCase();
      return targetKeywords.some(kw => desc.includes(kw));
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [transactions]);

  // 3. Transações de Julho/2026 na conta do Cartão Cresol
  const cardJulyTransactions = useMemo(() => {
    if (!cresolCardAccount) return [];
    return transactions.filter(t => 
      t.accountId === cresolCardAccount.id &&
      t.date && t.date >= '2026-07-01' && t.date <= '2026-07-31'
    ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [transactions, cresolCardAccount]);

  // 4. Lançamentos de Manutenção / Casas de Alugueis
  const manutencaoTransactions = useMemo(() => {
    return transactions.filter(t => 
      (t.description || '').toUpperCase().includes('MANUTENÇÃO /CASAS') ||
      (t.description || '').toUpperCase().includes('MANUTENCAO /CASAS') ||
      (t.description || '').toUpperCase().includes('CASAS DE ALUGUEIS')
    ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [transactions]);

  // 5. Diagnóstico Específico: Marketing Digital & As 3 Séries de 180 Seguros
  const marketingTransactions = useMemo(() => {
    return transactions.filter(t => {
      const desc = (t.description || '').toUpperCase();
      return desc.includes('MARKETING DIGITAL') || desc.includes('MJ MARKETING') || desc.includes('MJ MARKETING DIGI') || desc.includes('ZP*MJ');
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [transactions]);

  const seg180TargetRecurrenceIds = [
    'rec_1787162941027_r66qa0vyy',
    'rec_1787163098108_2p68mzxwq',
    'rec_1787163007219_3gff31ws8'
  ];

  const seg180Transactions = useMemo(() => {
    return transactions.filter(t => {
      const desc = (t.description || '').toUpperCase();
      const is180Desc = desc.includes('180 SEGUROS') || desc.includes('180SEGUROS') || desc.includes('VINDI *180') || desc.includes('180SEGURO');
      const isTargetRec = t.recurrenceGroupId && seg180TargetRecurrenceIds.includes(t.recurrenceGroupId);
      if (!is180Desc && !isTargetRec) return false;

      const ccMonth = t.creditCardMonth || (t.date ? t.date.substring(0, 7) : '');
      return ccMonth >= '2026-06' && ccMonth <= '2026-10';
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [transactions]);

  if (!isOpen) return null;

  const copyData = (key: string, data: any) => {
    navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    setCopiedKey(key);
    toast.success("JSON copiado para a área de transferência!");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const copyFullReport = () => {
    const fullReport = {
      _metadata: {
        generatedAt: new Date().toISOString(),
        totalAccountsInState: accounts.length,
        totalTransactionsInState: transactions.length
      },
      cresolAccounts: {
        cardAccount: cresolCardAccount || null,
        checkingAccount: cresolCheckingAccount || null
      },
      task4_marketingDigital: marketingTransactions,
      task4_seg180Series: {
        total: seg180Transactions.length,
        items: seg180Transactions
      },
      task2_fiveTransactions: fiveTransactions,
      task1_cardJulyTransactions: {
        total: cardJulyTransactions.length,
        items: cardJulyTransactions
      },
      task3_manutencaoTransactions: manutencaoTransactions,
      allAccountsRaw: accounts
    };
    copyData('full_report', fullReport);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative bg-slate-900 text-slate-100 w-full max-w-5xl h-[90vh] rounded-[24px] shadow-2xl border border-slate-800 flex flex-col overflow-hidden font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span>Diagnóstico Firestore (Dados Brutos Reais)</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md text-[10px] font-mono">
                  Sessão Autenticada
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Somente Leitura • Visualização 1:1 dos documentos JSON recebidos do Firestore
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyFullReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              {copiedKey === 'full_report' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'full_report' ? 'Copiado!' : 'Copiar Tudo (JSON)'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Fechar Diagnóstico"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-navegação */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveView('marketing_180seguros')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeView === 'marketing_180seguros'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            ★ Marketing & 180 Seguros ({marketingTransactions.length + seg180Transactions.length})
          </button>
          <button
            onClick={() => setActiveView('cresol_account')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeView === 'cresol_account'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            1. Conta Cartão Cresol ({cresolCardAccount ? 'Encontrada' : 'Ausente'})
          </button>
          <button
            onClick={() => setActiveView('five_txs')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeView === 'five_txs'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            2. Os 5 Lançamentos ({fiveTransactions.length})
          </button>
          <button
            onClick={() => setActiveView('july_card')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeView === 'july_card'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            3. Julho/2026 Cartão ({cardJulyTransactions.length})
          </button>
          <button
            onClick={() => setActiveView('manutencao')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeView === 'manutencao'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            4. Manutenção Casas ({manutencaoTransactions.length})
          </button>
          <button
            onClick={() => setActiveView('all_accounts')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeView === 'all_accounts'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            5. Todas Contas ({accounts.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* VIEW 0: Marketing Digital & 180 Seguros */}
          {activeView === 'marketing_180seguros' && (
            <div className="space-y-6">
              {/* SEÇÃO 1: Marketing Digital */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                      1. MARKETING DIGITAL ({marketingTransactions.length} encontrados)
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Todos os documentos contendo "MARKETING DIGITAL" / "MJ MARKETING"
                    </p>
                  </div>
                  <button
                    onClick={() => copyData('marketing_all', marketingTransactions)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'marketing_all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar Marketing (JSON)</span>
                  </button>
                </div>

                {marketingTransactions.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono py-2">Nenhum documento encontrado com a descrição MARKETING DIGITAL.</p>
                ) : (
                  <div className="space-y-3">
                    {marketingTransactions.map((tx, idx) => (
                      <div key={tx.id} className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300">#{idx + 1} - {tx.description}</span>
                          <span className="text-slate-400 text-[11px]">ID: {tx.id}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                          <div><span className="text-slate-500 block">date</span>{tx.date}</div>
                          <div><span className="text-slate-500 block">amount</span>R$ {tx.amount}</div>
                          <div><span className="text-slate-500 block">creditCardMonth</span><strong className="text-emerald-400">{tx.creditCardMonth || '(null)'}</strong></div>
                          <div><span className="text-slate-500 block">movedFromMonth</span>{tx.movedFromMonth || '(null)'}</div>
                        </div>
                        <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 overflow-x-auto">
                          {JSON.stringify({
                            id: tx.id,
                            description: tx.description,
                            amount: tx.amount,
                            date: tx.date,
                            creditCardMonth: tx.creditCardMonth,
                            movedFromMonth: tx.movedFromMonth,
                            movedAt: tx.movedAt,
                            movedHistory: tx.movedHistory,
                            recurrenceGroupId: tx.recurrenceGroupId,
                            status: tx.status,
                            creditCardStatus: tx.creditCardStatus
                          }, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SEÇÃO 2: As 3 Séries de 180 Seguros */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                      2. As 3 Séries "180 SEGUROS" ({seg180Transactions.length} ocorrências entre 2026-06 e 2026-10)
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Séries rec_1787162941027_r66qa0vyy, rec_1787163098108_2p68mzxwq, rec_1787163007219_3gff31ws8
                    </p>
                  </div>
                  <button
                    onClick={() => copyData('seg180_all', seg180Transactions)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'seg180_all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar 180 Seguros (JSON)</span>
                  </button>
                </div>

                {seg180Transactions.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono py-2">Nenhuma ocorrência encontrada para 180 Seguros no período.</p>
                ) : (
                  <div className="space-y-3">
                    {seg180Transactions.map((tx, idx) => (
                      <div key={tx.id} className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-300">#{idx + 1} - {tx.description} (R$ {tx.amount})</span>
                          <span className="text-slate-400 text-[11px]">ID: {tx.id}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                          <div><span className="text-slate-500 block">recurrenceGroupId</span><strong className="text-amber-400">{tx.recurrenceGroupId || '(null)'}</strong></div>
                          <div><span className="text-slate-500 block">date</span>{tx.date}</div>
                          <div><span className="text-slate-500 block">creditCardMonth</span><strong className="text-emerald-400">{tx.creditCardMonth || '(null)'}</strong></div>
                          <div><span className="text-slate-500 block">movedFromMonth</span>{tx.movedFromMonth || '(null)'}</div>
                        </div>
                        <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-300 overflow-x-auto">
                          {JSON.stringify({
                            id: tx.id,
                            recurrenceGroupId: tx.recurrenceGroupId,
                            description: tx.description,
                            amount: tx.amount,
                            date: tx.date,
                            creditCardMonth: tx.creditCardMonth,
                            movedFromMonth: tx.movedFromMonth,
                            movedAt: tx.movedAt,
                            movedHistory: tx.movedHistory,
                            status: tx.status,
                            creditCardStatus: tx.creditCardStatus
                          }, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 1: Conta Cartão Cresol */}
          {activeView === 'cresol_account' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                    Documento Bruto: Conta Cartão Cresol (bank_accounts)
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Verificação direta dos campos `closingDay`, `dueDay`, `name`, `id` e `accountType`.
                  </p>
                </div>
                {cresolCardAccount && (
                  <button
                    onClick={() => copyData('card_account', cresolCardAccount)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                  >
                    {copiedKey === 'card_account' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar JSON</span>
                  </button>
                )}
              </div>

              {cresolCardAccount ? (
                <div className="space-y-3">
                  {/* Destaque dos campos críticos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">closingDay (Fechamento)</span>
                      <span className="text-lg font-mono font-black text-amber-400">
                        {cresolCardAccount.closingDay !== undefined ? String(cresolCardAccount.closingDay) : '(não definido)'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">dueDay (Vencimento)</span>
                      <span className="text-lg font-mono font-black text-emerald-400">
                        {cresolCardAccount.dueDay !== undefined ? String(cresolCardAccount.dueDay) : '(não definido)'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">accountType</span>
                      <span className="text-sm font-mono font-black text-blue-400">
                        {cresolCardAccount.accountType || '(não definido)'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">name</span>
                      <span className="text-sm font-mono font-black text-slate-200 truncate block" title={cresolCardAccount.name}>
                        {cresolCardAccount.name}
                      </span>
                    </div>
                  </div>

                  {/* JSON Raw */}
                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
                    {JSON.stringify(cresolCardAccount, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950 border border-rose-900/40 rounded-xl text-rose-400 font-mono text-xs">
                  Nenhuma conta com nome "Cresol" e tipo Cartão de Crédito foi encontrada no estado carregado.
                </div>
              )}

              {/* Conta Corrente Cresol para comparação */}
              {cresolCheckingAccount && (
                <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-slate-300 font-mono uppercase">
                      Conta Corrente Cresol (Para Comparação):
                    </h5>
                    <button
                      onClick={() => copyData('checking_account', cresolCheckingAccount)}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                    >
                      {copiedKey === 'checking_account' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-blue-300 overflow-x-auto">
                    {JSON.stringify(cresolCheckingAccount, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: Os 5 Lançamentos */}
          {activeView === 'five_txs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                    Documentos Brutos: Os 5 Lançamentos Buscados ({fiveTransactions.length} encontrados)
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Exibição sem filtros de: MATERIAL OBRA FIDELITE, 180 SEGUROS, BMB *ALLREDE, PLACAS E PAINEIS, JOÃO CAMBOTA.
                  </p>
                </div>
                <button
                  onClick={() => copyData('five_txs', fiveTransactions)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'five_txs' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar Todos os 5 JSONs</span>
                </button>
              </div>

              {fiveTransactions.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-mono text-xs">
                  Nenhuma transação encontrada com os termos buscados nas descrições.
                </div>
              ) : (
                <div className="space-y-4">
                  {fiveTransactions.map((tx, idx) => {
                    const acc = accounts.find(a => a.id === tx.accountId);
                    return (
                      <div key={tx.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-mono font-bold text-xs rounded">
                              #{idx + 1}
                            </span>
                            <span className="font-mono font-bold text-slate-100 text-xs">
                              {tx.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">
                              Conta: <strong className="text-slate-200">{acc?.name || tx.accountId}</strong>
                            </span>
                            <button
                              onClick={() => copyData(`tx_${tx.id}`, tx)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all cursor-pointer"
                              title="Copiar JSON deste lançamento"
                            >
                              {copiedKey === `tx_${tx.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-slate-500 text-[10px] block">amount (Valor)</span>
                            <span className="text-emerald-400 font-bold">
                              R$ {Math.abs(tx.amount || 0).toFixed(2)} ({tx.amount})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">date (Data)</span>
                            <span className="text-slate-300 font-bold">{tx.date}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">creditCardMonth</span>
                            <span className={tx.creditCardMonth ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                              {tx.creditCardMonth || '(undefined / null)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">status</span>
                            <span className="text-blue-400 font-bold">{tx.status}</span>
                          </div>
                        </div>

                        <pre className="p-3 bg-slate-900 border border-slate-800/60 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
                          {JSON.stringify(tx, null, 2)}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: Julho/2026 Cartão Cresol */}
          {activeView === 'july_card' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                    Lançamentos do Cartão Cresol em Julho/2026 ({cardJulyTransactions.length} itens)
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    accountId === "{cresolCardAccount?.id}" e date entre 2026-07-01 e 2026-07-31
                  </p>
                </div>
                <button
                  onClick={() => copyData('card_july', cardJulyTransactions)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'card_july' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar Lista (JSON)</span>
                </button>
              </div>

              {cardJulyTransactions.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-mono text-xs">
                  Nenhum lançamento encontrado em Julho/2026 com o accountId do Cartão Cresol.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                        <th className="py-2.5 px-3 text-center">#</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3 text-center">creditCardMonth</th>
                        <th className="py-2.5 px-3 text-center">creditCardStatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {cardJulyTransactions.map((tx, idx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-300">{tx.date}</td>
                          <td className="py-2 px-3 text-slate-200 max-w-[240px] truncate" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-400">
                            R$ {Math.abs(tx.amount || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.creditCardMonth === '2026-07' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {tx.creditCardMonth || '(nulo)'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-[10px] text-slate-400">
                            {tx.creditCardStatus || '(nulo)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: Manutenção / Casas de Alugueis */}
          {activeView === 'manutencao' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                    Ocorrências de "MANUTENÇÃO /CASAS DE ALUGUEIS" ({manutencaoTransactions.length} itens)
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Documentos completos com histórico de movimentação (`movedFromMonth`, `movedHistory`, `movedAt`).
                  </p>
                </div>
                <button
                  onClick={() => copyData('manutencao_all', manutencaoTransactions)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'manutencao_all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar Todas (JSON)</span>
                </button>
              </div>

              <div className="space-y-4">
                {manutencaoTransactions.map((tx, idx) => (
                  <div key={tx.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold rounded">
                          Item #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-200">Data: {tx.date} | Valor: R$ {Math.abs(tx.amount || 0).toFixed(2)}</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">ID: {tx.id}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block">creditCardMonth</span>
                        <span className="text-amber-400 font-bold">{tx.creditCardMonth || '(não definido)'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">movedFromMonth</span>
                        <span className="text-emerald-400 font-bold">{tx.movedFromMonth || '(não definido)'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">movedAt</span>
                        <span className="text-slate-300">{tx.movedAt || '(não definido)'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">recurrenceGroupId</span>
                        <span className="text-blue-400 truncate block">{tx.recurrenceGroupId || '(não definido)'}</span>
                      </div>
                    </div>

                    <pre className="p-3 bg-slate-900 border border-slate-800/60 rounded-lg text-[11px] text-slate-300 overflow-x-auto">
                      {JSON.stringify(tx, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 5: Todas as Contas */}
          {activeView === 'all_accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-amber-400 font-mono uppercase">
                    Todas as Contas Bancárias no Estado ({accounts.length} contas)
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Documentos brutos da coleção `bank_accounts`.
                  </p>
                </div>
                <button
                  onClick={() => copyData('all_accs', accounts)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700 cursor-pointer"
                >
                  {copiedKey === 'all_accs' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar Todas (JSON)</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                {JSON.stringify(accounts, null, 2)}
              </pre>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between font-mono text-xs text-slate-400">
          <span>Modo Somente Leitura • Nenhuma alteração é gravada no banco</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
