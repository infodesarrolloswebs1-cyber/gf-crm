import { db, auth } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) { cargarMaster(); escucharPagosPendientes(); } 
    else { window.location.href = "index.html"; }
});

function cargarMaster() {
    onSnapshot(collection(db, "leads"), (snap) => {
        const tMaestra = document.querySelector("#tabla-maestra tbody");
        tMaestra.innerHTML = "";
        let cashReal = 0, pipCom = 0, cerrados = 0, proyEnCurso = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const m = Number(d.monto) || 0, p = Number(d.pagado) || 0;
            if(d.estado === "produccion" || d.estado === "finalizado") {
                cashReal += p; cerrados++;
                if(d.estado === "produccion") proyEnCurso++;
                const row = tMaestra.insertRow();
                row.innerHTML = `<td>${d.nombre}</td><td>USD ${m.toLocaleString()}</td><td>USD ${p.toLocaleString()}</td><td style="color:var(--green)">USD ${(p * 0.1).toLocaleString()}</td><td><span style="padding:4px 8px; border-radius:4px; background: #1e293b; font-size:12px;">${d.etapaProd || 'Iniciando'}</span></td>`;
            } else { pipCom += m; }
        });
        document.getElementById("cashReal").innerText = `USD ${cashReal.toLocaleString()}`;
        document.getElementById("pipCom").innerText = `USD ${pipCom.toLocaleString()}`;
        document.getElementById("alerta-cto").style.display = proyEnCurso >= 5 ? "block" : "none";
        actualizarROI(cashReal, cerrados);
    });
}

function escucharPagosPendientes() {
    onSnapshot(collection(db, "leads"), (snap) => {
        const tPagos = document.getElementById("lista-pendientes");
        tPagos.innerHTML = "";
        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            if (d.avisoCobro) {
                const hito = d.avisoCobro;
                let montoP = 0;
                if(hito === "50% Seña Inicial") montoP = d.monto * 0.5;
                else if(hito === "30% Desarrollo") montoP = d.monto * 0.3;
                else if(hito === "20% Final") montoP = d.monto * 0.2;

                const row = tPagos.insertRow();
                row.innerHTML = `<td>${new Date().toLocaleDateString()}</td><td><b>${d.nombre}</b></td><td>${hito}</td><td style="color:var(--green)">USD ${montoP.toLocaleString()}</td><td><button class="btn-validar" onclick="confirmarPagoReal('${id}', ${montoP}, '${hito}')">APROBAR</button></td>`;
            }
        });
    });
}

window.confirmarPagoReal = async (id, monto, hito) => {
    if(!confirm(`¿Aprobás el ingreso de USD ${monto}?`)) return;
    const leadRef = doc(db, "leads", id);
    const snap = await getDoc(leadRef);
    const pAnterior = snap.data().pagado || 0;

    await updateDoc(leadRef, {
        pagado: pAnterior + monto,
        avisoCobro: null, // Desbloquea el proyecto
        estado: "produccion"
    });
    await addDoc(collection(db, "pagos"), { cliente: id, monto: monto, hito: hito, fecha: new Date() });
    alert("Pago validado.");
};

function actualizarROI(cash, cerrados) {
    const inv = Number(document.getElementById("inAds").value) || 300;
    document.getElementById("cacVal").innerText = `USD ${(inv / (cerrados || 1)).toFixed(0)}`;
    document.getElementById("roasVal").innerText = `${(cash / inv).toFixed(1)}x`;
    const net = cash > 0 ? (((cash - 4400 - inv) / cash) * 100).toFixed(0) : 0;
    document.getElementById("rentaNet").innerText = `${net}%`;
}

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");
