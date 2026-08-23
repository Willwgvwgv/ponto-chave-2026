import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getDoc,
  getDocs,
  orderBy,
  limit,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { 
  BankAccount, 
  FinancialCategory, 
  FinancialTransaction, 
  CompanySettings, 
  UserProfile,
  Sale,
  BrokerSplit
} from '../types';
import { DashboardTab } from './financeiro/DashboardTab';
import { LancamentosTab } from './financeiro/LancamentosTab';
import { ReconciliacaoTab } from './financeiro/ReconciliacaoTab';
import { DRETab } from './financeiro/DRETab';
import { FluxoCaixaTab } from './financeiro/FluxoCaixaTab';
import { CategoriasTab } from './financeiro/CategoriasTab';
import { DEFAULT_FINANCIAL_CATEGORIES } from './financeiro/DefaultCategories';
import { toast } from 'sonner';

import { 
  LayoutDashboard, 
  BookOpen, 
  ArrowRightLeft, 
  BarChart3, 
  CalendarDays, 
  Tag,
  Landmark,
  AlertTriangle,
  X
} from 'lucide-react';

interface FinanceiroViewProps {
  isAdmin: boolean;
  user: any;
  profile: UserProfile | null;
  companySettings: CompanySettings | null;
}

export const FinanceiroView: React.FC<FinanceiroViewProps> = ({
  isAdmin,
  user,
  profile,
  companySettings
}) => {
  const companyId = companySettings?.id || "default_company";

  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'lancamentos' | 'conciliacao' | 'dre' | 'fluxo' | 'categorias'>('dashboard');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingCategoryFilterIds, setPendingCategoryFilterIds] = useState<string[] | null>(null);

  // Proteção contra perda de dados na Conciliação Bancária
  const [unconfirmedReconciliationCount, setUnconfirmedReconciliationCount] = useState<number>(0);
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState<boolean>(false);
  const [pendingNavigationSubTab, setPendingNavigationSubTab] = useState<'dashboard' | 'lancamentos' | 'conciliacao' | 'dre' | 'fluxo' | 'categorias' | null>(null);
  const [reconcileResetTrigger, setReconcileResetTrigger] = useState<number>(0);

  // Previne fechamento/recarregamento acidental da página se houver pendências
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeSubTab === 'conciliacao' && unconfirmedReconciliationCount > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeSubTab, unconfirmedReconciliationCount]);

  const handleRequestTabChange = (targetTab: 'dashboard' | 'lancamentos' | 'conciliacao' | 'dre' | 'fluxo' | 'categorias') => {
    setIsDropdownOpen(false);
    if (activeSubTab === 'conciliacao' && targetTab !== 'conciliacao' && unconfirmedReconciliationCount > 0) {
      setPendingNavigationSubTab(targetTab);
      setShowExitConfirmationModal(true);
      return;
    }
    setActiveSubTab(targetTab);
  };

  const handleConfirmExit = () => {
    if (pendingNavigationSubTab) {
      setActiveSubTab(pendingNavigationSubTab);
    }
    setReconcileResetTrigger(prev => prev + 1);
    setUnconfirmedReconciliationCount(0);
    setShowExitConfirmationModal(false);
    setPendingNavigationSubTab(null);
  };

  const handleCancelExit = () => {
    setShowExitConfirmationModal(false);
    setPendingNavigationSubTab(null);
  };

  const handleShowUncategorized = (txIds: string[]) => {
    setPendingCategoryFilterIds(txIds);
    handleRequestTabChange('lancamentos');
  };

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  
  // Dados de comissões para o fluxo de caixa
  const [sales, setSales] = useState<Sale[]>([]);
  const [splits, setSplits] = useState<BrokerSplit[]>([]);

  const [loading, setLoading] = useState(true);

  // 1. Sincronização em tempo real das Contas Bancárias
  useEffect(() => {
    if (!companyId) return;

    const q = query(collection(db, "bank_accounts"), where("companyId", "==", companyId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
      setAccounts(data);
    });

    return () => unsubscribe();
  }, [companyId]);

  // 2. Sincronização em tempo real das Categorias Financeiras
  useEffect(() => {
    if (!companyId) return;

    const q = query(collection(db, "financial_categories"), where("companyId", "==", companyId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map(doc => {
        const cat = doc.data() as any;
        
        // Intelligent backwards compatibility fallbacks
        const naturezaVal = cat.natureza || (cat.type === 'RECEITA' ? 'entrada' : 'saida');
        const grupoVal = cat.grupo || (
          cat.group === 'Locações' ? 'locacao' : 
          ['Pessoal', 'Estrutura', 'Marketing', 'Tecnologia', 'Impostos', 'Deslocamento', 'Diversas', 'Caixa'].includes(cat.group) ? 'caixa' : 'caixa'
        );
        let comportamentoVal = cat.comportamento;
        if (!comportamentoVal) {
          if (naturezaVal === 'entrada') {
            comportamentoVal = 'nao_aplicavel';
          } else {
            comportamentoVal = ['Aluguel Escritório', 'Internet', 'Telefone', 'Energia', 'Pró-labore', 'Salários', 'Imobilead', 'Contador', 'Assinaturas'].includes(cat.name) ? 'fixo' : 'variavel';
          }
        }
        let origemVal = cat.origem;
        if (!origemVal) {
          if (cat.name === 'Comissão de Venda' || cat.name === 'Comissão de Locação') {
            origemVal = 'venda';
          } else if (cat.name === 'Taxa de Administração' || cat.name === 'Honorários') {
            origemVal = 'administracao';
          } else {
            origemVal = grupoVal === 'locacao' ? 'locacao' : 'outros';
          }
        }

        return {
          id: doc.id,
          ...cat,
          name: cat.name || cat.nome || '',
          nome: cat.nome || cat.name || '',
          type: cat.type || (naturezaVal === 'entrada' ? 'RECEITA' : 'DESPESA'),
          group: cat.group || (grupoVal === 'locacao' ? 'Locações' : 'Caixa'),
          grupo: grupoVal,
          natureza: naturezaVal,
          comportamento: comportamentoVal,
          origem: origemVal
        } as FinancialCategory;
      });

      // Auto-complement missing categories individually if they are not in Firestore
      const existingNames = new Set(data.map(cat => cat.nome.trim().toLowerCase()));
      const missingDefaultCats = DEFAULT_FINANCIAL_CATEGORIES.filter(
        c => !existingNames.has(c.nome.trim().toLowerCase())
      );

      if (missingDefaultCats.length > 0) {
        try {
          for (const rawCat of missingDefaultCats) {
            const catId = `cat_${companyId}_${rawCat.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`;
            await setDoc(doc(db, "financial_categories", catId), {
              ...rawCat,
              companyId,
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Erro ao complementar Seed de categorias financeiras padrão:", err);
        }
      }
      
      setCategories(data);
    });

    return () => unsubscribe();
  }, [companyId]);

  // 3. Sincronização em tempo real dos Lançamentos Financeiros (Transactions)
  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, "financial_transactions"),
      where("companyId", "==", companyId),
      orderBy("date", "desc"),
      limit(500)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction));
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // 4. Sincronização das Comissões (vendas e splits) para cruzamento de fluxo de caixa futuro
  useEffect(() => {
    if (!companyId) return;

    const qSales = query(collection(db, "sales"), where("agency_id", "==", companyId));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setSales(data);
    });

    const qSplits = query(collection(db, "broker_splits"), where("agency_id", "==", companyId));
    const unsubscribeSplits = onSnapshot(qSplits, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrokerSplit));
      setSplits(data);
    });

    return () => {
      unsubscribeSales();
      unsubscribeSplits();
    };
  }, [companyId]);

  // --- Handlers de transação e banco ---

  const handleCreateAccount = async (
    name: string,
    bank: 'SICOOB' | 'CRESOL' | 'INTER' | 'BRADESCO' | 'ITAU' | 'BANCO_DO_BRASIL' | 'NUBANK' | 'OUTRO',
    agency: string,
    account: string,
    balance: number,
    color?: string,
    accountType?: 'CORRENTE' | 'CREDITO',
    cardBrand?: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD',
    totalLimit?: number,
    closingDay?: number,
    dueDay?: number
  ) => {
    try {
      const id = `acc_${Date.now()}`;
      await setDoc(doc(db, "bank_accounts", id), {
        companyId,
        name,
        bank,
        agency: agency || '',
        account: account || '',
        balance,
        color: color || null,
        createdAt: serverTimestamp(),
        accountType: accountType || 'CORRENTE',
        cardBrand: cardBrand || null,
        totalLimit: totalLimit || null,
        closingDay: closingDay || null,
        dueDay: dueDay || null
      });
      toast.success("Conta bancária cadastrada com sucesso!");
    } catch (err) {
      toast.error("Erro ao cadastrar conta.");
    }
  };

  const handleUpdateAccount = async (
    id: string,
    name: string,
    bank: 'SICOOB' | 'CRESOL' | 'INTER' | 'BRADESCO' | 'ITAU' | 'BANCO_DO_BRASIL' | 'NUBANK' | 'OUTRO',
    agency: string,
    account: string,
    balance: number,
    color?: string,
    accountType?: 'CORRENTE' | 'CREDITO',
    cardBrand?: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD',
    totalLimit?: number,
    closingDay?: number,
    dueDay?: number
  ) => {
    try {
      await updateDoc(doc(db, "bank_accounts", id), {
        name,
        bank,
        agency: agency || '',
        account: account || '',
        balance,
        color: color || null,
        accountType: accountType || 'CORRENTE',
        cardBrand: cardBrand || null,
        totalLimit: totalLimit || null,
        closingDay: closingDay || null,
        dueDay: dueDay || null
      });
      toast.success("Conta bancária atualizada com sucesso!");
    } catch (err) {
      toast.error("Erro ao atualizar conta.");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    console.log('Deletando conta ID:', id);
    try {
      const linkedTxs = transactions.filter(t => t.accountId === id && t.status !== 'IGNORADO');
      if (linkedTxs.length > 0) {
        toast.error(`Esta conta possui ${linkedTxs.length} lançamentos vinculados. Remova os lançamentos antes de excluir.`);
        return;
      }
      await deleteDoc(doc(db, "bank_accounts", id));
      console.log('Conta deletada com sucesso');
      toast.success("Conta bancária excluída com sucesso.");
    } catch (err) {
      console.error('Erro ao deletar:', err);
      toast.error("Erro ao excluir conta bancária.");
      handleFirestoreError(err, OperationType.DELETE, `bank_accounts/${id}`);
    }
  };

  const handlePayCreditCardInvoice = async (
    cardAccountId: string,
    statementMonth: string,
    sourceBankAccountId: string,
    paymentDate: string,
    totalAmount: number,
    cardTxIds: string[]
  ) => {
    try {
      // 1. Create a "DESPESA" transaction in the selected bank account (sourceBankAccountId)
      const txId = `tx_${Date.now()}`;
      await setDoc(doc(db, "financial_transactions", txId), {
        companyId,
        accountId: sourceBankAccountId,
        type: 'DESPESA',
        amount: totalAmount,
        date: paymentDate,
        description: `Pagamento Fatura Cartão - Competência ${statementMonth}`,
        categoryName: 'Pagamento de Fatura de Cartão',
        status: 'CONCILIADO',
        origin: 'MANUAL',
        createdAt: serverTimestamp(),
        notes: `Pagamento de fatura referindo-se a ${cardTxIds.length} transações.`
      });

      // 2. Update the status of all transactions in this invoice to 'FATURA_PAGA'
      for (const id of cardTxIds) {
        await updateDoc(doc(db, "financial_transactions", id), {
          creditCardStatus: 'FATURA_PAGA'
        });
      }

      // 3. Increment the card balance by totalAmount (restore available limit)
      const cardRef = doc(db, "bank_accounts", cardAccountId);
      const cardSnap = await getDoc(cardRef);
      if (cardSnap.exists()) {
        const currentBalance = cardSnap.data().balance || 0;
        await updateDoc(cardRef, {
          balance: currentBalance + totalAmount
        });
      }

      // 4. Also decrement the source bank account balance (deduct payment)
      const srcRef = doc(db, "bank_accounts", sourceBankAccountId);
      const srcSnap = await getDoc(srcRef);
      if (srcSnap.exists()) {
        const currentBalance = srcSnap.data().balance || 0;
        await updateDoc(srcRef, {
          balance: currentBalance - totalAmount
        });
      }

      toast.success("Fatura paga com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao pagar fatura.");
    }
  };

  const handleCreateCategory = async (
    name: string,
    type: 'RECEITA' | 'DESPESA',
    group: string,
    color: string,
    icon: string,
    grupo: 'locacao' | 'caixa',
    natureza: 'entrada' | 'saida',
    comportamento: 'fixo' | 'variavel' | 'nao_aplicavel',
    origem: 'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros'
  ) => {
    try {
      const id = `cat_${Date.now()}`;
      await setDoc(doc(db, "financial_categories", id), {
        companyId,
        name,
        nome: name,
        type,
        group,
        color,
        icon,
        grupo,
        natureza,
        comportamento,
        origem,
        isDefault: false,
        createdAt: serverTimestamp()
      });
      toast.success("Categoria personalizada cadastrada!");
    } catch (err) {
      toast.error("Erro ao salvar categoria.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, "financial_categories", id));
      toast.success("Categoria removida.");
    } catch (err) {
      toast.error("Erro ao deletar categoria.");
    }
  };

  const handleUpdateCategory = async (
    id: string,
    name: string,
    group: string,
    color: string,
    grupo: 'locacao' | 'caixa',
    natureza: 'entrada' | 'saida',
    comportamento: 'fixo' | 'variavel' | 'nao_aplicavel',
    origem: 'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros'
  ) => {
    try {
      await updateDoc(doc(db, "financial_categories", id), {
        name,
        nome: name,
        group,
        color,
        grupo,
        natureza,
        comportamento,
        origem
      });
      toast.success("Categoria atualizada com sucesso!");
    } catch (err) {
      toast.error("Erro ao atualizar categoria.");
    }
  };

  const handleCreateTransactions = async (txs: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">[]) => {
    try {
      if (txs.length === 0) return;

      const balanceAdjustments: { [accountId: string]: number } = {};
      txs.forEach((tx) => {
        if (!balanceAdjustments[tx.accountId]) {
          balanceAdjustments[tx.accountId] = 0;
        }
        if (tx.status === 'CONCILIADO') {
          if (tx.type === 'RECEITA') {
            balanceAdjustments[tx.accountId] += Math.abs(tx.amount);
          } else if (tx.type === 'DESPESA') {
            balanceAdjustments[tx.accountId] -= Math.abs(tx.amount);
          }
        }
      });

      for (const accountId of Object.keys(balanceAdjustments)) {
        const adjustment = balanceAdjustments[accountId];
        if (adjustment !== 0) {
          const accountRef = doc(db, "bank_accounts", accountId);
          const account = accounts.find((a) => a.id === accountId);
          if (account) {
            await updateDoc(accountRef, { balance: account.balance + adjustment });
          }
        }
      }

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        const id = `tx_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, "financial_transactions", id), {
          ...tx,
          companyId,
          createdAt: serverTimestamp()
        });
      }

      if (txs.length > 1) {
        toast.success(`${txs.length} lançamentos recorrentes criados com sucesso`);
      } else {
        toast.success("Lançamento registrado com sucesso!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar lançamento no financeiro.");
    }
  };

  const handleCreateTransaction = async (tx: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">) => {
    await handleCreateTransactions([tx]);
  };

  const handleUpdateTransactions = async (
    items: { id: string; updates: Partial<FinancialTransaction> }[]
  ) => {
    try {
      if (items.length === 0) return;

      const balanceAdjustments: { [accountId: string]: number } = {};

      items.forEach(({ id, updates }) => {
        const tx = transactions.find((t) => t.id === id);
        if (!tx) return;

        const originalStatus = tx.status;
        const newStatus = updates.status !== undefined ? updates.status : originalStatus;

        const originalAmount = tx.amount;
        const newAmount = updates.amount !== undefined ? updates.amount : originalAmount;

        const originalType = tx.type;
        const newType = updates.type !== undefined ? updates.type : originalType;

        const originalAccountId = tx.accountId;
        const newAccountId = updates.accountId !== undefined ? updates.accountId : originalAccountId;

        if (originalStatus === 'CONCILIADO') {
          if (!balanceAdjustments[originalAccountId]) {
            balanceAdjustments[originalAccountId] = 0;
          }
          if (originalType === 'RECEITA') {
            balanceAdjustments[originalAccountId] -= Math.abs(originalAmount);
          } else if (originalType === 'DESPESA') {
            balanceAdjustments[originalAccountId] += Math.abs(originalAmount);
          }
        }

        if (newStatus === 'CONCILIADO') {
          if (!balanceAdjustments[newAccountId]) {
            balanceAdjustments[newAccountId] = 0;
          }
          if (newType === 'RECEITA') {
            balanceAdjustments[newAccountId] += Math.abs(newAmount);
          } else if (newType === 'DESPESA') {
            balanceAdjustments[newAccountId] -= Math.abs(newAmount);
          }
        }
      });

      for (const accountId of Object.keys(balanceAdjustments)) {
        const adjustment = balanceAdjustments[accountId];
        if (adjustment !== 0) {
          const accountRef = doc(db, "bank_accounts", accountId);
          const account = accounts.find((a) => a.id === accountId);
          if (account) {
            await updateDoc(accountRef, { balance: account.balance + adjustment });
          }
        }
      }

      for (const item of items) {
        await updateDoc(doc(db, "financial_transactions", item.id), {
          ...item.updates,
          reconciledAt: item.updates.status === 'CONCILIADO' ? new Date().toISOString() : (item.updates.status === 'PENDENTE' ? null : null)
        });

        // Sincronização bilateral de status
        if (item.updates.status !== undefined) {
          try {
            const txSnap = await getDoc(doc(db, "financial_transactions", item.id));
            if (txSnap.exists()) {
              const txData = txSnap.data();
              if (txData.origin === 'AUTOMATICO') {
                const isConcil = item.updates.status === 'CONCILIADO';
                
                // 1. Caso de repasse de corretor (despesa)
                if (item.id.startsWith("tx_auto_payout_")) {
                  const splitId = item.id.replace("tx_auto_payout_", "");
                  await updateDoc(doc(db, "broker_splits", splitId), {
                    status: isConcil ? "PAID" : "PENDING",
                    payment_date: isConcil ? (txData.date || new Date().toISOString().split("T")[0]) : null,
                    payment_method: isConcil ? "PIX" : null
                  });
                }
                
                // 2. Caso de parcelas de venda (comissão receita)
                if (txData.commissionRef && txData.installmentInfo) {
                  const saleId = txData.commissionRef;
                  const instInfo = txData.installmentInfo; // 'Entrada' ou '1/3' etc.
                  
                  const splitsRef = collection(db, "broker_splits");
                  const qSplits = query(splitsRef, where("sale_id", "==", saleId));
                  const snapSplits = await getDocs(qSplits);
                  
                  for (const splitDoc of snapSplits.docs) {
                    const splitId = splitDoc.id;
                    const splitData = splitDoc.data();
                    const splitRef = doc(db, "broker_splits", splitId);
                    
                    if (instInfo === "Entrada") {
                      const upd: any = {
                        entry_paid: isConcil,
                        entry_paid_value: isConcil ? (splitData.entrada_value || 0) : 0,
                        entry_payment_date: isConcil ? (txData.date || new Date().toISOString().split("T")[0]) : null,
                        entry_payment_method: isConcil ? "PIX" : null
                      };

                      const hasEntryPlanned = (splitData.entrada_value ?? 0) > 0;
                      const isEntryPaid = hasEntryPlanned ? isConcil : true;
                      const insts = splitData.installments_status || [];
                      const allInstPaid = insts.every((i: any) => i.status === "PAID");
                      const anyInstPaidOrPartial = insts.some((i: any) => i.status === "PAID" || i.status === "PARTIAL");

                      if (isEntryPaid && allInstPaid) {
                        upd.status = "PAID";
                      } else if (anyInstPaidOrPartial || isConcil) {
                        upd.status = "PARTIAL";
                      } else {
                        upd.status = "PENDING";
                      }
                      
                      await updateDoc(splitRef, upd);
                    } else {
                      const parts = instInfo.split("/");
                      if (parts.length === 2) {
                        const instNum = parseInt(parts[0]);
                        const updatedInstallments = [...(splitData.installments_status || [])];
                        const idx = updatedInstallments.findIndex((i: any) => i.number === instNum);
                        if (idx !== -1) {
                          const inst = updatedInstallments[idx];
                          updatedInstallments[idx] = {
                            ...inst,
                            status: isConcil ? "PAID" : "PENDING",
                            paid_value: isConcil ? inst.calculated_value : 0,
                            payment_date: isConcil ? (txData.date || new Date().toISOString().split("T")[0]) : null,
                            payment_method: isConcil ? "PIX" : null,
                            remaining_value: isConcil ? 0 : inst.calculated_value
                          };
                          
                          const upd: any = {
                            installments_status: updatedInstallments
                          };

                          const hasEntryPlanned = (splitData.entrada_value ?? 0) > 0;
                          const isEntryPaid = hasEntryPlanned ? splitData.entry_paid : true;
                          const allInstPaid = updatedInstallments.every((i: any) => i.status === "PAID");
                          const anyInstPaidOrPartial = updatedInstallments.some((i: any) => i.status === "PAID" || i.status === "PARTIAL");
                          const isAnyEntryPaid = splitData.entry_paid;

                          if (isEntryPaid && allInstPaid) {
                            upd.status = "PAID";
                          } else if (anyInstPaidOrPartial || isAnyEntryPaid) {
                            upd.status = "PARTIAL";
                          } else {
                            upd.status = "PENDING";
                          }

                          await updateDoc(splitRef, upd);
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (errSync) {
            console.warn("Erro ao fazer sincronização de comissão reativa:", errSync);
          }
        }
      }

      toast.success("Lançamento(s) atualizado(s) com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar lançamento(s).");
    }
  };

  const handleUpdateTransactionStatus = async (id: string, status: 'PENDENTE' | 'CONCILIADO' | 'IGNORADO' | 'AGENDADO' | 'CANCELADO') => {
    await handleUpdateTransactions([{ id, updates: { status } }]);
  };

  const handleDeleteMultipleTransactions = async (ids: string[]) => {
    try {
      if (ids.length === 0) return;

      const balanceAdjustments: { [accountId: string]: number } = {};
      
      ids.forEach((id) => {
        const tx = transactions.find((t) => t.id === id);
        if (!tx) return;
        
        if (!balanceAdjustments[tx.accountId]) {
          balanceAdjustments[tx.accountId] = 0;
        }
        
        if (tx.status === 'CONCILIADO') {
          if (tx.type === 'RECEITA') {
            balanceAdjustments[tx.accountId] -= Math.abs(tx.amount);
          } else if (tx.type === 'DESPESA') {
            balanceAdjustments[tx.accountId] += Math.abs(tx.amount);
          }
        }
      });

      for (const accountId of Object.keys(balanceAdjustments)) {
        const adjustment = balanceAdjustments[accountId];
        if (adjustment !== 0) {
          const accountRef = doc(db, "bank_accounts", accountId);
          const account = accounts.find((a) => a.id === accountId);
          if (account) {
            await updateDoc(accountRef, { balance: account.balance + adjustment });
          }
        }
      }

      for (const id of ids) {
        await deleteDoc(doc(db, "financial_transactions", id));
      }

      toast.success(`${ids.length} lançamento(s) cancelado(s) com sucesso.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao deletar transação(ões).");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    await handleDeleteMultipleTransactions([id]);
  };

  // Projeções futuras para o fluxo de caixa
  const upcomingSalesCommissions = useMemo(() => {
    // Vendas com status "ACTIVE" que ainda não geraram receita conciliada correspondente
    return sales
      .filter(s => s.status === 'ACTIVE')
      .filter(s => !transactions.some(t => t.commissionRef === s.id && t.type === 'RECEITA'))
      .map(s => ({
        propertyAddress: s.property_address || 'Comissão de Venda',
        amount: s.total_commission || 0,
        date: s.sale_date
      }));
  }, [sales, transactions]);

  const upcomingBrokerPayouts = useMemo(() => {
    // Splits com status pendente que ainda não geraram despesa conciliada
    return splits
      .filter(s => s.status !== 'PAID')
      .filter(s => !transactions.some(t => t.commissionRef === s.id && t.type === 'DESPESA'))
      .map(s => ({
        brokerName: s.broker_name || 'Repasse Comissão',
        amount: s.calculated_value || 0,
        date: s.forecast_date || new Date().toISOString().split('T')[0]
      }));
  }, [splits, transactions]);

  const isFinanceAdmin = profile?.role === "admin";
  const userHasPermFinanceiro = isFinanceAdmin || profile?.permFinanceiro === true || profile?.perm_financeiro === true || profile?.permissions?.includes("financeiro");

  if (!userHasPermFinanceiro) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px] font-sans">
        <div className="bg-red-50 text-red-600 w-12 h-12 rounded-full flex items-center justify-center mb-4">
          <Landmark className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Você não possui permissão para visualizar o Financeiro. Solicite o acesso a um administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Menu Tabulativo */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl relative w-fit self-start">
        <button
          onClick={() => handleRequestTabChange('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
            activeSubTab === 'dashboard' ? 'bg-white text-blue-600 shadow animate-fadeIn' : 'text-slate-500 hover:text-slate-705'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
        
        <button
          onClick={() => handleRequestTabChange('lancamentos')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
            activeSubTab === 'lancamentos' ? 'bg-white text-blue-600 shadow animate-fadeIn' : 'text-slate-500 hover:text-slate-705'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Lançamentos
        </button>

        <button
          onClick={() => handleRequestTabChange('conciliacao')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
            activeSubTab === 'conciliacao' ? 'bg-white text-blue-600 shadow animate-fadeIn' : 'text-slate-500 hover:text-slate-705'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Conciliação Bancária
        </button>

        <button
          onClick={() => handleRequestTabChange('dre')}
          className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
            activeSubTab === 'dre' ? 'bg-white text-blue-600 shadow animate-fadeIn' : 'text-slate-500 hover:text-slate-702'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          DRE Mensal
        </button>

        <button
          onClick={() => handleRequestTabChange('fluxo')}
          className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
            activeSubTab === 'fluxo' ? 'bg-white text-blue-600 shadow animate-fadeIn' : 'text-slate-500 hover:text-slate-705'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Fluxo de Caixa
        </button>

        <button
          onClick={() => handleRequestTabChange('categorias')}
          className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
            activeSubTab === 'categorias' ? 'bg-white text-blue-600 shadow animate-fadeIn' : 'text-slate-500 hover:text-slate-705'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Categorias
        </button>

        {/* Dropdown 'Mais' on screens < 1024px */}
        <div className="relative lg:hidden">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
              ['dre', 'fluxo', 'categorias'].includes(activeSubTab)
                ? 'bg-blue-50 text-blue-600 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-705'
            }`}
          >
            <span>⋯ Mais</span>
            {['dre', 'fluxo', 'categorias'].includes(activeSubTab) && (
              <span className="text-[9px] lowercase opacity-80">
                ({activeSubTab === 'dre' ? 'dre' : activeSubTab === 'fluxo' ? 'fluxo' : 'cat'})
              </span>
            )}
          </button>

          {isDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-20 animate-fadeIn">
                <button
                  onClick={() => handleRequestTabChange('dre')}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide transition-all ${
                    activeSubTab === 'dre' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  DRE Mensal
                </button>

                <button
                  onClick={() => handleRequestTabChange('fluxo')}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide transition-all ${
                    activeSubTab === 'fluxo' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Fluxo de Caixa
                </button>

                <button
                  onClick={() => handleRequestTabChange('categorias')}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide transition-all ${
                    activeSubTab === 'categorias' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  Categorias
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-3">Carregando dados financeiros...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-8">
          {activeSubTab === 'dashboard' && (
            <DashboardTab 
              accounts={accounts} 
              transactions={transactions} 
              onAddAccount={handleCreateAccount} 
              onUpdateAccount={handleUpdateAccount}
              onDeleteAccount={handleDeleteAccount}
              onPayCreditCardInvoice={handlePayCreditCardInvoice}
              onUpdateTransactions={handleUpdateTransactions}
            />
          )}

          {activeSubTab === 'lancamentos' && (
            <LancamentosTab 
              accounts={accounts} 
              categories={categories} 
              transactions={transactions} 
              onAddTransaction={handleCreateTransaction} 
              onUpdateStatus={handleUpdateTransactionStatus}
              onDeleteTransaction={handleDeleteTransaction}
              onAddTransactions={handleCreateTransactions}
              onUpdateTransactions={handleUpdateTransactions}
              onDeleteTransactions={handleDeleteMultipleTransactions}
              isAdmin={profile?.role === 'admin'}
              initialFilterIds={pendingCategoryFilterIds}
              onClearInitialFilter={() => setPendingCategoryFilterIds(null)}
            />
          )}

          {activeSubTab === 'conciliacao' && (
            <ReconciliacaoTab 
              accounts={accounts} 
              categories={categories} 
              transactions={transactions} 
              onAddTransaction={handleCreateTransaction} 
              onAddTransactions={handleCreateTransactions}
              onUpdateStatus={handleUpdateTransactionStatus}
              onUpdateTransactions={handleUpdateTransactions}
              onUnconfirmedCountChange={setUnconfirmedReconciliationCount}
              resetTrigger={reconcileResetTrigger}
            />
          )}

          {activeSubTab === 'dre' && (
            <DRETab 
              categories={categories} 
              transactions={transactions} 
              onShowUncategorized={handleShowUncategorized}
            />
          )}

          {activeSubTab === 'fluxo' && (
            <FluxoCaixaTab 
              accounts={accounts} 
              transactions={transactions} 
              upcomingSalesCommissions={upcomingSalesCommissions}
              upcomingBrokerPayouts={upcomingBrokerPayouts}
            />
          )}

          {activeSubTab === 'categorias' && (
            <CategoriasTab 
              categories={categories} 
              onAddCategory={handleCreateCategory} 
              onDeleteCategory={handleDeleteCategory}
              onUpdateCategory={handleUpdateCategory}
            />
          )}
        </div>
      )}

      {/* Modal de Confirmação de Saída com Itens Não Confirmados na Conciliação */}
      {showExitConfirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
            onClick={handleCancelExit}
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 p-6 animate-fadeIn text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900">
                Progresso não salvo na Conciliação
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Você tem <strong>{unconfirmedReconciliationCount} lançamento(s)</strong> ainda não confirmados nesta importação. Se sair agora, esse progresso será perdido. Deseja continuar mesmo assim?
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCancelExit}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
              >
                Continuar revisando
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-xs transition-colors cursor-pointer"
              >
                Sair mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
