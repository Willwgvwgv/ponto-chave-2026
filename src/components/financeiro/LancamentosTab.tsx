import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, 
  Search, 
  Trash2, 
  Plus, 
  Send, 
  Calendar,
  DollarSign, 
  Tag, 
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Pencil,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BankAccount, FinancialCategory, FinancialTransaction } from '../../types';
import { db, doc, deleteDoc } from '../../firebase';
import { toast } from 'sonner';
import { ConfirmModal } from '../ui/ConfirmModal';

interface LancamentosTabProps {
  accounts: BankAccount[];
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
  onAddTransaction: (tx: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">) => void;
  onUpdateStatus: (id: string, status: 'PENDENTE' | 'CONCILIADO' | 'IGNORADO' | 'AGENDADO' | 'CANCELADO') => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransactions: (txs: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">[]) => void;
  onUpdateTransactions: (items: { id: string, updates: Partial<FinancialTransaction> }[]) => void;
  onDeleteTransactions: (ids: string[]) => void;
  isAdmin?: boolean;
}

function getRecurrenceInstances(startDateStr: string, frequency: string, periodMonths: string) {
  const dates: string[] = [];
  const baseDate = new Date(startDateStr + 'T12:00:00');
  
  let limitOccurrencesByMonths = 12;
  if (periodMonths === '3') limitOccurrencesByMonths = 3;
  else if (periodMonths === '6') limitOccurrencesByMonths = 6;
  else if (periodMonths === '12') limitOccurrencesByMonths = 12;
  else if (periodMonths === '24') limitOccurrencesByMonths = 24;
  else if (periodMonths === 'SEM_FIM') limitOccurrencesByMonths = 36; // sensible limit

  let targetCount = 12;
  if (frequency === 'SEMANAL') {
    targetCount = Math.round(limitOccurrencesByMonths * 4.333);
  } else if (frequency === 'QUINZENAL') {
    targetCount = limitOccurrencesByMonths * 2;
  } else if (frequency === 'MENSAL') {
    targetCount = limitOccurrencesByMonths;
  } else if (frequency === 'BIMESTRAL') {
    targetCount = Math.ceil(limitOccurrencesByMonths / 2);
  } else if (frequency === 'TRIMESTRAL') {
    targetCount = Math.ceil(limitOccurrencesByMonths / 3);
  } else if (frequency === 'SEMESTRAL') {
    targetCount = Math.ceil(limitOccurrencesByMonths / 6);
  } else if (frequency === 'ANUAL') {
    targetCount = Math.ceil(limitOccurrencesByMonths / 12);
  }

  let current = new Date(baseDate);
  for (let i = 0; i < targetCount; i++) {
    dates.push(current.toISOString().split('T')[0]);
    const next = new Date(current);
    if (frequency === 'SEMANAL') {
      next.setDate(next.getDate() + 7);
    } else if (frequency === 'QUINZENAL') {
      next.setDate(next.getDate() + 15);
    } else if (frequency === 'MENSAL') {
      next.setMonth(next.getMonth() + 1);
    } else if (frequency === 'BIMESTRAL') {
      next.setMonth(next.getMonth() + 2);
    } else if (frequency === 'TRIMESTRAL') {
      next.setMonth(next.getMonth() + 3);
    } else if (frequency === 'SEMESTRAL') {
      next.setMonth(next.getMonth() + 6);
    } else if (frequency === 'ANUAL') {
      next.setFullYear(next.getFullYear() + 1);
    }
    current = next;
  }

  return dates;
}

const isFutureDate = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) > today;
};

