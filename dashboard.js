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


// PROTEGER DASHBOARD
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/";
  } else {
    cargarClientes();
    cargarLeads();
  }
});


// LOGOUT
window.logout = async function () {
  await signOut(auth);
  window.location.href = "/";
};


// =========================
// CLIENTES
// =========================

window.crearCliente = async function () {
  await addDoc(collection(db, "clientes"), {
    nombre: "cliente real",
    fecha: new Date()
  });

  cargarClientes();
};

async function cargarClientes() {
  const cont = document.getElementById("listaClientes");
  cont.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "clientes"));

  querySnapshot.forEach((doc) => {
    cont.innerHTML += `<div>${doc.data().nombre}</div>`;
  });
}


// =========================
// LEADS
// =========================

window.crearLead = async function () {

  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  await addDoc(collection(db, "leads"), {
    nombre,
    empresa,
    monto: Number(monto),
    estado: "nuevo",
    fecha: new Date()
  });

  cargarLeads();
};


async function cargarLeads() {

  document.getElementById("col-nuevo").innerHTML = "";
  document.getElementById("col-reunion").innerHTML = "";
  document.getElementById("col-propuesta").innerHTML = "";
  document.getElementById("col-cerrado").innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {

    const d = docSnap.data();
    const id = docSnap.id;

    const card = `
      <div style="border:1px solid black; padding:10px; margin:5px">
        <b>${d.nombre}</b>
        <br>
        ${d.empresa}
        <br>
        USD ${d.monto}
        <br><br>

        <button onclick="mover('${id}','reunion')">Reunión</button>
        <button onclick="mover('${id}','propuesta')">Propuesta</button>
        <button onclick="mover('${id}','cerrado')">Cerrar</button>
      </div>
    `;

    document.getElementById("col-" + d.estado).innerHTML += card;

  });
}

