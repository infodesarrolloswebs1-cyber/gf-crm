import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// LOGIN
window.login = async function () {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("pass").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    alert("Login correcto");
  } catch (e) {
    console.log(e);
    alert("Error login");
  }
};


// CREAR CLIENTE TEST
window.crearCliente = async function () {
  try {

    await addDoc(collection(db, "clientes"), {
      nombre: "cliente test",
      fecha: new Date()
    });

    alert("Cliente guardado");

  } catch (e) {
    console.log(e);
    alert("Error al guardar cliente");
  }
};
