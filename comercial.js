import { db, auth } from "./firebase.js";
import { collection, addDoc, doc, updateDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadSeleccionadoId = null;
let datosLeadActual = null;

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
        
        document.getElementById("listaComisionesBody").innerHTML = "";
        document.getElementById("listaStatusBody").innerHTML = "";
        let pipTotal = 0, ventasCount = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            renderCard(d, id);
            if (d.estado === "produccion" || d.estado === "finalizado") {
                ventasCount++;
                const p = d.pagado || 0, m = d.monto || 0;
                document.getElementById("listaComisionesBody").innerHTML += `<tr><td><b>${d.nombre}</b></td><td>USD ${m.toLocaleString()}</td><td>USD ${p.toLocaleString()}</td><td style="color:var(--green)">USD ${(p*0.1).toLocaleString()}</td><td>USD ${((m-p)*0.1).toLocaleString()}</td></tr>`;
                document.getElementById("listaStatusBody").innerHTML += `<tr><td><b>${d.nombre}</b></td><td><span style="background:var(--accent); padding:4px 8px; border-radius:5px; font-size:12px;">${d.etapaProd || "Espera"}</span></td><td>${d.hito || "50%"}</td><td>${d.notasCTO || "-"}</td></tr>`;
            } else { pipTotal += Number(d.monto || 0); }
        });
        document.getElementById("pipTotal").innerText = `USD ${pipTotal.toLocaleString()}`;
        document.getElementById("ventasCerradas").innerText = ventasCount;
    });
}

function renderCard(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    const tempColors = { caliente: "#ef4444", tibio: "#f59e0b", frio: "#3b82f6", espera: "#a855f7" };
    const funnelLabels = { nuevo: "CALIFICADO", r1: "R1", envie_pres: "PRES.", r2: "R2", r3: "CIERRE", quiere_nda: "NDA", envie_nda: "NDA ENVIADO", firmo_nda: "NDA OK" };
    
    card.innerHTML = `
        <button class="btn-delete-mini" onclick="event.stopPropagation(); eliminarLead('${id}')">🗑️</button>
        <span class="tag tag-temp" style="color:${tempColors[d.etiqueta] || '#94a3b8'}">${(d.etiqueta || 'frio').toUpperCase()}</span>
        <span class="tag tag-status">${funnelLabels[d.estadoProceso] || 'NUEVO'}</span><br>
        <b>${d.nombre}</b><br>
        <span style="color:var(--green)">USD ${Number(d.monto).toLocaleString()}</span>
    `;
    card.onclick = () => abrirDetalles(id, d);
    const col = document.getElementById("col-" + (d.estado || "nuevo"));
    if(col) col.appendChild(card);
}

window.abrirDetalles = (id, d) => {
    leadSeleccionadoId = id; datosLeadActual = d;
    document.getElementById("modalLead").style.display = "flex";
    document.getElementById("mNombre").innerText = d.nombre;
    document.getElementById("mDetalleTexto").innerHTML = `
        <p><strong>ESTADO FUNNEL:</strong> ${(d.estadoProceso || 'nuevo').toUpperCase()}</p>
        <p><strong>WHATSAPP:</strong> ${d.whatsapp || '-'}</p>
        <p><strong>PROBLEMA:</strong> ${d.problema || '-'}</p>
        <p><strong>OBSERVACIONES:</strong> ${d.observaciones || '-'}</p>
    `;
    
    const btn = document.getElementById("btnAvanzar"), inputPDF = document.getElementById("mLinkPDF"), inst = document.getElementById("mInstrucciones");
    btn.style.display = (d.estado === "produccion") ? "none" : "block";
    inputPDF.style.display = (d.estado === "consultoria") ? "block" : "none";
    
    if (d.avisoCobro) { inst.innerText = "Esperando validación CTR: " + d.avisoCobro; btn.style.display = "none"; }
    else if (d.estado === "nuevo") { inst.innerText = "Mover a Consultoría."; btn.onclick = () => moverLead(id, "nuevo"); }
    else if (d.estado === "consultoria") { inst.innerText = "Cargar PDF para Contrato."; btn.onclick = () => moverLead(id, "consultoria"); }
    else if (d.estado === "contrato") { inst.innerText = "¿Aviso de pago 50%?"; btn.onclick = () => moverLead(id, "contrato"); }
};

window.descargarPDF = () => {
    const opt = { margin: 1, filename: `Ficha_${datosLeadActual.nombre}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    const clon = document.getElementById("area-imprimible").cloneNode(true);
    clon.style.color = "#000"; clon.style.padding = "20px";
    html2pdf().set(opt).from(clon).save();
};

window.habilitarEdicion = () => {
    const t = prompt("Temperatura (frio, tibio, caliente, espera):", datosLeadActual.etiqueta);
    const p = prompt("Proceso (nuevo, r1, envie_pres, r2, r3, quiere_nda, envie_nda, firmo_nda):", datosLeadActual.estadoProceso);
    if(t || p) updateDoc(doc(db, "leads", leadSeleccionadoId), { etiqueta: t || datosLeadActual.etiqueta, estadoProceso: p || datosLeadActual.estadoProceso });
    cerrarModal();
};

async function moverLead(id, actual) {
    let up = {};
    if (actual === "nuevo") up.estado = "consultoria";
    else if (actual === "consultoria") { 
        const link = document.getElementById("mLinkPDF").value;
        if(!link) return alert("Falta link PDF.");
        up.estado = "contrato"; up.linkPropuesta = link;
    } else if (actual === "contrato") up.avisoCobro = "50% Seña Inicial";
    await updateDoc(doc(db, "leads", id), up);
    cerrarModal();
}

window.agregarLead = async () => {
    const data = {
        nombre: document.getElementById("fNombre").value,
        whatsapp: document.getElementById("fWhatsapp").value,
        empresa: document.getElementById("fEmpresa").value,
        monto: Number(document.getElementById("fMonto").value),
        etiqueta: document.getElementById("fEtiqueta").value,
        estadoProceso: document.getElementById("fEstadoProceso").value,
        tipoProyecto: document.getElementById("fTipo").value,
        problema: document.getElementById("fProblema").value,
        observaciones: document.getElementById("fObservaciones").value,
        estado: "nuevo", pagado: 0, fecha: new Date(), vendedor: auth.currentUser.email
    };
    if (!data.nombre || !data.monto) return alert("Nombre y Monto obligatorios.");
    await addDoc(collection(db, "leads"), data);
    document.querySelectorAll(".form-container input, .form-container textarea").forEach(i => i.value = "");
    alert("Lead cargado.");
};

window.eliminarLead = async (id) => { if(confirm("¿Borrar permanentemente?")) await deleteDoc(doc(db, "leads", id)); };
window.cerrarModal = () => document.getElementById("modalLead").style.display = "none";
