import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard as CreditCardIcon, 
  PlusCircle, 
  Building2, 
  PiggyBank, 
  Wallet,
  ArrowRight,
  ChevronRight,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash,
  AlertCircle,
  FileText,
  CheckCircle2,
  Calendar,
  X,
  Repeat,
  History,
  Clock,
  HelpCircle,
  ArrowRightCircle,
  CalendarPlus
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from 'recharts';
import { BankAccount, FinancialTransaction } from '../../types';
import { toast } from 'sonner';

interface DashboardTabProps {
  accounts: BankAccount[];
  transactions: FinancialTransaction[];
  onAddAccount: (
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
  ) => void;
  onUpdateAccount?: (
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
  ) => void;
  onDeleteAccount?: (id: string) => Promise<void>;
  onPayCreditCardInvoice?: (
    cardAccountId: string,
    statementMonth: string,
    sourceBankAccountId: string,
    paymentDate: string,
    totalAmount: number,
    cardTxIds: string[]
  ) => Promise<void>;
  onUpdateTransactions?: (items: { id: string; updates: Partial<FinancialTransaction> }[]) => Promise<void>;
}

const bankPresetColors: Record<string, string> = {
  SICOOB: '#00693e',
  CRESOL: '#f97316',
  INTER: '#ea580c',
  BRADESCO: '#cc092f',
  ITAU: '#ec7000',
  BANCO_DO_BRASIL: '#0038a8',
  NUBANK: '#820ad1',
  OUTRO: '#334155'
};

const bankNames: Record<string, string> = {
  SICOOB: 'Sicoob',
  CRESOL: 'Cresol',
  INTER: 'Inter',
  BRADESCO: 'Bradesco',
  ITAU: 'Itaú',
  BANCO_DO_BRASIL: 'Banco do Brasil',
  NUBANK: 'Nubank',
  OUTRO: 'Outro'
};

const colorPresets = [
  { name: 'Sicoob', color: '#00693e' },
  { name: 'Cresol', color: '#f97316' },
  { name: 'Inter', color: '#ea580c' },
  { name: 'Bradesco', color: '#cc092f' },
  { name: 'Itaú', color: '#ec7000' },
  { name: 'Banco do Brasil', color: '#0038a8' },
  { name: 'Nubank', color: '#820ad1' },
  { name: 'Outros', color: '#334155' }
];

