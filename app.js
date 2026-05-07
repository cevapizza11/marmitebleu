// CONFIG FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDhqKmCJJx5ScXUxaoip1eMiy10P0BvD9U",
  authDomain: "marmite-bleue.firebaseapp.com",
  projectId: "marmite-bleue",
  storageBucket: "marmite-bleue.firebasestorage.app",
  messagingSenderId: "938472624829",
  appId: "1:938472624829:web:edd7453c2589c820dfddd4"
};

// INITIALISATION
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

// LOGIN
function login() {

  const userEmail = document.getElementById("email").value;
  const userPassword = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(userEmail, userPassword)

    .then(() => {
      alert("Connexion OK");
    })

    .catch((error) => {
      alert(error.message);
      console.log(error);
    });
}