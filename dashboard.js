import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// proteger pantalla
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/";
  } else {
    cargarClientes();
  }
});


// logout
window.logout = async function () {
  await signOut(auth);
  window.location.href = "/";
};


// crear cliente
window.crearCliente = async function () {
  await addDoc(collection(db, "clientes"), {
    nombre: "cliente real",
    fecha: new Date()
  });

  cargarClientes();
};


// listar clientes
async function cargarClientes() {
  const cont = document.getElementById("listaClientes");
  cont.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "clientes"));

  querySnapshot.forEach((doc) => {
    cont.innerHTML += `<div>${doc.data().nombre}</div>`;
  });
}
