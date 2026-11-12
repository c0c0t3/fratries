// Initialisation Firestore côté navigateur, SDK modulaire chargé depuis le CDN
// (pas de build). Pas d'Authentication : URL privée + règles ouvertes mais
// validées côté serveur (voir firestore.rules) — choix assumé pour cet événement.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

// Cache local persistant + support multi-onglets : le wifi de la cour est
// mauvais, les écritures hors ligne doivent survivre à un rafraîchissement.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const fratriesCollection = collection(db, "fratries");

export function fratrieDocRef(id) {
  return doc(db, "fratries", id);
}

export { onSnapshot, runTransaction, setDoc, serverTimestamp };
