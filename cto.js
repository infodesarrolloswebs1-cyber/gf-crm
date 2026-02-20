import { db, auth } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let idSeleccionado = null;

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
            const d = docSnap.data();
            const id = docSnap.id;
            if(d.estado === "produccion" || d.estado === "finalizado") {
                if(d.etapaProd !== "Entregado") enCurso++;
                else entregados++;
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
    card.innerHTML = `<b>${d.nombre}</b><br><small style="color:${bloqueado ? 'var(--red)' : 'var(--text-dim)'}">${bloqueado ? '⚠️ BLOQUEADO: Cobro ' + d.avisoCobro : 'Hito: ' + (d.hito || '50%')}</small>`;
    card.onclick = () => {
        if(bloqueado) alert("El Director debe validar el pago de " + d.avisoCobro + " para continuar.");
        else abrirProduccion(id, d);
    };
    const col = document.getElementById("col-" + (d.etapaProd || "Diseño"));
    if(col) col.appendChild(card);
}

window.abrirProduccion = (id, d) => {
    idSeleccionado = id;
    document.getElementById("modalCTO").style.display = "flex";
    document.getElementById("pNombre").innerText = d.nombre;
    document.getElementById("pIdea").innerText = d.idea || "Sin idea técnica.";
    document.getElementById("pNotas").value = d.notasCTO || "";
    const btn = document.getElementById("btnAvanzarTec"), formEntrega = document.getElementById("formEntrega");
    
    if(d.etapaProd === "Testing") { formEntrega.style.display = "block"; btn.innerText = "FINALIZAR Y ENTREGAR ✅"; btn.style.background = "var(--green)"; }
    else { formEntrega.style.display = "none"; btn.innerText = "AVANZAR ETAPA ➡️"; btn.style.background = "var(--accent)"; }
    
    btn.onclick = () => avanzarEtapaTecnica(id, d.etapaProd || "Diseño");
};

async function avanzarEtapaTecnica(id, actual) {
    let proxima = "", hitoUpdate = "", aviso = null;
    if (actual === "Diseño") { proxima = "Desarrollo"; hitoUpdate = "80%"; aviso = "30% Desarrollo"; }
    else if (actual === "Desarrollo") { proxima = "Testing"; hitoUpdate = "100%"; aviso = "20% Final"; }
    else if (actual === "Testing") {
        const fecha = document.getElementById("pFechaEntrega").value, accesos = document.getElementById("pAccesos").value;
        if(!fecha || !accesos) return alert("Completa los datos de entrega.");
        proxima = "Entregado"; hitoUpdate = "Finalizado";
        await updateDoc(doc(db, "leads", id), { estado: "finalizado", etapaProd: proxima, hito: hitoUpdate, fechaEntrega: fecha, accesosEntrega: accesos, notasCTO: document.getElementById("pNotas").value });
        return cerrarModal();
    }
    await updateDoc(doc(db, "leads", id), { etapaProd: proxima, hito: hitoUpdate, avisoCobro: aviso, notasCTO: document.getElementById("pNotas").value });
    cerrarModal();
}

window.cerrarModal = () => document.getElementById("modalCTO").style.display = "none";
window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");
