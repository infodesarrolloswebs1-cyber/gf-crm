import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// ===============================
// PROTEGER DASHBOARD
// ===============================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/";
  } else {
    cargarLeads();
  }
});


// ===============================
// LOGOUT
// ===============================
window.logout = async function () {
  await signOut(auth);
  window.location.href = "/";
};


// ===============================
// CREAR LEAD
// ===============================
window.crearLead = async function () {

  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  if (!nombre || !monto) return;

  await addDoc(collection(db, "leads"), {
    nombre,
    empresa,
    monto: Number(monto),
    estado: "nuevo",
    fecha: new Date()
  });

  document.getElementById("leadNombre").value = "";
  document.getElementById("leadEmpresa").value = "";
  document.getElementById("leadMonto").value = "";

  cargarLeads();
};


// ===============================
// CARGAR LEADS
// ===============================
async function cargarLeads() {

  document.getElementById("col-nuevo").innerHTML = "<h3>Nuevo</h3>";
  document.getElementById("col-reunion").innerHTML = "<h3>Reunión</h3>";
  document.getElementById("col-propuesta").innerHTML = "<h3>Propuesta</h3>";
  document.getElementById("col-cerrado").innerHTML = "<h3>Cerrado</h3>";

  let total = 0;

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {

    const d = docSnap.data();
    const id = docSnap.id;

    if (d.estado !== "cerrado") {
      total += Number(d.monto);
    }

    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;

    card.innerHTML = `
      <b>${d.nombre}</b><br>
      ${d.empresa || ""}<br>
      <div class="usd">USD ${d.monto}</div>
    `;

    // DRAG START
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("id", id);
    });

    const col = document.getElementById("col-" + d.estado);
    col.appendChild(card);
  });

  document.getElementById("totalUSD").innerText = total;
}


// ===============================
// DRAG & DROP
// ===============================
const columnas = ["nuevo","reunion","propuesta","cerrado"];

columnas.forEach((estado) => {

  const col = document.getElementById("col-" + estado);

  col.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  col.addEventListener("drop", async (e) => {
    e.preventDefault();

    const id = e.dataTransfer.getData("id");

    const ref = doc(db, "leads", id);

    await updateDoc(ref, {
      estado: estado
    });

    cargarLeads();
  });

});

