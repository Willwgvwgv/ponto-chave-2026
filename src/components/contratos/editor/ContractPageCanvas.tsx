import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Copy, 
  Plus, 
  GripVertical, 
  Sparkles, 
  Building2,
  FileText,
  ArrowUpDown
} from "lucide-react";
import { ContratoLocacao, ContractBlock } from "../types/contractTypes";
import { CompanySettings } from "../../../types";
import { buildVariableMap, resolveContractText } from "../utils/contractVariableResolver";
import { 
  paginateBlocks, 
  getMarginConfig, 
  A4_DIMENSIONS,
  PageLayout,
  PageBlockItem
} from "../utils/contractPagination";
import { RichHtmlBlockEditor } from "./RichHtmlBlockEditor";

interface ContractPageCanvasProps {
  contract: ContratoLocacao;
  companySettings?: CompanySettings | null;
  activeBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onUpdateBlockContent: (blockId: string, newContent: string) => void;
  onUpdateBlockTitle: (blockId: string, newTitle: string) => void;
  onMoveBlock: (index: number, direction: "up" | "down") => void;
  onReorderBlocks?: (sourceIndex: number, destinationIndex: number) => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onAddBlockBelow: (index: number) => void;
  zoomLevel: number;
  viewMode: "editor" | "preview" | "split";
  highlightVariables: boolean;
}

