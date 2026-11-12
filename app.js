import { chargerDonneesStatiques, verifierIntegrite } from "./src/data.js";
import { demarrerEcoute } from "./src/store.js";
import { afficherEcranChoixUtilisateur, afficherApp } from "./src/ui.js";

const CLE_UTILISATEUR = "fratries_utilisateur";

async function demarrer() {
  const data = await chargerDonneesStatiques();
  const integrite = verifierIntegrite(data);
  if (!integrite.ok) console.warn("Incohérence fratries.json :", integrite.problemes);

  const utilisateur = localStorage.getItem(CLE_UTILISATEUR);
  if (utilisateur) {
    lancerApp(data, integrite, utilisateur);
  } else {
    afficherEcranChoixUtilisateur((choix) => {
      localStorage.setItem(CLE_UTILISATEUR, choix);
      lancerApp(data, integrite, choix);
    });
  }
}

function lancerApp(data, integrite, utilisateur) {
  afficherApp({
    data,
    integrite,
    utilisateur,
    onChangerUtilisateur: () => {
      localStorage.removeItem(CLE_UTILISATEUR);
      location.reload();
    },
  });
  demarrerEcoute();
}

demarrer().catch((err) => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="erreur-fatale">Erreur de chargement : ${err.message}</div>`;
});
