import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => { if (!user) window.location.href = "/"; else cargarSistema(); });

window.logout = () => signOut(auth).then(() => window.location.href = "/");

window.guardarConfig = () => {
  localStorage.setItem("cfg_ticket", document.getElementById("cfgTicket").value);
  localStorage.setItem("cfg_costos", document.getElementById("cfgCostos").value);
  localStorage.setItem("cfg_ads", document.getElementById("cfgAds").value);
  alert("Configuración Guardada");
  cargarSistema();
};

async function cargarSistema() {
  // Init Config
  const ticket = localStorage.getItem("cfg_ticket") || 16000;
  const costos = localStorage.getItem("cfg_costos") || 4400;
  const ads = localStorage.getItem("cfg_ads") || 1500;
  
  document.getElementById("cfgTicket").value = ticket;
  document.getElementById("cfgCostos").value = costos;
  document.getElementById("cfgAds").value = ads;

  // Limpiar UI
  const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
  ids.forEach(id => document.getElementById("col-" + id).innerHTML = `<h3>${id.toUpperCase()}</h3>`);
  document.getElementById("tabla-proyectos").innerHTML = "";
  document.getElementById("tabla-pagos-historial").innerHTML = "";

  let totalPip = 0, ventasMes = 0, cashIn = 0, leadsCount = 0, cierresCount = 0;

  // Leads
  const snapLeads = await getDocs(collection(db, "leads"));
  leadsCount = snapLeads.size;
  snapLeads.forEach(docSnap => {
    const d = docSnap.data();
    const m = Number(d.monto) || 0;
    if(d.estado === "cerrado") { ventasMes += m; cierresCount++; renderProyecto(d, docSnap.id); } 
    else { totalPip += m; }
    renderCard(d, docSnap.id);
  });

  // Pagos
  const snapPagos = await getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc")));
  snapPagos.forEach(p => {
    const pd = p.data();
    cashIn += pd.monto;
    renderPagoHistorial(pd);
  });

  actualizarDash(totalPip, ventasMes, cashIn, leadsCount, cierresCount, ticket, costos, ads);
}

function renderCard(d, id) {
  const card = document.createElement("div");
  card.className = "card"; card.draggable = true; card.dataset.id = id;
  card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><span style="color:var(--green)">USD ${d.monto.toLocaleString()}</span>`;
  card.addEventListener("dragstart", e => e.dataTransfer.setData("id", id));
  document.getElementById("col-" + d.estado).appendChild(card);
}

function renderProyecto(d, id) {
  const hito = d.hito || "0%";
  const fecha = d.fecha ? d.fecha.toDate() : new Date(); fecha.setDate(fecha.getDate() + 90);
  const row = document.getElementById("tabla-proyectos").insertRow();
  row.innerHTML = `<td>${d.nombre}</td><td>${hito}</td><td><progress value="${parseInt(hito)}" max="100"></progress></td><td>${fecha.toLocaleDateString()}</td>
  <td>${hito !== "100%" ? `<button class="btn-main" style="padding:5px 10px;" onclick="cobrarHito('${id}', '${hito}', ${d.monto}, '${d.nombre}')">Cobrar</button>` : '✅'}</td>`;
}

function renderPagoHistorial(pd) {
  const row = document.getElementById("tabla-pagos-historial").insertRow();
  row.innerHTML = `<td>${pd.fecha.toDate().toLocaleDateString()}</td><td>${pd.cliente}</td><td>USD ${pd.monto.toLocaleString()}</td><td>${pd.hito}</td><td>Transferencia</td>`;
}

window.cobrarHito = async function(id, hito, total, cliente) {
  let np = 0, nh = "", rec = 0;
  if(hito === "0%") { nh = "50%"; rec = total * 0.5; np = rec; }
  else if(hito === "50%") { nh = "80%"; rec = total * 0.3; np = total * 0.8; }
  else if(hito === "80%") { nh = "100%"; rec = total * 0.2; np = total; }

  await updateDoc(doc(db, "leads", id), { hito: nh, pagado: np });
  await addDoc(collection(db, "pagos"), { cliente, monto: rec, hito: nh, fecha: new Date() });
  cargarSistema();
};

function actualizarDash(pip, ven, cash, leads, cierres, ticket, costos, ads) {
  document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
  document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
  document.getElementById("totalCobrado").innerText = `USD ${cash.toLocaleString()}`;
  document.getElementById("comisionesPend").innerText = `USD ${(cash * 0.1).toLocaleString()}`;
  document.getElementById("invActual").innerText = `USD ${Number(ads).toLocaleString()}`;
  
  const activos = document.querySelectorAll("#tabla-proyectos tr").length;
  document.getElementById("capacidadCarga").innerText = `${activos}/5`;
  
  const rent = ven > 0 ? (((ven - costos - ads) / ven) * 100).toFixed(0) : 0;
  document.getElementById("rentabilidad").innerText = `${rent}%`;

  // Simulador
  const meta = 100000;
  const cierresNec = Math.ceil(meta / ticket);
  const leadsNec = cierres > 0 ? Math.ceil((leads / cierres) * cierresNec) : 0;
  const invNec = leadsNec * (leads > 0 ? (ads / leads) : 0);

  document.getElementById("resultadoSimulador").innerHTML = `
    • Meta: <b>USD 100.000</b> | Cierres nec: <b>${cierresNec}</b><br>
    • Leads nec: <b>${leadsNec}</b> | Inversión Ads rec: <b style="color:var(--green)">USD ${invNec.toLocaleString()}</b><br>
    • CAC: <b>USD ${(cierres > 0 ? ads/cierres : 0).toFixed(0)}</b> | ROAS: <b>${(ads > 0 ? ven/ads : 0).toFixed(1)}x</b>
  `;
}

// Drag & Drop
["nuevo","reunion","propuesta","cerrado"].forEach(est => {
  const col = document.getElementById("col-" + est);
  col.addEventListener("dragover", e => e.preventDefault());
  col.addEventListener("drop", async e => {
    e.preventDefault();
    await updateDoc(doc(db, "leads", e.dataTransfer.getData("id")), { estado: est });
    cargarSistema();
  });
});

window.crearLead = async function () {
  const n = document.getElementById("leadNombre").value;
  const e = document.getElementById("leadEmpresa").value;
  const m = document.getElementById("leadMonto").value;
  if(!n || !m) return;
  await addDoc(collection(db, "leads"), { nombre: n, empresa: e, monto: Number(m), estado: "nuevo", hito: "0%", pagado: 0, fecha: new Date() });
  cargarSistema();
};
