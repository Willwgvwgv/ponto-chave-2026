import React, { useEffect, useState } from "react";
import { Lock, X } from "lucide-react";
import { confirmarIdentidade, metodoConfirmacaoIdentidade } from "../../firebase";

interface Props {
  open: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  onCancelar: () => void;
  /** Chamado só depois que a identidade foi confirmada. Recebe o motivo digitado. */
  onConfirmar: (motivo: string) => void | Promise<void>;
}

const mensagemDeErro = (err: any): string => {
  const code = err?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login")) return "Senha incorreta.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "Confirmação do Google cancelada.";
  if (code.includes("user-mismatch")) return "Use a mesma conta Google com que você entrou no sistema.";
  return err?.message || "Não foi possível confirmar sua identidade.";
};

/**
 * Confirmação forte para ações sobre pagamentos já feitos: pede a senha (ou a
 * confirmação do Google) e um motivo, que fica gravado junto com quem fez.
 */
export function ConfirmarComSenhaModal({ open, titulo, mensagem, textoConfirmar = "Confirmar", onCancelar, onConfirmar }: Props) {
  const [senha, setSenha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const metodo = metodoConfirmacaoIdentidade();

  useEffect(() => {
    if (open) { setSenha(""); setMotivo(""); setErro(""); setEnviando(false); }
  }, [open]);

  if (!open) return null;

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) { setErro("Informe o motivo (mínimo 5 caracteres)."); return; }
    setEnviando(true);
    setErro("");
    try {
      await confirmarIdentidade(metodo === "senha" ? senha : undefined);
      await onConfirmar(motivo.trim());
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4" onClick={onCancelar}>
      <form
        onSubmit={confirmar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Lock className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="font-bold text-slate-900">{titulo}</h3>
          </div>
          <button type="button" onClick={onCancelar} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600">{mensagem}</p>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Motivo</span>
          <textarea
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Ex.: lançado em duplicidade"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"
          />
        </label>

        {metodo === "senha" ? (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase">Sua senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"
            />
          </label>
        ) : (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
            Sua conta entra pelo Google. Ao confirmar, o Google vai pedir que você confirme a conta.
          </p>
        )}

        {erro && <p className="text-sm font-semibold text-red-600" role="alert">{erro}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancelar} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold cursor-pointer"
          >
            {enviando ? "Confirmando..." : textoConfirmar}
          </button>
        </div>
      </form>
    </div>
  );
}
