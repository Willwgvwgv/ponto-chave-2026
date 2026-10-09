import React, { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "../../firebase";
import { EnergiaLocacao } from "../../types";
import { maskDoc } from "../../lib/utils";

interface Props {
  energia: EnergiaLocacao;
  onClose: () => void;
}

const soDigitos = (v?: string | null) => String(v || "").replace(/\D/g, "");

export const CadastroScazaModal: React.FC<Props> = ({ energia, onClose }) => {
  const queryClient = useQueryClient();
  const [uc, setUc] = useState(energia.unidadeConsumidora || "");
  const [doc, setDoc] = useState(maskDoc(energia.scaza?.titularCpf || energia.cpf || ""));
  const [nasc, setNasc] = useState(energia.scaza?.titularNascimento || energia.dataNascimento || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehCpf = soDigitos(doc).length <= 11;

  const cadastrar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const user = (auth as any).currentUser;
      if (!user) throw new Error("Faça login novamente.");
      const token = await user.getIdToken();
      const r = await fetch("/api/scaza/webhook", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "cadastrar",
          energiaId: energia.id,
          unidadeConsumidora: uc,
          cpfCnpj: doc,
          nascimento: ehCpf ? nasc || null : null
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
      if (j.jaExistia) toast.success("Essa UC já estava na Scaza. A locação foi ligada a ela.");
      else toast.success("Cadastrada na Scaza.");
      if (j.faturasEmAberto > 0) toast.info(`${j.faturasEmAberto} fatura(s) em aberto encontrada(s).`);
      else toast.info("A Scaza vai consultar a Equatorial; as faturas aparecem aqui assim que ela terminar.");
      queryClient.invalidateQueries({ queryKey: ["energia_locacoes"] });
      onClose();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível cadastrar na Scaza.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={cadastrar} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold text-zinc-900">Cadastrar na Scaza</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-zinc-100" aria-label="Fechar">
            <X className="w-5 h-5 text-zinc-600" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="text-zinc-700">
            <p className="font-medium text-zinc-900">{energia.inquilino}</p>
            <p className="text-zinc-600">{energia.imovel}</p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-700">Unidade consumidora</span>
            <input value={uc} onChange={e => setUc(e.target.value)} required inputMode="numeric"
              className="w-full h-10 px-3 rounded-lg border border-zinc-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-700">CPF/CNPJ do titular da conta de luz</span>
            <input value={doc} onChange={e => setDoc(maskDoc(e.target.value))} required inputMode="numeric"
              className="w-full h-10 px-3 rounded-lg border border-zinc-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
            <span className="text-xs text-zinc-500">Se a conta ainda está no nome do proprietário, use o CPF dele.</span>
          </label>

          {ehCpf && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-700">Data de nascimento do titular</span>
              <input type="date" value={nasc} onChange={e => setNasc(e.target.value)} required
                className="w-full h-10 px-3 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
            </label>
          )}

          <p className="text-xs text-zinc-500">
            Cada imóvel cadastrado conta no plano da Scaza. Se a UC já estiver lá, o sistema só liga a locação, sem duplicar.
          </p>

          {erro && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2">{erro}</div>}
        </div>
        <div className="px-5 py-4 border-t border-zinc-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-zinc-300 text-sm font-medium hover:bg-zinc-50">Cancelar</button>
          <button type="submit" disabled={salvando} className="h-10 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium disabled:opacity-50">
            {salvando ? "Cadastrando…" : "Cadastrar e buscar faturas"}
          </button>
        </div>
      </form>
    </div>
  );
};
