import { db, auth } from "./firebase.js";
import { 
  collection, addDoc, getDocs, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// PROTEGER RUTA
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "/";
  else cargarLeads();
});

window.logout = async () => {
  await signOut(auth);
  window.location.href = "/";
};

// CREAR LEAD
window.crearLead = async function () {
  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  if (!nombre || !monto) return alert("Ingresá nombre y monto");

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

// CARGAR LEADS Y ACTUALIZAR KPIS
async function cargarLeads() {
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => {
    const el = document.getElementById("col-" + id);
    if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
  });

  let totalPip = 0;
  let ventasMes = 0;

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const monto = Number(d.monto) || 0;

    if (d.estado === "cerrado") {
      ventasMes += monto;
    } else {
      totalPip += monto;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;
    card.innerHTML = `
      <b>${d.nombre}</b>
      <small>${d.empresa || ''}</small>
      <div class="usd-tag">USD ${monto.toLocaleString()}</div>
    `;

    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("id", id));
    
    const col = document.getElementById("col-" + d.estado);
    if (col) col.appendChild(card);
  });

  // ACTUALIZACIÓN DE INTERFAZ CON COMPROBACIÓN (Fix de los errores de consola)
  const txtPip = document.getElementById("totalPipeline");
  const txtVen = document.getElementById("ventasMes");
  const txtRen = document.getElementById("rentabilidad");

  if(txtPip) txtPip.innerText = `USD ${totalPip.toLocaleString()}`;
  if(txtVen) txtVen.innerText = `USD ${ventasMes.toLocaleString()}`;
  
  if(txtRen) {
    const costoFijo = 4400;
    const rent = ventasMes > 0 ? (((ventasMes - costoFijo) / ventasMes) * 100).toFixed(0) : 0;
    txtRen.innerText = `${rent}%`;
    txtRen.style.color = rent < 0 ? "#ef4444" : "#22c55e";
  }
}

// DRAG & DROP
["nuevo","reunion","propuesta","cerrado"].forEach((estado) => {
  const col = document.getElementById("col-" + estado);
  if(!col) return;

  col.addEventListener("dragover", (e) => e.preventDefault());
  col.addEventListener("drop", async (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const ref = doc(db, "leads", id);

    await updateDoc(ref, { estado: estado });

    // Lógica Financiera: Si cerramos, notificamos
    if(estado === "cerrado") {
        console.log("Venta convertida a Proyecto");
    }

    cargarLeads();
  });
});
