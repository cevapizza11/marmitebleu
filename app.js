// ============================================================
// CONFIG FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDhqKmCJJx5ScXUxaoip1eMiy10P0BvD9U",
  authDomain: "marmite-bleue.firebaseapp.com",
  projectId: "marmite-bleue",
  storageBucket: "marmite-bleue.firebasestorage.app",
  messagingSenderId: "938472624829",
  appId: "1:938472624829:web:edd7453c2589c820dfddd4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let chartStats = null;
let chartAvis = null;
let currentTab = 'dashboard';
let panierMoyenGlobal = 20;

// ============================================================
// NAVIGATION TABS
// ============================================================
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('nav-' + tab).classList.add('active');

  if (tab === 'dashboard') chargerDashboard();
  if (tab === 'avis') chargerAvis();
  if (tab === 'reglages') chargerReglages();
  if (tab === 'import') initImport();
  if (tab === 'previsions') initPrevisions();
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  btn.textContent = "Connexion...";
  btn.disabled = true;

  auth.signInWithEmailAndPassword(email, password)
    .catch(error => {
      showToast("❌ " + traduireErreur(error.code), "error");
      btn.textContent = "Connexion";
      btn.disabled = false;
    });
}

function logout() {
  auth.signOut();
}

function traduireErreur(code) {
  const map = {
    'auth/wrong-password': 'Mot de passe incorrect',
    'auth/user-not-found': 'Utilisateur introuvable',
    'auth/invalid-email': 'Email invalide',
    'auth/too-many-requests': 'Trop de tentatives, réessaie plus tard'
  };
  return map[code] || 'Erreur de connexion';
}

// ============================================================
// AUTH STATE
// ============================================================
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("appWrapper").style.display = "block";
    document.getElementById("userEmail").textContent = user.email;
    showTab('dashboard');
    chargerReglagesInit();
  } else {
    document.getElementById("loginBox").style.display = "flex";
    document.getElementById("appWrapper").style.display = "none";
  }
});

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============================================================
// ============================================================
// MODULE 1 : SAISIE OPÉRATIONNELLE
// ============================================================
// ============================================================

async function analyser() {
  const btn = document.getElementById("btnAnalyser");
  btn.textContent = "Analyse en cours...";
  btn.disabled = true;

  // Lecture champs
  const clients    = +document.getElementById("clients").value || 0;
  const avis       = +document.getElementById("avis").value || 0;
  const note       = +document.getElementById("note").value || 0;
  const attente    = +document.getElementById("attente").value || 0;
  const employe    = document.getElementById("employe").value.trim();
  const tempMoules = +document.getElementById("tempMoules").value || 0;
  const caReel        = +document.getElementById("caReel").value || 0;
  const caPrev        = +document.getElementById("caPrev").value || 0;
  const ruptures   = document.getElementById("ruptures").value.trim();
  const absences   = document.getElementById("absences").value.trim();

  // Calculs
  const taux = clients > 0 ? ((avis / clients) * 100).toFixed(1) : 0;
  const caRef = caPrev > 0 ? caPrev : (clients * panierMoyenGlobal);
  const ecartCA = caReel > 0 ? caReel - caRef : 0;

  // ---- SCORE SUR 100 ----
  // 1. Note Google → 40 pts (0-5 → 0-40)
  const ptsNote = note > 0 ? ((note / 5) * 40) : 0;

  // 2. Température moules → 25 pts
  //    ≥ 82°C = 25pts | 80-82 = 18pts | 75-80 = 10pts | <75 = 0pts | non saisi = 20pts (neutre)
  let ptsTemp = 20; // neutre si non saisi
  if (tempMoules > 0) {
    if (tempMoules >= 82)      ptsTemp = 25;
    else if (tempMoules >= 80) ptsTemp = 18;
    else if (tempMoules >= 75) ptsTemp = 10;
    else                       ptsTemp = 0;
  }

  // 3. Ruptures de stock → 15 pts
  //    Aucune rupture = 15pts | rupture = 5pts
  const hasRupture = ruptures && ruptures.toLowerCase() !== 'non' && ruptures.trim() !== '';
  const ptsRupture = hasRupture ? 5 : 15;

  // 4. Temps d'attente → 10 pts
  //    ≤ 3min = 10pts | ≤ 5min = 8pts | ≤ 8min = 5pts | >8min = 0pts | non saisi = 8pts
  let ptsAttente = 8;
  if (attente > 0) {
    if (attente <= 3)      ptsAttente = 10;
    else if (attente <= 5) ptsAttente = 8;
    else if (attente <= 8) ptsAttente = 5;
    else                   ptsAttente = 0;
  }

  // 5. CA réel vs prévisionnel → 7 pts
  //    Écart ≤ -10% = 0pts | -10% à 0% = 4pts | ≥ 0% = 7pts | non saisi = 4pts
  let ptsCA = 4;
  if (caReel > 0 && caRef > 0) {
    const pctEcart = (ecartCA / caRef) * 100;
    if (pctEcart >= 0)       ptsCA = 7;
    else if (pctEcart >= -10) ptsCA = 4;
    else                      ptsCA = 0;
  }

  // 6. Taux d'avis → 3 pts
  //    ≥ 10% = 3pts | ≥ 5% = 2pts | < 5% = 1pt | non saisi = 1pt
  let ptsTaux = 1;
  if (clients > 0) {
    if (parseFloat(taux) >= 10)     ptsTaux = 3;
    else if (parseFloat(taux) >= 5) ptsTaux = 2;
    else                            ptsTaux = 1;
  }

  const score = Math.round(ptsNote + ptsTemp + ptsRupture + ptsAttente + ptsCA + ptsTaux);
  const scoreDetail = { ptsNote, ptsTemp, ptsRupture, ptsAttente, ptsCA, ptsTaux };

  const data = {
    date: new Date(),
    clients, avis, note, attente, employe,
    tempMoules, caReel, ruptures, absences,
    taux: parseFloat(taux), score, scoreDetail, caPrev, caRef,
    ecartCA
  };

  try {
    await db.collection("stats").add(data);
    afficherResultat(data);
    showToast("✅ Journée enregistrée !");
    chargerDashboard();
    document.getElementById("formSaisie").reset();
  } catch(e) {
    console.error("ERREUR FIRESTORE stats:", e.code, e.message);
    showToast("❌ " + (e.message || "Erreur d'enregistrement"), "error");
  }

  btn.textContent = "Analyser la journée";
  btn.disabled = false;
}

