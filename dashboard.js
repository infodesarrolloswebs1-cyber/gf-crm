import { db, auth } from "./firebase.js";
import { 
  collection, addDoc, getDocs, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// SEGURIDAD: REDIRECCIÓN SI NO HAY SESIÓN
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "/";
  else cargarSistema();
});

window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- LOGICA CRM ---
window.crearLead = async function () {
  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  if (!nombre || !monto) return alert("Por favor, completa Nombre y Monto.");

  await addDoc(collection(db, "leads"), {
    nombre,
    empresa,
    monto: Number(monto),
    estado: "nuevo",
    fecha: new Date(),
    pagado: 0,
    hito: "0%"
  });

  limpiarInputs();
  cargarSistema();
};

async function cargarSistema() {
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => {
    const el = document.getElementById("col-" + id);
    if(el) el.innerHTML = `<h3>${id}</h3>`;
  });

  const tablaOps = document.getElementById("tabla-proyectos");
  if(tablaOps) tablaOps.innerHTML = "";

  let totalPip = 0, ventasMes = 0, cashInReal = 0;

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const monto = Number(d.monto) || 0;

    if (d.estado === "cerrado") {
      ventasMes += monto;
      cashInReal += (d.pagado || 0);
      renderizarProyecto(d, id);
    } else {
      totalPip += monto;
    }

    // Render en CRM
    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;
    card.innerHTML = `
      <b>${d.nombre}</b><br>
      <small style="color:var(--text-dim)">${d.empresa}</small><br>
      <div style="margin-top:10px; font-weight:bold; color:var(--green)">USD ${monto.toLocaleString()}</div>
    `;

    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("id", id));
    const col = document.getElementById("col-" + d.estado);
    if (col) col.appendChild(card);
  });

  actualizarIndicadores(totalPip, ventasMes, cashInReal);
}

// --- LOGICA OPERACIONES (COO) ---
function renderizarProyecto(data, id) {
  const tabla = document.getElementById("tabla-proyectos");
  if(!tabla) return;

  const hito = data.hito || "Pendiente";
  const fecha = data.fecha ? data.fecha.toDate() : new Date();
  fecha.setDate(fecha.getDate() + 90);

  const row = tabla.insertRow();
  row.innerHTML = `
    <td><b>${data.nombre}</b><br><small>${data.empresa}</small></td>
    <td><span class="status-badge">${hito} Cobrado</span></td>
    <td><progress value="${parseInt(hito)}" max="100" style="width:80px;"></progress></td>
    <td>${fecha.toLocaleDateString()}</td>
    <td>
      ${hito !== "100%" ? 
        `<button class="btn-hito" onclick="ejecutarCobro('${id}', '${hito}', ${data.monto})">Cobrar Hito</button>` 
        : '<span style="color:var(--green)">🏁 Completado</span>'}
    </td>
  `;
}

window.ejecutarCobro = async function(id, hitoActual, total) {
  let nuevoMonto = 0;
  let nuevoHito = "";

  if(hitoActual === "0%" || hitoActual === "Pendiente") { nuevoMonto = total * 0.50; nuevoHito = "50%"; }
  else if(hitoActual === "50%") { nuevoMonto = total * 0.80; nuevoHito = "80%"; }
  else if(hitoActual === "80%") { nuevoMonto = total; nuevoHito = "100%"; }

  await updateDoc(doc(db, "leads", id), {
    pagado: nuevoMonto,
    hito: nuevoHito
  });

  cargarSistema();
};

// --- LOGICA FINANZAS (CFO) ---
function actualizarIndicadores(pip, ven, cash) {
  const set = (id, val) => { 
    const el = document.getElementById(id); 
    if(el) el.innerText = val; 
  };

  set("totalPipeline", `USD ${pip.toLocaleString()}`);
  set("ventasMes", `USD ${ven.toLocaleString()}`);
  set("totalCobrado", `USD ${cash.toLocaleString()}`);
  set("comisionesPend", `USD ${(cash * 0.10).toLocaleString()}`);
  set("fondoReserva", `USD ${(cash * 0.20).toLocaleString()}`);
  
  // LOGICA DE CAPACIDAD (COO)
  const proyectosActivos = document.querySelectorAll("#tabla-proyectos tr").length;
  const capCarga = document.getElementById("capacidadCarga");
  const alerta = document.getElementById("alertaCapacidad");
  
  if(capCarga) {
    capCarga.innerText = `${proyectosActivos}/5`;
    if(proyectosActivos >= 5) {
      capCarga.style.color = "var(--red)";
      alerta.innerText = "⚠️ CAPACIDAD MÁXIMA: CONTRATAR DEV";
      alerta.style.color = "var(--red)";
    } else {
      capCarga.style.color = "var(--green)";
      alerta.innerText = "✅ DISPONIBLE PARA ESCALAR";
      alerta.style.color = "var(--green)";
    }
  }

  const elRen = document.getElementById("rentabilidad");
  if(elRen) {
    const rent = ven > 0 ? (((ven - 4400) / ven) * 100).toFixed(0) : 0;
    elRen.innerText = `${rent}%`;
    elRen.style.color = rent < 20 ? "var(--red)" : "var(--green)";
  }
}

// --- DRAG & DROP ---
["nuevo","reunion","propuesta","cerrado"].forEach(estado => {
  const col = document.getElementById("col-" + estado);
  if(!col) return;
  col.addEventListener("dragover", e => e.preventDefault());
  col.addEventListener("drop", async e => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    await updateDoc(doc(db, "leads", id), { estado });
    cargarSistema();
  });
});

function limpiarInputs() {
  document.getElementById("leadNombre").value = "";
  document.getElementById("leadEmpresa").value = "";
  document.getElementById("leadMonto").value = "";
}
