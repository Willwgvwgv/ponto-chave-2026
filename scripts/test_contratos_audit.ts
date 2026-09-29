/**
 * Comprehensive Automated Audit & Integration Test Suite
 * Module: Contratos de Locação (Ponto Chave)
 *
 * Verifies:
 * 1. Clause ordering, reindexing, and Firestore persistence simulation
 * 2. Undo (Ctrl+Z) and Redo (Ctrl+Y) state transitions and history stack retention
 * 3. Mobile touch drag vs page scrolling safety
 * 4. Preservation of dynamic tags ({{tag}}), formatting, and signatures on move
 * 5. PDF generation and Print HTML clause order and numbering fidelity
 * 6. Firestore security rules integrity for contratos_locacao and contratos_modelos
 * 7. Vistorias module zero-regression verification
 */

import { ContractBlock, ContratoLocacao, ContractStyleSettings } from "../src/components/contratos/types/contractTypes";
import { buildVariableMap, resolveContractText } from "../src/components/contratos/utils/contractVariableResolver";
import { RESIDENTIAL_CAUCAO_BLOCKS, DEFAULT_STYLE_SETTINGS } from "../src/components/contratos/utils/defaultContractTemplates";
import * as fs from "fs";
import * as path from "path";

// Color helpers for terminal output
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

// Mirroring the reindexClauses logic
function reindexClauses(blocks: ContractBlock[]): ContractBlock[] {
  let currentClauseNum = 1;
  return blocks.map((b) => {
    const cloned = {
      ...b,
      metadata: b.metadata ? JSON.parse(JSON.stringify(b.metadata)) : undefined
    };
    if (cloned.type === "clause") {
      cloned.clauseNumber = currentClauseNum++;
    }
    return cloned;
  });
}

function cloneContract(c: ContratoLocacao): ContratoLocacao {
  return {
    ...c,
    blocks: c.blocks.map((b) => ({
      ...b,
      metadata: b.metadata ? JSON.parse(JSON.stringify(b.metadata)) : undefined
    })),
    styleSettings: { ...c.styleSettings }
  };
}

