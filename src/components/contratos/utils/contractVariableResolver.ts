import { ContratoLocacao, DynamicVariableDefinition } from "../types/contractTypes";
import { CompanySettings } from "../../../types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DYNAMIC_VARIABLES_CATALOG: DynamicVariableDefinition[] = [
  // 1. Dados do Imóvel
  { key: "endereco_imovel", label: "Endereço Completo do Imóvel", category: "imovel", description: "Rua, número, complemento, bairro, cidade e UF", exampleValue: "Av. T-63, nº 1200, Apto 504, Ed. Horizonte, Setor Bueno, Goiânia - GO" },
  { key: "rua_imovel", label: "Logradouro do Imóvel", category: "imovel", description: "Nome da rua/avenida e número", exampleValue: "Av. T-63, nº 1200" },
  { key: "complemento_imovel", label: "Complemento", category: "imovel", description: "Apartamento, bloco, sala", exampleValue: "Apto 504, Bloco B" },
  { key: "bairro_imovel", label: "Bairro do Imóvel", category: "imovel", description: "Bairro onde está localizado", exampleValue: "Setor Bueno" },
  { key: "cidade_imovel", label: "Cidade do Imóvel", category: "imovel", description: "Município do imóvel", exampleValue: "Goiânia" },
  { key: "estado_imovel", label: "Estado do Imóvel (UF)", category: "imovel", description: "Sigla do Estado", exampleValue: "GO" },
  { key: "cep_imovel", label: "CEP do Imóvel", category: "imovel", description: "Código de Endereçamento Postal", exampleValue: "74230-100" },
  { key: "tipo_imovel", label: "Tipo do Imóvel", category: "imovel", description: "Apartamento, Casa, Sala, etc.", exampleValue: "Apartamento Residencial" },
  { key: "destinacao_imovel", label: "Destinação do Imóvel", category: "imovel", description: "Residencial ou Comercial", exampleValue: "estritamente residencial" },
  { key: "matricula_imovel", label: "Matrícula do Imóvel", category: "imovel", description: "Número de matrícula no CRI", exampleValue: "124.589" },
  { key: "cartorio_imovel", label: "Cartório de Registro", category: "imovel", description: "Cartório de Registro de Imóveis", exampleValue: "1ª Circunscrição de Goiânia" },
  { key: "vagas_garagem", label: "Vagas de Garagem", category: "imovel", description: "Identificação das vagas", exampleValue: "02 vagas cobertas (nº 34 e 35)" },

  // 2. Dados do Locador
  { key: "nome_locador", label: "Nome do Locador", category: "locador", description: "Nome completo do proprietário ou locador", exampleValue: "Carlos Alberto Meireles" },
  { key: "cpf_locador", label: "CPF/CNPJ do Locador", category: "locador", description: "Cadastro fiscal do locador", exampleValue: "123.456.789-00" },
  { key: "rg_locador", label: "RG do Locador", category: "locador", description: "Registro Geral do locador", exampleValue: "3456789 DGPC/GO" },
  { key: "nacionalidade_locador", label: "Nacionalidade do Locador", category: "locador", description: "Nacionalidade", exampleValue: "brasileiro" },
  { key: "estado_civil_locador", label: "Estado Civil do Locador", category: "locador", description: "Casado, solteiro, divorciado", exampleValue: "casado sob o regime de comunhão parcial" },
  { key: "profissao_locador", label: "Profissão do Locador", category: "locador", description: "Profissão declarada", exampleValue: "Engenheiro Civil" },
  { key: "endereco_locador", label: "Endereço do Locador", category: "locador", description: "Domicílio residencial do locador", exampleValue: "Rua 15, nº 420, Setor Marista, Goiânia - GO" },
  { key: "email_locador", label: "E-mail do Locador", category: "locador", description: "Endereço eletrônico para notificações", exampleValue: "carlos.meireles@email.com" },
  { key: "telefone_locador", label: "Telefone do Locador", category: "locador", description: "Telefone ou WhatsApp de contato", exampleValue: "(62) 99881-2233" },
  { key: "pix_locador", label: "Chave PIX do Locador", category: "locador", description: "Para depósito do aluguel ou repasse", exampleValue: "carlos.meireles@email.com" },

  // 3. Dados do Locatário
  { key: "nome_locatario", label: "Nome do Locatário Principal", category: "locatario", description: "Nome do inquilino", exampleValue: "Juliana Mendes da Silva" },
  { key: "cpf_locatario", label: "CPF/CNPJ do Locatário", category: "locatario", description: "Documento de identificação fiscal", exampleValue: "987.654.321-11" },
  { key: "rg_locatario", label: "RG do Locatário", category: "locatario", description: "Registro Geral do inquilino", exampleValue: "5678912 SSP/GO" },
  { key: "nacionalidade_locatario", label: "Nacionalidade do Locatário", category: "locatario", description: "Nacionalidade", exampleValue: "brasileira" },
  { key: "estado_civil_locatario", label: "Estado Civil do Locatário", category: "locatario", description: "Estado civil", exampleValue: "solteira" },
  { key: "profissao_locatario", label: "Profissão do Locatário", category: "locatario", description: "Profissão", exampleValue: "Advogada" },
  { key: "endereco_locatario", label: "Endereço Anterior do Locatário", category: "locatario", description: "Endereço de domicílio anterior", exampleValue: "Rua T-30, nº 880, Setor Bueno, Goiânia - GO" },
  { key: "email_locatario", label: "E-mail do Locatário", category: "locatario", description: "E-mail oficial para notificações", exampleValue: "juliana.mendes@adv.com" },
  { key: "telefone_locatario", label: "Telefone do Locatário", category: "locatario", description: "Contato telefônico do locatário", exampleValue: "(62) 98111-4455" },
  { key: "qualificacao_completa_locatario", label: "Qualificação Completa do Locatário", category: "locatario", description: "Parágrafo jurídico unificado com todos os dados", exampleValue: "Juliana Mendes da Silva, brasileira, solteira, advogada, portadora do RG nº 5678912 SSP/GO e inscrita no CPF sob o nº 987.654.321-11" },

  // 4. Dados dos Fiadores
  { key: "nome_fiador", label: "Nome do Fiador", category: "fiador", description: "Nome completo do fiador (se houver)", exampleValue: "Roberto Alves Fonseca" },
  { key: "cpf_fiador", label: "CPF do Fiador", category: "fiador", description: "Documento fiscal do fiador", exampleValue: "444.555.666-77" },
  { key: "rg_fiador", label: "RG do Fiador", category: "fiador", description: "Registro Geral do fiador", exampleValue: "2345678 DGPC/GO" },
  { key: "estado_civil_fiador", label: "Estado Civil do Fiador", category: "fiador", description: "Estado civil do fiador", exampleValue: "casado" },
  { key: "profissao_fiador", label: "Profissão do Fiador", category: "fiador", description: "Profissão do fiador", exampleValue: "Empresário" },
  { key: "endereco_fiador", label: "Endereço do Fiador", category: "fiador", description: "Residência do fiador", exampleValue: "Alameda das Rosas, nº 500, Setor Oeste, Goiânia - GO" },
  { key: "conjuge_fiador", label: "Cônjuge do Fiador", category: "fiador", description: "Nome e documento do cônjuge anuente", exampleValue: "Mariana Duarte Fonseca, inscrita no CPF nº 333.222.111-00" },

  // 5. Condições Comerciais & Valores
  { key: "valor_aluguel", label: "Valor do Aluguel (R$)", category: "comercial", description: "Valor mensal formatado em reais", exampleValue: "R$ 2.800,00" },
  { key: "valor_aluguel_extenso", label: "Valor do Aluguel por Extenso", category: "comercial", description: "Valor monetário escrito por extenso", exampleValue: "dois mil e oitocentos reais" },
  { key: "dia_vencimento", label: "Dia do Vencimento", category: "comercial", description: "Dia do mês para pagamento", exampleValue: "10 (dez)" },
  { key: "indice_reajuste", label: "Índice de Reajuste Anual", category: "comercial", description: "IPCA, IGP-M, etc.", exampleValue: "IPCA (Índice Nacional de Preços ao Consumidor Amplo - IBGE)" },
  { key: "modalidade_garantia", label: "Modalidade da Garantia", category: "comercial", description: "Caução, Fiador, Seguro-Fiança, CredPago", exampleValue: "Caução em dinheiro equivalente a 03 (três) meses de aluguel" },
  { key: "valor_garantia", label: "Valor da Garantia (R$)", category: "comercial", description: "Valor monetário da garantia", exampleValue: "R$ 8.400,00 (oito mil e quatrocentos reais)" },
  { key: "multa_atraso", label: "Percentual de Multa por Atraso", category: "comercial", description: "Percentual de multa moratória", exampleValue: "10% (dez por cento)" },
  { key: "juros_mora", label: "Juros de Mora Mensal", category: "comercial", description: "Juros moratórios", exampleValue: "1% (um por cento) ao mês" },
  { key: "multa_rescisoria", label: "Multa Rescisória", category: "comercial", description: "Meses de aluguel devidos proporcionalmente", exampleValue: "03 (três) meses de aluguel vigentes à época da rescisão" },
  { key: "cidade_foro", label: "Comarca e Foro", category: "comercial", description: "Comarca eleita para dirimir conflitos", exampleValue: "Comarca de Goiânia, Estado de Goiás" },

  // 6. Datas e Prazos
  { key: "prazo_meses", label: "Prazo Contratual em Meses", category: "prazos", description: "Duração do contrato", exampleValue: "30 (trinta) meses" },
  { key: "data_inicio", label: "Data de Início da Locação", category: "prazos", description: "Data de entrega das chaves e posse", exampleValue: "01/10/2026" },
  { key: "data_fim", label: "Data de Término da Locação", category: "prazos", description: "Data de encerramento do contrato", exampleValue: "31/03/2029" },
  { key: "data_atual_extenso", label: "Data Atual por Extenso", category: "datas", description: "Cidade e data atual formatada", exampleValue: "Goiânia, 28 de setembro de 2026" },
  { key: "numero_contrato", label: "Número do Contrato", category: "prazos", description: "Código de identificação do contrato", exampleValue: "LOC-2026-0042" },

  // 7. Dados da Imobiliária
  { key: "nome_imobiliaria", label: "Nome da Imobiliária", category: "imobiliaria", description: "Razão social ou nome fantasia", exampleValue: "Fidelité Imobiliária & Gestão" },
  { key: "cnpj_imobiliaria", label: "CNPJ da Imobiliária", category: "imobiliaria", description: "Cadastro fiscal da administradora", exampleValue: "12.345.678/0001-90" },
  { key: "creci_imobiliaria", label: "CRECI da Imobiliária", category: "imobiliaria", description: "Registro no Conselho de Corretores", exampleValue: "CRECI-GO CJ-12345" },
  { key: "endereco_imobiliaria", label: "Endereço da Imobiliária", category: "imobiliaria", description: "Endereço da sede da administradora", exampleValue: "Av. 136, nº 797, Setor Marista, Goiânia - GO" },
  { key: "telefone_imobiliaria", label: "Telefone da Imobiliária", category: "imobiliaria", description: "Telefone de contato", exampleValue: "(62) 3222-0000" },
  { key: "email_imobiliaria", label: "E-mail da Imobiliária", category: "imobiliaria", description: "E-mail de atendimento", exampleValue: "contato@fidelite.com.br" }
];

