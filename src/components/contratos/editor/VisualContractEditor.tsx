import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  ContratoLocacao, 
  ContractBlock, 
  ContractStyleSettings, 
  ContractVersion, 
  ContratoModelo 
} from "../types/contractTypes";
import { CompanySettings, UserProfile } from "../../../types";
import { ContractToolbar } from "./ContractToolbar";
import { ContractSidebar } from "./ContractSidebar";
import { ContractPageCanvas } from "./ContractPageCanvas";
import { DynamicFieldModal } from "./DynamicFieldModal";
import { SignatureModal } from "./SignatureModal";
import { TemplatesManagerModal } from "./TemplatesManagerModal";
import { printContractDocument } from "../utils/contractPdfGenerator";
import { db, doc, updateDoc, setDoc, serverTimestamp } from "../../../firebase";
import { toast } from "sonner";

interface VisualContractEditorProps {
  initialContract: ContratoLocacao;
  companySettings?: CompanySettings | null;
  currentUser?: UserProfile | null;
  onBack: () => void;
  onSaveTemplate: (newTemplate: Omit<ContratoModelo, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export const VisualContractEditor: React.FC<VisualContractEditorProps> = ({
  initialContract,
  companySettings,
  currentUser,
  onBack,
  onSaveTemplate
}) => {
  // Helper: Deep clones and recalculates sequential numbering for all clause blocks
  const reindexClauses = (blocks: ContractBlock[]): ContractBlock[] => {
    let currentClauseNum = 1;
    return blocks.map((b) => {
      const cloned = {
        ...b,
        metadata: b.metadata ? JSON.parse(JSON.stringify(b.metadata)) : undefined
      };
      if (cloned.type === "clause") {
        const anterior = cloned.clauseNumber;
        cloned.clauseNumber = currentClauseNum++;
        // Subitens no formato "<strong>6.2.</strong>" acompanham o novo número da cláusula
        if (anterior && anterior !== cloned.clauseNumber && typeof cloned.content === "string") {
          const re = new RegExp(`<strong>${anterior}\\.(\\d+)\\.</strong>`, "g");
          cloned.content = cloned.content.replace(re, `<strong>${cloned.clauseNumber}.$1.</strong>`);
        }
      }
      return cloned;
    });
  };

  // Helper: Deep clones contract for immutability in undo/redo snapshots
  const cloneContract = (c: ContratoLocacao): ContratoLocacao => {
    return {
      ...c,
      blocks: c.blocks.map((b) => ({
        ...b,
        metadata: b.metadata ? JSON.parse(JSON.stringify(b.metadata)) : undefined
      })),
      styleSettings: { ...c.styleSettings }
    };
  };

  // Ensure initial contract clauses are sequential from the very first render
  const initialSanitizedContract = useMemo(() => {
    return {
      ...initialContract,
      blocks: reindexClauses(initialContract.blocks)
    };
  }, [initialContract]);

  // Current contract state
  const [contract, setContract] = useState<ContratoLocacao>(initialSanitizedContract);
  
  // History stack for Undo / Redo
  const [history, setHistory] = useState<ContratoLocacao[]>([initialSanitizedContract]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef<ContratoLocacao[]>([initialSanitizedContract]);
  const historyIndexRef = useRef<number>(0);
  const typingHistoryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active selected block in canvas / sidebar
  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    initialContract.blocks[0]?.id || null
  );

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"salvo" | "salvando" | "pendente">("salvo");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(new Date());
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI view controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<"editor" | "preview" | "split">("editor");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [highlightVariables, setHighlightVariables] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals state
  const [isDynamicFieldsModalOpen, setIsDynamicFieldsModalOpen] = useState(false);
  const [isSignaturesModalOpen, setIsSignaturesModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Push new snapshot to history stack
  const pushHistorySnapshot = useCallback((stateToSave: ContratoLocacao) => {
    const curIdx = historyIndexRef.current;
    const sliced = historyRef.current.slice(0, curIdx + 1);
    const cloned = cloneContract(stateToSave);
    const updated = [...sliced, cloned];
    // Keep last 50 edits
    if (updated.length > 50) {
      updated.shift();
    }
    historyRef.current = updated;
    const newIndex = updated.length - 1;
    historyIndexRef.current = newIndex;
    setHistory(updated);
    setHistoryIndex(newIndex);
  }, []);

  // Push new structural state with undo/redo capability and schedule auto-save
  const applyContractChange = useCallback((
    updater: (prev: ContratoLocacao) => ContratoLocacao,
    recordHistory = true
  ) => {
    if (typingHistoryTimerRef.current) {
      clearTimeout(typingHistoryTimerRef.current);
      typingHistoryTimerRef.current = null;
    }

    setContract((prev) => {
      const next = updater(prev);
      if (recordHistory) {
        pushHistorySnapshot(next);
      }
      setSaveStatus("pendente");
      return next;
    });
  }, [pushHistorySnapshot]);

  // Debounced auto-save to Firestore (1.5s pause)
  useEffect(() => {
    if (saveStatus !== "pendente") return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus("salvando");
        const docRef = doc(db, "contratos_locacao", contract.id);

        const dataToSave = {
          ...contract,
          updatedAt: serverTimestamp(),
          atualizadoPorUid: currentUser?.uid || "system",
          atualizadoPorNome: currentUser?.displayName || "Usuário"
        };

        await setDoc(docRef, dataToSave, { merge: true });
        setSaveStatus("salvo");
        setLastSavedAt(new Date());
      } catch (err: any) {
        console.error("Erro no auto-save do contrato:", err);
        setSaveStatus("pendente");
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [contract, saveStatus, currentUser]);

  // Manual save trigger
  const handleManualSave = async () => {
    try {
      setSaveStatus("salvando");
      const docRef = doc(db, "contratos_locacao", contract.id);
      
      // Also register a version snapshot on manual save
      const newVersion: ContractVersion = {
        id: `v_${Date.now()}`,
        versionNumber: (contract.versoes?.length || 0) + 1,
        createdAt: new Date().toISOString(),
        createdByUid: currentUser?.uid || "system",
        createdByName: currentUser?.displayName || "Usuário",
        description: `Salvamento manual em ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        blocksSnapshot: contract.blocks,
        styleSettingsSnapshot: contract.styleSettings
      };

      const updatedVersions = [...(contract.versoes || []), newVersion];

      const dataToSave = {
        ...contract,
        versoes: updatedVersions,
        updatedAt: serverTimestamp(),
        atualizadoPorUid: currentUser?.uid || "system",
        atualizadoPorNome: currentUser?.displayName || "Usuário"
      };

      await setDoc(docRef, dataToSave, { merge: true });
      
      setContract((prev) => ({ ...prev, versoes: updatedVersions }));
      setSaveStatus("salvo");
      setLastSavedAt(new Date());
      toast.success("Contrato salvo com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar contrato:", err);
      toast.error("Falha ao salvar contrato no banco de dados.");
      setSaveStatus("pendente");
    }
  };

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (typingHistoryTimerRef.current) {
      clearTimeout(typingHistoryTimerRef.current);
      typingHistoryTimerRef.current = null;
    }

    if (historyIndexRef.current > 0) {
      const prevIndex = historyIndexRef.current - 1;
      const targetState = historyRef.current[prevIndex];
      if (targetState) {
        historyIndexRef.current = prevIndex;
        setHistoryIndex(prevIndex);
        setContract(cloneContract(targetState));
        setSaveStatus("pendente");
        toast.info("Ação desfeita (Ctrl+Z)");
      }
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (typingHistoryTimerRef.current) {
      clearTimeout(typingHistoryTimerRef.current);
      typingHistoryTimerRef.current = null;
    }

    if (historyIndexRef.current < historyRef.current.length - 1) {
      const nextIndex = historyIndexRef.current + 1;
      const targetState = historyRef.current[nextIndex];
      if (targetState) {
        historyIndexRef.current = nextIndex;
        setHistoryIndex(nextIndex);
        setContract(cloneContract(targetState));
        setSaveStatus("pendente");
        toast.info("Ação refeita (Ctrl+Y)");
      }
    }
  }, []);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const target = e.target as HTMLElement | null;
      const isTyping = target && (
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable
      );

      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z or Cmd+Z
      if (key === "z" && !e.shiftKey) {
        if (!isTyping) {
          e.preventDefault();
          handleUndo();
        }
      } 
      // Redo: Ctrl+Y, Cmd+Y or Ctrl+Shift+Z, Cmd+Shift+Z
      else if (key === "y" || (key === "z" && e.shiftKey)) {
        if (!isTyping) {
          e.preventDefault();
          handleRedo();
        }
      }
      // Save: Ctrl+S or Cmd+S
      else if (key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Block Manipulation Handlers
  // Ajustes de layout do bloco (espaço, nova página, tamanho do texto, assinaturas)
  const handleUpdateBlock = (blockId: string, alteracoes: Partial<ContractBlock>) => {
    setContract((prev) => {
      const next = {
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== blockId) return b;
          const novo: any = { ...b, ...alteracoes };
          // Firestore não aceita undefined: remove o campo em vez de gravar undefined
          Object.keys(novo).forEach((k) => novo[k] === undefined && delete novo[k]);
          if (novo.metadata) {
            Object.keys(novo.metadata).forEach((k) => novo.metadata[k] === undefined && delete novo.metadata[k]);
            if (Object.keys(novo.metadata).length === 0) delete novo.metadata;
          }
          return novo as ContractBlock;
        })
      };
      setSaveStatus("pendente");
      pushHistorySnapshot(next);
      return next;
    });
  };

  const handleUpdateBlockContent = (blockId: string, newContent: string) => {
    setContract((prev) => {
      const next = {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, content: newContent, isCustomized: true } : b))
      };
      setSaveStatus("pendente");

      // Debounce history snapshot by 700ms so rapid keystrokes don't flood the undo stack
      if (typingHistoryTimerRef.current) {
        clearTimeout(typingHistoryTimerRef.current);
      }
      typingHistoryTimerRef.current = setTimeout(() => {
        pushHistorySnapshot(next);
      }, 700);

      return next;
    });
  };

  const handleUpdateBlockTitle = (blockId: string, newTitle: string) => {
    setContract((prev) => {
      const next = {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, clauseTitle: newTitle, isCustomized: true } : b))
      };
      setSaveStatus("pendente");

      if (typingHistoryTimerRef.current) {
        clearTimeout(typingHistoryTimerRef.current);
      }
      typingHistoryTimerRef.current = setTimeout(() => {
        pushHistorySnapshot(next);
      }, 700);

      return next;
    });
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= contract.blocks.length) return;

    applyContractChange((prev) => {
      const nextBlocks = prev.blocks.map((b) => ({ ...b }));
      const temp = nextBlocks[index];
      nextBlocks[index] = nextBlocks[targetIndex];
      nextBlocks[targetIndex] = temp;
      return {
        ...prev,
        blocks: reindexClauses(nextBlocks)
      };
    });
  };

  const handleReorderBlocks = (sourceIndex: number, destinationIndex: number) => {
    if (sourceIndex === destinationIndex || sourceIndex < 0 || destinationIndex < 0) return;

    applyContractChange((prev) => {
      const nextBlocks = prev.blocks.map((b) => ({ ...b }));
      if (sourceIndex >= nextBlocks.length) return prev;
      const clampedDest = Math.max(0, Math.min(destinationIndex, nextBlocks.length - 1));
      if (sourceIndex === clampedDest) return prev;

      const [movedBlock] = nextBlocks.splice(sourceIndex, 1);
      nextBlocks.splice(clampedDest, 0, movedBlock);

      return {
        ...prev,
        blocks: reindexClauses(nextBlocks)
      };
    });

    toast.success("Ordem das cláusulas atualizada com sucesso!");
  };

  // Arrastar e soltar: muda a posição e, se soltou no topo de uma folha,
  // marca o bloco para começar naquela folha.
  const handleDropBlock = (sourceIndex: number, destinationIndex: number, iniciarPagina: boolean) => {
    applyContractChange((prev) => {
      const nextBlocks = prev.blocks.map((b) => ({ ...b }));
      if (sourceIndex < 0 || sourceIndex >= nextBlocks.length) return prev;
      const destino = Math.max(0, Math.min(destinationIndex, nextBlocks.length - 1));
      if (sourceIndex === destino && !!nextBlocks[sourceIndex].pageBreakBefore === iniciarPagina) return prev;
      const [movido] = nextBlocks.splice(sourceIndex, 1);
      nextBlocks.splice(destino, 0, movido);
      if (iniciarPagina) {
        movido.pageBreakBefore = true;
        // quem abria essa folha agora vem logo depois: não precisa mais da quebra
        const seguinte = nextBlocks[destino + 1];
        if (seguinte?.pageBreakBefore) delete seguinte.pageBreakBefore;
      } else {
        delete movido.pageBreakBefore;
      }
      return { ...prev, blocks: reindexClauses(nextBlocks) };
    });
    toast.success(iniciarPagina ? "Bloco movido para o início da folha." : "Bloco movido.");
  };

  const handleDuplicateBlock = (blockId: string) => {
    applyContractChange((prev) => {
      const index = prev.blocks.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;
      const target = prev.blocks[index];
      const duplicated: ContractBlock = {
        ...target,
        id: `block_${Date.now()}`,
        clauseTitle: target.clauseTitle ? `${target.clauseTitle} (CÓPIA)` : undefined
      };
      const nextBlocks = [...prev.blocks];
      nextBlocks.splice(index + 1, 0, duplicated);
      return {
        ...prev,
        blocks: reindexClauses(nextBlocks)
      };
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    applyContractChange((prev) => {
      const nextBlocks = prev.blocks.filter((b) => b.id !== blockId);
      return {
        ...prev,
        blocks: reindexClauses(nextBlocks)
      };
    });
  };

  const handleAddBlock = (type: ContractBlock["type"], sectionCategory?: string) => {
    const newId = `block_${Date.now()}`;
    const newBlock: ContractBlock = {
      id: newId,
      type,
      clauseTitle: type === "clause" ? "NOVA CLÁUSULA" : undefined,
      sectionCategory: sectionCategory || "Disposições gerais",
      content: type === "clause" 
        ? "<p>Texto da nova cláusula. Substitua por sua redação personalizada.</p>"
        : type === "page_break"
        ? ""
        : "<p>Novo parágrafo jurídico.</p>"
    };

    applyContractChange((prev) => {
      const nextBlocks = [...prev.blocks, newBlock];
      return {
        ...prev,
        blocks: reindexClauses(nextBlocks)
      };
    });

    setActiveBlockId(newId);
  };

  const handleAddBlockBelow = (index: number) => {
    const newId = `block_${Date.now()}`;
    const newBlock: ContractBlock = {
      id: newId,
      type: "clause",
      clauseTitle: "NOVA CLÁUSULA",
      sectionCategory: "Disposições gerais",
      content: "<p>Insira aqui os termos adicionais pactuados entre as partes.</p>"
    };

    applyContractChange((prev) => {
      const nextBlocks = [...prev.blocks];
      nextBlocks.splice(index + 1, 0, newBlock);
      return {
        ...prev,
        blocks: reindexClauses(nextBlocks)
      };
    });

    setActiveBlockId(newId);
  };

  // Insert variable into active block
  const handleInsertVariable = (varKeyOrTag: string) => {
    const tag = varKeyOrTag.startsWith("{{") ? varKeyOrTag : `{{${varKeyOrTag}}}`;
    if (!activeBlockId) {
      toast.info(`Tag ${tag} copiada! Clique em uma cláusula para inseri-la.`);
      navigator.clipboard.writeText(tag);
      return;
    }

    applyContractChange((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id === activeBlockId) {
          let updatedContent = b.content || "";
          if (updatedContent.includes("</p>")) {
            updatedContent = updatedContent.replace(/(<\/p>)(?![\s\S]*<\/p>)/i, ` <strong>${tag}</strong></p>`);
          } else {
            updatedContent = `${updatedContent} <strong>${tag}</strong>`;
          }
          return {
            ...b,
            content: updatedContent,
            isCustomized: true
          };
        }
        return b;
      })
    }));

    toast.success(`Campo ${tag} inserido na cláusula ativa!`);
  };

  // Style change
  const handleUpdateStyle = (newStyles: Partial<ContractStyleSettings>) => {
    applyContractChange((prev) => ({
      ...prev,
      styleSettings: {
        ...prev.styleSettings,
        ...newStyles
      }
    }));
  };

  // Restore historic version
  const handleRestoreVersion = (version: ContractVersion) => {
    applyContractChange((prev) => ({
      ...prev,
      blocks: version.blocksSnapshot,
      styleSettings: version.styleSettingsSnapshot
    }));
    toast.success(`Versão #${version.versionNumber} restaurada com sucesso!`);
  };

  // Print and PDF
  const handlePrint = () => {
    printContractDocument(contract, companySettings);
  };

  const handleExportPdf = () => {
    printContractDocument(contract, companySettings);
    toast.info("A janela de impressão permite 'Salvar como PDF' com diagramação A4 perfeita.");
  };

  // Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      editorContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={editorContainerRef}
      className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden select-none font-sans"
    >
      {/* 1. Header Toolbar & Formatting Ribbon */}
      <ContractToolbar
        contract={contract}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSaveManual={handleManualSave}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onBack={onBack}
        onPrint={handlePrint}
        onExportPdf={handleExportPdf}
        onOpenSignatures={() => setIsSignaturesModalOpen(true)}
        onSaveAsTemplate={() => setIsTemplateModalOpen(true)}
        onOpenVariableModal={() => setIsDynamicFieldsModalOpen(true)}
        onUpdateStyle={handleUpdateStyle}
        onInsertVariableText={handleInsertVariable}
        highlightVariables={highlightVariables}
        onToggleHighlightVariables={() => setHighlightVariables(!highlightVariables)}
        onAddClause={() => handleAddBlock("clause")}
        onUpdateTitle={(title) => applyContractChange((p) => ({ ...p, titulo: title }))}
      />

      {/* 2. Workspace Body: Left Sidebar + Central A4 Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <ContractSidebar
          contract={contract}
          companySettings={companySettings}
          activeBlockId={activeBlockId}
          onSelectBlock={(id) => {
            setActiveBlockId(id);
            const el = document.getElementById(`block-${id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onMoveBlock={handleMoveBlock}
          onReorderBlocks={handleReorderBlocks}
          onDuplicateBlock={handleDuplicateBlock}
          onDeleteBlock={handleDeleteBlock}
          onAddBlock={handleAddBlock}
          onInsertVariable={handleInsertVariable}
          onUpdateStyle={handleUpdateStyle}
          onRestoreVersion={handleRestoreVersion}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Central A4 Canvas */}
        <ContractPageCanvas
          contract={contract}
          companySettings={companySettings}
          activeBlockId={activeBlockId}
          onSelectBlock={setActiveBlockId}
          onUpdateBlockContent={handleUpdateBlockContent}
          onUpdateBlockTitle={handleUpdateBlockTitle}
          onUpdateBlock={handleUpdateBlock}
          onMoveBlock={handleMoveBlock}
          onReorderBlocks={handleReorderBlocks}
          onDropBlock={handleDropBlock}
          onDuplicateBlock={handleDuplicateBlock}
          onDeleteBlock={handleDeleteBlock}
          onAddBlockBelow={handleAddBlockBelow}
          zoomLevel={zoomLevel}
          viewMode={viewMode}
          highlightVariables={highlightVariables}
        />
      </div>

      {/* Modals */}
      <DynamicFieldModal
        isOpen={isDynamicFieldsModalOpen}
        onClose={() => setIsDynamicFieldsModalOpen(false)}
        contract={contract}
        onUpdateContractData={(updated) => {
          applyContractChange((prev) => ({
            ...prev,
            ...updated
          }));
          toast.success("Dados cadastrais do contrato atualizados!");
        }}
      />

      <SignatureModal
        isOpen={isSignaturesModalOpen}
        onClose={() => setIsSignaturesModalOpen(false)}
        contract={contract}
        onUpdateStatus={(newStatus, url) => {
          applyContractChange((prev) => ({
            ...prev,
            status: newStatus,
            assinaturaDigitalUrl: url || prev.assinaturaDigitalUrl
          }));
        }}
      />

      <TemplatesManagerModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        contract={contract}
        onSaveTemplate={onSaveTemplate}
      />
    </div>
  );
};