// ============================================================
// AFFICHAGE RÉSULTAT + PLAN D'ACTION
// ============================================================
function afficherResultat(d) {
  const alertes = [];
  const actions = [];

  // --- Note Google
  if (d.note < 4.0) {
    alertes.push({ icon: "🔴", label: "Note critique", detail: `${d.note}/5` });
    actions.push({ priorite: "URGENT", texte: "Réunion équipe immédiate — identifier les réclamations récentes et revoir les process de service" });
  } else if (d.note < 4.5) {
    alertes.push({ icon: "🟡", label: "Note faible", detail: `${d.note}/5` });
    actions.push({ priorite: "AUJOURD'HUI", texte: "Vérifier les derniers avis Google — former l'équipe sur l'accueil et la qualité" });
  }

  // --- Taux d'avis
  if (d.taux < 5) {
    alertes.push({ icon: "🟡", label: "Peu d'avis récoltés", detail: `${d.taux}% des clients` });
    actions.push({ priorite: "CETTE SEMAINE", texte: "Activer la demande d'avis systématique à l'encaissement — afficher le QR code en salle" });
  }

  // --- Temps d'attente
  if (d.attente > 8) {
    alertes.push({ icon: "🔴", label: "Attente critique", detail: `${d.attente} min` });
    actions.push({ priorite: "URGENT", texte: "Analyser le goulot : friteuses ou chaudrons ? Envisager renfort production en peak" });
  } else if (d.attente > 5) {
    alertes.push({ icon: "🟡", label: "Attente élevée", detail: `${d.attente} min` });
    actions.push({ priorite: "DEMAIN", texte: "Revoir le flux de production — préchauffe des chaudrons anticipée" });
  }

  // --- Température moules
  if (d.tempMoules > 0) {
    if (d.tempMoules < 75) {
      alertes.push({ icon: "🔴", label: "Moules insuffisamment chaudes", detail: `${d.tempMoules}°C` });
      actions.push({ priorite: "URGENT", texte: "Contrôle immédiat chaudrons — vérifier thermostat et temps de cuisson — ne pas servir en dessous de 80°C à cœur" });
    } else if (d.tempMoules < 80) {
      alertes.push({ icon: "🟡", label: "Température moules limite", detail: `${d.tempMoules}°C` });
      actions.push({ priorite: "AUJOURD'HUI", texte: "Prolonger légèrement le temps de cuisson — revérifier à la prochaine fournée" });
    }
  }

  // --- CA réel vs théorique
  if (d.caReel > 0) {
    const caBase = (d.caPrev > 0) ? d.caPrev : (d.clients * panierMoyenGlobal);
    const ecartPct = caBase > 0 ? ((d.ecartCA / caBase) * 100).toFixed(1) : 0;
    if (d.ecartCA < -(d.clients * 12 * 0.1)) {
      alertes.push({ icon: "🔴", label: "CA réel bien en dessous du théorique", detail: `${d.ecartCA > 0 ? '+' : ''}${d.ecartCA}€ (${ecartPct}%)` });
      actions.push({ priorite: "AUJOURD'HUI", texte: "Vérifier la caisse — contrôle des formules jetons utilisées vs encaissements — possible erreur ou fraude" });
    } else if (d.ecartCA > (d.clients * 12 * 0.15)) {
      alertes.push({ icon: "🟢", label: "CA supérieur au théorique", detail: `+${d.ecartCA}€` });
      actions.push({ priorite: "INFO", texte: "Bonne performance — identifier ce qui a dopé les ventes (boissons, extras, événement ?)" });
    }
  }

  // --- Ruptures
  if (d.ruptures && d.ruptures.toLowerCase() !== 'non' && d.ruptures !== '') {
    alertes.push({ icon: "🟡", label: "Ruptures de stock", detail: d.ruptures });
    actions.push({ priorite: "DEMAIN MATIN", texte: `Commander en urgence : ${d.ruptures} — revoir les niveaux de stock minimum` });
  }

  // --- Absences
  if (d.absences && d.absences.toLowerCase() !== 'non' && d.absences !== '') {
    alertes.push({ icon: "🟡", label: "Absentéisme", detail: d.absences });
    actions.push({ priorite: "AUJOURD'HUI", texte: `Absence(s) : ${d.absences} — activer le plan de remplacement ou réorganiser les postes` });
  }

  // --- Tout OK
  if (alertes.length === 0) {
    alertes.push({ icon: "✅", label: "Tout est nominal", detail: "Bonne journée !" });
    actions.push({ priorite: "MAINTENIR", texte: "Performance au vert — capitaliser sur ce qui fonctionne, briefer l'équipe positivement" });
  }

  // Score badge
  const scoreColor = d.score >= 80 ? '#2ecc71' : d.score >= 50 ? '#f39c12' : '#e74c3c';
  document.getElementById("scoreBadge").textContent = d.score;
  document.getElementById("scoreBadge").style.background = scoreColor;
  const caRefAff = d.caRef || (d.clients * panierMoyenGlobal);
  const caRefLabel = (d.caPrev > 0) ? 'CA prévu' : 'CA estimé';
  const ecartAff = d.caReel > 0 ? (d.ecartCA >= 0 ? '+' : '') + d.ecartCA + '€' : '—';
  document.getElementById("caInfo").textContent =
    `CA réel : ${d.caReel > 0 ? d.caReel + '€' : 'non saisi'} | ${caRefLabel} : ${caRefAff}€ | Écart : ${ecartAff} | Avis : ${d.taux}%`;

  // Détail du score
  if (d.scoreDetail) {
    const sd = d.scoreDetail;
    document.getElementById("scoreDetail").innerHTML =
      `<span title="Note Google">⭐ ${sd.ptsNote.toFixed(0)}/40</span>
       <span title="Moules">🌡️ ${sd.ptsTemp}/25</span>
       <span title="Ruptures">📦 ${sd.ptsRupture}/15</span>
       <span title="Attente">⏱️ ${sd.ptsAttente}/10</span>
       <span title="CA">💶 ${sd.ptsCA}/7</span>
       <span title="Avis">💬 ${sd.ptsTaux}/3</span>`;
    document.getElementById("scoreDetail").style.display = "flex";
  }

  // Alertes
  document.getElementById("alertesList").innerHTML = alertes.map(a =>
    `<div class="alerte-item">
      <span class="alerte-icon">${a.icon}</span>
      <div><strong>${a.label}</strong><span class="alerte-detail">${a.detail}</span></div>
    </div>`
  ).join("");

  // Actions
  document.getElementById("actionsList").innerHTML = actions.map(a =>
    `<div class="action-item">
      <span class="action-prio prio-${a.priorite.toLowerCase().replace(/[^a-z]/g,'')}">${a.priorite}</span>
      <p>${a.texte}</p>
    </div>`
  ).join("");

  document.getElementById("resultatBox").style.display = "block";
  document.getElementById("resultatBox").scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// DASHBOARD : charger stats + graphiques
// ============================================================
async function chargerDashboard() {
  try {
    const snapshot = await db.collection("stats").orderBy("date", "asc").get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (data.length === 0) {
      document.getElementById("dashStats").innerHTML = '<p class="empty-state">Aucune donnée encore. Faites votre première saisie !</p>';
      return;
    }

    // KPIs
    const derniere = data[data.length - 1];
    const notesMoy = (data.reduce((s, d) => s + (d.note || 0), 0) / data.length).toFixed(2);
    const attenteMoy = (data.reduce((s, d) => s + (d.attente || 0), 0) / data.length).toFixed(1);
    const totalClients = data.reduce((s, d) => s + (d.clients || 0), 0);

    // CA — uniquement journées avec CA réel saisi
    const joursAvecCA = data.filter(d => d.caReel > 0);
    const totalCA = joursAvecCA.reduce((s, d) => s + (d.caReel || 0), 0);
    const caMoyJour = joursAvecCA.length > 0 ? Math.round(totalCA / joursAvecCA.length) : 0;
    const totalClientsAvecCA = joursAvecCA.reduce((s, d) => s + (d.clients || 0), 0);
    const panierMoyenReel = totalClientsAvecCA > 0 ? (totalCA / totalClientsAvecCA).toFixed(2) : 0;

    document.getElementById("kpi-note").textContent = notesMoy;
    document.getElementById("kpi-attente").textContent = attenteMoy + " min";
    document.getElementById("kpi-clients").textContent = totalClients;
    document.getElementById("kpi-sessions").textContent = data.length;
    document.getElementById("kpi-ca-total").textContent = totalCA > 0 ? totalCA.toLocaleString('fr-FR') + " €" : "—";
    document.getElementById("kpi-ca-moy").textContent = caMoyJour > 0 ? caMoyJour + " €" : "—";
    document.getElementById("kpi-ca-moy-client").textContent = panierMoyenReel > 0 ? panierMoyenReel + " €" : "—";

    // Graphique notes
    const labels = data.map((d, i) => {
      if (d.date && d.date.toDate) return d.date.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return `J${i+1}`;
    });
    const notes = data.map(d => d.note || 0);
    const scores = data.map(d => d.score || 0);

    if (chartStats) chartStats.destroy();
    const ctx = document.getElementById("chartStats").getContext("2d");
    chartStats = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Note /5",
            data: notes,
            borderColor: "#c9a84c",
            backgroundColor: "rgba(201,168,76,0.1)",
            yAxisID: 'y',
            tension: 0.4,
            pointRadius: 4
          },
          {
            label: "Score",
            data: scores,
            borderColor: "#4ab5e3",
            backgroundColor: "rgba(74,181,227,0.1)",
            yAxisID: 'y1',
            tension: 0.4,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#c9d6e3' } } },
        scales: {
          x: { ticks: { color: '#8aa0b5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { position: 'left', min: 0, max: 5, ticks: { color: '#c9a84c' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y1: { position: 'right', ticks: { color: '#4ab5e3' }, grid: { display: false } }
        }
      }
    });

    // Historique tableau
    const reversed = [...data].reverse().slice(0, 10);
    document.getElementById("historiqueTable").innerHTML = reversed.map(d => {
      const dateStr = d.date && d.date.toDate ? d.date.toDate().toLocaleDateString('fr-FR') : '—';
      const scoreClass = d.score >= 80 ? 'good' : d.score >= 50 ? 'mid' : 'bad';
      return `<tr>
        <td>${dateStr}</td>
        <td>${d.clients || 0}</td>
        <td>${d.note || '—'}</td>
        <td>${d.attente || 0} min</td>
        <td>${d.tempMoules ? d.tempMoules + '°C' : '—'}</td>
        <td>${d.caReel ? d.caReel + '€' : '—'}</td>
        <td><span class="badge-score ${scoreClass}">${d.score || 0}</span></td>
      </tr>`;
    }).join("");

  } catch(e) {
    console.error(e);
    showToast("Erreur chargement dashboard", "error");
  }
}