// Helper to format currency
export function formatCurrencyBRL(value: number | undefined): string {
  if (value === undefined || isNaN(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Convert numbers to Portuguese words (extenso)
export function numberToExtenso(val: number): string {
  if (!val || val === 0) return "zero reais";
  const inteiros = Math.floor(val);
  const centavos = Math.round((val - inteiros) * 100);

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function getMil(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    let res = "";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res += centenas[c];
    if (d === 1) {
      if (res) res += " e ";
      res += especiais[u];
    } else {
      if (d > 1) {
        if (res) res += " e ";
        res += dezenas[d];
      }
      if (u > 0) {
        if (res) res += " e ";
        res += unidades[u];
      }
    }
    return res;
  }

  let extenso = "";
  const milhares = Math.floor(inteiros / 1000);
  const resto = inteiros % 1000;

  if (milhares > 0) {
    if (milhares === 1) {
      extenso += "mil";
    } else {
      extenso += `${getMil(milhares)} mil`;
    }
    if (resto > 0) {
      if (resto < 100 || resto % 100 === 0) {
        extenso += " e ";
      } else {
        extenso += ", ";
      }
    }
  }

  if (resto > 0 || inteiros === 0) {
    if (inteiros === 0 && milhares === 0) {
      // centavos only
    } else {
      extenso += getMil(resto);
    }
  }

  if (inteiros === 1) {
    extenso += " real";
  } else if (inteiros > 1) {
    extenso += " reais";
  }

  if (centavos > 0) {
    if (inteiros > 0) extenso += " e ";
    extenso += `${getMil(centavos)} centavo${centavos > 1 ? "s" : ""}`;
  }

  return extenso;
}

// Convert month numbers to words
export function mesesToExtenso(m: number): string {
  const map: Record<number, string> = {
    1: "01 (um) mês",
    2: "02 (dois) meses",
    3: "03 (três) meses",
    6: "06 (seis) meses",
    12: "12 (doze) meses",
    24: "24 (vinte e quatro) meses",
    30: "30 (trinta) meses",
    36: "36 (trinta e seis) meses",
    48: "48 (quarenta e oito) meses"
  };
  return map[m] || `${m} meses`;
}

// Format safe date DD/MM/YYYY
export function formatBrDate(dateStr?: string): string {
  if (!dateStr) return "___/___/______";
  try {
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

/**
 * Resolves a dictionary of all active dynamic variables for a specific contract.
 */
export function buildVariableMap(
  contract: ContratoLocacao,
  companySettings?: CompanySettings | null
): Record<string, string> {
  const im = contract.imovel || ({} as any);
  const loc = contract.locador || ({} as any);
  const inquilino = contract.locatarios?.[0] || ({} as any);
  const fiador = contract.fiadores?.[0] || ({} as any);
  const cond = contract.condicoes || ({} as any);
  const now = new Date();

  const formattedCurrentDate = `${cond.cidadeForo || im.cidade || "Goiânia"}, ${format(now, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;

  const enderecoCompleto = [
    im.endereco,
    im.numero ? `nº ${im.numero}` : null,
    im.complemento,
    im.bairro ? `Bairro ${im.bairro}` : null,
    im.cidade ? `${im.cidade} - ${im.estado || "GO"}` : null,
    im.cep ? `CEP: ${im.cep}` : null
  ].filter(Boolean).join(", ");

  const qualificacaoLocador = [
    loc.nome,
    loc.nacionalidade || "brasileiro(a)",
    loc.estadoCivil || "casado(a)",
    loc.profissao,
    loc.rg ? `portador(a) do RG nº ${loc.rg}` : null,
    loc.cpfCnpj ? `inscrito(a) no CPF/CNPJ sob o nº ${loc.cpfCnpj}` : null,
    loc.endereco ? `residente e domiciliado(a) à ${loc.endereco}` : null
  ].filter(Boolean).join(", ");

  const qualificacaoLocatario = [
    inquilino.nome,
    inquilino.nacionalidade || "brasileiro(a)",
    inquilino.estadoCivil || "solteiro(a)",
    inquilino.profissao,
    inquilino.rg ? `portador(a) do RG nº ${inquilino.rg}` : null,
    inquilino.cpfCnpj ? `inscrito(a) no CPF sob o nº ${inquilino.cpfCnpj}` : null,
    inquilino.endereco ? `residente e domiciliado(a) à ${inquilino.endereco}` : null
  ].filter(Boolean).join(", ");

  const modalidadeGarantiaTexto = (() => {
    switch (cond.modalidadeGarantia) {
      case "caucao":
        return `Caução em dinheiro no valor de ${formatCurrencyBRL(cond.valorGarantia || cond.valorAluguel * 3)} (${numberToExtenso(cond.valorGarantia || cond.valorAluguel * 3)}), correspondente a 03 (três) aluguéis, depositada em conta poupança vinculada, nos termos do art. 38, §2º da Lei 8.245/91.`;
      case "fiador":
        return `Fiança prestada por ${fiador.nome || "FIADOR(A)"}, portador(a) do CPF nº ${fiador.cpfCnpj || "___"}, que assume solidariamente todas as obrigações deste contrato até a efetiva entrega das chaves.`;
      case "seguro_fianca":
        return `Seguro de Fiança Locatícia contratado através de seguradora idônea, com apólice vigente durante todo o período da locação e renovação obrigatória.`;
      case "credpago":
        return `Garantia Locatícia digital operada pela CredPago / QuintoAndar Serviços, com adesão formalizada sob o contrato digital correspondente.`;
      case "titulo_capitalizacao":
        return `Título de Capitalização caucionado no valor de ${formatCurrencyBRL(cond.valorGarantia)}, subscrito junto a instituição autorizada pela SUSEP.`;
      default:
        return "Locação sem modalidade de garantia, sujeita ao rito sumário de desocupação do art. 59, §1º, IX da Lei nº 8.245/91.";
    }
  })();

  const map: Record<string, string> = {
    // Imóvel
    endereco_imovel: enderecoCompleto || "{{endereco_imovel}}",
    rua_imovel: `${im.endereco || ""}${im.numero ? `, nº ${im.numero}` : ""}`.trim() || "{{rua_imovel}}",
    complemento_imovel: im.complemento || "Sem complemento",
    bairro_imovel: im.bairro || "{{bairro_imovel}}",
    cidade_imovel: im.cidade || "Goiânia",
    estado_imovel: im.estado || "GO",
    cep_imovel: im.cep || "{{cep_imovel}}",
    tipo_imovel: im.tipoImovel || "Imóvel Urbano",
    destinacao_imovel: im.destinacao === "comercial" ? "estritamente comercial e não residencial" : "estritamente residencial familiar",
    matricula_imovel: im.matricula || "conforme certidão de registro",
    cartorio_imovel: im.cartorio || "competente Cartório de Registro de Imóveis",
    vagas_garagem: im.vagasGaragem || "Sem vaga de garagem privativa",

    // Locador
    nome_locador: loc.nome || "{{nome_locador}}",
    cpf_locador: loc.cpfCnpj || "{{cpf_locador}}",
    rg_locador: loc.rg || "{{rg_locador}}",
    nacionalidade_locador: loc.nacionalidade || "brasileiro(a)",
    estado_civil_locador: loc.estadoCivil || "casado(a)",
    profissao_locador: loc.profissao || "proprietário(a)",
    endereco_locador: loc.endereco || "{{endereco_locador}}",
    email_locador: loc.email || "{{email_locador}}",
    telefone_locador: loc.telefone || "{{telefone_locador}}",
    pix_locador: loc.pix || loc.cpfCnpj || "{{pix_locador}}",
    qualificacao_completa_locador: qualificacaoLocador || "{{qualificacao_completa_locador}}",

    // Locatário
    nome_locatario: inquilino.nome || "{{nome_locatario}}",
    cpf_locatario: inquilino.cpfCnpj || "{{cpf_locatario}}",
    rg_locatario: inquilino.rg || "{{rg_locatario}}",
    nacionalidade_locatario: inquilino.nacionalidade || "brasileiro(a)",
    estado_civil_locatario: inquilino.estadoCivil || "solteiro(a)",
    profissao_locatario: inquilino.profissao || "inquilino(a)",
    endereco_locatario: inquilino.endereco || "{{endereco_locatario}}",
    email_locatario: inquilino.email || "{{email_locatario}}",
    telefone_locatario: inquilino.telefone || "{{telefone_locatario}}",
    qualificacao_completa_locatario: qualificacaoLocatario || "{{qualificacao_completa_locatario}}",

    // Fiador
    nome_fiador: fiador.nome || "Não aplicável",
    cpf_fiador: fiador.cpfCnpj || "Não aplicável",
    rg_fiador: fiador.rg || "Não aplicável",
    estado_civil_fiador: fiador.estadoCivil || "Não aplicável",
    profissao_fiador: fiador.profissao || "Não aplicável",
    endereco_fiador: fiador.endereco || "Não aplicável",
    conjuge_fiador: fiador.conjugeNome ? `${fiador.conjugeNome}, CPF: ${fiador.conjugeCpf || "___"}` : "Sem cônjuge anuente",

    // Comercial & Valores
    valor_aluguel: formatCurrencyBRL(cond.valorAluguel),
    valor_aluguel_extenso: numberToExtenso(cond.valorAluguel),
    dia_vencimento: `${cond.diaVencimento || 10} (${numberToExtenso(cond.diaVencimento || 10).replace(/ rea(l|is)$/, "")})`,
    indice_reajuste: cond.indiceReajuste ? `${cond.indiceReajuste}` : "IPCA/IBGE",
    modalidade_garantia: modalidadeGarantiaTexto,
    valor_garantia: formatCurrencyBRL(cond.valorGarantia || 0),
    multa_atraso: `${cond.multaAtrasoPercent || 10}% (${numberToExtenso(cond.multaAtrasoPercent || 10).replace(/ rea(l|is)$/, "")} por cento)`,
    juros_mora: `${cond.jurosMoraPercent || 1}% (${numberToExtenso(cond.jurosMoraPercent || 1).replace(/ rea(l|is)$/, "")} por cento) ao mês`,
    multa_rescisoria: `${cond.multaRescisoriaMeses || 3} (${numberToExtenso(cond.multaRescisoriaMeses || 3).replace(/ rea(l|is)$/, "")}) meses de aluguel`,
    cidade_foro: `Comarca de ${cond.cidadeForo || "Goiânia"}, Estado de ${cond.estadoForo || "Goiás"}`,

    // Prazos e Datas
    prazo_meses: mesesToExtenso(cond.prazoMeses || 30),
    data_inicio: formatBrDate(cond.dataInicio),
    data_fim: formatBrDate(cond.dataTermino),
    data_atual_extenso: formattedCurrentDate,
    data_extenso: formattedCurrentDate,
    numero_contrato: contract.numeroContrato || "LOC-2026",

    // Imobiliária
    nome_imobiliaria: companySettings?.name || "Fidelité Imobiliária",
    cnpj_imobiliaria: companySettings?.cnpj || "00.000.000/0001-00",
    creci_imobiliaria: companySettings?.creci || "CRECI-GO",
    endereco_imobiliaria: companySettings?.address || "Goiânia - GO",
    telefone_imobiliaria: companySettings?.phone || "(62) 0000-0000",
    email_imobiliaria: companySettings?.email || "contato@imobiliaria.com.br"
  };

  return map;
}

/**
 * Replaces all tokens `{{tag}}` in a text string with resolved values.
 */
export function resolveContractText(
  text: string,
  variableMap: Record<string, string>,
  options?: { highlightVariables?: boolean }
): string {
  if (!text) return "";

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = variableMap[key];
    if (val !== undefined) {
      if (options?.highlightVariables) {
        return `<mark class="bg-amber-100 text-amber-900 px-1 py-0.5 rounded border border-amber-300 font-medium" data-var="${key}">${val}</mark>`;
      }
      return val;
    }
    // If not found in map, preserve or show warning tag
    return match;
  });
}

/**
 * Scans text for any unbound or placeholder variables like {{nome_locador}}
 */
export function findUnboundVariables(text: string, variableMap: Record<string, string>): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  if (!matches) return [];
  
  const unbound: string[] = [];
  matches.forEach(m => {
    const key = m.replace(/[\{\}\s]/g, "");
    const val = variableMap[key];
    if (!val || val.startsWith("{{") || val === "Não informado" || val === "___") {
      if (!unbound.includes(key)) {
        unbound.push(key);
      }
    }
  });
  return unbound;
}
