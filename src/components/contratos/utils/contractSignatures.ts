import { ContractBlock, ContratoLocacao } from "../types/contractTypes";

export interface LinhaAssinatura {
  nome: string;
  papel: string;
  doc: string;
}

export interface ConfigAssinaturas {
  linhas: LinhaAssinatura[];
  testemunhas: number;
}

const rotuloDoc = (valor?: string) => ((valor || "").replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF");

/** Assinantes padrão, já com os dados do contrato preenchidos. */
export function assinaturasPadrao(contract: ContratoLocacao, variableMap: Record<string, string>): ConfigAssinaturas {
  const linhas: LinhaAssinatura[] = [
    {
      nome: variableMap.nome_locador || "LOCADOR",
      papel: "LOCADOR(A)",
      doc: `${rotuloDoc(variableMap.cpf_locador)}: ${variableMap.cpf_locador || ""}`
    },
    {
      nome: variableMap.nome_locatario || "LOCATÁRIO",
      papel: "LOCATÁRIO(A)",
      doc: `${rotuloDoc(variableMap.cpf_locatario)}: ${variableMap.cpf_locatario || ""}`
    }
  ];
  if (contract.condicoes?.modalidadeGarantia === "fiador") {
    linhas.push({
      nome: variableMap.nome_fiador || "FIADOR SOLIDÁRIO",
      papel: "FIADOR(A) E PRINCIPAL PAGADOR(A)",
      doc: `CPF: ${variableMap.cpf_fiador || ""}`
    });
  }
  return { linhas, testemunhas: 2 };
}

/** Assinantes do bloco: os editados pelo usuário ou, se não houver, os padrão. */
export function assinaturasDoBloco(
  block: ContractBlock,
  contract: ContratoLocacao,
  variableMap: Record<string, string>
): ConfigAssinaturas {
  const salvo = block.metadata?.assinaturas;
  if (salvo && Array.isArray(salvo.linhas)) {
    // Modelos podem trazer variáveis nos assinantes (ex.: {{nome_locatario}}).
    const resolver = (t: string) => String(t || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => variableMap[k] ?? m);
    return {
      linhas: salvo.linhas.map((l: LinhaAssinatura) => ({ nome: resolver(l.nome), papel: resolver(l.papel), doc: resolver(l.doc) })),
      testemunhas: typeof salvo.testemunhas === "number" ? salvo.testemunhas : 2
    };
  }
  return assinaturasPadrao(contract, variableMap);
}
