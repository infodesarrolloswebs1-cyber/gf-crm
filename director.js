import { db, auth } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) { 
        cargarMaster(); 
        escucharPagosPendientes();
    } else { 
        window.location.href = "index.html"; 
    }
});

// --- 1. DASHBOARD MAESTRO Y RENTABILIDAD ---
function cargarMaster() {
    onSnapshot(collection(db, "leads"), (snap) => {
        const tMaestra = document.querySelector("#tabla-maestra tbody");
        tMaestra.innerHTML = "";
        
        let cashReal = 0;
        let pipCom = 0;
        let cerrados = 0;
        let proyEnCurso = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const m = Number(d.monto) || 0;
            const p = Number(d.pagado) || 0;

            if(d.estado === "produccion" || d.estado === "finalizado") {
                cashReal += p;
                cerrados++;
                if(d.estado === "produccion") proyEnCurso++;
                
                const row = tMaestra.insertRow();
                row.innerHTML = `
                    <td>${d.nombre}</td>
                    <td>USD ${m.toLocaleString()}</td>
                    <td>USD ${p.toLocaleString()}</td>
                    <td style="color:var(--green)">USD ${(p * 0.1).toLocaleString()}</td>
                    <td><span style="padding:4px 8px; border-radius:4px; background: #1e293b; font-size:12px;">${d.etapaProd || 'Iniciando'}</span></td>
                `;
            } else {
                pipCom += m;
            }
        });

        document.getElementById("cashReal").innerText = `USD ${cashReal.toLocaleString()}`;
        document.getElementById("pipCom").innerText = `USD ${pipCom.toLocaleString()}`;
        
        // Alerta de Capacidad para el Director
        document.getElementById("alerta-cto").style.display = proyEnCurso >= 5 ? "block" : "none";
        
        actualizarROI(cashReal, cerrados);
    });
}

// --- 2. VALIDACIÓN DE PAGOS (El "Gatekeeper") ---
function escucharPagosPendientes() {
    // Escuchamos leads que necesitan validación de hitos
    onSnapshot(collection(db, "leads"), (snap) => {
        const tPagos = document.getElementById("lista-pendientes");
        tPagos.innerHTML = "";

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;

            // Si el lead está en 'contrato' pero no tiene pagado el 50%, o si el CTO pide cobro
            if (d.estado === "contrato" || d.avisoCobro) {
                const hitoNombre = d.avisoCobro || "50% Seña Inicial";
                const montoAPagar = d.avisoCobro === "80%" ? d.monto * 0.3 : (d.avisoCobro === "100%" ? d.monto * 0.2 : d.monto * 0.5);

                const row = tPagos.insertRow();
                row.innerHTML = `
                    <td>${new Date().toLocaleDateString()}</td>
                    <td><b>${d.nombre}</b></td>
                    <td>${hitoNombre}</td>
                    <td style="color:var(--green)">USD ${montoAPagar.toLocaleString()}</td>
                    <td><button class="btn-validar" onclick="confirmarPagoReal('${id}', ${montoAPagar}, '${hitoNombre}')">APROBAR INGRESO</button></td>
                `;
            }
        });
    });
}

window.confirmarPagoReal = async (id, monto, hito) => {
    if(!confirm(`¿Confirmas que recibiste USD ${monto} en la cuenta para el hito ${hito}?`)) return;

    const leadRef = doc(db, "leads", id);
    const pAnterior = (await getDocs(query(collection(db, "leads")))).docs.find(doc => doc.id === id).data().pagado || 0;

    await updateDoc(leadRef, {
        pagado: pAnterior + monto,
        avisoCobro: null, // Limpiamos el aviso porque ya se pagó
        estado: "produccion" // Aseguramos que entre a producción
    });

    // Registramos en el historial global de pagos
    await addDoc(collection(db, "pagos"), {
        cliente: id,
        monto: monto,
        hito: hito,
        fecha: new Date()
    });

    alert("¡Pago validado! El dinero entró a la caja y el equipo técnico ya puede ver el avance.");
};

function actualizarROI(cash, cierres) {
    const inv = Number(document.getElementById("inAds").value) || 300;
    document.getElementById("cacVal").innerText = `USD ${(inv / (cierres || 1)).toFixed(0)}`;
    document.getElementById("roasVal").innerText = `${(cash / inv).toFixed(1)}x`;
    
    const costosFijos = 4400; 
    const rent = cash > 0 ? (((cash - costosFijos - inv) / cash) * 100).toFixed(0) : 0;
    document.getElementById("rentaNet").innerText = `${rent}%`;
}

window.calcROI = () => {
    const cash = Number(document.getElementById("cashReal").innerText.replace(/[^0-9.-]+/g,""));
    const cierres = Number(document.getElementById("ventasMes")?.innerText || 0); // Opcional
    actualizarROI(cash, cierres);
};

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");
