import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadPendienteId = null;

onAuthStateChanged(auth, (user) => { if (user) cargarDatos(); else window.location.href = "/"; });
window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- WORKFLOW VALIDADO ---
window.gestionarPaso = async (id, estadoActual, d) => {
    leadPendienteId = id;
    const modal = document.getElementById("modalWorkflow");
    const titulo = document.getElementById("mLeadNombre");
    const inst = document.getElementById("mInstrucciones");
    const inputs = document.getElementById("mInputs");
    const btn = document.getElementById("btnConfirmar");

    inputs.innerHTML = "";
    modal.style.display = "flex";
    titulo.innerText = d.nombre;

    if (estadoActual === "nuevo") {
        inst.innerText = "¿Se realizó la Consultoría? Adjunta el PDF Técnico.";
        inputs.innerHTML = `<input id="valLink" placeholder="Link al PDF">`;
        btn.onclick = () => procesarPaso("consultoria", "valLink");
    } 
    else if (estadoActual === "consultoria") {
        inst.innerText = "¿Mariano confirmó el cierre?";
        btn.onclick = () => procesarPaso("contrato", null);
    }
    else if (estadoActual === "contrato") {
        inst.innerText = "Firma ante escribano y abono del 50%.";
        inputs.innerHTML = `<select id="valMedio"><option>Transferencia</option><option>Efectivo</option></select>`;
        btn.onclick = () => procesarPagoInicial(d);
    }
};

async function procesarPaso(nuevoEstado, inputId) {
    const val = inputId ? document.getElementById(inputId).value : "OK";
    if (!val) return alert("Dato requerido");
    await updateDoc(doc(db, "leads", leadPendienteId), { estado: nuevoEstado, logs: arrayUnion({ hito: nuevoEstado, ref: val, fecha: new Date().toLocaleString() }) });
    document.getElementById("modalWorkflow").style.display = "none";
    cargarDatos();
}

async function procesarPagoInicial(d) {
    const medio = document.getElementById("valMedio").value;
    const monto = d.monto * 0.5;
    await updateDoc(doc(db, "leads", leadPendienteId), { estado: "produccion", pagado: monto, etapaProd: "Diseño", hito: "50%" });
    await addDoc(collection(db, "pagos"), { cliente: d.nombre, monto, hito: "50% (Firma)", medio, fecha: new Date() });
    document.getElementById("modalWorkflow").style.display = "none";
    cargarDatos();
}

async function cargarDatos() {
    const ids = ["nuevo", "consultoria", "contrato", "produccion"];
    ids.forEach(id => { const el = document.getElementById("col-" + id); if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`; });
    
    document.querySelector("#tabla-proyectos tbody").innerHTML = "";
    document.querySelector("#tabla-pagos tbody").innerHTML = "";

    let totalPip = 0, ventasMes = 0, cashIn = 0;

    const snapLeads = await getDocs(collection(db, "leads"));
    snapLeads.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        if (d.estado === "produccion") { ventasMes += d.monto; renderProyecto(d, id); } 
        else { totalPip += d.monto; }
        renderCard(d, id);
    });

    const snapPagos = await getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc")));
    snapPagos.forEach(p => { const pd = p.data(); cashIn += pd.monto; renderPago(pd); });

    actualizarKPIs(totalPip, ventasMes, cashIn);
}

function renderCard(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><div class="usd">USD ${d.monto.toLocaleString()}</div>`;
    card.onclick = () => window.gestionarPaso(id, d.estado, d);
    document.getElementById("col-" + d.estado).appendChild(card);
}

function renderProyecto(d, id) {
    const t = document.querySelector("#tabla-proyectos tbody");
    const etapa = d.etapaProd || "Diseño";
    t.innerHTML += `<tr><td>${d.nombre}</td><td>${etapa}</td><td>${d.hito || '50%'}</td>
    <td><button class="btn" style="background:var(--accent)" onclick="avanzarHitoProd('${id}', '${etapa}', ${d.monto})">Próximo</button></td></tr>`;
}

window.avanzarHitoProd = async (id, etapa, total) => {
    let ne = "", nh = "", nm = 0;
    if (etapa === "Diseño") { ne = "Desarrollo"; nh = "80%"; nm = total * 0.3; }
    else if (etapa === "Desarrollo") { ne = "Testing"; nh = "100%"; nm = total * 0.2; }
    if (!ne) return alert("Finalizado");

    const medio = prompt("Medio de pago:");
    if (!medio) return;

    await updateDoc(doc(db, "leads", id), { etapaProd: ne, hito: nh });
    await addDoc(collection(db, "pagos"), { cliente: "Proyecto "+id, monto: nm, hito: nh, medio, fecha: new Date() });
    cargarDatos();
};

function renderPago(pd) {
    const t = document.querySelector("#tabla-pagos tbody");
    t.innerHTML += `<tr><td>${pd.fecha.toDate().toLocaleDateString()}</td><td>${pd.cliente}</td><td>USD ${pd.monto.toLocaleString()}</td><td>${pd.hito}</td><td>${pd.medio}</td></tr>`;
}

function actualizarKPIs(pip, ven, cash) {
    const costos = Number(localStorage.getItem("cfg_costos")) || 4400;
    document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
    document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
    document.getElementById("totalCobrado").innerText = `USD ${cash.toLocaleString()}`;
    document.getElementById("comisionesPend").innerText = `USD ${(cash * 0.1).toLocaleString()}`;
    const rent = ven > 0 ? (((cash - costos) / cash) * 100).toFixed(0) : 0;
    document.getElementById("rentabilidad").innerText = `${rent}%`;
    const activos = document.querySelectorAll("#tabla-proyectos tbody tr").length;
    document.getElementById("capacidadCarga").innerText = `${activos}/5`;
}

window.crearLead = async () => {
    const n = document.getElementById("leadNombre").value;
    const e = document.getElementById("leadEmpresa").value;
    const m = document.getElementById("leadMonto").value;
    if(!n || !m) return;
    await addDoc(collection(db, "leads"), { nombre: n, empresa: e, monto: Number(m), estado: "nuevo", hito: "0%", pagado: 0, fecha: new Date() });
    cargarDatos();
};

window.guardarConfig = () => {
    localStorage.setItem("cfg_costos", document.getElementById("cfgCosts").value);
    cargarDatos(); alert("Actualizado");
};
