import React, { useState } from "react";
import { X, BookmarkPlus, Check, Sparkles } from "lucide-react";
import { ContratoLocacao, ContratoModelo } from "../types/contractTypes";
import { toast } from "sonner";

interface TemplatesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ContratoLocacao;
  onSaveTemplate: (newTemplate: Omit<ContratoModelo, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export const TemplatesManagerModal: React.FC<TemplatesManagerModalProps> = ({
  isOpen,
  onClose,
  contract,
  onSaveTemplate
}) => {
  const [nome, setNome] = useState(`${contract.titulo} (Modelo)`);
  const [descricao, setDescricao] = useState("Modelo personalizado com cláusulas adaptadas para locações da imobiliária.");
  const [categoria, setCategoria] = useState(contract.tipoLocacao === "comercial" ? "Comercial" : "Residencial");
  const [isPadrao, setIsPadrao] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe um nome para o modelo.");
      return;
    }

    setIsSaving(true);
    try {
      await onSaveTemplate({
        companyId: contract.companyId,
        nome: nome.trim(),
        descricao: descricao.trim(),
        tipoLocacao: contract.tipoLocacao,
        isPadrao,
        categoria,
        blocks: contract.blocks,
        styleSettings: contract.styleSettings,
        criadoPorUid: contract.criadoPorUid,
        criadoPorNome: contract.criadoPorNome
      });
      toast.success("Novo modelo de contrato salvo com sucesso!");
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar modelo:", err);
      toast.error("Erro ao salvar modelo no banco de dados.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-black text-slate-900">
              Salvar como Modelo de Contrato
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nome do Modelo*
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Contrato Residencial Padrão Fidelité 2026"
              className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-medium outline-none"
            >
              <option value="Residencial">Residencial</option>
              <option value="Comercial">Comercial</option>
              <option value="Garantia Digital">Garantia Digital (CredPago)</option>
              <option value="Temporada">Temporada</option>
              <option value="Personalizado">Personalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Descrição do Modelo
            </label>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva quando este modelo deve ser aplicado..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 outline-none resize-none"
            />
          </div>

          <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={isPadrao}
              onChange={(e) => setIsPadrao(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-slate-800">Definir como modelo padrão para novos contratos</span>
              <p className="text-[10px] text-slate-500">
                Será sugerido como primeira opção ao iniciar uma nova locação.
              </p>
            </div>
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Salvar Modelo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
