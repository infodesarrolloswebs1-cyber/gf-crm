import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. Verificación de Seguridad: Si no está logueado, vuelve al login
onAuthStateChanged(auth, (user) => {
    if (user) {
        escucharLeads();
    } else {
        window.location.href = "index.html";
    }
});

window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");

// 2. Escucha de datos en tiempo real
function escucharLeads() {
    onSnapshot(collection(db, "leads"), (snap) => {
        // Limpiamos las columnas antes de re-dibujar
        const columnas = ["nuevo", "consultoria", "contrato", "produccion"];
        columnas.forEach(id => {
            const el = document.getElementById("col-" + id);
            if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
        });

        // Limpiamos las tablas de comisiones y status
        document.getElementById("listaComisiones").innerHTML = "";
        document.getElementById("listaStatus").innerHTML = "";

        let pipPotencial = 0;
        let ventasCerradas = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;

            // Solo mostramos los leads que pertenecen a este comercial o todos si eres CTR
            // (Por ahora mostramos todos para validar que funcione)
            
            renderizarTarjeta(d, id);

            const monto = Number(d.monto) || 0;
            const cobrado = Number(d.pagado) || 0;

            if (d.estado === "produccion") {
                ventasCerradas++;
                // Lógica de Comisiones (10%)
                actualizarTablaComisiones(d, monto, cobrado);
                // Lógica de Status de Fábrica
                actualizarTablaStatus(d);
            } else {
                pipPotencial += monto;
            }
        });

        document.getElementById("pipTotal").innerText = `USD ${pipPotencial.toLocaleString()}`;
        document.getElementById("ventasCerradas").innerText = ventasCerradas;
    });
}

// 3. Renderizar tarjeta en el Pipeline
function renderizarTarjeta(d, id) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <b>${d.nombre}</b><br>
        <span style="color:var(--green)">USD ${Number(d.monto).toLocaleString()}</span>
    `;
    // Al hacer clic, avanza de etapa
    card.onclick = () => avanzarProceso(id, d.estado);
    
    const col = document.getElementById("col-" + (d.estado || "nuevo"));
    if(col) col.appendChild(card);
}

// 4. Lógica de avance del Pipeline (Flujo Legendario)
async function avanzarProceso(id, estadoActual) {
    let nuevoEstado = "";
    if (estadoActual === "nuevo") nuevoEstado = "consultoria";
    else if (estadoActual === "consultoria") nuevoEstado = "contrato";
    else if (estadoActual === "contrato") {
        if (confirm("¿Confirmas que Mariano validó el contrato y se recibió el 50% de seña?")) {
            nuevoEstado = "produccion";
        }
    }

    if (nuevoEstado) {
        await updateDoc(doc(db, "leads", id), { estado: nuevoEstado });
    }
}

// 5. Agregar nuevo Lead (Validado por WhatsApp)
window.agregarLead = async () => {
    const nom = document.getElementById("newCliente").value;
    const mon = document.getElementById("newMonto").value;

    if (!nom || !mon) return alert("Por favor, completa nombre y monto.");

    try {
        await addDoc(collection(db, "leads"), {
            nombre: nom,
            monto: Number(mon),
            estado: "nuevo",
            pagado: 0,
            fechaCarga: new Date(),
            vendedor: auth.currentUser.email
        });
        // Limpiar inputs
        document.getElementById("newCliente").value = "";
        document.getElementById("newMonto").value = "";
    } catch (e) {
        console.error("Error al agregar lead: ", e);
    }
};

function actualizarTablaComisiones(d, total, cobrado) {
    const tabla = document.getElementById("listaComisiones");
    const row = tabla.insertRow();
    row.innerHTML = `
        <td>${d.nombre}</td>
        <td>USD ${total.toLocaleString()}</td>
        <td>USD ${cobrado.toLocaleString()}</td>
        <td style="color:var(--green)">USD ${(cobrado * 0.1).toLocaleString()}</td>
        <td style="color:#f59e0b">USD ${((total - cobrado) * 0.1).toLocaleString()}</td>
    `;
}

function actualizarTablaStatus(d) {
    const tabla = document.getElementById("listaStatus");
    const row = tabla.insertRow();
    row.innerHTML = `
        <td>${d.nombre}</td>
        <td>${d.etapaTecnica || "Pendiente"}</td>
        <td>${d.progresoProd || "0%"}</td>
        <td><small>${d.notasCTO || "Sin novedades"}</small></td>
    `;
}
