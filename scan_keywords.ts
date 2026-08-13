import fs from "fs";
import path from "path";

const keywords = [
  "temporaryPassword",
  "mustChangePassword",
  "sendPasswordResetEmail",
  "confirmPasswordReset",
  "verifyPasswordResetCode",
  "onAuthStateChanged",
  "deleted_users",
  "deleteDoc",
  "isPreAuthorized",
  "pending_",
  "whitelist",
  "invite",
  "users"
];

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
      const content = fs.readFileSync(full, "utf-8");
      keywords.forEach(kw => {
        if (content.includes(kw)) {
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            if (line.includes(kw)) {
              console.log(`${full}:${idx + 1} - Keyword [${kw}]: ${line.trim().substring(0, 100)}`);
            }
          });
        }
      });
    }
  }
}

console.log("=== GREP / BUSCA DE KEYWORDS EM SRC/ ===");
scanDir("./src");
