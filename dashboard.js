import { db } from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// =============================
// CREAR LEAD
// =============================
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


// =============================
// CARGAR LEADS
// =============================
async function cargarLeads() {

  document.getElementById("col-nuevo").innerHTML = "";
  document.getElementById("col-reunion").innerHTML = "";
  document.getElementById("col-propuesta").innerHTML = "";
  document.getElementById("col-cerrado").innerHTML = "";

  const snap = await getDocs(collection(db, "leads"));

  snap.forEach(docSnap => {

    const d = docSnap.data();
    const id = docSnap.id;

    const card = `
      <div class="card">
        <b>${d.nombre}</b><br>
        ${d.empresa}<br>
        USD ${d.monto}<br><br>

        <button onclick="mover('${id}','reunion')">Reunión</button>
        <button onclick="mover('${id}','propuesta')">Propuesta</button>
        <button onclick="mover('${id}','cerrado')">Cerrar</button>
      </div>
    `;

    const col = document.getElementById("col-" + d.estado);
    if (col) col.innerHTML += card;

  });
}


// =============================
// MOVER ESTADO
// =============================
window.mover = async function (id, estado) {

  const ref = doc(db, "leads", id);

  await updateDoc(ref, {
    estado: estado
  });

  cargarLeads();
};

cargarLeads();

