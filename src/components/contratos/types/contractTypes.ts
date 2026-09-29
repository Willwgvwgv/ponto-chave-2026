export type ContractStatus = 
  | "rascunho" 
  | "aguardando_assinatura" 
  | "assinado" 
  | "ativo" 
  | "finalizado" 
  | "cancelado";

export type GuaranteeType = 
  | "caucao" 
  | "fiador" 
  | "seguro_fianca" 
  | "titulo_capitalizacao" 
  | "credpago" 
  | "sem_garantia";

export type ContractBlockType = 
  | "header" 
  | "title" 
  | "subtitle" 
  | "clause" 
  | "paragraph" 
  | "parties" 
  | "table" 
  | "divider" 
  | "callout" 
  | "signatures" 
  | "page_break";

export interface ContractParty {
  id: string;
  role: "locador" | "locatario" | "fiador" | "conjuge" | "testemunha";
  nome: string;
  cpfCnpj: string;
  rg?: string;
  nacionalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  conjugeNome?: string;
  conjugeCpf?: string;
  conjugeRg?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
}

export interface ContractProperty {
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  tipoImovel: string; // "Apartamento", "Casa", "Sala Comercial", etc.
  destinacao: "residencial" | "comercial" | "mista" | "temporada";
  matricula?: string;
  cartorio?: string;
  iptuInscricao?: string;
  hidrometroMedidor?: string;
  energiaMedidor?: string;
  vagasGaragem?: string;
}

export interface ContractCommercialTerms {
  valorAluguel: number;
  valorAluguelExtenso?: string;
  diaVencimento: number;
  dataInicio: string; // YYYY-MM-DD
  dataTermino: string; // YYYY-MM-DD
  prazoMeses: number;
  indiceReajuste: "IPCA" | "IGP-M" | "INPC" | "FIPE-ZAP" | "FIXO";
  modalidadeGarantia: GuaranteeType;
  valorGarantia?: number;
  detalhesGarantia?: string;
  multaAtrasoPercent: number; // ex: 10%
  jurosMoraPercent: number; // ex: 1% ao mês
  multaRescisoriaMeses: number; // ex: 3 meses proporcional
  carenciaMeses?: number;
  descontoPontualidade?: number;
  taxaCondominioEstimada?: number;
  iptuMensal?: number;
  seguroIncendioAnual?: number;
  cidadeForo: string;
  estadoForo: string;
}

export interface ContractBlock {
  id: string;
  type: ContractBlockType;
  clauseNumber?: number; // Para ordenação e numeração automática ("CLÁUSULA 1ª")
  clauseTitle?: string; // Título da cláusula ex: "DO OBJETO E DA FINALIDADE"
  sectionCategory?: string; // Categoria da seção (ex: "Objeto", "Aluguel", "Garantia")
  content: string; // Conteúdo HTML ou texto formatado com tags {{variavel}}
  isCustomized?: boolean; // Se o usuário modificou manualmente
  isLocked?: boolean; // Se não pode ser deletado acidentalmente
  pageBreakBefore?: boolean;
  metadata?: {
    tableData?: { headers: string[]; rows: string[][] };
    calloutType?: "info" | "warning" | "highlight";
    signaturesList?: {
      nome: string;
      papel: string;
      doc: string;
      email?: string;
      status?: "pendente" | "assinado";
      assinadoEm?: string;
    }[];
  };
}

export interface ContractStyleSettings {
  fontFamily: "Inter" | "Roboto" | "Merriweather" | "Lora" | "Times New Roman" | "Playfair Display";
  fontSizePt: number; // 10, 11, 12, 14
  lineSpacing: number; // 1.0, 1.15, 1.35, 1.5, 2.0
  paragraphSpacingPx: number; // 8, 12, 16, 20
  marginType: "padrao" | "estreita" | "ampla"; // 25mm, 15mm, 30mm
  primaryColor: string; // Cor dos títulos das cláusulas e divisores
  accentColor: string;
  showWatermark: boolean;
  watermarkText: string; // "MINUTA", "RASCUNHO", "CONFIDENCIAL", "FINALIZADO"
  showHeader: boolean;
  showFooter: boolean;
  headerLogoUrl?: string;
  showPageNumbers: boolean;
  showSignatureLines: boolean;
  clauseNumberingStyle: "ordinal" | "cardinal" | "romano" | "extenso"; // "1ª" vs "1" vs "I" vs "PRIMEIRA"
}

export interface ContractVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
  description: string;
  blocksSnapshot: ContractBlock[];
  styleSettingsSnapshot: ContractStyleSettings;
}

export interface ContratoLocacao {
  id: string;
  companyId: string;
  numeroContrato: string; // ex: "LOC-2026-0042"
  titulo: string; // ex: "Contrato de Locação Residencial - Apto 302 Ed. Bela Vista"
  tipoLocacao: "residencial" | "comercial" | "temporada" | "mista";
  status: ContractStatus;
  modeloOrigemId?: string;
  modeloOrigemNome?: string;
  
  // Partes e Dados
  locador: ContractParty;
  locatarios: ContractParty[];
  fiadores?: ContractParty[];
  imovel: ContractProperty;
  condicoes: ContractCommercialTerms;
  testemunhas?: { nome: string; cpf: string; rg?: string }[];
  
  // Documento estruturado
  blocks: ContractBlock[];
  styleSettings: ContractStyleSettings;
  
  // Histórico e Versões
  versoes?: ContractVersion[];
  
  // Metadados
  criadoPorUid: string;
  criadoPorNome: string;
  atualizadoPorUid?: string;
  atualizadoPorNome?: string;
  createdAt: any;
  updatedAt: any;
  finalizadoEm?: string;
  assinadoEm?: string;
  
  // Link para assinatura digital
  assinaturaDigitalUrl?: string;
  envelopeAssinaturaId?: string;
}

export interface ContratoModelo {
  id: string;
  companyId: string;
  nome: string; // ex: "Padrão Residencial com Caução"
  descricao: string;
  tipoLocacao: "residencial" | "comercial" | "temporada" | "mista";
  isPadrao: boolean;
  blocks: ContractBlock[];
  styleSettings: ContractStyleSettings;
  categoria: string;
  criadoPorUid: string;
  criadoPorNome: string;
  createdAt: any;
  updatedAt: any;
}

export interface DynamicVariableDefinition {
  key: string;
  label: string;
  category: "imovel" | "locador" | "locatario" | "fiador" | "comercial" | "prazos" | "imobiliaria" | "datas";
  description: string;
  exampleValue: string;
}
