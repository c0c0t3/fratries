// Chargement et contrôle d'intégrité des données statiques (fratries.json).
// Firestore ne stocke que l'état vivant (statut/par/maj/note) — tout le reste
// (noms, classes, ordre des tournées) vient d'ici et ne doit jamais être recalculé.

const DATA_URL = "./data/fratries.json";

export async function chargerDonneesStatiques() {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`Impossible de charger ${DATA_URL} (HTTP ${res.status})`);
  }
  return res.json();
}

export function verifierIntegrite(data) {
  const nbFratries = data.fratries.length;
  const nbEnfantsFratries = data.fratries.reduce((s, f) => s + f.enfants.length, 0);
  const nbSansFratrie = data.sansFratrie.length;
  const totalEleves = nbEnfantsFratries + nbSansFratrie;

  const problemes = [];
  if (nbFratries !== 88) problemes.push(`${nbFratries} fratries au lieu de 88`);
  if (nbEnfantsFratries !== 190) problemes.push(`${nbEnfantsFratries} élèves en fratrie au lieu de 190`);
  if (nbSansFratrie !== 7) problemes.push(`${nbSansFratrie} élèves seuls au lieu de 7`);
  if (totalEleves !== 197) problemes.push(`${totalEleves} élèves au total au lieu de 197`);

  return { ok: problemes.length === 0, problemes, nbFratries, nbEnfantsFratries, nbSansFratrie, totalEleves };
}

// Regroupe les fratries d'une tournée, triées par ordre global, en blocs par
// classe de départ ("troupeau"), puis en sous-blocs par arrêts suivants.
// Les fratries d'une tournée sont déjà contiguës par classeDepart/arretsSuivants
// dans fratries.json : on se contente de détecter les ruptures.
export function construireSections(fratriesTournee) {
  const triees = [...fratriesTournee].sort((a, b) => a.ordre - b.ordre);
  const blocs = [];
  let blocCourant = null;

  for (const f of triees) {
    if (!blocCourant || blocCourant.classeDepart !== f.classeDepart) {
      blocCourant = { classeDepart: f.classeDepart, sousBlocs: [], nbEnfants: 0 };
      blocs.push(blocCourant);
    }
    const cleArret = f.arretsSuivants || "";
    let sousBloc = blocCourant.sousBlocs[blocCourant.sousBlocs.length - 1];
    if (!sousBloc || sousBloc.arretsSuivants !== cleArret) {
      sousBloc = { arretsSuivants: cleArret, fratries: [] };
      blocCourant.sousBlocs.push(sousBloc);
    }
    sousBloc.fratries.push(f);
    blocCourant.nbEnfants += f.enfants.length;
  }

  return blocs;
}

export function batimentDepuisLieu(lieu) {
  if (!lieu) return null;
  return lieu.split(" ")[0];
}

export function estAVerifier(remarque) {
  return !!remarque && remarque.toUpperCase().includes("À VÉRIFIER");
}
