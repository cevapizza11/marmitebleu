// CONFIG FIREBASE
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

  const userEmail = document.getElementById("email").value;
  const userPassword = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(userEmail, userPassword)

    .then(() => {
      console.log("Connexion OK");
    })

    .catch((error) => {
      alert(error.message);
      console.log(error);
    });
}

// LOGOUT
function logout() {
  auth.signOut();
}

// SESSION
auth.onAuthStateChanged(user => {

  if (user) {

    document.getElementById("loginBox").style.display = "none";
    document.getElementById("app").style.display = "block";

    charger();

  } else {

    document.getElementById("loginBox").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

// ANALYSE
async function analyser() {

  let data = {

    clients: +document.getElementById("clients").value,

    avis: +document.getElementById("avis").value,

    note: +document.getElementById("note").value,

    attente: +document.getElementById("attente").value,

    employe: document.getElementById("employe").value,

    date: new Date()
  };

  data.taux =
    ((data.avis / data.clients) * 100).toFixed(1);

  data.score =
    ((data.note * 20) + (data.taux * 2) - data.attente).toFixed(0);

  // SAVE FIRESTORE
  await db.collection("stats").add(data);

  afficher(data);

  verifierAlertes(data);

  charger();
}

// AFFICHAGE
function afficher(d) {

  let alertes = [];
  let actions = [];

  if (d.note < 4.5) {

    alertes.push("⚠️ Note faible");

    actions.push("Former équipe + contrôle qualité");
  }

  if (d.taux < 5) {

    alertes.push("⚠️ Peu d'avis");

    actions.push("QR code + demande active");
  }

  if (d.attente > 5) {

    alertes.push("⚠️ Attente longue");

    actions.push("Renforcer production");
  }

  if (alertes.length === 0) {

    alertes.push("✅ Tout est OK");

    actions.push("Maintenir performance");
  }

  let panierMoyen = 12;

  let ca = d.clients * panierMoyen;

  document.getElementById("score").innerText =
    `Score ${d.score}`;

  document.getElementById("resume").innerText =
    `CA estimé : ${ca}€ | Avis : ${d.taux}%`;

  document.getElementById("alertes").innerHTML =
    alertes.map(a => `<p class="alert">${a}</p>`).join("");

  document.getElementById("actions").innerHTML =
    actions.map(a => `<p>${a}</p>`).join("");
}

// LOAD DATA
async function charger() {

  let snapshot = await db.collection("stats").get();

  let data =
    snapshot.docs.map(doc => doc.data());

  let notes =
    data.map(d => d.note);

  if (chart) chart.destroy();

  chart = new Chart(
    document.getElementById("chart"),
    {
      type: "line",

      data: {

        labels:
          notes.map((_, i) => i + 1),

        datasets: [{

          label: "Note",

          data: notes
        }]
      }
    }
  );
}

// NOTIFICATIONS
function notifier(message) {

  if (Notification.permission === "granted") {

    new Notification(message);
  }
}

function verifierAlertes(data) {

  if (data.note < 4) {

    notifier("⚠️ Note critique !");
  }

  if (data.attente > 8) {

    notifier("⚠️ Attente trop élevée !");
  }
}

// DEMANDE PERMISSION
if (Notification.permission !== "granted") {

  Notification.requestPermission();
}

// SERVICE WORKER
if ("serviceWorker" in navigator) {

  navigator.serviceWorker.register("service-worker.js");
}