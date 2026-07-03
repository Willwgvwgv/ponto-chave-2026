import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

// Load configuration
const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  console.log("=== BUSCANDO USUÁRIO IARA ===");
  const usersRef = collection(db, "users");
  const usersSnapshot = await getDocs(usersRef);
  let iaraUser: any = null;
  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.displayName?.toLowerCase().includes("iara") || data.email?.toLowerCase().includes("iara") || doc.id.toLowerCase().includes("iara")) {
      iaraUser = { id: doc.id, ...data };
      console.log("Iara encontrada:", iaraUser);
    }
  });

  if (!iaraUser) {
    console.log("Nenhum usuário com 'Iara' no nome ou email ou ID.");
    // List all users to be sure
    console.log("Lista completa de usuários:");
    usersSnapshot.forEach((doc) => {
      console.log(`- ID: ${doc.id}, Name: ${doc.data().displayName}, Email: ${doc.data().email}, Role: ${doc.data().role}`);
    });
  }

  console.log("\n=== BUSCANDO TAREFAS ===");
  const tasksRef = collection(db, "tasks");
  const tasksSnapshot = await getDocs(tasksRef);
  console.log(`Total de tarefas cadastradas no Firestore: ${tasksSnapshot.size}`);
  
  tasksSnapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`Tarefa ID: ${doc.id}`);
    console.log(JSON.stringify(data, null, 2));
    console.log("------------------------");
  });
}

main().catch(console.error);
