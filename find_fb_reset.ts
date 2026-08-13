import fs from "fs";

const fbCode = fs.readFileSync("./src/firebase.ts", "utf-8");
const lines = fbCode.split("\n");

lines.forEach((l, i) => {
  if (l.includes("sendPasswordResetEmail")) {
    console.log(`Line ${i + 1}: ${l.trim()}`);
  }
});
