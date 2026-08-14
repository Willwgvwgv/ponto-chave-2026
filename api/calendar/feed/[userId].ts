import { getFirebaseAdmin } from "../../_firebaseAdmin.js";

export default async function handler(req: any, res: any) {
  let { userId } = req.query;
  if (typeof userId === "string" && userId.endsWith(".ics")) {
    userId = userId.replace(/\.ics$/, "");
  }

  const feedSecret = process.env.CALENDAR_FEED_SECRET;
  const reqToken = req.query.token;

  if (!feedSecret || !reqToken || reqToken !== feedSecret) {
    return res.status(403).send("Acesso negado: Token de feed inválido ou não configurado");
  }

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="agenda-${userId}.ics"`);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const { adminDb } = getFirebaseAdmin();

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
      if (task.completed) return;

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

    return res.status(200).send(icalContent);
  } catch (err) {
    console.error("Error generating iCal feed:", err);
    return res.status(500).send("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ponto Chave//PT\r\nEND:VCALENDAR");
  }
}
