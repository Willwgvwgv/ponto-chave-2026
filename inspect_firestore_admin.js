import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Load configuration
const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = admin.initializeApp({
  projectId: config.projectId
});

const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  console.log("=== BUSCANDO USUÁRIOS NO FIRESTORE REAL ===");
  const usersSnapshot = await db.collection("users").get();
  console.log(`Total de usuários: ${usersSnapshot.size}`);
  
  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`User ID: ${doc.id}`);
    console.log(JSON.stringify(data, null, 2));
    console.log("------------------------");
  });

  console.log("\n=== BUSCANDO TAREFAS NO FIRESTORE REAL ===");
  const tasksSnapshot = await db.collection("tasks").get();
  console.log(`Total de tarefas: ${tasksSnapshot.size}`);
  
  tasksSnapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`Task ID: ${doc.id}`);
    console.log(JSON.stringify(data, null, 2));
    console.log("------------------------");
  });
}

main().catch(console.error);
