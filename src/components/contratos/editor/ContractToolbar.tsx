import React, { useState } from "react";
import { 
  ArrowLeft, 
  Save, 
  RotateCcw, 
  RotateCw, 
  Printer, 
  FileDown, 
  Send, 
  Maximize2, 
  Minimize2, 
  Eye, 
  Edit3, 
  Columns, 
  Check, 
  Loader2, 
  AlertCircle,
  BookmarkPlus,
  Variable,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { ContratoLocacao, ContractStyleSettings } from "../types/contractTypes";
import { DYNAMIC_VARIABLES_CATALOG } from "../utils/contractVariableResolver";

interface ContractToolbarProps {
  contract: ContratoLocacao;
  saveStatus: "salvo" | "salvando" | "pendente";
  lastSavedAt: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveManual: () => void;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  viewMode: "editor" | "preview" | "split";
  setViewMode: (v: "editor" | "preview" | "split") => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBack: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  onOpenSignatures: () => void;
  onSaveAsTemplate: () => void;
  onOpenVariableModal: () => void;
  onUpdateStyle: (newStyles: Partial<ContractStyleSettings>) => void;
  onInsertVariableText: (tagKey: string) => void;
  highlightVariables: boolean;
  onToggleHighlightVariables: () => void;
  onAddClause: () => void;
  onUpdateTitle: (title: string) => void;
}

export const ContractToolbar: React.FC<ContractToolbarProps> = ({
  contract,
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveManual,
  zoomLevel,
  setZoomLevel,
  viewMode,
  setViewMode,
  isFullscreen,
  onToggleFullscreen,
  onBack,
  onPrint,
  onExportPdf,
  onOpenSignatures,
  onSaveAsTemplate,
  onOpenVariableModal,
  onUpdateStyle,
  onInsertVariableText,
  highlightVariables,
  onToggleHighlightVariables,
  onAddClause,
  onUpdateTitle
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(contract.titulo);
  const [isVariablesDropdownOpen, setIsVariablesDropdownOpen] = useState(false);

  const styles = contract.styleSettings;

  const handleFinishEditingTitle = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    } else {
      setTitleInput(contract.titulo);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40">
      {/* 1. Top Primary Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-slate-100">
        {/* Left: Back & Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Voltar para a lista de contratos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleFinishEditingTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleFinishEditingTitle()}
                  autoFocus
                  className="text-sm font-bold text-slate-900 border border-blue-400 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-200"
                />
              ) : (
                <button
                  onClick={() => {
                    setTitleInput(contract.titulo);
                    setIsEditingTitle(true);
                  }}
                  className="text-sm font-bold text-slate-900 truncate hover:text-blue-600 transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                  title="Clique para renomear"
                >
                  <span className="truncate">{contract.titulo}</span>
                  <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <span className="bg-blue-50 text-blue-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 border border-blue-100">
                {contract.numeroContrato || "LOC-2026"}
              </span>
            </div>

            {/* Auto-save status feedback */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              {saveStatus === "salvando" && (
                <span className="flex items-center gap-1 text-blue-600 font-medium animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Salvando alterações...
                </span>
              )}
              {saveStatus === "salvo" && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Check className="w-3 h-3" />
                  Salvo no sistema {lastSavedAt ? `às ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
                </span>
              )}
              {saveStatus === "pendente" && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Alterações não salvas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Undo/Redo & Zoom & View Mode */}
        <div className="flex items-center gap-2">
          {/* History (Undo/Redo: visible on mobile, tablet and desktop) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 rounded cursor-pointer transition-colors"
              title="Desfazer (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 rounded cursor-pointer transition-colors"
              title="Refazer (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden lg:block h-4 w-px bg-slate-200" />

          {/* Zoom controls (hidden on small screens, shown on desktop) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 15))}
              className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
              title="Reduzir zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700 min-w-10 text-center select-none font-mono">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(160, zoomLevel + 15))}
              className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="text-[10px] text-blue-600 font-bold ml-1 hover:underline cursor-pointer"
              title="Restaurar zoom 100%"
            >
              100%
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* View Modes */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode("editor")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                viewMode === "editor" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Edit3 className="w-3 h-3" />
              Editor
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                viewMode === "preview" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3 h-3" />
              Visualizar
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                viewMode === "split" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Columns className="w-3 h-3" />
              Lado a Lado
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSaveManual}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all cursor-pointer"
            title="Salvar agora"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Salvar</span>
          </button>

          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all cursor-pointer"
            title="Imprimir contrato em folha A4"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Imprimir</span>
          </button>

          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all cursor-pointer"
            title="Gerar PDF para download"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Gerar PDF</span>
          </button>

          <button
            onClick={onOpenSignatures}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-xl transition-all cursor-pointer"
            title="Assinatura digital e link com signatários"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Assinaturas</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title={isFullscreen ? "Sair da tela cheia" : "Modo Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Secondary Formatting Ribbon (Canva / Docs Style) */}
      <div className="px-4 py-2 bg-slate-50/80 flex items-center justify-between gap-3 overflow-x-auto text-xs">
        <div className="flex items-center gap-2 shrink-0">
          {/* Font Family */}
          <select
            value={styles.fontFamily}
            onChange={(e) => onUpdateStyle({ fontFamily: e.target.value as any })}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 outline-none hover:border-slate-400 focus:ring-1 focus:ring-blue-500"
          >
            <option value="Inter">Inter (Moderna)</option>
            <option value="Merriweather">Merriweather (Jurídica Serif)</option>
            <option value="Lora">Lora (Clássica)</option>
            <option value="Roboto">Roboto (Clean)</option>
            <option value="Times New Roman">Times New Roman (Tradicional)</option>
            <option value="Playfair Display">Playfair Display (Sofisticada)</option>
          </select>

          {/* Font Size */}
          <select
            value={styles.fontSizePt}
            onChange={(e) => onUpdateStyle({ fontSizePt: Number(e.target.value) })}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 outline-none hover:border-slate-400"
          >
            <option value={10}>10 pt</option>
            <option value={11}>11 pt (Padrão)</option>
            <option value={12}>12 pt</option>
            <option value={14}>14 pt</option>
          </select>

          <div className="h-4 w-px bg-slate-300" />

          {/* Line spacing */}
          <select
            value={styles.lineSpacing}
            onChange={(e) => onUpdateStyle({ lineSpacing: Number(e.target.value) })}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 outline-none hover:border-slate-400"
            title="Espaçamento entre linhas"
          >
            <option value={1.15}>1.15x</option>
            <option value={1.35}>1.35x (Ideal)</option>
            <option value={1.5}>1.5x (Amplo)</option>
            <option value={2.0}>2.0x (Duplo)</option>
          </select>

          {/* Page Margins */}
          <select
            value={styles.marginType}
            onChange={(e) => onUpdateStyle({ marginType: e.target.value as any })}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 outline-none hover:border-slate-400"
            title="Margens da página A4"
          >
            <option value="padrao">Margem Padrão (25mm)</option>
            <option value="estreita">Margem Estreita (15mm)</option>
            <option value="ampla">Margem Ampla (30mm)</option>
          </select>

          <div className="h-4 w-px bg-slate-300" />

          {/* Primary Color Picker */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1" title="Cor dos títulos e divisores">
            <span className="text-[10px] text-slate-500 font-medium">Cor:</span>
            <input
              type="color"
              value={styles.primaryColor || "#1e3a8a"}
              onChange={(e) => onUpdateStyle({ primaryColor: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer border-0 p-0"
            />
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Add Clause Button */}
          <button
            onClick={onAddClause}
            className="flex items-center gap-1 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer"
            title="Inserir nova cláusula com numeração automática"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Cláusula</span>
          </button>
        </div>

        {/* Right side of ribbon: Dynamic variables & template shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Variable Picker Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsVariablesDropdownOpen(!isVariablesDropdownOpen)}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer"
              title="Inserir campo dinâmico do cadastro"
            >
              <Variable className="w-3.5 h-3.5 text-amber-700" />
              <span>Inserir Campo</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isVariablesDropdownOpen && (
              <div 
                className="absolute right-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2"
                onMouseLeave={() => setIsVariablesDropdownOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Campos Mais Utilizados
                </div>
                {DYNAMIC_VARIABLES_CATALOG.slice(0, 10).map((v) => (
                  <button
                    key={v.key}
                    onClick={() => {
                      onInsertVariableText(`{{${v.key}}}`);
                      setIsVariablesDropdownOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-amber-50 rounded-lg text-xs font-medium text-slate-700 hover:text-amber-900 flex flex-col cursor-pointer transition-colors"
                  >
                    <span className="font-semibold">{v.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{`{{${v.key}}}`}</span>
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setIsVariablesDropdownOpen(false);
                      onOpenVariableModal();
                    }}
                    className="w-full text-center text-xs text-blue-600 font-bold py-1 hover:underline cursor-pointer"
                  >
                    Ver todos os campos (Catálogo Completo)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Highlight Variables in Preview */}
          <button
            onClick={onToggleHighlightVariables}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer border ${
              highlightVariables 
                ? "bg-amber-100 text-amber-900 border-amber-300" 
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
            }`}
            title="Destaca visualmente onde estão os campos automáticos dentro das páginas"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span>Destacar Tags</span>
          </button>

          {/* Save as Template */}
          <button
            onClick={onSaveAsTemplate}
            className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
            title="Salvar este contrato como modelo padrão reutilizável"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Salvar Modelo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
