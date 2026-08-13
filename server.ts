import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initializeApp as initAdminApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin for iCal Feed
const configPath = path.join(__dirname, "firebase-applet-config.json");
let adminDb: any = null;

if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (getApps().length === 0) {
      initAdminApp({
        projectId: firebaseConfig.projectId,
      });
    }
    adminDb = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
  } catch (err) {
    console.warn("Could not initialize Firebase Admin DB for iCal feed:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Multer configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  });

  app.use(express.json());

  // API Routes
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // iCal Feed for Apple Calendar Subscription
  app.get("/api/calendar/feed/:userId.ics", async (req, res) => {
    const { userId } = req.params;
    
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

  // Serve static uploads
  app.use("/uploads", express.static(uploadsDir));

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
