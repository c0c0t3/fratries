// Remet toutes les fratries à "a_chercher" (par=null, note effacée).
// Destructif pour la progression en cours : confirmation obligatoire.
import { doc, writeBatch } from "firebase/firestore";
import { readFile } from "node:fs/promises";
import { db } from "./_firebase-node.mjs";
import { confirmer } from "./_confirm.mjs";

const data = JSON.parse(await readFile(new URL("../data/fratries.json", import.meta.url)));
const ids = data.fratries.map((f) => f.id);

const ok = await confirmer(
  `Ceci va remettre les ${ids.length} fratries à "a_chercher" et effacer toute la progression actuelle.`,
  "RESET"
);
if (!ok) {
  console.log("Annulé.");
  process.exit(1);
}

console.log(`Reset de ${ids.length} fratries...`);
const CHUNK = 400;
for (let i = 0; i < ids.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const id of ids.slice(i, i + CHUNK)) {
    batch.set(doc(db, "fratries", id), { statut: "a_chercher", par: null, maj: null, note: "" });
  }
  await batch.commit();
  console.log(`  ${Math.min(i + CHUNK, ids.length)}/${ids.length}`);
}
console.log("Reset terminé.");
process.exit(0);
