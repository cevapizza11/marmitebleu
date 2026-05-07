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
  const caTeorique = clients * panierMoyenGlobal;
  const ecartCA = caReel - caTeorique;
  const score = ((note * 20) + (parseFloat(taux) * 2) - attente).toFixed(0);

  const data = {
    date: new Date(),
    clients, avis, note, attente, employe,
    tempMoules, caReel, ruptures, absences,
    taux: parseFloat(taux), score: parseInt(score), caPrev,
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
  const caRef = (d.caPrev > 0) ? d.caPrev : (d.clients * panierMoyenGlobal);
  const caRefLabel = (d.caPrev > 0) ? 'CA prévu' : 'CA estimé (panier moy.)';
  document.getElementById("caInfo").textContent =
    `CA réel : ${d.caReel > 0 ? d.caReel + '€' : 'non saisi'} | ${caRefLabel} : ${caRef}€ | Écart : ${d.caReel > 0 ? (d.caReel - caRef > 0 ? '+' : '') + (d.caReel - caRef) + '€' : '—'} | Taux avis : ${d.taux}%`;

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

    document.getElementById("kpi-note").textContent = notesMoy;
    document.getElementById("kpi-attente").textContent = attenteMoy + " min";
    document.getElementById("kpi-clients").textContent = totalClients;
    document.getElementById("kpi-sessions").textContent = data.length;

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
  const GEMINI_KEY = "AIzaSyBJrJAwCr4r4gY6VTHpaGY0acK2fgborSo";

  const prompt = `Tu es un expert en restauration. Analyse cet avis Google d'un restaurant de moules-frites (La Marmite Bleue, Saint-Pierre-la-Mer).

Avis (note ${note}/5) : "${texte}"

Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après :
{
  "sentiment": "positif" ou "neutre" ou "negatif",
  "resume": "Résumé en 1 phrase (max 20 mots)",
  "motsCles": ["mot1", "mot2", "mot3"],
  "reponse": "Réponse courtoise suggérée au client (2-3 phrases, ton chaleureux et professionnel, en français)"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text.trim();
  const clean = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
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
