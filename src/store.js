// État vivant (statut/par/maj/note) synchronisé depuis Firestore, + actions
// qui écrivent dans Firestore. Un simple pub-sub : pas besoin de framework
// pour 88 documents et deux utilisateurs.
import {
  db,
  fratriesCollection,
  fratrieDocRef,
  onSnapshot,
  runTransaction,
  setDoc,
  serverTimestamp,
} from "./firebase.js";

const DEFAUT = Object.freeze({ statut: "a_chercher", par: null, maj: null, note: "" });

export const live = new Map(); // id -> { statut, par, maj, note }
export const enAttenteSync = new Set(); // ids avec écriture locale pas encore confirmée par le serveur

const abonnes = new Set();

export function abonner(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

function notifier() {
  abonnes.forEach((fn) => fn());
}

export function etatFratrie(id) {
  return live.get(id) ?? DEFAUT;
}

let etatConnexion = { enLigne: navigator.onLine, enSync: false };

export function etatConnexionActuel() {
  return { ...etatConnexion, enSync: enAttenteSync.size > 0 };
}

window.addEventListener("online", () => {
  etatConnexion.enLigne = true;
  notifier();
});
window.addEventListener("offline", () => {
  etatConnexion.enLigne = false;
  notifier();
});

export function demarrerEcoute() {
  return onSnapshot(
    fratriesCollection,
    { includeMetadataChanges: true },
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === "removed") {
          live.delete(id);
          enAttenteSync.delete(id);
          return;
        }
        const d = change.doc.data();
        live.set(id, {
          statut: d.statut ?? "a_chercher",
          par: d.par ?? null,
          maj: d.maj ?? null,
          note: d.note ?? "",
        });
        if (change.doc.metadata.hasPendingWrites) enAttenteSync.add(id);
        else enAttenteSync.delete(id);
      });
      notifier();
    },
    (err) => {
      console.error("Erreur de synchronisation Firestore :", err);
    }
  );
}

const SUIVANT = { a_chercher: "en_route", en_route: "au_studio", au_studio: "photographie" };

// Anti-collision : "prendre en charge" vérifie en transaction que la fratrie
// est bien encore à chercher. Les transactions Firestore exigent le réseau ;
// hors ligne, on bascule sur une écriture optimiste (pas de garantie anti-
// collision tant qu'on n'a pas de wifi, cas rare et accepté).
export async function prendreEnCharge(id, utilisateur) {
  const ref = fratrieDocRef(id);

  if (!navigator.onLine) {
    await setDoc(ref, { statut: "en_route", par: utilisateur, maj: serverTimestamp() }, { merge: true });
    return;
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const statutActuel = snap.exists() ? snap.data().statut ?? "a_chercher" : "a_chercher";
    if (statutActuel !== "a_chercher") {
      const parActuel = snap.exists() ? snap.data().par : null;
      throw new Error(`DEJA_PRIS:${parActuel ?? "quelqu'un"}`);
    }
    tx.set(ref, { statut: "en_route", par: utilisateur, maj: serverTimestamp() }, { merge: true });
  });
}

export async function avancerStatut(id, statutAttendu) {
  const statutSuivant = SUIVANT[statutAttendu];
  if (!statutSuivant) return;
  const ref = fratrieDocRef(id);
  await setDoc(ref, { statut: statutSuivant, maj: serverTimestamp() }, { merge: true });
}

export async function marquerAbsent(id) {
  const ref = fratrieDocRef(id);
  await setDoc(ref, { statut: "absent", maj: serverTimestamp() }, { merge: true });
}

export async function annulerPriseEnCharge(id) {
  const ref = fratrieDocRef(id);
  await setDoc(ref, { statut: "a_chercher", par: null, maj: serverTimestamp() }, { merge: true });
}

export async function enregistrerNote(id, note) {
  const ref = fratrieDocRef(id);
  await setDoc(ref, { note, maj: serverTimestamp() }, { merge: true });
}
