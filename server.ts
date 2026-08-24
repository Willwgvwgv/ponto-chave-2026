import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { initializeApp as initAdminApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clean string helper
const cleanStr = (val: any): string => {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/[\r\n\s\t]/g, '').replace(/^['"]|['"]$/g, '').replace(/,$/, '').replace(/["']/g, '');
};

// Initialize Firebase Admin for iCal Feed and Token Verification
const configPath = path.join(__dirname, "firebase-applet-config.json");
let adminDb: any = null;
let adminAuthInstance: any = null;

try {
  let adminConfig: any = {};
  let dbId = cleanStr(process.env.VITE_FIREBASE_DATABASE_ID);

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    adminConfig.projectId = cleanStr(firebaseConfig.projectId);
    if (!dbId && firebaseConfig.firestoreDatabaseId) {
      dbId = cleanStr(firebaseConfig.firestoreDatabaseId);
    }
  }
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
        : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      adminConfig.credential = cert(sa);
      if (sa.project_id) adminConfig.projectId = cleanStr(sa.project_id);
    } catch (e) {
      console.warn("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON from env:", e);
    }
  }

  if (getApps().length === 0) {
    initAdminApp(adminConfig);
  }
  adminDb = getFirestore(dbId || "(default)");
  adminAuthInstance = getAdminAuth();
  console.log("Firebase Admin SDK initialized successfully with dbId:", dbId || "(default)");
} catch (err) {
  console.warn("Could not initialize Firebase Admin DB/Auth:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Multer configuration with MIME and extension validation
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
  ]);

  const allowedExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf"
  ]);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      cb(null, safeName);
    },
  });

  const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
        return cb(new Error("Formato ou extensão de arquivo não permitido"));
      }
      cb(null, true);
    }
  });

  app.use(express.json());

  // API Route: Secure Upload
  app.post("/api/upload", async (req, res, next) => {
    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Acesso não autorizado: Token não fornecido" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    
    // Fail-closed: Verify token if Admin Auth is available, error if unavailable
    if (!adminAuthInstance) {
      return res.status(503).json({ error: "Serviço de autenticação do servidor indisponível" });
    }

    try {
      const decoded = await adminAuthInstance.verifyIdToken(idToken);
      if (!decoded || !decoded.uid) {
        return res.status(401).json({ error: "Acesso não autorizado: Token inválido" });
      }
      (req as any).user = decoded;
    } catch (err) {
      return res.status(401).json({ error: "Acesso não autorizado: Falha na validação do token" });
    }

    next();
  }, upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado ou formato inválido" });
    }

    // Magic Bytes Verification
    try {
      const filePath = req.file.path;
      const buffer = Buffer.alloc(12);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 12, 0);
      fs.closeSync(fd);

      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer.toString('utf8', 8, 12) === 'WEBP';
      const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

      if (!isJpeg && !isPng && !isWebp && !isPdf) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "Conteúdo do arquivo não corresponde ao formato permitido" });
      }
    } catch (err) {
      console.error("Magic bytes check error:", err);
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ error: "Erro na verificação de segurança do arquivo" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  }, (err: any, req: any, res: any, next: any) => {
    // Multer error handler
    console.error("Upload error:", err.message);
    res.status(400).json({ error: err.message || "Erro ao processar arquivo" });
  });

  // API Route: Admin Reset Password (Direct Password Update)
  app.post("/api/admin/reset-password", async (req, res) => {
    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Acesso não autorizado: Token não fornecido" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    if (!adminAuthInstance || !adminDb) {
      return res.status(503).json({ error: "Serviço de autenticação do servidor indisponível" });
    }

    try {
      // 2. Verify Requester Token
      const decodedToken = await adminAuthInstance.verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;

      if (!requesterUid) {
        return res.status(401).json({ error: "Acesso não autorizado: Token inválido" });
      }

      // 3. Verify Requester Admin Permissions in Firestore
      const requesterDoc = await adminDb.collection("users").doc(requesterUid).get();
      const requesterData = requesterDoc.exists ? requesterDoc.data() : null;

      const isMasterAdmin = decodedToken.email === "williangyn10@gmail.com" || requesterData?.email === "williangyn10@gmail.com";
      const isAdminRole = requesterData?.role === "admin" || requesterData?.role === "superadmin";
      const isActive = requesterData?.status === "active";

      if (!isMasterAdmin && (!isAdminRole || !isActive)) {
        return res.status(403).json({ error: "Acesso negado: Apenas administradores ativos podem redefinir senhas diretamente." });
      }

      // 4. Validate Request Body
      const { targetUid, newPassword } = req.body || {};

      if (!targetUid || typeof targetUid !== "string") {
        return res.status(400).json({ error: "ID do usuário de destino é obrigatório." });
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
      }

      // 5. Verify Target User
      // Check if target user is in deleted_users
      const deletedDoc = await adminDb.collection("deleted_users").doc(targetUid).get();
      if (deletedDoc.exists) {
        return res.status(400).json({ error: "Não é possível redefinir senha de uma conta excluída." });
      }

      // Check target user document in users collection
      const targetDoc = await adminDb.collection("users").doc(targetUid).get();
      if (!targetDoc.exists) {
        return res.status(404).json({ error: "Usuário não encontrado no sistema." });
      }

      const targetData = targetDoc.data();

      // Company isolation check (unless master admin)
      if (!isMasterAdmin) {
        const requesterCompanyId = requesterData?.companyId;
        const targetCompanyId = targetData?.companyId;
        if (!requesterCompanyId || requesterCompanyId !== targetCompanyId) {
          return res.status(403).json({ error: "Acesso negado: Você só pode redefinir senhas de usuários da mesma empresa." });
        }
      }

      // 6. Update Password in Firebase Authentication via Firebase Admin SDK
      await adminAuthInstance.updateUser(targetUid, {
        password: newPassword,
      });

      // 7. Revoke Refresh Tokens / Old Sessions
      try {
        await adminAuthInstance.revokeRefreshTokens(targetUid);
      } catch (revokeErr) {
        console.warn("Aviso: Falha ao revogar refresh tokens:", revokeErr);
      }

      // 8. Cleanup legacy/temporary fields in Firestore (without saving the new password)
      try {
        await adminDb.collection("users").doc(targetUid).update({
          temporaryPassword: FieldValue.delete(),
          mustChangePassword: FieldValue.delete(),
          customPassword: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (cleanErr) {
        console.warn("Aviso ao limpar campos temporários no Firestore:", cleanErr);
      }

      return res.status(200).json({
        success: true,
        message: "Senha atualizada com sucesso no Firebase Authentication."
      });

    } catch (err: any) {
      console.error("Erro na redefinição direta de senha:", err);
      return res.status(500).json({
        error: `Erro ao redefinir senha: ${err?.message || "Erro interno do servidor."}`
      });
    }
  });

  // iCal Feed for Apple Calendar Subscription (Fail-closed)
  app.get("/api/calendar/feed/:userId.ics", async (req, res) => {
    const { userId } = req.params;
    const feedSecret = process.env.CALENDAR_FEED_SECRET;
    const reqToken = req.query.token;

    // Validate feed token - fail closed if secret not configured or token mismatch
    if (!feedSecret || !reqToken || reqToken !== feedSecret) {
      return res.status(403).send("Acesso negado: Token de feed inválido ou não configurado");
    }
    
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="agenda-${userId}.ics"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (!adminDb) {
      return res.status(500).send("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ponto Chave//PT\r\nEND:VCALENDAR");
    }

    try {
      const tasksSnapshot = await adminDb
        .collection("tasks")
        .where("uid", "==", userId)
        .get();

      const createdIso = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const sanitize = (str: string) => (str || "").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

      const events: string[] = [];

      tasksSnapshot.forEach((doc: any) => {
        const task = doc.data();
        if (task.completed) return; // apenas pendentes

        let dateStr = task.date ? task.date.replace(/-/g, "") : new Date().toISOString().slice(0, 10).replace(/-/g, "");
        let nextDayStr = dateStr;
        if (task.date) {
          try {
            const parts = task.date.split("-");
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            d.setDate(d.getDate() + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            nextDayStr = `${y}${m}${day}`;
          } catch {
            nextDayStr = dateStr;
          }
        }

        const uid = `task-${doc.id}@pontochave.app`;

        events.push(
          [
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${createdIso}`,
            `DTSTART;VALUE=DATE:${dateStr}`,
            `DTEND;VALUE=DATE:${nextDayStr}`,
            `SUMMARY:${sanitize(`📍 ${task.title}`)}`,
            `DESCRIPTION:${sanitize((task.description ? task.description + "\\n\\n" : "") + "Sincronizado via Ponto Chave")}`,
            "STATUS:CONFIRMED",
            "BEGIN:VALARM",
            "TRIGGER:-PT15M",
            "ACTION:DISPLAY",
            `DESCRIPTION:${sanitize(task.title)}`,
            "END:VALARM",
            "END:VEVENT",
          ].join("\r\n")
        );
      });

      const icalContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ponto Chave//Agenda de Tarefas//PT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Minhas Tarefas - Ponto Chave",
        "X-WR-TIMEZONE:America/Sao_Paulo",
        ...events,
        "END:VCALENDAR",
      ].join("\r\n");

      res.status(200).send(icalContent);
    } catch (err) {
      console.error("Error generating iCal feed:", err);
      res.status(500).send("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ponto Chave//PT\r\nEND:VCALENDAR");
    }
  });

  // Protected static file delivery for uploads
  app.get("/uploads/:filename", async (req, res) => {
    const { filename } = req.params;
    const token = (req.headers.authorization?.split("Bearer ")[1]) || (req.query.token as string);

    if (!token) {
      return res.status(401).send("Acesso negado: Autenticação necessária");
    }

    if (!adminAuthInstance) {
      return res.status(503).send("Serviço de autenticação temporariamente indisponível");
    }

    try {
      await adminAuthInstance.verifyIdToken(token);
    } catch {
      return res.status(401).send("Acesso negado: Token inválido");
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(uploadsDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Arquivo não encontrado");
    }

    res.sendFile(filePath);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
