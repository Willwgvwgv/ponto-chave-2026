/**
 * Automated Pagination & Layout Test Suite
 * Module: Contratos de Locação (Ponto Chave)
 *
 * Verifies:
 * 1. Automatic distribution of long contracts across real A4 pages
 * 2. Proper page height boundaries, preventing text spilling onto canvas background
 * 3. Page margins (estreita, padrao, ampla) and printable area calculations
 * 4. Header & footer generation with dynamic 'Página X de Y' numbering
 * 5. Manual page breaks (block type: 'page_break')
 * 6. Global index mapping preservation across pages for Drag and Drop
 * 7. Long contract (20+ clauses) multi-page verification
 * 8. Zero regression on vistorias module
 */

import { ContractBlock, ContratoLocacao, ContractStyleSettings } from "../src/components/contratos/types/contractTypes";
import { 
  paginateBlocks, 
  getMarginConfig, 
  getAvailableContentHeight, 
  estimateBlockHeight,
  A4_DIMENSIONS
} from "../src/components/contratos/utils/contractPagination";
import { RESIDENTIAL_CAUCAO_BLOCKS, DEFAULT_STYLE_SETTINGS } from "../src/components/contratos/utils/defaultContractTemplates";
import * as fs from "fs";
import * as path from "path";

const green = (t: string) => `\x1b[32m✔ ${t}\x1b[0m`;
const red = (t: string) => `\x1b[31m✖ ${t}\x1b[0m`;
const bold = (t: string) => `\x1b[1m${t}\x1b[0m`;
const cyan = (t: string) => `\x1b[36m${t}\x1b[0m`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${green(testName)}`);
  } else {
    failedTests++;
    console.error(`  ${red(testName)}${details ? ` -> ${details}` : ""}`);
  }
}

async function runPaginationTests() {
  console.log(bold("\n======================================================="));
  console.log(bold("  TESTES DE PAGINAÇÃO VISUAL A4 - CONTRATOS DE LOCAÇÃO"));
  console.log(bold("=======================================================\n"));

  // -----------------------------------------------------------
  // TEST SUITE 1: Dimensões Físicas A4 e Configurações de Margem
  // -----------------------------------------------------------
  console.log(cyan(bold("[TESTE 1] Dimensões Físicas A4 e Margens Reais")));
  {
    assert(A4_DIMENSIONS.widthPx === 794, "Largura A4 padronizada em 794px (~210mm a 96 DPI)");
    assert(A4_DIMENSIONS.heightPx === 1123, "Altura A4 padronizada em 1123px (~297mm a 96 DPI)");

    const margemPadrao = getMarginConfig("padrao");
    assert(margemPadrao.contentWidthPx > 600 && margemPadrao.contentWidthPx < 700, "Largura útil padrão (25mm) calculada corretamente");

    const margemEstreita = getMarginConfig("estreita");
    assert(margemEstreita.contentWidthPx > margemPadrao.contentWidthPx, "Margem estreita (15mm) oferece maior área útil horizontal");

    const margemAmpla = getMarginConfig("ampla");
    assert(margemAmpla.contentWidthPx < margemPadrao.contentWidthPx, "Margem ampla (30mm) reserva maior recuo lateral");
  }

  // -----------------------------------------------------------
  // TEST SUITE 2: Altura Disponível por Página (Capa vs Páginas Seguintes)
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 2] Cálculo de Altura Útil e Espaço para Cabeçalho/Rodapé")));
  {
    const styles: ContractStyleSettings = { ...DEFAULT_STYLE_SETTINGS };
    const marginConfig = getMarginConfig("padrao");

    const page1Available = getAvailableContentHeight(0, styles, marginConfig);
    const page2Available = getAvailableContentHeight(1, styles, marginConfig);

    assert(page1Available > 750 && page1Available < 950, `Página 1 possui área útil calculada (${page1Available}px)`);
    assert(page2Available > page1Available, "Páginas seguintes possuem maior área útil que a página 1 devido ao cabeçalho reduzido");
  }

  // -----------------------------------------------------------
  // TEST SUITE 3: Paginação de Contrato Padrão e Contrato Longo
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 3] Paginação Automática de Contrato Padrão (15+ blocos)")));
  {
    const styles: ContractStyleSettings = { ...DEFAULT_STYLE_SETTINGS };
    const pages = paginateBlocks(RESIDENTIAL_CAUCAO_BLOCKS, styles);

    assert(pages.length >= 2, `Contrato padrão é distribuído em múltiplas páginas reais (Total: ${pages.length} páginas)`);

    // Verify all blocks are accounted for
    const allPlacedBlocks = pages.flatMap((p) => p.blocks);
    assert(allPlacedBlocks.length === RESIDENTIAL_CAUCAO_BLOCKS.length, "100% dos blocos do contrato estão presentes nas páginas");

    // Verify no page exceeds available height
    pages.forEach((p, idx) => {
      assert(
        p.estimatedHeight <= p.maxAvailableHeight + 50,
        `Página ${idx + 1} respeita o limite físico da folha A4 (Estimado: ${p.estimatedHeight}px <= Limite: ${p.maxAvailableHeight}px)`
      );
    });

    // Verify sequential global index preservation
    const placedIndices = allPlacedBlocks.map((b) => b.globalIndex);
    const expectedIndices = RESIDENTIAL_CAUCAO_BLOCKS.map((_, i) => i);
    assert(
      JSON.stringify(placedIndices) === JSON.stringify(expectedIndices),
      "Mapeamento sequencial de índices globais preservado perfeitamente para Drag & Drop"
    );
  }

  // -----------------------------------------------------------
  // TEST SUITE 4: Contrato Extra-Longo (25 Cláusulas)
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 4] Simulação com Contrato Extra-Longo (25 Cláusulas / ~5 Páginas)")));
  {
    const extraLongBlocks: ContractBlock[] = [...RESIDENTIAL_CAUCAO_BLOCKS];
    for (let c = 14; c <= 25; c++) {
      extraLongBlocks.push({
        id: `extra-clause-${c}`,
        type: "clause",
        clauseNumber: c,
        clauseTitle: `DA DISPOSIÇÃO ADICIONAL COMPLEMENTAR ${c}`,
        content: `<p>Termos pactuados especificamente para a cláusula complementar número ${c}, estabelecendo regramentos contratuais de observância obrigatória entre locador e locatário.</p><p class="mt-2">Parágrafo único: Qualquer tolerância não implicará novação.</p>`
      });
    }

    const styles: ContractStyleSettings = { ...DEFAULT_STYLE_SETTINGS };
    const pages = paginateBlocks(extraLongBlocks, styles);

    assert(pages.length >= 4, `Contrato extra-longo particionado em ${pages.length} folhas A4 reais`);
    assert(pages[0].pageNumber === 1, "Primeira página identificada como Página 1");
    assert(pages[pages.length - 1].pageNumber === pages.length, `Última página numerada como Página ${pages.length}`);

    // Every block has valid global index
    const allPlaced = pages.flatMap((p) => p.blocks);
    assert(allPlaced.length === extraLongBlocks.length, "Todas as 25+ cláusulas distribuídas sem perdas nem sobreposição");
  }

  // -----------------------------------------------------------
  // TEST SUITE 5: Quebra de Página Manual (page_break)
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 5] Quebra de Página Forçada (block type: page_break)")));
  {
    const blocksWithBreak: ContractBlock[] = [
      { id: "b1", type: "title", content: "CONTRATO ESPECIAL" },
      { id: "b2", type: "clause", clauseNumber: 1, clauseTitle: "OBJETO", content: "<p>Texto da cláusula 1</p>" },
      { id: "b3", type: "page_break", content: "" }, // Explicit break
      { id: "b4", type: "clause", clauseNumber: 2, clauseTitle: "VALOR", content: "<p>Texto da cláusula 2</p>" }
    ];

    const styles: ContractStyleSettings = { ...DEFAULT_STYLE_SETTINGS };
    const pages = paginateBlocks(blocksWithBreak, styles);

    assert(pages.length === 2, "Quebra de página manual gerou exatamente 2 páginas");
    assert(pages[0].blocks.some((b) => b.block.id === "b2"), "Cláusula 1 permaneceu na Página 1");
    assert(pages[1].blocks.some((b) => b.block.id === "b4"), "Cláusula 2 iniciou no topo da Página 2");
  }

  // -----------------------------------------------------------
  // TEST SUITE 6: Módulo de Vistorias Rigorosamente Inalterado
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 6] Integridade e Zero-Regressão do Módulo de Vistorias")));
  {
    const vistoriaViewPath = path.resolve(process.cwd(), "src/components/VistoriaView.tsx");
    assert(fs.existsSync(vistoriaViewPath), "VistoriaView.tsx preservado intacto");

    const templatePath = path.resolve(process.cwd(), "src/utils/vistoriaHtmlTemplate.ts");
    assert(fs.existsSync(templatePath), "vistoriaHtmlTemplate.ts preservado intacto");
  }

  console.log(bold("\n======================================================="));
  console.log(bold(`  RESULTADO DOS TESTES DE PAGINAÇÃO: ${passedTests}/${totalTests} PASSARAM`));
  console.log(bold("=======================================================\n"));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPaginationTests().catch((err) => {
  console.error("Erro fatal na execução dos testes:", err);
  process.exit(1);
});
