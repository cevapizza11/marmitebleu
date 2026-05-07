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
const db = firebase.firestore();

let chart;

async function analyser() {

  let data = {
    resto: document.getElementById("resto").value,
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

function afficher(d) {

  let alertes = [];

  if (d.note < 4.5) alertes.push("⚠️ Note faible");
  if (d.taux < 5) alertes.push("⚠️ Peu d’avis");
  if (d.attente > 5) alertes.push("⚠️ Attente longue");

  if (alertes.length === 0) alertes.push("✅ OK");

  document.getElementById("resultats").innerHTML = `
    <p>Score : ${d.score}</p>
    <ul>${alertes.map(a=>`<li>${a}</li>`).join("")}</ul>
  `;
}

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

charger();