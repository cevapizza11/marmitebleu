// Your web app's Firebase configuration
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

let chart;

// LOGIN
function login() {
  auth.signInWithEmailAndPassword(email.value, password.value)
    .catch(() => alert("Erreur login"));
}

// LOGOUT
function logout() {
  auth.signOut();
}

// SESSION
auth.onAuthStateChanged(user => {
  if (user) {
    loginBox.style.display = "none";
    app.style.display = "block";
    charger();
  } else {
    loginBox.style.display = "block";
    app.style.display = "none";
  }
});

// ANALYSE
async function analyser() {

  let data = {
    resto: resto.value,
    clients: +clients.value,
    avis: +avis.value,
    note: +note.value,
    attente: +attente.value,
    employe: employe.value,
    user: auth.currentUser.email,
    date: new Date()
  };

  data.taux = ((data.avis / data.clients) * 100).toFixed(1);
  data.score = ((data.note * 20) + (data.taux * 2) - data.attente).toFixed(0);

  await db.collection("stats").add(data);

  afficher(data);
  charger();
}

// RESULTAT
function afficher(d) {

  let alertes = [];

  if (d.note < 4.5) alertes.push("⚠️ Note faible");
  if (d.taux < 5) alertes.push("⚠️ Peu d’avis");
  if (d.attente > 5) alertes.push("⚠️ Attente longue");

  if (alertes.length === 0) alertes.push("✅ OK");

  resultats.innerHTML = `
    <p>Score : ${d.score}</p>
    <ul>${alertes.map(a=>`<li>${a}</li>`).join("")}</ul>
  `;
}

// LOAD DATA
async function charger() {

  let snapshot = await db.collection("stats").get();
  let data = snapshot.docs.map(doc => doc.data());

  majGraph(data);
  majEquipe(data);
}

// GRAPH
function majGraph(data) {

  let notes = data.map(d => d.note);

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels: notes.map((_,i)=>i+1),
      datasets: [{label:"Note", data:notes}]
    }
  });
}

// TEAM
function majEquipe(data) {

  let eq = {};

  data.forEach(d => {
    if (!d.employe) return;
    eq[d.employe] = (eq[d.employe] || 0) + 1;
  });

  equipe.innerHTML = Object.entries(eq)
    .map(([n,c])=>`<p>${n} : ${c}</p>`)
    .join("");
}