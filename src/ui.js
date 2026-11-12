// Rendu de l'interface — DOM via chaînes de template + délégation d'événements.
// Pas de framework : ~90 fratries, pas besoin de virtual DOM.
import { construireSections, batimentDepuisLieu, estAVerifier } from "./data.js";
import {
  abonner,
  etatFratrie,
  etatConnexionActuel,
  prendreEnCharge,
  avancerStatut,
  marquerAbsent,
  annulerPriseEnCharge,
  enregistrerNote,
} from "./store.js";

const STATUT_LABELS = {
  a_chercher: "À chercher",
  en_route: "En route",
  au_studio: "Au studio",
  photographie: "Photographié",
  absent: "Absent",
};

const BATIMENT_CLASSES = {
  Maternelle: "maternelle",
  Foch: "foch",
  Vosges: "vosges",
  Filles: "filles",
};

const TOURNEES = [
  { id: 1, titre: "T1 · Maternelle", batiment: "Maternelle" },
  { id: 2, titre: "T2 · Filles", batiment: "Filles" },
  { id: 3, titre: "T3 · Foch", batiment: "Foch" },
  { id: 4, titre: "T4 · Vosges", batiment: "Vosges" },
];

function echapper(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function afficherEcranChoixUtilisateur(onChoisi) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="ecran-choix">
      <h1>Fratries Photo</h1>
      <p>Qui es-tu ?</p>
      <div class="choix-utilisateur">
        <button class="btn-choix" data-qui="Alain">Alain</button>
        <button class="btn-choix" data-qui="Tom">Tom</button>
      </div>
    </div>
  `;
  app.querySelectorAll("[data-qui]").forEach((btn) => {
    btn.addEventListener("click", () => onChoisi(btn.dataset.qui));
  });
}

export function afficherApp({ data, integrite, utilisateur, onChangerUtilisateur }) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="entete">
      <div class="entete-haut">
        <strong id="progression">—</strong>
        <span id="connexion" class="connexion"></span>
        <button class="btn-utilisateur" id="btn-utilisateur">${echapper(utilisateur)}</button>
      </div>
      <nav class="onglets" id="onglets">
        ${TOURNEES.map((t) => `<button class="onglet" data-onglet="T${t.id}">${t.titre}</button>`).join("")}
        <button class="onglet" data-onglet="seuls">Seuls</button>
        <button class="onglet" data-onglet="controle">Contrôle</button>
      </nav>
      <div class="filtres" id="filtres">
        <button class="filtre" data-filtre="tout">Tout</button>
        <button class="filtre" data-filtre="restantes">Restantes</button>
        <button class="filtre" data-filtre="mes">Mes fratries</button>
      </div>
    </header>
    <main id="contenu"></main>
    <dialog id="dialogue-menu"></dialog>
    <div id="toast" class="toast" hidden></div>
  `;

  const CLE_ONGLET = "fratries_onglet";
  const CLE_FILTRE = "fratries_filtre";
  let ongletActif = localStorage.getItem(CLE_ONGLET) || "T1";
  let filtreActif = localStorage.getItem(CLE_FILTRE) || "tout";

  const contenu = document.getElementById("contenu");
  const dialogueMenu = document.getElementById("dialogue-menu");

  document.getElementById("btn-utilisateur").addEventListener("click", () => {
    if (confirm(`Changer d'utilisateur (actuellement ${utilisateur}) ?`)) onChangerUtilisateur();
  });

  function majOngletsActifs() {
    document.querySelectorAll("#onglets .onglet").forEach((b) => {
      b.classList.toggle("actif", b.dataset.onglet === ongletActif);
    });
    document.querySelectorAll("#filtres .filtre").forEach((b) => {
      b.classList.toggle("actif", b.dataset.filtre === filtreActif);
    });
  }

  document.getElementById("onglets").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-onglet]");
    if (!btn) return;
    ongletActif = btn.dataset.onglet;
    localStorage.setItem(CLE_ONGLET, ongletActif);
    majOngletsActifs();
    rendreContenu();
  });

  document.getElementById("filtres").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-filtre]");
    if (!btn) return;
    filtreActif = btn.dataset.filtre;
    localStorage.setItem(CLE_FILTRE, filtreActif);
    majOngletsActifs();
    rendreContenu();
  });

  contenu.addEventListener("click", (ev) => gererClicAction(ev, utilisateur, dialogueMenu, data));

  function passeLeFiltre(etat) {
    if (filtreActif === "mes") return etat.par === utilisateur;
    if (filtreActif === "restantes") return etat.statut !== "photographie" && etat.statut !== "absent";
    return true;
  }

  function rendreEntete() {
    const total = data.fratries.length;
    const faites = data.fratries.filter((f) => etatFratrie(f.id).statut === "photographie").length;
    document.getElementById("progression").textContent = `${faites} / ${total} photographiées`;

    const cx = etatConnexionActuel();
    const el = document.getElementById("connexion");
    if (!cx.enLigne) {
      el.textContent = "🔴 Hors ligne";
      el.className = "connexion hors-ligne";
    } else if (cx.enSync) {
      el.textContent = "🟡 Synchronisation…";
      el.className = "connexion sync";
    } else {
      el.textContent = "🟢 En ligne";
      el.className = "connexion en-ligne";
    }
  }

  function rendreContenu() {
    if (ongletActif === "seuls") {
      contenu.innerHTML = rendreOngletSeuls(data.sansFratrie);
    } else if (ongletActif === "controle") {
      contenu.innerHTML = rendreOngletControle(data, integrite);
    } else {
      const numTournee = Number(ongletActif.replace("T", ""));
      contenu.innerHTML = rendreOngletTournee(data, numTournee, passeLeFiltre);
    }
  }

  function toutRendre() {
    rendreEntete();
    rendreContenu();
  }

  majOngletsActifs();
  toutRendre();
  abonner(toutRendre);
}

