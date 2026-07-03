export interface KanbanColumn {
  id: string;
  label: string;
  color: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  subtitle: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  creci?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  defaultTextoContrato?: string;
  defaultTextoLaudo?: string;
  kanbanColumns?: KanbanColumn[];
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: "admin" | "user" | "none" | "corretor" | "captador" | "colaborador";
  permissions?: string[];
  companyId?: string;
  status?: "active" | "blocked" | "pending";
  isPending?: boolean;
  isPreAuthorized?: boolean;
  createdAt?: any;
  gcalLastSync?: string;
  isSocio?: boolean;        // true = pode ter múltiplos papéis na divisão de comissões
  cargoComissao?: 'CORRETOR' | 'CAPTADOR' | 'GESTOR' | 'SOCIO' | null; // cargo específico para comissões
  cpf?: string;             // CPF para PDF fiscal e RPA
  permRateioLocacao?: boolean; // permite inclusão no rateio de comissões de locação
  permRateioVendas?: boolean;  // permite inclusão no rateio de comissões de vendas
  permComissoes?: boolean;
  perm_comissoes?: boolean;
  permFinanceiro?: boolean;
  perm_financeiro?: boolean;
  permVistorias?: boolean;
  perm_vistorias?: boolean;
  permProcessos?: boolean;
  perm_processos?: boolean;
  permPonto?: boolean;        // true para "colaborador" por padrão
  perm_ponto?: boolean;
  jornadaDiariaMinutos?: number; // padrão 480 (8h)
}

export interface PontoRegistro {
  id: string;
  userId: string;
  userName: string;
  agencyId: string;
  date: string;        // "YYYY-MM-DD"
  entrada?: string;     // "HH:mm"
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saida?: string;
  horasTrabalhadas?: number;  // em minutos, calculado
  horasExtras?: number;       // em minutos, positivo ou negativo (banco de horas)
  status: "incompleto" | "completo" | "ajuste_pendente";
  createdAt: string;
}

export interface SolicitacaoAjustePonto {
  id: string;
  registroId: string;
  userId: string;
  userName: string;
  data: string;
  campo: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida";
  valorAtual?: string;
  valorSolicitado: string;
  motivo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  createdAt: string;
  respondidoEm?: string;
  respondidoPor?: string;
}

export type Priority = "low" | "medium" | "high";
export type RecurrenceType = "none" | "daily" | "weekdays" | "weekly" | "custom";

export interface Task {
  id: string;
  uid: string;
  companyId?: string;
  parentId?: string; // For recurring instances
  title: string;
  description?: string;
  completed: boolean;
  actionLabel: string;
  priority: Priority;
  category?: string;
  date: string; // ISO string (YYYY-MM-DD)
  time?: string; // HH:mm
  recurrence: RecurrenceType;
  recurrenceDays?: number[]; // 0-6 for weekly/custom
  isRecurringInstance?: boolean;
  proofUrl?: string;
  proofName?: string;
  attachments?: { name: string, url: string }[];
  authorId?: string;
}

export interface DailyReport {
  date: string;
  completed: number;
  total: number;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon?: string;
  companyId?: string;
  notes?: string;
}

export interface ProcessInstance {
  id: string;
  uid: string;
  companyId?: string;
  title: string;
  type: string; // Changed from union to string for flexibility
  status: "active" | "completed" | "archived";
  kanbanStatus?: string;
  kanbanHistory?: { 
    from?: string; 
    to: string; 
    timestamp: any; 
    userId: string; 
    userName: string 
  }[];
  completedSteps: string[];
  stepHistory?: { label: string; completedAt: any }[];
  stepProofs?: Record<string, string>;
  stepAttachments?: Record<string, { name: string, url: string }[]>;
  notes?: string;
  assignedTo?: string;
  dueDate?: string; // ISO YYYY-MM-DD
  tenantName?: string;
  propertyAddress?: string;
  rentAmount?: number;
  isCommissionLaunched?: boolean;
  commissionRefId?: string;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
}

export interface ProcessStep {
  label: string;
  desc: string;
}

export interface ProcessTemplate {
  id: string;
  type: string;
  title: string;
  icon: string;
  color: string;
  steps: ProcessStep[];
  updatedAt: any;
}

export interface ItemVistoria {
  nome: string;
  ok: boolean;
  ressalva?: string;
}

export interface ComodoVistoria {
  nome: string;
  itens: ItemVistoria[];
  fotos: string[];
}

export interface RateioComissao {
  corretorId: string;
  corretorNome: string;
  papel: "captador" | "locacao" | "auxiliar";
  valor: number;
  porcentagem?: number;
  totalPago?: number;
  status?: "pendente" | "pago";
}

export interface PagamentoCorretor {
  id: string;                                                    // gerado no cliente (Date.now() + random)
  corretorId: string;                                            // ID do corretor que recebeu
  corretorNome: string;                                          // snapshot do nome no momento do pagamento
  tipo: 'pagamento' | 'adiantamento' | 'desconto_adiantamento';
  valor: number;                                                 // sempre positivo, em reais
  data: string;                                                  // ISO YYYY-MM-DD
  observacao?: string;                                           // opcional, texto livre
  registradoPorUid: string;                                      // UID do user que registrou
  registradoPorNome: string;                                     // nome do user que registrou
  registradoEm: number;                                          // timestamp em ms (Date.now())
}