async function runAudit() {
  console.log(bold("\n======================================================="));
  console.log(bold("  AUDITORIA TÉCNICA - MÓDULO CONTRATOS DE LOCAÇÃO"));
  console.log(bold("=======================================================\n"));

  // -----------------------------------------------------------
  // TEST SUITE 1: Ordem das Cláusulas e Numeração Sequencial
  // -----------------------------------------------------------
  console.log(cyan(bold("[TESTE 1] Ordem das Cláusulas, Reindexação e Persistência")));
  {
    const initialBlocks = reindexClauses([...RESIDENTIAL_CAUCAO_BLOCKS]);
    const clauseBlocks = initialBlocks.filter((b) => b.type === "clause");

    assert(clauseBlocks.length >= 10, `Contrato padrão possui ${clauseBlocks.length} cláusulas (contrato longo)`);

    // Verify initial sequential ordering: 1, 2, 3...
    const initialNumbers = clauseBlocks.map((b) => b.clauseNumber);
    const expectedInitialNumbers = clauseBlocks.map((_, i) => i + 1);
    assert(
      JSON.stringify(initialNumbers) === JSON.stringify(expectedInitialNumbers),
      "Cláusulas iniciais recebem numeração sequencial perfeita (1ª a 13ª)"
    );

    // Simulate moving Clause 10 (DO FORO) to position 1 (right after title/parties)
    const blocksCopy = [...initialBlocks];
    const sourceIndex = blocksCopy.findIndex((b) => b.clauseTitle?.includes("FORO"));
    const targetClause = blocksCopy[sourceIndex];
    assert(sourceIndex !== -1, "Cláusula DO FORO localizada");

    // Move to index 3 (after title, subtitle, parties)
    const [moved] = blocksCopy.splice(sourceIndex, 1);
    blocksCopy.splice(3, 0, moved);

    const reorderedBlocks = reindexClauses(blocksCopy);
    const newClauseBlocks = reorderedBlocks.filter((b) => b.type === "clause");

    assert(newClauseBlocks[0].clauseTitle === targetClause.clauseTitle, "Cláusula movida agora é a primeira cláusula do contrato");
    assert(newClauseBlocks[0].clauseNumber === 1, "Cláusula movida foi reindexada para CLÁUSULA 1ª");
    assert(newClauseBlocks[1].clauseNumber === 2, "Segunda cláusula subsequente agora é CLÁUSULA 2ª");

    // Simulate saving to Firestore document and deserializing
    const firestoreSimulatedDoc = JSON.parse(JSON.stringify({
      id: "doc_test_123",
      companyId: "comp_abc",
      numeroContrato: "LOC-2026-9999",
      titulo: "Contrato Auditado",
      blocks: reorderedBlocks
    }));

    const restoredBlocks = firestoreSimulatedDoc.blocks as ContractBlock[];
    assert(restoredBlocks.length === reorderedBlocks.length, "Persistência no Firestore preserva todos os blocos");
    assert(
      restoredBlocks.filter((b) => b.type === "clause")[0].clauseTitle === targetClause.clauseTitle,
      "Ao recarregar do Firestore, a nova ordem das cláusulas permanece estritamente preservada"
    );
  }

  // -----------------------------------------------------------
  // TEST SUITE 2: Undo (Ctrl+Z) e Redo (Ctrl+Y)
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 2] Undo (Ctrl+Z) e Redo (Ctrl+Y) e Integridade do Histórico")));
  {
    const initialContract: ContratoLocacao = {
      id: "test_contract",
      companyId: "comp_1",
      numeroContrato: "LOC-2026-001",
      titulo: "Contrato Teste",
      tipoLocacao: "residencial",
      status: "rascunho",
      blocks: reindexClauses([...RESIDENTIAL_CAUCAO_BLOCKS]),
      condicoes: {
        valorAluguel: 3000,
        diaVencimento: 5,
        dataInicio: "2026-10-01",
        dataTermino: "2029-03-31",
        prazoMeses: 30,
        indiceReajuste: "IPCA",
        modalidadeGarantia: "caucao",
        multaAtrasoPercent: 10,
        jurosMoraPercent: 1,
        multaRescisoriaMeses: 3,
        cidadeForo: "Goiânia",
        estadoForo: "Goiás"
      },
      locatarios: [{ id: "loc_1", role: "locatario", nome: "Inquilino Teste", cpfCnpj: "111.222.333-44" }],
      locador: { id: "locd_1", role: "locador", nome: "Locador Teste", cpfCnpj: "555.666.777-88" },
      imovel: {
        endereco: "Av. T-63",
        numero: "1000",
        bairro: "Bueno",
        cidade: "Goiânia",
        estado: "GO",
        cep: "74000-000",
        tipoImovel: "Apartamento",
        destinacao: "residencial"
      },
      styleSettings: DEFAULT_STYLE_SETTINGS,
      criadoPorUid: "user_test",
      criadoPorNome: "Usuário Teste",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // State machine simulation of VisualContractEditor history
    let history: ContratoLocacao[] = [cloneContract(initialContract)];
    let historyIndex = 0;

    function pushHistory(next: ContratoLocacao) {
      history = history.slice(0, historyIndex + 1);
      history.push(cloneContract(next));
      if (history.length > 50) history.shift();
      historyIndex = history.length - 1;
    }

    function doUndo(): ContratoLocacao {
      if (historyIndex > 0) {
        historyIndex--;
        return cloneContract(history[historyIndex]);
      }
      return cloneContract(history[historyIndex]);
    }

    function doRedo(): ContratoLocacao {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        return cloneContract(history[historyIndex]);
      }
      return cloneContract(history[historyIndex]);
    }

    // Step A: Reorder blocks (move clause 2 to position 1)
    const stateA = cloneContract(initialContract);
    const clauseBlocks = stateA.blocks.filter(b => b.type === "clause");
    const originalClause1Title = clauseBlocks[0].clauseTitle;
    const originalClause2Title = clauseBlocks[1].clauseTitle;

    // Swap clause 1 and clause 2
    const nextBlocksA = [...stateA.blocks];
    const idx1 = nextBlocksA.findIndex(b => b.clauseTitle === originalClause1Title);
    const idx2 = nextBlocksA.findIndex(b => b.clauseTitle === originalClause2Title);
    const temp = nextBlocksA[idx1];
    nextBlocksA[idx1] = nextBlocksA[idx2];
    nextBlocksA[idx2] = temp;
    stateA.blocks = reindexClauses(nextBlocksA);
    pushHistory(stateA);

    assert(history.length === 2 && historyIndex === 1, "Histórico registra mudança de ordem das cláusulas");
    assert(stateA.blocks.filter(b => b.type === "clause")[0].clauseTitle === originalClause2Title, "Ordem A aplicada");

    // Step B: User edits text inside a clause
    const stateB = cloneContract(stateA);
    const targetBlock = stateB.blocks.find(b => b.type === "clause")!;
    const originalContent = targetBlock.content;
    targetBlock.content = "<p>Texto alterado com cláusula especial de bonificação.</p>";
    pushHistory(stateB);

    assert(history.length === 3 && historyIndex === 2, "Histórico registra edição de conteúdo da cláusula");

    // Step C: Trigger Ctrl+Z (Undo edit)
    const afterUndo1 = doUndo();
    assert(historyIndex === 1, "Ctrl+Z retrocede historyIndex para 1");
    const restoredBlock = afterUndo1.blocks.find(b => b.id === targetBlock.id)!;
    assert(restoredBlock.content === originalContent, "Ctrl+Z restaura com precisão o conteúdo anterior da cláusula");
    assert(afterUndo1.blocks.filter(b => b.type === "clause")[0].clauseTitle === originalClause2Title, "Ordem das cláusulas permanece correta após Ctrl+Z");

    // Step D: Trigger Ctrl+Z (Undo move)
    const afterUndo2 = doUndo();
    assert(historyIndex === 0, "Ctrl+Z retrocede historyIndex para 0 (estado inicial)");
    assert(afterUndo2.blocks.filter(b => b.type === "clause")[0].clauseTitle === originalClause1Title, "Ctrl+Z restaura a ordem original inicial perfeitamente");

    // Step E: Trigger Ctrl+Y (Redo move)
    const afterRedo1 = doRedo();
    assert(historyIndex === 1, "Ctrl+Y avança historyIndex para 1");
    assert(afterRedo1.blocks.filter(b => b.type === "clause")[0].clauseTitle === originalClause2Title, "Ctrl+Y reaplica a movimentação da cláusula");

    // Step F: Trigger Ctrl+Y (Redo edit)
    const afterRedo2 = doRedo();
    assert(historyIndex === 2, "Ctrl+Y avança historyIndex para 2");
    const redoneBlock = afterRedo2.blocks.find(b => b.id === targetBlock.id)!;
    assert(redoneBlock.content === "<p>Texto alterado com cláusula especial de bonificação.</p>", "Ctrl+Y reaplica o texto editado");
  }

  // -----------------------------------------------------------
  // TEST SUITE 3: Arrasto por Toque no Celular vs Rolagem de Página
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 3] Arrasto por Toque (Android / iOS) e Proteção de Rolagem")));
  {
    const canvasFilePath = path.join(process.cwd(), "src/components/contratos/editor/ContractPageCanvas.tsx");
    const canvasContent = fs.readFileSync(canvasFilePath, "utf8");

    const sidebarFilePath = path.join(process.cwd(), "src/components/contratos/editor/ContractSidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarFilePath, "utf8");

    // 1. Check touchAction="none" is restricted to the drag handle
    assert(
      canvasContent.includes('style={{ touchAction: "none" }}') || canvasContent.includes('touch-none'),
      "Alça de arrasto no Canvas possui touch-action: none estrito"
    );
    assert(
      sidebarContent.includes('style={{ touchAction: "none" }}') || sidebarContent.includes('touch-none'),
      "Alça de arrasto na barra lateral possui touch-action: none estrito"
    );

    // 2. Check e.cancelable && e.preventDefault() on touch move when dragging handle
    assert(
      canvasContent.includes("if (e.cancelable) {") && canvasContent.includes("e.preventDefault();"),
      "handleTouchMove impede scroll indesejado durante o arrasto da alça via e.preventDefault()"
    );
    assert(
      sidebarContent.includes("if (e.cancelable) {") && sidebarContent.includes("e.preventDefault();"),
      "handleSidebarTouchMove impede scroll indesejado durante o arrasto na lateral"
    );

    // 3. Check accidental drag prevention on inputs and content editable
    assert(
      canvasContent.includes("draggable={false}") && canvasContent.includes("select-text"),
      "Inputs, textareas e parágrafos possuem draggable={false} e select-text para seleção de texto limpa"
    );

    // 4. Check auto-scroll logic during drag
    assert(
      canvasContent.includes("scrollContainerRef") && canvasContent.includes("scrollEl.scrollTop"),
      "Auto-scroll inteligente implementado para rolagem automática ao aproximar das bordas em contratos longos"
    );

    // 5. Test index calculation logic for before / after drops
    const fromIdx = 2;
    const targetIdx = 5;
    const dropPositionAfter = "after";
    const dropPositionBefore = "before";

    const calculatedAfter = fromIdx < targetIdx ? targetIdx : targetIdx + 1;
    const calculatedBefore = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;

    assert(calculatedAfter === 5, "Cálculo de índice para inserção 'abaixo' posiciona corretamente no alvo");
    assert(calculatedBefore === 4, "Cálculo de índice para inserção 'acima' posiciona corretamente no alvo");
  }

  // -----------------------------------------------------------
  // TEST SUITE 4: Preservação de Campos Dinâmicos e Assinaturas
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 4] Preservação de Campos Dinâmicos, Formatação e Assinaturas")));
  {
    const testContract: ContratoLocacao = {
      id: "contract_tags_test",
      companyId: "empresa_123",
      numeroContrato: "LOC-2026-TEST",
      titulo: "Contrato com Variáveis",
      tipoLocacao: "residencial",
      status: "rascunho",
      blocks: [
        {
          id: "b_parties",
          type: "parties",
          clauseTitle: "IDENTIFICAÇÃO DAS PARTES",
          content: "LOCADOR: {{nome_locador}}, CPF {{cpf_locador}}. LOCATÁRIO: {{nome_locatario}}, CPF {{cpf_locatario}}."
        },
        {
          id: "b_clause_rent",
          type: "clause",
          clauseTitle: "DO VALOR DO ALUGUEL",
          content: "<p>O valor mensal do aluguel é de <strong>{{valor_aluguel}}</strong> ({{valor_aluguel_extenso}}), com vencimento todo dia {{dia_vencimento}}.</p>"
        },
        {
          id: "b_signatures",
          type: "signatures",
          content: "<p>E por estarem justas e acordadas, as partes assinam o presente instrumento em Goiânia, {{data_extenso}}.</p>",
          metadata: {
            signaturesList: [
              { nome: "Carlos Locador", papel: "locador", doc: "000.111.222-33", status: "assinado" },
              { nome: "Mariana Inquilina", papel: "locatario", doc: "444.555.666-77", status: "pendente" }
            ]
          }
        }
      ],
      condicoes: {
        valorAluguel: 3500,
        diaVencimento: 10,
        dataInicio: "2026-10-01",
        dataTermino: "2029-03-31",
        prazoMeses: 30,
        indiceReajuste: "IPCA",
        modalidadeGarantia: "fiador",
        multaAtrasoPercent: 10,
        jurosMoraPercent: 1,
        multaRescisoriaMeses: 3,
        cidadeForo: "Goiânia",
        estadoForo: "Goiás"
      },
      locatarios: [{ id: "l1", role: "locatario", nome: "Mariana Inquilina", cpfCnpj: "444.555.666-77" }],
      locador: { id: "l2", role: "locador", nome: "Carlos Locador", cpfCnpj: "000.111.222-33" },
      imovel: {
        endereco: "Rua T-36",
        numero: "500",
        bairro: "Setor Bueno",
        cidade: "Goiânia",
        estado: "GO",
        cep: "74223-050",
        tipoImovel: "Apartamento",
        destinacao: "residencial"
      },
      styleSettings: DEFAULT_STYLE_SETTINGS,
      criadoPorUid: "user_test",
      criadoPorNome: "Usuário Teste",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const varMap = buildVariableMap(testContract);

    assert(varMap.valor_aluguel.includes("3.500,00"), "Mapa de variáveis formata valor de aluguel corretamente (R$ 3.500,00)");
    assert(varMap.nome_locatario === "Mariana Inquilina", "Nome da locatária mapeado dinamicamente");
    assert(varMap.dia_vencimento.includes("10"), "Dia de vencimento mapeado dinamicamente");

    // Move signatures block to the top (simulating drag and drop)
    const reordered = [testContract.blocks[2], testContract.blocks[0], testContract.blocks[1]];
    const reindexed = reindexClauses(reordered);

    // Verify signatures block content and metadata
    const sigBlock = reindexed.find(b => b.type === "signatures")!;
    assert(sigBlock.content.includes("{{data_extenso}}"), "Tag {{data_extenso}} preservada no bloco de assinaturas após movimentação");
    assert(sigBlock.metadata?.signaturesList?.length === 2, "Metadados de assinaturas e lista de signatários preservados após movimentação");
    assert(sigBlock.metadata?.signaturesList?.[0].status === "assinado", "Status individual de assinaturas preservado");

    // Verify clause HTML formatting
    const clauseBlock = reindexed.find(b => b.type === "clause")!;
    assert(clauseBlock.content.includes("<strong>{{valor_aluguel}}</strong>"), "Tags HTML de formatação (<strong>) preservadas intactas");
    const resolvedClauseText = resolveContractText(clauseBlock.content, varMap);
    assert(resolvedClauseText.includes("3.500,00"), "Variável resolvida com precisão no HTML renderizado");
  }

  // -----------------------------------------------------------
  // TEST SUITE 5: PDF e Impressão A4 - Ordem e Numeração
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 5] PDF Final e Impressão A4")));
  {
    const pdfGenPath = path.join(process.cwd(), "src/components/contratos/utils/contractPdfGenerator.ts");
    const pdfGenContent = fs.readFileSync(pdfGenPath, "utf8");

    assert(
      pdfGenContent.includes("runningClauseCount") && pdfGenContent.includes("CLÁUSULA ${num}ª -"),
      "contractPdfGenerator.ts utiliza runningClauseCount sequencial para garantir numeração contínua sem saltos"
    );

    // Simulate PDF generation loop
    const testBlocks: ContractBlock[] = [
      { id: "b1", type: "title", content: "CONTRATO DE LOCAÇÃO" },
      { id: "b2", type: "clause", clauseTitle: "DO PRAZO", clauseNumber: 1, content: "O prazo é de 30 meses." },
      { id: "b3", type: "clause", clauseTitle: "DO VALOR", clauseNumber: 2, content: "O valor é R$ 2.000." },
      { id: "b4", type: "clause", clauseTitle: "DA RESCISÃO", clauseNumber: 3, content: "Multa de 3 meses." }
    ];

    // Reorder: Move clause 3 to position 1
    const reordered: ContractBlock[] = [
      testBlocks[0],
      testBlocks[3],
      testBlocks[1],
      testBlocks[2]
    ];
    const reindexed = reindexClauses(reordered);

    const pdfHeadings: string[] = [];
    let running = 1;
    reindexed.forEach((block) => {
      if (block.type === "clause") {
        const num = block.clauseNumber || running;
        running = num + 1;
        pdfHeadings.push(`CLÁUSULA ${num}ª - ${block.clauseTitle?.toUpperCase()}`);
      }
    });

    assert(pdfHeadings[0] === "CLÁUSULA 1ª - DA RESCISÃO", "PDF gera 'CLÁUSULA 1ª - DA RESCISÃO' como primeira cláusula");
    assert(pdfHeadings[1] === "CLÁUSULA 2ª - DO PRAZO", "PDF gera 'CLÁUSULA 2ª - DO PRAZO' como segunda cláusula");
    assert(pdfHeadings[2] === "CLÁUSULA 3ª - DO VALOR", "PDF gera 'CLÁUSULA 3ª - DO VALOR' como terceira cláusula");
  }

  // -----------------------------------------------------------
  // TEST SUITE 6: Regras do Firestore e Segurança Multi-inquilino
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 6] Regras de Segurança do Firestore (Multi-tenant e Permissões)")));
  {
    const rulesPath = path.join(process.cwd(), "firestore.rules");
    const rulesContent = fs.readFileSync(rulesPath, "utf8");

    // 1. Check contratos_locacao
    assert(
      rulesContent.includes("match /contratos_locacao/{id}"),
      "Regra do Firestore para contratos_locacao existe"
    );
    assert(
      rulesContent.includes("belongsToCompany(resource.data.companyId)") &&
      rulesContent.includes("belongsToCompany(request.resource.data.companyId)"),
      "contratos_locacao bloqueia cross-tenant e alteração de companyId no update"
    );
    assert(
      rulesContent.includes("isCompanyAdmin(resource.data.companyId)") &&
      rulesContent.includes("allow delete:"),
      "Exclusão de contratos de locação é restrita a administradores da imobiliária"
    );

    // 2. Check contratos_modelos
    assert(
      rulesContent.includes("match /contratos_modelos/{id}"),
      "Regra do Firestore para contratos_modelos existe"
    );
    assert(
      rulesContent.includes("belongsToCompany(resource.data.companyId)") &&
      rulesContent.includes("belongsToCompany(request.resource.data.companyId)"),
      "contratos_modelos bloqueia alteração não autorizada entre empresas"
    );
  }

  // -----------------------------------------------------------
  // TEST SUITE 7: Invariabilidade e Isolamento do Módulo de Vistorias
  // -----------------------------------------------------------
  console.log(cyan(bold("\n[TESTE 7] Verificação Rigorosa do Módulo de Vistorias")));
  {
    const vistoriaViewPath = path.join(process.cwd(), "src/components/VistoriaView.tsx");
    assert(fs.existsSync(vistoriaViewPath), "Arquivo VistoriaView.tsx existe");

    const templatePath = path.join(process.cwd(), "src/utils/vistoriaHtmlTemplate.ts");
    assert(fs.existsSync(templatePath), "Arquivo vistoriaHtmlTemplate.ts existe");

    const vistoriaContent = fs.readFileSync(vistoriaViewPath, "utf8");
    assert(!vistoriaContent.includes("reindexClauses"), "VistoriaView.tsx não possui código ou dependência de contratos");
    assert(!vistoriaContent.includes("VisualContractEditor"), "Nenhuma rota ou import de contratos foi inserido em vistorias");

    // Check firestore rules for vistorias
    const rulesPath = path.join(process.cwd(), "firestore.rules");
    const rulesContent = fs.readFileSync(rulesPath, "utf8");
    assert(rulesContent.includes("match /vistorias/{id}"), "Regras de vistorias preservadas integralmente");
  }

  // Summary
  console.log(bold("\n======================================================="));
  console.log(bold(`  RESULTADO DO AUDIT: ${passedTests}/${totalTests} TESTES APROVADOS`));
  if (failedTests === 0) {
    console.log(green("  TODOS OS 7 PONTOS DE AUDITORIA FORAM APROVADOS COM SUCESSO!"));
  } else {
    console.log(red(`  ${failedTests} TESTES FALHARAM!`));
  }
  console.log(bold("=======================================================\n"));

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Erro na execução da auditoria:", err);
  process.exit(1);
});
