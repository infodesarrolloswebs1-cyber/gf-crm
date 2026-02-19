import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

window.login = async function(){

  let email = document.getElementById("email").value;
  let pass = document.getElementById("pass").value;

  await signInWithEmailAndPassword(auth,email,pass)

  alert("Login OK")
}