function rendreOngletTournee(data, numTournee, passeLeFiltre) {
  const fratriesTournee = data.fratries.filter((f) => f.tournee === numTournee);
  if (fratriesTournee.length === 0) return `<p class="vide">Aucune fratrie dans cette tournée.</p>`;

  const priorite = fratriesTournee[0].priorite === "avec_maternelle" ? "AVEC MATERNELLE" : "SANS MATERNELLE";
  const blocs = construireSections(fratriesTournee);

  const html = blocs
    .map((bloc) => {
      const classe = data.classes[bloc.classeDepart] || {};
      const batCls = BATIMENT_CLASSES[classe.batiment] || "";
      const corpsBloc = bloc.sousBlocs
        .map((sb) => {
          const cartes = sb.fratries
            .map((f) => carteFratrieHTML(f, passeLeFiltre))
            .filter(Boolean)
            .join("");
          if (!cartes) return "";
          const bandeauArret = sb.arretsSuivants ? `<div class="bandeau-arret">${echapper(sb.arretsSuivants)}</div>` : "";
          return bandeauArret + cartes;
        })
        .join("");
      if (!corpsBloc) return "";
      return `
        <section class="bloc">
          <div class="bandeau-classe bandeau--${batCls}">
            ALLER EN CLASSE : ${echapper(bloc.classeDepart)} (${echapper(classe.etage || "?")}, ${echapper(classe.enseignant || "?")}) — ${bloc.nbEnfants} enfants
          </div>
          ${corpsBloc}
        </section>
      `;
    })
    .join("");

  return `<div class="bandeau-priorite">${priorite}</div>${html || '<p class="vide">Aucune fratrie avec ce filtre.</p>'}`;
}

