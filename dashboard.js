import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, getDoc, query, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadActualId = null;

onAuthStateChanged(auth, (user) => { if (!user) window.location.href = "/"; else cargarSistema(); });
window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- CONFIGURACIÓN ---
window.guardarConfig = () => {
  localStorage.setItem("cfg_vendedor", document.getElementById("cfgVendedor").value);
  localStorage.setItem("cfg_ticket", document.getElementById("cfgTicket").value);
  localStorage.setItem("cfg_costos", document.getElementById("cfgCostos").value);
  alert("Configuración Guardada");
  cargarSistema();
};

// --- MODAL Y LOGS ---
window.abrirModal = async (id) => {
  leadActualId = id;
  const snap = await getDoc(doc(db, "leads", id));
  const d = snap.data();
  document.getElementById("mLeadNombre").innerText = d.nombre + " - USD " + d.monto;
  const hist = document.getElementById("mHistorial");
  hist.innerHTML = "";
  (d.logs || []).reverse().forEach(l => {
    hist.innerHTML += `<div class="log-entry"><b>${l.fecha} - ${l.tipo}:</b> ${l.link ? `<a href="${l.link}" target="_blank" style="color:var(--accent)">Ver Link</a>` : 'Sin link'}</div>`;
  });
  document.getElementById("modalLead").style.display = "flex";
};

window.agregarLog = async () => {
  const tipo = document.getElementById("mTipoAccion").value;
  const link = document.getElementById("mLink").value;
  const fecha = new Date().toLocaleString();
  
  await updateDoc(doc(db, "leads", leadActualId), {
    logs: arrayUnion({ tipo, link, fecha })
  });
  
  document.getElementById("mLink").value = "";
  abrirModal(leadActualId); // Recargar modal
};

// --- CARGA GENERAL ---
async function cargarSistema() {
  const vName = localStorage.getItem("cfg_vendedor") || "Comercial 1";
  document.getElementById("cfgVendedor").value = vName;
  document.getElementById("cfgTicket").value = localStorage.getItem("cfg_ticket") || 16000;
  document.getElementById("cfgCostos").value = localStorage.getItem("cfg_costos") || 4400;

  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => document.getElementById("col-" + id).innerHTML = `<h3>${id.toUpperCase()}</h3>`);
  document.getElementById("tabla-proyectos").querySelector("tbody").innerHTML = "";
  document.getElementById("tabla-comisiones-vendedor").querySelector("tbody").innerHTML = "";
  
  let totalPip = 0, ventasMes = 0, cashIn = 0, comPagada = 0, comPendiente = 0;

  const snapLeads = await getDocs(collection(db, "leads"));
  snapLeads.forEach(docSnap => {
    const d = docSnap.data();
    const id = docSnap.id;
    const m = Number(d.monto) || 0;
    const pag = Number(d.pagado) || 0;

    if(d.estado === "cerrado") {
      ventasMes += m;
      renderProyecto(d, id);
      // Cálculo Comisión (10%)
      const cTotal = m * 0.1;
      const cPagada = pag * 0.1;
      comPagada += cPagada;
      comPendiente += (cTotal - cPagada);
      renderComision(d.nombre, m, pag, cPagada, (cTotal - cPagada));
    } else {
      totalPip += m;
    }
    renderCard(d, id);
  });

  const snapPagos = await getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc")));
  document.getElementById("tabla-pagos-historial").querySelector("tbody").innerHTML = "";
  snapPagos.forEach(p => {
    const pd = p.data();
    cashIn += pd.monto;
    const row = document.getElementById("tabla-pagos-historial").querySelector("tbody").insertRow();
    row.innerHTML = `<td>${pd.fecha.toDate().toLocaleDateString()}</td><td>${pd.cliente}</td><td>USD ${pd.monto.toLocaleString()}</td><td>${pd.hito}</td>`;
  });

  actualizarDash(totalPip, ventasMes, cashIn, comPagada, comPendiente);
}

function renderCard(d, id) {
  const card = document.createElement("div");
  card.className = "card"; card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><span style="color:var(--green)">USD ${d.monto.toLocaleString()}</span>`;
  card.onclick = () => abrirModal(id);
  document.getElementById("col-" + d.estado).appendChild(card);
}

function renderProyecto(d, id) {
  const row = document.getElementById("tabla-proyectos").querySelector("tbody").insertRow();
  row.innerHTML = `<td>${d.nombre}</td><td>${d.hito || '0%'}</td><td><progress value="${parseInt(d.hito || 0)}" max="100"></progress></td><td>90 Días</td><td><button class="btn-main" style="padding:5px 10px" onclick="window.cobrarHitoJS('${id}', '${d.hito || '0%'}', ${d.monto}, '${d.nombre}')">Cobrar</button></td>`;
}

function renderComision(cli, total, pagCli, comPag, comPend) {
  const row = document.getElementById("tabla-comisiones-vendedor").querySelector("tbody").insertRow();
  row.innerHTML = `<td>${cli}</td><td>USD ${total.toLocaleString()}</td><td>USD ${pagCli.toLocaleString()}</td><td style="color:var(--green)">USD ${comPag.toLocaleString()}</td><td style="color:#f59e0b">USD ${comPend.toLocaleString()}</td>`;
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

function actualizarDash(pip, ven, cash, cPag, cPend) {
  document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
  document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
  document.getElementById("totalCobrado").innerText = `USD ${cash.toLocaleString()}`;
  document.getElementById("comisCobrada").innerText = `USD ${cPag.toLocaleString()}`;
  document.getElementById("comisPendiente").innerText = `USD ${cPend.toLocaleString()}`;
  
  const activos = document.querySelectorAll("#tabla-proyectos tbody tr").length;
  document.getElementById("capacidadCarga").innerText = `${activos}/5`;
  const costs = Number(localStorage.getItem("cfg_costos")) || 4400;
  const rent = ven > 0 ? (((ven - costs) / ven) * 100).toFixed(0) : 0;
  document.getElementById("rentabilidad").innerText = `${rent}%`;
}

window.crearLead = async () => {
  const n = document.getElementById("leadNombre").value;
  const e = document.getElementById("leadEmpresa").value;
  const m = document.getElementById("leadMonto").value;
  if(!n || !m) return;
  await addDoc(collection(db, "leads"), { nombre: n, empresa: e, monto: Number(m), estado: "nuevo", hito: "0%", pagado: 0, fecha: new Date(), logs: [] });
  cargarSistema();
};
