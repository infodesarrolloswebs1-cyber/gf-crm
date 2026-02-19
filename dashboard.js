import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "/";
  else cargarLeads();
});

window.logout = () => signOut(auth).then(() => window.location.href = "/");

// CREAR LEAD
window.crearLead = async function () {
  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  if (!nombre || !monto) return alert("Faltan datos");

  await addDoc(collection(db, "leads"), {
    nombre, empresa, monto: Number(monto), estado: "nuevo", fecha: new Date()
  });

  limpiarInputs();
  cargarLeads();
};

async function cargarLeads() {
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => {
    const el = document.getElementById("col-" + id);
    if(el) el.innerHTML = `<h3>${id}</h3>`;
  });

  const tablaOps = document.getElementById("tabla-proyectos");
  if(tablaOps) tablaOps.innerHTML = "";

  let totalPip = 0, ventasMes = 0, cashIn = 0;

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const monto = Number(d.monto) || 0;

    if (d.estado === "cerrado") {
      ventasMes += monto;
      cashIn += (monto * 0.5); // Simulación 50% inicial
      agregarAOperaciones(d, id);
    } else {
      totalPip += monto;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;
    card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><span style="color:var(--green)">USD ${monto}</span>`;

    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("id", id));
    const col = document.getElementById("col-" + d.estado);
    if (col) col.appendChild(card);
  });

  actualizarUI(totalPip, ventasMes, cashIn);
}

function agregarAOperaciones(data, id) {
  const tabla = document.getElementById("tabla-proyectos");
  if(!tabla) return;
  const row = tabla.insertRow();
  row.innerHTML = `
    <td>${data.nombre}</td>
    <td><span style="color:var(--accent)">Desarrollo</span></td>
    <td>50% (Anticipo)</td>
    <td>+90 días</td>
    <td>USD ${data.monto * 0.5}</td>
  `;
}

function actualizarUI(pip, ven, cash) {
  const elPip = document.getElementById("totalPipeline");
  const elVen = document.getElementById("ventasMes");
  const elRen = document.getElementById("rentabilidad");
  const elCash = document.getElementById("totalCobrado");
  const elCom = document.getElementById("comisionesPend");

  if(elPip) elPip.innerText = `USD ${pip.toLocaleString()}`;
  if(elVen) elVen.innerText = `USD ${ven.toLocaleString()}`;
  if(elCash) elCash.innerText = `USD ${cash.toLocaleString()}`;
  if(elCom) elCom.innerText = `USD ${(ven * 0.1).toLocaleString()}`;
  
  if(elRen) {
    const rent = ven > 0 ? (((ven - 4400) / ven) * 100).toFixed(0) : 0;
    elRen.innerText = `${rent}%`;
  }
}

// DRAG & DROP
["nuevo","reunion","propuesta","cerrado"].forEach(estado => {
  const col = document.getElementById("col-" + estado);
  if(!col) return;
  col.addEventListener("dragover", e => e.preventDefault());
  col.addEventListener("drop", async e => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    await updateDoc(doc(db, "leads", id), { estado });
    cargarLeads();
  });
});

function limpiarInputs() {
  document.getElementById("leadNombre").value = "";
  document.getElementById("leadEmpresa").value = "";
  document.getElementById("leadMonto").value = "";
}