function carteFratrieHTML(f, passeLeFiltre) {
  const etat = etatFratrie(f.id);
  if (!passeLeFiltre(etat)) return "";

  const terminee = etat.statut === "photographie" || etat.statut === "absent";
  const badgePar = etat.par ? ` · ${echapper(etat.par)}` : "";

  const enfantsHTML = f.enfants
    .map((e) => {
      const bat = batimentDepuisLieu(e.lieu);
      const batCls = BATIMENT_CLASSES[bat] || "";
      const verif = estAVerifier(e.remarque) ? `<span class="badge-verifier">à vérifier</span>` : "";
      const remarque = e.remarque && !estAVerifier(e.remarque) ? `<span class="remarque">${echapper(e.remarque)}</span>` : "";
      return `
        <li>
          <span class="ordre">${echapper(e.ordre)}</span>
          <span class="prenom">${echapper(e.prenom)}</span>
          <span class="niveau">${echapper(e.niveau)}</span>
          <span class="lieu chip chip--${batCls}">${echapper(e.classe)} · ${echapper(e.lieu)}</span>
          ${verif}${remarque}
        </li>
      `;
    })
    .join("");

  const noteHTML = etat.note ? `<p class="note">Note : ${echapper(etat.note)}</p>` : "";
  const bouton = boutonPrincipalHTML(f.id, etat.statut);

  const corps = `
    <header>
      <h3>${echapper(f.famille)}</h3>
      <span class="badge-statut badge--${etat.statut}">${STATUT_LABELS[etat.statut]}${badgePar}</span>
    </header>
    <ul class="liste-enfants">${enfantsHTML}</ul>
    ${noteHTML}
    <div class="actions">
      ${bouton}
      <button class="btn-menu" data-action="menu" data-id="${f.id}" aria-label="Plus d'options">⋯</button>
    </div>
  `;

  if (terminee) {
    return `
      <details class="carte-fratrie carte-repliee badge--${etat.statut}" data-id="${f.id}">
        <summary>${echapper(f.famille)} — ${STATUT_LABELS[etat.statut]}${badgePar}</summary>
        ${corps}
      </details>
    `;
  }

  return `<article class="carte-fratrie badge--${etat.statut}" data-id="${f.id}">${corps}</article>`;
}

function boutonPrincipalHTML(id, statut) {
  const actions = {
    a_chercher: { label: "Je prends", action: "prendre" },
    en_route: { label: "Au studio", action: "studio" },
    au_studio: { label: "Photographié", action: "photographie" },
  };
  const a = actions[statut];
  if (!a) return "";
  return `<button class="btn-action btn-action--${statut}" data-action="${a.action}" data-id="${id}">${a.label}</button>`;
}

function rendreOngletSeuls(sansFratrie) {
  const lignes = sansFratrie
    .map((e) => {
      const bat = batimentDepuisLieu(e.lieu);
      const batCls = BATIMENT_CLASSES[bat] || "";
      const verif = e.remarque ? `<span class="badge-verifier">à vérifier</span>` : "";
      return `
        <li class="carte-fratrie">
          <header><h3>${echapper(e.famille)} ${echapper(e.prenom)}</h3></header>
          <p>${echapper(e.niveau)} — ${echapper(e.classe)}
            <span class="chip chip--${batCls}">${echapper(e.lieu)}</span>
          </p>
          ${verif}
          ${e.remarque ? `<p class="remarque">${echapper(e.remarque)}</p>` : ""}
        </li>
      `;
    })
    .join("");
  return `
    <p class="vide">${sansFratrie.length} élève(s) sans fratrie — non planifiés, infos à vérifier.</p>
    <ul class="liste-sans-fratrie">${lignes}</ul>
  `;
}

