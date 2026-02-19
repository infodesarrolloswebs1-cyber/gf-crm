import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJbG9uZqqdCJai2fN3aBP_2cAcYxUlyw0",
  authDomain: "gf-desarrollos-crm.firebaseapp.com",
  projectId: "gf-desarrollos-crm",
  storageBucket: "gf-desarrollos-crm.firebasestorage.app",
  messagingSenderId: "946811439846",
  appId: "1:946811439846:web:acf6ba394a517ae11c8927"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

