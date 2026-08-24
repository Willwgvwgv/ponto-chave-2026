import React, { useState, useMemo } from 'react';
import { FinancialTransaction, BankAccount } from '../../types';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface AuditCresolCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: FinancialTransaction[];
  accounts: BankAccount[];
}

export const AuditCresolCardModal: React.FC<AuditCresolCardModalProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts
}) => {
  const [copied, setCopied] = useState(false);

  // 1. Localizar conta do Cartão Cresol
  const cresolAccount = useMemo(() => {
    return accounts.find(a => 
      a.name.toLowerCase().includes('cresol') || 
      (a.name.toLowerCase().includes('cartão') && a.name.toLowerCase().includes('cresol'))
    );
  }, [accounts]);

  // 2. Filtrar transações de Julho/2026 pertencentes à conta do Cartão Cresol
  const auditData = useMemo(() => {
    if (!cresolAccount) {
      return {
        accountFound: false,
        account: null,
        totalTxs: 0,
        julyTxs: [] as any[],
        matchingCount: 0,
        divergentCount: 0,
        missingMonthCount: 0,
        divergentList: [] as any[],
        totalAmount: 0
      };
    }

    const accountId = cresolAccount.id;
    // Transações onde accountId é a conta do Cartão Cresol e data está entre 2026-07-01 e 2026-07-31
    const julyItems = transactions.filter(t => {
      const isAccountMatch = t.accountId === accountId;
      const isDateJuly = t.date && t.date >= '2026-07-01' && t.date <= '2026-07-31';
      return isAccountMatch && isDateJuly;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let totalAmt = 0;
    let matching = 0;
    let divergent = 0;
    let missing = 0;
    const divList: any[] = [];

    const detailedItems = julyItems.map((t, idx) => {
      const amt = Math.abs(t.amount || 0);
      totalAmt += amt;
      const ccMonth = t.creditCardMonth;
      const isMatch = ccMonth === '2026-07';
      const isMissing = !ccMonth;

      if (isMatch) {
        matching++;
      } else {
        divergent++;
        if (isMissing) missing++;
        divList.push({
          num: idx + 1,
          id: t.id,
          date: t.date,
          description: t.description,
          amount: amt,
          creditCardMonth: ccMonth || '(ausente)',
          creditCardStatus: t.creditCardStatus || '(ausente)'
        });
      }

      return {
        num: idx + 1,
        id: t.id,
        date: t.date,
        description: t.description,
        amount: amt,
        creditCardMonth: ccMonth || '(ausente)',
        creditCardStatus: t.creditCardStatus || '(ausente)',
        isMatch
      };
    });

    return {
      accountFound: true,
      account: cresolAccount,
      totalTxs: detailedItems.length,
      julyTxs: detailedItems,
      matchingCount: matching,
      divergentCount: divergent,
      missingMonthCount: missing,
      divergentList: divList,
      totalAmount: totalAmt
    };
  }, [cresolAccount, transactions]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    const reportText = `=== RELATÓRIO DE AUDITORIA: CARTÃO CRESOL (JULHO/2026) ===
Conta: ${auditData.account?.name || 'N/A'} (ID: ${auditData.account?.id || 'N/A'})
Total de Lançamentos em Julho/2026: ${auditData.totalTxs}
Total Financeiro (Soma): R$ ${auditData.totalAmount.toFixed(2).replace('.', ',')}
Lançamentos com creditCardMonth = "2026-07": ${auditData.matchingCount}
Lançamentos com creditCardMonth divergente/ausente: ${auditData.divergentCount} (Ausentes: ${auditData.missingMonthCount})

--- LISTA COMPLETA DOS LANÇAMENTOS (${auditData.totalTxs}) ---
${auditData.julyTxs.map(t => `#${t.num} | Data: ${t.date} | Valor: R$ ${t.amount.toFixed(2)} | creditCardMonth: ${t.creditCardMonth} | Status: ${t.creditCardStatus} | Desc: ${t.description} | ID: ${t.id}`).join('\n')}
`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    toast.success("Relatório de auditoria copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[28px] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Auditoria: Cartão Cresol (Competência Julho/2026)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Verificação real em tempo de execução dos lançamentos de 01/07/2026 a 31/07/2026
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copiado!' : 'Copiar Relatório'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Resumo Estatístico */}
        <div className="p-6 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Encontrado</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{auditData.totalTxs} <span className="text-xs font-semibold text-slate-500">lançamentos</span></p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">R$ {auditData.totalAmount.toFixed(2).replace('.', ',')}</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Batem com '2026-07'</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{auditData.matchingCount} <span className="text-xs font-semibold text-emerald-600">itens</span></p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {auditData.totalTxs > 0 ? `${((auditData.matchingCount / auditData.totalTxs) * 100).toFixed(1)}% de conformidade` : '0%'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Divergentes / Ausentes</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{auditData.divergentCount} <span className="text-xs font-semibold text-amber-600">itens</span></p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              {auditData.missingMonthCount} sem creditCardMonth
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Conta Auditada</p>
            <p className="text-sm font-black text-blue-900 mt-1 truncate">{auditData.account?.name || 'Não encontrada'}</p>
            <p className="text-[10px] text-blue-600 font-mono mt-0.5 truncate">ID: {auditData.account?.id || 'N/A'}</p>
          </div>
        </div>

        {/* Tabela detalhada */}
        <div className="flex-1 overflow-y-auto p-6">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
            <span>Listagem Completa de Transações ({auditData.totalTxs})</span>
          </h4>
          
          {auditData.totalTxs === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium">
              Nenhuma transação encontrada para a conta do Cartão Cresol com data em Julho/2026.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Descrição</th>
                    <th className="py-3 px-3 text-right">Valor</th>
                    <th className="py-3 px-3 text-center">creditCardMonth</th>
                    <th className="py-3 px-3 text-center">creditCardStatus</th>
                    <th className="py-3 px-3 text-center">Conformidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditData.julyTxs.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">{t.num}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{t.date}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        <p className="truncate max-w-[280px]" title={t.description}>{t.description}</p>
                        <p className="text-[9px] font-mono text-slate-400 truncate">ID: {t.id}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-800">
                        R$ {t.amount.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          t.isMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.creditCardMonth}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[9px] uppercase tracking-wider">
                          {t.creditCardStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {t.isMatch ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                            <CheckCircle className="w-3.5 h-3.5" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[10px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Divergente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 font-medium">
            Os dados acima refletem as transações carregadas em tempo real do Firestore.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
