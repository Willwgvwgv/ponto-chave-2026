import { initializeApp as initAdminApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import path from "path";
import fs from "fs";

let adminDb: any = null;
let adminAuthInstance: any = null;

export function getFirebaseAdmin() {
  if (adminDb && adminAuthInstance) {
    return { adminDb, adminAuthInstance };
  }

  try {
    let adminConfig: any = {};
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let databaseId: string | undefined = undefined;

    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      adminConfig.projectId = firebaseConfig.projectId;
      databaseId = firebaseConfig.firestoreDatabaseId;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const sa = typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === "string"
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
          : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        adminConfig.credential = cert(sa);
        if (sa.project_id) adminConfig.projectId = sa.project_id;
      } catch (e) {
        console.warn("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON from env:", e);
      }
    }

    if (getApps().length === 0) {
      initAdminApp(adminConfig);
    }
    adminDb = getFirestore(databaseId || "(default)");
    adminAuthInstance = getAdminAuth();
  } catch (err) {
    console.warn("Could not initialize Firebase Admin DB/Auth:", err);
  }

  return { adminDb, adminAuthInstance };
}
