import { db, auth } from "./firebase.js";
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let idSeleccionado = null;

onAuthStateChanged(auth, (user) => {
    if (user) { escucharProduccion(); } 
    else { window.location.href = "index.html"; }
});

function escucharProduccion() {
    // Escuchamos todos los que están en producción o entregados
    onSnapshot(collection(db, "leads"), (snap) => {
        ["Diseño", "Desarrollo", "Testing", "Entregado"].forEach(id => {
            const el = document.getElementById("col-" + id);
            if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
        });

        let enCurso = 0;
        let entregados = 0;

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
    card.innerHTML = `<b>${d.nombre}</b><br><small style="color:var(--text-dim)">Hito: ${d.hito || '50%'}</small>`;
    card.onclick = () => abrirProduccion(id, d);
    const col = document.getElementById("col-" + (d.etapaProd || "Diseño"));
    if(col) col.appendChild(card);
}

window.abrirProduccion = (id, d) => {
    idSeleccionado = id;
    const modal = document.getElementById("modalCTO");
    const formEntrega = document.getElementById("formEntrega");
    const btn = document.getElementById("btnAvanzarTec");
    
    modal.style.display = "flex";
    document.getElementById("pNombre").innerText = d.nombre;
    document.getElementById("pIdea").innerText = d.idea || "Sin idea técnica.";
    document.getElementById("pNotas").value = d.notasCTO || "";
    
    // Si ya está en Testing, mostramos el formulario de entrega
    if(d.etapaProd === "Testing") {
        formEntrega.style.display = "block";
        btn.innerText = "FINALIZAR Y ENTREGAR ✅";
        btn.style.background = "var(--green)";
    } else if(d.etapaProd === "Entregado") {
        formEntrega.style.display = "block";
        document.getElementById("pFechaEntrega").value = d.fechaEntrega || "";
        document.getElementById("pAccesos").value = d.accesosEntrega || "";
        btn.style.display = "none";
    } else {
        formEntrega.style.display = "none";
        btn.innerText = "AVANZAR ETAPA ➡️";
        btn.style.background = "var(--accent)";
        btn.style.display = "block";
    }
    
    btn.onclick = () => avanzarEtapaTecnica(id, d.etapaProd || "Diseño");
};

async function avanzarEtapaTecnica(id, actual) {
    let proxima = "";
    let hitoUpdate = "";
    let dataUpdate = {};

    if (actual === "Diseño") { proxima = "Desarrollo"; hitoUpdate = "80%"; }
    else if (actual === "Desarrollo") { proxima = "Testing"; hitoUpdate = "100%"; }
    else if (actual === "Testing") {
        const fecha = document.getElementById("pFechaEntrega").value;
        const accesos = document.getElementById("pAccesos").value;
        
        if(!fecha || !accesos) return alert("Para entregar llave en mano debes documentar la fecha y los accesos transferidos.");
        if(!confirm("¿Confirmas que el cliente abonó el saldo final y recibió los accesos?")) return;
        
        proxima = "Entregado";
        hitoUpdate = "Finalizado";
        dataUpdate.estado = "finalizado";
        dataUpdate.fechaEntrega = fecha;
        dataUpdate.accesosEntrega = accesos;
    }

    dataUpdate.etapaProd = proxima;
    dataUpdate.hito = hitoUpdate;
    dataUpdate.notasCTO = document.getElementById("pNotas").value;

    await updateDoc(doc(db, "leads", id), dataUpdate);
    cerrarModal();
}

window.cerrarModal = () => document.getElementById("modalCTO").style.display = "none";
window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");
