import { db, auth } from "./firebase.js";
import { 
  collection, addDoc, getDocs, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- SEGURIDAD ---
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "/";
  else cargarDatos();
});

window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- CRM ---
window.crearLead = async function () {
  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  if (!nombre || !monto) return alert("Faltan datos clave");

  await addDoc(collection(db, "leads"), {
    nombre, empresa, monto: Number(monto), estado: "nuevo", fecha: new Date(), pagado: 0, hito: "0%"
  });

  document.getElementById("leadNombre").value = "";
  document.getElementById("leadEmpresa").value = "";
  document.getElementById("leadMonto").value = "";
  cargarDatos();
};

// --- CARGA DE SISTEMA ---
async function cargarDatos() {
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => { const el = document.getElementById("col-" + id); if(el) el.innerHTML = `<h3>${id}</h3>`; });

  const tablaOps = document.getElementById("tabla-proyectos");
  if(tablaOps) tablaOps.innerHTML = "";

  let totalPip = 0, ventasMes = 0, cashIn = 0, countLeads = 0, countCierres = 0;

  const snap = await getDocs(collection(db, "leads"));
  countLeads = snap.size;

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const monto = Number(d.monto) || 0;

    if (d.estado === "cerrado") {
      ventasMes += monto;
      cashIn += (d.pagado || 0);
      countCierres++;
      renderProyecto(d, id);
    } else {
      totalPip += monto;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;
    card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><b style="color:var(--green)">USD ${monto.toLocaleString()}</b>`;
    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("id", id));
    
    const col = document.getElementById("col-" + d.estado);
    if (col) col.appendChild(card);
  });

  actualizarCFO_COO(totalPip, ventasMes, cashIn, countLeads, countCierres);
}

// --- OPERACIONES ---
function renderProyecto(data, id) {
  const tabla = document.getElementById("tabla-proyectos");
  const hito = data.hito || "0%";
  const fecha = data.fecha ? data.fecha.toDate() : new Date();
  fecha.setDate(fecha.getDate() + 90);

  const row = tabla.insertRow();
  row.innerHTML = `
    <td><b>${data.nombre}</b></td>
    <td><span class="status-badge">${hito} Pagado</span></td>
    <td><progress value="${parseInt(hito)}" max="100"></progress></td>
    <td>${fecha.toLocaleDateString()}</td>
    <td>
      ${hito !== "100%" ? `<button class="btn-hito" style="background:var(--green); border:none; padding:5px 10px; border-radius:5px; color:white; cursor:pointer;" onclick="cobrarHito('${id}', '${hito}', ${data.monto})">Cobrar</button>` : '✅'}
    </td>
  `;
}

window.cobrarHito = async function(id, hito, total) {
  let np = 0, nh = "";
  if(hito === "0%") { np = total * 0.5; nh = "50%"; }
  else if(hito === "50%") { np = total * 0.8; nh = "80%"; }
  else if(hito === "80%") { np = total; nh = "100%"; }
  
  await updateDoc(doc(db, "leads", id), { pagado: np, hito: nh });
  cargarDatos();
};

// --- CFO & MARKETING LOGIC ---
window.guardarGastoAds = () => {
  localStorage.setItem("gasto_ads", document.getElementById("gastoAds").value);
  cargarDatos();
};

function actualizarCFO_COO(pip, ven, cash, leads, cierres) {
  const inv = Number(localStorage.getItem("gasto_ads")) || 0;
  
  document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
  document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
  document.getElementById("totalCobrado").innerText = `USD ${cash.toLocaleString()}`;
  document.getElementById("comisionesPend").innerText = `USD ${(cash * 0.1).toLocaleString()}`;
  document.getElementById("fondoReserva").innerText = `USD ${(cash * 0.2).toLocaleString()}`;
  document.getElementById("invActual").innerText = `USD ${inv.toLocaleString()}`;

  // CAPACIDAD
  const activos = document.querySelectorAll("#tabla-proyectos tr").length;
  document.getElementById("capacidadCarga").innerText = `${activos}/5`;
  const alerta = document.getElementById("alertaCapacidad");
  alerta.innerText = activos >= 5 ? "CONTRATAR DEV URGENTE" : "CAPACIDAD OK";
  alerta.style.color = activos >= 5 ? "var(--red)" : "var(--green)";

  // ADS ROI
  const cac = cierres > 0 ? (inv / cierres) : 0;
  document.getElementById("cac-val").innerText = `USD ${cac.toFixed(0)}`;
  document.getElementById("roas-val").innerText = inv > 0 ? (ven / inv).toFixed(1) + "x" : "0x";

  // SIMULADOR 100K
  const ticketProm = 16000;
  const cierresNec = Math.ceil(100000 / ticketProm);
  const leadsNec = cierres > 0 ? Math.ceil((leads / cierres) * cierresNec) : 0;
  const inversionNec = leadsNec * (leads > 0 ? (inv / leads) : 0);

  document.getElementById("resultadoSimulador").innerHTML = `
    • Necesitas cerrar <b>${cierresNec} proyectos</b> de USD 16k.<br>
    • Necesitas generar <b>${leadsNec} leads</b> nuevos.<br>
    • Inversión en Ads recomendada: <b style="color:var(--green)">USD ${inversionNec.toLocaleString()}</b>.<br>
    • Necesitarás un equipo de <b>${Math.ceil(cierresNec / 3)} desarrolladores</b> extra.
  `;

  // RENTABILIDAD
  const rent = ven > 0 ? (((ven - 4400 - inv) / ven) * 100).toFixed(0) : 0;
  document.getElementById("rentabilidad").innerText = `${rent}%`;
}

// --- DRAG & DROP ---
["nuevo","reunion","propuesta","cerrado"].forEach(est => {
  const el = document.getElementById("col-" + est);
  el.addEventListener("dragover", e => e.preventDefault());
  el.addEventListener("drop", async e => {
    e.preventDefault();
    await updateDoc(doc(db, "leads", e.dataTransfer.getData("id")), { estado: est });
    cargarDatos();
  });
});
