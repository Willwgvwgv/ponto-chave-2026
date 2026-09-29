import React, { useState, useMemo, useRef } from "react";
import { 
  ListTree, 
  Variable, 
  PlusSquare, 
  Palette, 
  History, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  GripVertical, 
  Trash2, 
  Copy, 
  Check, 
  Plus, 
  Eye, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Heading,
  FileText,
  Table,
  Minus,
  CheckCircle2,
  BookmarkCheck,
  Scissors
} from "lucide-react";
import { ContratoLocacao, ContractBlock, ContractStyleSettings, ContractVersion } from "../types/contractTypes";
import { DYNAMIC_VARIABLES_CATALOG, buildVariableMap } from "../utils/contractVariableResolver";
import { CompanySettings } from "../../../types";

interface ContractSidebarProps {
  contract: ContratoLocacao;
  companySettings?: CompanySettings | null;
  activeBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onMoveBlock: (index: number, direction: "up" | "down") => void;
  onReorderBlocks?: (sourceIndex: number, destinationIndex: number) => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onAddBlock: (type: ContractBlock["type"], sectionCategory?: string) => void;
  onInsertVariable: (varKey: string) => void;
  onUpdateStyle: (styles: Partial<ContractStyleSettings>) => void;
  onRestoreVersion: (version: ContractVersion) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

type SidebarTab = "estrutura" | "variaveis" | "elementos" | "design" | "versoes";

export const ContractSidebar: React.FC<ContractSidebarProps> = ({
  contract,
  companySettings,
  activeBlockId,
  onSelectBlock,
  onMoveBlock,
  onReorderBlocks,
  onDuplicateBlock,
  onDeleteBlock,
  onAddBlock,
  onInsertVariable,
  onUpdateStyle,
  onRestoreVersion,
  searchTerm,
  setSearchTerm,
  isCollapsed,
  onToggleCollapse
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>("estrutura");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedVarCategory, setSelectedVarCategory] = useState<string>("all");

  // Drag and drop state for sidebar outline
  const [sidebarDragIndex, setSidebarDragIndex] = useState<number | null>(null);
  const [sidebarDragOverIndex, setSidebarDragOverIndex] = useState<number | null>(null);
  const [sidebarDropPosition, setSidebarDropPosition] = useState<"before" | "after" | null>(null);
  const isSidebarHandleDraggingRef = useRef<boolean>(false);
  const touchSidebarStartRef = useRef<number | null>(null);

  const handleSidebarTouchStart = (index: number, e: React.TouchEvent) => {
    e.stopPropagation();
    isSidebarHandleDraggingRef.current = true;
    touchSidebarStartRef.current = index;
    setSidebarDragIndex(index);
    if (navigator.vibrate) {
      try { navigator.vibrate(30); } catch (_) {}
    }
  };

  const handleSidebarTouchMove = (e: React.TouchEvent) => {
    if (touchSidebarStartRef.current === null) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    const touch = e.touches[0];
    if (!touch) return;
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemEl = elem?.closest("[data-sidebar-block-index]");
    if (itemEl) {
      const targetIdx = parseInt(itemEl.getAttribute("data-sidebar-block-index") || "", 10);
      if (!isNaN(targetIdx) && targetIdx !== touchSidebarStartRef.current) {
        const rect = itemEl.getBoundingClientRect();
        const isAfter = (touch.clientY - rect.top) > rect.height / 2;
        setSidebarDragOverIndex(targetIdx);
        setSidebarDropPosition(isAfter ? "after" : "before");
      }
    }
  };

  const handleSidebarTouchEnd = () => {
    const fromIdx = touchSidebarStartRef.current;
    if (fromIdx !== null && sidebarDragOverIndex !== null && fromIdx !== sidebarDragOverIndex && onReorderBlocks) {
      let targetIndex: number;
      if (sidebarDropPosition === "before") {
        targetIndex = fromIdx < sidebarDragOverIndex ? sidebarDragOverIndex - 1 : sidebarDragOverIndex;
      } else {
        targetIndex = fromIdx < sidebarDragOverIndex ? sidebarDragOverIndex : sidebarDragOverIndex + 1;
      }
      onReorderBlocks(fromIdx, targetIndex);
      if (navigator.vibrate) {
        try { navigator.vibrate([25, 30, 25]); } catch (_) {}
      }
    }
    touchSidebarStartRef.current = null;
    isSidebarHandleDraggingRef.current = false;
    setSidebarDragIndex(null);
    setSidebarDragOverIndex(null);
    setSidebarDropPosition(null);
  };

  const variableMap = useMemo(() => {
    return buildVariableMap(contract, companySettings);
  }, [contract, companySettings]);

  // Search filter across blocks
  const filteredBlocks = useMemo(() => {
    if (!searchTerm.trim()) return contract.blocks;
    const term = searchTerm.toLowerCase();
    return contract.blocks.filter((b) => {
      const titleMatch = (b.clauseTitle || "").toLowerCase().includes(term);
      const contentMatch = (b.content || "").toLowerCase().includes(term);
      const categoryMatch = (b.sectionCategory || "").toLowerCase().includes(term);
      return titleMatch || contentMatch || categoryMatch;
    });
  }, [contract.blocks, searchTerm]);

  // Categories for dynamic variables
  const variableCategories = [
    { id: "all", label: "Todos os Campos" },
    { id: "imovel", label: "Imóvel" },
    { id: "locador", label: "Locador" },
    { id: "locatario", label: "Locatário" },
    { id: "fiador", label: "Fiador" },
    { id: "comercial", label: "Condições & Valores" },
    { id: "prazos", label: "Prazos & Datas" },
    { id: "imobiliaria", label: "Imobiliária" }
  ];

  const filteredVariables = useMemo(() => {
    return DYNAMIC_VARIABLES_CATALOG.filter((v) => {
      if (selectedVarCategory !== "all" && v.category !== selectedVarCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          v.label.toLowerCase().includes(term) ||
          v.key.toLowerCase().includes(term) ||
          v.description.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [selectedVarCategory, searchTerm]);

  const handleCopyTag = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  if (isCollapsed) {
    return (
      <aside className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-3 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
          title="Expandir painel lateral"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setActiveTab("estrutura"); onToggleCollapse(); }}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
          title="Estrutura do documento"
        >
          <ListTree className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setActiveTab("variaveis"); onToggleCollapse(); }}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
          title="Campos automáticos"
        >
          <Variable className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setActiveTab("elementos"); onToggleCollapse(); }}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
          title="Elementos"
        >
          <PlusSquare className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setActiveTab("design"); onToggleCollapse(); }}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
          title="Design do documento"
        >
          <Palette className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setActiveTab("versoes"); onToggleCollapse(); }}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
          title="Histórico de versões"
        >
          <History className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full overflow-hidden select-none">
      {/* Sidebar Header & Tab selector */}
      <div className="border-b border-slate-200 p-2 shrink-0 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Navegação & Ferramentas
          </span>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded cursor-pointer transition-colors"
            title="Recolher painel"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="grid grid-cols-5 gap-1 bg-slate-200/70 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("estrutura")}
            className={`py-1.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === "estrutura" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Estrutura de Seções e Cláusulas"
          >
            <ListTree className="w-3.5 h-3.5 mb-0.5" />
            <span>Índice</span>
          </button>

          <button
            onClick={() => setActiveTab("variaveis")}
            className={`py-1.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === "variaveis" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Campos Automáticos do Cadastro"
          >
            <Variable className="w-3.5 h-3.5 mb-0.5" />
            <span>Dados</span>
          </button>

          <button
            onClick={() => setActiveTab("elementos")}
            className={`py-1.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === "elementos" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Inserir Blocos e Cláusulas"
          >
            <PlusSquare className="w-3.5 h-3.5 mb-0.5" />
            <span>Blocos</span>
          </button>

          <button
            onClick={() => setActiveTab("design")}
            className={`py-1.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === "design" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Personalização Visual Canva"
          >
            <Palette className="w-3.5 h-3.5 mb-0.5" />
            <span>Design</span>
          </button>

          <button
            onClick={() => setActiveTab("versoes")}
            className={`py-1.5 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              activeTab === "versoes" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Histórico de Versões e Recuperação"
          >
            <History className="w-3.5 h-3.5 mb-0.5" />
            <span>Versões</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Estrutura / Índice */}
      {activeTab === "estrutura" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search inside contract */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar cláusula ou palavra..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="text-[10px] text-slate-400 mt-1 pl-1">
                {filteredBlocks.length} correspondência(s) encontrada(s)
              </p>
            )}
          </div>

          {/* Section Items Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredBlocks.map((block, idx) => {
              const originalIndex = contract.blocks.findIndex((b) => b.id === block.id);
              const isActive = activeBlockId === block.id;
              const isClause = block.type === "clause";
              const isDraggingThis = sidebarDragIndex === originalIndex;
              const isTargetThis = sidebarDragOverIndex === originalIndex && sidebarDragIndex !== originalIndex;

              const label = isClause
                ? `Cláusula ${block.clauseNumber || originalIndex + 1}ª - ${block.clauseTitle || "Sem título"}`
                : block.clauseTitle || (block.type === "title" ? "Título Principal" : block.type === "subtitle" ? "Subtítulo" : block.type === "signatures" ? "Assinaturas & Testemunhas" : block.type === "parties" ? "Identificação das Partes" : "Parágrafo");

              return (
                <div key={block.id} className="relative">
                  {/* Drop indicator before */}
                  {isTargetThis && sidebarDropPosition === "before" && (
                    <div className="py-1">
                      <div className="h-1.5 bg-blue-600 rounded-full shadow-sm animate-pulse flex items-center justify-center">
                        <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                          Inserir acima
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    data-sidebar-block-index={originalIndex}
                    onDragOver={(e) => {
                      if (sidebarDragIndex === null || !isSidebarHandleDraggingRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isAfter = (e.clientY - rect.top) > rect.height / 2;
                      setSidebarDragOverIndex(originalIndex);
                      setSidebarDropPosition(isAfter ? "after" : "before");
                    }}
                    onDragLeave={(e) => {
                      const related = e.relatedTarget as Node | null;
                      if (!e.currentTarget.contains(related)) {
                        if (sidebarDragOverIndex === originalIndex) {
                          setSidebarDragOverIndex(null);
                          setSidebarDropPosition(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      if (sidebarDragIndex === null || !isSidebarHandleDraggingRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (sidebarDragIndex !== originalIndex && onReorderBlocks) {
                        let targetIndex: number;
                        if (sidebarDropPosition === "before") {
                          targetIndex = sidebarDragIndex < originalIndex ? originalIndex - 1 : originalIndex;
                        } else {
                          targetIndex = sidebarDragIndex < originalIndex ? originalIndex : originalIndex + 1;
                        }
                        onReorderBlocks(sidebarDragIndex, targetIndex);
                      }
                      isSidebarHandleDraggingRef.current = false;
                      setSidebarDragIndex(null);
                      setSidebarDragOverIndex(null);
                      setSidebarDropPosition(null);
                    }}
                    onClick={() => onSelectBlock(block.id)}
                    className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                      isDraggingThis
                        ? "opacity-40 border-dashed border-blue-400 bg-blue-50/50"
                        : isActive
                        ? "bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs font-semibold"
                        : "hover:bg-slate-50 border-transparent text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Drag handle: mouse + touch */}
                      <div
                        draggable
                        onDragStart={(e) => {
                          isSidebarHandleDraggingRef.current = true;
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("application/x-contract-block", originalIndex.toString());
                          e.dataTransfer.setData("text/plain", originalIndex.toString());
                          setSidebarDragIndex(originalIndex);
                          onSelectBlock(block.id);
                        }}
                        onDragEnd={() => {
                          isSidebarHandleDraggingRef.current = false;
                          setSidebarDragIndex(null);
                          setSidebarDragOverIndex(null);
                          setSidebarDropPosition(null);
                        }}
                        onTouchStart={(e) => handleSidebarTouchStart(originalIndex, e)}
                        onTouchMove={handleSidebarTouchMove}
                        onTouchEnd={handleSidebarTouchEnd}
                        onTouchCancel={handleSidebarTouchEnd}
                        style={{ touchAction: "none" }}
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 p-0.5 rounded touch-none"
                        title="Segure e arraste para reposicionar no contrato (mouse ou toque)"
                      >
                        <GripVertical className="w-3.5 h-3.5 shrink-0" />
                      </div>
                      <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono shrink-0 bg-slate-100 text-slate-600 group-hover:bg-slate-200 select-none">
                        {isClause ? `${block.clauseNumber || originalIndex + 1}ª` : originalIndex + 1}
                      </span>
                      <span className="truncate text-left text-xs leading-tight select-none">
                        {label}
                      </span>
                    </div>

                    {/* Actions on hover or selection (Mobile friendly) */}
                    <div className={`${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} flex items-center gap-0.5 shrink-0 transition-opacity`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveBlock(originalIndex, "up");
                        }}
                        disabled={originalIndex === 0}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 rounded hover:bg-slate-100 cursor-pointer"
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveBlock(originalIndex, "down");
                        }}
                        disabled={originalIndex === contract.blocks.length - 1}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 rounded hover:bg-slate-100 cursor-pointer"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateBlock(block.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                        title="Duplicar"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {!block.isLocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBlock(block.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
                          title="Excluir cláusula"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Drop indicator after */}
                  {isTargetThis && sidebarDropPosition === "after" && (
                    <div className="py-1">
                      <div className="h-1.5 bg-blue-600 rounded-full shadow-sm animate-pulse flex items-center justify-center">
                        <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                          Inserir abaixo
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick add clause button */}
          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => onAddBlock("clause")}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Cláusula
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Campos Automáticos */}
      {activeTab === "variaveis" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category Chips */}
          <div className="p-2 border-b border-slate-100 flex gap-1 overflow-x-auto custom-scrollbar shrink-0">
            {variableCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedVarCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedVarCategory === cat.id
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Variable list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {filteredVariables.map((v) => {
              const currentVal = variableMap[v.key];
              const isFilled = currentVal && !currentVal.startsWith("{{") && currentVal !== "___" && currentVal !== "Não informado";

              return (
                <div
                  key={v.key}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition-all text-xs group"
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{v.label}</div>
                      <div className="text-[10px] font-mono text-amber-700 font-semibold">{`{{${v.key}}}`}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyTag(v.key)}
                        className="p-1 text-slate-400 hover:text-amber-800 rounded bg-slate-50 hover:bg-amber-50 cursor-pointer"
                        title="Copiar tag {{...}}"
                      >
                        {copiedKey === v.key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onInsertVariable(`{{${v.key}}}`)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 rounded border border-amber-200 cursor-pointer transition-colors"
                        title="Inserir no documento"
                      >
                        Inserir
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-1.5 leading-snug">
                    {v.description}
                  </p>

                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium">Valor cadastrado:</span>
                    <span className={`font-semibold truncate max-w-[150px] ${isFilled ? "text-slate-900" : "text-amber-600 italic"}`}>
                      {isFilled ? currentVal : "Pendente no cadastro"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Elementos & Blocos */}
      {activeTab === "elementos" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Blocos Disponíveis
          </div>

          <button
            onClick={() => onAddBlock("clause")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
              §
            </div>
            <div>
              <div className="font-bold text-slate-900 group-hover:text-blue-700">Cláusula Numerada</div>
              <p className="text-[11px] text-slate-500">
                Insere uma cláusula com numeração automática sequencial (ex: Cláusula 5ª).
              </p>
            </div>
          </button>

          <button
            onClick={() => onAddBlock("paragraph")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 group-hover:text-blue-700">Parágrafo Jurídico</div>
              <p className="text-[11px] text-slate-500">
                Texto corrido com justificação profissional e variáveis dinâmicas.
              </p>
            </div>
          </button>

          <button
            onClick={() => onAddBlock("parties")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <BookmarkCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 group-hover:text-blue-700">Quadro de Qualificação</div>
              <p className="text-[11px] text-slate-500">
                Bloco de identificação das partes contratantes (Locador, Locatário, Fiadores).
              </p>
            </div>
          </button>

          <button
            onClick={() => onAddBlock("divider")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Minus className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 group-hover:text-blue-700">Linha Divisória</div>
              <p className="text-[11px] text-slate-500">
                Divisor estético para separar seções do contrato.
              </p>
            </div>
          </button>

          <button
            onClick={() => onAddBlock("signatures")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 group-hover:text-blue-700">Bloco de Assinaturas</div>
              <p className="text-[11px] text-slate-500">
                Linhas e campos para assinatura das partes e testemunhas.
              </p>
            </div>
          </button>

          <button
            onClick={() => onAddBlock("page_break")}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 group-hover:text-blue-700">Quebra de Página</div>
              <p className="text-[11px] text-slate-500">
                Força o conteúdo seguinte a iniciar no topo da próxima folha A4.
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Tab 4: Design & Estilo (Canva) */}
      {activeTab === "design" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar text-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Personalização do Documento
          </div>

          {/* Cabeçalho e Rodapé */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-800">Cabeçalho & Rodapé</div>
            
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={contract.styleSettings.showHeader}
                onChange={(e) => onUpdateStyle({ showHeader: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Exibir cabeçalho com logotipo da imobiliária</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={contract.styleSettings.showFooter}
                onChange={(e) => onUpdateStyle({ showFooter: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Exibir rodapé com informações de contato</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={contract.styleSettings.showPageNumbers}
                onChange={(e) => onUpdateStyle({ showPageNumbers: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Numeração de páginas (ex: Página 1 de 4)</span>
            </label>
          </div>

          {/* Marca d'água */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-800">Marca d'Água</div>
            
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={contract.styleSettings.showWatermark}
                onChange={(e) => onUpdateStyle({ showWatermark: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Aplicar carimbo em diagonal</span>
            </label>

            {contract.styleSettings.showWatermark && (
              <div className="pt-1">
                <input
                  type="text"
                  value={contract.styleSettings.watermarkText || "MINUTA"}
                  onChange={(e) => onUpdateStyle({ watermarkText: e.target.value.toUpperCase() })}
                  placeholder="Texto (ex: MINUTA, RASCUNHO)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none uppercase"
                />
              </div>
            )}
          </div>

          {/* Cores Institucionais */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-800">Cores dos Títulos</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={contract.styleSettings.primaryColor || "#1e3a8a"}
                onChange={(e) => onUpdateStyle({ primaryColor: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300"
              />
              <span className="font-mono text-[11px] text-slate-600">
                {contract.styleSettings.primaryColor || "#1e3a8a"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Versões */}
      {activeTab === "versoes" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar text-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Histórico de Alterações
          </div>

          {(!contract.versoes || contract.versoes.length === 0) ? (
            <div className="text-center py-8 text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma versão anterior arquivada ainda.</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Versões são criadas a cada salvamento relevante.
              </p>
            </div>
          ) : (
            contract.versoes.map((v) => (
              <div
                key={v.id}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">
                    Versão #{v.versionNumber}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {v.description || "Modificação de cláusulas e formatação"}
                </p>
                <div className="text-[10px] text-slate-400">
                  Por: {v.createdByName || "Usuário"}
                </div>
                <button
                  onClick={() => onRestoreVersion(v)}
                  className="w-full py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 hover:text-blue-800 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar esta versão
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
