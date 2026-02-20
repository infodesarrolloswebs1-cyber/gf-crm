import { db, auth } from "./firebase.js";
import { collection, addDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let leadSeleccionadoId = null;

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
        document.querySelector("#listaComisiones tbody").innerHTML = "";
        document.querySelector("#listaStatus tbody").innerHTML = "";
        let pipTotal = 0, ventasCount = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            renderCard(d, id);
            if (d.estado === "produccion" || d.estado === "finalizado") {
                ventasCount++;
                const p = d.pagado || 0, m = d.monto || 0;
                document.querySelector("#listaComisiones tbody").innerHTML += `<tr><td>${d.nombre}</td><td>USD ${m}</td><td>USD ${p}</td><td style="color:var(--green)">USD ${p*0.1}</td><td>USD ${(m-p)*0.1}</td></tr>`;
                document.querySelector("#listaStatus tbody").innerHTML += `<tr><td>${d.nombre}</td><td>${d.etapaProd || "Espera"}</td><td>${d.hito || "50%"}</td><td>${d.notasCTO || "-"}</td></tr>`;
            } else { pipTotal += Number(d.monto || 0); }
        });
        document.getElementById("pipTotal").innerText = `USD ${pipTotal.toLocaleString()}`;
        document.getElementById("ventasCerradas").innerText = ventasCount;
    });
}

function renderCard(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    const aviso = d.avisoCobro ? `<br><small style="color:var(--red)">⏳ Cobro: ${d.avisoCobro}</small>` : "";
    card.innerHTML = `<b>${d.nombre}</b><br><small style="color:var(--text-dim)">${d.tipoProyecto || 'Proyecto'}</small>${aviso}<br><span style="color:var(--green)">USD ${Number(d.monto).toLocaleString()}</span>`;
    card.onclick = () => abrirDetalles(id, d);
    const col = document.getElementById("col-" + d.estado);
    if(col) col.appendChild(card);
}

window.abrirDetalles = (id, d) => {
    leadSeleccionadoId = id;
    document.getElementById("modalLead").style.display = "flex";
    document.getElementById("mNombre").innerText = d.nombre;
    document.getElementById("mDetalleTexto").innerHTML = `
        <p><strong>WhatsApp:</strong> ${d.whatsapp || '-'}</p>
        <p><strong>Empresa/App:</strong> ${d.empresa || '-'}</p>
        <p><strong>Ubicación:</strong> ${d.provincia}, ${d.pais}</p>
        <p><strong>Problema:</strong> ${d.problema}</p>
        <p><strong>Usuarios:</strong> ${d.usuariosSistema}</p>
        <p><strong>Plataformas:</strong> ${d.plataformas}</p>
        <p><strong>Funciones:</strong> ${d.funciones}</p>
        <p><strong>Integraciones:</strong> ${d.integraciones}</p>
        <p><strong>Competencia:</strong> ${d.competencia}</p>
    `;
    
    const btn = document.getElementById("btnAvanzar"), inputPDF = document.getElementById("mLinkPDF"), inst = document.getElementById("mInstrucciones");
    btn.style.display = "block"; inputPDF.style.display = "none";
    
    if (d.avisoCobro) { inst.innerText = "Esperando validación CTR: " + d.avisoCobro; btn.style.display = "none"; }
    else if (d.estado === "nuevo") { inst.innerText = "Mover a Consultoría Técnica."; btn.onclick = () => moverLead(id, "nuevo"); }
    else if (d.estado === "consultoria") { inst.innerText = "Cargar PDF para Contrato."; inputPDF.style.display = "block"; btn.onclick = () => moverLead(id, "consultoria"); }
    else if (d.estado === "contrato") { inst.innerText = "¿Enviar aviso de seña del 50%?"; btn.onclick = () => moverLead(id, "contrato"); }
    else { inst.innerText = "En producción."; btn.style.display = "none"; }
};

async function moverLead(id, actual) {
    let update = {};
    if (actual === "nuevo") update.estado = "consultoria";
    else if (actual === "consultoria") {
        const link = document.getElementById("mLinkPDF").value;
        if (!link) return alert("Link PDF necesario.");
        update.estado = "contrato"; update.linkPropuesta = link;
    } else if (actual === "contrato") { update.avisoCobro = "50% Seña Inicial"; }
    
    await updateDoc(doc(db, "leads", id), update);
    cerrarModal();
}

window.agregarLead = async () => {
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
        estado: "nuevo", pagado: 0, fecha: new Date(), vendedor: auth.currentUser.email
    };
    if (!data.nombre || !data.monto) return alert("Nombre y Monto mínimos.");
    await addDoc(collection(db, "leads"), data);
    document.querySelectorAll("input, textarea").forEach(i => i.value = "");
    alert("Lead cargado con éxito.");
};

window.cerrarModal = () => document.getElementById("modalLead").style.display = "none";