export const DashboardTab: React.FC<DashboardTabProps> = ({ 
  accounts, 
  transactions, 
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onPayCreditCardInvoice,
  onUpdateTransactions
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  
  // Account Fields
  const [name, setName] = useState('');
  const [bank, setBank] = useState<'SICOOB' | 'CRESOL' | 'INTER' | 'BRADESCO' | 'ITAU' | 'BANCO_DO_BRASIL' | 'NUBANK' | 'OUTRO'>('SICOOB');
  const [agency, setAgency] = useState('');
  const [accountNum, setAccountNum] = useState('');
  const [balance, setBalance] = useState('');
  const [selectedColor, setSelectedColor] = useState('#00693e');
  const [accountType, setAccountType] = useState<'CORRENTE' | 'CREDITO'>('CORRENTE');
  
  // Card Specific Fields
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD'>('VISA');
  const [totalLimit, setTotalLimit] = useState('');
  const [closingDay, setClosingDay] = useState(10);
  const [dueDay, setDueDay] = useState(15);

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // States for Credit Card Invoices View
  const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<BankAccount | null>(null);
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState<string>('');
  const [isPayingInvoiceOpen, setIsPayingInvoiceOpen] = useState(false);
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // States for Moving Invoices & Recurrence Dialog
  const [txToMove, setTxToMove] = useState<FinancialTransaction | null>(null);
  const [recurrentOccurrences, setRecurrentOccurrences] = useState<FinancialTransaction[]>([]);
  const [isMovingTx, setIsMovingTx] = useState(false);
  const [activeTxMenuId, setActiveTxMenuId] = useState<string | null>(null);
  const [viewHistoryTx, setViewHistoryTx] = useState<FinancialTransaction | null>(null);

  const openModifyModal = (acc?: BankAccount) => {
    if (acc) {
      setEditingAccount(acc);
      setName(acc.name);
      setBank(acc.bank);
      setAgency(acc.agency || '');
      setAccountNum(acc.account || '');
      
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(acc.balance);
      setBalance(formatted);
      setSelectedColor(acc.color || bankPresetColors[acc.bank] || '#334155');
      setAccountType(acc.accountType || 'CORRENTE');
      setCardBrand(acc.cardBrand || 'VISA');
      setTotalLimit(acc.totalLimit ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.totalLimit) : '');
      setClosingDay(acc.closingDay || 10);
      setDueDay(acc.dueDay || 15);
    } else {
      setEditingAccount(null);
      setName('');
      setBank('SICOOB');
      setAgency('');
      setAccountNum('');
      setBalance('');
      setSelectedColor('#00693e');
      setAccountType('CORRENTE');
      setCardBrand('VISA');
      setTotalLimit('');
      setClosingDay(10);
      setDueDay(15);
    }
    setIsAddOpen(true);
  };

  // KPIs & Metrics Calculations
  const metrics = useMemo(() => {
    let rawReceitas = 0;
    let rawDespesas = 0;
    let openInvoicesTotal = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    transactions.forEach(t => {
      if (t.status === 'IGNORADO') return;
      
      // Calculate current month's revenues and expenses
      const tDate = new Date(t.date + 'T00:00:00');
      const isCurrentMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;

      if (isCurrentMonth) {
        if (t.type === 'RECEITA') {
          rawReceitas += Math.abs(t.amount);
        } else if (t.type === 'DESPESA') {
          rawDespesas += Math.abs(t.amount);
        }
      }

      // Sum all unresolved credit card transactions
      if (t.creditCardStatus && t.creditCardStatus !== 'FATURA_PAGA') {
        openInvoicesTotal += Math.abs(t.amount);
      }
    });

    const totalBankBalance = accounts
      .filter(a => a.accountType !== 'CREDITO')
      .reduce((acc, curr) => acc + curr.balance, 0);

    return {
      receitas: rawReceitas,
      despesas: rawDespesas,
      liquido: rawReceitas - rawDespesas,
      consolidado: totalBankBalance,
      openInvoices: openInvoicesTotal
    };
  }, [accounts, transactions]);

  // Chart Data
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();

    const data = months.map((m) => ({
      name: m,
      Receitas: 0,
      Despesas: 0
    }));

    transactions.forEach(t => {
      if (t.status === 'IGNORADO') return;
      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate.getFullYear() === currentYear) {
        const monthIndex = tDate.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          if (t.type === 'RECEITA') {
            data[monthIndex].Receitas += Math.abs(t.amount);
          } else if (t.type === 'DESPESA') {
            data[monthIndex].Despesas += Math.abs(t.amount);
          }
        }
      }
    });

    // Arredondamento para 2 casas decimais para evitar dízimas de ponto flutuante
    return data.map(d => ({
      ...d,
      Receitas: Math.round(d.Receitas * 100) / 100,
      Despesas: Math.round(d.Despesas * 100) / 100
    }));
  }, [transactions]);

  // Category Distribution
  const categoryDistribution = useMemo(() => {
    const dist: Record<string, { name: string; amount: number; color: string; type: string }> = {};

    transactions.forEach(t => {
      if (t.status === 'IGNORADO') return;
      const catName = t.categoryName || 'Indefinido';
      const key = `${t.type}_${catName}`;

      if (!dist[key]) {
        dist[key] = {
          name: catName,
          amount: 0,
          color: t.type === 'RECEITA' ? '#10B981' : '#EF4444',
          type: t.type
        };
      }
      dist[key].amount += Math.abs(t.amount);
    });

    return Object.values(dist).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    if (accountType !== 'CREDITO' && (!agency || !accountNum)) return;
    if (accountType === 'CREDITO' && !totalLimit) return;
    
    const cleanVal = balance.replace(/\D/g, "");
    const parsedBalance = cleanVal ? parseFloat(cleanVal) / 100 : 0;

    const cleanLimit = totalLimit.replace(/\D/g, "");
    const parsedLimit = cleanLimit ? parseFloat(cleanLimit) / 100 : 0;
    
    if (editingAccount) {
      if (onUpdateAccount) {
        onUpdateAccount(
          editingAccount.id, 
          name, 
          bank, 
          accountType === 'CREDITO' ? '' : agency, 
          accountType === 'CREDITO' ? '' : accountNum, 
          parsedBalance, 
          selectedColor,
          accountType,
          accountType === 'CREDITO' ? cardBrand : undefined,
          accountType === 'CREDITO' ? parsedLimit : undefined,
          accountType === 'CREDITO' ? closingDay : undefined,
          accountType === 'CREDITO' ? dueDay : undefined
        );
      }
    } else {
      onAddAccount(
        name, 
        bank, 
        accountType === 'CREDITO' ? '' : agency, 
        accountType === 'CREDITO' ? '' : accountNum, 
        parsedBalance, 
        selectedColor,
        accountType,
        accountType === 'CREDITO' ? cardBrand : undefined,
        accountType === 'CREDITO' ? parsedLimit : undefined,
        accountType === 'CREDITO' ? closingDay : undefined,
        accountType === 'CREDITO' ? dueDay : undefined
      );
    }
    
    setName('');
    setBank('SICOOB');
    setAgency('');
    setAccountNum('');
    setBalance('');
    setSelectedColor('#00693e');
    setAccountType('CORRENTE');
    setCardBrand('VISA');
    setTotalLimit('');
    setClosingDay(10);
    setDueDay(15);
    setEditingAccount(null);
    setIsAddOpen(false);
  };

  const bankColors: Record<string, string> = {
    SICOOB: 'bg-[#00693e]',
    CRESOL: 'bg-[#f97316]',
    INTER: 'bg-[#ea580c]',
    BRADESCO: 'bg-[#cc092f]',
    ITAU: 'bg-[#ec7000]',
    BANCO_DO_BRASIL: 'bg-[#0038a8]',
    NUBANK: 'bg-[#820ad1]',
    OUTRO: 'bg-slate-700'
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Credit Card invoice list filters
  const currentMonthYM = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  }, []);

  const uniqueInvoiceMonths = useMemo(() => {
    if (!selectedCardForInvoice) return [];
    const cardTxs = transactions.filter(t => t.accountId === selectedCardForInvoice.id && t.creditCardMonth);
    const monthsSet = new Set(cardTxs.map(t => t.creditCardMonth!));
    // Always include the current vigent month in the options list
    monthsSet.add(currentMonthYM);
    return Array.from(monthsSet).sort().reverse();
  }, [selectedCardForInvoice, transactions, currentMonthYM]);

  // When opening or changing card invoice panel, automatically default to the current vigent month
  useEffect(() => {
    if (selectedCardForInvoice) {
      setSelectedInvoiceMonth(currentMonthYM);
    } else {
      setSelectedInvoiceMonth('');
    }
  }, [selectedCardForInvoice?.id, currentMonthYM]);

  const invoiceTransactions = useMemo(() => {
    if (!selectedCardForInvoice || !selectedInvoiceMonth) return [];
    return transactions.filter(
      t => t.accountId === selectedCardForInvoice.id && 
           t.creditCardMonth === selectedInvoiceMonth && 
           t.status !== 'IGNORADO'
    );
  }, [selectedCardForInvoice, selectedInvoiceMonth, transactions]);

  const invoiceTotal = useMemo(() => {
    return invoiceTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  }, [invoiceTransactions]);

  const isInvoicePaid = useMemo(() => {
    if (invoiceTransactions.length === 0) return false;
    return invoiceTransactions.every(t => t.creditCardStatus === 'FATURA_PAGA');
  }, [invoiceTransactions]);

  // Handle pay invoice submission
  const handleConfirmInvoicePayment = async () => {
    if (!selectedCardForInvoice || !selectedInvoiceMonth || !paymentSourceAccountId) {
      toast.error("Por favor, selecione uma conta de pagamento.");
      return;
    }
    if (onPayCreditCardInvoice) {
      const cardTxIds = invoiceTransactions.map(t => t.id);
      await onPayCreditCardInvoice(
        selectedCardForInvoice.id,
        selectedInvoiceMonth,
        paymentSourceAccountId,
        paymentDate,
        invoiceTotal,
        cardTxIds
      );
      setIsPayingInvoiceOpen(false);
      setSelectedCardForInvoice(null);
    }
  };

  const getNextDueDate = (dueDay: number) => {
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    if (today.getDate() > dueDay) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return `${dueDay.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
  };

  const formatMonthName = (yearYm: string) => {
    if (!yearYm) return '';
    const [year, month] = yearYm.split('-');
    const monthsPortuguese = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthsPortuguese[parseInt(month) - 1]} / ${year}`;
  };

  const formatMonthShort = (yearYm: string) => {
    if (!yearYm) return '';
    const [year, month] = yearYm.split('-');
    const monthAbbrs = [
      'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
      'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
    ];
    const mIndex = parseInt(month, 10) - 1;
    return `${monthAbbrs[mIndex] || month}/${year}`;
  };

  const getNextStatementMonth = (monthStr: string): string => {
    if (!monthStr) {
      const today = new Date();
      monthStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    const [yearStr, mStr] = monthStr.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(mStr, 10);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return `${year}-${month.toString().padStart(2, '0')}`;
  };

  const cleanDescriptionForRecurrence = (desc: string): string => {
    if (!desc) return '';
    return desc
      .replace(/[\(\[\{]?\s*\d{1,2}\s*[\/\-de]\s*\d{1,2}\s*[\)\]\}]?/gi, '') // remove (01/12), 11/12, etc
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  };

  const findSubsequentRecurrentOccurrences = (
    targetTx: FinancialTransaction,
    allTransactions: FinancialTransaction[]
  ): FinancialTransaction[] => {
    if (!targetTx) return [];
    
    const targetBaseDesc = cleanDescriptionForRecurrence(targetTx.description);
    const targetMonth = targetTx.creditCardMonth || targetTx.date.substring(0, 7);

    const matched = allTransactions.filter(t => {
      if (t.id === targetTx.id) return false;
      if (t.accountId !== targetTx.accountId) return false;
      if (t.status === 'IGNORADO' || t.status === 'CANCELADO') return false;

      // Match by explicit recurrence group or clean base description
      const hasGroupMatch = Boolean(
        targetTx.recurrenceGroupId && 
        t.recurrenceGroupId && 
        t.recurrenceGroupId === targetTx.recurrenceGroupId
      );

      const tBaseDesc = cleanDescriptionForRecurrence(t.description);
      const hasDescMatch = Boolean(targetBaseDesc && tBaseDesc && (
        tBaseDesc === targetBaseDesc ||
        tBaseDesc.includes(targetBaseDesc) ||
        targetBaseDesc.includes(tBaseDesc)
      ));

      if (!hasGroupMatch && !hasDescMatch) return false;

      // Filter to occurrences in the same month (later date) or subsequent months
      const tMonth = t.creditCardMonth || t.date.substring(0, 7);
      if (tMonth > targetMonth) return true;
      if (tMonth === targetMonth && t.date > targetTx.date) return true;

      return false;
    });

    return matched.sort((a, b) => {
      const monthA = a.creditCardMonth || a.date;
      const monthB = b.creditCardMonth || b.date;
      return monthA.localeCompare(monthB);
    });
  };

  const handleInitiateMove = (tx: FinancialTransaction) => {
    setActiveTxMenuId(null);
    const subsequent = findSubsequentRecurrentOccurrences(tx, transactions);
    setTxToMove(tx);
    setRecurrentOccurrences(subsequent);
  };

  const handleExecuteMoveSingle = async (tx: FinancialTransaction) => {
    if (!onUpdateTransactions) {
      toast.error("Função de atualização de transações não disponível.");
      return;
    }
    try {
      setIsMovingTx(true);
      const currentMonth = tx.creditCardMonth || selectedInvoiceMonth || `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
      const nextMonth = getNextStatementMonth(currentMonth);
      
      const newHistoryLog = [
        ...(tx.movedHistory || []),
        {
          fromMonth: currentMonth,
          toMonth: nextMonth,
          movedAt: new Date().toISOString()
        }
      ];

      const updates: Partial<FinancialTransaction> = {
        creditCardMonth: nextMonth,
        movedFromMonth: tx.movedFromMonth || currentMonth,
        movedAt: new Date().toISOString(),
        movedHistory: newHistoryLog
      };

      await onUpdateTransactions([{ id: tx.id, updates }]);
      toast.success(`Lançamento movido para a fatura de ${formatMonthName(nextMonth)}!`);
      setTxToMove(null);
      setRecurrentOccurrences([]);
    } catch (err: any) {
      console.error("Erro ao mover lançamento:", err);
      toast.error("Erro ao mover lançamento para a próxima fatura.");
    } finally {
      setIsMovingTx(false);
    }
  };

  const handleExecuteMoveAll = async (tx: FinancialTransaction, subsequentList: FinancialTransaction[]) => {
    if (!onUpdateTransactions) {
      toast.error("Função de atualização de transações não disponível.");
      return;
    }
    try {
      setIsMovingTx(true);
      const updatesPayload: { id: string; updates: Partial<FinancialTransaction> }[] = [];

      // 1. Move target transaction
      const currentMonth = tx.creditCardMonth || selectedInvoiceMonth || `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
      const nextMonth = getNextStatementMonth(currentMonth);
      const targetHistory = [
        ...(tx.movedHistory || []),
        {
          fromMonth: currentMonth,
          toMonth: nextMonth,
          movedAt: new Date().toISOString(),
          reason: 'Movimentação em cascata da série recorrente'
        }
      ];
      updatesPayload.push({
        id: tx.id,
        updates: {
          creditCardMonth: nextMonth,
          movedFromMonth: tx.movedFromMonth || currentMonth,
          movedAt: new Date().toISOString(),
          movedHistory: targetHistory
        }
      });

      // 2. Move each subsequent occurrence one month forward to maintain sequence
      subsequentList.forEach(subTx => {
        const subCurrMonth = subTx.creditCardMonth || subTx.date.substring(0, 7);
        const subNextMonth = getNextStatementMonth(subCurrMonth);
        const subHistory = [
          ...(subTx.movedHistory || []),
          {
            fromMonth: subCurrMonth,
            toMonth: subNextMonth,
            movedAt: new Date().toISOString(),
            reason: 'Movimentação em cascata da série recorrente'
          }
        ];
        updatesPayload.push({
          id: subTx.id,
          updates: {
            creditCardMonth: subNextMonth,
            movedFromMonth: subTx.movedFromMonth || subCurrMonth,
            movedAt: new Date().toISOString(),
            movedHistory: subHistory
          }
        });
      });

      await onUpdateTransactions(updatesPayload);
      toast.success(`${updatesPayload.length} lançamentos da série foram movidos para as faturas seguintes!`);
      setTxToMove(null);
      setRecurrentOccurrences([]);
    } catch (err: any) {
      console.error("Erro ao mover lançamentos em cascata:", err);
      toast.error("Erro ao mover as ocorrências da série recorrente.");
    } finally {
      setIsMovingTx(false);
    }
  };

  const handleExportPDF = () => {
    if (!selectedCardForInvoice) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Por favor, permita popups para exportar o PDF de Fatura.");
      return;
    }

    const titleMonth = formatMonthName(selectedInvoiceMonth);
    const rowsHtml = invoiceTransactions.map(t => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 10px 0; color: #475569;">${t.date.split('-').reverse().join('/')}</td>
        <td style="padding: 10px 0; font-weight: 500; color: #1e293b;">${t.description}</td>
        <td style="padding: 10px 0; color: #475569;">${t.categoryName || 'Sem categoria'}</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #ef4444;">- R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura ${selectedCardForInvoice.name} - ${titleMonth}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; }
            .sub { color: #64748b; font-size: 14px; margin-top: 4px; }
            .card-info { background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; font-size: 14px; }
            .label { font-weight: 600; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            .val { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            .total-box { background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: right; }
            .total-title { font-size: 13px; font-weight: 700; color: #475569; }
            .total-val { font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Fatura de Cartão de Crédito</div>
              <div class="sub">ImobiFlow Financial System</div>
            </div>
            <div style="text-align: right;">
              <div class="val" style="font-size: 18px;">${selectedCardForInvoice.name}</div>
              <div class="sub">Competência: ${titleMonth}</div>
            </div>
          </div>

          <div class="card-info">
            <div>
              <div class="label">Bandeira</div>
              <div class="val">${selectedCardForInvoice.cardBrand || 'VISA'}</div>
            </div>
            <div>
              <div class="label">Status</div>
              <div class="val">${isInvoicePaid ? 'PAGA' : 'EM ABERTO'}</div>
            </div>
            <div>
              <div class="label">Dia de Vencimento</div>
              <div class="val">Dia ${selectedCardForInvoice.dueDay || 15}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum lançamento nesta fatura.</td></tr>'}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-title">VALOR TOTAL DA FATURA</div>
            <div class="total-val">R$ ${invoiceTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-2 -translate-y-2">
            <Wallet className="w-24 h-24" />
          </div>
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Saldo Consolidado</p>
          <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            {formatCurrency(metrics.consolidado)}
          </p>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-emerald-600 font-bold bg-emerald-50 w-fit px-2.5 py-1 rounded-full uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Contas Ativas
          </div>

          {metrics.openInvoices > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between group/tooltip relative">
              <span className="text-[10.5px] text-orange-600 font-black flex items-center gap-1 cursor-help tracking-tight uppercase">
                <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                Faturas em aberto: {formatCurrency(metrics.openInvoices)}
              </span>
              <div className="absolute opacity-0 group-hover/tooltip:opacity-100 pointer-events-none bottom-full left-1/4 mb-2 bg-slate-900 text-white text-[9.5px] font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xl z-50 transition-all">
                Este valor será debitado nas próximas datas de vencimento.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Receitas do Mês</p>
          <p className="text-2xl font-black text-emerald-600 mt-2 tracking-tight">
            {formatCurrency(metrics.receitas)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-emerald-500 font-bold uppercase">
            <TrendingUp className="w-3.5 h-3.5" />
            Entradas Operacionais
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Despesas do Mês</p>
          <p className="text-2xl font-black text-rose-500 mt-2 tracking-tight">
            {formatCurrency(metrics.despesas)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-rose-500 font-bold uppercase">
            <TrendingDown className="w-3.5 h-3.5" />
            Gastos Totais
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">Saldo Líquido Mensal</p>
          <p className={`text-2xl font-black mt-2 tracking-tight ${metrics.liquido >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
            {formatCurrency(metrics.liquido)}
          </p>
          <div className="flex items-center gap-1 mt-3 text-[10px] font-bold text-slate-500 uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Resultado operacional
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Accounts & Credit Cards */}
        <div className="lg:col-span-1 space-y-6">
          {/* Bank Accounts Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Minhas Contas</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Saldos atuais agregados</p>
              </div>
              <button
                onClick={() => openModifyModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs transition-colors"
                id="btn-add-account"
              >
                <PlusCircle className="w-4 h-4" />
                Cadastrar
              </button>
            </div>

            <div className="space-y-3">
              {accounts.filter(a => a.accountType !== 'CREDITO').map(account => {
                const bgClass = bankColors[account.bank] || bankColors.OUTRO;
                const hasCustomColor = !!account.color;
                const linkedCount = transactions.filter(t => t.accountId === account.id && t.status !== 'IGNORADO').length;
                const isConfirmingDelete = confirmingDeleteId === account.id;
                const isDeletingCard = deletingId === account.id;

                if (isConfirmingDelete) {
                  return (
                    <div 
                      key={account.id} 
                      className={`relative p-5 rounded-2xl bg-rose-900 border border-rose-950 text-white shadow-lg space-y-3 transition-all duration-300 ${
                        isDeletingCard ? 'animate-fadeOut scale-95 opacity-0' : 'animate-fadeIn'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                        <div>
                          {linkedCount > 0 ? (
                            <>
                              <h4 className="text-xs font-bold uppercase tracking-wide text-rose-200">Não é possível excluir</h4>
                              <p className="text-[11px] font-semibold text-rose-100 mt-1">
                                Esta conta possui {linkedCount} lançamento{linkedCount > 1 ? 's' : ''} vinculado{linkedCount > 1 ? 's' : ''}. Remova os lançamentos antes de excluir.
                              </p>
                            </>
                          ) : (
                            <>
                              <h4 className="text-xs font-bold uppercase tracking-wide text-rose-200">Confirmar Exclusão</h4>
                              <p className="text-[11px] font-semibold text-rose-100 mt-1 leading-tight">
                                Tem certeza? Esta ação não pode ser desfeita.
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end pt-2 border-t border-white/10">
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors"
                        >
                          Cancelar
                        </button>
                        {linkedCount === 0 && (
                          <button
                            onClick={async () => {
                              setDeletingId(account.id);
                              setTimeout(async () => {
                                if (onDeleteAccount) {
                                  await onDeleteAccount(account.id);
                                }
                                setConfirmingDeleteId(null);
                                setDeletingId(null);
                              }, 300);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-colors"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={account.id} 
                    className={`relative p-5 rounded-2xl text-white shadow-lg border border-white/10 transition-all ${
                      isDeletingCard ? 'animate-fadeOut scale-95 opacity-0' : 'animate-fadeIn'
                    } ${!hasCustomColor ? bgClass : ''}`}
                    style={hasCustomColor ? { backgroundColor: account.color } : undefined}
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownId(activeDropdownId === account.id ? null : account.id);
                        }}
                        className="p-1 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {activeDropdownId === account.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-25" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(null);
                            }} 
                          />
                          <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-30 animate-fadeIn text-slate-800 text-left">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(null);
                                openModifyModal(account);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-all text-slate-705"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              Editar conta
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(null);
                                setConfirmingDeleteId(account.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-rose-50 text-rose-600 transition-all"
                            >
                              <Trash className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              Excluir conta
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-start justify-between mr-6">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-md font-sans">
                          {bankNames[account.bank] || account.bank}
                        </span>
                        <h4 className="text-sm font-black tracking-tight mt-2">{account.name}</h4>
                        <p className="text-[10px] font-mono opacity-85 mt-1">
                          Ag: {account.agency} · C/C: {account.account}
                        </p>
                      </div>
                      <div className="flex flex-col items-end whitespace-nowrap">
                        <span className="text-[11px] font-black tracking-wider text-white bg-black/15 px-2 py-1 rounded select-none uppercase font-mono">
                          {account.bank}
                        </span>
                        <Building2 className="w-6 h-6 opacity-25 mt-3" />
                      </div>
                    </div>
                    <div className="flex items-end justify-between mt-6 pt-3 border-t border-white/10">
                      <span className="text-[9px] opacity-75 font-semibold text-white/90">SALDO DISPONÍVEL</span>
                      <span className="text-base font-black tracking-tight">{formatCurrency(account.balance)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Credit Cards Section */}
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Meus Cartões de Crédito</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Gestão de faturas e limites</p>
            </div>

            <div className="space-y-3">
              {accounts.filter(a => a.accountType === 'CREDITO').length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-3xl p-6 text-center text-slate-450">
                  <p className="text-xs font-bold uppercase tracking-tight text-slate-400">Nenhum cartão cadastrado</p>
                  <p className="text-[10px] text-slate-400 mt-1">Clique em "Cadastrar" acima para adicionar um cartão de crédito.</p>
                </div>
              ) : (
                accounts.filter(a => a.accountType === 'CREDITO').map(account => {
                  const hasCustomColor = !!account.color;
                  const bgClass = bankColors[account.bank] || bankColors.OUTRO;
                  const total = account.totalLimit || 1;
                  const available = account.balance;
                  const used = Math.max(0, total - available);
                  const pct = Math.min(100, (used / total) * 100);

                  // Color Code calculations
                  const progressColor = pct <= 50 ? 'bg-emerald-500' : pct <= 80 ? 'bg-amber-400' : 'bg-rose-500';

                  const isConfirmingDelete = confirmingDeleteId === account.id;
                  const isDeletingCard = deletingId === account.id;

                  if (isConfirmingDelete) {
                    return (
                      <div 
                        key={account.id} 
                        className="p-5 rounded-2xl bg-rose-900 border border-rose-950 text-white shadow-lg space-y-3 animate-fadeIn"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wide text-rose-200 font-sans">Excluir Cartão</h4>
                            <p className="text-[11px] font-semibold text-rose-100 mt-1 leading-tight">
                              Tem certeza que deseja excluir este cartão do sistema? Todos os lançamentos vinculados permanecerão existindo.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end pt-2 border-t border-white/10">
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={async () => {
                              setDeletingId(account.id);
                              setTimeout(async () => {
                                if (onDeleteAccount) {
                                  await onDeleteAccount(account.id);
                                }
                                setConfirmingDeleteId(null);
                                setDeletingId(null);
                              }, 300);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-colors"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={account.id}
                      onClick={() => {
                        setSelectedCardForInvoice(account);
                      }}
                      className={`relative p-5 rounded-3xl text-white shadow-xl border border-white/10 cursor-pointer hover:scale-[1.015] active:scale-95 active:duration-75 transition-all group overflow-hidden ${
                        isDeletingCard ? 'animate-fadeOut scale-95 opacity-0' : 'animate-fadeIn'
                      } ${!hasCustomColor ? bgClass : ''}`}
                      style={hasCustomColor ? { backgroundColor: account.color } : undefined}
                    >
                      {/* Grid overlay for credit card styling */}
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

                      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === account.id ? null : account.id);
                          }}
                          className="p-1 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-all"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeDropdownId === account.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-25" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(null);
                              }} 
                            />
                            <div className="absolute right-0 mt-9 w-36 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-30 animate-fadeIn text-slate-800 text-left">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(null);
                                  openModifyModal(account);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-all text-slate-705"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                Editar cartão
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(null);
                                  setConfirmingDeleteId(account.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-rose-50 text-rose-600 transition-all"
                              >
                                <Trash className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                Excluir cartão
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Card Content Header */}
                      <div className="flex items-start justify-between mr-6">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-md font-sans">
                            CARTÃO · {account.cardBrand || 'VISA'}
                          </span>
                          <h4 className="text-sm font-black tracking-tight mt-2">{account.name}</h4>
                          <p className="text-[10px] font-semibold opacity-75 mt-1">
                            Vence dia: <span className="font-extrabold text-white underline">{account.dueDay || 15}</span> · Fecha dia: {account.closingDay || 10}
                          </p>
                        </div>
                        <div className="flex flex-col items-end whitespace-nowrap">
                          <span className="text-[10px] font-black tracking-wider text-white bg-black/15 px-2 py-1 rounded select-none uppercase font-mono">
                            {account.bank}
                          </span>
                          <CreditCardIcon className="w-6 h-6 opacity-40 mt-3 animate-pulse" />
                        </div>
                      </div>

                      {/* Limit Progress */}
                      <div className="mt-4 space-y-1.5 pt-3 border-t border-white/10">
                        <div className="flex justify-between text-[9px] font-black opacity-85 uppercase tracking-wide">
                          <span>Limite Usado: {formatCurrency(used)} ({pct.toFixed(0)}%)</span>
                          <span>Disponível: {formatCurrency(available)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Next Due Date highlighted */}
                      <div className="flex items-center justify-between mt-3 pt-3 text-[10px] bg-black/10 -mx-5 -mb-5 px-5 py-2.5 font-bold">
                        <span className="text-white/80 font-sans uppercase">PRÓXIMO VENCIMENTO:</span>
                        <span className="text-[11px] font-extrabold text-white font-mono bg-white/10 px-2 py-0.5 rounded-md">
                          {getNextDueDate(account.dueDay || 15)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Chart Section */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-900 tracking-tight uppercase">Entradas vs Saídas Mensais</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Exercício de {new Date().getFullYear()}</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                    contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)', fontSize: '12px', padding: '10px 14px' }}
                    formatter={(value: any, name: any) => [
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0),
                      name === 'Receitas' ? 'Receitas' : 'Despesas'
                    ]}
                  />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Categories performance distribution row */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 animate-fadeIn">
        <div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Performance por Categoria</h3>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Volume acumulado por classificação operacional</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Receitas distribution */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 tracking-wider uppercase flex items-center gap-2 font-sans text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Distribuição de Receitas
            </h4>
            <div className="space-y-3">
              {categoryDistribution.filter(c => c.type === 'RECEITA').length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma receita registrada.</p>
              ) : (
                categoryDistribution.filter(c => c.type === 'RECEITA').slice(0, 5).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{item.name}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full animate-progress" style={{ width: '100%' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Despesas distribution */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 tracking-wider uppercase flex items-center gap-2 font-sans text-rose-500">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Distribuição de Despesas
            </h4>
            <div className="space-y-3">
              {categoryDistribution.filter(c => c.type === 'DESPESA').length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma despesa registrada.</p>
              ) : (
                categoryDistribution.filter(c => c.type === 'DESPESA').slice(0, 5).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{item.name}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: New/Edit Bank Account or Credit Card */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0 font-sans">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {editingAccount ? 'Editar Conta / Cartão' : 'Nova Conta Bancária'}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                {editingAccount ? 'Altere os dados de registro' : 'Adicione contas operacionais ativas ou cartões'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden font-sans">
              {/* Form Content */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                {/* Account Type Selector */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo de Conta</label>
                  <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      disabled={!!editingAccount}
                      onClick={() => setAccountType('CORRENTE')}
                      className={`flex-1 py-1.5 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all ${
                        editingAccount && accountType !== 'CORRENTE' ? 'opacity-50 cursor-not-allowed' : ''
                      } ${accountType === 'CORRENTE' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Conta Corrente
                    </button>
                    <button
                      type="button"
                      disabled={!!editingAccount}
                      onClick={() => setAccountType('CREDITO')}
                      className={`flex-1 py-1.5 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all ${
                        editingAccount && accountType !== 'CREDITO' ? 'opacity-50 cursor-not-allowed' : ''
                      } ${accountType === 'CREDITO' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Cartão de Crédito
                    </button>
                  </div>
                </div>

                {/* Account / Card Name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    {accountType === 'CREDITO' ? 'Nome do Cartão' : 'Identificação / Apelido'}
                  </label>
                  <input
                    type="text"
                    placeholder={accountType === 'CREDITO' ? 'Ex: Nubank PJ, Inter Black' : 'Ex: Sicoob PJ Principal'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold text-slate-800"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Institution */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Instituição Financeira</label>
                    <select
                      value={bank}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setBank(val);
                        setSelectedColor(bankPresetColors[val] || '#334155');
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <option value="SICOOB">Sicoob</option>
                      <option value="CRESOL">Cresol</option>
                      <option value="INTER">Inter</option>
                      <option value="BRADESCO">Bradesco</option>
                      <option value="ITAU">Itaú</option>
                      <option value="BANCO_DO_BRASIL">Banco do Brasil</option>
                      <option value="NUBANK">Nubank</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                  </div>

                  {/* Standard checking account block / Credit Card Available block */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      {accountType === 'CREDITO' ? 'Limite disponível atual' : (editingAccount ? 'Saldo Atual' : 'Saldo Inicial')}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-extrabold text-xs pointer-events-none">
                        R$
                      </div>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={balance}
                        onChange={(e) => {
                          const rawUnit = e.target.value;
                          const cleanUnit = rawUnit.replace(/\D/g, "");
                          if (!cleanUnit) {
                            setBalance("");
                            return;
                          }
                          const bValue = parseFloat(cleanUnit) / 100;
                          const formatted = new Intl.NumberFormat("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(bValue);
                          setBalance(formatted);
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-black text-slate-800"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Account Type Conditional fields */}
                {accountType === 'CORRENTE' ? (
                  <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Agência</label>
                      <input
                        type="text"
                        placeholder="Ex: 3007"
                        value={agency}
                        onChange={(e) => setAgency(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-extrabold text-slate-700 text-center"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Conta</label>
                      <input
                        type="text"
                        placeholder="Ex: 12560-1"
                        value={accountNum}
                        onChange={(e) => setAccountNum(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-extrabold text-slate-700 text-center"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 pt-4 space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Card Brand Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bandeira do Cartão</label>
                        <select
                          value={cardBrand}
                          onChange={(e) => setCardBrand(e.target.value as any)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="VISA">Visa</option>
                          <option value="MASTERCARD">Mastercard</option>
                          <option value="ELO">Elo</option>
                          <option value="AMEX">Amex</option>
                          <option value="HIPERCARD">Hipercard</option>
                        </select>
                      </div>

                      {/* Total Limit Field */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Limite Total</label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-extrabold text-xs pointer-events-none">
                            R$
                          </div>
                          <input
                            type="text"
                            placeholder="10.000,00"
                            value={totalLimit}
                            onChange={(e) => {
                              const rawUnit = e.target.value;
                              const cleanUnit = rawUnit.replace(/\D/g, "");
                              if (!cleanUnit) {
                                setTotalLimit("");
                                return;
                              }
                              const bValue = parseFloat(cleanUnit) / 100;
                              const formatted = new Intl.NumberFormat("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(bValue);
                              setTotalLimit(formatted);
                            }}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-black text-slate-850"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Statement Closing Day */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data de Fechamento</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={closingDay}
                          onChange={(e) => setClosingDay(parseInt(e.target.value) || 10)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-extrabold text-slate-700 text-center"
                          required
                        />
                      </div>

                      {/* Statement Due Day */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data de Vencimento</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={dueDay}
                          onChange={(e) => setDueDay(parseInt(e.target.value) || 15)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-extrabold text-slate-700 text-center"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Card visual picker colors */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cor Temática Visual</label>
                  <div className="flex items-center gap-2 flex-wrap bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {colorPresets.map(p => (
                      <button
                        key={p.color}
                        type="button"
                        onClick={() => setSelectedColor(p.color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 shrink-0 ${
                          selectedColor === p.color ? 'border-blue-500 ring-2 ring-blue-400/20 shadow-sm' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                      />
                    ))}
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full border border-slate-250 bg-white overflow-hidden cursor-pointer hover:border-slate-350 transition-colors shrink-0">
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <span className="text-[9px] font-black text-slate-500 uppercase select-none font-sans">Picker</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95 duration-100"
                >
                  {editingAccount ? 'Salvar Edições' : 'Cadastrar Registro'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingAccount(null);
                  }}
                  className="w-full py-4 bg-slate-150 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Card Invoices Screen and Transaction Statement Overlay */}
      {selectedCardForInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSelectedCardForInvoice(null)} />
          <div className="relative bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex-shrink-0 bg-white">
              <div className="flex items-center justify-between gap-3">
                {/* Card Brand & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <CreditCardIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
                      Cartão: {selectedCardForInvoice.name}
                    </h3>
                  </div>
                </div>

                {/* Period Selector & Close Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={selectedInvoiceMonth}
                      onChange={(e) => setSelectedInvoiceMonth(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 py-0.5 cursor-pointer focus:outline-none"
                    >
                      {uniqueInvoiceMonths.map(m => (
                        <option key={m} value={m}>
                          {formatMonthName(m)} {m === currentMonthYM ? '(Vigente)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedInvoiceMonth !== currentMonthYM && (
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceMonth(currentMonthYM)}
                        className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all cursor-pointer"
                        title="Ir para o mês corrente"
                      >
                        Atual
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedCardForInvoice(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-1"
                    title="Fechar modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Compact Inline Metadata */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-2">
                <span>
                  Fecha dia <strong className="font-semibold text-slate-700">{selectedCardForInvoice.closingDay || 10}</strong>
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  Vence dia <strong className="font-semibold text-slate-700">{selectedCardForInvoice.dueDay || 15}</strong>
                </span>
                <span className="text-slate-300">·</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide border ${
                  isInvoicePaid 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isInvoicePaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isInvoicePaid ? 'Fatura Paga' : 'Fatura em Aberto'}
                </span>
                {selectedCardForInvoice.cardBrand && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">{selectedCardForInvoice.cardBrand}</span>
                  </>
                )}
                {selectedCardForInvoice.bank && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] text-slate-400 font-mono">{selectedCardForInvoice.bank}</span>
                  </>
                )}
              </div>
            </div>

            {/* Inner Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              
              {/* Transactions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="uppercase tracking-wider text-[11px] font-bold text-slate-500">
                    Lançamentos da Competência
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                    {invoiceTransactions.length} {invoiceTransactions.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="max-h-72 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-xs text-left text-slate-600 border-collapse min-w-[580px]">
                      <thead className="bg-slate-50/95 backdrop-blur-xs text-[10.5px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-3.5 py-2.5 whitespace-nowrap w-24">Data</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap min-w-[220px]">Descrição</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap w-36">Categoria</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap w-32 text-right">Valor</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap w-12 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium italic">
                              Nenhum lançamento registrado para esta fatura mensal.
                            </td>
                          </tr>
                        ) : (
                          invoiceTransactions.map(t => {
                            const isMenuOpen = activeTxMenuId === t.id;
                            return (
                              <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-3.5 py-2 font-mono tabular-nums text-slate-500 whitespace-nowrap text-xs">
                                  {t.date.split('-').reverse().join('/')}
                                </td>
                                <td className="px-3.5 py-2 font-medium text-slate-800 text-xs">
                                  <div>{t.description}</div>
                                  {t.movedFromMonth && (
                                    <div className="mt-0.5">
                                      <span 
                                        className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.2 rounded text-[9.5px] font-semibold cursor-pointer hover:bg-amber-100 transition-colors"
                                        title={t.movedHistory && t.movedHistory.length > 0
                                          ? t.movedHistory.map(h => `Movido de ${formatMonthShort(h.fromMonth)} para ${formatMonthShort(h.toMonth)} em ${new Date(h.movedAt).toLocaleDateString('pt-BR')}`).join(' ➔ ')
                                          : `Originalmente da fatura de ${formatMonthShort(t.movedFromMonth)}`
                                        }
                                        onClick={() => {
                                          if (t.movedHistory && t.movedHistory.length > 0) {
                                            setViewHistoryTx(t);
                                          }
                                        }}
                                      >
                                        <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                        Movido de {formatMonthShort(t.movedFromMonth)}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3.5 py-2 whitespace-nowrap">
                                  <span className="bg-slate-100 font-medium px-2 py-0.5 rounded text-[10.5px] text-slate-600 max-w-[130px] truncate inline-block">
                                    {t.categoryName || 'Gerais'}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-right font-bold text-rose-600 whitespace-nowrap font-mono tabular-nums text-xs">
                                  - {formatCurrency(t.amount)}
                                </td>
                                <td className="px-3.5 py-2 text-center relative whitespace-nowrap">
                                  <div className="relative inline-block text-left">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTxMenuId(isMenuOpen ? null : t.id);
                                      }}
                                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                      title="Opções do lançamento"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {isMenuOpen && (
                                      <>
                                        <div 
                                          className="fixed inset-0 z-30" 
                                          onClick={() => setActiveTxMenuId(null)}
                                        />
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-40 text-left animate-fadeIn">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveTxMenuId(null);
                                              handleInitiateMove(t);
                                            }}
                                            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer"
                                          >
                                            <CalendarPlus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            Mover para próxima fatura
                                          </button>
                                          
                                          {t.movedHistory && t.movedHistory.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveTxMenuId(null);
                                                setViewHistoryTx(t);
                                              }}
                                              className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors border-t border-slate-100 cursor-pointer"
                                            >
                                              <History className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                              Ver histórico de faturas
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
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
              </div>

              {/* Total Summary Row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CreditCardIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Total da Fatura</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Competência: <strong className="text-slate-800 font-semibold">{formatMonthName(selectedInvoiceMonth)}</strong>
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono tabular-nums">
                  {formatCurrency(invoiceTotal)}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="px-6 py-3.5 border-t border-slate-150 flex-shrink-0 bg-slate-50/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Exportar Fatura PDF</span>
              </button>
              
              {!isInvoicePaid && invoiceTransactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const availableSourced = accounts.filter(a => a.accountType !== 'CREDITO');
                    if (availableSourced.length > 0) {
                      setPaymentSourceAccountId(availableSourced[0].id);
                    }
                    setIsPayingInvoiceOpen(true);
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Efetuar Pagamento da Fatura</span>
                </button>
              )}

              {isInvoicePaid && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Fatura liquidada</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recurrence & Move Confirmation Dialog */}
      {txToMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => !isMovingTx && setTxToMove(null)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col animate-scaleUp">
            
            {/* Header */}
            <div className="px-7 pt-7 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${recurrentOccurrences.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {recurrentOccurrences.length > 0 ? (
                    <Repeat className="w-5 h-5" />
                  ) : (
                    <CalendarPlus className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                    {recurrentOccurrences.length > 0 ? 'Lançamento Recorrente Detectado' : 'Mover para Próxima Fatura'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Competência atual: {formatMonthName(txToMove.creditCardMonth || selectedInvoiceMonth)}
                  </p>
                </div>
              </div>
              <button 
                disabled={isMovingTx}
                onClick={() => setTxToMove(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-7 space-y-4">
              {/* Item Info Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Lançamento Selecionado</span>
                  <span className="text-xs font-mono text-slate-500">{txToMove.date.split('-').reverse().join('/')}</span>
                </div>
                <div className="text-sm font-black text-slate-800">{txToMove.description}</div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 font-bold">{txToMove.categoryName || 'Gerais'}</span>
                  <span className="font-black text-rose-500">- {formatCurrency(txToMove.amount)}</span>
                </div>
              </div>

              {/* Destination Preview */}
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-bold">
                  <span>De: <strong className="text-slate-800">{formatMonthShort(txToMove.creditCardMonth || selectedInvoiceMonth)}</strong></span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Para: <strong className="text-blue-700">{formatMonthShort(getNextStatementMonth(txToMove.creditCardMonth || selectedInvoiceMonth))}</strong></span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                  Fatura Seguinte
                </span>
              </div>

              {/* Recurrence Detection Message or Single Confirmation */}
              {recurrentOccurrences.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      Este lançamento também aparece nos próximos meses ({recurrentOccurrences.length} ocorrência{recurrentOccurrences.length > 1 ? 's' : ''} subsequente{recurrentOccurrences.length > 1 ? 's' : ''}).
                    </p>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Deseja mover apenas a ocorrência deste mês ou mover em cascata toda a sequência dos próximos meses?
                    </p>
                  </div>

                  {/* Future list preview */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 space-y-1.5 max-h-32 overflow-y-auto">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Próximas ocorrências da série:</div>
                    {recurrentOccurrences.map((occ, idx) => (
                      <div key={occ.id} className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1.5 rounded-lg border border-slate-100">
                        <span className="font-bold truncate max-w-[200px]">{occ.description}</span>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 shrink-0">
                          <span>{formatMonthShort(occ.creditCardMonth || occ.date.substring(0, 7))}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-blue-600 font-bold">{formatMonthShort(getNextStatementMonth(occ.creditCardMonth || occ.date.substring(0, 7)))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ao confirmar, o lançamento será transferido para a fatura do mês subsequente. O total demonstrativo de ambas as competências será recalculado automaticamente e o log de auditoria será salvo.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5">
              {recurrentOccurrences.length > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={isMovingTx}
                    onClick={() => handleExecuteMoveAll(txToMove, recurrentOccurrences)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                  >
                    {isMovingTx ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Repeat className="w-4 h-4" />
                    )}
                    Mover este e os próximos ({recurrentOccurrences.length + 1} lançamentos)
                  </button>

                  <button
                    type="button"
                    disabled={isMovingTx}
                    onClick={() => handleExecuteMoveSingle(txToMove)}
                    className="w-full py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    Mover apenas este mês ({formatMonthShort(getNextStatementMonth(txToMove.creditCardMonth || selectedInvoiceMonth))})
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isMovingTx}
                  onClick={() => handleExecuteMoveSingle(txToMove)}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                  {isMovingTx ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirmar e Mover para {formatMonthName(getNextStatementMonth(txToMove.creditCardMonth || selectedInvoiceMonth))}
                </button>
              )}

              <button
                type="button"
                disabled={isMovingTx}
                onClick={() => setTxToMove(null)}
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Movement Audit History Dialog */}
      {viewHistoryTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setViewHistoryTx(null)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col animate-scaleUp">
            
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <History className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Histórico de Movimentações</h3>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[240px]">{viewHistoryTx.description}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewHistoryTx(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-150 text-xs space-y-1">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Competência Original</div>
                <div className="font-black text-slate-800">{formatMonthName(viewHistoryTx.movedFromMonth || '')} ({formatMonthShort(viewHistoryTx.movedFromMonth || '')})</div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Log de Alterações</div>
                <div className="space-y-2">
                  {(viewHistoryTx.movedHistory || []).map((item, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-slate-150 space-y-1.5 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono">
                        <span>{new Date(item.movedAt).toLocaleDateString('pt-BR')} às {new Date(item.movedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase text-[8.5px]">Movido</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <span>Fatura {formatMonthShort(item.fromMonth)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-blue-700 font-black">Fatura {formatMonthShort(item.toMonth)}</span>
                      </div>
                      {item.reason && (
                        <p className="text-[10px] text-slate-400 italic">{item.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewHistoryTx(null)}
                className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle invoice details payment picker */}
      {isPayingInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsPayingInvoiceOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 border border-slate-200/80 flex flex-col font-sans animate-scaleUp">
            
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Confirmar Liquidação de Fatura</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              Escolha a conta e a data para registrar a quitação
            </p>

            <div className="space-y-4 my-6">
              {/* Source account to charge from */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">CONTA PARA DÉBITO</label>
                <select
                  value={paymentSourceAccountId}
                  onChange={(e) => setPaymentSourceAccountId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/25 text-xs font-bold text-slate-700 cursor-pointer"
                  required
                >
                  {accounts.filter(a => a.accountType !== 'CREDITO').map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
                  ))}
                </select>
              </div>

              {/* Payment Date input */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">DATA DO PAGAMENTO</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/25 text-xs font-bold text-slate-700 text-center"
                  required
                />
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase block">VALOR A LIQUIDAR:</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{formatCurrency(invoiceTotal)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleConfirmInvoicePayment}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all hover:scale-[1.01] active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                Confirmar Liquidação
              </button>
              <button
                type="button"
                onClick={() => setIsPayingInvoiceOpen(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-wider text-xs transition-all text-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
