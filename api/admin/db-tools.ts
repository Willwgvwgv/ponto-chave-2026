import { getFirebaseAdmin } from "../_firebaseAdmin.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// --- Verificação leve de ID Token do Firebase (mesmo padrão usado em outros endpoints,
// evita o bug de ESM/CommonJS do firebase-admin/auth neste ambiente) ---
const GOOGLE_CERTS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let cachedCerts: { keys: any[]; fetchedAt: number } | null = null;

function base64UrlDecode(input: string): Buffer {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64");
}

function getFirebaseProjectId(): string {
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID.trim();
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg.projectId) return String(cfg.projectId).trim();
    }
  } catch {}
  return "";
}

async function getGoogleCerts() {
  const now = Date.now();
  if (cachedCerts && now - cachedCerts.fetchedAt < 60 * 60 * 1000) return cachedCerts.keys;
  const resp = await fetch(GOOGLE_CERTS_URL);
  const data = await resp.json();
  cachedCerts = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string } | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64).toString("utf-8"));
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
    const projectId = getFirebaseProjectId();
    const now = Math.floor(Date.now() / 1000);
    if (projectId && payload.aud !== projectId) return null;
    if (projectId && payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    if (!payload.sub) return null;
    const keys = await getGoogleCerts();
    const matchingKey = keys.find((k: any) => k.kid === header.kid);
    if (!matchingKey) return null;
    const publicKey = crypto.createPublicKey({ key: matchingKey, format: "jwk" as const });
    const isValid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${headerB64}.${payloadB64}`),
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      base64UrlDecode(signatureB64)
    );
    return isValid ? { uid: payload.sub } : null;
  } catch {
    return null;
  }
}

// Só estas coleções podem ser lidas/corrigidas por esta ferramenta.
const ALLOWED_COLLECTIONS = ["comissoes", "vistorias", "financial_transactions"];

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso não autorizado: Token não fornecido" });
  }
  const decoded = await verifyFirebaseIdToken(authHeader.split("Bearer ")[1]);
  if (!decoded) {
    return res.status(401).json({ error: "Acesso não autorizado: Token inválido" });
  }

  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    return res.status(503).json({ error: "Serviço de banco de dados do servidor indisponível" });
  }

  try {
    if (req.method === "GET") {
      const action = req.query?.action;

      if (action === "list-orphans") {
        const results: Record<string, any[]> = {};
        for (const col of ["comissoes", "vistorias"]) {
          const snap = await adminDb.collection(col)
            .where("companyId", "in", ["default", "default_agency"])
            .get();
          results[col] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        }
        return res.status(200).json(results);
      }

      if (action === "despesas") {
        const companyId = req.query?.companyId;
        const from = req.query?.from;
        const to = req.query?.to;
        if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" });

        let q = adminDb.collection("financial_transactions")
          .where("companyId", "==", companyId)
          .where("type", "==", "DESPESA");
        const snap = await q.get();
        let docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        if (from) docs = docs.filter((d: any) => d.date >= from);
        if (to) docs = docs.filter((d: any) => d.date <= to);
        return res.status(200).json({ despesas: docs });
      }

      if (action === "list-companies") {
        // Ajuda a identificar qual é o companyId "correto" olhando os registros que não são órfãos
        const snap = await adminDb.collection("vistorias").limit(20).get();
        const companyIds = Array.from(new Set(snap.docs.map((d: any) => d.data().companyId)));
        return res.status(200).json({ companyIds });
      }

      return res.status(400).json({ error: "Ação desconhecida. Use list-orphans, despesas ou list-companies." });
    }

    if (req.method === "POST") {
      const { action, collection, docId, correctCompanyId } = req.body || {};

      if (action === "fix-company-id") {
        if (!ALLOWED_COLLECTIONS.includes(collection)) {
          return res.status(400).json({ error: "Coleção não permitida" });
        }
        if (!docId || !correctCompanyId) {
          return res.status(400).json({ error: "docId e correctCompanyId são obrigatórios" });
        }
        await adminDb.collection(collection).doc(docId).update({ companyId: correctCompanyId });
        return res.status(200).json({ ok: true, collection, docId, correctCompanyId });
      }

      return res.status(400).json({ error: "Ação desconhecida." });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (error: any) {
    console.error("Erro na ferramenta administrativa:", error);
    return res.status(500).json({ error: error.message || "Erro interno." });
  }
}
