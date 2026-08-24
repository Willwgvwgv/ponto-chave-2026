import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  HelpCircle, 
  CheckCircle2, 
  X, 
  AlertCircle,
  Info,
  Check,
  Zap,
  Tag,
  Plus,
  Pencil,
  Search,
  RefreshCw,
  Scissors,
  Trash2,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Building2,
  Landmark,
  CheckCheck,
  Layers,
  Undo2,
  AlertTriangle
} from 'lucide-react';
import { BankAccount, FinancialCategory, FinancialTransaction } from '../../types';
import { parseBankStatement, ParsedOFXTransaction, parseLedgerBalance, LedgerBalance } from './ofxParser';
import { db, doc, updateDoc, isDemoMode } from '../../firebase';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';

export interface AutoParsedOFXTransaction extends ParsedOFXTransaction {
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  isAutoCategorized?: boolean;
  originalDescription?: string;
  autoCategorizedSource?: 'historico' | 'regra';
}

export interface SplitPartItem {
  id: string;
  description: string;
  categoryId: string;
  amount: number | '';
}

export interface MatchResult {
  candidate: FinancialTransaction;
  isCrossAccount: boolean;
  sourceAccount?: BankAccount;
  score: number;
  diffDays: number;
  diffValue: number;
  similarity: number;
}

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

const normalizeText = (text: string) => {
  if (!text) return '';
  return text
    .normalize('NFD') // decompose to combine diacritics
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toUpperCase();
};

const cleanTokens = (str: string): string[] => {
  if (!str) return [];
  const stopWords = new Set([
    'PIX', 'TED', 'DOC', 'PAGTO', 'PAGAMENTO', 'COMPRA', 'TRANSF', 'TRANSFERENCIA',
    'DEBITO', 'CREDITO', 'ENVIO', 'RECEBIMENTO', 'BANCO', 'SA', 'LTDA', 'ME', 'EPP', 'EIRELI',
    'DE', 'DO', 'DA', 'EM', 'POR', 'PARA', 'COM', 'EXTRATO', 'LANCAMENTO', 'PARCELA', 'VALOR',
    'PAG', 'REC', 'CONTA', 'AGENCIA', 'ESTORNO', 'TARIFA', 'FATURA'
  ]);
  return normalizeText(str)
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
};

