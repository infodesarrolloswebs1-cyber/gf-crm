import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadPendienteId = null;

onAuthStateChanged(auth, (user) => { if (user) cargarDatos(); else window.location.href = "/"; });
window.logout = () => signOut(auth).then(() => window.location.href = "/");

// --- VALIDACIÓN DE WORKFLOW ---
window.validarWorkflow = async (respuesta) => {
    const link = document.getElementById("mLinkPDF").value;
    if (respuesta === 'si' && link) {
        await updateDoc(doc(db, "leads", leadPendienteId), { 
            estado: "propuesta",
            logs: arrayUnion({ tipo: "Consultoría PDF", link, fecha: new Date().toLocaleString() })
        });
        cargarDatos();
    } else if (respuesta === 'si') {
        alert("Debes adjuntar el link al PDF de requerimientos para avanzar.");
        return;
    }
    document.getElementById("modalWorkflow").style.display = "none";
};

async function cargarDatos() {
    // Inicializar Config
    const ticket = Number(localStorage.getItem("cfg_ticket")) || 16000;
    const costos = Number(localStorage.getItem("cfg_costos")) || 4400;
    const ads = Number(localStorage.getItem("cfg_ads")) || 300;
    
    // Limpiar UI
    const ids = ["nuevo", "reunion", "propuesta", "cerrado"];
    ids.forEach(id => { const el = document.getElementById("col-" + id); if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`; });
    
    document.getElementById("tabla-proyectos-body").innerHTML = "";
    document.getElementById("tabla-comisiones-vendedor").innerHTML = "";
    document.getElementById("tabla-pagos-historial").querySelector("tbody").innerHTML = "";

    let totalPip = 0, ventasMes = 0, cashIn = 0, comPagada = 0, comPendiente = 0, cierresCount = 0;

    const snapLeads = await getDocs(collection(db, "leads"));
    snapLeads.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        const monto = Number(d.monto) || 0;
        const pagado = Number(d.pagado) || 0;

        if (d.estado === "cerrado") {
            ventasMes += monto;
            cierresCount++;
            renderProyecto(d, id);
            renderComision(d, monto, pagado);
            comPagada += (pagado * 0.1);
            comPendiente += ((monto - pagado) * 0.1);
        } else {
            totalPip += monto;
        }
        renderCard(d, id);
    });

    // Historial de Pagos Reales
    const snapPagos = await getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc")));
    snapPagos.forEach(p => {
        const pd = p.data();
        cashIn += pd.monto;
        renderPagoHistorial(pd);
    });

    actualizarKPIs(totalPip, ventasMes, cashIn, comPagada, comPendiente, cierresCount, costos, ads);
}

function renderCard(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<b>${d.nombre}</b><br><small>${d.empresa}</small><br><span style="color:var(--green)">USD ${d.monto.toLocaleString()}</span>`;
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
    if(col) col.appendChild(card);
}

async function avanzarEstado(id, estado) { await updateDoc(doc(db, "leads", id), { estado }); cargarDatos(); }

function renderProyecto(d, id) {
    const t = document.getElementById("tabla-proyectos-body");
    t.innerHTML += `<tr><td>${d.nombre}</td><td>${d.hito || '0%'}</td><td><progress value="${parseInt(d.hito || 0)}" max="100"></progress></td>
    <td><button class="btn-main" onclick="window.cobrarHito('${id}', '${d.hito || '0%'}', ${d.monto}, '${d.nombre}')" style="padding:5px 10px;">Cobrar</button></td></tr>`;
}

window.cobrarHito = async (id, hito, total, cliente) => {
    let np = 0, nh = "", rec = 0;
    if(hito === "0%") { nh = "50%"; rec = total * 0.5; np = rec; }
    else if(hito === "50%") { nh = "80%"; rec = total * 0.3; np = total * 0.8; }
    else if(hito === "80%") { nh = "100%"; rec = total * 0.2; np = total; }
    await updateDoc(doc(db, "leads", id), { hito: nh, pagado: np });
    await addDoc(collection(db, "pagos"), { cliente, monto: rec, hito: nh, fecha: new Date() });
    cargarDatos();
};

function renderComision(d, m, p) {
    const t = document.getElementById("tabla-comisiones-vendedor");
    t.innerHTML += `<tr><td>${d.nombre}</td><td>USD ${m}</td><td>USD ${p}</td><td style="color:var(--green)">USD ${p * 0.1}</td></tr>`;
}

function renderPagoHistorial(pd) {
    const t = document.getElementById("tabla-pagos-historial").querySelector("tbody");
    t.innerHTML += `<tr><td>${pd.fecha.toDate().toLocaleDateString()}</td><td>${pd.cliente}</td><td>USD ${pd.monto}</td><td>${pd.hito}</td></tr>`;
}

function actualizarKPIs(pip, ven, cash, comP, comS, cierres, costs, ads) {
    document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
    document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
    document.getElementById("totalCobrado").innerText = `USD ${cash.toLocaleString()}`;
    document.getElementById("comisCobrada").innerText = `USD ${comP.toLocaleString()}`;
    document.getElementById("comisPendiente").innerText = `USD ${comS.toLocaleString()}`;
    document.getElementById("comisionesGlobales").innerText = `USD ${comS.toLocaleString()}`;
    document.getElementById("invActual").innerText = `USD ${ads.toLocaleString()}`;
    
    if(ads > 0) {
        document.getElementById("cac-val").innerText = `USD ${(ads / (cierres || 1)).toFixed(0)}`;
        document.getElementById("roas-val").innerText = `${(ven / ads).toFixed(1)}x`;
    }

    const activos = document.querySelectorAll("#tabla-proyectos-body tr").length;
    document.getElementById("capacidadCarga").innerText = `${activos}/5`;
    const rent = ven > 0 ? (((ven - costs - ads) / ven) * 100).toFixed(0) : 0;
    document.getElementById("rentabilidad").innerText = `${rent}%`;
}

window.crearLead = async () => {
    const n = document.getElementById("leadNombre").value;
    const e = document.getElementById("leadEmpresa").value;
    const m = document.getElementById("leadMonto").value;
    if(!n || !m) return;
    await addDoc(collection(db, "leads"), { nombre: n, empresa: e, monto: Number(m), estado: "nuevo", hito: "0%", pagado: 0, fecha: new Date(), logs: [] });
    cargarDatos();
};

window.guardarConfig = () => {
    localStorage.setItem("cfg_ticket", document.getElementById("cfgTicket").value);
    localStorage.setItem("cfg_costos", document.getElementById("cfgCostos").value);
    localStorage.setItem("cfg_ads", document.getElementById("cfgAds").value);
    cargarDatos();
    alert("Configuración Guardada Correctamente");
};
