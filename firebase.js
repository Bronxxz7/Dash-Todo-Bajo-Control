import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpSd2LHLm_cb3MOiIIqDM6muAzJpChrKM",
  authDomain: "dashboard-finanzas-e1446.firebaseapp.com",
  projectId: "dashboard-finanzas-e1446",
  storageBucket: "dashboard-finanzas-e1446.firebasestorage.app",
  messagingSenderId: "43765661903",
  appId: "1:43765661903:web:d2189c6eef3479e43f77ba"
};

// Inicializar UNA sola vez
const app = initializeApp(firebaseConfig);

// Exportar
export const auth = getAuth(app);
export const db = getFirestore(app);