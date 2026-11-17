// Utilitários compartilhados pelos endpoints de Avaliação de Imóvel.
// Arquivos com "_" no começo não viram rota na Vercel.
import { verifyFirebaseIdToken } from "../_firebaseIdToken.js";

export type FonteWeb = { url: string; titulo: string; idade?: string | null };

export function normalizarUrl(u: string): string {
  try {
    const url = new URL(String(u).trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const caminho = url.pathname.replace(/\/+$/, "");
    return `${host}${caminho}`.toLowerCase();
  } catch {
    return String(u || "").trim().toLowerCase();
  }
}

export function numero(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.-]/g, "");
  if (!s) return null;
  // "1.234.567,89" -> 1234567.89 ; "1234.5" -> 1234.5
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function quantil(valores: number[], q: number): number | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const pos = (v.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return v[base + 1] !== undefined ? v[base] + resto * (v[base + 1] - v[base]) : v[base];
}

export function media(valores: number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function extrairJson(texto: string): any {
  const blocos = [...texto.matchAll(/<json>([\s\S]*?)<\/json>/g)];
  const candidato = blocos.length > 0 ? blocos[blocos.length - 1][1] : texto;
  const ini = candidato.indexOf("{");
  const fim = candidato.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("A IA não devolveu dados no formato esperado.");
  return JSON.parse(candidato.slice(ini, fim + 1));
}

type ChamadaIA = {
  prompt: string;
  usarBusca: boolean;
  maxBuscas?: number;
  cidade?: string;
  uf?: string;
  maxTokens?: number;
};

// Chama a API da Anthropic. Com usarBusca=true a IA pesquisa na web de verdade
// (ferramenta web_search do próprio servidor da Anthropic) e devolvemos também a
// lista de páginas que ela realmente abriu — usada para descartar qualquer link
// que não tenha vindo de uma busca real.
export async function chamarIA({ prompt, usarBusca, maxBuscas = 6, cidade, uf, maxTokens = 6000 }: ChamadaIA) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err: any = new Error(
      "A avaliação por IA ainda não foi configurada. Defina ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel."
    );
    err.status = 503;
    throw err;
  }

  const tools: any[] = [];
  if (usarBusca) {
    const local: any = { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" };
    if (cidade) local.city = cidade;
    if (uf) local.region = uf;
    tools.push({ type: "web_search_20250305", name: "web_search", max_uses: maxBuscas, user_location: local });
  }

  const messages: any[] = [{ role: "user", content: prompt }];
  const fontes = new Map<string, FonteWeb>();
  let textoFinal = "";

  // pause_turn: a API pode pausar uma busca longa; reenviamos para continuar.
  for (let rodada = 0; rodada < 4; rodada++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages,
        ...(tools.length ? { tools } : {}),
      }),
    });

    if (!resp.ok) {
      const corpo = await resp.text().catch(() => "");
      console.error("[avaliacao] Anthropic API error:", resp.status, corpo);
      const err: any = new Error("Erro ao consultar a IA. Tente novamente em instantes.");
      err.status = 502;
      throw err;
    }

    const data = await resp.json();
    const conteudo: any[] = data.content || [];

    for (const bloco of conteudo) {
      if (bloco.type === "web_search_tool_result" && Array.isArray(bloco.content)) {
        for (const r of bloco.content) {
          if (r?.type === "web_search_result" && r.url) {
            fontes.set(normalizarUrl(r.url), { url: r.url, titulo: r.title || r.url, idade: r.page_age || null });
          }
        }
      }
    }

    const texto = conteudo.filter((b) => b.type === "text").map((b) => b.text).join("");
    textoFinal += texto;

    if (data.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: conteudo });
      continue;
    }
    break;
  }

  return { texto: textoFinal, fontes: [...fontes.values()] };
}

export function urlVerificada(url: any, fontes: FonteWeb[]): string | null {
  if (!url || typeof url !== "string") return null;
  const alvo = normalizarUrl(url);
  const achou = fontes.find((f) => normalizarUrl(f.url) === alvo);
  return achou ? achou.url : null;
}

export async function autenticar(req: any): Promise<{ uid: string } | null> {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) return null;
  return verifyFirebaseIdToken(authHeader.split("Bearer ")[1]);
}
