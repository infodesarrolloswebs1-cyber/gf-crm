import { db } from "./firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.crearCliente = async function () {
  try {
    await addDoc(collection(db, "clientes"), {
      nombre: "Cliente prueba",
      email: "test@mail.com",
      fecha: new Date()
    });

    alert("Cliente guardado en Firebase 🚀");
  } catch (e) {
    console.error(e);
    alert("Error");
  }
};
