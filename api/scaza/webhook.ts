import crypto from "crypto";
import { getFirebaseAdmin } from "../_firebaseAdmin.js";
import { verifyFirebaseIdToken } from "../_firebaseIdToken.js";
import { processarAviso, vincularConta, limparCorpo, type ResultadoProcessamento } from "./_processar.js";

// Receptor de webhooks da Scaza (boletos/débitos de energia).
//
// POST /api/scaza/webhook?k=<SCAZA_WEBHOOK_TOKEN>
//   Chamado pela Scaza. Guarda o evento bruto em "scaza_webhooks" para depois
//   cruzarmos com as locações (pela unidade consumidora). Enquanto o formato exato
//   do payload não está documentado, nada é interpretado aqui — só armazenado.
//
// GET /api/scaza/webhook  (Authorization: Bearer <Firebase ID token>)
//   Para o painel da Energia: diz se está configurado, devolve a URL a colar na
//   Scaza e os últimos eventos recebidos. Somente dono/superadmin, ou admin da
//   empresa definida em SCAZA_COMPANY_ID.

const COLECAO = "scaza_webhooks";
const MAX_BYTES = 512 * 1024;

const iguais = (a: string, b: string) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const corpoParaTexto = (body: any): string => {
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf-8");
  return JSON.stringify(body);
};

async function lerCorpoBruto(req: any): Promise<string> {
  // Stream já consumido pela plataforma → usa o corpo que ela entregou.
  if (req.readableEnded || typeof req.on !== "function") return corpoParaTexto(req.body);
  const bruto = await new Promise<string>((resolve) => {
    const partes: Buffer[] = [];
    let total = 0;
    let terminou = false;
    const fim = () => {
      if (terminou) return;
      terminou = true;
      resolve(Buffer.concat(partes).toString("utf-8"));
    };
    setTimeout(fim, 5000);
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total <= MAX_BYTES) partes.push(c);
    });
    req.on("end", fim);
    req.on("error", fim);
  });
  if (bruto) return bruto;
  try { return corpoParaTexto(req.body); } catch { return ""; }
}

// Só cabeçalhos úteis para entender/verificar o envio (nada de cookies/IPs internos).
const filtrarHeaders = (h: Record<string, any>) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h || {})) {
    const key = k.toLowerCase();
    if (key === "content-type" || key === "user-agent" || key.startsWith("x-scaza") || key.includes("signature") || key.includes("assinatura") || key.includes("hmac") || key === "x-hub-signature-256") {
      out[key] = String(v).slice(0, 500);
    }
  }
  return out;
};

