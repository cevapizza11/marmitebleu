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
    .catch(()=>alert("Erreur login"));
}

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
    clients: +clients.value,
    avis: +avis.value,
    note: +note.value,
    attente: +attente.value,
    employe: employe.value,
    date: new Date()
  };

  data.taux = ((data.avis / data.clients) * 100).toFixed(1);
  data.score = ((data.note * 20) + (data.taux * 2) - data.attente).toFixed(0);

  await db.collection("stats").add(data);

  afficher(data);
  charger();
}

// MOTEUR INTELLIGENT
function afficher(d) {

  let alertes = [];
  let actions = [];

  if (d.note < 4.5) {
    alertes.push("Note faible");
    actions.push("Former équipe + contrôle qualité");
  }

  if (d.taux < 5) {
    alertes.push("Pas assez d’avis");
    actions.push("QR code + demande client systématique");
  }

  if (d.attente > 5) {
    alertes.push("Attente trop longue");
    actions.push("Renforcer production / anticiper rush");
  }

  if (alertes.length === 0) {
    alertes.push("RAS");
    actions.push("Maintenir performance");
  }

  // 💰 estimation CA (simple)
  let panierMoyen = 12;
  let ca = d.clients * panierMoyen;

  score.innerText = `Score ${d.score}`;
  resume.innerText = `CA estimé : ${ca}€ | Avis : ${d.taux}%`;

  alertesDiv.innerHTML = alertes.map(a=>`<p class="alert">${a}</p>`).join("");
  actionsDiv.innerHTML = actions.map(a=>`<p>${a}</p>`).join("");
}

// CHARGEMENT DATA
async function charger() {

  let snapshot = await db.collection("stats").get();
  let data = snapshot.docs.map(doc => doc.data());

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