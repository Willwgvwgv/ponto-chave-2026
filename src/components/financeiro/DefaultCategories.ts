import { FinancialCategory } from "../../types";

export const DEFAULT_FINANCIAL_CATEGORIES: Omit<FinancialCategory, "id" | "companyId" | "createdAt">[] = [
  // RECEITAS
  {
    name: "Comissão de Venda",
    type: "RECEITA",
    group: "Operacional",
    color: "#16a34a",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Comissão de Locação",
    type: "RECEITA",
    group: "Operacional",
    color: "#15803d",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Taxa de Administração",
    type: "RECEITA",
    group: "Operacional",
    color: "#166534",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Honorários de Consultoria",
    type: "RECEITA",
    group: "Operacional",
    color: "#14532d",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Outras Receitas",
    type: "RECEITA",
    group: "Diversas",
    color: "#4ade80",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Pessoal
  {
    name: "Salários e Encargos",
    type: "DESPESA",
    group: "Pessoal",
    color: "#dc2626",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Pró-labore Sócios",
    type: "DESPESA",
    group: "Pessoal",
    color: "#b91c1c",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Comissões a Corretores Externos",
    type: "DESPESA",
    group: "Pessoal",
    color: "#991b1b",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Vale Transporte e Alimentação",
    type: "DESPESA",
    group: "Pessoal",
    color: "#7f1d1d",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Estrutura
  {
    name: "Aluguel do Escritório",
    type: "DESPESA",
    group: "Estrutura",
    color: "#ea580c",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Condomínio e IPTU",
    type: "DESPESA",
    group: "Estrutura",
    color: "#c2410c",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Energia Elétrica",
    type: "DESPESA",
    group: "Estrutura",
    color: "#9a3412",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Telefone e Internet",
    type: "DESPESA",
    group: "Estrutura",
    color: "#7c2d12",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Água e Saneamento",
    type: "DESPESA",
    group: "Estrutura",
    color: "#fed7aa",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Marketing
  {
    name: "Anúncios Facebook e Instagram",
    type: "DESPESA",
    group: "Marketing",
    color: "#7c3aed",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Portais Imobiliários",
    type: "DESPESA",
    group: "Marketing",
    color: "#6d28d9",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Material Gráfico e Impressão",
    type: "DESPESA",
    group: "Marketing",
    color: "#5b21b6",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Eventos e Plantões",
    type: "DESPESA",
    group: "Marketing",
    color: "#4c1d95",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Fotografia e Vídeo",
    type: "DESPESA",
    group: "Marketing",
    color: "#ede9fe",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Tecnologia
  {
    name: "Imobia",
    type: "DESPESA",
    group: "Tecnologia",
    color: "#0284c7",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Canva Pro",
    type: "DESPESA",
    group: "Tecnologia",
    color: "#0369a1",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Orulo",
    type: "DESPESA",
    group: "Tecnologia",
    color: "#075985",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "CRM e Ferramentas",
    type: "DESPESA",
    group: "Tecnologia",
    color: "#0c4a6e",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Outras Assinaturas",
    type: "DESPESA",
    group: "Tecnologia",
    color: "#bae6fd",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Impostos
  {
    name: "DAS Simples Nacional",
    type: "DESPESA",
    group: "Impostos",
    color: "#b45309",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "ISS sobre Serviços",
    type: "DESPESA",
    group: "Impostos",
    color: "#92400e",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "IRPJ e CSLL",
    type: "DESPESA",
    group: "Impostos",
    color: "#78350f",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Taxas Bancárias",
    type: "DESPESA",
    group: "Impostos",
    color: "#451a03",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Cartório e Taxas",
    type: "DESPESA",
    group: "Impostos",
    color: "#fbbf24",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Deslocamento
  {
    name: "Combustível",
    type: "DESPESA",
    group: "Deslocamento",
    color: "#0f766e",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Manutenção de Veículos",
    type: "DESPESA",
    group: "Deslocamento",
    color: "#115e59",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Estacionamento e Pedágio",
    type: "DESPESA",
    group: "Deslocamento",
    color: "#134e4a",
    icon: "Tag",
    isDefault: true
  },

  // DESPESAS - Diversas
  {
    name: "Material de Escritório",
    type: "DESPESA",
    group: "Diversas",
    color: "#475569",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Limpeza e Conservação",
    type: "DESPESA",
    group: "Diversas",
    color: "#334155",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Despesas Jurídicas",
    type: "DESPESA",
    group: "Diversas",
    color: "#1e293b",
    icon: "Tag",
    isDefault: true
  },
  {
    name: "Outras Despesas",
    type: "DESPESA",
    group: "Diversas",
    color: "#94a3b8",
    icon: "Tag",
    isDefault: true
  }
];