export const ContractPageCanvas: React.FC<ContractPageCanvasProps> = ({
  contract,
  companySettings,
  activeBlockId,
  onSelectBlock,
  onUpdateBlockContent,
  onUpdateBlockTitle,
  onMoveBlock,
  onReorderBlocks,
  onDuplicateBlock,
  onDeleteBlock,
  onAddBlockBelow,
  zoomLevel,
  viewMode,
  highlightVariables
}) => {
  const variableMap = buildVariableMap(contract, companySettings);
  const styles = contract.styleSettings;

  const logoUrl = styles.headerLogoUrl || companySettings?.logoUrl || "";
  const companyName = companySettings?.name || "Fidelité Imobiliária";
  const companyCreci = companySettings?.creci || "CRECI-GO";
  const companyAddress = companySettings?.address || "";
  const companyPhone = companySettings?.phone || "";

  const marginConfig = useMemo(() => getMarginConfig(styles.marginType), [styles.marginType]);
  const primaryColor = styles.primaryColor || "#1e3a8a";

  const isReadOnly = viewMode === "preview";
  const hasFiador = contract.condicoes.modalidadeGarantia === "fiador";

  // Drag and drop state
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const [moveMenuBlockId, setMoveMenuBlockId] = useState<string | null>(null);
  const isDraggingViaHandleRef = useRef<boolean>(false);
  const touchDragStartIndexRef = useRef<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic real DOM heights measured from actual rendered elements
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const measuredHeightsRef = useRef<Record<string, number>>({});

  // Close move popover when clicking anywhere outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setMoveMenuBlockId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Measure rendered DOM block heights and update pagination dynamically
  useLayoutEffect(() => {
    let hasSignificantChange = false;
    const currentHeights = { ...measuredHeightsRef.current };

    contract.blocks.forEach((block) => {
      const el = document.getElementById(`block-${block.id}`);
      if (el) {
        const height = el.offsetHeight + (styles.paragraphSpacingPx || 12);
        const prev = currentHeights[block.id] || 0;
        if (Math.abs(prev - height) > 5) {
          currentHeights[block.id] = height;
          hasSignificantChange = true;
        }
      }
    });

    if (hasSignificantChange) {
      measuredHeightsRef.current = currentHeights;
      setMeasuredHeights(currentHeights);
    }
  }, [contract.blocks, styles, zoomLevel]);

  // Compute A4 pages layout
  const pages: PageLayout[] = useMemo(() => {
    return paginateBlocks(contract.blocks, styles, measuredHeights, hasFiador);
  }, [contract.blocks, styles, measuredHeights, hasFiador]);

  // Touch drag handlers for mobile devices
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    if (isReadOnly) return;
    e.stopPropagation();
    isDraggingViaHandleRef.current = true;
    touchDragStartIndexRef.current = index;
    setDraggedBlockIndex(index);
    onSelectBlock(contract.blocks[index].id);
    if (navigator.vibrate) {
      try { navigator.vibrate(30); } catch (_) {}
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragStartIndexRef.current === null) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    const touch = e.touches[0];
    if (!touch) return;
    
    // Auto-scroll when dragging near top or bottom of viewport
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const topThreshold = scrollRect.top + 70;
      const bottomThreshold = scrollRect.bottom - 70;
      if (touch.clientY < topThreshold) {
        scrollEl.scrollTop -= 14;
      } else if (touch.clientY > bottomThreshold) {
        scrollEl.scrollTop += 14;
      }
    }

    // Find canvas block element under the finger (works across all pages)
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const blockEl = elem?.closest("[data-canvas-block-index]");
    if (blockEl) {
      const targetIdx = parseInt(blockEl.getAttribute("data-canvas-block-index") || "", 10);
      if (!isNaN(targetIdx) && targetIdx !== touchDragStartIndexRef.current) {
        const rect = blockEl.getBoundingClientRect();
        const isAfter = (touch.clientY - rect.top) > rect.height / 2;
        setDragOverBlockIndex(targetIdx);
        setDropPosition(isAfter ? "after" : "before");
      }
    }
  };

  const handleTouchEnd = () => {
    const fromIdx = touchDragStartIndexRef.current;
    if (fromIdx !== null && dragOverBlockIndex !== null && fromIdx !== dragOverBlockIndex && onReorderBlocks) {
      let targetIndex: number;
      if (dropPosition === "before") {
        targetIndex = fromIdx < dragOverBlockIndex ? dragOverBlockIndex - 1 : dragOverBlockIndex;
      } else {
        targetIndex = fromIdx < dragOverBlockIndex ? dragOverBlockIndex : dragOverBlockIndex + 1;
      }
      onReorderBlocks(fromIdx, targetIndex);
      if (navigator.vibrate) {
        try { navigator.vibrate([25, 30, 25]); } catch (_) {}
      }
    }
    touchDragStartIndexRef.current = null;
    isDraggingViaHandleRef.current = false;
    setDraggedBlockIndex(null);
    setDragOverBlockIndex(null);
    setDropPosition(null);
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto bg-slate-200/80 p-4 sm:p-6 md:p-10 flex justify-center custom-scrollbar"
    >
      {/* Zoom and Pages Stack Wrapper */}
      <div 
        style={{ 
          transform: `scale(${zoomLevel / 100})`, 
          transformOrigin: "top center",
          transition: "transform 0.15s ease-out"
        }}
        className="flex flex-col items-center gap-10 pb-28"
      >
        {pages.map((page) => {
          const isFirstPage = page.pageIndex === 0;

          return (
            <div key={`page-wrapper-${page.pageIndex}`} className="flex flex-col items-center">
              {/* Sheet Metadata Header outside paper */}
              <div className="w-[794px] mb-2 px-1 flex items-center justify-between text-xs font-semibold text-slate-500 select-none">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Página {page.pageNumber} de {pages.length}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Formato A4 (210 × 297 mm)
                </span>
              </div>

              {/* Physical A4 Sheet Container */}
              <div 
                data-page-index={page.pageIndex}
                className="w-[794px] min-h-[1123px] bg-white rounded-xs shadow-2xl border border-slate-300 relative text-slate-900 flex flex-col justify-between transition-all"
                style={{
                  fontFamily: styles.fontFamily,
                  fontSize: `${styles.fontSizePt}pt`,
                  lineHeight: styles.lineSpacing,
                  paddingTop: `${marginConfig.paddingTop}px`,
                  paddingBottom: `${marginConfig.paddingBottom}px`,
                  paddingLeft: `${marginConfig.paddingLeft}px`,
                  paddingRight: `${marginConfig.paddingRight}px`,
                  boxSizing: "border-box"
                }}
              >
                {/* Watermark if active */}
                {styles.showWatermark && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0"
                  >
                    <span className="text-8xl font-black text-slate-400/20 rotate-[-35deg] tracking-widest uppercase">
                      {styles.watermarkText || "MINUTA"}
                    </span>
                  </div>
                )}

                {/* Top Section: Header */}
                {styles.showHeader && (
                  isFirstPage ? (
                    /* Page 1: Full Corporate Header */
                    <header className="border-b-2 pb-3 mb-6 flex items-center justify-between gap-4 shrink-0 relative z-10" style={{ borderColor: primaryColor }}>
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img src={logoUrl} alt={companyName} className="h-10 max-w-[150px] object-contain" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xs">
                            <Building2 className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <h2 className="text-sm font-black tracking-tight leading-tight" style={{ color: primaryColor }}>
                            {companyName}
                          </h2>
                          <p className="text-[10px] text-slate-500 font-semibold leading-tight">
                            {companyCreci} {companyPhone ? `• ${companyPhone}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-slate-500 font-medium leading-tight">
                        <div><strong>Contrato:</strong> {contract.numeroContrato || "LOC-2026"}</div>
                        <div><strong>Tipo:</strong> {contract.tipoLocacao.toUpperCase()}</div>
                      </div>
                    </header>
                  ) : (
                    /* Subsequent Pages: Running Header */
                    <header className="border-b pb-2 mb-5 flex items-center justify-between gap-4 shrink-0 relative z-10 text-[10px] text-slate-400 font-medium" style={{ borderColor: `${primaryColor}40` }}>
                      <div className="flex items-center gap-2 truncate max-w-sm">
                        <span className="font-bold uppercase tracking-wider text-slate-700 truncate">{companyName}</span>
                        <span>•</span>
                        <span className="truncate">{contract.titulo || "Contrato de Locação"}</span>
                      </div>
                      <div className="shrink-0 text-slate-500 font-medium">
                        Contrato Nº: <strong>{contract.numeroContrato || "LOC-2026"}</strong>
                      </div>
                    </header>
                  )
                )}

                {/* Middle Section: Document Content Blocks allocated to this page */}
                <div className="flex-1 flex flex-col justify-start relative z-10 space-y-4">
                  {page.blocks.map(({ block, globalIndex }) => {
                    const isActive = activeBlockId === block.id && !isReadOnly;
                    const isClause = block.type === "clause";
                    const isDraggingThis = draggedBlockIndex === globalIndex;
                    const isTargetThis = dragOverBlockIndex === globalIndex && draggedBlockIndex !== null && draggedBlockIndex !== globalIndex;

                    // Resolve text with dynamic tags
                    const resolvedContent = resolveContractText(block.content, variableMap, {
                      highlightVariables: highlightVariables || isReadOnly
                    });

                    return (
                      <div key={block.id} className="relative">
                        {/* Drop Indicator Before Block */}
                        {isTargetThis && dropPosition === "before" && (
                          <div className="py-2 -my-1 transition-all">
                            <div className="h-3 bg-blue-600 rounded-full shadow-lg flex items-center justify-between px-3 text-white text-[10px] font-bold animate-pulse">
                              <span className="flex items-center gap-1.5">
                                <ChevronUp className="w-3.5 h-3.5" />
                                Soltar AQUI (acima da {isClause ? `Cláusula ${block.clauseNumber || globalIndex + 1}ª` : block.clauseTitle || "seção"})
                              </span>
                              <span className="bg-blue-800/80 px-2 py-0.5 rounded text-[9px]">Solte o mouse ou o dedo para mover</span>
                            </div>
                          </div>
                        )}

                        <div
                          id={`block-${block.id}`}
                          data-canvas-block-index={globalIndex}
                          onClick={() => !isReadOnly && onSelectBlock(block.id)}
                          onDragOver={(e) => {
                            if (isReadOnly || draggedBlockIndex === null || !isDraggingViaHandleRef.current) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = "move";
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offset = e.clientY - rect.top;
                            const isAfter = offset > rect.height / 2;
                            setDragOverBlockIndex(globalIndex);
                            setDropPosition(isAfter ? "after" : "before");
                          }}
                          onDragLeave={(e) => {
                            const relatedTarget = e.relatedTarget as Node | null;
                            if (!e.currentTarget.contains(relatedTarget)) {
                              if (dragOverBlockIndex === globalIndex) {
                                setDragOverBlockIndex(null);
                                setDropPosition(null);
                              }
                            }
                          }}
                          onDrop={(e) => {
                            if (isReadOnly || draggedBlockIndex === null || !isDraggingViaHandleRef.current) return;
                            e.preventDefault();
                            e.stopPropagation();
                            if (draggedBlockIndex !== globalIndex && onReorderBlocks) {
                              let targetIndex: number;
                              if (dropPosition === "before") {
                                targetIndex = draggedBlockIndex < globalIndex ? globalIndex - 1 : globalIndex;
                              } else {
                                targetIndex = draggedBlockIndex < globalIndex ? globalIndex : globalIndex + 1;
                              }
                              onReorderBlocks(draggedBlockIndex, targetIndex);
                            }
                            isDraggingViaHandleRef.current = false;
                            setDraggedBlockIndex(null);
                            setDragOverBlockIndex(null);
                            setDropPosition(null);
                          }}
                          className={`relative group rounded-lg transition-all ${
                            !isReadOnly ? "cursor-pointer hover:ring-2 hover:ring-blue-300/60 p-2 -m-2" : ""
                          } ${
                            isActive ? "ring-2 ring-blue-500 bg-blue-50/20 p-2 -m-2" : ""
                          } ${
                            isDraggingThis ? "opacity-35 ring-2 ring-blue-400 ring-dashed bg-blue-50/50 scale-[0.99]" : ""
                          }`}
                          style={{ marginBottom: `${styles.paragraphSpacingPx}px` }}
                        >
                          {/* Left Margin Drag Gutter Handle (touch + mouse) */}
                          {!isReadOnly && (
                            <div
                              draggable
                              onDragStart={(e) => {
                                isDraggingViaHandleRef.current = true;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("application/x-contract-block", globalIndex.toString());
                                e.dataTransfer.setData("text/plain", globalIndex.toString());
                                setDraggedBlockIndex(globalIndex);
                                onSelectBlock(block.id);
                              }}
                              onDragEnd={() => {
                                isDraggingViaHandleRef.current = false;
                                setDraggedBlockIndex(null);
                                setDragOverBlockIndex(null);
                                setDropPosition(null);
                              }}
                              onTouchStart={(e) => handleTouchStart(globalIndex, e)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              style={{ touchAction: "none" }}
                              className={`absolute -left-9 top-2 ${isActive ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"} transition-all p-1 text-slate-400 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-300 rounded shadow-xs cursor-grab active:cursor-grabbing z-20 flex items-center justify-center hover:scale-110 touch-none`}
                              title="Segure e arraste para reposicionar (mouse ou toque no celular)"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                          )}

                          {/* Floating Action Controls on Hover / Selection */}
                          {!isReadOnly && (
                            <div className={`absolute -top-3.5 right-2 ${isActive ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"} transition-opacity bg-white border border-slate-300 shadow-md rounded-lg flex items-center p-0.5 gap-0.5 z-30`}>
                              {/* Move Up */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveBlock(globalIndex, "up");
                                }}
                                disabled={globalIndex === 0}
                                className="p-1 text-slate-500 hover:text-blue-700 disabled:opacity-25 rounded hover:bg-slate-100 cursor-pointer"
                                title="Subir (mover para cima)"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>

                              {/* Move Down */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveBlock(globalIndex, "down");
                                }}
                                disabled={globalIndex === contract.blocks.length - 1}
                                className="p-1 text-slate-500 hover:text-blue-700 disabled:opacity-25 rounded hover:bg-slate-100 cursor-pointer"
                                title="Descer (mover para baixo)"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>

                              {/* Drag handle */}
                              <div
                                draggable
                                onDragStart={(e) => {
                                  isDraggingViaHandleRef.current = true;
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("application/x-contract-block", globalIndex.toString());
                                  e.dataTransfer.setData("text/plain", globalIndex.toString());
                                  setDraggedBlockIndex(globalIndex);
                                  onSelectBlock(block.id);
                                }}
                                onDragEnd={() => {
                                  isDraggingViaHandleRef.current = false;
                                  setDraggedBlockIndex(null);
                                  setDragOverBlockIndex(null);
                                  setDropPosition(null);
                                }}
                                onTouchStart={(e) => handleTouchStart(globalIndex, e)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchEnd}
                                style={{ touchAction: "none" }}
                                className="p-1 text-slate-500 hover:text-blue-700 rounded hover:bg-slate-100 cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
                                title="Segure e arraste para soltar onde desejar (mouse ou toque)"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>

                              {/* Move to specific location menu */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveMenuBlockId(moveMenuBlockId === block.id ? null : block.id);
                                  }}
                                  className={`px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                                    moveMenuBlockId === block.id ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:text-blue-700 hover:bg-slate-100"
                                  }`}
                                  title="Mover para posição específica"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                  <span className="text-[10px]">Mover</span>
                                </button>

                                {/* Move Popover Menu */}
                                {moveMenuBlockId === block.id && (
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2.5 text-xs text-left"
                                  >
                                    <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between text-[11px]">
                                      <span>Posicionar Cláusula</span>
                                      <button 
                                        onClick={() => setMoveMenuBlockId(null)}
                                        className="text-slate-400 hover:text-slate-600 text-xs px-1"
                                      >
                                        ✕
                                      </button>
                                    </div>

                                    <div className="py-1.5 space-y-1">
                                      <button
                                        onClick={() => {
                                          onReorderBlocks?.(globalIndex, 0);
                                          setMoveMenuBlockId(null);
                                        }}
                                        disabled={globalIndex === 0}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-xs flex items-center justify-between disabled:opacity-40 cursor-pointer"
                                      >
                                        <span>Mover para o Topo (1ª posição)</span>
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => {
                                          onReorderBlocks?.(globalIndex, contract.blocks.length - 1);
                                          setMoveMenuBlockId(null);
                                        }}
                                        disabled={globalIndex === contract.blocks.length - 1}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-xs flex items-center justify-between disabled:opacity-40 cursor-pointer"
                                      >
                                        <span>Mover para o Fim do Contrato</span>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <div className="border-t border-slate-100 pt-1.5">
                                      <p className="text-[10px] text-slate-500 font-semibold mb-1">
                                        Colocar imediatamente após:
                                      </p>
                                      <div className="max-h-44 overflow-y-auto space-y-0.5 custom-scrollbar">
                                        {contract.blocks.map((otherBlock, otherIdx) => {
                                          if (otherBlock.id === block.id) return null;
                                          const otherLabel = otherBlock.type === "clause"
                                            ? `Cláusula ${otherBlock.clauseNumber || otherIdx + 1}ª - ${otherBlock.clauseTitle || "Sem título"}`
                                            : otherBlock.clauseTitle || (otherBlock.type === "title" ? "Título Principal" : otherBlock.type === "parties" ? "Identificação das Partes" : "Bloco");

                                          return (
                                            <button
                                              key={otherBlock.id}
                                              onClick={() => {
                                                const targetIdx = globalIndex < otherIdx ? otherIdx : otherIdx + 1;
                                                onReorderBlocks?.(globalIndex, targetIdx);
                                                setMoveMenuBlockId(null);
                                              }}
                                              className="w-full text-left px-2 py-1 rounded text-[11px] text-slate-700 hover:bg-blue-50 hover:text-blue-700 truncate cursor-pointer block"
                                              title={`Colocar abaixo de: ${otherLabel}`}
                                            >
                                              Após {otherLabel}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Duplicate */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDuplicateBlock(block.id);
                                }}
                                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer"
                                title="Duplicar cláusula"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Add Below */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddBlockBelow(globalIndex);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 cursor-pointer"
                                title="Inserir cláusula abaixo"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              {!block.isLocked && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteBlock(block.id);
                                  }}
                                  className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 cursor-pointer"
                                  title="Excluir cláusula"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Render based on Block Type */}
                          {block.type === "title" && (
                            <div className="text-center my-3">
                              {isActive ? (
                                <input
                                  type="text"
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                  value={block.content}
                                  onChange={(e) => onUpdateBlockContent(block.id, e.target.value)}
                                  className="w-full text-center text-lg md:text-xl font-black uppercase tracking-wide border-b border-blue-400 outline-none pb-1 select-text"
                                  style={{ color: primaryColor }}
                                />
                              ) : (
                                <h1 
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                  className="text-lg md:text-xl font-black uppercase tracking-wide text-center select-text"
                                  style={{ color: primaryColor }}
                                >
                                  {resolveContractText(block.content, variableMap)}
                                </h1>
                              )}
                            </div>
                          )}

                          {block.type === "subtitle" && (
                            <div className="text-center mb-5">
                              {isActive ? (
                                <input
                                  type="text"
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                  value={block.content}
                                  onChange={(e) => onUpdateBlockContent(block.id, e.target.value)}
                                  className="w-full text-center text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-blue-400 outline-none pb-1 select-text"
                                />
                              ) : (
                                <h2 
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                  className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500 text-center select-text"
                                >
                                  {resolveContractText(block.content, variableMap)}
                                </h2>
                              )}
                            </div>
                          )}

                          {block.type === "clause" && (
                            <div>
                              {/* Clause Title & Number */}
                              <div className="flex items-center gap-2 mb-1.5">
                                <span 
                                  className="font-bold uppercase tracking-wide shrink-0 select-text"
                                  style={{ color: primaryColor }}
                                >
                                  CLÁUSULA {block.clauseNumber || globalIndex + 1}ª {block.clauseTitle ? "-" : ""}
                                </span>
                                {isActive ? (
                                  <input
                                    type="text"
                                    draggable={false}
                                    onDragStart={(e) => e.stopPropagation()}
                                    value={block.clauseTitle || ""}
                                    onChange={(e) => onUpdateBlockTitle(block.id, e.target.value)}
                                    placeholder="Título da Cláusula (ex: DO OBJETO)"
                                    className="flex-1 font-bold uppercase tracking-wide text-xs border-b border-blue-400 outline-none pb-0.5 select-text"
                                    style={{ color: primaryColor }}
                                  />
                                ) : (
                                  <span 
                                    draggable={false}
                                    onDragStart={(e) => e.stopPropagation()}
                                    className="font-bold uppercase tracking-wide select-text"
                                    style={{ color: primaryColor }}
                                  >
                                    {block.clauseTitle}
                                  </span>
                                )}
                              </div>

                              {/* Clause Body Text */}
                              {isActive ? (
                                <div className="mt-1">
                                  <RichHtmlBlockEditor
                                    blockId={block.id}
                                    initialHtml={block.content}
                                    onChange={(newHtml) => onUpdateBlockContent(block.id, newHtml)}
                                    primaryColor={primaryColor}
                                    placeholder="Conteúdo da cláusula. Digite {{tag}} para inserir variáveis automáticas..."
                                    readOnly={isReadOnly}
                                    minHeight="60px"
                                  />
                                </div>
                              ) : (
                                <div 
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                  className="text-justify leading-relaxed clause-html-body select-text cursor-text"
                                  style={{ userSelect: "text" }}
                                  dangerouslySetInnerHTML={{ __html: resolvedContent }}
                                />
                              )}
                            </div>
                          )}

                          {block.type === "parties" && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-2">
                              <div 
                                className="text-xs font-black uppercase tracking-wider mb-2 flex items-center justify-between"
                                style={{ color: primaryColor }}
                              >
                                <span>{block.clauseTitle || "IDENTIFICAÇÃO DAS PARTES"}</span>
                                {!isReadOnly && <span className="text-[10px] text-slate-400 font-normal">Preenchido com dados cadastrais</span>}
                              </div>
                              {isActive ? (
                                <RichHtmlBlockEditor
                                  blockId={block.id}
                                  initialHtml={block.content}
                                  onChange={(newHtml) => onUpdateBlockContent(block.id, newHtml)}
                                  primaryColor={primaryColor}
                                  placeholder="Identificação das partes contratantes..."
                                  readOnly={isReadOnly}
                                  minHeight="90px"
                                  className="text-xs"
                                />
                              ) : (
                                <div 
                                  className="text-xs text-justify leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: resolvedContent }}
                                />
                              )}
                            </div>
                          )}

                          {block.type === "divider" && (
                            <div className="my-4">
                              <hr className="border-t-2" style={{ borderColor: primaryColor }} />
                            </div>
                          )}

                          {block.type === "signatures" && (
                            <div className="mt-8 pt-4">
                              <div 
                                className="text-center text-xs text-slate-600 mb-6"
                                dangerouslySetInnerHTML={{ __html: resolvedContent }}
                              />

                              <div className="grid grid-cols-2 gap-8 mt-4">
                                {/* Locador */}
                                <div className="text-center">
                                  <div className="border-t-2 border-slate-900 w-4/5 mx-auto mb-1"></div>
                                  <div className="text-xs font-bold text-slate-900">{variableMap.nome_locador || "LOCADOR"}</div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">LOCADOR(A)</div>
                                  <div className="text-[10px] text-slate-400">CPF: {variableMap.cpf_locador}</div>
                                </div>

                                {/* Locatário */}
                                <div className="text-center">
                                  <div className="border-t-2 border-slate-900 w-4/5 mx-auto mb-1"></div>
                                  <div className="text-xs font-bold text-slate-900">{variableMap.nome_locatario || "LOCATÁRIO"}</div>
                                  <div className="text-[10px] text-slate-500 uppercase font-semibold">LOCATÁRIO(A)</div>
                                  <div className="text-[10px] text-slate-400">CPF: {variableMap.cpf_locatario}</div>
                                </div>

                                {/* Fiador se aplicável */}
                                {contract.condicoes.modalidadeGarantia === "fiador" && (
                                  <div className="col-span-2 text-center max-w-sm mx-auto mt-4">
                                    <div className="border-t-2 border-slate-900 w-full mb-1"></div>
                                    <div className="text-xs font-bold text-slate-900">{variableMap.nome_fiador || "FIADOR SOLIDÁRIO"}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-semibold">FIADOR(A) E PRINCIPAL PAGADOR(A)</div>
                                    <div className="text-[10px] text-slate-400">CPF: {variableMap.cpf_fiador}</div>
                                  </div>
                                )}

                                {/* Testemunhas */}
                                <div className="text-center mt-4">
                                  <div className="border-t border-dashed border-slate-400 w-4/5 mx-auto mb-1"></div>
                                  <div className="text-[11px] font-semibold text-slate-700">1ª Testemunha</div>
                                  <div className="text-[10px] text-slate-400">Nome: ___________________________</div>
                                  <div className="text-[10px] text-slate-400">CPF: ____________________________</div>
                                </div>

                                <div className="text-center mt-4">
                                  <div className="border-t border-dashed border-slate-400 w-4/5 mx-auto mb-1"></div>
                                  <div className="text-[11px] font-semibold text-slate-700">2ª Testemunha</div>
                                  <div className="text-[10px] text-slate-400">Nome: ___________________________</div>
                                  <div className="text-[10px] text-slate-400">CPF: ____________________________</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {block.type === "paragraph" && (
                            <div>
                              {isActive ? (
                                <RichHtmlBlockEditor
                                  blockId={block.id}
                                  initialHtml={block.content}
                                  onChange={(newHtml) => onUpdateBlockContent(block.id, newHtml)}
                                  primaryColor={primaryColor}
                                  placeholder="Parágrafo jurídico..."
                                  readOnly={isReadOnly}
                                  minHeight="45px"
                                />
                              ) : (
                                <div 
                                  className="text-justify leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: resolvedContent }}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Drop Indicator After Block */}
                        {isTargetThis && dropPosition === "after" && (
                          <div className="py-2 -my-1 transition-all">
                            <div className="h-3 bg-blue-600 rounded-full shadow-lg flex items-center justify-between px-3 text-white text-[10px] font-bold animate-pulse">
                              <span className="flex items-center gap-1.5">
                                <ChevronDown className="w-3.5 h-3.5" />
                                Soltar AQUI (abaixo da {isClause ? `Cláusula ${block.clauseNumber || globalIndex + 1}ª` : block.clauseTitle || "seção"})
                              </span>
                              <span className="bg-blue-800/80 px-2 py-0.5 rounded text-[9px]">Solte o mouse para mover</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Section: Footer (Always pinned at bottom of page) */}
                {styles.showFooter && (
                  <footer className="border-t border-slate-200 pt-3 mt-6 flex items-center justify-between text-[10px] text-slate-400 font-medium shrink-0 relative z-10">
                    <div className="truncate max-w-[480px]">
                      <span>{companyName}</span>
                      {companyAddress ? <span> • {companyAddress}</span> : null}
                    </div>
                    <div>
                      {styles.showPageNumbers && (
                        <span className="font-semibold text-slate-500">
                          Página {page.pageNumber} de {pages.length}
                        </span>
                      )}
                    </div>
                  </footer>
                )}
              </div>
            </div>
          );
        })}

        {/* Global End-of-document drop zone when dragging */}
        {draggedBlockIndex !== null && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverBlockIndex(contract.blocks.length);
              setDropPosition("after");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggedBlockIndex !== null && onReorderBlocks) {
                onReorderBlocks(draggedBlockIndex, contract.blocks.length - 1);
              }
              setDraggedBlockIndex(null);
              setDragOverBlockIndex(null);
              setDropPosition(null);
            }}
            className={`w-[794px] p-4 border-2 border-dashed rounded-xl text-center text-xs transition-all my-2 ${
              dragOverBlockIndex === contract.blocks.length
                ? "border-blue-500 bg-blue-50 text-blue-700 font-bold scale-[1.01]"
                : "border-slate-300 text-slate-400 bg-white/80"
            }`}
          >
            ↓ Solte aqui para mover para a última posição do contrato
          </div>
        )}
      </div>
    </div>
  );
};
