import * as React from "react";
import { useState } from "react";
import { FileText, X, Download } from "lucide-react";
import { toast } from "sonner";

export type TaskAttachment = { name: string; url: string };

// Os anexos ficam gravados dentro da própria tarefa no Firestore, que aceita no
// máximo 1 MB por documento. Por isso as imagens são reduzidas antes de salvar
// e o total de anexos de uma tarefa tem um teto.
export const LIMITE_TOTAL_ANEXOS = 850 * 1024;
const LIMITE_ARQUIVO_NAO_IMAGEM = 700 * 1024;
const LADO_MAXIMO_IMAGEM = 1600;

export const tamanhoAnexos = (anexos: TaskAttachment[]) =>
  anexos.reduce((soma, a) => soma + (a.url?.length || 0), 0);

export const isImagemAnexo = (url?: string) =>
  !!url && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url);

const lerComoDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const carregarImagem = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const ALVO_POR_IMAGEM = 230 * 1024;

function desenhar(img: HTMLImageElement, ladoMaximo: number) {
  const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
  const largura = Math.max(1, Math.round(img.width * escala));
  const altura = Math.max(1, Math.round(img.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Fundo branco: prints com transparência não ficam pretos ao virar JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(img, 0, 0, largura, altura);
  return canvas;
}

async function comprimirImagem(file: File): Promise<string> {
  const original = await lerComoDataUrl(file);
  const img = await carregarImagem(original);
  let ultimo = original;
  // Tenta manter boa leitura de texto; só reduz mais se ainda estiver pesado.
  for (const lado of [LADO_MAXIMO_IMAGEM, 1280, 1024]) {
    const canvas = desenhar(img, lado);
    if (!canvas) return original;
    for (const qualidade of [0.8, 0.68, 0.55]) {
      ultimo = canvas.toDataURL("image/jpeg", qualidade);
      if (ultimo.length <= ALVO_POR_IMAGEM) return ultimo;
    }
  }
  return ultimo;
}

const nomeParaPrint = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `print-${p(d.getDate())}-${p(d.getMonth() + 1)}-${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}.jpg`;
};

/**
 * Transforma arquivos (escolhidos no computador ou colados com Ctrl+V) em anexos.
 * Imagens são reduzidas; outros arquivos só entram se forem pequenos.
 * Respeita o limite total da tarefa considerando os anexos que já existem.
 */
export async function prepararAnexos(files: File[], existentes: TaskAttachment[]): Promise<TaskAttachment[]> {
  const novos: TaskAttachment[] = [];
  let total = tamanhoAnexos(existentes);
  for (const file of files) {
    try {
      const ehImagem = file.type.startsWith("image/") && file.type !== "image/svg+xml";
      let url: string;
      let nome = file.name || "";
      if (ehImagem) {
        url = file.type === "image/gif" && file.size <= 400 * 1024 ? await lerComoDataUrl(file) : await comprimirImagem(file);
        if (!nome || nome === "image.png") nome = nomeParaPrint();
        else if (!url.startsWith("data:image/gif")) nome = nome.replace(/\.(png|jpe?g|webp|bmp|heic|heif)$/i, "") + ".jpg";
      } else {
        if (file.size > LIMITE_ARQUIVO_NAO_IMAGEM) {
          toast.error(`"${file.name}" é muito grande (máx. 700 KB para PDF/documento).`);
          continue;
        }
        url = await lerComoDataUrl(file);
      }
      if (total + url.length > LIMITE_TOTAL_ANEXOS) {
        toast.error(`Não coube "${nome}": a tarefa já está no limite de anexos.`);
        continue;
      }
      total += url.length;
      novos.push({ name: nome, url });
    } catch {
      toast.error(`Não foi possível ler "${file.name || "imagem"}".`);
    }
  }
  return novos;
}

/** Pega as imagens/arquivos de um evento de colar (Ctrl+V). */
export const arquivosDoColar = (e: React.ClipboardEvent | ClipboardEvent): File[] => {
  const itens = (e as ClipboardEvent).clipboardData?.items;
  if (!itens) return [];
  const arquivos: File[] = [];
  for (const item of Array.from(itens)) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) arquivos.push(f);
    }
  }
  return arquivos;
};

