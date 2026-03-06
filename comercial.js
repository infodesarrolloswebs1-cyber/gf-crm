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
        
        const tComis = document.getElementById("listaComisiones");
        const tStat = document.getElementById("listaStatus");
        if(tComis) tComis.innerHTML = "";
        if(tStat) tStat.innerHTML = "";
        
        let pipTotal = 0, ventasCount = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            renderCard(d, id);
            
            const p = d.pagado || 0, m = d.monto || 0;
            if (d.estado === "produccion" || d.estado === "finalizado") {
                ventasCount++;
                if(tComis) tComis.innerHTML += `<tr><td><b>${d.nombre}</b></td><td>USD ${m.toLocaleString()}</td><td>USD ${p.toLocaleString()}</td><td style="color:var(--green)">USD ${(p*0.1).toLocaleString()}</td><td>USD ${((m-p)*0.1).toLocaleString()}</td></tr>`;
                if(tStat) tStat.innerHTML += `<tr><td><b>${d.nombre}</b></td><td><span style="background:var(--accent); padding:4px 8px; border-radius:5px; font-size:12px;">${d.etapaProd || "Espera"}</span></td><td>${d.hito || "50%"}</td><td>${d.notasCTO || "-"}</td></tr>`;
            } else { pipTotal += m; }
        });
        document.getElementById("pipTotal").innerText = `USD ${pipTotal.toLocaleString()}`;
        document.getElementById("ventasCerradas").innerText = ventasCount;
    });
}

function renderCard(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    
    const config = {
        caliente: { c: "#ef4444", n: "CALIENTE" }, tibio: { c: "#f59e0b", n: "TIBIO" },
        frio: { c: "#3b82f6", n: "FRIO" }, espera: { c: "#a855f7", n: "ESPERA" },
        nuevo: { c: "#06b6d4", n: "CALIFICADO" }, r1: { c: "#8b5cf6", n: "R1" },
        envie_pres: { c: "#6366f1", n: "PRES." }, r2: { c: "#ec4899", n: "R2" },
        r3: { c: "#22c55e", n: "R3" }, firmo_nda: { c: "#10b981", n: "NDA OK" }
    };

    let tagsHtml = "";
    const marcadas = d.etiquetasMultiples || [];
    marcadas.forEach(tagKey => {
        const conf = config[tagKey];
        if(conf) tagsHtml += `<span class="tag" style="background:${conf.c}; color:white;">${conf.n}</span>`;
    });

    card.innerHTML = `
        <button class="btn-delete-mini" onclick="event.stopPropagation(); eliminarLead('${id}')">🗑️</button>
        <div style="margin-bottom:8px;">${tagsHtml}</div>
        <b>${d.nombre}</b><br>
        <small style="color:var(--text-dim)">${d.empresa || 'Empresa'}</small><br>
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
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:10px;">
            <div><label style="color:var(--accent); font-size:9px;">WHATSAPP</label><br>${d.whatsapp || '-'}</div>
            <div><label style="color:var(--accent); font-size:9px;">EMPRESA/APP</label><br>${d.empresa || '-'}</div>
            <div><label style="color:var(--accent); font-size:9px;">UBICACIÓN</label><br>${d.provincia || '-'}, ${d.pais || '-'}</div>
            <div><label style="color:var(--accent); font-size:9px;">DECISIÓN/SOCIO</label><br>Solo: ${d.decisionSolo || '-'} / Socio: ${d.socio || '-'}</div>
        </div>
        <p><strong>PROBLEMA:</strong> ${d.problema || '-'}</p>
        <p><strong>FUNCIONES:</strong> ${d.funciones || '-'}</p>
        <p><strong>INTEGRACIONES:</strong> ${d.integraciones || '-'}</p>
        <p><strong>OBSERVACIONES:</strong> ${d.observaciones || '-'}</p>
    `;

    // Marcar checkboxes guardados
    const marcadas = d.etiquetasMultiples || [];
    document.querySelectorAll(".tag-check").forEach(c => {
        c.checked = marcadas.includes(c.value);
    });
    
    const btn = document.getElementById("btnAvanzar"), inputPDF = document.getElementById("mLinkPDF"), inst = document.getElementById("mInstrucciones");
    btn.style.display = (d.estado === "produccion") ? "none" : "block";
    inputPDF.style.display = (d.estado === "consultoria") ? "block" : "none";
    
    if (d.avisoCobro) { inst.innerText = "Esperando validación CTR: " + d.avisoCobro; btn.style.display = "none"; }
    else if (d.estado === "nuevo") { inst.innerText = "Mover a Consultoría."; btn.onclick = () => moverLead(id, "nuevo"); }
    else if (d.estado === "consultoria") { inst.innerText = "Cargar PDF para Contrato."; btn.onclick = () => moverLead(id, "consultoria"); }
    else if (d.estado === "contrato") { inst.innerText = "¿Aviso de pago 50%?"; btn.onclick = () => moverLead(id, "contrato"); }
};

window.guardarEtiquetasMultiples = async () => {
    const seleccionadas = [];
    document.querySelectorAll(".tag-check").forEach(c => { if(c.checked) seleccionadas.push(c.value); });
    await updateDoc(doc(db, "leads", leadSeleccionadoId), { etiquetasMultiples: seleccionadas });
    alert("Etiquetas aplicadas.");
};

window.descargarPDF = () => {
    const opt = { margin: 1, filename: `Ficha_${datosLeadActual.nombre}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    const clon = document.getElementById("area-imprimible").cloneNode(true);
    clon.style.color = "#000"; clon.style.padding = "20px";
    html2pdf().set(opt).from(clon).save();
};

window.habilitarEdicion = () => {
    const nuevoMonto = prompt("Actualizar presupuesto USD:", datosLeadActual.monto);
    if(nuevoMonto) updateDoc(doc(db, "leads", leadSeleccionadoId), { monto: Number(nuevoMonto) });
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
    try {
        const data = {
            nombre: document.getElementById("fNombre").value,
            whatsapp: document.getElementById("fWhatsapp").value,
            empresa: document.getElementById("fEmpresa").value,
            decisionSolo: document.getElementById("fSolo").value,
            socio: document.getElementById("fSocio").value,
            provincia: document.getElementById("fProvincia").value,
            pais: document.getElementById("fPais").value,
            monto: Number(document.getElementById("fMonto").value),
            tipoProyecto: document.getElementById("fTipo").value,
            problema: document.getElementById("fProblema").value,
            usuariosSistema: document.getElementById("fUsuarios").value,
            plataformas: document.getElementById("fPlataformas").value,
            funciones: document.getElementById("fFunciones").value,
            integraciones: document.getElementById("fIntegraciones").value,
            branding: document.getElementById("fBranding").value,
            competencia: document.getElementById("fCompetencia").value,
            tiempoEntregaCliente: document.getElementById("fTiempo").value,
            observaciones: document.getElementById("fObservaciones").value,
            estado: "nuevo", pagado: 0, fecha: new Date(), vendedor: auth.currentUser.email,
            etiquetasMultiples: []
        };
        if (!data.nombre || !data.monto) return alert("Nombre y Monto mínimos.");
        await addDoc(collection(db, "leads"), data);
        alert("Lead cargado.");
        document.querySelectorAll(".form-grid input, .form-grid textarea").forEach(i => i.value = "");
    } catch(e) { console.error(e); }
};

window.eliminarLead = async (id) => { if(confirm("¿Borrar permanentemente?")) await deleteDoc(doc(db, "leads", id)); };
window.cerrarModal = () => document.getElementById("modalLead").style.display = "none";
