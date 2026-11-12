// Connexion Firestore côté Node pour les scripts d'admin (seed/reset/purge).
// Même config que le navigateur, SDK client installé en devDependency —
// pas d'Authentication, les règles Firestore doivent donc être en place.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../src/firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
