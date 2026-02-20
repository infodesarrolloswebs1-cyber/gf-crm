import { db, auth } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) { cargarMaster(); } 
    else { window.location.href = "index.html"; }
});

function cargarMaster() {
    onSnapshot(collection(db, "leads"), (snap) => {
        const tMaestra = document.getElementById("tabla-maestra").querySelector("tbody");
        tMaestra.innerHTML = "";
        
        let cashReal = 0;
        let pipCom = 0;
        let cerrados = 0;

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const m = Number(d.monto) || 0;
            const p = Number(d.pagado) || 0;

            if(d.estado === "produccion" || d.estado === "finalizado") {
                cashReal += p;
                cerrados++;
                const row = tMaestra.insertRow();
                row.innerHTML = `<td>${d.nombre}</td><td>USD ${m}</td><td>USD ${p}</td><td>USD ${p*0.1}</td><td>${d.etapaProd}</td>`;
            } else {
                pipCom += m;
            }
        });

        document.getElementById("cashReal").innerText = `USD ${cashReal.toLocaleString()}`;
        document.getElementById("pipCom").innerText = `USD ${pipCom.toLocaleString()}`;
        
        // Alerta Capacidad 5/5
        const enProduccion = document.querySelectorAll("#tabla-maestra tbody tr").length;
        document.getElementById("alerta-cto").style.display = enProduccion >= 5 ? "block" : "none";
        
        actualizarROI(cashReal, cerrados);
    });
}

function actualizarROI(cash, cierres) {
    const inv = Number(document.getElementById("inAds").value) || 1;
    document.getElementById("cacVal").innerText = `USD ${(inv / (cierres || 1)).toFixed(0)}`;
    document.getElementById("roasVal").innerText = `${(cash / inv).toFixed(1)}x`;
    
    const costosFijos = 4400; // Tu costo de estructura
    const rent = cash > 0 ? (((cash - costosFijos - inv) / cash) * 100).toFixed(0) : 0;
    document.getElementById("rentaNet").innerText = `${rent}%`;
}

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");
