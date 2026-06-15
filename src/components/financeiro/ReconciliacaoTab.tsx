import React, { useState, useMemo, useRef } from 'react';
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
  Search
} from 'lucide-react';
import { BankAccount, FinancialCategory, FinancialTransaction } from '../../types';
import { parseBankStatement, ParsedOFXTransaction } from './ofxParser';
import { toast } from 'sonner';

export interface AutoParsedOFXTransaction extends ParsedOFXTransaction {
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  isAutoCategorized?: boolean;
  originalDescription?: string;
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

interface ReconciliacaoTabProps {
  accounts: BankAccount[];
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
  onAddTransaction: (tx: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">) => void;
  onAddTransactions: (txs: Omit<FinancialTransaction, "id" | "companyId" | "createdAt">[]) => void;
  onUpdateStatus: (id: string, status: 'PENDENTE' | 'CONCILIADO' | 'IGNORADO') => void;
  onUpdateTransactions: (items: { id: string, updates: Partial<FinancialTransaction> }[]) => void;
}

export const ReconciliacaoTab: React.FC<ReconciliacaoTabProps> = ({
  accounts,
  categories,
  transactions,
  onAddTransaction,
  onAddTransactions,
  onUpdateStatus,
  onUpdateTransactions
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [importedTxs, setImportedTxs] = useState<AutoParsedOFXTransaction[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);
  const [conciliatedIds, setConciliatedIds] = useState<string[]>([]);
  
  // Para criação rápida de transação nova se não houver match
  const [activeNewTx, setActiveNewTx] = useState<AutoParsedOFXTransaction | null>(null);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [reconcileType, setReconcileType] = useState<'NORMAL' | 'TRANSFERENCIA'>('NORMAL');
  const [recTfCounterpartId, setRecTfCounterpartId] = useState('');

  // Edição inline de transação durante importação
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [tempDesc, setTempDesc] = useState('');
  const [tempDate, setTempDate] = useState('');
  const [tempAmount, setTempAmount] = useState<number>(0);

  // Estados para busca manual
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [showSearchForFitId, setShowSearchForFitId] = useState<Record<string, boolean>>({});
  const [activeSearchFitId, setActiveSearchFitId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtra as pendentes e agendadas da conta selecionada para fazer o match/pesquisa
  const searchCandidates = useMemo(() => {
    return transactions.filter(t => 
      t.accountId === selectedAccountId && 
      (t.status === 'PENDENTE' || t.status === 'AGENDADO')
    );
  }, [transactions, selectedAccountId]);

  // Proteção contra duplicação: verifica se já existe lançamento ID ou hash no banco para esta conta
  const isAlreadyImported = (imported: ParsedOFXTransaction) => {
    return transactions.some(t => t.accountId === selectedAccountId && t.fitId === imported.fitId);
  };

  // Função que avalia se uma transação importada tem match automático inteligente no sistema
  // - Valor igual (com tolerância de R$ 0,01)
  // - Data igual ou próxima (± 3 dias)
  // - Conta bancária igual (filtrado no escopo)
  const findMatch = (imported: ParsedOFXTransaction) => {
    const impDate = new Date(imported.date + 'T00:00:00');

    return searchCandidates.find(t => {
      // Verifica compatibilidade de tipo
      const isSameType = (imported.type === 'DEBIT' && t.type === 'DESPESA') || 
                         (imported.type === 'CREDIT' && t.type === 'RECEITA');
      if (!isSameType) return false;

      // Tolerância de R$ 0,01 valor
      const valMatch = Math.abs(Math.abs(t.amount) - imported.amount) <= 0.012;
      if (!valMatch) return false;

      // Diferença de até 3 dias
      const tDate = new Date(t.date + 'T00:00:00');
      const diffTime = Math.abs(impDate.getTime() - tDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays <= 3;
    });
  };

  // Filtro de resultados em tempo real para a pesquisa manual por descrição, valor ou data
  const filterResults = (query: string, itemType: 'CREDIT' | 'DEBIT') => {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    const desiredType = itemType === 'CREDIT' ? 'RECEITA' : 'DESPESA';

    return searchCandidates.filter(t => {
      if (t.type !== desiredType) return false;

      const descMatch = (t.description || '').toLowerCase().includes(q);
      const amountMatch = String(t.amount).includes(q) || formatCurrency(t.amount).toLowerCase().includes(q);
      const dateMatch = (t.date || '').includes(q) || new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR').includes(q);
      const categoryMatch = (t.categoryName || '').toLowerCase().includes(q);

      return descMatch || amountMatch || dateMatch || categoryMatch;
    });
  };

  // Resumo estatístico da importação para o topo
  const fileSummary = useMemo(() => {
    let total = importedTxs.length;
    let withMatch = 0;
    let noMatch = 0;
    let alreadyImported = 0;

    importedTxs.forEach(item => {
      if (isAlreadyImported(item)) {
        alreadyImported++;
      } else {
        const match = findMatch(item);
        if (match) {
          withMatch++;
        } else {
          noMatch++;
        }
      }
    });

    return { total, withMatch, noMatch, alreadyImported };
  }, [importedTxs, transactions, selectedAccountId]);

  // Transações visíveis (remove locais conciliadas e ignoradas)
  const visibleImported = useMemo(() => {
    return importedTxs.filter(tx => !ignoredIds.includes(tx.fitId) && !conciliatedIds.includes(tx.fitId));
  }, [importedTxs, ignoredIds, conciliatedIds]);

  // Progresso do lote importado
  const progressRatio = useMemo(() => {
    if (importedTxs.length === 0) return 0;
    const processed = importedTxs.length - visibleImported.length;
    return Math.round((processed / importedTxs.length) * 100);
  }, [importedTxs, visibleImported]);

  const groupedCats = useMemo(() => {
    if (!activeNewTx) return {};
    const relevantType = activeNewTx.type === 'CREDIT' ? 'RECEITA' : 'DESPESA';
    const filtered = categories.filter(c => c.type === relevantType);
    const groups: Record<string, FinancialCategory[]> = {};
    filtered.forEach(c => {
      const g = c.group || 'Diversas';
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return groups;
  }, [categories, activeNewTx]);

  const isSuggestedSelected = useMemo(() => {
    return !!(activeNewTx?.isAutoCategorized && selectedCatId === activeNewTx.suggestedCategoryId);
  }, [activeNewTx, selectedCatId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseBankStatement(text);
        if (parsed.length === 0) {
          toast.error("Nenhuma transação válida encontrada no arquivo extrato.");
          return;
        }

        // Aplica regras de autocategorização após parsing
        const enriched: AutoParsedOFXTransaction[] = parsed.map(tx => {
          const cat = findAutoCategory(tx.description, tx.type, categories);
          if (cat) {
            return {
              ...tx,
              originalDescription: tx.description,
              suggestedCategoryId: cat.id,
              suggestedCategoryName: cat.name,
              isAutoCategorized: true
            };
          }
          return {
            ...tx,
            originalDescription: tx.description
          };
        });

        setImportedTxs(enriched);
        setIgnoredIds([]);
        setConciliatedIds([]);
        setSearchQueries({});
        setShowSearchForFitId({});
        setActiveSearchFitId(null);
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
    if (file) {
      processFile(file);
    }
  };

  const handleConfirmInlineEdit = (fitId: string) => {
    setImportedTxs(prev => prev.map(tx => {
      if (tx.fitId === fitId) {
        const cat = findAutoCategory(tempDesc, tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT', categories);
        return {
          ...tx,
          description: tempDesc,
          date: tempDate,
          amount: tempAmount,
          suggestedCategoryId: cat?.id || tx.suggestedCategoryId,
          suggestedCategoryName: cat?.name || tx.suggestedCategoryName,
          isAutoCategorized: cat ? true : tx.isAutoCategorized
        };
      }
      return tx;
    }));
    setEditingTxId(null);
    toast.success("Transação atualizada localmente!");
  };

  const handleConciliationMatch = (imported: ParsedOFXTransaction, matched: FinancialTransaction) => {
    // Vincula o ID do extrato ao lançamento do sistema e muda status para CONCILIADO
    onUpdateTransactions([{
      id: matched.id,
      updates: {
        status: 'CONCILIADO',
        fitId: imported.fitId,
        reconciledAt: new Date().toISOString()
      }
    }]);

    setConciliatedIds(prev => [...prev, imported.fitId]);
    toast.success("Transação conciliada com lançamento existente com sucesso!");
  };

  const handleConciliateAllMatches = () => {
    const matchesToConciliate: { id: string, updates: Partial<FinancialTransaction> }[] = [];
    const localConciliated: string[] = [];

    importedTxs.forEach(item => {
      if (!isAlreadyImported(item) && !conciliatedIds.includes(item.fitId) && !ignoredIds.includes(item.fitId)) {
        const match = findMatch(item);
        if (match) {
          matchesToConciliate.push({
            id: match.id,
            updates: {
              status: 'CONCILIADO',
              fitId: item.fitId,
              reconciledAt: new Date().toISOString()
            }
          });
          localConciliated.push(item.fitId);
        }
      }
    });

    if (matchesToConciliate.length === 0) {
      toast.info("Nenhuma correspondência pendente para conciliação automática rápida.");
      return;
    }

    onUpdateTransactions(matchesToConciliate);
    setConciliatedIds(prev => [...prev, ...localConciliated]);
    toast.success(`${matchesToConciliate.length} correspondências de matches conciliadas automaticamente!`);
  };

  const handleIgnore = (fitId: string) => {
    setIgnoredIds(prev => [...prev, fitId]);
    toast.info("Transação marcada como ignorada.");
  };

  const handleCreateAndConciliate = (imported: AutoParsedOFXTransaction) => {
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

      setConciliatedIds(prev => [...prev, imported.fitId]);
      setActiveNewTx(null);
      setRecTfCounterpartId('');
      setReconcileType('NORMAL');
      toast.success("Transferência criada e conciliada nas duas contas com sucesso!");
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

    setConciliatedIds(prev => [...prev, imported.fitId]);
    setActiveNewTx(null);
    setSelectedCatId('');
    toast.success("Lançamento criado, registrado e conciliado!");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
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
                  setSearchQueries({});
                  setShowSearchForFitId({});
                  setActiveSearchFitId(null);
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
                {/* 5. Painel de Resumo da Importação no Topo */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-4.5 h-4.5 text-blue-500" /> Resumo da Importação
                    </h4>
                    {fileSummary.withMatch > 0 && (
                      <button
                        onClick={handleConciliateAllMatches}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" /> Conciliar todos os matches automaticamente
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Importadas</p>
                      <p className="text-lg font-black text-slate-700 mt-1.5">{fileSummary.total}</p>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">Com Match</p>
                      <p className="text-lg font-black text-emerald-800 mt-1.5">{fileSummary.withMatch}</p>
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
                  <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center text-emerald-700 animate-fadeIn">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p className="text-xs font-bold">Parabéns! Tudo conciliado</p>
                    <p className="text-[10px] font-semibold text-emerald-600 mt-1">Todas as transações deste extrato foram conciliadas ou gerenciadas com sucesso.</p>
                  </div>
                ) : (
                  visibleImported.map(item => {
                    const match = findMatch(item);
                    const duplicate = isAlreadyImported(item);
                    const isEditing = editingTxId === item.fitId;
                    const isSearchOpen = showSearchForFitId[item.fitId];
                    const query = searchQueries[item.fitId] || '';

                    if (isEditing) {
                      return (
                        <div 
                          key={item.fitId} 
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
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tempAmount}
                                  onChange={(e) => setTempAmount(parseFloat(e.target.value) || 0)}
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
                                onClick={() => handleConfirmInlineEdit(item.fitId)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                              >
                                ✓ Confirmar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={item.fitId} 
                        className={`rounded-3xl p-5 border shadow-sm transition-all animate-fadeIn ${
                          duplicate 
                            ? 'bg-slate-50/70 border-slate-200/80' 
                            : match 
                              ? 'bg-white border-emerald-100 hover:border-emerald-250' 
                              : 'bg-white border-slate-205 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1 w-full">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                item.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                {item.type === 'CREDIT' ? 'ENTRADA' : 'SAÍDA'}
                              </span>

                              {duplicate ? (
                                <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                  JÁ IMPORTADO
                                </span>
                              ) : match ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                  MATCH ENCONTRADO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider whitespace-nowrap">
                                  SEM CORRESPONDÊNCIA
                                </span>
                              )}

                              {item.isAutoCategorized && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-100 font-extrabold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                                  <Zap className="w-2.5 h-2.5 text-blue-550 shrink-0" /> AUTO
                                </span>
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
                              Valor extrato: <span className="font-mono text-slate-900 font-black">{formatCurrency(item.amount)}</span>
                            </p>
                          </div>

                          {/* Seção de Ações e Correspondências */}
                          <div className="shrink-0 flex items-stretch md:items-center justify-end gap-2 text-right">
                            {duplicate ? (
                              <div className="bg-slate-100 border border-slate-200/80 rounded-2xl p-3 text-left w-full md:w-80">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 block">
                                  Dispositivo de Segurança contra Duplicata
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold block leading-tight mt-1">
                                  Lançamento com mesmo FITID ou hash de dados já existe no sistema para esta mesma conta bancária.
                                </span>
                              </div>
                            ) : match ? (
                              /* 2. Visual de cada transação com match automático */
                              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-left w-full md:w-[410px] space-y-3">
                                <div>
                                  <div className="text-xs text-slate-700 font-bold leading-normal">
                                    ✓ Corresponde a: <span className="text-emerald-800 font-extrabold">{match.description}</span> —{' '}
                                    <span className="font-mono">{new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span> —{' '}
                                    <span className="text-blue-600 font-black">{match.categoryName || 'Sem Categoria'}</span>
                                  </div>
                                  <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-none">
                                    Valor sistema: <span className="font-mono font-bold text-slate-705">{formatCurrency(match.amount)}</span> · Valor extrato: <span className="font-mono font-bold text-slate-750">{formatCurrency(item.amount)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-emerald-100">
                                  <button
                                    onClick={() => handleConciliationMatch(item, match)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wide px-3.5 py-2 flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.02] shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Conciliar automaticamente
                                  </button>

                                  <button
                                    onClick={() => handleIgnore(item.fitId)}
                                    className="text-slate-400 hover:text-slate-600 text-[10px] font-extrabold uppercase tracking-wider px-2 py-2"
                                  >
                                    Ignorar
                                  </button>

                                  <button
                                    onClick={() => {
                                      setEditingTxId(item.fitId);
                                      setTempDesc(item.description);
                                      setTempDate(item.date);
                                      setTempAmount(item.amount);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all ml-auto"
                                    title="Editar transação antes de conciliar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* 4. Opções ao conciliar cada transação sem match automático */
                              <div className="flex flex-col gap-2 w-full md:w-80">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setEditingTxId(item.fitId);
                                      setTempDesc(item.description);
                                      setTempDate(item.date);
                                      setTempAmount(item.amount);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all"
                                    title="Editar transação antes de conciliar"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setShowSearchForFitId(prev => ({ ...prev, [item.fitId]: !prev[item.fitId] }));
                                      setActiveSearchFitId(item.fitId);
                                    }}
                                    className={`px-3 py-2 border rounded-xl font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                                      isSearchOpen 
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50/40'
                                    }`}
                                  >
                                    <Search className="w-3.5 h-3.5" /> Conciliar com existente
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActiveNewTx(item);
                                      setSelectedCatId(item.suggestedCategoryId || '');
                                    }}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[9px] uppercase px-3.5 py-2 tracking-wider transition-colors cursor-pointer"
                                  >
                                    Criar novo lançamento
                                  </button>

                                  <button
                                    onClick={() => handleIgnore(item.fitId)}
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                    title="Ignorar transação"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. Campo de busca manual por lançamento */}
                        {!duplicate && !match && isSearchOpen && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col relative animate-slideDown">
                            <div className="relative">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Buscar lançamento existente no sistema por descrição, valor ou data..."
                                value={query}
                                onChange={(e) => setSearchQueries(prev => ({ ...prev, [item.fitId]: e.target.value }))}
                                onFocus={() => setActiveSearchFitId(item.fitId)}
                                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-300 focus:bg-white rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                              />
                              {query && (
                                <button 
                                  onClick={() => setSearchQueries(prev => ({ ...prev, [item.fitId]: '' }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Resultados da busca em dropdown */}
                            {activeSearchFitId === item.fitId && query && (
                              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50 max-h-52 overflow-y-auto divide-y divide-slate-150 animate-fadeIn text-left">
                                {filterResults(query, item.type).length === 0 ? (
                                  <p className="p-4 text-xs font-semibold text-slate-400 text-center uppercase tracking-wider">
                                    Nenhum lançamento pendente/agendado correspondente nesta mesma conta bancária.
                                  </p>
                                ) : (
                                  filterResults(query, item.type).map(candidate => (
                                    <button
                                      key={candidate.id}
                                      onClick={() => {
                                        handleConciliationMatch(item, candidate);
                                        // limpa pesquisa
                                        setSearchQueries(prev => ({ ...prev, [item.fitId]: '' }));
                                        setShowSearchForFitId(prev => ({ ...prev, [item.fitId]: false }));
                                        setActiveSearchFitId(null);
                                      }}
                                      className="w-full text-left p-3.5 hover:bg-slate-50/80 flex items-center justify-between text-xs transition-colors cursor-pointer"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                          {candidate.description}
                                          {/* 7. Lançamentos recorrentes na busca com badge azul */}
                                          {candidate.recurrenceGroupId != null && (
                                            <span className="bg-blue-50 text-blue-650 hover:bg-blue-100 text-blue-600 font-extrabold text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0 border border-blue-100">
                                              RECORRENTE
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-450 font-semibold flex items-center gap-1.5">
                                          <span className="font-mono">{new Date(candidate.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                          <span className="text-slate-300">•</span>
                                          <span className="text-slate-500">{candidate.categoryName || 'Sem Categoria'}</span>
                                        </div>
                                      </div>
                                      <div className="font-mono font-black text-slate-900 shrink-0 select-none text-right">
                                        {formatCurrency(candidate.amount)}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
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
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fadeIn" onClick={() => setActiveNewTx(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 p-8 animate-fadeIn">
            <h3 className="text-md font-black text-slate-900 mb-2 uppercase tracking-tight flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-blue-500" /> Criar Lançamento Reconciliado
            </h3>
            <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-wider">Selecione se é um lançamento normal ou transferência interna</p>

            <div className="p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100 text-xs text-slate-600 space-y-1">
              <p><strong className="text-slate-700">Descrição Bancária:</strong> {activeNewTx.description}</p>
              <p><strong className="text-slate-700">Valor Bancário:</strong> <span className="font-mono font-black">{formatCurrency(activeNewTx.amount)}</span></p>
              <p><strong className="text-slate-700">Data Processamento:</strong> {new Date(activeNewTx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setReconcileType('NORMAL')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${reconcileType === 'NORMAL' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-slate-705'}`}
              >
                Lançamento
              </button>
              <button
                type="button"
                onClick={() => {
                  setReconcileType('TRANSFERENCIA');
                  const firstCounterpart = accounts.find(a => a.id !== selectedAccountId);
                  if (firstCounterpart) {
                    setRecTfCounterpartId(firstCounterpart.id);
                  }
                }}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${reconcileType === 'TRANSFERENCIA' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-705'}`}
              >
                Transferência
              </button>
            </div>

            <div className="space-y-4 font-sans">
              {reconcileType === 'NORMAL' ? (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Atribuir Categoria Financeira</label>
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold cursor-pointer transition-colors ${
                      isSuggestedSelected 
                        ? 'bg-blue-50/60 border-blue-200 text-blue-700 font-extrabold shadow-sm' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                    required
                  >
                    <option value="">Selecione a Categoria...</option>
                    {Object.keys(groupedCats).map((groupName) => {
                      const groupItems = groupedCats[groupName] || [];
                      return (
                        <optgroup key={groupName} label={groupName.toUpperCase()} className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                          {groupItems.map(c => (
                            <option key={c.id} value={c.id} className="text-slate-700 font-medium normal-case">
                              {c.name} {c.id === activeNewTx.suggestedCategoryId ? " (Sugerido)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>

                  {isSuggestedSelected && (
                    <div className="mt-2 flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-[9px] text-blue-600 font-extrabold uppercase tracking-wide animate-fadeIn format-auto-match-label">
                      <Check className="w-3.5 h-3.5 text-blue-550 shrink-0" />
                      <span>Sugerido automaticamente</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Conta Contrapartida</label>
                  <select
                    value={recTfCounterpartId}
                    onChange={(e) => setRecTfCounterpartId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                    required
                  >
                    <option value="">Selecione a Conta Contrapartida...</option>
                    {accounts.filter(a => a.id !== selectedAccountId).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  
                  <p className="mt-2 text-[9px] text-slate-400 leading-relaxed font-bold uppercase tracking-wide">
                    O sistema criará o lançamento de depósito e de saque correspondente de forma automatizada e com pre-reconciliação nos dois extratos.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={() => handleCreateAndConciliate(activeNewTx)}
                  disabled={reconcileType === 'NORMAL' ? !selectedCatId : !recTfCounterpartId}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                >
                  Confirmar e Registrar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNewTx(null)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all text-center cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
