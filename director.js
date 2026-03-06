import { db, auth } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let cashGlobal = 0;
let cierresGlobal = 0;

onAuthStateChanged(auth, (user) => {
    if (user) { cargarMaster(); escucharPagosPendientes(); } 
    else { window.location.href = "index.html"; }
});

function cargarMaster() {
    onSnapshot(collection(db, "leads"), (snap) => {
        const tBody = document.getElementById("tabla-maestra-body");
        tBody.innerHTML = "";
        let cashReal = 0, pipCom = 0, cerrados = 0, proyEnCurso = 0;

        const configTags = {
            caliente: { c: "#ef4444", n: "CALIENTE" }, tibio: { c: "#f59e0b", n: "TIBIO" },
            frio: { c: "#3b82f6", n: "FRIO" }, espera: { c: "#a855f7", n: "ESPERA" },
            nuevo: { c: "#06b6d4", n: "CALIFICADO" }, r1: { c: "#8b5cf6", n: "R1" },
            envie_pres: { c: "#6366f1", n: "PRES." }, r2: { c: "#ec4899", n: "R2" },
            r3: { c: "#22c55e", n: "R3" }, firmo_nda: { c: "#10b981", n: "NDA OK" }
        };

        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            const m = Number(d.monto) || 0, p = Number(d.pagado) || 0;

            // Etiquetas Múltiples
            let tagsHtml = "";
            (d.etiquetasMultiples || []).forEach(t => {
                const conf = configTags[t];
                if(conf) tagsHtml += `<span class="tag" style="background:${conf.c}">${conf.n}</span>`;
            });

            if(d.estado === "produccion" || d.estado === "finalizado") {
                cashReal += p; cerrados++;
                if(d.estado === "produccion") proyEnCurso++;
            } else { pipCom += m; }

            const row = tBody.insertRow();
            row.innerHTML = `
                <td><b>${d.nombre}</b></td>
                <td>${tagsHtml || '-'}</td>
                <td>USD ${m.toLocaleString()}</td>
                <td>USD ${p.toLocaleString()}</td>
                <td style="color:var(--green)">USD ${(p * 0.1).toLocaleString()}</td>
                <td><span style="font-size:10px; background:#334155; padding:3px 6px; border-radius:4px;">${d.estado.toUpperCase()}</span></td>
                <td><button class="btn-audit" onclick='abrirAuditoria(${JSON.stringify(d)})'>🔍 INFO</button></td>
            `;
        });

        document.getElementById("cashReal").innerText = `USD ${cashReal.toLocaleString()}`;
        document.getElementById("pipCom").innerText = `USD ${pipCom.toLocaleString()}`;
        document.getElementById("cerradosCount").innerText = cerrados;
        document.getElementById("proyCount").innerText = proyEnCurso;
        
        cashGlobal = cashReal; cierresGlobal = cerrados;
        actualizarROI(cashReal, cerrados);
    });
}

window.abrirAuditoria = (d) => {
    document.getElementById("modalAudit").style.display = "flex";
    document.getElementById("aNombre").innerText = d.nombre;
    document.getElementById("aFicha").innerHTML = `
        <p><strong>Empresa:</strong> ${d.empresa || '-'}</p>
        <p><strong>Monto Total:</strong> USD ${d.monto}</p>
        <p><strong>Pagado:</strong> USD ${d.pagado}</p>
        <p><strong>Problema:</strong> ${d.problema || '-'}</p>
        <p><strong>Funciones:</strong> ${d.funciones || '-'}</p>
        <p><strong>Vendedor:</strong> ${d.vendedor || '-'}</p>
        <p><strong>Link Propuesta:</strong> <a href="${d.linkPropuesta}" target="_blank" style="color:var(--accent)">Ver PDF</a></p>
    `;
};

function escucharPagosPendientes() {
    onSnapshot(collection(db, "leads"), (snap) => {
        const tPagos = document.getElementById("lista-pendientes");
        tPagos.innerHTML = "";
        snap.forEach(docSnap => {
            const d = docSnap.data(), id = docSnap.id;
            if(d.avisoCobro) {
                let montoP = 0;
                if(d.avisoCobro === "50% Seña Inicial") montoP = d.monto * 0.5;
                else if(d.avisoCobro === "30% Desarrollo") montoP = d.monto * 0.3;
                else if(d.avisoCobro === "20% Final") montoP = d.monto * 0.2;

                const row = tPagos.insertRow();
                row.innerHTML = `<td>${new Date().toLocaleDateString()}</td><td><b>${d.nombre}</b></td><td>${d.avisoCobro}</td><td style="color:var(--green)">USD ${montoP.toLocaleString()}</td><td><button class="btn-validar" onclick="confirmarPagoReal('${id}', ${montoP}, '${d.avisoCobro}')">APROBAR</button></td>`;
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
        avisoCobro: null,
        estado: "produccion" 
    });
    await addDoc(collection(db, "pagos"), { cliente: id, monto: monto, hito: hito, fecha: new Date() });
    alert("Pago validado.");
};

function actualizarROI(cash, cerrados) {
    const inv = Number(document.getElementById("inAds").value) || 300;
    document.getElementById("cacVal").innerText = `USD ${(inv / (cerrados || 1)).toFixed(0)}`;
    document.getElementById("roasVal").innerText = `${(cash / inv).toFixed(1)}x`;
    const costosFijos = 4400; 
    const rent = cash > 0 ? (((cash - costosFijos - inv) / cash) * 100).toFixed(0) : 0;
    document.getElementById("rentaNet").innerText = `${rent}%`;
}

window.calcROI = () => actualizarROI(cashGlobal, cierresGlobal);
window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");