function getCardStatementMonth(dateStr: string, closingDay: number): string {
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

function getInitialCreditCardStatus(dateStr: string, closingDay: number): 'FATURA_ABERTA' | 'FATURA_FECHADA' {
  const statementYm = getCardStatementMonth(dateStr, closingDay);
  const [stmtY, stmtM] = statementYm.split('-').map(Number);
  const closingDate = new Date(stmtY, stmtM - 1, closingDay, 23, 59, 59);
  const today = new Date();
  return today > closingDate ? 'FATURA_FECHADA' : 'FATURA_ABERTA';
}

export const LancamentosTab: React.FC<LancamentosTabProps> = ({
  accounts,
  categories,
  transactions,
  onAddTransaction,
  onUpdateStatus,
  onDeleteTransaction,
  onAddTransactions,
  onUpdateTransactions,
  onDeleteTransactions,
  isAdmin
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortAscending, setSortAscending] = useState(true);

  // Filtro de Período Atual (Mês atual por padrão)
  const [currentPeriodDate, setCurrentPeriodDate] = useState<Date>(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return primeiroDia;
  });
  const [viewAll, setViewAll] = useState(false);

  // Novos filtros e estados de selação customizados
  const [filterMode, setFilterMode] = useState<'MONTH' | 'RANGE' | 'ALL'>('MONTH');
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  });
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmColor?: 'red' | 'blue' | 'green';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmColor: 'red',
    onConfirm: () => {}
  });

  // Sincronizar datas quando escolher o mês
  useEffect(() => {
    if (filterMode === 'MONTH') {
      const y = currentPeriodDate.getFullYear();
      const m = String(currentPeriodDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(currentPeriodDate.getFullYear(), currentPeriodDate.getMonth() + 1, 0).getDate();
      setStartDateStr(`${y}-${m}-01`);
      setEndDateStr(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    }
  }, [currentPeriodDate, filterMode]);

  const handleSelectAllToggle = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleSelectTxToggle = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    console.log('=== BULK DELETE ===');
    console.log('IDs selecionados:', Array.from(selectedTxIds));
    console.log('Total:', selectedTxIds.size);
    
    setConfirmState({
      open: true,
      title: 'Confirmar exclusão em massa',
      message: `Excluir ${selectedTxIds.size} lançamentos selecionados? Esta ação não pode ser desfeita e irá recalcular os saldos das contas correspondentes.`,
      confirmColor: 'red',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, open: false }));
        try {
          if (onDeleteTransactions) {
            onDeleteTransactions(Array.from(selectedTxIds));
          } else {
            const deletePromises = Array.from(selectedTxIds).map((id: string) =>
              deleteDoc(doc(db, 'financial_transactions', id))
            );
            await Promise.all(deletePromises);
            toast.success(`${deletePromises.length} lançamentos excluídos com sucesso`);
          }
          setSelectedTxIds(new Set());
        } catch (error) {
          console.error('Erro ao excluir:', error);
          toast.error('Erro ao excluir lançamentos');
        }
      }
    });
  };

  // Modal para lançamento normal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [txType, setTxType] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
  const [txAmount, setTxAmount] = useState('');
  const [txAccountId, setTxAccountId] = useState(accounts[0]?.id || '');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txDesc, setTxDesc] = useState('');
  const [txNotes, setTxNotes] = useState('');

  // Estados de Recorrência
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState('MENSAL');
  const [repetirPor, setRepetirPor] = useState('12');

  // Modal para edição de lançamento
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [editScope, setEditScope] = useState<'SINGLE' | 'UPCOMING'>('SINGLE');

  const [editType, setEditType] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
  const [editAmount, setEditAmount] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<'PENDENTE' | 'CONCILIADO' | 'IGNORADO' | 'AGENDADO' | 'CANCELADO'>('PENDENTE');

  // Modal de perguntas de recorrência (Editar / Excluir)
  const [recurrencePromptOpen, setRecurrencePromptOpen] = useState(false);
  const [recurrencePromptType, setRecurrencePromptType] = useState<'EDIT' | 'DELETE' | null>(null);
  const [selectedRecurrenceTx, setSelectedRecurrenceTx] = useState<FinancialTransaction | null>(null);

  // Modal para transferência entre contas
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [tfFrom, setTfFrom] = useState(accounts[0]?.id || '');
  const [tfTo, setTfTo] = useState(accounts[1]?.id || '');
  const [tfAmount, setTfAmount] = useState('');
  const [tfDate, setTfDate] = useState(new Date().toISOString().split('T')[0]);
  const [tfDesc, setTfDesc] = useState('Transferência entre contas');

  // Filtra categorias baseadas no tipo de lançamento sendo criado
  const filteredCategoriesAdd = useMemo(() => {
    return categories.filter(c => c.type === txType);
  }, [categories, txType]);

  const filteredCategoriesEdit = useMemo(() => {
    return categories.filter(c => c.type === editType);
  }, [categories, editType]);

  // Lista de lançamentos com filtros
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Filtro de data / período do mês ou datas personalizadas
      const matchPeriod = (() => {
        if (filterMode === 'ALL') return true;
        if (!t.date) return false;
        return t.date >= startDateStr && t.date <= endDateStr;
      })();

      const matchSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchAccount = selectedAccount === 'all' || t.accountId === selectedAccount;
      const matchCategory = selectedCategory === 'all' || t.categoryId === selectedCategory;
      const matchType = selectedType === 'all' || t.type === selectedType;
      const matchStatus = selectedStatus === 'all' || t.status === selectedStatus;

      return matchPeriod && matchSearch && matchAccount && matchCategory && matchType && matchStatus;
    }).sort((a, b) => {
      const aTime = a.date ? new Date(a.date + 'T00:00:00').getTime() : 0;
      const bTime = b.date ? new Date(b.date + 'T00:00:00').getTime() : 0;
      return sortAscending ? aTime - bTime : bTime - aTime;
    });
  }, [transactions, searchTerm, selectedAccount, selectedCategory, selectedType, selectedStatus, sortAscending, startDateStr, endDateStr, filterMode]);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txAccountId || !txDesc) return;
    
    const cat = categories.find(c => c.id === txCategoryId);
    const account = accounts.find(a => a.id === txAccountId);
    const isCard = account?.accountType === 'CREDITO';

    if (isRecorrente) {
      const dates = getRecurrenceInstances(txDate, frequencia, repetirPor);
      const groupUuid = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const txs = dates.map(d => {
        const dStatus = isCard ? getInitialCreditCardStatus(d, account?.closingDay || 10) : undefined;
        const dMonth = isCard ? getCardStatementMonth(d, account?.closingDay || 10) : undefined;
        return {
          accountId: txAccountId,
          date: d,
          description: txDesc,
          amount: parseFloat(txAmount),
          type: isCard ? 'DESPESA' : txType,
          categoryId: txCategoryId || null,
          categoryName: cat ? cat.name : null,
          status: isCard ? 'CONCILIADO' : (isFutureDate(d) ? 'AGENDADO' : 'PENDENTE') as any,
          origin: 'MANUAL' as const,
          notes: txNotes || null,
          recurrenceGroupId: groupUuid,
          creditCardStatus: dStatus,
          creditCardMonth: dMonth
        };
      });
      
      onAddTransactions(txs);
    } else {
      const cardStatus = isCard ? getInitialCreditCardStatus(txDate, account?.closingDay || 10) : undefined;
      const cardMonth = isCard ? getCardStatementMonth(txDate, account?.closingDay || 10) : undefined;
      onAddTransaction({
        accountId: txAccountId,
        date: txDate,
        description: txDesc,
        amount: parseFloat(txAmount),
        type: isCard ? 'DESPESA' : txType,
        categoryId: txCategoryId || null,
        categoryName: cat ? cat.name : null,
        status: isCard ? 'CONCILIADO' : (isFutureDate(txDate) ? 'AGENDADO' : 'PENDENTE') as any,
        origin: 'MANUAL',
        notes: txNotes || null,
        creditCardStatus: cardStatus,
        creditCardMonth: cardMonth
      });
    }

    setTxAmount('');
    setTxDesc('');
    setTxNotes('');
    setIsRecorrente(false);
    setIsAddOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editAmount || !editAccountId || !editDesc) return;

    const cat = categories.find(c => c.id === editCategoryId);
    const account = accounts.find(a => a.id === editAccountId);
    const isCard = account?.accountType === 'CREDITO';

    if (editingTx.recurrenceGroupId && editScope === 'UPCOMING') {
      const upcomingInGroup = transactions.filter(
        item => item.recurrenceGroupId === editingTx.recurrenceGroupId && item.date >= editingTx.date
      );
      
      const itemsToUpdate = upcomingInGroup.map(item => {
        const dStatus = isCard ? getInitialCreditCardStatus(item.date, account?.closingDay || 10) : null;
        const dMonth = isCard ? getCardStatementMonth(item.date, account?.closingDay || 10) : null;
        return {
          id: item.id,
          updates: {
            type: isCard ? 'DESPESA' : editType,
            amount: parseFloat(editAmount),
            accountId: editAccountId,
            categoryId: editCategoryId || null,
            categoryName: cat ? cat.name : null,
            description: editDesc,
            notes: editNotes || null,
            status: isCard ? 'CONCILIADO' : editStatus,
            creditCardStatus: dStatus || null,
            creditCardMonth: dMonth || null
          }
        };
      });
      
      onUpdateTransactions(itemsToUpdate);
    } else {
      const cardStatus = isCard ? getInitialCreditCardStatus(editDate, account?.closingDay || 10) : null;
      const cardMonth = isCard ? getCardStatementMonth(editDate, account?.closingDay || 10) : null;
      onUpdateTransactions([{
        id: editingTx.id,
        updates: {
          type: isCard ? 'DESPESA' : editType,
          amount: parseFloat(editAmount),
          accountId: editAccountId,
          categoryId: editCategoryId || null,
          categoryName: cat ? cat.name : null,
          date: editDate,
          description: editDesc,
          notes: editNotes || null,
          status: isCard ? 'CONCILIADO' : editStatus,
          creditCardStatus: cardStatus || null,
          creditCardMonth: cardMonth || null
        }
      }]);
    }

    setIsEditOpen(false);
    setEditingTx(null);
  };

  const handleEditClick = (t: FinancialTransaction) => {
    if (t.recurrenceGroupId) {
      setSelectedRecurrenceTx(t);
      // prefill variables
      setEditType(t.type);
      setEditAmount(Math.abs(t.amount).toString());
      setEditAccountId(t.accountId);
      setEditCategoryId(t.categoryId || '');
      setEditDate(t.date);
      setEditDesc(t.description);
      setEditNotes(t.notes || '');
      setEditStatus(t.status);

      setRecurrencePromptType('EDIT');
      setRecurrencePromptOpen(true);
    } else {
      setEditingTx(t);
      setEditScope('SINGLE');
      setEditType(t.type);
      setEditAmount(Math.abs(t.amount).toString());
      setEditAccountId(t.accountId);
      setEditCategoryId(t.categoryId || '');
      setEditDate(t.date);
      setEditDesc(t.description);
      setEditNotes(t.notes || '');
      setEditStatus(t.status);
      setIsEditOpen(true);
    }
  };

  const handleDeleteClick = (t: FinancialTransaction) => {
    if (t.recurrenceGroupId) {
      setSelectedRecurrenceTx(t);
      setRecurrencePromptType('DELETE');
      setRecurrencePromptOpen(true);
    } else {
      setConfirmState({
        open: true,
        title: 'Confirmar exclusão',
        message: 'Deseja realmente excluir este lançamento? Esta ação irá alterar o saldo da conta correspondente.',
        confirmColor: 'red',
        onConfirm: () => {
          setConfirmState(prev => ({ ...prev, open: false }));
          onDeleteTransaction(t.id);
        }
      });
    }
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tfAmount || !tfFrom || !tfTo || tfFrom === tfTo) return;

    const amount = parseFloat(tfAmount);

    // Cria saída (DESPESA) da conta origem
    onAddTransaction({
      accountId: tfFrom,
      date: tfDate,
      description: `${tfDesc} (Saída)`,
      amount: amount,
      type: 'DESPESA',
      status: isFutureDate(tfDate) ? 'AGENDADO' : 'PENDENTE',
      origin: 'MANUAL',
      notes: `Transferência destinada para a conta ${accounts.find(a => a.id === tfTo)?.name}`
    });

    // Cria entrada (RECEITA) na conta destino
    onAddTransaction({
      accountId: tfTo,
      date: tfDate,
      description: `${tfDesc} (Entrada)`,
      amount: amount,
      type: 'RECEITA',
      status: isFutureDate(tfDate) ? 'AGENDADO' : 'PENDENTE',
      origin: 'MANUAL',
      notes: `Transferência vinda da conta ${accounts.find(a => a.id === tfFrom)?.name}`
    });

    setTfAmount('');
    setIsTransferOpen(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatMonthLabel = (date: Date) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleMonthChange = (valStr: string) => {
    if (!valStr) return;
    const [year, month] = valStr.split('-').map(Number);
    setCurrentPeriodDate(new Date(year, month - 1, 1));
    setFilterMode('MONTH');
    setViewAll(false);
  };

  const isCreatedToday = (createdAt: any) => {
    if (!createdAt) return false;
    let date: Date;
    if (typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt instanceof Date) {
      date = createdAt;
    } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      date = new Date(createdAt);
    } else if (createdAt.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else {
      return false;
    }
    
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const errorTransactionsToDelete = useMemo(() => {
    if (!isAdmin) return [];
    return transactions.filter(t => {
      return t.recurrenceGroupId != null && 
             isCreatedToday(t.createdAt);
    });
  }, [transactions, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        {isAdmin && errorTransactionsToDelete.length > 0 && (
          <button
            onClick={() => {
              setConfirmState({
                open: true,
                title: 'Excluir lançamentos recorrentes',
                message: `Deseja realmente excluir todos os ${errorTransactionsToDelete.length} lançamentos recorrentes criados incorretamente hoje?`,
                confirmColor: 'red',
                onConfirm: () => {
                  setConfirmState(prev => ({ ...prev, open: false }));
                  onDeleteTransactions(errorTransactionsToDelete.map(t => t.id));
                }
              });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs transition-colors mr-auto"
            title="Excluir lançamentos recorrentes com erro criados hoje"
          >
            <Trash2 className="w-4 h-4" />
            Excluir todos os lançamentos recorrentes com erro ({errorTransactionsToDelete.length})
          </button>
        )}
        <button
          onClick={() => {
            const firstAcc = accounts[0];
            setTxType(firstAcc?.accountType === 'CREDITO' ? 'DESPESA' : 'RECEITA');
            setTxAccountId(firstAcc?.id || '');
            setTxCategoryId('');
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold text-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Receita / Despesa
        </button>
        <button
          onClick={() => {
            setTfFrom(accounts[0]?.id || '');
            setTfTo(accounts[1]?.id || '');
            setIsTransferOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs transition-colors"
        >
          <Send className="w-4 h-4" />
          Transferência entre Contas
        </button>
      </div>

      {/* Seletor de Período */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggles de Modo de Filtro */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('MONTH');
                  setViewAll(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'MONTH'
                    ? 'bg-white text-blue-650 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('RANGE');
                  setViewAll(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'RANGE'
                    ? 'bg-white text-blue-650 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Por Datas
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('ALL');
                  setViewAll(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'ALL'
                    ? 'bg-white text-blue-650 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ver tudo
              </button>
            </div>

            {/* Seletor de Mês (Visível no modo MONTH) */}
            {filterMode === 'MONTH' && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(currentPeriodDate.getFullYear(), currentPeriodDate.getMonth() - 1, 1);
                    setCurrentPeriodDate(prev);
                    setFilterMode('MONTH');
                    setViewAll(false);
                  }}
                  className="p-1 px-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors border-0"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="h-6 w-px bg-slate-200" />

                <div className="relative px-3 py-1 hover:bg-white rounded-lg transition-colors cursor-pointer flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="font-extrabold text-sm text-slate-700">
                    {formatMonthLabel(currentPeriodDate)}
                  </span>
                  <input
                    type="month"
                    value={`${currentPeriodDate.getFullYear()}-${String(currentPeriodDate.getMonth() + 1).padStart(2, '0')}`}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>

                <div className="h-6 w-px bg-slate-200" />

                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(currentPeriodDate.getFullYear(), currentPeriodDate.getMonth() + 1, 1);
                    setCurrentPeriodDate(next);
                    setFilterMode('MONTH');
                    setViewAll(false);
                  }}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors border-0"
                  title="Mês posterior"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Filtros por Datas (Visíveis nos modos RANGE ou MONTH) */}
            {(filterMode === 'RANGE' || filterMode === 'MONTH') && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-600">
                  <span className="text-slate-400">De:</span>
                  <input
                    type="date"
                    disabled={filterMode === 'MONTH'}
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className={`bg-transparent outline-none font-bold text-slate-705 ${filterMode === 'MONTH' ? 'cursor-not-allowed opacity-80' : ''}`}
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-600">
                  <span className="text-slate-400">Até:</span>
                  <input
                    type="date"
                    disabled={filterMode === 'MONTH'}
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className={`bg-transparent outline-none font-bold text-slate-705 ${filterMode === 'MONTH' ? 'cursor-not-allowed opacity-80' : ''}`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo do período abaixo do navegador */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-600 flex flex-wrap items-center gap-1.5 select-none bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="font-extrabold text-slate-700">{filteredTransactions.length} lançamentos</span>
            <span className="text-slate-300">·</span>{' '}
            Entradas:{' '}
            <span className="text-emerald-600 font-extrabold">
              {formatCurrency(filteredTransactions.filter(t => t.type === 'RECEITA').reduce((acc, t) => acc + t.amount, 0))}
            </span>{' '}
            <span className="text-slate-300">·</span>{' '}
            Saídas:{' '}
            <span className="text-rose-600 font-extrabold">
              {formatCurrency(filteredTransactions.filter(t => t.type === 'DESPESA').reduce((acc, t) => acc + t.amount, 0))}
            </span>{' '}
            <span className="text-slate-300">·</span>{' '}
            Saldo:{' '}
            <span className={`font-black ${
              filteredTransactions.filter(t => t.type === 'RECEITA').reduce((acc, t) => acc + t.amount, 0) -
              filteredTransactions.filter(t => t.type === 'DESPESA').reduce((acc, t) => acc + t.amount, 0) >= 0
                ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg'
                : 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg'
            }`}>
              {formatCurrency(
                filteredTransactions.filter(t => t.type === 'RECEITA').reduce((acc, t) => acc + t.amount, 0) -
                filteredTransactions.filter(t => t.type === 'DESPESA').reduce((acc, t) => acc + t.amount, 0)
              )}
            </span>
          </div>

          {filterMode === 'ALL' && (
            <div className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              Mostrando todos os lançamentos — {transactions.length} no total
            </div>
          )}
        </div>
      </div>

      {selectedTxIds.size > 0 && (
        <div className="bg-rose-50 border border-rose-105 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-rose-700">
              {selectedTxIds.size} {selectedTxIds.size === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTxIds(new Set())}
              className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs transition-colors"
            >
              Limpar Seleção
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl font-bold text-xs transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir selecionados em massa
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar lançamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">Todas as Contas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">Todas as Categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">Todos os Tipos</option>
          <option value="RECEITA">Entrada / Receita</option>
          <option value="DESPESA">Saída / Despesa</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">Todos os Status</option>
          <option value="PENDENTE">Apenas Pendentes</option>
          <option value="AGENDADO">Apenas Agendados</option>
          <option value="CONCILIADO">Apenas Conciliados</option>
          <option value="IGNORADO">Apenas Ignorados</option>
        </select>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100">
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
                    onChange={handleSelectAllToggle}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-slate-600 transition-colors"
                  onClick={() => setSortAscending(!sortAscending)}
                >
                  <div className="flex items-center gap-1">
                    Data
                    <span className="text-xs">{sortAscending ? '↑' : '↓'}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Conta</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Descrição</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Nenhum lançamento no período filtrado.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => {
                  const account = accounts.find(a => a.id === t.accountId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTxIds.has(t.id)}
                          onChange={() => handleSelectTxToggle(t.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500 font-mono">
                        {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold text-[9px] uppercase tracking-wide">
                          <Building className="w-3 h-3 text-slate-400" />
                          {account ? account.name : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            {t.description}
                            {t.origin === 'AUTOMATICO' && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-500 font-extrabold text-[8px] uppercase tracking-wider rounded-md" title="Gerado automaticamente via Módulo de Comissões">
                                COMISSÃO AUTO
                              </span>
                            )}
                            {t.recurrenceGroupId && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 font-extrabold text-[8px] uppercase tracking-wider rounded-md" title="Lançamento Recorrente">
                                RECORRENTE
                              </span>
                            )}
                            {t.status === 'AGENDADO' && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 font-extrabold text-[8px] uppercase tracking-wider rounded-md" title="Transação Agendada">
                                AGENDADO
                              </span>
                            )}
                            {(t.installmentInfo || t.status === 'AGENDADO') && (
                              <span className="px-1.5 py-0.5 bg-violet-50 text-violet-650 font-extrabold text-[8px] uppercase tracking-wider rounded-md" title="Parcela de comissão futura">
                                PARCELA {t.installmentInfo ? `(${t.installmentInfo})` : ''}
                              </span>
                            )}
                          </p>
                          {t.notes && <p className="text-[10px] text-slate-400 mt-0.5">{t.notes}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {t.categoryName ? (
                          <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                            <Tag className="w-3.5 h-3.5 text-slate-300" />
                            {t.categoryName}
                          </span>
                        ) : (
                          <span className="text-slate-350 italic">Sem Categoria</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-right font-black ${t.type === 'RECEITA' ? 'text-teal-600' : 'text-rose-500'}`}>
                        {t.type === 'RECEITA' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {t.creditCardStatus ? (
                          <span 
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide select-none ${
                              t.creditCardStatus === 'FATURA_PAGA' ? 'bg-emerald-50 text-emerald-600' :
                              t.creditCardStatus === 'FATURA_FECHADA' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                              'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}
                            title={`Mês de Fatura: ${t.creditCardMonth}`}
                          >
                            {t.creditCardStatus === 'FATURA_PAGA' ? 'FATURA PAGA' :
                             t.creditCardStatus === 'FATURA_FECHADA' ? 'FATURA FECHADA' :
                             'FATURA ABERTA'}
                          </span>
                        ) : (
                          <span 
                            onClick={() => {
                              if (t.status === 'PENDENTE') {
                                onUpdateStatus(t.id, 'CONCILIADO');
                              } else if (t.status === 'AGENDADO') {
                                onUpdateStatus(t.id, 'PENDENTE');
                              } else if (t.status === 'CONCILIADO') {
                                onUpdateStatus(t.id, 'PENDENTE');
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide cursor-pointer transition-all hover:opacity-85 select-none ${
                              t.status === 'CONCILIADO' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50' :
                              t.status === 'AGENDADO' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200/50' :
                              t.status === 'IGNORADO' ? 'bg-slate-100 text-slate-400' :
                              t.status === 'CANCELADO' ? 'bg-rose-50 text-rose-500 hover:bg-rose-100/50' :
                              'bg-amber-50 text-amber-600 hover:bg-amber-100/50'
                            }`}
                            title="Clique para alterar o status"
                          >
                            {t.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!t.creditCardStatus && (t.status === 'PENDENTE' || t.status === 'AGENDADO') && (
                            <button
                              onClick={() => onUpdateStatus(t.id, 'CONCILIADO')}
                              className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-bold text-[10px] uppercase transition-colors"
                            >
                              Conciliar
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(t)}
                            className="p-1.5 text-slate-300 hover:text-blue-500 rounded-lg transition-colors"
                            title="Editar Lançamento"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(t)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                            title="Deletar Lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Receita / Despesa */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header fixo */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Lançar Movimentação</h3>
            </div>

            <form onSubmit={handleCreateTransaction} className="flex-1 flex flex-col overflow-hidden font-sans">
              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    disabled={accounts.find(a => a.id === txAccountId)?.accountType === 'CREDITO'}
                    onClick={() => { setTxType('RECEITA'); setTxCategoryId(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${(accounts.find(a => a.id === txAccountId)?.accountType === 'CREDITO') ? 'opacity-40 cursor-not-allowed' : ''} ${txType === 'RECEITA' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTxType('DESPESA'); setTxCategoryId(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${txType === 'DESPESA' ? 'bg-white text-rose-500 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Despesa
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 animate-fadeIn">Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data</label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-slate-700 text-center"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Conta Origem/Destivo</label>
                    <select
                      value={txAccountId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTxAccountId(val);
                        const acc = accounts.find(a => a.id === val);
                        if (acc?.accountType === 'CREDITO') {
                          setTxType('DESPESA');
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700"
                      required
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.accountType === 'CREDITO' ? ' [CARTÃO]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Categoria</label>
                    <select
                      value={txCategoryId}
                      onChange={(e) => setTxCategoryId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                      required
                    >
                      <option value="">Sem Categoria</option>
                      {filteredCategoriesAdd.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descrição</label>
                  <input
                    type="text"
                    placeholder="Ex: Pagamento IPTU filial ou Honorários"
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observações / Notas</label>
                  <textarea
                    placeholder="Informações complementares sobre este lançamento..."
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold h-16 resize-none"
                  />
                </div>

                {/* Toggle visual de Recorrência */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Lançamento recorrente?</p>
                    <p className="text-xs text-slate-400 font-medium">Repetir automaticamente por um período</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecorrente(!isRecorrente)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      isRecorrente ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isRecorrente ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Se toggle ativado, exibir os dois campos lado a lado e o resumo */}
                {isRecorrente && (
                  <div className="space-y-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1.5">Frequência</label>
                        <select
                          value={frequencia}
                          onChange={(e) => setFrequencia(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="SEMANAL">Semanal</option>
                          <option value="QUINZENAL">Quinzenal</option>
                          <option value="MENSAL">Mensal</option>
                          <option value="BIMESTRAL">Bimestral</option>
                          <option value="TRIMESTRAL">Trimestral</option>
                          <option value="SEMESTRAL">Semestral</option>
                          <option value="ANUAL">Anual</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1.5">Repetir por</label>
                        <select
                          value={repetirPor}
                          onChange={(e) => setRepetirPor(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="3">3 meses</option>
                          <option value="6">6 meses</option>
                          <option value="12">12 meses</option>
                          <option value="24">24 meses</option>
                          <option value="SEM_FIM">Sem fim</option>
                        </select>
                      </div>
                    </div>

                    {/* Resumo dinâmico */}
                    <div className="pt-2 border-t border-blue-100/70">
                      <p className="text-[11px] text-blue-600 font-bold tracking-tight animate-fadeIn">
                        Este lançamento será repetido {
                          ({
                            SEMANAL: 'semanalmente',
                            QUINZENAL: 'quinzenalmente',
                            MENSAL: 'mensalmente',
                            BIMESTRAL: 'bimestralmente',
                            TRIMESTRAL: 'trimestralmente',
                            SEMESTRAL: 'semestralmente',
                            ANUAL: 'anualmente'
                          }[frequencia] || 'mensalmente')
                        } — {getRecurrenceInstances(txDate, frequencia, repetirPor).length} ocorrências até {
                          (() => {
                            const dates = getRecurrenceInstances(txDate, frequencia, repetirPor);
                            const lastDate = dates[dates.length - 1];
                            return lastDate ? new Date(lastDate + 'T12:00:00').toLocaleDateString('pt-BR') : '';
                          })()
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé fixo */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {txType === 'RECEITA' ? 'Confirmar Receita' : 'Confirmar Despesa'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferência */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsTransferOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header fixo */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Transferência Bancária</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Transfira fundos entre suas contas operacionais</p>
            </div>

            <form onSubmit={handleCreateTransfer} className="flex-1 flex flex-col overflow-hidden font-sans">
              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor da Transferência</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="R$ 0,00"
                    value={tfAmount}
                    onChange={(e) => setTfAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-black"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Conta Origem</label>
                    <select
                      value={tfFrom}
                      onChange={(e) => setTfFrom(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700"
                      required
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 animate-fadeIn">Conta Destino</label>
                    <select
                      value={tfTo}
                      onChange={(e) => setTfTo(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700"
                      required
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data Movimentação</label>
                    <input
                      type="date"
                      value={tfDate}
                      onChange={(e) => setTfDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-slate-700 text-center"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descrição Padrão</label>
                    <input
                      type="text"
                      value={tfDesc}
                      onChange={(e) => setTfDesc(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-500 text-center"
                      required
                    />
                  </div>
                </div>

                {tfFrom === tfTo && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-500 text-[10px] font-bold">
                    <AlertCircle className="w-4 h-4" />
                    Conta de Origem e Destino devem ser diferentes.
                  </div>
                )}
              </div>

              {/* Rodapé fixo */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={tfFrom === tfTo}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  Concluir Transferência
                </button>
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Perguntas de Recorrência (Editar / Excluir) */}
      {recurrencePromptOpen && selectedRecurrenceTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRecurrencePromptOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl border border-slate-100 p-8 font-sans">
            <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">
              {recurrencePromptType === 'EDIT' ? 'Editar Recorrência' : 'Excluir Recorrência'}
            </h3>
            <p className="text-xs text-slate-500 font-bold mb-6">
              {recurrencePromptType === 'EDIT' 
                ? 'Este lançamento faz parte de um grupo recorrente. Como deseja editar?' 
                : 'Este lançamento faz parte de um grupo recorrente. Como deseja excluir?'}
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  if (recurrencePromptType === 'EDIT') {
                    setEditingTx(selectedRecurrenceTx);
                    setEditScope('SINGLE');
                    setIsEditOpen(true);
                  } else {
                    onDeleteTransaction(selectedRecurrenceTx.id);
                  }
                  setRecurrencePromptOpen(false);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-md transition-all text-center"
              >
                {recurrencePromptType === 'EDIT' ? 'Editar apenas este' : 'Excluir apenas este'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (recurrencePromptType === 'EDIT') {
                    setEditingTx(selectedRecurrenceTx);
                    setEditScope('UPCOMING');
                    setIsEditOpen(true);
                  } else {
                    const upcoming = transactions
                      .filter(item => item.recurrenceGroupId === selectedRecurrenceTx.recurrenceGroupId && item.date >= selectedRecurrenceTx.date)
                      .map(item => item.id);
                    onDeleteTransactions(upcoming);
                  }
                  setRecurrencePromptOpen(false);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-md transition-all text-center"
              >
                {recurrencePromptType === 'EDIT' ? 'Editar todos os próximos' : 'Excluir todos os próximos'}
              </button>

              <button
                type="button"
                onClick={() => setRecurrencePromptOpen(false)}
                className="w-full py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Movimentação */}
      {isEditOpen && editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setIsEditOpen(false); setEditingTx(null); }} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header fixo */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Editar Lançamento</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                {editScope === 'UPCOMING' ? 'Editando este e todos os próximos lançamentos da série' : 'Editando lançamento individual'}
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col overflow-hidden font-sans">
              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    disabled={accounts.find(a => a.id === editAccountId)?.accountType === 'CREDITO'}
                    onClick={() => { setEditType('RECEITA'); setEditCategoryId(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${(accounts.find(a => a.id === editAccountId)?.accountType === 'CREDITO') ? 'opacity-45 cursor-not-allowed' : ''} ${editType === 'RECEITA' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditType('DESPESA'); setEditCategoryId(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${editType === 'DESPESA' ? 'bg-white text-rose-500 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Despesa
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 animate-fadeIn">Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-black"
                      required
                    />
                  </div>

                  <div>
                    {editScope === 'UPCOMING' ? (
                      <div className="flex flex-col justify-center h-full">
                        <p className="text-[9px] text-blue-600 font-extrabold uppercase bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50">
                          As datas das ocorrências futuras serão preservadas.
                        </p>
                      </div>
                    ) : (
                      <>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-slate-700 text-center"
                          required
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Conta Origem/Destino</label>
                    <select
                      value={editAccountId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditAccountId(val);
                        const acc = accounts.find(a => a.id === val);
                        if (acc?.accountType === 'CREDITO') {
                          setEditType('DESPESA');
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700"
                      required
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.accountType === 'CREDITO' ? ' [CARTÃO]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Categoria</label>
                    <select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <option value="">Sem Categoria</option>
                      {filteredCategoriesEdit.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descrição</label>
                  <input
                    type="text"
                    placeholder="Ex: Pagamento IPTU filial ou Honorários"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                    required
                  >
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="AGENDADO">AGENDADO</option>
                    <option value="CONCILIADO">CONCILIADO</option>
                    <option value="CANCELADO">CANCELADO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observações / Notas</label>
                  <textarea
                    placeholder="Informações complementares sobre este lançamento..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold h-16 resize-none"
                  />
                </div>
              </div>

              {/* Rodapé fixo */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditOpen(false); setEditingTx(null); }}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmColor={confirmState.confirmColor}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};