async function usuarioPodeVer(authHeader: string | undefined, adminDb: any): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const decoded = await verifyFirebaseIdToken(authHeader.slice(7));
  if (!decoded) return false;
  if ((decoded.email || "").toLowerCase() === "williangyn10@gmail.com") return true;
  try {
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!snap.exists) return false;
    const u = snap.data() || {};
    if (u.role === "superadmin") return true;
    const empresa = (process.env.SCAZA_COMPANY_ID || "").trim();
    return u.role === "admin" && !!empresa && u.companyId === empresa;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const tokenEsperado = (process.env.SCAZA_WEBHOOK_TOKEN || "").trim();
  const { adminDb } = getFirebaseAdmin();

  // Ação do painel (admin logado): reprocessar um aviso já recebido.
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (req.method === "POST" && !req.query?.k && authHeader) {
    if (!adminDb) return res.status(503).json({ error: "banco indisponível" });
    if (!(await usuarioPodeVer(authHeader, adminDb))) return res.status(401).json({ error: "acesso não autorizado" });
    let corpoReq: any = req.body;
    if (typeof corpoReq === "string") { try { corpoReq = JSON.parse(corpoReq); } catch { corpoReq = {}; } }
    const id = String(corpoReq?.id || "").trim();
    const acao = corpoReq?.acao;
    if ((acao !== "reprocessar" && acao !== "vincular") || !id || id.includes("/")) return res.status(400).json({ error: "pedido inválido" });
    const ref = adminDb.collection(COLECAO).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "aviso não encontrado" });
    const ev = snap.data() || {};
    if (acao === "vincular") {
      const energiaId = String(corpoReq?.energiaId || "").trim();
      if (!energiaId || energiaId.includes("/")) return res.status(400).json({ error: "escolha a locação" });
      const erro = await vincularConta(adminDb, ev.corpo?.dados, energiaId);
      if (erro) return res.status(400).json({ error: erro });
    }
    const resultado: ResultadoProcessamento = await processarAviso(adminDb, ev.topico || null, ev.corpo?.dados);
    const limpo = Object.fromEntries(Object.entries(resultado).filter(([, v]) => v !== undefined));
    await ref.set({ corpo: ev.corpo ? limparCorpo(ev.corpo) : null, reprocessadoEm: new Date().toISOString(), energiaId: null, inquilino: null, mesesAtualizados: [], motivo: null, ...limpo }, { merge: true });
    return res.status(200).json(resultado);
  }

  if (req.method === "POST") {
    const k = String(req.query?.k || "").trim();
    if (!tokenEsperado || !k || !iguais(k, tokenEsperado)) {
      return res.status(401).json({ error: "não autorizado" });
    }
    if (!adminDb) return res.status(503).json({ error: "banco indisponível" });

    const bruto = await lerCorpoBruto(req);
    let corpo: any = null;
    try { corpo = JSON.parse(bruto); } catch { corpo = null; }

    // Se a chave de integridade da Scaza estiver configurada, registra se alguma
    // assinatura HMAC-SHA256 do corpo confere (o formato oficial ainda não foi confirmado).
    const chave = (process.env.SCAZA_WEBHOOK_SECRET || "").trim();
    let assinaturaOk: boolean | null = null;
    if (chave) {
      const hex = crypto.createHmac("sha256", chave).update(bruto).digest("hex");
      const b64 = crypto.createHmac("sha256", chave).update(bruto).digest("base64");
      const enviados = Object.entries(req.headers || {})
        .filter(([key]) => /signature|assinatura|hmac/i.test(key))
        .map(([, v]) => String(v).replace(/^sha256=/i, "").trim());
      assinaturaOk = enviados.length ? enviados.some((s) => s === hex || s === b64) : null;
    }

    const topico = corpo?.topico || corpo?.topic || corpo?.evento || corpo?.event || null;
    const resultado: ResultadoProcessamento = assinaturaOk === false
      ? { processado: false, motivo: "assinatura não confere; aviso ignorado" }
      : await processarAviso(adminDb, topico, corpo?.dados);

    try {
      await adminDb.collection(COLECAO).add({
        recebidoEm: new Date().toISOString(),
        topico,
        headers: filtrarHeaders(req.headers),
        corpo: corpo ? limparCorpo(corpo) : null,
        corpoBruto: corpo ? null : bruto.slice(0, 20000),
        assinaturaOk,
        ...Object.fromEntries(Object.entries(resultado).filter(([, v]) => v !== undefined))
      });
    } catch (e) {
      console.error("scaza webhook: falha ao gravar", e);
      return res.status(500).json({ error: "falha ao gravar" });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    if (!adminDb) return res.status(503).json({ error: "banco indisponível" });
    const pode = await usuarioPodeVer(authHeader, adminDb);
    if (!pode) return res.status(401).json({ error: "acesso não autorizado" });

    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const url = tokenEsperado ? `https://${host}/api/scaza/webhook?k=${encodeURIComponent(tokenEsperado)}` : null;

    let eventos: any[] = [];
    try {
      const snap = await adminDb.collection(COLECAO).orderBy("recebidoEm", "desc").limit(20).get();
      eventos = snap.docs.map((d: any) => {
        const ev = d.data() || {};
        return { id: d.id, ...ev, corpo: ev.corpo ? limparCorpo(ev.corpo) : null };
      });
    } catch (e) {
      console.error("scaza webhook: falha ao listar", e);
    }

    return res.status(200).json({
      configurado: !!tokenEsperado,
      empresaConfigurada: !!(process.env.SCAZA_COMPANY_ID || "").trim(),
      chaveIntegridadeConfigurada: !!(process.env.SCAZA_WEBHOOK_SECRET || "").trim(),
      url,
      eventos
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "método não permitido" });
}