export interface Comissao {
  id: string;
  companyId: string;
  imovel: string;
  inquilino: string;
  aluguelMensal: number;
  primeiroAluguel: number;
  porcentagemFidelite: number; // Ex: 70
  valorFidelite: number;
  valorRepasseCorretores: number;
  vencimento: string; // ISO YYYY-MM-DD
  mesReferencia: string; // YYYY-MM
  status: "pendente" | "pago" | "atraso";
  jaPagoCorretores?: boolean;
  rateio: RateioComissao[];
  observacoes?: string;
  criadoPor: string;
  criadoPorNome: string;
  createdAt: any;
  updatedAt: any;
  pagamentosCorretores?: PagamentoCorretor[];
  statusFinanceiro?: string;
  dataRecebimento?: string;
  contaBancariaRecebimento?: string;
}

export interface Vistoria {
  id: string;
  companyId: string;
  companyLogo?: string | null;
  companyName?: string;
  companySubtitle?: string;
  textoContrato?: string;
  textoLaudo?: string;
  styleContrato?: {
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    isBold?: boolean;
  };
  styleLaudo?: {
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    isBold?: boolean;
  };
  corretorId: string;
  corretorNome: string;
  locatario: {
    nome: string;
    cpf: string;
    rg: string;
    nacionalidade: string;
    dataNascimento: string;
    naturalidade: string;
    endereco: string;
    cep: string;
    email: string;
    telefone: string;
  };
  imovel: {
    endereco: string;
  };
  locador: {
    nome: string;
    cnpj: string;
    endereco: string;
  };
  comodos: ComodoVistoria[];
  status: "rascunho" | "concluido" | "Agendada" | "Em Andamento" | "Aguardando Laudo" | "Concluída" | "Cancelada";
  data: string;
  companyCity?: string;
  companyState?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Sale {
  id: string;
  agency_id: string;
  sale_date: string;          // ISO date "2024-01-15"
  property_address: string;
  sale_value: number;         // valor total da venda em R$
  commission_percentage: number; // ex: 6 (representa 6%)
  total_commission: number;   // sale_value * commission_percentage / 100
  client_name: string;
  status: 'ACTIVE' | 'CANCELLED' | 'DRAFT';
  data_vencimento_nf?: string; // Data de vencimento da NF
  created_at: string;
  buyer_doc_type?: 'CPF' | 'CNPJ';
  buyer_doc?: string;
  seller_name?: string;
  seller_doc_type?: 'CPF' | 'CNPJ';
  seller_doc?: string;
  splits?: BrokerSplit[];     // join em memória
  is_installment?: boolean;
  entrada_value?: number;
  installment_count?: number;
  installment_value?: number;
  first_installment_date?: string;
}

export interface BrokerSplit {
  id: string;
  sale_id: string;
  agency_id: string;
  broker_id: string;
  broker_name: string;        // desnormalizado para performance
  role: 'CAPTADOR' | 'VENDEDOR' | 'GESTOR';
  percentage: number;         // ex: 60 (representa 60% da comissão)
  calculated_value: number;   // valor em R$ que o corretor recebe
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'overdue' | 'pending';
  forecast_date: string;      // previsão de pagamento
  payment_date?: string | null;      // data real do pagamento
  payment_method?: 'PIX' | 'TED' | 'CHEQUE' | null;
  receipt_data?: string | null;      // base64 ou URL do comprovante
  notes?: string | null;
  discount_value?: number | null;    // desconto aplicado
  installment_number?: number | null; // número da parcela (split parcial)
  entrada_value?: number;            // valor da entrada proporcional ao percentual do corretor
  installment_count?: number;        // número de parcelas
  installment_value?: number;        // valor de cada parcela
  first_installment_date?: string;   // data da primeira parcela
  created_at: string;
  installments_status?: any[];       // status e rastreio de cada parcela
  entry_paid?: boolean;              // sinalizador se a entrada foi paga
  entry_paid_value?: number;         // valor pago na entrada
  entry_payment_date?: string;       // data real do pagamento da entrada
  entry_payment_method?: 'PIX' | 'TED' | 'CHEQUE' | 'DINHEIRO'; // meio do pagamento da entrada
  entry_notes?: string;              // observações da entrada
  paid?: boolean;                    // Pagamento total ou parcial realizado
  partial_payment?: number;          // Valor pago parcialmente
  remaining?: number;                // Saldo restante após pagamento parcial
}

export interface ComissoneUser {
  id: string;
  agency_id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BROKER' | 'MANAGER';
  cpf?: string;
  phone?: string;
  created_at: string;
  permComissoes?: boolean;
  perm_comissoes?: boolean;
  permissions?: string[];
  isSocio?: boolean;
  cargoComissao?: 'CORRETOR' | 'CAPTADOR' | 'GESTOR' | 'SOCIO' | null;
  permRateioLocacao?: boolean;
  permRateioVendas?: boolean;
  uid?: string;
  jornadaDiariaMinutos?: number;
  status?: string;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;               // subdomínio ex: "william"
  logo_url?: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  companyId: string;
  name: string;           // Ex: 'Sicoob PJ Principal'
  bank: 'SICOOB' | 'CRESOL' | 'INTER' | 'BRADESCO' | 'ITAU' | 'BANCO_DO_BRASIL' | 'NUBANK' | 'OUTRO';
  agency: string;
  account: string;
  balance: number;        // saldo atual (ou limite disponível)
  color?: string;         // cor opcional do card do banco
  lastSync?: string;      // data da última importação
  createdAt: any;
  accountType?: 'CORRENTE' | 'CREDITO';
  cardBrand?: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD';
  totalLimit?: number;
  closingDay?: number;
  dueDay?: number;
}

export interface FinancialCategory {
  id: string;
  companyId: string;
  name: string;
  type: 'RECEITA' | 'DESPESA';
  group: string;          // agrupamento: 'Pessoal', 'Marketing', etc
  color: string;          // cor hex para gráficos
  icon: string;           // nome do ícone lucide
  isDefault: boolean;     // categorias padrão não podem ser excluídas
  createdAt: any;

