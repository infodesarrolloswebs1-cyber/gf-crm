import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, getDoc, query, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadPendienteId = null;

onAuthStateChanged(auth, (user) => { if (user) cargarSistema(); else window.location.href = "/"; });
window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- VALIDACIÓN DE WORKFLOW LEGENDARIO ---
window.validarPaso = async (resp) => {
  const link = document.getElementById("mLinkPDF").value;
  if(resp === 'si') {
    if(!link) return alert("Debes incluir el link al PDF de trabajo para avanzar.");
    await updateDoc(doc(db, "leads", leadPendienteId), { 
      estado: "propuesta",
      logs: arrayUnion({ tipo: "Presentación PDF", link, fecha: new Date().toLocaleString() })
    });
    cargarSistema();
  }
  document.getElementById("modalWorkflow").style.display = "none";
};

async function cargarSistema() {
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => { const el = document.getElementById("col-" + id); if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`; });

  const tOps = document.getElementById("tabla-proyectos");
  if(tOps) tOps.innerHTML = "";

  let totalPip = 0, ventasMes = 0, cashIn = 0, countCierres = 0;
  const snap = await getDocs(collection(db, "leads"));

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const id = docSnap.id;
    const monto = Number(d.monto) || 0;

    if (d.estado === "cerrado") {
      ventasMes += monto;
      countCierres++;
      renderProyectoCTO(d, id);
    } else {
      totalPip += monto;
    }
    renderCard(d, id);
  });

  // Cargar Historial de Pagos Reales
  const snapPagos = await getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc")));
  const tFin = document.querySelector("#tabla-pagos-historial tbody");
  if(tFin) tFin.innerHTML = "";
  snapPagos.forEach(p => {
    const pd = p.data(); cashIn += pd.monto;
    if(tFin) tFin.innerHTML += `<tr><td>${pd.fecha.toDate().toLocaleDateString()}</td><td>${pd.cliente}</td><td>USD ${pd.monto}</td><td>${pd.hito}</td></tr>`;
  });

  actualizarKpis(totalPip, ventasMes, cashIn, countCierres);
}

function renderCard(d, id) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><span style="color:var(--green)">USD ${d.monto}</span>`;
  
  card.onclick = () => {
    if (d.estado === "nuevo") avanzarEstado(id, "reunion");
    else if (d.estado === "reunion") {
      leadPendienteId = id;
      document.getElementById("mLeadNombre").innerText = d.nombre;
      document.getElementById("modalWorkflow").style.display = "flex";
    }
    else if (d.estado === "propuesta") avanzarEstado(id, "cerrado");
  };

  const col = document.getElementById("col-" + d.estado);
  if (col) col.appendChild(card);
}

async function avanzarEstado(id, nuevoEstado) {
  await updateDoc(doc(db, "leads", id), { estado: nuevoEstado });
  cargarSistema();
}

function renderProyectoCTO(d, id) {
  const t = document.getElementById("tabla-proyectos");
  if(!t) return;
  t.innerHTML += `<tr><td>${d.nombre}</td><td>${d.hito || '0%'}</td><td><progress value="${parseInt(d.hito || 0)}" max="100"></progress></td>
  <td><button onclick="window.cobrarHito('${id}', '${d.hito || '0%'}', ${d.monto}, '${d.nombre}')" class="btn-main" style="background:var(--green)">Cobrar</button></td></tr>`;
}

window.cobrarHito = async (id, hito, total, cliente) => {
  let np = 0, nh = "", rec = 0;
  if(hito === "0%") { nh = "50%"; rec = total * 0.5; np = rec; }
  else if(hito === "50%") { nh = "80%"; rec = total * 0.3; np = total * 0.8; }
  else if(hito === "80%") { nh = "100%"; rec = total * 0.2; np = total; }
  await updateDoc(doc(db, "leads", id), { hito: nh, pagado: np });
  await addDoc(collection(db, "pagos"), { cliente, monto: rec, hito: nh, fecha: new Date() });
  cargarSistema();
};

function actualizarKpis(pip, ven, cash, cierres) {
  const ads = Number(localStorage.getItem("cfg_ads")) || 0;
  const fijos = Number(localStorage.getItem("cfg_costos")) || 4400;

  document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
  document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
  document.getElementById("totalCobrado").innerText = `USD ${cash.toLocaleString()}`;
  document.getElementById("comisionesPend").innerText = `USD ${(cash * 0.1).toLocaleString()}`;
  document.getElementById("invActual").innerText = `USD ${ads.toLocaleString()}`;
  
  if(ads > 0) {
    document.getElementById("cac-val").innerText = `USD ${(ads / (cierres || 1)).toFixed(0)}`;
    document.getElementById("roas-val").innerText = `${(ven / ads).toFixed(1)}x`;
  }
  
  const rent = ven > 0 ? (((ven - fijos - ads) / ven) * 100).toFixed(0) : 0;
  document.getElementById("rentabilidad").innerText = `${rent}%`;
  
  const activos = document.querySelectorAll("#tabla-proyectos tr").length;
  document.getElementById("capacidadCarga").innerText = `${activos}/5`;
}

window.guardarConfig = () => {
  localStorage.setItem("cfg_ads", document.getElementById("cfgAds").value);
  localStorage.setItem("cfg_costos", document.getElementById("cfgCostos").value);
  cargarSistema();
  alert("Variables de Negocio actualizadas");
};
