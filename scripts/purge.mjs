// RGPD : supprime toute la collection Firestore après l'événement.
// Irréversible : confirmation obligatoire. Penser aussi à retirer
// data/fratries.json du dépôt/site une fois l'événement terminé.
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "./_firebase-node.mjs";
import { confirmer } from "./_confirm.mjs";

const ref = collection(db, "fratries");
const snap = await getDocs(ref);

if (snap.empty) {
  console.log("Collection déjà vide.");
  process.exit(0);
}

const ok = await confirmer(
  `Ceci va supprimer définitivement les ${snap.size} document(s) de la collection "fratries" (RGPD, après événement).`,
  "SUPPRIMER"
);
if (!ok) {
  console.log("Annulé.");
  process.exit(1);
}

let n = 0;
for (const d of snap.docs) {
  await deleteDoc(doc(db, "fratries", d.id));
  n++;
  if (n % 20 === 0) console.log(`  ${n}/${snap.size}`);
}
console.log(`Purge terminée : ${n} document(s) supprimé(s).`);
process.exit(0);
