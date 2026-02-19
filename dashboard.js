import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, getDoc, query, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadActualId = null;

onAuthStateChanged(auth, (user) => { if (!user) window.location.href = "/"; else cargarSistema(); });
window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- WORKFLOW COMERCIAL ---
window.abrirModal = async (id) => {
  leadActualId = id;
  const snap = await getDoc(doc(db, "leads", id));
  const d = snap.data();
  document.getElementById("mLeadNombre").innerText = `${d.nombre} (${d.empresa})`;
  const hist = document.getElementById("mHistorial");
  hist.innerHTML = "";
  (d.logs || []).reverse().forEach(l => {
    hist.innerHTML += `<div class="log-entry"><b>${l.fecha}</b><br>${l.tipo}: ${l.link ? `<a href="${l.link}" target="_blank" style="color:var(--accent)">Ver Documento/Link</a>` : 'Sin link'}</div>`;
  });
  document.getElementById("modalLead").style.display = "flex";
};

window.agregarLog = async () => {
  const tipo = document.getElementById("mTipoAccion").value;
  const link = document.getElementById("mLink").value;
  const fecha = new Date().toLocaleString();
  await updateDoc(doc(db, "leads", leadActualId), { logs: arrayUnion({ tipo, link, fecha }) });
  document.getElementById("mLink").value = "";
  abrirModal(leadActualId);
};

async function cargarSistema() {
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => {
    const col = document.getElementById("col-" + id);
    if(col) col.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
  });

  const tablaOps = document.querySelector("#tabla-proyectos tbody");
  const tablaCom = document.querySelector("#tabla-comisiones-vendedor tbody");
  if(tablaOps) tablaOps.innerHTML = "";
  if(tablaCom) tablaCom.innerHTML = "";
  
  let totalPip = 0, ventasCTR = 0, cashIn = 0, comPagada = 0, comPendiente = 0;

  const snapLeads = await getDocs(collection(db, "leads"));
  snapLeads.forEach(docSnap => {
    const d = docSnap.data();
    const id = docSnap.id;
    const m = Number(d.monto) || 0;
    const pag = Number(d.pagado) || 0;

    if(d.estado === "cerrado") {
      ventasCTR += m;
      renderProyectoCTO(d, id);
      renderComisionComercial(d, m, pag);
      comPagada += (pag * 0.1);
      comPendiente += ((m - pag) * 0.1);
    } else {
      totalPip += m;
    }
    renderCardVentas(d, id);
  });

  // Historial de Pagos (CTR View)
  const snapPagos = await getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc")));
  const tPagos = document.querySelector("#tabla-pagos-historial tbody");
  if(tPagos) {
    tPagos.innerHTML = "";
    snapPagos.forEach(p => {
      const pd = p.data(); cashIn += pd.monto;
      tPagos.innerHTML += `<tr><td>${pd.fecha.toDate().toLocaleDateString()}</td><td>${pd.cliente}</td><td>USD ${pd.monto}</td><td>${pd.hito}</td></tr>`;
    });
  }

  actualizarKpisGlobales(totalPip, ventasCTR, cashIn, comPagada, comPendiente);
}

function renderCardVentas(d, id) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><span style="color:var(--green)">USD ${d.monto}</span>`;
  card.onclick = () => abrirModal(id);
  const col = document.getElementById("col-" + d.estado);
  if(col) col.appendChild(card);
}

function renderProyectoCTO(d, id) {
  const t = document.querySelector("#tabla-proyectos tbody");
  if(!t) return;
  t.innerHTML += `<tr><td>${d.nombre}</td><td>${d.hito || '0%'}</td><td><progress value="${parseInt(d.hito || 0)}" max="100"></progress></td>
  <td><button onclick="window.cobrarHitoJS('${id}', '${d.hito || '0%'}', ${d.monto}, '${d.nombre}')" class="btn-main">Cobrar Hito</button></td></tr>`;
}

function renderComisionComercial(d, m, pag) {
  const t = document.querySelector("#tabla-comisiones-vendedor tbody");
  if(!t) return;
  t.innerHTML += `<tr><td>${d.nombre}</td><td>USD ${m}</td><td>USD ${pag}</td><td style="color:var(--green)">USD ${pag * 0.1}</td></tr>`;
}

window.cobrarHitoJS = async (id, hito, total, cliente) => {
  let np = 0, nh = "", rec = 0;
  if(hito === "0%") { nh = "50%"; rec = total * 0.5; np = rec; }
  else if(hito === "50%") { nh = "80%"; rec = total * 0.3; np = total * 0.8; }
  else if(hito === "80%") { nh = "100%"; rec = total * 0.2; np = total; }
  await updateDoc(doc(db, "leads", id), { hito: nh, pagado: np });
  await addDoc(collection(db, "pagos"), { cliente, monto: rec, hito: nh, fecha: new Date() });
  cargarSistema();
};

function actualizarKpisGlobales(pip, ven, cash, cPag, cPend) {
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
  set("totalPipeline", `USD ${pip.toLocaleString()}`);
  set("ventasMes", `USD ${ven.toLocaleString()}`);
  set("totalCobrado", `USD ${cash.toLocaleString()}`);
  set("comisCobrada", `USD ${cPag.toLocaleString()}`);
  set("comisPendiente", `USD ${cPend.toLocaleString()}`);
  
  const activos = document.querySelectorAll("#tabla-proyectos tbody tr").length;
  set("capacidadCarga", `${activos}/5`);
}
