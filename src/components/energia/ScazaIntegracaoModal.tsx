import React, { useEffect, useState } from "react";
import { X, Copy, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { auth } from "../../firebase";

interface EventoScaza {
  id: string;
  recebidoEm: string;
  topico?: string | null;
  corpo?: any;
  corpoBruto?: string | null;
  assinaturaOk?: boolean | null;
  processado?: boolean;
  motivo?: string | null;
  inquilino?: string | null;
  mesesAtualizados?: string[];
}

interface RespostaScaza {
  configurado: boolean;
  chaveIntegridadeConfigurada: boolean;
  empresaConfigurada?: boolean;
  url: string | null;
  eventos: EventoScaza[];
}

interface Props {
  onClose: () => void;
  companyId?: string;
  locacoes?: { id: string; rotulo: string }[];
}

const TOPICOS_COM_CONTA = ["conta.atualizada", "emissao_boleto.concluida"];

const fmtData = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
};

export const ScazaIntegracaoModal: React.FC<Props> = ({ onClose, companyId, locacoes = [] }) => {
  const [dados, setDados] = useState<RespostaScaza | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [reprocessando, setReprocessando] = useState<string | null>(null);

  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const locacoesOrdenadas = [...locacoes].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const reprocessar = async (id: string, energiaId?: string) => {
    setReprocessando(id);
    try {
      const user = (auth as any).currentUser;
      if (!user) throw new Error("Faça login novamente.");
      const token = await user.getIdToken();
      const r = await fetch("/api/scaza/webhook", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(energiaId ? { acao: "vincular", id, energiaId } : { acao: "reprocessar", id })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
      if (j.processado) toast.success(`Aviso aplicado${j.inquilino ? " em " + j.inquilino : ""}.`);
      else toast.info(j.motivo || "Aviso sem nada para aplicar.");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível processar o aviso.");
    } finally {
      setReprocessando(null);
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const user = (auth as any).currentUser;
      if (!user) throw new Error("Faça login novamente.");
      const token = await user.getIdToken();
      const r = await fetch("/api/scaza/webhook", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error("Seu usuário não tem acesso a esta integração.");
      if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
      setDados(j as RespostaScaza);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível consultar a integração.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar"));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold text-zinc-900">Integração Scaza</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-zinc-100" aria-label="Fechar">
            <X className="w-5 h-5 text-zinc-600" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {erro && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2">{erro}</div>
          )}

          {dados && (
            <>
              <section className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-zinc-900">
                  {dados.configurado
                    ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Recebimento ativo</>
                    : <><AlertTriangle className="w-4 h-4 text-amber-600" /> Falta configurar na Vercel</>}
                </div>
                {dados.configurado && dados.url ? (
                  <>
                    <p className="text-zinc-600">Cole esta URL na Scaza, em <b>Integrações → URL para webhooks</b>:</p>
                    <div className="flex gap-2">
                      <input readOnly value={dados.url} className="flex-1 h-10 px-3 rounded-lg border border-zinc-300 bg-zinc-50 font-mono text-xs" onFocus={e => e.target.select()} />
                      <button type="button" onClick={() => copiar(dados.url!)} className="h-10 px-3 rounded-lg border border-zinc-300 hover:bg-zinc-50 flex items-center gap-1">
                        <Copy className="w-4 h-4" /> Copiar
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">A URL tem uma chave secreta. Não compartilhe fora da Scaza.</p>
                  </>
                ) : (
                  <p className="text-zinc-600">
                    Crie a variável <code className="px-1 bg-zinc-100 rounded">SCAZA_WEBHOOK_TOKEN</code> nas configurações do projeto na Vercel
                    (um texto aleatório longo) e faça um novo deploy. Depois abra esta tela de novo para pegar a URL.
                  </p>
                )}
                {dados.configurado && dados.empresaConfigurada === false && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 space-y-1">
                    <p>
                      Para os avisos atualizarem as locações, crie na Vercel a variável <code className="px-1 bg-white rounded">SCAZA_COMPANY_ID</code> (tipo Config) com o valor abaixo e faça um Redeploy.
                    </p>
                    {companyId && (
                      <div className="flex gap-2">
                        <input readOnly value={companyId} className="flex-1 h-9 px-3 rounded-lg border border-amber-300 bg-white font-mono text-xs" onFocus={e => e.target.select()} />
                        <button type="button" onClick={() => copiar(companyId)} className="h-9 px-3 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 flex items-center gap-1 text-xs">
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!dados.chaveIntegridadeConfigurada && dados.configurado && (
                  <p className="text-xs text-zinc-500">
                    Opcional: a chave de autenticação que a Scaza mostra para verificar os webhooks pode ser salva na Vercel como <code className="px-1 bg-zinc-100 rounded">SCAZA_WEBHOOK_SECRET</code>.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-zinc-900">Últimos avisos recebidos</h4>
                  <button type="button" onClick={carregar} disabled={carregando} className="text-xs flex items-center gap-1 text-zinc-600 hover:text-zinc-900 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar
                  </button>
                </div>
                {dados.eventos.length === 0 ? (
                  <p className="text-zinc-500">Nenhum aviso recebido ainda.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg">
                    {dados.eventos.map(ev => (
                      <li key={ev.id} className="px-3 py-2">
                        <button type="button" className="w-full flex items-center justify-between text-left" onClick={() => setAberto(aberto === ev.id ? null : ev.id)}>
                          <span className="text-zinc-800">{ev.topico || "Aviso"}</span>
                          <span className="text-xs text-zinc-500">{fmtData(ev.recebidoEm)}</span>
                        </button>
                        <p className={`mt-0.5 text-xs ${ev.processado ? "text-emerald-700" : "text-zinc-500"}`}>
                          {ev.processado
                            ? `Aplicado${ev.inquilino ? " em " + ev.inquilino : ""}${ev.mesesAtualizados?.length ? " · meses " + ev.mesesAtualizados.map(m => m.split("-").reverse().join("/")).join(", ") : ""}`
                            : ev.motivo || "Não aplicado"}
                          {ev.processado && ev.motivo ? ` · ${ev.motivo}` : ""}
                        </p>
                        {aberto === ev.id && TOPICOS_COM_CONTA.includes(ev.topico || "") && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => reprocessar(ev.id)}
                              disabled={reprocessando === ev.id}
                              className="h-8 px-3 rounded-lg border border-zinc-300 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {reprocessando === ev.id ? "Processando…" : "Processar de novo"}
                            </button>
                            {!ev.processado && locacoesOrdenadas.length > 0 && (
                              <>
                                <select
                                  aria-label="Locação para vincular"
                                  value={escolha[ev.id] || ""}
                                  onChange={e => setEscolha(prev => ({ ...prev, [ev.id]: e.target.value }))}
                                  className="h-8 max-w-[260px] px-2 rounded-lg border border-zinc-300 text-xs bg-white"
                                >
                                  <option value="">Vincular a uma locação…</option>
                                  {locacoesOrdenadas.map(l => <option key={l.id} value={l.id}>{l.rotulo}</option>)}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => reprocessar(ev.id, escolha[ev.id])}
                                  disabled={!escolha[ev.id] || reprocessando === ev.id}
                                  className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-40"
                                >
                                  Vincular e aplicar
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {aberto === ev.id && (
                          <pre className="mt-2 max-h-64 overflow-auto bg-zinc-50 rounded p-2 text-[11px] leading-snug whitespace-pre-wrap break-all">
                            {ev.corpo ? JSON.stringify(ev.corpo, null, 2) : (ev.corpoBruto || "(vazio)")}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {!dados && !erro && <p className="text-zinc-500">Carregando…</p>}
        </div>
      </div>
    </div>
  );
};
