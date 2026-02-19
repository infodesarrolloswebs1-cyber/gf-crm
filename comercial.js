import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Seguridad: Verificar sesión
onAuthStateChanged(auth, (user) => {
    if (user) { escucharDatos(); } 
    else { window.location.href = "index.html"; }
});

window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");

function escucharDatos() {
    // Escuchamos en tiempo real la colección 'leads'
    onSnapshot(collection(db, "leads"), (snap) => {
        // Limpiar UI antes de renderizar
        ["nuevo", "consultoria", "contrato", "produccion"].forEach(id => {
            const el = document.getElementById("col-" + id);
            if(el) el.innerHTML = `<h3>${id.toUpperCase()}</h3>`;
        });
        
        document.getElementById("listaComisiones").innerHTML = "";
        document.getElementById("listaStatus").innerHTML = "";

        let pipTotal = 0;
        let ventasCount = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;

            // 1. Renderizar en Pipeline
            renderCard(d, id);

            // 2. Cálculos Financieros
            const monto = Number(d.monto) || 0;
            const cobrado = Number(d.pagado) || 0;

            if (d.estado === "produccion") {
                ventasCount++;
                // Tabla de Comisiones
                const rowCom = document.getElementById("listaComisiones").insertRow();
                rowCom.innerHTML = `
                    <td>${d.nombre}</td>
                    <td>USD ${monto.toLocaleString()}</td>
                    <td>USD ${cobrado.toLocaleString()}</td>
                    <td style="color:var(--green)">USD ${(cobrado * 0.1).toLocaleString()}</td>
                    <td style="color:#f59e0b">USD ${((monto - cobrado) * 0.1).toLocaleString()}</td>
                `;

                // Tabla de Status (Info que vendrá del CTO)
                const rowStat = document.getElementById("listaStatus").insertRow();
                rowStat.innerHTML = `
                    <td>${d.nombre}</td>
                    <td>${d.etapaProd || "En espera"}</td>
                    <td>${d.progresoProd || "0%"}</td>
                    <td>${d.notasCTO || "Sin actualizaciones"}</td>
                `;
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
    card.innerHTML = `
        <b>${d.nombre}</b><br>
        <span style="color:var(--green)">USD ${Number(d.monto).toLocaleString()}</span>
    `;
    card.onclick = () => moverLead(id, d.estado);
    
    const col = document.getElementById("col-" + d.estado);
    if(col) col.appendChild(card);
}

async function moverLead(id, actual) {
    let proximo = "";
    if (actual === "nuevo") proximo = "consultoria";
    else if (actual === "consultoria") proximo = "contrato";
    else if (actual === "contrato") {
        if (confirm("¿Confirmas contrato firmado ante escribano y pago del 50%?")) {
            proximo = "produccion";
        }
    }

    if (proximo) {
        await updateDoc(doc(db, "leads", id), { estado: proximo });
    }
}

window.agregarLead = async () => {
    const nom = document.getElementById("newCliente").value;
    const mon = document.getElementById("newMonto").value;
    if (!nom || !mon) return alert("Por favor completa los datos.");

    await addDoc(collection(db, "leads"), {
        nombre: nom,
        monto: Number(mon),
        estado: "nuevo",
        pagado: 0,
        fecha: new Date(),
        vendedor: auth.currentUser.email
    });

    document.getElementById("newCliente").value = "";
    document.getElementById("newMonto").value = "";
};
