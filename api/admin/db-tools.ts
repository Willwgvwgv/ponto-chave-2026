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

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
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

// Só estas coleções podem ser lidas/corrigidas por esta ferramenta.
const ALLOWED_COLLECTIONS = ["comissoes", "vistorias", "financial_transactions", "users"];

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  const authHeader = req.headers.authorization || req.headers.Authorization;
  const providedSecret = (req.query?.secret || req.headers["x-admin-secret"] || "").toString().trim();
  const expectedSecret = (process.env.ADMIN_EXPORT_SECRET || "").trim();

  let authorized = false;

  const { adminDb } = getFirebaseAdmin();

  // Opção 1: senha fixa configurada na Vercel (comparação em tempo constante)
  if (expectedSecret && providedSecret) {
    const a = crypto.createHash("sha256").update(providedSecret).digest();
    const b = crypto.createHash("sha256").update(expectedSecret).digest();
    if (crypto.timingSafeEqual(a, b)) authorized = true;
  }

  // Opção 2: login do Firebase — SOMENTE superadmin. Antes, qualquer usuário logado
  // (inclusive colaborador) passava aqui e podia ler/alterar dados de todas as empresas
  // sem passar pelas regras do Firestore.
  if (!authorized && authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const decoded = await verifyFirebaseIdToken(authHeader.split("Bearer ")[1]);
    if (decoded && adminDb) {
      const isOwnerEmail = (decoded.email || "").toLowerCase() === "williangyn10@gmail.com";
      let isSuper = isOwnerEmail;
      if (!isSuper) {
        try {
          const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
          isSuper = userDoc.exists && userDoc.data()?.role === "superadmin";
        } catch {}
      }
      if (isSuper) authorized = true;
    }
  }

  if (!authorized) {
    return res.status(401).json({ error: "Acesso não autorizado" });
  }

  if (!adminDb) {
    return res.status(503).json({ error: "Serviço de banco de dados do servidor indisponível" });
  }

  try {
    if (req.method === "GET") {
      const action = req.query?.action;

      if (action === "fix-corretor-id") {
        const oldId = req.query?.oldId;
        const newId = req.query?.newId;
        if (!oldId || !newId) return res.status(400).json({ error: "oldId e newId são obrigatórios" });

        const snap = await adminDb.collection("comissoes").get();
        let corrigidos = 0;
        const batch = adminDb.batch();

        snap.docs.forEach((d: any) => {
          const data = d.data();
          const rateio = data.rateio || [];
          const pagamentos = data.pagamentosCorretores || [];
          // Corrige o ID no rateio E nos pagamentos já registrados. Antes só o rateio era
          // trocado, e os repasses antigos ficavam "órfãos" (não contavam como pagos).
          const temMatchRateio = rateio.some((r: any) => r.corretorId === oldId);
          const temMatchPag = pagamentos.some((p: any) => p.corretorId === oldId);
          if (temMatchRateio || temMatchPag) {
            batch.update(d.ref, {
              rateio: rateio.map((r: any) => r.corretorId === oldId ? { ...r, corretorId: newId } : r),
              pagamentosCorretores: pagamentos.map((p: any) => p.corretorId === oldId ? { ...p, corretorId: newId } : p)
            });
            corrigidos++;
          }
        });

        if (corrigidos > 0) await batch.commit();
        return res.status(200).json({ ok: true, corrigidos });
      }

      // Relatório SOMENTE LEITURA: pagamentos órfãos, locações duplicadas e IDs de convite no rateio
      if (action === "audit-comissoes") {
        const [comSnap, usersSnap] = await Promise.all([
          adminDb.collection("comissoes").get(),
          adminDb.collection("users").get()
        ]);
        const users = usersSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
        const realByEmail = new Map<string, any>();
        users.forEach((u: any) => {
          if (u.email && !String(u.id).startsWith("pending_")) realByEmail.set(String(u.email).toLowerCase(), u);
        });
        const pendingMap: Record<string, { email?: string; nome?: string; idReal?: string }> = {};
        users.filter((u: any) => String(u.id).startsWith("pending_")).forEach((u: any) => {
          const real = u.email ? realByEmail.get(String(u.email).toLowerCase()) : null;
          pendingMap[u.id] = { email: u.email, nome: u.displayName || u.name || u.nome, idReal: real?.id };
        });

        const norm = (v: any) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const pagamentosOrfaos: any[] = [];
        const rateioComConvite: any[] = [];
        const grupos = new Map<string, any[]>();

        comSnap.docs.forEach((d: any) => {
          const c = d.data() || {};
          const rateio = c.rateio || [];
          const idsRateio = new Set(rateio.map((r: any) => r.corretorId));
          const base = { docId: d.id, imovel: c.imovel, inquilino: c.inquilino, mes: c.mesReferencia, companyId: c.companyId };

          (c.pagamentosCorretores || []).forEach((p: any) => {
            if (!idsRateio.has(p.corretorId)) {
              const mesmoNome = rateio.find((r: any) => norm(r.corretorNome) === norm(p.corretorNome));
              pagamentosOrfaos.push({ ...base, corretorNome: p.corretorNome, corretorIdPagamento: p.corretorId, corretorIdNoRateio: mesmoNome?.corretorId || null, valor: p.valor, data: p.data, tipo: p.tipo });
            }
          });
          rateio.forEach((r: any) => {
            if (String(r.corretorId || "").startsWith("pending_")) {
              rateioComConvite.push({ ...base, corretorNome: r.corretorNome, corretorId: r.corretorId, idReal: pendingMap[r.corretorId]?.idReal || null });
            }
          });
          const chave = `${c.companyId}|${norm(c.imovel)}|${norm(c.inquilino)}|${c.mesReferencia || ""}`;
          const lista = grupos.get(chave) || [];
          lista.push({ ...base, aluguel: c.aluguelMensal ?? c.primeiroAluguel, status: c.status, createdAt: c.createdAt, qtdPagamentos: (c.pagamentosCorretores || []).length });
          grupos.set(chave, lista);
        });

        const duplicadas = Array.from(grupos.values()).filter(g => g.length > 1);
        return res.status(200).json({
          totalComissoes: comSnap.size,
          resumo: { pagamentosOrfaos: pagamentosOrfaos.length, rateioComConvite: rateioComConvite.length, gruposDuplicados: duplicadas.length },
          cadastrosDeConvite: pendingMap,
          pagamentosOrfaos,
          rateioComConvite,
          duplicadas
        });
      }

      // Troca o papel de um participante no rateio (ex.: captador → auxiliar), sem mexer em valores.
      // dryRun=1 só lista o que seria alterado.
      if (action === "change-papel") {
        const corretorId = String(req.query?.corretorId || "");
        const de = String(req.query?.de || "");
        const para = String(req.query?.para || "");
        const dryRun = String(req.query?.dryRun || "") === "1";
        const PAPEIS = ["captador", "locacao", "auxiliar"];
        if (!corretorId || !PAPEIS.includes(de) || !PAPEIS.includes(para) || de === para) {
          return res.status(400).json({ error: "corretorId, de e para (captador|locacao|auxiliar) são obrigatórios" });
        }
        const snap = await adminDb.collection("comissoes").get();
        const alteradas: any[] = [];
        const batch = adminDb.batch();
        snap.docs.forEach((d: any) => {
          const c = d.data() || {};
          let mudou = false;
          const rateio = (c.rateio || []).map((r: any) => {
            if (r.corretorId !== corretorId) return r;
            let novo = r;
            if (r.papel === de) { novo = { ...novo, papel: para }; mudou = true; }
            if (Array.isArray(r.composicao) && r.composicao.some((x: any) => x.papel === de)) {
              novo = { ...novo, composicao: r.composicao.map((x: any) => x.papel === de ? { ...x, papel: para } : x) };
              mudou = true;
            }
            return novo;
          });
          if (mudou) {
            alteradas.push({ docId: d.id, imovel: c.imovel, mes: c.mesReferencia });
            if (!dryRun) batch.update(d.ref, { rateio });
          }
        });
        if (!dryRun && alteradas.length > 0) await batch.commit();
        return res.status(200).json({ ok: true, dryRun, total: alteradas.length, alteradas });
      }

      if (action === "find-by-corretor") {
        const corretorId = req.query?.corretorId;
        if (!corretorId) return res.status(400).json({ error: "corretorId é obrigatório" });
        const snap = await adminDb.collection("comissoes").get();
        const matches = snap.docs
          .filter((d: any) => (d.data().rateio || []).some((r: any) => r.corretorId === corretorId))
          .map((d: any) => ({ id: d.id, imovel: d.data().imovel, mesReferencia: d.data().mesReferencia, rateio: d.data().rateio }));
        return res.status(200).json({ matches, total: matches.length });
      }

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

      if (action === "list-users") {
        const snap = await adminDb.collection("users").get();
        const users = snap.docs.map((d: any) => {
          const data = d.data();
          return { id: d.id, displayName: data.displayName, email: data.email, companyId: data.companyId, role: data.role };
        });
        return res.status(200).json({ users });
      }

      return res.status(400).json({ error: "Ação desconhecida. Use list-orphans, despesas, list-companies ou list-users." });
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
