// 🔥 CONFIG FIREBASE
const firebaseConfig = {
  apiKey: "REMPLACE_PAR_TON_API_KEY",
  authDomain: "REMPLACE.firebaseapp.com",
  projectId: "REMPLACE_PROJECT_ID",
  storageBucket: "REMPLACE.appspot.com",
  messagingSenderId: "REMPLACE",
  appId: "REMPLACE"
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
    .catch((error) => {
      alert("Erreur connexion : " + error.message);
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

  data.taux = ((data.avis / data.clients) * 100).toFixed(1);
  data.score = ((data.note * 20) + (data.taux * 2) - data.attente).toFixed(0);

  await db.collection("stats").add(data);

  afficher(data);
  verifierAlertes(data);
  charger();
}

// AFFICHAGE
function afficher(d) {
}