// ============================================================
// ============================================================
// MODULE 2 : AVIS GOOGLE
// ============================================================
// ============================================================

let modeAvis = 'texte'; // 'texte' ou 'rapide'

function setModeAvis(mode) {
  modeAvis = mode;
  document.getElementById('avis-mode-texte').classList.toggle('active', mode === 'texte');
  document.getElementById('avis-mode-rapide').classList.toggle('active', mode === 'rapide');
  document.getElementById('zone-texte').style.display = mode === 'texte' ? 'block' : 'none';
  document.getElementById('zone-rapide').style.display = mode === 'rapide' ? 'block' : 'none';
}

// Étoiles interactives
let noteAvisSelec = 0;
function setNoteAvis(n) {
  noteAvisSelec = n;
  document.querySelectorAll('.star-btn').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}

async function soumettreAvis() {
  const btn = document.getElementById("btnAvis");
  btn.textContent = "Analyse IA...";
  btn.disabled = true;

  let noteGoogle, texteAvis, motsCles;

  if (modeAvis === 'texte') {
    texteAvis = document.getElementById("texteAvis").value.trim();
    noteGoogle = +document.getElementById("noteGoogleTexte").value || 0;
    if (!texteAvis || !noteGoogle) {
      showToast("Remplis le texte et la note !", "error");
      btn.textContent = "Analyser et enregistrer";
      btn.disabled = false;
      return;
    }
  } else {
    noteGoogle = noteAvisSelec;
    motsCles = document.getElementById("motsClesRapide").value.trim();
    texteAvis = `[Saisie rapide] ${motsCles}`;
    if (!noteGoogle) {
      showToast("Sélectionne une note !", "error");
      btn.textContent = "Analyser et enregistrer";
      btn.disabled = false;
      return;
    }
  }

  // Analyse IA via Claude
  let analyse = { sentiment: 'neutre', resume: '', reponse: '', motsCles: [] };
  try {
    analyse = await analyserAvisIA(texteAvis, noteGoogle);
  } catch(e) {
    console.error("Erreur IA:", e);
    analyse.resume = "Analyse IA indisponible";
    analyse.sentiment = noteGoogle >= 4 ? 'positif' : noteGoogle <= 2 ? 'negatif' : 'neutre';
  }

  const avisData = {
    date: new Date(),
    note: noteGoogle,
    texte: texteAvis,
    sentiment: analyse.sentiment,
    resume: analyse.resume,
    reponseSuggeree: analyse.reponse,
    motsCles: analyse.motsCles,
    mode: modeAvis
  };

  try {
    await db.collection("avis").add(avisData);
    afficherAnalyseAvis(avisData);
    showToast("✅ Avis enregistré !");
    chargerAvis();
    // Reset
    document.getElementById("texteAvis").value = '';
    document.getElementById("noteGoogleTexte").value = '';
    document.getElementById("motsClesRapide").value = '';
    noteAvisSelec = 0;
    setNoteAvis(0);
  } catch(e) {
    showToast("❌ Erreur d'enregistrement", "error");
  }

  btn.textContent = "Analyser et enregistrer";
  btn.disabled = false;
}

