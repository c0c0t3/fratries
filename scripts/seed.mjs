// Crée les documents Firestore pour les 88 fratries, statut initial "a_chercher".
// Idempotent : relancer ne crée pas de doublons (même id = même doc). Si des
// fratries ont déjà de la progression, il faut passer --force pour écraser
// (évite d'effacer une prise en charge en cours par accident).
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { readFile } from "node:fs/promises";
import { db } from "./_firebase-node.mjs";

const data = JSON.parse(await readFile(new URL("../data/fratries.json", import.meta.url)));
const ids = data.fratries.map((f) => f.id);
const force = process.argv.includes("--force");

const ref = collection(db, "fratries");
const existant = await getDocs(ref);
const enProgres = existant.docs.filter((d) => (d.data().statut ?? "a_chercher") !== "a_chercher");

if (enProgres.length > 0 && !force) {
  console.error(
    `${enProgres.length} fratrie(s) ont déjà un statut différent de "a_chercher". ` +
      `Relance avec --force pour les écraser quand même, ou utilise "npm run reset" si c'est voulu.`
  );
  process.exit(1);
}

console.log(`Seed de ${ids.length} fratries...`);
const CHUNK = 400; // limite de 500 écritures par batch Firestore
for (let i = 0; i < ids.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const id of ids.slice(i, i + CHUNK)) {
    batch.set(doc(db, "fratries", id), { statut: "a_chercher", par: null, maj: null, note: "" });
  }
  await batch.commit();
  console.log(`  ${Math.min(i + CHUNK, ids.length)}/${ids.length}`);
}
console.log("Seed terminé.");
process.exit(0);
