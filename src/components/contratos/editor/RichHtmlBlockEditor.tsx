import React, { useRef, useEffect, useCallback, useState } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  RemoveFormatting, 
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignJustify
} from "lucide-react";

interface RichHtmlBlockEditorProps {
  blockId: string;
  initialHtml: string;
  onChange: (newHtml: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  showToolbar?: boolean;
  primaryColor?: string;
  readOnly?: boolean;
}

/**
 * RichHtmlBlockEditor
 * Provides authentic WYSIWYG rich text editing for contract clauses, paragraphs, and parties.
 * HTML tags like <p>, <strong>, <em>, <ul> never appear as raw text during editing.
 * Preserves cursor focus, drag-and-drop safety, dynamic variables, and clean HTML output.
 */
export const RichHtmlBlockEditor: React.FC<RichHtmlBlockEditorProps> = ({
  blockId,
  initialHtml,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Digite o conteúdo da cláusula...",
  minHeight = "70px",
  className = "",
  showToolbar = true,
  primaryColor = "#1e3a8a",
  readOnly = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef<boolean>(false);
  const lastHtmlRef = useRef<string>(initialHtml || "");
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    orderedList: false
  });

  // Helper to normalize HTML to avoid unnecessary updates
  const normalizeHtml = (html: string): string => {
    return html.trim();
  };

  // Sync external HTML changes (e.g. Undo/Redo or variable insertion) into the editable element
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    // Only update innerHTML if it came from outside and differs from current editor DOM
    if (!isTypingRef.current && normalizeHtml(el.innerHTML) !== normalizeHtml(initialHtml || "")) {
      el.innerHTML = initialHtml || "";
      lastHtmlRef.current = initialHtml || "";
    }
    isTypingRef.current = false;
  }, [initialHtml, blockId]);

  // Check which formatting states (bold, italic, etc.) are active at the current cursor selection
  const updateActiveFormats = useCallback(() => {
    if (readOnly) return;
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        list: document.queryCommandState("insertUnorderedList"),
        orderedList: document.queryCommandState("insertOrderedList")
      });
    } catch (_) {
      // Ignore queryCommandState errors in unsupported environments
    }
  }, [readOnly]);

  // Handle user typing and content change
  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;

    isTypingRef.current = true;
    const currentHtml = el.innerHTML;
    lastHtmlRef.current = currentHtml;
    onChange(currentHtml);
    updateActiveFormats();
  };

  // Execute formatting commands
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    const el = editorRef.current;
    if (!el || readOnly) return;

    el.focus();
    document.execCommand(command, false, value);
    handleInput();
    updateActiveFormats();
  };

  // Clean paste: strips messy Word/web inline styles and pastes clean text/paragraphs
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    // Convert newlines to clean paragraphs
    const paragraphs = text
      .split(/\r?\n\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length <= 1) {
      document.execCommand("insertText", false, text);
    } else {
      const htmlToInsert = paragraphs.map((p) => `<p>${p}</p>`).join("");
      document.execCommand("insertHTML", false, htmlToInsert);
    }
    handleInput();
  };

  return (
    <div 
      className="relative flex flex-col group/editor w-full"
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Floating mini-toolbar for formatting when active */}
      {showToolbar && !readOnly && (
        <div 
          className="flex items-center gap-0.5 p-1 mb-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 shadow-xs select-none z-20 shrink-0 self-start"
          onMouseDown={(e) => e.preventDefault()} // Prevent losing focus when clicking formatting buttons
        >
          {/* Bold */}
          <button
            type="button"
            onClick={() => executeCommand("bold")}
            className={`p-1 rounded cursor-pointer transition-colors ${
              activeFormats.bold ? "bg-blue-600 text-white" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Negrito (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => executeCommand("italic")}
            className={`p-1 rounded cursor-pointer transition-colors ${
              activeFormats.italic ? "bg-blue-600 text-white" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Itálico (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => executeCommand("underline")}
            className={`p-1 rounded cursor-pointer transition-colors ${
              activeFormats.underline ? "bg-blue-600 text-white" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Sublinhado (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-300 mx-0.5" />

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => executeCommand("insertUnorderedList")}
            className={`p-1 rounded cursor-pointer transition-colors ${
              activeFormats.list ? "bg-blue-600 text-white" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Lista com marcadores"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          {/* Numbered List */}
          <button
            type="button"
            onClick={() => executeCommand("insertOrderedList")}
            className={`p-1 rounded cursor-pointer transition-colors ${
              activeFormats.orderedList ? "bg-blue-600 text-white" : "hover:bg-slate-200 text-slate-700"
            }`}
            title="Lista numerada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-300 mx-0.5" />

          {/* Align Justify */}
          <button
            type="button"
            onClick={() => executeCommand("justifyFull")}
            className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            title="Alinhar Justificado"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>

          {/* Align Left */}
          <button
            type="button"
            onClick={() => executeCommand("justifyLeft")}
            className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            title="Alinhar à Esquerda"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>

          {/* Align Center */}
          <button
            type="button"
            onClick={() => executeCommand("justifyCenter")}
            className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            title="Alinhar ao Centro"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-300 mx-0.5" />

          {/* Remove formatting */}
          <button
            type="button"
            onClick={() => executeCommand("removeFormat")}
            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            title="Limpar formatação do texto selecionado"
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editable HTML Canvas */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        onFocus={() => {
          document.execCommand("defaultParagraphSeparator", false, "p");
          onFocus?.();
          updateActiveFormats();
        }}
        onBlur={() => {
          isTypingRef.current = false;
          onBlur?.();
        }}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={`rich-html-editor text-justify outline-none transition-all select-text cursor-text leading-relaxed font-inherit ${
          !readOnly 
            ? "focus:ring-2 focus:ring-blue-400/50 p-2.5 bg-white border border-blue-200 rounded-lg shadow-xs" 
            : ""
        } ${className}`}
      />

      {/* Bottom helper tip when editing */}
      {showToolbar && !readOnly && (
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1 select-none">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Edição visual ativa: o texto em negrito, itálico e listas é exibido formatado.
          </span>
          <span>Pressione <strong>Enter</strong> para novo parágrafo</span>
        </div>
      )}
    </div>
  );
};