const calculateTokenSimilarity = (desc1: string, desc2: string): number => {
  const tokens1 = cleanTokens(desc1);
  const tokens2 = cleanTokens(desc2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const set2 = new Set(tokens2);
  const intersection = tokens1.filter(t => set2.has(t));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.length / union.size;
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const autoCategorizationRules = [
  { keywords: ['IMOBIA', 'IMOB'], categoryName: 'Imobia' },
  { keywords: ['CANVA'], categoryName: 'Canva Pro' },
  { keywords: ['SIMPLES', 'DAS'], categoryName: 'DAS Simples Nacional' },
  { keywords: ['SALARIO', 'FOLHA', 'PAGAMENTO FUNC'], categoryName: 'Salários' },
  { keywords: ['SICOOB', 'TARIFA', 'MANUTENCAO DE CONTA'], categoryName: 'Taxas Bancárias' },
  { keywords: ['CRESOL'], categoryName: 'Taxas Bancárias' },
  { keywords: ['ANUNCIO', 'META', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE ADS'], categoryName: 'Tráfego Pago' },
  { keywords: ['CARTORIO', 'REGISTRO DE IMOVEIS'], categoryName: 'Despesas Cartoriais' },
  { keywords: ['COMISSAO', 'REPASSE CORRETOR'], categoryName: 'Comissões Externas' },
  { keywords: ['CONTADOR', 'CONTABILIDADE'], categoryName: 'Contador' },
  { keywords: ['COMBUSTIVEL', 'AUTO POSTO', 'POSTO'], categoryName: 'Combustível' },
  { keywords: ['ALUGUEL'], categoryName: 'Aluguel Escritório' },
  { keywords: ['ENERGIA', 'CEMIG', 'ENEL', 'EQUATORIAL'], categoryName: 'Energia' },
  { keywords: ['TELEFONE', 'TIM', 'VIVO', 'CLARO', 'OI'], categoryName: 'Telefone' },
  { keywords: ['ORULO', 'ÓRULO'], categoryName: 'Orulo' },
  { keywords: ['PIX RECEBIDO', 'TED RECEBIDO', 'DOC RECEBIDO'], categoryName: 'Outras Receitas' },
  { keywords: ['SANEAGO', 'SANEAMENTO', 'ÁGUA'], categoryName: 'Água e Saneamento' },
  { keywords: ['SEGURO', 'SEGUROS'], categoryName: 'Outras Despesas' },
  { keywords: ['PROLABORE', 'PRÓ-LABORE', 'PRO LABORE'], categoryName: 'Pró-labore' },
];

const findAutoCategory = (description: string, type: 'DEBIT' | 'CREDIT', categories: FinancialCategory[]) => {
  const normDesc = normalizeText(description);

  const matchedRule = autoCategorizationRules.find(rule => {
    return rule.keywords.some(kw => {
      const normKw = normalizeText(kw);
      return normDesc.includes(normKw);
    });
  });

  if (matchedRule) {
    const category = categories.find(
      c => normalizeText(c.name) === normalizeText(matchedRule.categoryName)
    );
    return category;
  }
  return undefined;
};

const findCategoryByHistory = (
  description: string,
  transactions: FinancialTransaction[],
  categories: FinancialCategory[]
) => {
  const normDesc = normalizeText(description);

  // Considera apenas transações já categorizadas
  const matches = transactions.filter(
    t => t.categoryId && normalizeText(t.description || '') === normDesc
  );

  if (matches.length === 0) return undefined;

  // Pega a categoria mais usada entre os matches (caso haja variação)
  const counts: Record<string, number> = {};
  matches.forEach(t => {
    counts[t.categoryId!] = (counts[t.categoryId!] || 0) + 1;
  });
  const mostUsedCategoryId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  return categories.find(c => c.id === mostUsedCategoryId);
};

interface ReconciliacaoTabProps {
  accounts: BankAccount[];
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
  onAddTransaction: (tx: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">) => void;
  onAddTransactions: (txs: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">[]) => void;
  onUpdateStatus: (id: string, status: 'PENDENTE' | 'CONCILIADO' | 'IGNORADO') => void;
  onUpdateTransactions: (items: { id: string, updates: Partial<FinancialTransaction> }[]) => void;
  onDeleteTransactions?: (ids: string[]) => void;
  onUnconfirmedCountChange?: (count: number) => void;
  resetTrigger?: number;
}

export const ReconciliacaoTab: React.FC<ReconciliacaoTabProps> = ({
  accounts,
  categories,
  transactions,
  onAddTransaction,
  onAddTransactions,
  onUpdateStatus,
  onUpdateTransactions,
  onDeleteTransactions,
  onUnconfirmedCountChange,
  resetTrigger
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [importedTxs, setImportedTxs] = useState<AutoParsedOFXTransaction[]>([]);
  const [ledgerBalance, setLedgerBalance] = useState<LedgerBalance | null>(null);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);
  const [conciliatedIds, setConciliatedIds] = useState<string[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  
  // Configuração da Conciliação Inteligente
  const [searchScope, setSearchScope] = useState<'ALL_ACCOUNTS' | 'CURRENT_ACCOUNT'>('ALL_ACCOUNTS');
  const [dateToleranceDays, setDateToleranceDays] = useState<number>(3);
  const [valueTolerance, setValueTolerance] = useState<number>(0.01);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Para criação rápida de transação nova se não houver match
  const [activeNewTx, setActiveNewTx] = useState<AutoParsedOFXTransaction | null>(null);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [reconcileType, setReconcileType] = useState<'NORMAL' | 'TRANSFERENCIA' | 'DIVIDIR' | 'PARCELA'>('NORMAL');
  const [installmentNumber, setInstallmentNumber] = useState<number>(1);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [recTfCounterpartId, setRecTfCounterpartId] = useState('');
  const [splitParts, setSplitParts] = useState<SplitPartItem[]>([]);

  // Edição inline de transação durante importação
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [tempDesc, setTempDesc] = useState('');
  const [tempDate, setTempDate] = useState('');
  const [tempAmount, setTempAmount] = useState<number>(0);

  // Estados para busca manual e seleção múltipla
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [showSearchForFitId, setShowSearchForFitId] = useState<Record<string, boolean>>({});
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [selectedCandidatesByFitId, setSelectedCandidatesByFitId] = useState<Record<string, Record<string, number>>>({});
  const [unreconcileConfirmItem, setUnreconcileConfirmItem] = useState<{ internalId: string; fitId: string; txIds: string[]; description: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPendingImportConfirm, setShowPendingImportConfirm] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rastreia e notifica a contagem de itens não confirmados para alertar sobre perda de progresso
  const unconfirmedCount = useMemo(() => {
    return importedTxs.filter(tx => !conciliatedIds.includes(tx.internalId) && !ignoredIds.includes(tx.internalId) && !acknowledgedIds.includes(tx.internalId)).length;
  }, [importedTxs, conciliatedIds, ignoredIds, acknowledgedIds]);

  useEffect(() => {
    onUnconfirmedCountChange?.(unconfirmedCount);
  }, [unconfirmedCount, onUnconfirmedCountChange]);

  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      setImportedTxs([]);
      setConciliatedIds([]);
      setIgnoredIds([]);
      setAcknowledgedIds([]);
      setLedgerBalance(null);
    }
  }, [resetTrigger]);

  // Mapa rápido de contas por ID
  const accountsMap = useMemo(() => {
    const map = new Map<string, BankAccount>();
    accounts.forEach(acc => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  // Candidatos a conciliação (pendentes e agendados).
  // Respeita o escopo: 'ALL_ACCOUNTS' (todas as contas) ou 'CURRENT_ACCOUNT' (apenas a conta atual).
  const searchCandidates = useMemo(() => {
    return transactions.filter(t => {
      const isPending = t.status === 'PENDENTE' || t.status === 'AGENDADO';
      if (!isPending) return false;
      if (searchScope === 'CURRENT_ACCOUNT') {
        return t.accountId === selectedAccountId;
      }
      return true; // ALL_ACCOUNTS
    });
  }, [transactions, selectedAccountId, searchScope]);

  // Proteção contra duplicação: verifica se já existe lançamento ID ou hash no banco para esta conta
  const isAlreadyImported = (imported: ParsedOFXTransaction) => {
    return Boolean(getExistingImportedTransaction(imported));
  };

  const getExistingImportedTransaction = (imported: ParsedOFXTransaction): FinancialTransaction | undefined => {
    return transactions.find(t => t.accountId === selectedAccountId && t.fitId === imported.fitId);
  };

  // Avaliação inteligente detalhada de match:
  // - Busca em todas as contas (ou apenas na atual conforme searchScope)
  // - Critérios: Valor (com tolerância configurável), Data (com tolerância de ±X dias) e similaridade textual
  // - Retorna MatchResult com informações claras sobre a conta de origem, score e similaridade
  const findMatchDetails = (imported: ParsedOFXTransaction, excludedCandidateIds?: Set<string>): MatchResult | null => {
    const impDate = new Date(imported.date + 'T00:00:00');
    const impAmount = Math.abs(imported.amount);
    const impDesc = imported.description || '';

    const matches: MatchResult[] = [];

    for (const t of searchCandidates) {
      if (excludedCandidateIds && excludedCandidateIds.has(t.id)) {
        continue;
      }

      // Verifica compatibilidade de tipo (DEBIT = DESPESA, CREDIT = RECEITA)
      const isSameType = (imported.type === 'DEBIT' && t.type === 'DESPESA') || 
                         (imported.type === 'CREDIT' && t.type === 'RECEITA');
      if (!isSameType) continue;

      // Validação de Valor com tolerância configurável
      const candAmount = Math.abs(t.amount);
      const diffValue = Math.abs(candAmount - impAmount);
      if (diffValue > valueTolerance + 0.002) continue;

      // Validação de Data com tolerância configurável de dias
      const tDate = new Date(t.date + 'T00:00:00');
      const diffTime = Math.abs(impDate.getTime() - tDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > dateToleranceDays) continue;

      // Cálculo de similaridade textual e pontuação composta
      const candDesc = t.description || '';
      const similarity = calculateTokenSimilarity(impDesc, candDesc);
      const normImp = normalizeText(impDesc);
      const normCand = normalizeText(candDesc);
      const isSubstring = (normImp.length > 3 && normCand.includes(normImp)) || (normCand.length > 3 && normImp.includes(normCand));

      const isSameAccount = t.accountId === selectedAccountId;
      const sourceAcc = accountsMap.get(t.accountId);

      // Algoritmo de Score Ponderado:
      // Base por valor exato: até 50 pontos
      const valueScore = Math.max(0, 50 - (diffValue / (valueTolerance || 0.01)) * 10);
      // Base por proximidade de data: até 30 pontos
      const dateScore = Math.max(0, 30 - diffDays * 6);
      // Similaridade textual: até 35 pontos
      const textScore = (similarity * 25) + (isSubstring ? 10 : 0);
      // Bônus para a mesma conta (caso todos os outros critérios sejam idênticos): +15 pontos
      const accountBonus = isSameAccount ? 15 : 0;

      const totalScore = valueScore + dateScore + textScore + accountBonus;

      matches.push({
        candidate: t,
        isCrossAccount: !isSameAccount,
        sourceAccount: sourceAcc,
        score: totalScore,
        diffDays,
        diffValue,
        similarity
      });
    }

    if (matches.length === 0) return null;

    // Ordena pelo maior score e retorna o melhor match
    matches.sort((a, b) => b.score - a.score);
    return matches[0];
  };

  // Atalho para compatibilidade
  const findMatch = (imported: ParsedOFXTransaction): FinancialTransaction | undefined => {
    const details = findMatchDetails(imported);
    return details ? details.candidate : undefined;
  };

  // Filtro de resultados em tempo real para a pesquisa manual por descrição, valor, data, conta ou categoria
  // Ordena com prioridade de proximidade ao valor meta do extrato
  const filterResults = (query: string, itemType: 'CREDIT' | 'DEBIT', targetAmount?: number) => {
    const desiredType = itemType === 'CREDIT' ? 'RECEITA' : 'DESPESA';
    const typeFiltered = searchCandidates.filter(t => t.type === desiredType);

    const targetVal = targetAmount ? Math.abs(targetAmount) : 0;

    let filtered = typeFiltered;
    if (query) {
      const q = query.toLowerCase().trim();
      filtered = typeFiltered.filter(t => {
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const amountMatch = String(t.amount).includes(q) || formatCurrency(t.amount).toLowerCase().includes(q);
        const dateMatch = (t.date || '').includes(q) || new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR').includes(q);
        const categoryMatch = (t.categoryName || '').toLowerCase().includes(q);
        const accName = accountsMap.get(t.accountId)?.name?.toLowerCase() || '';
        const accountMatch = accName.includes(q);

        return descMatch || amountMatch || dateMatch || categoryMatch || accountMatch;
      });
    }

    if (targetVal > 0) {
      return [...filtered].sort((a, b) => {
        const diffA = Math.abs(Math.abs(a.amount) - targetVal);
        const diffB = Math.abs(Math.abs(b.amount) - targetVal);
        return diffA - diffB;
      });
    }

    return filtered;
  };

  // Resumo estatístico da importação para o topo com contagem de matches entre contas
  const fileSummary = useMemo(() => {
    let total = importedTxs.length;
    let withMatch = 0;
    let withCrossAccountMatch = 0;
    let noMatch = 0;
    let alreadyImported = 0;

    importedTxs.forEach(item => {
      if (isAlreadyImported(item)) {
        alreadyImported++;
      } else {
        const matchObj = findMatchDetails(item);
        if (matchObj) {
          withMatch++;
          if (matchObj.isCrossAccount) {
            withCrossAccountMatch++;
          }
        } else {
          noMatch++;
        }
      }
    });

    return { total, withMatch, withCrossAccountMatch, noMatch, alreadyImported };
  }, [importedTxs, transactions, selectedAccountId, searchScope, dateToleranceDays, valueTolerance, conciliatedIds, ignoredIds, acknowledgedIds]);

  // Transações visíveis (remove locais conciliadas, ignoradas e duplicatas reconhecidas)
  const visibleImported = useMemo(() => {
    return importedTxs.filter(tx => !ignoredIds.includes(tx.internalId) && !conciliatedIds.includes(tx.internalId) && !acknowledgedIds.includes(tx.internalId));
  }, [importedTxs, ignoredIds, conciliatedIds, acknowledgedIds]);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const saldoProjetado = useMemo(() => {
    if (!selectedAccount) return 0;
    const initialBalance = selectedAccount.balance || 0;
    const newTxsToImport = visibleImported.filter(tx => !isAlreadyImported(tx));
    const sumNew = newTxsToImport.reduce((acc, tx) => {
      const val = tx.amount;
      if (tx.type === 'CREDIT') {
        return acc + val;
      } else {
        return acc - val;
      }
    }, 0);
    return initialBalance + sumNew;
  }, [selectedAccount, visibleImported, transactions, selectedAccountId]);

  const handleAdjustBalance = async () => {
    if (!selectedAccount || !ledgerBalance) return;
    try {
      if (isDemoMode) {
        selectedAccount.balance = ledgerBalance.amount;
        toast.success(`Saldo da conta ajustado (Demo) localmente para ${formatCurrency(ledgerBalance.amount)}!`);
        return;
      }
      const accountRef = doc(db, 'bank_accounts', selectedAccount.id);
      await updateDoc(accountRef, {
        balance: ledgerBalance.amount
      });
      toast.success(`Saldo da conta ajustado com sucesso para ${formatCurrency(ledgerBalance.amount)}!`);
    } catch (err: any) {
      toast.error(`Erro ao ajustar saldo da conta: ${err.message || err}`);
    }
  };

  // Progresso do lote importado
  const progressRatio = useMemo(() => {
    if (importedTxs.length === 0) return 0;
    const processed = importedTxs.length - visibleImported.length;
    return Math.round((processed / importedTxs.length) * 100);
  }, [importedTxs, visibleImported]);

  const groupedCats = useMemo(() => {
    if (!activeNewTx) return { items: {}, usingFallback: false };
    const relevantType = activeNewTx.type === 'CREDIT' ? 'RECEITA' : 'DESPESA';
    const filtered = categories.filter(c => c.type === relevantType);
    
    // Fallback: se não houver categorias do tipo, usa todas
    const source = filtered.length > 0 ? filtered : categories;
    const usingFallback = filtered.length === 0 && categories.length > 0;

    const groups: Record<string, FinancialCategory[]> = {};
    source.forEach(c => {
      const g = c.group || 'Diversas';
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return { items: groups, usingFallback };
  }, [categories, activeNewTx]);

  const isSuggestedSelected = useMemo(() => {
    return !!(activeNewTx?.isAutoCategorized && selectedCatId === activeNewTx.suggestedCategoryId);
  }, [activeNewTx, selectedCatId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (visibleImported.length > 0) {
      setPendingFile(file);
      setShowPendingImportConfirm(true);
    } else {
      processFile(file, false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (file: File, append: boolean = false) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseBankStatement(text);
        if (parsed.length === 0) {
          toast.error("Nenhuma transação válida encontrada no arquivo extrato.");
          return;
        }

        const isOFX = file.name.toLowerCase().endsWith('.ofx') || text.includes('<OFX>') || text.includes('OFXHEADER');
        if (isOFX) {
          const balance = parseLedgerBalance(text);
          setLedgerBalance(balance);
        } else if (!append) {
          setLedgerBalance(null);
        }

        // Aplica regras de autocategorização após parsing
        const enriched: AutoParsedOFXTransaction[] = parsed.map(tx => {
          const historyCat = findCategoryByHistory(tx.description, transactions, categories);
          const cat = historyCat || findAutoCategory(tx.description, tx.type, categories);
          if (cat) {
            return {
              ...tx,
              originalDescription: tx.description,
              suggestedCategoryId: cat.id,
              suggestedCategoryName: cat.name,
              isAutoCategorized: true,
              autoCategorizedSource: historyCat ? 'historico' : 'regra'
            };
          }
          return {
            ...tx,
            originalDescription: tx.description
          };
        });

        if (append) {
          setImportedTxs(prev => {
            const existingIds = new Set(prev.map(p => p.fitId));
            const fresh = enriched.filter(e => !existingIds.has(e.fitId));
            return [...prev, ...fresh];
          });
        } else {
          setImportedTxs(enriched);
          setIgnoredIds([]);
          setConciliatedIds([]);
          setAcknowledgedIds([]);
          setSearchQueries({});
          setShowSearchForFitId({});
          setActiveSearchId(null);
        }

        toast.success(`Sucesso! Importadas ${parsed.length} transações do extrato.`);
      } catch (err) {
        toast.error("Erro ao analisar arquivo. Verifique a codificação.");
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (visibleImported.length > 0) {
      setPendingFile(file);
      setShowPendingImportConfirm(true);
    } else {
      processFile(file, false);
    }
  };

  const handleConfirmInlineEdit = (internalId: string) => {
    setImportedTxs(prev => prev.map(tx => {
      if (tx.internalId === internalId) {
        const historyCat = findCategoryByHistory(tempDesc, transactions, categories);
        const cat = historyCat || findAutoCategory(tempDesc, tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT', categories);
        return {
          ...tx,
          description: tempDesc,
          date: tempDate,
          amount: tempAmount,
          suggestedCategoryId: cat?.id || tx.suggestedCategoryId,
          suggestedCategoryName: cat?.name || tx.suggestedCategoryName,
          isAutoCategorized: cat ? true : tx.isAutoCategorized,
          autoCategorizedSource: cat ? (historyCat ? 'historico' : 'regra') : tx.autoCategorizedSource
        };
      }
      return tx;
    }));
    setEditingTxId(null);
    toast.success("Transação atualizada localmente!");
  };

  const handleOpenSplitModal = (item: AutoParsedOFXTransaction) => {
    const target = Math.abs(item.amount);
    const half = Math.round((target / 2) * 100) / 100;
    const rest = Math.round((target - half) * 100) / 100;

    setSplitParts([
      {
        id: `part_${Date.now()}_1`,
        description: item.description,
        categoryId: item.suggestedCategoryId || '',
        amount: half
      },
      {
        id: `part_${Date.now()}_2`,
        description: item.description,
        categoryId: '',
        amount: rest
      }
    ]);
    setReconcileType('DIVIDIR');
    setActiveNewTx(item);
  };

  const handleAddSplitPart = () => {
    setSplitParts(prev => [
      ...prev,
      {
        id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: activeNewTx?.description || '',
        categoryId: '',
        amount: ''
      }
    ]);
  };

  const handleRemoveSplitPart = (id: string) => {
    if (splitParts.length <= 2) return;
    setSplitParts(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdateSplitPart = (id: string, updates: Partial<SplitPartItem>) => {
    setSplitParts(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  // Multi-seleção de candidatos para vincular
  const handleToggleCandidate = (internalId: string, candidate: FinancialTransaction) => {
    setSelectedCandidatesByFitId(prev => {
      const currentMap = prev[internalId] || {};
      const nextMap = { ...currentMap };
      if (nextMap[candidate.id] !== undefined) {
        delete nextMap[candidate.id];
      } else {
        nextMap[candidate.id] = Math.abs(candidate.amount);
      }
      return { ...prev, [internalId]: nextMap };
    });
  };

  const handleUpdateCandidateAmount = (internalId: string, txId: string, amount: number) => {
    setSelectedCandidatesByFitId(prev => {
      const currentMap = prev[internalId] || {};
      return {
        ...prev,
        [internalId]: {
          ...currentMap,
          [txId]: amount
        }
      };
    });
  };

  const handleConciliationMatchMultiple = (imported: ParsedOFXTransaction) => {
    const selectedMap = selectedCandidatesByFitId[imported.internalId] || {};
    const selectedIds = Object.keys(selectedMap);
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um lançamento pendente para vincular.");
      return;
    }

    const sumSelected = selectedIds.reduce((acc, id) => acc + (Number(selectedMap[id]) || 0), 0);
    const targetAmount = Math.abs(imported.amount);
    if (Math.abs(targetAmount - sumSelected) > 0.012) {
      toast.error(`A soma dos lançamentos selecionados (${formatCurrency(sumSelected)}) deve conferir com o extrato (${formatCurrency(targetAmount)}).`);
      return;
    }

    const targetAccount = accountsMap.get(selectedAccountId);
    const isTargetCard = targetAccount?.accountType === 'CREDITO';

    const updatesToApply: { id: string, updates: Partial<FinancialTransaction> }[] = [];

    selectedIds.forEach(txId => {
      const candidate = transactions.find(t => t.id === txId);
      const customAmount = selectedMap[txId];
      const hasAmountChanged = candidate && Math.abs(candidate.amount) !== Math.abs(customAmount);
      const isCross = candidate && candidate.accountId !== selectedAccountId;
      const origAcc = candidate ? accountsMap.get(candidate.accountId) : undefined;

      const cardStatus = isTargetCard ? getInitialCreditCardStatus(imported.date, targetAccount?.closingDay || 10) : undefined;
      const cardMonth = isTargetCard ? getCardStatementMonth(imported.date, targetAccount?.closingDay || 10) : undefined;

      const updates: Partial<FinancialTransaction> = {
        status: 'CONCILIADO',
        fitId: imported.fitId,
        reconciledAt: new Date().toISOString(),
        accountId: selectedAccountId
      };

      if (isTargetCard) {
        updates.creditCardStatus = cardStatus;
        updates.creditCardMonth = cardMonth;
      }

      if (isCross && candidate) {
        const noteAppend = `[Conciliação Inteligente] Migrado da conta '${origAcc?.name || 'Origem'}' para '${targetAccount?.name || 'Destino'}' via extrato bancário.`;
        updates.notes = candidate.notes ? `${candidate.notes}\n${noteAppend}` : noteAppend;
      }

      if (hasAmountChanged && customAmount > 0) {
        updates.amount = candidate?.type === 'DESPESA' ? -Math.abs(customAmount) : Math.abs(customAmount);
      }

      updatesToApply.push({ id: txId, updates });
    });

    onUpdateTransactions(updatesToApply);
    setConciliatedIds(prev => [...prev, imported.internalId]);
    setShowSearchForFitId(prev => ({ ...prev, [imported.internalId]: false }));
    setSearchQueries(prev => ({ ...prev, [imported.internalId]: '' }));
    setSelectedCandidatesByFitId(prev => {
      const next = { ...prev };
      delete next[imported.internalId];
      return next;
    });
    toast.success(`${updatesToApply.length} lançamento(s) vinculado(s) e conciliado(s) com sucesso!`);
  };

  const handleConciliationMatch = (imported: ParsedOFXTransaction, matched: FinancialTransaction) => {
    const isCrossAccount = matched.accountId !== selectedAccountId;
    const originalAccount = accountsMap.get(matched.accountId);
    const targetAccount = accountsMap.get(selectedAccountId);

    const isTargetCard = targetAccount?.accountType === 'CREDITO';
    const cardStatus = isTargetCard ? getInitialCreditCardStatus(imported.date, targetAccount?.closingDay || 10) : undefined;
    const cardMonth = isTargetCard ? getCardStatementMonth(imported.date, targetAccount?.closingDay || 10) : undefined;

    const updates: Partial<FinancialTransaction> = {
      status: 'CONCILIADO',
      fitId: imported.fitId,
      reconciledAt: new Date().toISOString(),
      accountId: selectedAccountId
    };

    if (isTargetCard) {
      updates.creditCardStatus = cardStatus;
      updates.creditCardMonth = cardMonth;
    }

    if (isCrossAccount) {
      const noteAppend = `[Conciliação Inteligente] Migrado da conta '${originalAccount?.name || 'Origem'}' para '${targetAccount?.name || 'Destino'}' via extrato bancário.`;
      updates.notes = matched.notes ? `${matched.notes}\n${noteAppend}` : noteAppend;
    }

    onUpdateTransactions([{
      id: matched.id,
      updates
    }]);

    setConciliatedIds(prev => [...prev, imported.internalId]);
    if (isCrossAccount) {
      toast.success(`Transação transferida de "${originalAccount?.name || 'outra conta'}" e conciliada na conta "${targetAccount?.name}"!`);
    } else {
      toast.success("Transação conciliada com lançamento existente com sucesso!");
    }
  };

  const handleConciliateAllMatches = () => {
    const matchesToConciliate: { id: string, updates: Partial<FinancialTransaction> }[] = [];
    const localConciliated: string[] = [];
    let crossCount = 0;

    const targetAccount = accountsMap.get(selectedAccountId);
    const isTargetCard = targetAccount?.accountType === 'CREDITO';

    // Evita conflitos onde mais de uma transação importada pegaria o mesmo candidato pendente
    const claimedCandidateIds = new Set<string>();

    importedTxs.forEach(item => {
      if (!isAlreadyImported(item) && !conciliatedIds.includes(item.internalId) && !ignoredIds.includes(item.internalId)) {
        const matchObj = findMatchDetails(item, claimedCandidateIds);
        if (matchObj) {
          const match = matchObj.candidate;
          claimedCandidateIds.add(match.id);
          const isCross = matchObj.isCrossAccount;
          if (isCross) crossCount++;

          const cardStatus = isTargetCard ? getInitialCreditCardStatus(item.date, targetAccount?.closingDay || 10) : undefined;
          const cardMonth = isTargetCard ? getCardStatementMonth(item.date, targetAccount?.closingDay || 10) : undefined;

          const updates: Partial<FinancialTransaction> = {
            status: 'CONCILIADO',
            fitId: item.fitId,
            reconciledAt: new Date().toISOString(),
            accountId: selectedAccountId
          };

          if (isTargetCard) {
            updates.creditCardStatus = cardStatus;
            updates.creditCardMonth = cardMonth;
          }

          if (isCross) {
            const origAcc = matchObj.sourceAccount;
            const noteAppend = `[Conciliação Inteligente] Migrado da conta '${origAcc?.name || 'Origem'}' para '${targetAccount?.name}' via conciliação em lote.`;
            updates.notes = match.notes ? `${match.notes}\n${noteAppend}` : noteAppend;
          }

          matchesToConciliate.push({
            id: match.id,
            updates
          });
          localConciliated.push(item.internalId);
        }
      }
    });

    if (matchesToConciliate.length === 0) {
      toast.info("Nenhuma correspondência pendente para conciliação automática rápida.");
      return;
    }

    onUpdateTransactions(matchesToConciliate);
    setConciliatedIds(prev => [...prev, ...localConciliated]);
    toast.success(
      `${matchesToConciliate.length} correspondências conciliadas com sucesso! ${crossCount > 0 ? `(${crossCount} vinculadas de outras contas)` : ''}`
    );
  };

  const handleIgnore = (internalId: string) => {
    setIgnoredIds(prev => [...prev, internalId]);
    toast.info("Transação marcada como ignorada.");
  };

  const handleAcknowledge = (internalId: string) => {
    setAcknowledgedIds(prev => [...prev, internalId]);
    toast.info("Item já importado reconhecido no lote.");
  };

  const handleConfirmUnreconcile = () => {
    if (!unreconcileConfirmItem) return;
    const { internalId, fitId, txIds } = unreconcileConfirmItem;
    
    if (txIds.length > 0 && onDeleteTransactions) {
      onDeleteTransactions(txIds);
    }
    
    setConciliatedIds(prev => prev.filter(id => id !== internalId));
    setIgnoredIds(prev => prev.filter(id => id !== internalId));
    setAcknowledgedIds(prev => prev.filter(id => id !== internalId));
    setUnreconcileConfirmItem(null);
    toast.success("Lançamento desfeito com sucesso! O item do extrato foi reaberto para conciliação.");
  };

  const handleCreateAndConciliate = (imported: AutoParsedOFXTransaction) => {
    if (reconcileType === 'DIVIDIR') {
      const totalSplit = splitParts.reduce((acc, p) => acc + (typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0)), 0);
      const targetAmount = Math.abs(imported.amount);
      const diff = targetAmount - totalSplit;

      if (Math.abs(diff) > 0.012) {
        toast.error(`A soma das partes (${formatCurrency(totalSplit)}) deve ser igual ao valor do extrato (${formatCurrency(targetAmount)}).`);
        return;
      }

      if (splitParts.length < 2) {
        toast.error("O rateio deve conter pelo menos 2 divisões.");
        return;
      }

      const invalidPart = splitParts.find(p => !p.description.trim() || !p.categoryId || Number(p.amount) <= 0);
      if (invalidPart) {
        toast.error("Preencha descrição, categoria e valor maior que zero para todas as partes.");
        return;
      }

      const splitGroupId = `split_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const account = accounts.find(a => a.id === selectedAccountId);
      const isCard = account?.accountType === 'CREDITO';
      const cardStatus = isCard ? getInitialCreditCardStatus(imported.date, account?.closingDay || 10) : undefined;
      const cardMonth = isCard ? getCardStatementMonth(imported.date, account?.closingDay || 10) : undefined;
      const totalParts = splitParts.length;

      const newTransactions = splitParts.map((p, idx) => {
        const category = categories.find(c => c.id === p.categoryId);
        return {
          accountId: selectedAccountId,
          date: imported.date,
          description: p.description.trim(),
          amount: Math.abs(Number(p.amount)),
          type: isCard ? 'DESPESA' : (imported.type === 'CREDIT' ? 'RECEITA' : 'DESPESA') as ('RECEITA' | 'DESPESA'),
          categoryId: p.categoryId || undefined,
          categoryName: category ? category.name : undefined,
          status: 'CONCILIADO' as const,
          origin: 'IMPORTADO' as const,
          fitId: imported.fitId,
          originalDescription: imported.originalDescription || imported.description || undefined,
          notes: `FITID: ${imported.fitId} · Parte ${idx + 1}/${totalParts} de lançamento dividido.`,
          splitGroupId: splitGroupId,
          creditCardStatus: cardStatus,
          creditCardMonth: cardMonth
        };
      });

      onAddTransactions(newTransactions);
      setConciliatedIds(prev => [...prev, imported.internalId]);
      setActiveNewTx(null);
      setSplitParts([]);
      setReconcileType('NORMAL');
      toast.success(`Lançamento dividido em ${totalParts} partes e conciliado com sucesso!`);
      return;
    }

    if (reconcileType === 'TRANSFERENCIA') {
      if (!recTfCounterpartId || recTfCounterpartId === selectedAccountId) {
        toast.error("Por favor, selecione uma conta contrapartida válida e diferente da atual.");
        return;
      }

      const counterpartAccount = accounts.find(a => a.id === recTfCounterpartId);
      const currentAccount = accounts.find(a => a.id === selectedAccountId);
      
      const transferGroupId = `transfer_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const amountAbs = Math.abs(imported.amount);
      const isExit = imported.amount < 0;

      onAddTransactions([
        {
          accountId: selectedAccountId,
          date: imported.date,
          description: `${imported.description} (Transferência)`,
          amount: amountAbs,
          type: isExit ? 'DESPESA' : 'RECEITA',
          status: 'CONCILIADO',
          origin: 'IMPORTADO',
          fitId: imported.fitId,
          originalDescription: imported.originalDescription || undefined,
          notes: `FITID: ${imported.fitId} · Transferência entre contas com contrapartida para ${counterpartAccount?.name || 'N/A'}.`,
          isTransfer: true,
          transferAccountId: recTfCounterpartId,
          transferGroupId: transferGroupId
        },
        {
          accountId: recTfCounterpartId,
          date: imported.date,
          description: `${imported.description} (Contrapartida Transferência)`,
          amount: amountAbs,
          type: isExit ? 'RECEITA' : 'DESPESA',
          status: 'CONCILIADO',
          origin: 'IMPORTADO',
          notes: `Transferência correspondente ao FITID ${imported.fitId}, vinda de ${currentAccount?.name || 'N/A'}.`,
          isTransfer: true,
          transferAccountId: selectedAccountId,
          transferGroupId: transferGroupId
        }
      ]);

      setConciliatedIds(prev => [...prev, imported.internalId]);
      setActiveNewTx(null);
      setRecTfCounterpartId('');
      setReconcileType('NORMAL');
      toast.success("Transferência criada e conciliada nas duas contas com sucesso!");
      return;
    }

    if (reconcileType === 'PARCELA') {
      const category = categories.find(c => c.id === selectedCatId);
      const isAutoMatch = imported.isAutoCategorized && selectedCatId === imported.suggestedCategoryId;
      
      const account = accounts.find(a => a.id === selectedAccountId);
      const isCard = account?.accountType === 'CREDITO';
      const cardStatus = isCard ? getInitialCreditCardStatus(imported.date, account?.closingDay || 10) : undefined;
      const cardMonth = isCard ? getCardStatementMonth(imported.date, account?.closingDay || 10) : undefined;
      const instInfo = `${installmentNumber}/${installmentCount}`;

      onAddTransaction({
        accountId: selectedAccountId,
        date: imported.date,
        description: `${imported.description} (Parc. ${instInfo})`,
        amount: imported.amount,
        type: isCard ? 'DESPESA' : (imported.type === 'CREDIT' ? 'RECEITA' : 'DESPESA'),
        categoryId: selectedCatId || undefined,
        categoryName: category ? category.name : undefined,
        status: 'CONCILIADO',
        origin: isAutoMatch ? 'AUTO' : 'IMPORTADO',
        fitId: imported.fitId,
        originalDescription: imported.originalDescription || undefined,
        notes: `FITID: ${imported.fitId} · Parcela ${instInfo}. ${isAutoMatch ? 'Categorização inteligente automática.' : ''}`,
        creditCardStatus: cardStatus,
        creditCardMonth: cardMonth,
        installmentInfo: instInfo,
        installmentNumber: installmentNumber,
        installmentCount: installmentCount
      });

      setConciliatedIds(prev => [...prev, imported.internalId]);
      setActiveNewTx(null);
      setSelectedCatId('');
      setReconcileType('NORMAL');
      toast.success(`Lançamento registrado como parcela ${instInfo} e conciliado!`);
      return;
    }

    const category = categories.find(c => c.id === selectedCatId);
    const isAutoMatch = imported.isAutoCategorized && selectedCatId === imported.suggestedCategoryId;
    
    const account = accounts.find(a => a.id === selectedAccountId);
    const isCard = account?.accountType === 'CREDITO';
    const cardStatus = isCard ? getInitialCreditCardStatus(imported.date, account?.closingDay || 10) : undefined;
    const cardMonth = isCard ? getCardStatementMonth(imported.date, account?.closingDay || 10) : undefined;

    // Cria um novo lançamento vinculando o ID da transação (fitId) e concilia
    onAddTransaction({
      accountId: selectedAccountId,
      date: imported.date,
      description: imported.description,
      amount: imported.amount,
      type: isCard ? 'DESPESA' : (imported.type === 'CREDIT' ? 'RECEITA' : 'DESPESA'),
      categoryId: selectedCatId || undefined,
      categoryName: category ? category.name : undefined,
      status: 'CONCILIADO',
      origin: isAutoMatch ? 'AUTO' : 'IMPORTADO',
      fitId: imported.fitId,
      originalDescription: imported.originalDescription || undefined,
      notes: `FITID: ${imported.fitId} · Criado e conciliado no upload. ${isAutoMatch ? 'Categorização inteligente automática.' : ''}`,
      creditCardStatus: cardStatus,
      creditCardMonth: cardMonth
    });

    setConciliatedIds(prev => [...prev, imported.internalId]);
    setActiveNewTx(null);
    setSelectedCatId('');
    setReconcileType('NORMAL');
    toast.success("Lançamento criado, registrado e conciliado!");
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel Esquerdo: Conta & Upload */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">1. Selecione a Conta / Cartão</label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setImportedTxs([]);
                  setIgnoredIds([]);
                  setConciliatedIds([]);
                  setAcknowledgedIds([]);
                  setLedgerBalance(null);
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.accountType === 'CREDITO' ? ' [CARTÃO]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {visibleImported.length > 0 ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Importar outro arquivo (OFX/CSV)</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".ofx,.csv" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">2. Importe o Extrato (OFX ou CSV)</label>
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 relative group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Arraste seu arquivo OFX ou CSV aqui</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">ou clique para selecionar do computador</p>
                    <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg mt-3 inline-block">Sicoob e Cresol: use OFX · Inter: use CSV</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".ofx,.csv" 
                    className="hidden" 
                  />
                </div>
              </div>
            )}

            {importedTxs.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-slate-100 animate-fadeIn font-sans">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Progresso do Lote</span>
                  <span>{progressRatio}% concluído</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-blue-650 bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressRatio}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold text-center mt-1">
                  {importedTxs.length - visibleImported.length} de {importedTxs.length} transações processadas
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quadro Geral de Transações */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-500 tracking-wider uppercase">Transações do Arquivo</h3>
            {importedTxs.length > 0 && (
              <button
                onClick={() => {
                  setImportedTxs([]);
                  setIgnoredIds([]);
                  setConciliatedIds([]);
                  setAcknowledgedIds([]);
                  setLedgerBalance(null);
                  setSearchQueries({});
                  setShowSearchForFitId({});
                  setActiveSearchId(null);
                }}
                className="text-[10px] font-bold text-rose-500 hover:underline uppercase tracking-wide cursor-pointer"
              >
                Limpar lote
              </button>
            )}
          </div>

          <div className="space-y-3">
            {importedTxs.length === 0 ? (
              <div className="bg-slate-100/50 rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-600" />
                <p className="text-xs font-bold">Nenhum extrato importado</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">Selecione uma conta e faça upload do arquivo OFX/CSV à esquerda para iniciar</p>
              </div>
            ) : (
              <>
                {ledgerBalance && selectedAccount && (
                  <div id="saldo-conferencia-card" className="bg-slate-50 border border-slate-200 rounded-3xl p-5 mb-4 animate-fadeIn space-y-4 font-sans">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4 text-sky-600 shrink-0" /> Conferência de Saldo
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-1">Sincronização entre o extrato consolidado e o sistema</p>
                      </div>
                      
                      {Math.abs(saldoProjetado - ledgerBalance.amount) <= 0.01 ? (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
                          ✅ Saldo confere com o extrato
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-black uppercase tracking-wider bg-red-50 text-red-750 border border-red-200 rounded-full px-3 py-1 text-red-800">
                          ⚠️ Diferença de {formatCurrency(Math.abs(saldoProjetado - ledgerBalance.amount))} — confira se há lançamentos faltando ou duplicados
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
                      <div className="bg-white p-3 rounded-2xl border border-slate-150/80">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Saldo no extrato (banco) em {(() => {
                          const [y, m, d] = ledgerBalance.date.split('-');
                          return `${d}/${m}/${y}`;
                        })()}</p>
                        <p className="text-sm font-black text-slate-800 font-mono">{formatCurrency(ledgerBalance.amount)}</p>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-slate-150/80">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Saldo atual no Ponto Chave</p>
                        <p className="text-sm font-black text-slate-800 font-mono">{formatCurrency(selectedAccount.balance || 0)}</p>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-slate-150/80">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Saldo projetado após importação</p>
                        <p className="text-sm font-black text-blue-600 font-mono">{formatCurrency(saldoProjetado)}</p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        id="ajustar-saldo-banco-btn"
                        onClick={handleAdjustBalance}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-350 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Ajustar saldo da conta para {formatCurrency(ledgerBalance.amount)}
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. Painel de Resumo da Importação e Controles Inteligentes */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Info className="w-4.5 h-4.5 text-blue-500" /> Resumo da Importação
                      </h4>
                      <button
                        onClick={() => setShowConfigPanel(!showConfigPanel)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer ${
                          showConfigPanel
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Configurar critérios de conciliação inteligente"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-blue-600" />
                        Critérios ({searchScope === 'ALL_ACCOUNTS' ? 'Todas Contas' : 'Conta Atual'} · ±{dateToleranceDays}d · R${valueTolerance.toFixed(2)})
                      </button>
                    </div>

                    {fileSummary.withMatch > 0 && (
                      <button
                        onClick={handleConciliateAllMatches}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" /> Conciliar todos os matches ({fileSummary.withMatch})
                      </button>
                    )}
                  </div>

                  {/* Painel expansível de configurações de busca inteligente */}
                  {showConfigPanel && (
                    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3 animate-fadeIn text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> Parâmetros de Correspondência Inteligente
                        </span>
                        <button
                          onClick={() => setShowConfigPanel(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                        {/* Escopo da Busca */}
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Escopo de Busca
                          </label>
                          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl">
                            <button
                              onClick={() => setSearchScope('ALL_ACCOUNTS')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                searchScope === 'ALL_ACCOUNTS'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Building2 className="w-3 h-3" /> Todas as Contas
                            </button>
                            <button
                              onClick={() => setSearchScope('CURRENT_ACCOUNT')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                searchScope === 'CURRENT_ACCOUNT'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Landmark className="w-3 h-3" /> Apenas Esta
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400 font-semibold leading-tight">
                            {searchScope === 'ALL_ACCOUNTS'
                              ? 'Busca lançamentos pendentes em qualquer banco cadastrado.'
                              : 'Busca apenas na conta selecionada.'}
                          </p>
                        </div>

                        {/* Tolerância de Data */}
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Tolerância de Data
                          </label>
                          <select
                            value={dateToleranceDays}
                            onChange={(e) => setDateToleranceDays(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                          >
                            <option value={0}>Mesmo dia (0 dias)</option>
                            <option value={1}>± 1 dia de tolerância</option>
                            <option value={2}>± 2 dias de tolerância</option>
                            <option value={3}>± 3 dias de tolerância (Padrão)</option>
                            <option value={5}>± 5 dias de tolerância</option>
                            <option value={7}>± 7 dias de tolerância</option>
                            <option value={10}>± 10 dias de tolerância</option>
                          </select>
                          <p className="text-[9px] text-slate-400 font-semibold leading-tight">
                            Permite pequenas variações de compensação bancária entre dias úteis.
                          </p>
                        </div>

                        {/* Tolerância de Valor */}
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Tolerância de Valor
                          </label>
                          <select
                            value={valueTolerance}
                            onChange={(e) => setValueTolerance(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                          >
                            <option value={0.00}>Exato (R$ 0,00)</option>
                            <option value={0.01}>Até R$ 0,01 (Padrão centavos)</option>
                            <option value={0.05}>Até R$ 0,05</option>
                            <option value={0.10}>Até R$ 0,10</option>
                            <option value={0.50}>Até R$ 0,50</option>
                            <option value={1.00}>Até R$ 1,00</option>
                          </select>
                          <p className="text-[9px] text-slate-400 font-semibold leading-tight">
                            Compensa arredondamentos de taxas ou tarifas centesimais.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Importadas</p>
                      <p className="text-lg font-black text-slate-700 mt-1.5">{fileSummary.total}</p>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100 text-center relative">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">Com Match</p>
                      <p className="text-lg font-black text-emerald-800 mt-1.5">{fileSummary.withMatch}</p>
                      {fileSummary.withCrossAccountMatch > 0 && (
                        <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                          {fileSummary.withCrossAccountMatch} em outras contas
                        </span>
                      )}
                    </div>

                    <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-100 text-center">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest leading-none">Sem Match</p>
                      <p className="text-lg font-black text-slate-800 mt-1.5">{fileSummary.noMatch}</p>
                    </div>

                    <div className="bg-slate-100/60 p-3 rounded-2xl border border-slate-150 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Já Importadas</p>
                      <p className="text-lg font-black text-slate-500 mt-1.5">{fileSummary.alreadyImported}</p>
                    </div>
                  </div>
                </div>

                {visibleImported.length === 0 ? (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-8 text-center text-emerald-800 animate-fadeIn space-y-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase tracking-tight text-emerald-900">
                        Importação Concluída com Sucesso!
                      </h4>
                      <p className="text-xs font-semibold text-emerald-700 max-w-md mx-auto">
                        Todas as transações deste arquivo foram devidamente processadas, vinculadas ou reconhecidas.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto pt-2 text-left">
                      <div className="bg-white/90 p-3 rounded-2xl border border-emerald-200/80">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Arquivo</p>
                        <p className="text-base font-black text-slate-800 mt-0.5">{importedTxs.length}</p>
                      </div>
                      <div className="bg-white/90 p-3 rounded-2xl border border-emerald-200/80">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Conciliados</p>
                        <p className="text-base font-black text-emerald-700 mt-0.5">{conciliatedIds.length}</p>
                      </div>
                      <div className="bg-white/90 p-3 rounded-2xl border border-emerald-200/80">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Ignorados</p>
                        <p className="text-base font-black text-slate-700 mt-0.5">{ignoredIds.length}</p>
                      </div>
                      <div className="bg-white/90 p-3 rounded-2xl border border-emerald-200/80">
                        <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Reconhecidos</p>
                        <p className="text-base font-black text-purple-700 mt-0.5">{acknowledgedIds.length}</p>
                      </div>
                    </div>

                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setImportedTxs([]);
                          setIgnoredIds([]);
                          setConciliatedIds([]);
                          setAcknowledgedIds([]);
                          setLedgerBalance(null);
                          setSearchQueries({});
                          setShowSearchForFitId({});
                          setActiveSearchId(null);
                          toast.success("Lote finalizado e limpo com sucesso!");
                        }}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:scale-[1.02] cursor-pointer inline-flex items-center gap-2"
                      >
                        <CheckCheck className="w-4 h-4" /> Concluir e Limpar Lote
                      </button>
                    </div>
                  </div>
                ) : (
                  visibleImported.map(item => {
                    const matchDetails = findMatchDetails(item);
                    const match = matchDetails?.candidate;
                    const isCrossAccount = matchDetails?.isCrossAccount;
                    const sourceAccount = matchDetails?.sourceAccount;
                    const existingTx = getExistingImportedTransaction(item);
                    const duplicate = Boolean(existingTx);
                    const isEditing = editingTxId === item.internalId;
                    const isSearchOpen = showSearchForFitId[item.internalId];
                    const query = searchQueries[item.internalId] || '';

                    if (isEditing) {
                      return (
                        <div 
                          key={item.internalId} 
                          className="bg-white rounded-3xl p-6 border-2 border-emerald-500 shadow-md space-y-4 flex flex-col animate-fadeIn"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-wider">
                            <Pencil className="w-4 h-4 text-emerald-600" /> Editando Transação Importada
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-left">Descrição</label>
                              <input
                                type="text"
                                value={tempDesc}
                                onChange={(e) => setTempDesc(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Descrição"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-left">Data</label>
                              <input
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-left">Valor</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 select-none">R$</span>
                                <CurrencyInput
                                  value={tempAmount}
                                  onChange={(val) => setTempAmount(val)}
                                  showPrefix={false}
                                  placeholder="0,00"
                                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-105 border-slate-100 font-sans">
                            <div className="text-[11px] text-slate-500 font-medium">
                              Original do extrato: <span className="font-semibold text-slate-600">{item.originalDescription || item.description}</span>
                            </div>

                            <div className="flex items-center gap-2 self-end">
                              <button
                                onClick={() => setEditingTxId(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                              >
                                ✗ Cancelar
                              </button>
                              <button
                                onClick={() => handleConfirmInlineEdit(item.internalId)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                              >
                                ✓ Confirmar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (!duplicate && !match) {
                      return (
                        <div
                          key={item.internalId}
                          className="rounded-3xl p-5 border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-all animate-fadeIn"
                        >
                          <div className="flex items-start justify-between gap-4">
                            {/* Coluna esquerda — badges + título + descrição original */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Badges */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                                  item.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {item.type === 'CREDIT' ? (
                                    <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" />
                                  ) : (
                                    <ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" />
                                  )}
                                  {item.type === 'CREDIT' ? 'ENTRADA' : 'SAÍDA'}
                                </span>

                                <span className="inline-flex items-center bg-amber-50 text-amber-700 border border-amber-100 font-black px-2 py-0.5 rounded-md text-[8px] uppercase tracking-wider">
                                  SEM CORRESPONDÊNCIA
                                </span>

                                {item.isAutoCategorized && (
                                  item.autoCategorizedSource === 'historico' ? (
                                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-100 font-black px-1.5 py-0.5 rounded-md text-[8px] uppercase tracking-wider">
                                      Igual ao histórico
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-100 font-black px-1.5 py-0.5 rounded-md text-[8px] uppercase tracking-wider">
                                      <Zap className="w-2.5 h-2.5 shrink-0" /> Sugestão automática
                                    </span>
                                  )
                                )}
                              </div>

                              {/* Título da transação */}
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-snug">
                                {item.description}
                              </h4>

                              {/* Descrição original se foi editada */}
                              {item.originalDescription && item.originalDescription !== item.description && (
                                <p className="text-[10px] text-slate-400 font-medium italic leading-tight">
                                  Original: {item.originalDescription}
                                </p>
                              )}
                            </div>

                            {/* Coluna direita — valor destacado + data */}
                            <div className="text-right shrink-0">
                              <p className={`font-mono font-black text-lg leading-none flex items-center justify-end gap-1 ${
                                item.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'
                              }`}>
                                {item.type === 'CREDIT' ? (
                                  <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <ArrowDownRight className="w-4 h-4 text-rose-500 shrink-0" />
                                )}
                                {formatCurrency(item.amount)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">
                                {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          {/* Barra de ações */}
                          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 flex-wrap">

                            {/* Editar */}
                            <button
                              onClick={() => {
                                setEditingTxId(item.internalId);
                                setTempDesc(item.description);
                                setTempDate(item.date);
                                setTempAmount(item.amount);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" /> Editar
                            </button>

                            {/* Vincular a existente */}
                            <button
                              onClick={() => {
                                setShowSearchForFitId(prev => ({ ...prev, [item.internalId]: !prev[item.internalId] }));
                                setActiveSearchId(item.internalId);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer border ${
                                isSearchOpen
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'text-slate-500 border-slate-200 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200'
                              }`}
                            >
                              <Search className="w-3 h-3" />
                              {isSearchOpen ? 'Fechar busca' : 'Vincular a existente'}
                            </button>

                            {/* Criar novo lançamento */}
                            <button
                              onClick={() => {
                                setReconcileType('NORMAL');
                                setActiveNewTx(item);
                                setSelectedCatId(item.suggestedCategoryId || '');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer shadow-2xs"
                            >
                              <Plus className="w-3 h-3" /> Criar lançamento
                            </button>

                            {/* Dividir Lançamento (Rateio) */}
                            <button
                              onClick={() => handleOpenSplitModal(item)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                              title="Dividir este lançamento em múltiplas partes e categorias"
                            >
                              <Scissors className="w-3 h-3 text-purple-600" /> Dividir lançamento
                            </button>

                            {/* Ignorar — empurrado para a direita */}
                            <button
                              onClick={() => handleIgnore(item.internalId)}
                              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                              title="Ignorar"
                            >
                              <X className="w-3 h-3" /> Ignorar
                            </button>
                          </div>

                          {/* Busca integrada com seleção múltipla */}
                          {isSearchOpen && (
                            <div className="mt-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-3 animate-fadeIn text-left">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                  <Search className="w-3.5 h-3.5 text-blue-500" /> Vincular a Lançamentos Existentes
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  Meta: <span className="font-mono text-slate-700 font-black">{formatCurrency(item.amount)}</span>
                                </span>
                              </div>

                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Buscar por descrição, valor, data, categoria ou conta..."
                                  value={query}
                                  onChange={(e) => setSearchQueries(prev => ({ ...prev, [item.internalId]: e.target.value }))}
                                  onFocus={() => setActiveSearchId(item.internalId)}
                                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 focus:border-blue-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                                  autoFocus
                                />
                                {query && (
                                  <button
                                    onClick={() => setSearchQueries(prev => ({ ...prev, [item.internalId]: '' }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Resultados da busca / lista de candidatos com checkbox e ajuste inline */}
                              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto w-full text-left">
                                {(() => {
                                  const results = filterResults(query, item.type, item.amount).slice(0, 15);
                                  const selectedMap = selectedCandidatesByFitId[item.internalId] || {};

                                  if (results.length === 0) {
                                    return (
                                      <p className="p-4 text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">
                                        {query ? 'Nenhum lançamento pendente correspondente encontrado' : 'Nenhum lançamento pendente encontrado'}
                                      </p>
                                    );
                                  }

                                  return results.map(candidate => {
                                    const isSelected = selectedMap[candidate.id] !== undefined;
                                    const currentAmount = isSelected ? selectedMap[candidate.id] : Math.abs(candidate.amount);
                                    const candAcc = accountsMap[candidate.accountId];
                                    const isOtherAcc = candidate.accountId !== selectedAccountId;

                                    return (
                                      <div
                                        key={candidate.id}
                                        onClick={() => handleToggleCandidate(item.internalId, candidate)}
                                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer select-none ${
                                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3 min-w-0 mr-3">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 pointer-events-none"
                                          />
                                          <div className="space-y-0.5 min-w-0">
                                            <div className="font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
                                              {candidate.description}
                                              {candidate.recurrenceGroupId != null && (
                                                <span className="bg-blue-50 text-blue-600 font-extrabold text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 border border-blue-100">
                                                  RECORRENTE
                                                </span>
                                              )}
                                              {isOtherAcc && candAcc && (
                                                <span className="bg-amber-50 text-amber-700 font-extrabold text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 border border-amber-200 flex items-center gap-1">
                                                  <Building2 className="w-2.5 h-2.5 text-amber-600" />
                                                  {candAcc.name}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                                              <span className="font-mono">{new Date(candidate.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                              <span className="text-slate-300">•</span>
                                              <span>{candidate.categoryName || 'Sem Categoria'}</span>
                                              {!isOtherAcc && candAcc && (
                                                <>
                                                  <span className="text-slate-300">•</span>
                                                  <span className="text-slate-500 font-medium">{candAcc.name}</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Valor / Edição inline se selecionado */}
                                        <div className="shrink-0 text-right" onClick={(e) => e.stopPropagation()}>
                                          {isSelected ? (
                                            <div className="flex items-center gap-1 bg-white border border-blue-300 rounded-lg px-2 py-1 shadow-xs">
                                              <span className="text-[10px] font-bold text-slate-400 select-none">R$</span>
                                              <CurrencyInput
                                                value={currentAmount}
                                                onChange={(val) => handleUpdateCandidateAmount(item.internalId, candidate.id, val)}
                                                showPrefix={false}
                                                placeholder="0,00"
                                                className="w-20 text-xs font-mono font-black text-slate-900 focus:outline-none text-right bg-transparent"
                                              />
                                            </div>
                                          ) : (
                                            <div className="font-mono font-black text-slate-900">
                                              {formatCurrency(candidate.amount)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>

                              {/* Rodapé fixo do vinculador com conferência de saldo */}
                              {(() => {
                                const selectedMap = selectedCandidatesByFitId[item.internalId] || {};
                                const selectedIds = Object.keys(selectedMap);
                                const selectedCount = selectedIds.length;
                                const sumSelected = selectedIds.reduce((acc, id) => acc + (Number(selectedMap[id]) || 0), 0);
                                const targetAmount = Math.abs(item.amount);
                                const diff = targetAmount - sumSelected;
                                const isValidMatch = selectedCount > 0 && Math.abs(diff) <= 0.012;

                                return (
                                  <div className="space-y-2 pt-2 border-t border-slate-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                      <div>
                                        <div className="text-[11px] font-black text-slate-700">
                                          Selecionados: <span className="text-blue-600">{selectedCount}</span> · Total: <span className="font-mono font-black text-slate-900">{formatCurrency(sumSelected)}</span>
                                        </div>
                                        <div className="text-[10px] font-semibold text-slate-500">
                                          Valor do extrato: <span className="font-mono font-bold">{formatCurrency(targetAmount)}</span>
                                        </div>
                                      </div>

                                      <div className="shrink-0">
                                        {selectedCount === 0 ? (
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            Nenhum selecionado
                                          </span>
                                        ) : isValidMatch ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Total confere
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                            <AlertCircle className="w-3.5 h-3.5" /> {diff > 0 ? `Faltam ${formatCurrency(Math.abs(diff))}` : `Excedeu ${formatCurrency(Math.abs(diff))}`}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-1">
                                      <button
                                        onClick={() => {
                                          setShowSearchForFitId(prev => ({ ...prev, [item.internalId]: false }));
                                          setSearchQueries(prev => ({ ...prev, [item.internalId]: '' }));
                                        }}
                                        className="px-3.5 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={() => handleConciliationMatchMultiple(item)}
                                        disabled={!isValidMatch}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Confirmar Vínculo {selectedCount > 0 ? `(${selectedCount})` : ''}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const ledgerTxsForFitId = transactions.filter(
                      t => t.accountId === selectedAccountId && t.fitId === item.fitId
                    );
                    const isSplitTransaction = ledgerTxsForFitId.length > 1;

                    return (
                      <div 
                        key={item.internalId} 
                        className={`rounded-3xl p-5 border shadow-sm transition-all animate-fadeIn ${
                          duplicate 
                            ? 'bg-slate-50/70 border-slate-200/80' 
                            : isCrossAccount
                              ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300'
                              : 'bg-white border-emerald-100 hover:border-emerald-250'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1 w-full">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                item.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                {item.type === 'CREDIT' ? (
                                  <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" />
                                )}
                                {item.type === 'CREDIT' ? 'ENTRADA' : 'SAÍDA'}
                              </span>

                              {duplicate ? (
                                isSplitTransaction ? (
                                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-200 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                    <Scissors className="w-2.5 h-2.5 text-purple-700" /> DIVIDIDO EM {ledgerTxsForFitId.length} LANÇAMENTOS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                    JÁ IMPORTADO
                                  </span>
                                )
                              ) : isCrossAccount ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                  <Building2 className="w-2.5 h-2.5 text-amber-700" /> MATCH EM OUTRO BANCO: {sourceAccount?.name || 'Outra Conta'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                  MATCH ENCONTRADO
                                </span>
                              )}

                              {item.isAutoCategorized && (
                                item.autoCategorizedSource === 'historico' ? (
                                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-100 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                    Igual a um lançamento anterior
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-100 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                    <Zap className="w-2.5 h-2.5 text-blue-550 shrink-0" /> (Sugerido)
                                  </span>
                                )
                              )}

                              <span className="text-[10px] text-slate-400 font-mono font-bold ml-auto md:ml-0">
                                {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            </div>

                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mt-1 leading-snug">
                              {item.description}
                            </h4>
                            {item.originalDescription && item.originalDescription !== item.description && (
                              <p className="text-[10px] text-slate-400/85 font-semibold italic leading-tight">
                                Original: {item.originalDescription}
                              </p>
                            )}
                            <p className="text-[10px] font-black text-slate-500">
                              Valor extrato: <span className="font-mono text-slate-900 font-black inline-flex items-center gap-1">
                                {item.type === 'CREDIT' ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                )}
                                {formatCurrency(item.amount)}
                              </span>
                            </p>
                          </div>

                          {/* Seção de Ações e Correspondências */}
                          <div className="shrink-0 flex items-stretch md:items-center justify-end gap-2 text-right">
                            {duplicate ? (
                              isSplitTransaction ? (
                                <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3.5 space-y-2 text-left w-full md:w-[420px]">
                                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-purple-700 border-b border-purple-200/60 pb-1.5">
                                    <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-purple-600" /> Partes da Divisão (Split)</span>
                                    <span>Total: {formatCurrency(ledgerTxsForFitId.reduce((acc, t) => acc + Math.abs(t.amount), 0))}</span>
                                  </div>
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                    {ledgerTxsForFitId.map((partTx, idx) => (
                                      <div key={partTx.id || idx} className="flex items-center justify-between text-xs bg-white/90 p-2 rounded-xl border border-purple-100 shadow-2xs">
                                        <div className="min-w-0 pr-2">
                                          <p className="font-bold text-slate-800 truncate text-[11px]">{partTx.description}</p>
                                          <p className="text-[9px] text-purple-700 font-semibold">{partTx.categoryName || 'Sem Categoria'}</p>
                                        </div>
                                        <span className="font-mono font-black text-slate-900 shrink-0 text-xs">
                                          {formatCurrency(partTx.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2 pt-1 border-t border-purple-200/60">
                                    <button
                                      type="button"
                                      onClick={() => handleAcknowledge(item.internalId)}
                                      className="flex-1 py-1.5 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Reconhecer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setUnreconcileConfirmItem({ internalId: item.internalId, fitId: item.fitId, txIds: ledgerTxsForFitId.map(t => t.id), description: item.description })}
                                      className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Undo2 className="w-3.5 h-3.5" /> Desfazer
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-slate-100 border border-slate-200/80 rounded-2xl p-3.5 text-left w-full md:w-[440px] space-y-2.5">
                                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" /> Comparação de Lançamento Duplicado
                                    </span>
                                    <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                                      FITID: {item.fitId}
                                    </span>
                                  </div>

                                  {/* Grid de Comparação Visual Lado a Lado */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {/* Bloco Extrato */}
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">
                                        Dados do Extrato
                                      </span>
                                      <p className="text-[11px] font-bold text-slate-800 truncate" title={item.description}>{item.description}</p>
                                      <p className="text-[10px] font-mono text-slate-500">
                                        {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')} · <strong className="text-slate-900">{formatCurrency(item.amount)}</strong>
                                      </p>
                                    </div>

                                    {/* Bloco Sistema */}
                                    <div className="bg-white p-2.5 rounded-xl border border-purple-200/80 shadow-2xs space-y-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-purple-600 block">
                                        Já no Sistema
                                      </span>
                                      <p className="text-[11px] font-bold text-slate-800 truncate" title={existingTx?.description || 'N/A'}>
                                        {existingTx?.description || 'N/A'}
                                      </p>
                                      <p className="text-[10px] font-mono text-slate-500">
                                        {existingTx?.date ? new Date(existingTx.date + 'T00:00:00').toLocaleDateString('pt-BR') : ''} · <strong className="text-slate-900">{formatCurrency(existingTx?.amount || 0)}</strong>
                                      </p>
                                      <div className="flex items-center justify-between text-[9px] pt-0.5 text-purple-700 font-bold">
                                        <span>{existingTx?.categoryName || 'Sem Categoria'}</span>
                                        <span className="bg-purple-50 text-purple-700 px-1.5 rounded">{existingTx?.status || 'REGISTRADO'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                                    <button
                                      type="button"
                                      onClick={() => handleAcknowledge(item.internalId)}
                                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Reconhecer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setUnreconcileConfirmItem({ internalId: item.internalId, fitId: item.fitId, txIds: ledgerTxsForFitId.map(t => t.id), description: item.description })}
                                      className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Undo2 className="w-3.5 h-3.5" /> Desfazer
                                    </button>
                                  </div>
                                </div>
                              )
                            ) : isCrossAccount ? (
                              /* Visual para match de outra conta/banco */
                              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-left w-full md:w-[430px] space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                                  <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  Correspondência no banco: <span className="underline decoration-amber-400">{sourceAccount?.name || 'Outra Conta'}</span>
                                </div>
                                <div className="text-xs text-slate-700 font-bold leading-normal">
                                  ✓ Lançamento sistema: <span className="text-slate-900 font-extrabold">{match?.description}</span> —{' '}
                                  <span className="font-mono">{match?.date ? new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</span> —{' '}
                                  <span className="text-blue-600 font-black">{match?.categoryName || 'Sem Categoria'}</span>
                                </div>
                                <div className="text-[10px] font-semibold text-slate-500 leading-none">
                                  Valor sistema: <span className="font-mono font-bold text-slate-700">{formatCurrency(match?.amount || 0)}</span> · Valor extrato: <span className="font-mono font-bold text-slate-800">{formatCurrency(item.amount)}</span>
                                </div>
                                <div className="text-[9.5px] text-amber-800 bg-amber-100/60 rounded-xl p-2 font-medium leading-tight">
                                  ℹ️ Ao confirmar, o lançamento será conciliado e realocado para <strong>{selectedAccount?.name}</strong>, prevenindo duplicidades.
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                                  <button
                                    onClick={() => handleConciliationMatch(item, match!)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide px-3.5 py-2 flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.02] shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Confirmar e Realocar para esta conta
                                  </button>

                                  <button
                                    onClick={() => handleIgnore(item.internalId)}
                                    className="text-slate-400 hover:text-slate-600 text-[10px] font-extrabold uppercase tracking-wider px-2 py-2 cursor-pointer"
                                  >
                                    Ignorar
                                  </button>

                                  <button
                                    onClick={() => {
                                      setEditingTxId(item.internalId);
                                      setTempDesc(item.description);
                                      setTempDate(item.date);
                                      setTempAmount(item.amount);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all ml-auto cursor-pointer"
                                    title="Editar transação antes de conciliar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* 2. Visual de cada transação com match automático na mesma conta */
                              <div className="bg-emerald-55 bg-emerald-50 text-emerald-600 rounded-2xl p-4 text-left w-full md:w-[410px] space-y-3">
                                <div>
                                  <div className="text-xs text-slate-700 font-bold leading-normal">
                                    ✓ Corresponde a: <span className="text-emerald-800 font-extrabold">{match?.description}</span> —{' '}
                                    <span className="font-mono">{match?.date ? new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</span> —{' '}
                                    <span className="text-blue-600 font-black">{match?.categoryName || 'Sem Categoria'}</span>
                                  </div>
                                  <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-none">
                                    Valor sistema: <span className="font-mono font-bold text-slate-705">{formatCurrency(match?.amount || 0)}</span> · Valor extrato: <span className="font-mono font-bold text-slate-750">{formatCurrency(item.amount)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-emerald-100">
                                  <button
                                    onClick={() => handleConciliationMatch(item, match!)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide px-3.5 py-2 flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.02] shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Conciliar automaticamente
                                  </button>

                                  <button
                                    onClick={() => handleIgnore(item.internalId)}
                                    className="text-slate-400 hover:text-slate-600 text-[10px] font-extrabold uppercase tracking-wider px-2 py-2 cursor-pointer"
                                  >
                                    Ignorar
                                  </button>

                                  <button
                                    onClick={() => {
                                      setEditingTxId(item.internalId);
                                      setTempDesc(item.description);
                                      setTempDate(item.date);
                                      setTempAmount(item.amount);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all ml-auto cursor-pointer"
                                    title="Editar transação antes de conciliar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Criar e Conciliar Transação Nova de Forma Direta */}
      {activeNewTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
            onClick={() => setActiveNewTx(null)}
          />
          <div className={`relative bg-white w-full ${reconcileType === 'DIVIDIR' || reconcileType === 'TRANSFERENCIA' ? 'max-w-lg' : 'max-w-md'} rounded-[28px] shadow-2xl border border-slate-100 animate-fadeIn flex flex-col max-h-[92vh] overflow-hidden transition-all`}>
            
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  {reconcileType === 'DIVIDIR' ? (
                    <>
                      <Scissors className="w-4 h-4 text-purple-600" /> Dividir Lançamento (Rateio)
                    </>
                  ) : reconcileType === 'TRANSFERENCIA' ? (
                    <>
                      <ArrowLeftRight className="w-4 h-4 text-blue-600" /> Transferência Entre Contas
                    </>
                  ) : reconcileType === 'PARCELA' ? (
                    <>
                      <Layers className="w-4 h-4 text-amber-600" /> Parcela de Compra Parcelada
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-blue-600" /> Criar Lançamento Reconciliado
                    </>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mt-0.5">
                  {reconcileType === 'DIVIDIR'
                    ? 'Distribua o valor do extrato entre múltiplos lançamentos e categorias'
                    : reconcileType === 'TRANSFERENCIA'
                      ? 'Transfira valores entre contas com conciliação automática nas duas pontas'
                      : reconcileType === 'PARCELA'
                        ? 'Identifique o número e o total de parcelas deste lançamento'
                        : 'Selecione a categoria para criar e conciliar imediatamente'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNewTx(null)}
                className="p-1.5 hover:bg-slate-200/60 rounded-full transition-all cursor-pointer ml-4 shrink-0 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">

              {/* Card 1 — Dados do Extrato (Fonte da Verdade) */}
              <div className="bg-slate-50 text-slate-800 rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Dados do Extrato Bancário
                    </span>
                  </div>
                  {activeNewTx.type === 'DEBIT' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3 text-rose-600" /> Saída / Débito
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-emerald-600" /> Entrada / Crédito
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Descrição</span>
                  <p className="font-bold text-slate-900 text-xs leading-snug break-words">
                    {activeNewTx.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-slate-200/80">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Valor</span>
                    <p className={`font-mono text-sm font-black ${activeNewTx.type === 'DEBIT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {activeNewTx.type === 'DEBIT' ? '-' : '+'} {formatCurrency(Math.abs(activeNewTx.amount))}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Data</span>
                    <p className="font-mono text-xs font-bold text-slate-700 mt-0.5">
                      {new Date(activeNewTx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2 — Tipo de lançamento (toggle com 4 opções) */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Tipo de Conciliação</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 bg-white border border-slate-200 p-1 rounded-xl gap-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setReconcileType('NORMAL')}
                    className={`py-2 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reconcileType === 'NORMAL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Tag className="w-3 h-3 shrink-0" />
                    <span className="truncate">Lançamento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReconcileType('TRANSFERENCIA');
                      const firstCounterpart = accounts.find(a => a.id !== selectedAccountId);
                      if (firstCounterpart && !recTfCounterpartId) setRecTfCounterpartId(firstCounterpart.id);
                    }}
                    className={`py-2 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reconcileType === 'TRANSFERENCIA'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowLeftRight className="w-3 h-3 shrink-0" />
                    <span className="truncate">Transferência</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (splitParts.length < 2 && activeNewTx) {
                        const target = Math.abs(activeNewTx.amount);
                        const half = Math.round((target / 2) * 100) / 100;
                        const rest = Math.round((target - half) * 100) / 100;
                        setSplitParts([
                          {
                            id: `part_${Date.now()}_1`,
                            description: activeNewTx.description,
                            categoryId: activeNewTx.suggestedCategoryId || '',
                            amount: half
                          },
                          {
                            id: `part_${Date.now()}_2`,
                            description: activeNewTx.description,
                            categoryId: '',
                            amount: rest
                          }
                        ]);
                      }
                      setReconcileType('DIVIDIR');
                    }}
                    className={`py-2 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reconcileType === 'DIVIDIR'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Scissors className="w-3 h-3 shrink-0" />
                    <span className="truncate">Dividir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReconcileType('PARCELA')}
                    className={`py-2 px-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reconcileType === 'PARCELA'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-3 h-3 shrink-0" />
                    <span className="truncate">Parcela</span>
                  </button>
                </div>
              </div>

              {/* Card 3 — Categoria, Transferência, Rateio ou Parcela */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                {reconcileType === 'DIVIDIR' ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-purple-600" />
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Divisão do Lançamento (Rateio)</span>
                      </div>
                      <span className="text-[9px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                        {splitParts.length} partes
                      </span>
                    </div>

                    <div className="space-y-3">
                      {splitParts.map((part, idx) => (
                        <div key={part.id} className="bg-white rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5 shadow-2xs text-left">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">
                              Parte {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitPart(part.id)}
                              disabled={splitParts.length <= 2}
                              className="text-slate-400 hover:text-rose-500 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors p-1 cursor-pointer"
                              title={splitParts.length <= 2 ? "Mínimo de 2 partes necessárias" : "Remover esta parte"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Descrição da parte */}
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Descrição da Parte
                            </label>
                            <input
                              type="text"
                              value={part.description}
                              onChange={(e) => handleUpdateSplitPart(part.id, { description: e.target.value })}
                              placeholder="Ex: Pagamento Fornecedor A"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                              required
                            />
                          </div>

                          {/* Grid Categoria e Valor */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Categoria
                              </label>
                              <select
                                value={part.categoryId}
                                onChange={(e) => handleUpdateSplitPart(part.id, { categoryId: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                                required
                              >
                                <option value="">Selecione a Categoria...</option>
                                {Object.keys(groupedCats.items).map((groupName) => {
                                   const groupItems = groupedCats.items[groupName] || [];
                                   return (
                                     <optgroup key={groupName} label={groupName.toUpperCase()}>
                                       {groupItems.map(c => (
                                         <option key={c.id} value={c.id}>
                                           {c.name}
                                         </option>
                                       ))}
                                     </optgroup>
                                   );
                                 })}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Valor
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 select-none">R$</span>
                                <CurrencyInput
                                  value={part.amount}
                                  onChange={(val) => handleUpdateSplitPart(part.id, { amount: val })}
                                  showPrefix={false}
                                  placeholder="0,00"
                                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-right"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Botão Adicionar Divisão */}
                      <button
                        type="button"
                        onClick={handleAddSplitPart}
                        className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 border-dashed rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar divisão
                      </button>

                      {/* Resumo de Conferência de Valor */}
                      {(() => {
                        const totalSplit = splitParts.reduce((acc, p) => acc + (typeof p.amount === 'number' ? p.amount : (parseFloat(p.amount) || 0)), 0);
                        const targetAmount = Math.abs(activeNewTx.amount);
                        const diff = targetAmount - totalSplit;
                        const isSplitValid = Math.abs(diff) <= 0.012;

                        return (
                          <div className={`p-3.5 rounded-2xl border transition-all ${
                            isSplitValid 
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' 
                              : 'bg-rose-50/80 border-rose-200 text-rose-800'
                          }`}>
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>Total das partes:</span>
                              <span className="font-mono font-black text-sm">{formatCurrency(totalSplit)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mt-1">
                              <span>Valor do extrato:</span>
                              <span className="font-mono">{formatCurrency(targetAmount)}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-current/10 flex items-center justify-between text-xs font-black">
                              {isSplitValid ? (
                                <span className="flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 className="w-4 h-4" /> Total confere com o extrato
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-700">
                                  <AlertCircle className="w-4 h-4" /> 
                                  {diff > 0 
                                    ? `Faltam ${formatCurrency(Math.abs(diff))} para fechar` 
                                    : `Excedeu ${formatCurrency(Math.abs(diff))} do extrato`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : reconcileType === 'PARCELA' ? (
                  /* Modo PARCELA */
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-600" />
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Identificação de Compra Parcelada</span>
                      </div>
                      <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                        Parcela {installmentNumber} de {installmentCount}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          Nº da Parcela Atual
                        </label>
                        <input 
                          type="number"
                          min={1}
                          max={installmentCount || 99}
                          value={installmentNumber}
                          onChange={(e) => setInstallmentNumber(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          Total de Parcelas
                        </label>
                        <input 
                          type="number"
                          min={Math.max(2, installmentNumber)}
                          max={99}
                          value={installmentCount}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setInstallmentCount(val);
                            if (installmentNumber > val) setInstallmentNumber(val);
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                        Categoria Financeira
                      </label>
                      <select
                        value={selectedCatId}
                        onChange={(e) => setSelectedCatId(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-bold cursor-pointer transition-colors shadow-2xs ${
                          isSuggestedSelected
                            ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                        required
                      >
                        <option value="">Selecione a Categoria...</option>
                        {Object.keys(groupedCats.items).map((groupName) => {
                          const groupItems = groupedCats.items[groupName] || [];
                          return (
                            <optgroup key={groupName} label={groupName.toUpperCase()}>
                              {groupItems.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}{c.id === activeNewTx.suggestedCategoryId ? ' ★ Sugerido' : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>

                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2 text-[10.5px] text-amber-900 font-medium leading-relaxed">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Registra este lançamento como <strong>Parcela {installmentNumber} de {installmentCount}</strong> para rastreamento organizado. Não gera parcelas futuras automaticamente.
                      </span>
                    </div>
                  </>
                ) : reconcileType === 'NORMAL' ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Categoria Financeira</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                        Atribuir Categoria
                      </label>
                      <select
                        value={selectedCatId}
                        onChange={(e) => setSelectedCatId(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold cursor-pointer transition-colors ${
                          isSuggestedSelected
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                        required
                      >
                        <option value="">Selecione a Categoria...</option>
                        {Object.keys(groupedCats.items).map((groupName) => {
                          const groupItems = groupedCats.items[groupName] || [];
                          return (
                            <optgroup key={groupName} label={groupName.toUpperCase()}>
                              {groupItems.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}{c.id === activeNewTx.suggestedCategoryId ? ' ★ Sugerido' : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>

                      {groupedCats.usingFallback && (
                        <p className="mt-1.5 text-[9px] text-amber-600 font-bold uppercase tracking-wide flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Nenhuma categoria do tipo cadastrada — exibindo todas
                        </p>
                      )}

                      {isSuggestedSelected && (
                        <div className="mt-2 flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-[9px] text-blue-600 font-extrabold uppercase tracking-wide animate-fadeIn format-auto-match-label">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Categoria sugerida automaticamente pelo sistema</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Modo TRANSFERÊNCIA — Fluxo com as Duas Contas e Seta */
                  (() => {
                    const isExit = activeNewTx.amount < 0;
                    const currentAccount = accounts.find(a => a.id === selectedAccountId);
                    const otherAccounts = accounts.filter(a => a.id !== selectedAccountId);

                    // Card da Conta Atual (Extrato Conciliado)
                    const renderCurrentAccountCard = (role: 'ORIGEM' | 'DESTINO') => (
                      <div className={`rounded-xl p-3 border flex flex-col justify-between min-h-[92px] ${
                        role === 'ORIGEM'
                          ? 'bg-rose-50/70 border-rose-200/90 text-rose-950'
                          : 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              role === 'ORIGEM' ? 'text-rose-700' : 'text-emerald-700'
                            }`}>
                              {role === 'ORIGEM' ? (
                                <><ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" /> CONTA DE SAÍDA</>
                              ) : (
                                <><ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" /> CONTA DE DESTINO</>
                              )}
                            </span>
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                              Atual
                            </span>
                          </div>
                          <p className="font-black text-slate-900 text-xs truncate" title={currentAccount?.name || 'Conta Atual'}>
                            {currentAccount?.name || 'Conta Atual'}
                          </p>
                        </div>
                        <div className="pt-1.5 mt-1 border-t border-black/5 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Impacto:</span>
                          <span className={`text-xs font-mono font-black ${
                            role === 'ORIGEM' ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {role === 'ORIGEM' ? '-' : '+'} {formatCurrency(Math.abs(activeNewTx.amount))}
                          </span>
                        </div>
                      </div>
                    );

                    // Card da Conta Contrapartida (Select)
                    const renderCounterpartSelectCard = (role: 'ORIGEM' | 'DESTINO') => (
                      <div className={`rounded-xl p-3 border flex flex-col justify-between min-h-[92px] ${
                        role === 'ORIGEM'
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-emerald-50/40 border-emerald-200/80'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              role === 'ORIGEM' ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {role === 'ORIGEM' ? (
                                <><ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" /> CONTA DE ORIGEM</>
                              ) : (
                                <><ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" /> CONTA DE DESTINO</>
                              )}
                            </span>
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Contrapartida
                            </span>
                          </div>
                          <select
                            value={recTfCounterpartId}
                            onChange={(e) => setRecTfCounterpartId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
                            required
                          >
                            <option value="">Selecione a conta...</option>
                            {otherAccounts.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="pt-1.5 mt-1 border-t border-black/5 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Impacto:</span>
                          <span className={`text-xs font-mono font-black ${
                            role === 'ORIGEM' ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {role === 'ORIGEM' ? '-' : '+'} {formatCurrency(Math.abs(activeNewTx.amount))}
                          </span>
                        </div>
                      </div>
                    );

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                              Sentido da Transferência
                            </span>
                          </div>
                          <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            2 Lançamentos
                          </span>
                        </div>

                        {/* Grid das duas contas com seta indicativa */}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                          {isExit ? (
                            <>
                              {renderCurrentAccountCard('ORIGEM')}
                              <div className="flex sm:flex-col items-center justify-center py-1 sm:py-0">
                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shadow-xs">
                                  <ArrowRight className="w-3.5 h-3.5 text-blue-600 rotate-90 sm:rotate-0" />
                                </div>
                              </div>
                              {renderCounterpartSelectCard('DESTINO')}
                            </>
                          ) : (
                            <>
                              {renderCounterpartSelectCard('ORIGEM')}
                              <div className="flex sm:flex-col items-center justify-center py-1 sm:py-0">
                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shadow-xs">
                                  <ArrowRight className="w-3.5 h-3.5 text-blue-600 rotate-90 sm:rotate-0" />
                                </div>
                              </div>
                              {renderCurrentAccountCard('DESTINO')}
                            </>
                          )}
                        </div>

                        <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2 text-[10px] text-blue-900 font-semibold leading-relaxed">
                          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            O sistema criará o lançamento de entrada e saída correspondente e pré-conciliará nas duas contas automaticamente.
                          </span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Footer com botões */}
            {(() => {
              const isSplitValid = reconcileType === 'DIVIDIR' && 
                splitParts.length >= 2 &&
                splitParts.every(p => p.description.trim().length > 0 && !!p.categoryId && Number(p.amount) > 0) &&
                Math.abs(Math.abs(activeNewTx.amount) - splitParts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)) <= 0.012;

              const isParcelaValid = reconcileType === 'PARCELA' && !!selectedCatId && installmentNumber >= 1 && installmentCount >= 1;

              const isDisabled = reconcileType === 'NORMAL' 
                ? !selectedCatId 
                : reconcileType === 'TRANSFERENCIA' 
                  ? !recTfCounterpartId 
                  : reconcileType === 'PARCELA'
                    ? !isParcelaValid
                    : !isSplitValid;

              return (
                <div className="px-6 pb-5 pt-3.5 border-t border-slate-100 flex flex-col gap-2.5 bg-slate-50/50">
                  <button
                    onClick={() => handleCreateAndConciliate(activeNewTx)}
                    disabled={isDisabled}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-xs transition-all hover:scale-[1.005] active:scale-95 disabled:opacity-40 disabled:scale-100 cursor-pointer"
                  >
                    {reconcileType === 'DIVIDIR' 
                      ? `Confirmar Divisão (${splitParts.length} partes)` 
                      : reconcileType === 'TRANSFERENCIA'
                        ? 'Confirmar Transferência'
                        : reconcileType === 'PARCELA'
                          ? `Confirmar Parcela (${installmentNumber}/${installmentCount})`
                          : 'Confirmar e Registrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNewTx(null)}
                    className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Desfazer e Reabrir */}
      {unreconcileConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
            onClick={() => setUnreconcileConfirmItem(null)}
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 p-6 animate-fadeIn text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900">
                Desfazer Lançamento e Reabrir Extrato
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Isso vai <strong>excluir o(s) lançamento(s)</strong> criado(s) no sistema para <em>"{unreconcileConfirmItem.description}"</em> e permitir processar este item do extrato novamente. Confirmar?
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setUnreconcileConfirmItem(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUnreconcile}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-xs transition-colors cursor-pointer"
              >
                Sim, desfazer e reabrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Importar Novo Arquivo com Lote em Andamento */}
      {showPendingImportConfirm && pendingFile && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Lote em andamento</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Você tem <strong>{visibleImported.length} itens</strong> ainda não revisados desta importação. Importar um novo arquivo vai adicionar a esta lista. Deseja continuar?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPendingImportConfirm(false);
                  setPendingFile(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPendingImportConfirm(false);
                  if (pendingFile) {
                    processFile(pendingFile, true);
                    setPendingFile(null);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
