import React from "react";
import { X, Download, ZoomIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FotoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fotoUrl: string | null;
  titulo?: string;
  subtitulo?: string;
}

export const FotoViewerModal: React.FC<FotoViewerModalProps> = ({
  isOpen,
  onClose,
  fotoUrl,
  titulo = "Foto do Hidrômetro",
  subtitulo
}) => {
  if (!isOpen || !fotoUrl) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-blue-400" />
                {titulo}
              </h3>
              {subtitulo && (
                <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={fotoUrl}
                download={`hidrometro-${Date.now()}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                title="Abrir imagem original"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Baixar</span>
              </a>
              <button
                onClick={onClose}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body with Image */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-black/40 min-h-[300px]">
            <img
              src={fotoUrl}
              alt={titulo}
              className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl shadow-lg border border-slate-800/80"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 text-center">
            <span className="text-[11px] font-medium text-slate-400">
              Comprovante de medição fotográfica do hidrômetro • Fidelité Imobiliária
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
