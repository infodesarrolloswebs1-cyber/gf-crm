import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.crearCliente = async function () {
  const nombre = prompt("Nombre");
  const empresa = prompt("Empresa");
  const monto = prompt("Monto USD");

  await addDoc(collection(db, "leads"), {
    nombre,
    empresa,
    monto: Number(monto),
    estado: "nuevo"
  });

  cargarLeads();
};

async function cargarLeads() {
  document.querySelectorAll(".dropzone").forEach(z => z.innerHTML = "");

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;

    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;

    card.innerHTML = `
      <b>${d.nombre}</b><br>
      ${d.empresa}<br>
      USD ${d.monto}
    `;

    card.addEventListener("dragstart", e => {
      e.dataTransfer.setData("id", id);
    });

    document.getElementById("col-" + d.estado).appendChild(card);
  });
}

document.querySelectorAll(".dropzone").forEach(zone => {
  zone.addEventListener("dragover", e => e.preventDefault());

  zone.addEventListener("drop", async e => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const nuevoEstado = zone.parentElement.dataset.estado;

    await updateDoc(doc(db, "leads", id), {
      estado: nuevoEstado
    });

    cargarLeads();
  });
});

cargarLeads();
