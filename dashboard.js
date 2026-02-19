import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "/";
  else cargarDatos();
});

window.logout = () => signOut(auth).then(() => window.location.href = "/");

// CREAR LEAD
window.crearLead = async function () {
  const nombre = document.getElementById("leadNombre").value;
  const empresa = document.getElementById("leadEmpresa").value;
  const monto = document.getElementById("leadMonto").value;

  if (!nombre || !monto) return alert("Completa los datos");

  await addDoc(collection(db, "leads"), {
    nombre, empresa, monto: Number(monto), estado: "nuevo", fecha: new Date()
  });

  limpiarInputs();
  cargarDatos();
};

async function cargarDatos() {
  const columnas = ["nuevo", "reunion", "propuesta", "cerrado"];
  columnas.forEach(id => document.getElementById("col-"+id).innerHTML = `<h3>${id}</h3>`);

  let totalPipeline = 0;
  let ventasCerradas = 0;

  const querySnapshot = await getDocs(collection(db, "leads"));

  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;

    if (d.estado !== "cerrado") totalPipeline += d.monto;
    else ventasCerradas += d.monto;

    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.dataset.id = id;
    card.innerHTML = `
      <strong>${d.nombre}</strong><br>
      <small style="color:#94a3b8">${d.empresa}</small>
      <span class="usd-tag">USD ${d.monto.toLocaleString()}</span>
    `;

    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("id", id));
    document.getElementById("col-" + d.estado).appendChild(card);
  });

  actualizarKPIs(totalPipeline, ventasCerradas);
}

function actualizarKPIs(pip, ven) {
  document.getElementById("totalPipeline").innerText = `USD ${pip.toLocaleString()}`;
  document.getElementById("ventasMes").innerText = `USD ${ven.toLocaleString()}`;
  const rent = ven > 0 ? ((ven - 4400) / ven * 100).toFixed(1) : 0;
  document.getElementById("rentabilidad").innerText = `${rent}%`;
}

// DRAG & DROP CON LÓGICA DE NEGOCIO
["nuevo","reunion","propuesta","cerrado"].forEach(estado => {
  const col = document.getElementById("col-" + estado);
  col.addEventListener("dragover", e => e.preventDefault());
  col.addEventListener("drop", async e => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const ref = doc(db, "leads", id);

    // Si se mueve a CERRADO, creamos Proyecto y Pago Inicial (50%)
    if (estado === "cerrado") {
      const snap = await getDoc(ref);
      const data = snap.data();
      
      // Registrar Proyecto
      await addDoc(collection(db, "proyectos"), {
        leadId: id,
        cliente: data.nombre,
        montoTotal: data.monto,
        comisionTotal: data.monto * 0.10,
        fechaCierre: new Date(),
        estadoProduccion: "Iniciado"
      });

      // Registrar Hito 1 (Cash-In)
      await addDoc(collection(db, "pagos"), {
        proyectoId: id,
        monto: data.monto * 0.50,
        detalle: "Anticipo 50%",
        fecha: new Date()
      });
      
      alert(`¡VENTA CERRADA! Proyecto creado y cobro de 50% (USD ${data.monto * 0.5}) registrado.`);
    }

    await updateDoc(ref, { estado });
    cargarDatos();
  });
});

function limpiarInputs() {
  document.getElementById("leadNombre").value = "";
  document.getElementById("leadEmpresa").value = "";
  document.getElementById("leadMonto").value = "";
}
