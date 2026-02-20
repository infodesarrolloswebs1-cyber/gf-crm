import { db, auth } from "./firebase.js";
import { collection, addDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadSeleccionadoId = null;
let leadDataActual = null;

onAuthStateChanged(auth, (user) => {
    if (user) { escucharDatos(); } 
    else { window.location.href = "index.html"; }
});

window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");

function escucharDatos() {
    onSnapshot(collection(db, "leads"), (snap) => {
        ["nuevo", "consultoria", "contrato", "produccion"].forEach(id => {
            const el = document.getElementById("col-" + id);
            if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
        });
        document.getElementById("listaComisiones").innerHTML = "";
        document.getElementById("listaStatus").innerHTML = "";
        let pipTotal = 0, ventasCount = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            renderCard(d, id);
            const monto = Number(d.monto) || 0;
            const cobrado = Number(d.pagado) || 0;

            if (d.estado === "produccion" || d.estado === "finalizado") {
                ventasCount++;
                const rowCom = document.getElementById("listaComisiones").insertRow();
                rowCom.innerHTML = `<td>${d.nombre}</td><td>USD ${monto.toLocaleString()}</td><td>USD ${cobrado.toLocaleString()}</td><td style="color:var(--green)">USD ${(cobrado * 0.1).toLocaleString()}</td><td style="color:#f59e0b">USD ${((monto - cobrado) * 0.1).toLocaleString()}</td>`;
                const rowStat = document.getElementById("listaStatus").insertRow();
                rowStat.innerHTML = `<td>${d.nombre}</td><td>${d.etapaProd || "En espera"}</td><td>${d.hito || "50%"}</td><td>${d.notasCTO || "Sin actualizaciones"}</td>`;
            } else {
                pipTotal += monto;
            }
        });
        document.getElementById("pipTotal").innerText = `USD ${pipTotal.toLocaleString()}`;
        document.getElementById("ventasCerradas").innerText = ventasCount;
    });
}

function renderCard(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    const esperando = d.avisoCobro ? `<br><small style="color:var(--red)">⏳ Esperando validación CTR</small>` : "";
    card.innerHTML = `<b>${d.nombre}</b><br><small style="color:var(--text-dim)">${d.empresa || 'Empresa no cargada'}</small>${esperando}<br><span style="color:var(--green)">USD ${Number(d.monto).toLocaleString()}</span>`;
    card.onclick = () => abrirDetalles(id, d);
    const col = document.getElementById("col-" + d.estado);
    if(col) col.appendChild(card);
}

window.abrirDetalles = (id, d) => {
    leadSeleccionadoId = id; leadDataActual = d;
    document.getElementById("modalLead").style.display = "flex";
    document.getElementById("mNombre").innerText = d.nombre;
    document.getElementById("mEmpresa").innerText = d.empresa || "No especificada";
    document.getElementById("mIdea").innerText = d.idea || "Sin descripción.";
    const btn = document.getElementById("btnAvanzar"), inputPDF = document.getElementById("mLinkPDF"), inst = document.getElementById("mInstrucciones");
    btn.style.display = "block"; inputPDF.style.display = "none";
    
    if (d.avisoCobro) {
        inst.innerText = "Esperando que el Director valide el pago de: " + d.avisoCobro;
        btn.style.display = "none";
    } else if (d.estado === "nuevo") {
        inst.innerText = "Pasar a CONSULTORÍA.";
        btn.onclick = () => moverLead(id, "nuevo");
    } else if (d.estado === "consultoria") {
        inst.innerText = "Cargar PDF para avanzar a CONTRATO.";
        inputPDF.style.display = "block";
        btn.onclick = () => moverLead(id, "consultoria");
    } else if (d.estado === "contrato") {
        inst.innerText = "¿Enviar aviso de cobro del 50% al Director?";
        btn.onclick = () => moverLead(id, "contrato");
    } else {
        inst.innerText = "Cliente en producción técnica.";
        btn.style.display = "none";
    }
};

async function moverLead(id, actual) {
    let dataUpdate = {};
    if (actual === "nuevo") dataUpdate.estado = "consultoria";
    else if (actual === "consultoria") {
        const link = document.getElementById("mLinkPDF").value;
        if (!link) return alert("Link requerido.");
        dataUpdate.estado = "contrato"; dataUpdate.linkPropuesta = link;
    } else if (actual === "contrato") {
        dataUpdate.avisoCobro = "50% Seña Inicial";
    }
    if (Object.keys(dataUpdate).length > 0) {
        await updateDoc(doc(db, "leads", id), dataUpdate);
        cerrarModal();
    }
}

window.agregarLead = async () => {
    const nom = document.getElementById("newCliente").value, emp = document.getElementById("newEmpresa").value, mon = document.getElementById("newMonto").value, idea = document.getElementById("newIdea").value;
    if (!nom || !mon) return alert("Nombre y monto obligatorios.");
    await addDoc(collection(db, "leads"), { nombre: nom, empresa: emp, monto: Number(mon), idea: idea, estado: "nuevo", pagado: 0, fecha: new Date(), vendedor: auth.currentUser.email });
    document.getElementById("newCliente").value = ""; document.getElementById("newEmpresa").value = ""; document.getElementById("newMonto").value = ""; document.getElementById("newIdea").value = "";
};

window.cerrarModal = () => { document.getElementById("modalLead").style.display = "none"; document.getElementById("mLinkPDF").value = ""; };
