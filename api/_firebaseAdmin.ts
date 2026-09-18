import { initializeApp as initAdminApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

let adminDb: any = null;
let adminAuthInstance: any = null;
let authInitAttempted = false;

function resolveAdminConfig() {
  let adminConfig: any = {};
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  // Prioriza a mesma variável de ambiente que o app cliente usa para escolher o banco de
  // dados nomeado do Firestore — sem isso, o Admin SDK cai no banco "(default)", que é
  // diferente (e vazio) do banco real usado pelo aplicativo.
  let databaseId: string | undefined = process.env.VITE_FIREBASE_DATABASE_ID?.trim() || undefined;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    adminConfig.projectId = firebaseConfig.projectId;
    if (!databaseId) databaseId = firebaseConfig.firestoreDatabaseId;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      let rawValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
      // Corrige um erro comum de copiar/colar: faltar a chave { ou } externa do JSON.
      if (!rawValue.startsWith("{")) rawValue = "{" + rawValue;
      if (!rawValue.endsWith("}")) rawValue = rawValue + "}";
      const sa = JSON.parse(rawValue);
      adminConfig.credential = cert(sa);
      if (sa.project_id) adminConfig.projectId = sa.project_id;
    } catch (e) {
      console.warn("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON from env:", e);
    }
  }

  return { adminConfig, databaseId };
}

// Firestore (adminDb) — usado pela maioria dos endpoints administrativos, e não sofre
// do problema de compatibilidade ESM/CommonJS que afeta o módulo de Auth abaixo.
export function getFirebaseAdmin() {
  if (!adminDb) {
    try {
      const { adminConfig, databaseId } = resolveAdminConfig();
      if (getApps().length === 0) {
        initAdminApp(adminConfig);
      }
      adminDb = getFirestore(databaseId || "(default)");
    } catch (err) {
      console.warn("Could not initialize Firebase Admin Firestore:", err);
    }
  }

  return { adminDb, adminAuthInstance };
}

// Auth do Admin SDK — importado dinamicamente (só quando de fato chamado), porque o
// import estático de "firebase-admin/auth" quebra o carregamento de QUALQUER função
// serverless deste projeto (conflito ESM/CommonJS numa dependência interna dela,
// jwks-rsa/jose), mesmo em funções que nunca usam Auth. Com import() dinâmico, o erro
// fica isolado só em quem realmente precisa de Auth, e pode ser tratado com try/catch.
export async function getFirebaseAdminAuth() {
  if (adminAuthInstance || authInitAttempted) {
    return adminAuthInstance;
  }
  authInitAttempted = true;

  try {
    // Garante que o app admin (usado pelo Firestore acima) já está inicializado
    getFirebaseAdmin();
    const { getAuth } = await import("firebase-admin/auth");
    adminAuthInstance = getAuth();
  } catch (err) {
    console.warn("Firebase Admin Auth indisponível neste ambiente (usar verificação própria de token):", err);
    adminAuthInstance = null;
  }

  return adminAuthInstance;
}
