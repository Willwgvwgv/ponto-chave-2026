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

export async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64).toString("utf-8"));
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
    const projectId = getFirebaseProjectId();
    const now = Math.floor(Date.now() / 1000);
    // Sem projectId não há como garantir que o token é DESTE projeto — recusa.
    if (!projectId) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
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
    return isValid ? { uid: payload.sub, email: payload.email_verified ? payload.email : undefined } : null;
  } catch {
    return null;
  }
}
