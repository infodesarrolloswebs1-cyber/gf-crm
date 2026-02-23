import { db, auth } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let idSeleccionado = null;
let historialActual = "";

onAuthStateChanged(auth, (user) => {
    if (user) { escucharProduccion(); } 
    else { window.location.href = "index.html"; }
});

function escucharProduccion() {
    onSnapshot(collection(db, "leads"), (snap) => {
        ["Diseño", "Desarrollo", "Testing", "Entregado"].forEach(id => {
            const el = document.getElementById("col-" + id);
            if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
        });
        let enCurso = 0, entregados = 0;
        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            if(d.estado === "produccion" || d.estado === "finalizado") {
                if(d.etapaProd !== "Entregado") enCurso++; else entregados++;
                renderCardCTO(d, id);
            }
        });
        document.getElementById("cargaTotal").innerText = `${enCurso} / 5`;
        document.getElementById("countEntregados").innerText = entregados;
    });
}

function renderCardCTO(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    const bloqueado = d.avisoCobro ? true : false;
    card.innerHTML = `<b>${d.nombre}</b><br><small style="color:${bloqueado ? 'var(--red)' : 'var(--text-dim)'}">${bloqueado ? '⚠️ BLOQUEADO: ' + d.avisoCobro : 'Hito: ' + (d.hito || '50%')}</small>`;
    card.onclick = () => abrirProduccion(id, d);
    const col = document.getElementById("col-" + (d.etapaProd || "Diseño"));
    if(col) col.appendChild(card);
}

window.abrirProduccion = (id, d) => {
    idSeleccionado = id;
    historialActual = d.notasCTO || ""; 
    document.getElementById("modalCTO").style.display = "flex";
    document.getElementById("pNombre").innerText = d.nombre;
    
    // RESTAURACIÓN DE FICHA TÉCNICA COMPLETA
    document.getElementById("pIdea").innerHTML = `
        <p><strong style="color:var(--accent)">PROBLEMA:</strong> ${d.problema || '-'}</p>
        <p><strong style="color:var(--accent)">USUARIOS:</strong> ${d.usuariosSistema || '-'}</p>
        <p><strong style="color:var(--accent)">PLATAFORMAS:</strong> ${d.plataformas || '-'}</p>
        <p><strong style="color:var(--accent)">FUNCIONES:</strong> ${d.funciones || '-'}</p>
        <p><strong style="color:var(--accent)">INTEGRACIONES:</strong> ${d.integraciones || '-'}</p>
        <p><strong style="color:var(--accent)">BRANDING:</strong> ${d.branding || '-'}</p>
        <p><strong style="color:var(--accent)">LINK:</strong> <a href="${d.linkPropuesta || '#'}" target="_blank" style="color:var(--green)">Ver PDF</a></p>
    `;

    // Render historial
    const container = document.getElementById("listaHistorial");
    container.innerHTML = "";
    if(historialActual) {
        historialActual.split("\n").forEach(linea => {
            if(linea.trim()){
                const div = document.createElement("div");
                div.className = "nota-item";
                div.innerHTML = linea.replace('[', '<span class="nota-fecha">').replace(']', '</span>');
                container.appendChild(div);
            }
        });
    } else {
        container.innerHTML = '<div style="color:gray; font-style:italic;">Sin anotaciones previas...</div>';
    }

    document.getElementById("pNotas").value = "";
    
    const btn = document.getElementById("btnAvanzarTec"), formEntrega = document.getElementById("formEntrega");
    const bloqueado = d.avisoCobro ? true : false;

    if(bloqueado) {
        btn.innerText = "ESPERANDO PAGO..."; btn.disabled = true; btn.style.opacity = "0.5";
    } else {
        btn.disabled = false; btn.style.opacity = "1";
        if(d.etapaProd === "Testing") {
            formEntrega.style.display = "block";
            btn.innerText = "FINALIZAR Y ENTREGAR ✅";
            btn.style.background = "var(--green)";
        } else {
            formEntrega.style.display = "none";
            btn.innerText = "AVANZAR ETAPA ➡️";
            btn.style.background = "var(--accent)";
        }
    }
    btn.onclick = () => avanzarEtapaTecnica(id, d.etapaProd || "Diseño");
};

window.guardarNotasSolo = async () => {
    const notaNueva = document.getElementById("pNotas").value;
    if(!notaNueva) return alert("Escribe algo para guardar.");
    
    const ahora = new Date();
    // Formato: DD-MM-AA HH:MM
    const fechaLarga = `${ahora.getDate()}-${ahora.getMonth()+1}-${ahora.getFullYear().toString().slice(-2)} ${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2, '0')}`;
    const nuevaLinea = `[${fechaLarga}] ${notaNueva}`;
    const historialActualizado = nuevaLinea + "\n" + historialActual;

    try {
        await updateDoc(doc(db, "leads", idSeleccionado), { notasCTO: historialActualizado });
        historialActual = historialActualizado;
        // Refrescar modal sin cerrar
        const container = document.getElementById("listaHistorial");
        const div = document.createElement("div");
        div.className = "nota-item";
        div.innerHTML = nuevaLinea.replace('[', '<span class="nota-fecha">').replace(']', '</span>');
        container.prepend(div);
        document.getElementById("pNotas").value = "";
        alert("Nota guardada.");
    } catch(e) { console.error(e); }
};

async function avanzarEtapaTecnica(id, actual) {
    let proxima = "", hitoUpdate = "", aviso = null;
    const notaNueva = document.getElementById("pNotas").value || "Cambio de etapa";
    const ahora = new Date();
    const fechaLarga = `${ahora.getDate()}-${ahora.getMonth()+1}-${ahora.getFullYear().toString().slice(-2)} ${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2, '0')}`;
    const nuevaLinea = `[${fechaLarga}] AVANCE: ${notaNueva}`;
    const historialActualizado = nuevaLinea + "\n" + historialActual;

    if (actual === "Diseño") { proxima = "Desarrollo"; hitoUpdate = "80%"; aviso = "30% Desarrollo"; }
    else if (actual === "Desarrollo") { proxima = "Testing"; hitoUpdate = "100%"; aviso = "20% Final"; }
    else if (actual === "Testing") {
        const f = document.getElementById("pFechaEntrega").value, a = document.getElementById("pAccesos").value;
        if(!f || !a) return alert("Faltan datos de entrega.");
        await updateDoc(doc(db, "leads", id), { 
            estado: "finalizado", etapaProd: "Entregado", hito: "Finalizado", 
            fechaEntrega: f, accesosEntrega: a, 
            notasCTO: `[${fechaLarga}] ENTREGADO\n` + historialActualizado 
        });
        return cerrarModal();
    }

    await updateDoc(doc(db, "leads", id), { 
        etapaProd: proxima, hito: hitoUpdate, avisoCobro: aviso, 
        notasCTO: historialActualizado 
    });
    cerrarModal();
}

window.cerrarModal = () => document.getElementById("modalCTO").style.display = "none";
window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");