  // Novos campos do DRE gerencial imobiliário
  nome: string;
  grupo: 'locacao' | 'caixa';
  natureza: 'entrada' | 'saida';
  comportamento: 'fixo' | 'variavel' | 'nao_aplicavel';
  origem: 'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros';
  agencyId?: string;
}

export interface FinancialTransaction {
  id: string;
  companyId: string;
  accountId: string;
  date: string;                    // YYYY-MM-DD
  description: string;             // descrição original do extrato
  amount: number;                  // positivo = entrada, negativo = saída
  type: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA';
  categoryId?: string;
  categoryName?: string;
  status: 'PENDENTE' | 'CONCILIADO' | 'IGNORADO' | 'AGENDADO' | 'CANCELADO';
  origin: 'MANUAL' | 'IMPORTADO' | 'AUTOMATICO' | 'AUTO';
  commissionRef?: string;          // ID da venda ou slip se for comissão
  notes?: string;
  createdAt: any;
  reconciledAt?: string;
  autoCategorized?: boolean;
  recurrenceGroupId?: string;
  fitId?: string;
  originalDescription?: string;
  creditCardStatus?: 'FATURA_ABERTA' | 'FATURA_FECHADA' | 'FATURA_PAGA';
  creditCardMonth?: string; // YYYY-MM
  isTransfer?: boolean;
  transferAccountId?: string;
  transferGroupId?: string;
}

export interface DREEntry {
  categoryId: string;
  categoryName: string;
  group: string;
  planned: number;
  realized: number;
  variance: number;       // realized - planned
  variancePercent: number;
}

export interface CashFlowEntry {
  date: string;
  inflow: number;         // entradas previstas
  outflow: number;        // saídas previstas
  balance: number;        // saldo acumulado
  transactions: FinancialTransaction[];
}

export interface IndenizacaoCredPago {
  id: string;
  data: string;
  valor: number;
}

export interface Despejo {
  id: string;
  companyId: string; // ou agencyId
  status: "NOTIFICADO" | "PRAZO_VENCIDO" | "AJUIZADO" | "LIMINAR_CONCEDIDA" | "DESPEJO_REALIZADO";
  
  // Locador
  locadorNome: string;
  locadorNacionalidade: string;
  locadorEstadoCivil: string;
  locadorRG: string;
  locadorCPF: string;
  locadorEmail: string;
  locadorEndereco: string;

  // Imóvel
  imovelEndereco: string;
  imovelComarca: string;
  imovelEstado: string;

  // Inquilino
  inquilinoNome: string;
  inquilinoNacionalidade: string;
  inquilinoEstadoCivil: string;
  inquilinoRG: string;
  inquilinoCPF: string;
  inquilinoEmail: string;
  inquilinoEndereco: string;

  // Contrato
  contratoDataInicio: string;
  contratoDataTermino: string;
  contratoValorMensal: number;
  contratoDiaVencimento: number;
  contratoIndiceReajuste: string;
  contratoEncargos: string;
  contratoInadimplenciaTotal: number;

  // Garantia
  credPagoContratoNum: string;
  credPagoIndenizacoes: IndenizacaoCredPago[];
  credPagoDataExoneracao: string;
  credPagoDataNotificacao: string;
  credPagoDataLimite: string; // auto-calculated

  // Trâmite Jurídico
  advogadoNome: string;
  advogadoOAB: string;
  processoNumero?: string;
  portalTJLink?: string;
  caucionado: boolean; // sim/não
  caucaoValor: number; // 3x aluguel calculado
  
  // Anexos
  anexoContratoUrl?: string;
  anexoExoneracaoUrl?: string;
  anexoNotificacaoUrl?: string;
  anexoInicialUrl?: string;

  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
}