// ============================================================
// ANALYSE IA (Claude API)
// ============================================================
async function analyserAvisIA(texte, note) {
  const GROQ_KEY = "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";

  const prompt = `Tu es un expert en restauration. Analyse cet avis Google d un restaurant de moules-frites (La Marmite Bleue, Saint-Pierre-la-Mer).
Avis (note ${note}/5) : "${texte}"
Reponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou apres :
{"sentiment":"positif","resume":"resume en 1 phrase max 20 mots","motsCles":["mot1","mot2","mot3"],"reponse":"Reponse courtoise 2-3 phrases en francais"}`;

  console.log("🤖 Appel Groq...");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }]
    })
  });

  console.log("📡 Statut Groq:", response.status, response.statusText);

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ Erreur Groq HTTP:", errText);
    throw new Error("Groq HTTP " + response.status);
  }

  const data = await response.json();
  console.log("📦 Réponse Groq brute:", JSON.stringify(data).substring(0, 300));

  const rawText = data.choices[0].message.content.trim();
  console.log("📝 Texte Groq:", rawText.substring(0, 200));

  const clean = rawText.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  const s = (parsed.sentiment || "").toLowerCase();
  parsed.sentiment = s.includes("pos") ? "positif" : s.includes("neg") ? "negatif" : "neutre";

  console.log("✅ Analyse Groq OK:", parsed.sentiment);
  return parsed;
}

// ============================================================
// AFFICHAGE ANALYSE AVIS
// ============================================================
function afficherAnalyseAvis(d) {
  const sentimentColor = { positif: '#2ecc71', neutre: '#f39c12', negatif: '#e74c3c' };
  const sentimentLabel = { positif: '😊 Positif', neutre: '😐 Neutre', negatif: '😞 Négatif' };

  document.getElementById("avisResultat").innerHTML = `
    <div class="avis-result-card">
      <div class="avis-sentiment" style="background:${sentimentColor[d.sentiment]}20; border-left: 4px solid ${sentimentColor[d.sentiment]}">
        <strong>${sentimentLabel[d.sentiment]}</strong>
        <p>${d.resume}</p>
      </div>
      <div class="avis-mots">
        ${d.motsCles.map(m => `<span class="mot-cle">${m}</span>`).join("")}
      </div>
      <div class="avis-reponse">
        <h4>💬 Réponse suggérée</h4>
        <p>${d.reponseSuggeree}</p>
        <button onclick="copierReponse(this)" data-texte="${encodeURIComponent(d.reponseSuggeree)}" class="btn-copy">📋 Copier</button>
      </div>
    </div>
  `;
  document.getElementById("avisResultat").style.display = "block";
}

function copierReponse(btn) {
  const texte = decodeURIComponent(btn.getAttribute('data-texte'));
  navigator.clipboard.writeText(texte).then(() => {
    btn.textContent = "✅ Copié !";
    setTimeout(() => btn.textContent = "📋 Copier", 2000);
  });
}

