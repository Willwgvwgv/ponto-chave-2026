import DOMPurify from "dompurify";

// Proteção contra scripts escondidos em textos salvos pelos usuários.
// Use estas funções sempre que um texto do banco for colocado dentro de HTML
// montado como texto (janelas de impressão, document.write, dangerouslySetInnerHTML).

/** Texto simples dentro de HTML: < > & " ' viram entidades e aparecem como texto. */
export function escaparHtml(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Cópia do objeto com todos os textos escapados (inclusive dentro de listas e
 * subobjetos). Números, datas e booleanos ficam iguais.
 */
export function escaparProfundo<T>(valor: T): T {
  if (typeof valor === "string") return escaparHtml(valor) as unknown as T;
  if (Array.isArray(valor)) return valor.map((v) => escaparProfundo(v)) as unknown as T;
  if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype) {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) saida[k] = escaparProfundo(v);
    return saida as T;
  }
  return valor;
}

/**
 * HTML com formatação (texto de contrato): mantém negrito, listas, tabelas,
 * estilos e classes, mas remove scripts, eventos (onerror, onclick...) e links javascript:.
 */
export function sanitizarHtmlRico(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || !DOMPurify.isSupported) return html;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe", "object", "embed"],
  }) as string;
}

/** Endereço seguro para abrir ou usar em src: só https, http, blob e imagens/PDF em data:. */
export function urlSegura(url: unknown): string {
  if (typeof url !== "string") return "";
  const u = url.trim();
  if (/^data:(image\/(png|jpe?g|gif|webp)|application\/pdf)[;,]/i.test(u)) return u;
  if (/^(https?:|blob:)/i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return "";
}

/** Cor CSS segura (#abc, #aabbcc, #aabbccdd); outra coisa vira a cor padrão. */
export function corSegura(cor: unknown, padrao = "#94a3b8"): string {
  return typeof cor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(cor.trim()) ? cor.trim() : padrao;
}