function rendreOngletControle(data, integrite) {
  const parTournee = {};
  for (const f of data.fratries) {
    const t = f.tournee;
    parTournee[t] ??= { familles: 0, faites: 0, eleves: 0, elevesFaits: 0 };
    parTournee[t].familles++;
    parTournee[t].eleves += f.enfants.length;
    if (etatFratrie(f.id).statut === "photographie") {
      parTournee[t].faites++;
      parTournee[t].elevesFaits += f.enfants.length;
    }
  }

  const parStatut = { a_chercher: 0, en_route: 0, au_studio: 0, photographie: 0, absent: 0 };
  for (const f of data.fratries) parStatut[etatFratrie(f.id).statut]++;

  const alerte = integrite.ok
    ? `<p class="alerte-ok">✅ Données conformes : 88 fratries, 197 élèves (190 + 7).</p>`
    : `<p class="alerte-erreur">⚠️ Incohérence dans les données : ${integrite.problemes.map(echapper).join(" · ")}</p>`;

  const lignesTournee = TOURNEES.map((t) => {
    const s = parTournee[t.id] || { familles: 0, faites: 0, eleves: 0, elevesFaits: 0 };
    return `<tr><td>${t.titre}</td><td>${s.faites}/${s.familles}</td><td>${s.elevesFaits}/${s.eleves}</td></tr>`;
  }).join("");

  const lignesStatut = Object.entries(parStatut)
    .map(([statut, n]) => `<tr><td>${STATUT_LABELS[statut]}</td><td>${n}</td></tr>`)
    .join("");

  return `
    ${alerte}
    <h2>Par tournée</h2>
    <table class="table-controle"><thead><tr><th>Tournée</th><th>Fratries</th><th>Élèves</th></tr></thead>
      <tbody>${lignesTournee}</tbody></table>
    <h2>Par statut</h2>
    <table class="table-controle"><thead><tr><th>Statut</th><th>Nombre</th></tr></thead>
      <tbody>${lignesStatut}</tbody></table>
    <p class="vide">Total élèves attendu : ${integrite.totalEleves} (${integrite.nbEnfantsFratries} en fratries + ${integrite.nbSansFratrie} seuls)</p>
  `;
}

async function gererClicAction(ev, utilisateur, dialogueMenu, data) {
  const btn = ev.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  try {
    if (action === "prendre") {
      await prendreEnCharge(id, utilisateur);
    } else if (action === "studio") {
      await avancerStatut(id, "en_route");
    } else if (action === "photographie") {
      await avancerStatut(id, "au_studio");
    } else if (action === "menu") {
      ouvrirMenu(dialogueMenu, id, data);
    }
  } catch (e) {
    if (String(e.message).startsWith("DEJA_PRIS")) {
      afficherToast(`Déjà pris par ${e.message.split(":")[1]}`);
    } else {
      afficherToast(`Erreur : ${e.message}`);
      console.error(e);
    }
  }
}

function ouvrirMenu(dialogueMenu, id, data) {
  const fratrie = data.fratries.find((f) => f.id === id);
  const etat = etatFratrie(id);
  dialogueMenu.innerHTML = `
    <div class="menu-contenu">
      <h3>${echapper(fratrie?.famille || id)}</h3>
      ${etat.statut !== "absent" ? `<button class="btn-menu-item" data-menu="absent">Marquer absent</button>` : ""}
      ${etat.statut === "absent" ? `<button class="btn-menu-item" data-menu="reactiver">Réactiver (à chercher)</button>` : ""}
      ${etat.statut !== "a_chercher" ? `<button class="btn-menu-item" data-menu="annuler">Annuler la prise en charge</button>` : ""}
      <label class="menu-note-label">
        Note
        <textarea class="menu-note" rows="2">${echapper(etat.note)}</textarea>
      </label>
      <button class="btn-menu-item" data-menu="note">Enregistrer la note</button>
      <button class="btn-menu-item btn-menu-fermer" data-menu="fermer">Fermer</button>
    </div>
  `;
  dialogueMenu.showModal();

  dialogueMenu.onclick = async (ev) => {
    const b = ev.target.closest("[data-menu]");
    if (!b) return;
    try {
      if (b.dataset.menu === "absent") await marquerAbsent(id);
      else if (b.dataset.menu === "reactiver" || b.dataset.menu === "annuler") await annulerPriseEnCharge(id);
      else if (b.dataset.menu === "note") {
        const texte = dialogueMenu.querySelector(".menu-note").value;
        await enregistrerNote(id, texte);
      }
    } catch (e) {
      afficherToast(`Erreur : ${e.message}`);
      console.error(e);
    }
    dialogueMenu.close();
  };
}

let toastTimer = null;
function afficherToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}