// ============================================================
// CHARGER AVIS + GRAPHIQUE + MOTS-CLÉS
// ============================================================
async function chargerAvis() {
  try {
    const snapshot = await db.collection("avis").orderBy("date", "asc").get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (data.length === 0) {
      document.getElementById("avisHistorique").innerHTML = '<p class="empty-state">Aucun avis encore saisi.</p>';
      return;
    }

    // Stats globales
    const noteMoy = (data.reduce((s, d) => s + (d.note || 0), 0) / data.length).toFixed(2);
    const positifs = data.filter(d => d.sentiment === 'positif').length;
    const negatifs = data.filter(d => d.sentiment === 'negatif').length;
    const neutres = data.filter(d => d.sentiment === 'neutre').length;

    document.getElementById("avis-kpi-note").textContent = noteMoy + " ★";
    document.getElementById("avis-kpi-total").textContent = data.length;
    document.getElementById("avis-kpi-positifs").textContent = positifs;
    document.getElementById("avis-kpi-negatifs").textContent = negatifs;

    // Graphique évolution note
    const labels = data.map((d, i) => {
      if (d.date && d.date.toDate) return d.date.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      return `A${i+1}`;
    });
    const notes = data.map(d => d.note || 0);

    if (chartAvis) chartAvis.destroy();
    const ctx = document.getElementById("chartAvis").getContext("2d");
    chartAvis = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Note Google",
          data: notes,
          borderColor: "#c9a84c",
          backgroundColor: "rgba(201,168,76,0.15)",
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: notes.map(n => n >= 4 ? '#2ecc71' : n >= 3 ? '#f39c12' : '#e74c3c')
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#c9d6e3' } } },
        scales: {
          x: { ticks: { color: '#8aa0b5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { min: 0, max: 5, ticks: { color: '#c9a84c' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });

    // Mots-clés récurrents
    const allMots = data.flatMap(d => d.motsCles || []);
    const freq = {};
    allMots.forEach(m => freq[m.toLowerCase()] = (freq[m.toLowerCase()] || 0) + 1);
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);

    document.getElementById("nuageMots").innerHTML = sorted.map(([mot, n]) =>
      `<span class="mot-freq" style="font-size:${Math.min(0.8 + n * 0.2, 1.6)}rem; opacity:${Math.min(0.5 + n * 0.1, 1)}">${mot} <sup>${n}</sup></span>`
    ).join(" ");

    // Historique avis
    const reversed = [...data].reverse().slice(0, 15);
    document.getElementById("avisHistorique").innerHTML = reversed.map(d => {
      const dateStr = d.date && d.date.toDate ? d.date.toDate().toLocaleDateString('fr-FR') : '—';
      const sc = { positif: 'good', neutre: 'mid', negatif: 'bad' }[d.sentiment] || 'mid';
      const stars = '★'.repeat(d.note || 0) + '☆'.repeat(5 - (d.note || 0));
      return `<div class="avis-hist-item">
        <div class="avis-hist-header">
          <span class="stars ${sc}">${stars}</span>
          <span class="avis-hist-date">${dateStr}</span>
          <span class="badge-score ${sc}">${d.sentiment}</span>
        </div>
        <p class="avis-resume">${d.resume || d.texte?.substring(0, 80) || '—'}</p>
      </div>`;
    }).join("");

  } catch(e) {
    console.error(e);
    showToast("Erreur chargement avis", "error");
  }
}

// ============================================================
// ============================================================
// PRÉVISIONS
// ============================================================

function initPrevisions() {
  // Initialiser avec aujourd'hui si pas encore de date
  const hidden = document.getElementById("prevDate");
  if (!hidden.value) {
    const today = new Date().toISOString().split('T')[0];
    hidden.value = today;
  }
  majAffichageDate();
}

function changerDate(delta) {
  const hidden = document.getElementById("prevDate");
  const base = hidden.value ? new Date(hidden.value + "T12:00:00") : new Date();
  base.setDate(base.getDate() + delta);
  hidden.value = base.toISOString().split('T')[0];
  majAffichageDate();
}

function majAffichageDate() {
  const hidden = document.getElementById("prevDate");
  if (!hidden.value) return;
  const d = new Date(hidden.value + "T12:00:00");
  const jours = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const mois  = ["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];
  const affich = `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
  document.getElementById("prevDateAffichage").textContent = affich;
}

// Formater un montant en euros avec 2 décimales
function formatEuro(val) {
  return val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Variables prévisions globales pour recalcul à la volée
let prevState = {};

async function genererPrevisions() {
  const dateStr = document.getElementById("prevDate").value;
  const saison  = document.getElementById("prevSaison").value;
  const meteo   = document.getElementById("prevMeteo").value;
  const event   = document.getElementById("prevEvent").value;

  if (!dateStr) { showToast("Sélectionne une date !", "error"); return; }

  const btn = document.querySelector("#tab-previsions .btn-primary");
  btn.textContent = "Calcul en cours..."; btn.disabled = true;

  const date = new Date(dateStr + "T12:00:00");
  const jourSemaine = date.getDay();
  const moisDate = date.getMonth(); // 0=jan ... 11=dec

  // ---- COEFFICIENTS FIXES (fallback) ----
  const coeffJour = { 0:1.10, 1:0.38, 2:0.42, 3:0.48, 4:0.65, 5:0.85, 6:1.00 }[jourSemaine] || 0.6;
  const coeffSaison = { haute:1.50, moyenne:0.75, basse:0.55 }[saison];
  const coeffMeteo  = { mauvais:1.20, nuageux:1.00, beau:0.82 }[meteo];
  const coeffEvent  = { non:1.00, marche:1.28, concert:1.40 }[event];
  const baseClients = 200;
  const pm = panierMoyenGlobal || 20;
  const clientsCoeffs = Math.round(baseClients * coeffJour * coeffSaison * coeffMeteo * coeffEvent);

  // ---- LECTURE DONNÉES RÉELLES FIRESTORE ----
  let clientsMoy = clientsCoeffs;
  let sourceLabel = "📐 Estimation (pas encore de données réelles)";
  let fiabilite = 0;

  try {
    const snapshot = await db.collection("stats").get();
    const allData = snapshot.docs.map(d => ({ ...d.data() }));

    // Filtrer : même jour de semaine
    const memJour = allData.filter(d => {
      if (!d.date || !d.date.toDate) return false;
      return d.date.toDate().getDay() === jourSemaine && d.clients > 0;
    });

    // Filtrer : même saison (mois proches)
    const moisHaute   = [5,6,7,8];     // juin-sept
    const moisMoyenne = [4,9];          // mai, oct
    // const moisBasse = reste
    const memSaison = memJour.filter(d => {
      const moisD = d.date.toDate().getMonth();
      if (saison === 'haute')   return moisHaute.includes(moisD);
      if (saison === 'moyenne') return moisMoyenne.includes(moisD);
      return !moisHaute.includes(moisD) && !moisMoyenne.includes(moisD);
    });

    const n = memSaison.length;
    fiabilite = n;

    if (n >= 15) {
      // 80% réel + 20% coefficients
      const moyReelle = memSaison.reduce((s, d) => s + d.clients, 0) / n;
      clientsMoy = Math.round(moyReelle * 0.80 + clientsCoeffs * 0.20);
      sourceLabel = `📊 Basé sur ${n} journées réelles (fiabilité élevée)`;
    } else if (n >= 5) {
      // 50% réel + 50% coefficients
      const moyReelle = memSaison.reduce((s, d) => s + d.clients, 0) / n;
      clientsMoy = Math.round(moyReelle * 0.50 + clientsCoeffs * 0.50);
      sourceLabel = `📈 Basé sur ${n} journées réelles + estimation (fiabilité moyenne)`;
    } else if (n >= 1) {
      // 20% réel + 80% coefficients
      const moyReelle = memSaison.reduce((s, d) => s + d.clients, 0) / n;
      clientsMoy = Math.round(moyReelle * 0.20 + clientsCoeffs * 0.80);
      sourceLabel = `🔎 ${n} journée(s) réelle(s) disponible(s) — estimation majoritaire`;
    }
    // sinon on garde clientsCoeffs et le label "Estimation"

  } catch(e) {
    console.error("Erreur lecture stats:", e);
  }

  // Appliquer météo et événement sur la base pondérée
  clientsMoy = Math.round(clientsMoy * coeffMeteo * coeffEvent);
  const clientsMin = Math.round(clientsMoy * 0.78);
  const clientsMax = Math.round(clientsMoy * 1.28);

  prevState = { clientsMoy, clientsMin, clientsMax, pm, jourSemaine, dateStr, sourceLabel, fiabilite };

  btn.textContent = "Générer les prévisions"; btn.disabled = false;
  afficherResultatsPrevisions(clientsMoy, clientsMin, clientsMax, pm, jourSemaine, sourceLabel, fiabilite);
}

function appliquerCAManuel() {
  const caManuel = parseFloat(document.getElementById("prevCAManuel").value);
  if (!caManuel || caManuel <= 0) { showToast("Saisis un CA valide !", "error"); return; }
  const pm = prevState.pm || panierMoyenGlobal || 20;
  const clientsMoy = Math.round(caManuel / pm);
  const clientsMin = Math.round(clientsMoy * 0.78);
  const clientsMax = Math.round(clientsMoy * 1.28);
  prevState = { ...prevState, clientsMoy, clientsMin, clientsMax, pm };
  afficherResultatsPrevisions(clientsMoy, clientsMin, clientsMax, pm, prevState.jourSemaine, '✏️ CA saisi manuellement', prevState.fiabilite);
  showToast("✅ Planning recalculé sur " + formatEuro(caManuel));
}

function afficherResultatsPrevisions(clientsMoy, clientsMin, clientsMax, pm, jourSemaine, sourceLabel, fiabilite) {
  const caMin = clientsMin * pm;
  const caMoy = clientsMoy * pm;
  const caMax = clientsMax * pm;

  document.getElementById("prev-ca-min").textContent = formatEuro(caMin);
  document.getElementById("prev-ca-moy").textContent = formatEuro(caMoy);
  document.getElementById("prev-ca-max").textContent = formatEuro(caMax);

  const joursLabel = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][jourSemaine];
  document.getElementById("prev-clients-info").innerHTML =
    `${joursLabel} · ${clientsMin}–${clientsMax} clients estimés · Panier moyen ${pm} €<br>
    <span style="font-size:0.75rem;margin-top:4px;display:inline-block;color:var(--aqua-light);">${sourceLabel || ''}</span>`;

  // ---- CRÉNEAUX HORAIRES ----
  const creneaux = [
    { heure: "11h30", label: "Ouverture midi",  pct: 0.04 },
    { heure: "12h00", label: "Montée midi",      pct: 0.08 },
    { heure: "12h30", label: "🍽️ Peak midi",    pct: 0.11 },
    { heure: "13h00", label: "🍽️ Peak midi",    pct: 0.10 },
    { heure: "13h30", label: "Descente midi",    pct: 0.06 },
    { heure: "14h00", label: "Fin midi",         pct: 0.03 },
    { heure: "14h30", label: "Creux",            pct: 0.015 },
    { heure: "15h00", label: "Creux",            pct: 0.015 },
    { heure: "15h30", label: "Creux",            pct: 0.01 },
    { heure: "16h00", label: "Creux",            pct: 0.01 },
    { heure: "16h30", label: "Creux",            pct: 0.01 },
    { heure: "17h00", label: "Reprise",          pct: 0.02 },
    { heure: "17h30", label: "Reprise",          pct: 0.025 },
    { heure: "18h00", label: "Montée soir",      pct: 0.03 },
    { heure: "18h30", label: "Montée soir",      pct: 0.04 },
    { heure: "19h00", label: "Montée soir",      pct: 0.055 },
    { heure: "19h30", label: "Montée soir",      pct: 0.065 },
    { heure: "20h00", label: "Pré-peak soir",    pct: 0.07 },
    { heure: "20h30", label: "🔥 Peak soir",     pct: 0.085 },
    { heure: "21h00", label: "🔥 Peak soir",     pct: 0.085 },
    { heure: "21h30", label: "🔥 Peak soir",     pct: 0.07 },
    { heure: "22h00", label: "Fin de service",   pct: 0.04 },
    { heure: "22h30", label: "Fin de service",   pct: 0.02 },
    { heure: "23h00", label: "Fermeture",        pct: 0.005 }
  ];

  // ---- PRÉ-CALCUL ARRIVÉES PAR CRÉNEAU ----
  const arrivees = creneaux.map(c => Math.round(clientsMoy * c.pct));
  const totalArrivees = arrivees.reduce((s, n) => s + n, 0);

  // ---- CALCUL CLIENTS EN SALLE (durée repas = 1h30 = 3 créneaux de 30 min) ----
  const DUREE_REPAS = 3; // créneaux de 30 min
  const enSalle = arrivees.map((_, i) => {
    let cumul = 0;
    for (let j = Math.max(0, i - DUREE_REPAS + 1); j <= i; j++) {
      cumul += arrivees[j];
    }
    return cumul;
  });
  const maxEnSalle = Math.max(...enSalle);

  // ---- CALCUL STAFF (basé sur clients EN SALLE = charge réelle) ----
  function calcStaff(nSalle) {
    const marmites    = nSalle >= 60 ? 2 : nSalle >= 25 ? 1 : 0;
    const friteuses   = nSalle >= 60 ? 2 : nSalle >= 25 ? 1 : 0;
    const remplissage = nSalle >= 40 ? 1 : 0;
    const salle       = nSalle >= 60 ? 3 : nSalle >= 30 ? 2 : nSalle >= 10 ? 1 : 1;
    const bar         = nSalle >= 50 ? 2 : nSalle >= 20 ? 1 : 0;
    return { marmites, friteuses, remplissage, salle, bar,
             total: marmites + friteuses + remplissage + salle + bar };
  }

  const rows = creneaux.map((c, i) => {
    const arrive  = arrivees[i];
    const salle   = enSalle[i];
    const ca      = arrive * pm;
    const staff   = calcStaff(salle);
    const isPeak  = c.label.includes("🔥") || c.label.includes("🍽️");
    const isCreux = c.label === "Creux";
    const rowClass = isPeak ? 'peak-row' : isCreux ? 'creux-row' : '';
    // Barre visuelle charge salle
    const pctSalle = maxEnSalle > 0 ? Math.round((salle / maxEnSalle) * 100) : 0;
    const barColor = pctSalle >= 85 ? 'var(--danger)' : pctSalle >= 60 ? 'var(--warning)' : 'var(--success)';

    return `<tr class="${rowClass}">
      <td><strong>${c.heure}</strong></td>
      <td>${c.label}</td>
      <td style="color:var(--gold);font-weight:600;text-align:center;">${arrive}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:${pctSalle * 0.5}px;height:6px;background:${barColor};border-radius:3px;min-width:2px;max-width:50px;"></div>
          <span style="color:var(--aqua-light);font-weight:600;">${salle}</span>
        </div>
      </td>
      <td style="color:var(--aqua);font-size:0.8rem;">${formatEuro(ca)}</td>
      <td>
        <div class="staff-badges">
          ${staff.marmites    > 0 ? `<span class="sbadge">🍲×${staff.marmites}</span>`  : ''}
          ${staff.friteuses   > 0 ? `<span class="sbadge">🍟×${staff.friteuses}</span>` : ''}
          ${staff.remplissage > 0 ? `<span class="sbadge">🔄×1</span>`                  : ''}
          <span class="sbadge">🧑‍🍳×${staff.salle}</span>
          ${staff.bar > 0 ? `<span class="sbadge">🍺×${staff.bar}</span>` : ''}
          <span class="sbadge total-badge">= ${staff.total}</span>
        </div>
      </td>
    </tr>`;
  }).join("");

  document.getElementById("planningTable").innerHTML = `
    <div class="table-wrap">
    <table style="min-width:620px;">
      <thead><tr>
        <th>Heure</th>
        <th>Créneau</th>
        <th style="text-align:center;">🚪 Arrivées</th>
        <th>🪑 En salle</th>
        <th>CA (30 min)</th>
        <th>Staff nécessaire</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid var(--ocean-border);">
          <td colspan="2" style="color:var(--text-secondary);font-size:0.8rem;padding-top:10px;">
            <em>Durée repas estimée : 1h30 — Staff calculé sur clients en salle</em>
          </td>
          <td style="text-align:center;padding-top:10px;">
            <span class="sbadge total-badge" style="font-size:0.85rem;">= ${totalArrivees}</span>
          </td>
          <td style="padding-top:10px;">
            <span style="font-size:0.75rem;color:var(--text-muted);">max : ${maxEnSalle}</span>
          </td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    </div>`;

  document.getElementById("prevResultat").style.display = "block";
  document.getElementById("prevResultat").scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// IMPORT CSV SUMUP
// ============================================================

let importData = []; // données parsées en attente de sauvegarde
let chartImport = null;

function initImport() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("importDate").value = today;

  // Drag & drop
  const zone = document.getElementById("dropZone");
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.style.borderColor = 'var(--gold)'; });
  zone.addEventListener("dragleave", () => { zone.style.borderColor = 'var(--ocean-border)'; });
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--ocean-border)';
    const file = e.dataTransfer.files[0];
    if (file) lireCSV(file);
  });
}

function lireCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const texte = e.target.result;
      const tickets = parserCSVSumUp(texte);
      if (tickets.length === 0) {
        showToast("Aucune donnée valide trouvée dans le CSV", "error");
        return;
      }
      importData = tickets;
      afficherImport(tickets);
      showToast(`✅ ${tickets.length} tickets chargés !`);
    } catch(err) {
      console.error("Erreur parsing CSV:", err);
      showToast("❌ Format CSV non reconnu", "error");
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// Parser le format SumUp Pro export commandes
// Colonnes : #, Date d'ouverture, Heure d'ouverture, Durée, Utilisateur, Table, Statut, Total, Statut paiement
function parserCSVSumUp(texte) {
  const lignes = texte.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lignes.length < 2) return [];

  // Détecter le séparateur (virgule ou point-virgule)
  const sep = lignes[0].includes(';') ? ';' : ',';

  const headers = lignes[0].split(sep).map(h => h.replace(/"/g, '').toLowerCase().trim());
  console.log("Headers CSV:", headers);

  // Trouver les colonnes
  const iHeure = headers.findIndex(h => h.includes("heure") && h.includes("ouverture") || h === "time" || h.includes("heure"));
  const iTotal = headers.findIndex(h => h === "total" || h.includes("montant") || h.includes("ca ttc") || h.includes("amount"));
  const iStatut = headers.findIndex(h => h.includes("statut") && h.includes("pay") || h === "payment status");
  const iDate = headers.findIndex(h => h.includes("date"));

  const tickets = [];
  for (let i = 1; i < lignes.length; i++) {
    const cols = lignes[i].split(sep).map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;

    // Heure
    const heureStr = iHeure >= 0 ? cols[iHeure] : cols[2];
    const heure = extraireHeure(heureStr);
    if (heure === null) continue;

    // Total
    const totalStr = iTotal >= 0 ? cols[iTotal] : cols[cols.length - 2];
    const total = parseFloat(totalStr.replace(',', '.').replace(/[^0-9.]/g, ''));
    if (isNaN(total) || total <= 0) continue;

    // Statut (garder seulement les tickets fermés/payés)
    const statut = iStatut >= 0 ? cols[iStatut].toLowerCase() : '';
    if (statut && (statut.includes('annul') || statut.includes('cancel'))) continue;

    tickets.push({ heure, total });
  }
  return tickets;
}

function extraireHeure(str) {
  if (!str) return null;
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

// Générer données fictives réalistes SumUp pour tester
function chargerDonneeTest() {
  const ticketsFictifs = [];
  // Distribution réaliste d'une journée samedi haute saison (~200 tickets)
  const distribution = [
    { h: 11.5, n: 4 },  { h: 12, n: 12 }, { h: 12.5, n: 18 }, { h: 13, n: 16 },
    { h: 13.5, n: 10 }, { h: 14, n: 6 },  { h: 14.5, n: 3 },  { h: 15, n: 2 },
    { h: 15.5, n: 2 },  { h: 16, n: 2 },  { h: 16.5, n: 2 },  { h: 17, n: 3 },
    { h: 17.5, n: 4 },  { h: 18, n: 6 },  { h: 18.5, n: 8 },  { h: 19, n: 10 },
    { h: 19.5, n: 12 }, { h: 20, n: 14 }, { h: 20.5, n: 18 }, { h: 21, n: 20 },
    { h: 21.5, n: 16 }, { h: 22, n: 12 }, { h: 22.5, n: 8 },  { h: 23, n: 3 }
  ];
  // Paniers réalistes : 24.90, 28.90, 35.80 (2 formules), extras boissons
  const paniers = [24.90, 28.90, 28.90, 35.80, 53.80, 49.80, 24.90, 28.90, 57.80, 35.80];
  distribution.forEach(({ h, n }) => {
    for (let i = 0; i < n; i++) {
      const panier = paniers[Math.floor(Math.random() * paniers.length)];
      ticketsFictifs.push({ heure: h + Math.random() * 0.45, total: panier });
    }
  });
  importData = ticketsFictifs;
  afficherImport(ticketsFictifs);
  showToast(`🧪 ${ticketsFictifs.length} tickets fictifs chargés !`);
}

function afficherImport(tickets) {
  const totalCA = tickets.reduce((s, t) => s + t.total, 0);
  const panierMoy = totalCA / tickets.length;

  // KPIs
  document.getElementById("imp-tickets").textContent = tickets.length;
  document.getElementById("imp-ca").textContent = formatEuro(totalCA);
  document.getElementById("imp-moy").textContent = formatEuro(panierMoy);

  // Regrouper par créneau de 30 min
  const creneaux = {};
  for (let h = 11; h <= 23; h++) {
    creneaux[h + '.0'] = { label: `${h}h00`, tickets: 0, ca: 0 };
    creneaux[h + '.5'] = { label: `${h}h30`, tickets: 0, ca: 0 };
  }

  tickets.forEach(t => {
    const demi = t.heure >= 0 ? (Math.floor(t.heure * 2) / 2).toFixed(1) : null;
    if (demi && creneaux[demi]) {
      creneaux[demi].tickets++;
      creneaux[demi].ca += t.total;
    }
  });

  // Filtrer les créneaux vides en début/fin
  const cles = Object.keys(creneaux).filter(k => creneaux[k].tickets > 0 ||
    (parseFloat(k) >= 11.5 && parseFloat(k) <= 23.0));

  // Date
  const dateInput = document.getElementById("importDate").value;
  document.getElementById("imp-date").textContent = dateInput ?
    new Date(dateInput + "T12:00:00").toLocaleDateString('fr-FR') : "—";

  // Graphique
  const labelsChart = cles.map(k => creneaux[k].label);
  const dataTickets = cles.map(k => creneaux[k].tickets);
  const dataCA = cles.map(k => Math.round(creneaux[k].ca));

  if (chartImport) chartImport.destroy();
  const ctx = document.getElementById("chartImport").getContext("2d");
  chartImport = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labelsChart,
      datasets: [
        {
          label: 'Tickets',
          data: dataTickets,
          backgroundColor: 'rgba(201,168,76,0.7)',
          yAxisID: 'y'
        },
        {
          label: 'CA (€)',
          data: dataCA,
          type: 'line',
          borderColor: '#4ab5e3',
          backgroundColor: 'transparent',
          tension: 0.4,
          yAxisID: 'y1',
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#c9d6e3', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#8aa0b5', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y:  { position: 'left',  ticks: { color: '#c9a84c' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y1: { position: 'right', ticks: { color: '#4ab5e3' }, grid: { display: false } }
      }
    }
  });

  // Tableau détail
  const rows = cles.map(k => {
    const c = creneaux[k];
    const pct = tickets.length > 0 ? ((c.tickets / tickets.length) * 100).toFixed(1) : 0;
    const barWidth = Math.round(parseFloat(pct) * 2);
    const isPeak = c.tickets >= Math.max(...Object.values(creneaux).map(x => x.tickets)) * 0.7;
    return `<tr ${isPeak ? 'class="peak-row"' : ''}>
      <td><strong>${c.label}</strong></td>
      <td style="color:var(--gold)">${c.tickets}</td>
      <td style="color:var(--aqua)">${formatEuro(c.ca)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:${barWidth}px;height:6px;background:var(--gold);border-radius:3px;opacity:0.7;"></div>
          <span style="font-size:0.75rem;color:var(--text-secondary)">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");

  document.getElementById("importTable").innerHTML = rows;
  document.getElementById("importResultat").style.display = "block";
  document.getElementById("importResultat").scrollIntoView({ behavior: 'smooth' });
}

async function sauvegarderImport() {
  if (!importData.length) { showToast("Aucune donnée à sauvegarder", "error"); return; }

  const dateStr = document.getElementById("importDate").value;
  if (!dateStr) { showToast("Sélectionne une date !", "error"); return; }

  const btn = document.querySelector("#tab-import .btn-primary");
  btn.textContent = "Sauvegarde..."; btn.disabled = true;

  try {
    // Regrouper par créneau 30 min
    const creneaux = {};
    importData.forEach(t => {
      const demi = (Math.floor(t.heure * 2) / 2).toFixed(1);
      if (!creneaux[demi]) creneaux[demi] = { tickets: 0, ca: 0 };
      creneaux[demi].tickets++;
      creneaux[demi].ca += t.total;
    });

    const totalCA    = importData.reduce((s, t) => s + t.total, 0);
    const totalTick  = importData.length;
    const panierMoy  = totalCA / totalTick;
    const jourSemaine = new Date(dateStr + "T12:00:00").getDay();

    await db.collection("imports_caisse").add({
      date: new Date(dateStr + "T12:00:00"),
      dateStr,
      jourSemaine,
      totalCA,
      totalTickets: totalTick,
      panierMoyen: parseFloat(panierMoy.toFixed(2)),
      creneaux,
      source: "SumUp CSV"
    });

    showToast("✅ Données sauvegardées ! Les prévisions s'améliorent.");
    importData = [];

  } catch(e) {
    console.error("Erreur sauvegarde import:", e);
    showToast("❌ " + (e.message || "Erreur sauvegarde"), "error");
  }

  btn.textContent = "💾 Sauvegarder et alimenter les prévisions";
  btn.disabled = false;
}

// ============================================================
// RÉGLAGES
// ============================================================

async function chargerReglagesInit() {
  try {
    const doc = await db.collection("config").doc("reglages").get();
    if (doc.exists) {
      panierMoyenGlobal = doc.data().panierMoyen || 20;
      console.log("Panier moyen chargé :", panierMoyenGlobal, "€");
    } else {
      console.log("Pas de réglages en base, panier moyen par défaut :", panierMoyenGlobal, "€");
    }
  } catch(e) {
    console.error("ERREUR CHARGEMENT RÉGLAGES:", e.code, e.message);
  }
}

async function chargerReglages() {
  const doc = await db.collection("config").doc("reglages").get().catch(() => null);
  const val = doc && doc.exists ? doc.data().panierMoyen : panierMoyenGlobal;
  document.getElementById("inputPanierMoyen").value = val;
  document.getElementById("affichagePanier").textContent = val + " €";
}

async function sauvegarderReglages() {
  const val = +document.getElementById("inputPanierMoyen").value;
  if (!val || val < 1) { showToast("Panier moyen invalide", "error"); return; }
  try {
    await db.collection("config").doc("reglages").set({ panierMoyen: val });
    panierMoyenGlobal = val;
    document.getElementById("affichagePanier").textContent = val + " €";
    showToast("✅ Réglages sauvegardés !");
  } catch(e) {
    console.error("ERREUR SAUVEGARDE RÉGLAGES:", e.code, e.message);
    showToast("❌ " + (e.message || "Erreur sauvegarde"), "error");
  }
}

// NOTIFICATIONS
// ============================================================
function notifier(message) {
  if (Notification.permission === "granted") new Notification("🍲 Marmite Bleue", { body: message });
}
if (Notification.permission !== "granted") Notification.requestPermission();

// SERVICE WORKER
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
