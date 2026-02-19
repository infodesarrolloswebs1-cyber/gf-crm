import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// LOGIN
window.login = async function () {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("pass").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    alert("Login correcto");
  } catch (e) {
    alert("Error login");
    console.log(e);
  }
};


// CREAR CLIENTE
window.crearCliente = async function () {
  try {

    await addDoc(collection(db, "clientes"), {
      nombre: "Cliente prueba",
      fecha: new Date()
    });

    alert("Cliente guardado");

  } catch (e) {
    console.log(e);
    alert("Error al guardar");
  }
};