/** Botão "Colar print" para quem não usa Ctrl+V (lê a área de transferência). */
export async function lerPrintDaAreaDeTransferencia(): Promise<File[]> {
  const clip: any = (navigator as any).clipboard;
  if (!clip?.read) {
    toast.info("Use Ctrl+V dentro da janela para colar o print.");
    return [];
  }
  try {
    const itens = await clip.read();
    const arquivos: File[] = [];
    for (const item of itens) {
      const tipo = (item.types as string[]).find((t) => t.startsWith("image/"));
      if (tipo) {
        const blob = await item.getType(tipo);
        arquivos.push(new File([blob], "image.png", { type: tipo }));
      }
    }
    if (arquivos.length === 0) toast.info("Nenhuma imagem copiada. Tire o print e tente de novo.");
    return arquivos;
  } catch {
    toast.info("O navegador bloqueou o acesso. Clique na janela e use Ctrl+V.");
    return [];
  }
}

/** Lista de anexos já preparados, com miniatura das imagens e botão de remover. */
export const AnexosEmEdicao = ({ anexos, onRemover }: { anexos: TaskAttachment[]; onRemover: (idx: number) => void }) => {
  if (anexos.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {anexos.map((a, i) => (
        <div key={i} className="relative group rounded-xl border border-slate-200 bg-slate-50 overflow-hidden aspect-square">
          {isImagemAnexo(a.url) ? (
            <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center">
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="text-[9px] font-bold text-slate-600 line-clamp-2 break-all">{a.name}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemover(i)}
            aria-label={`Remover ${a.name}`}
            title="Remover"
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-red-600 flex items-center justify-center shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

/**
 * Mostra os anexos de uma tarefa para quem recebeu (e para o admin):
 * miniaturas das imagens que abrem em tela cheia, e botões para PDFs/documentos.
 */
export const TaskAttachmentsView = ({
  anexos,
  onAbrirArquivo,
  compacto = false,
}: {
  anexos: TaskAttachment[];
  onAbrirArquivo: (url: string, name: string) => void;
  compacto?: boolean;
}) => {
  const [aberto, setAberto] = useState<TaskAttachment | null>(null);
  if (!anexos || anexos.length === 0) return null;
  const imagens = anexos.filter((a) => isImagemAnexo(a.url));
  const outros = anexos.filter((a) => !isImagemAnexo(a.url));
  const tam = compacto ? "w-12 h-12" : "w-16 h-16";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {imagens.map((a, i) => (
        <button
          key={`img-${i}`}
          type="button"
          onClick={() => setAberto(a)}
          title={`Ver ${a.name}`}
          aria-label={`Ver imagem ${a.name}`}
          className={`${tam} rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 shadow-sm shrink-0`}
        >
          <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
        </button>
      ))}
      {outros.map((a, i) => (
        <button
          key={`arq-${i}`}
          type="button"
          onClick={() => onAbrirArquivo(a.url, a.name)}
          className="inline-flex items-center gap-1.5 px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm max-w-[180px]"
        >
          <FileText className="w-3 h-3 text-blue-500 shrink-0" />
          <span className="truncate">{a.name}</span>
        </button>
      ))}

      {aberto && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/85 flex flex-col items-center justify-center p-4"
          onClick={() => setAberto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={aberto.name}
        >
          <div className="w-full max-w-5xl flex items-center justify-between gap-3 mb-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-semibold truncate">{aberto.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={aberto.url}
                download={aberto.name}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold"
              >
                <Download className="w-4 h-4" /> Baixar
              </a>
              <button
                type="button"
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <img
            src={aberto.url}
            alt={aberto.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-white"
          />
        </div>
      )}
    </div>
  );
};

/** Junta os anexos da tarefa no formato novo, aceitando tarefas antigas (proofUrl). */
export const anexosDaTarefa = (task: { attachments?: TaskAttachment[]; proofUrl?: string; proofName?: string }): TaskAttachment[] => {
  if (task.attachments && task.attachments.length > 0) return task.attachments;
  if (task.proofUrl) return [{ name: task.proofName || "Comprovação", url: task.proofUrl }];
  return [];
};
