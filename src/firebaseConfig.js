// Importa las funciones que necesitas de los SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAY5NixkbADrt6kh7A7eEJ_RDgbm-fZ-A0",
  authDomain: "jgames-7d34a.firebaseapp.com",
  projectId: "jgames-7d34a",
  storageBucket: "jgames-7d34a.appspot.com", // 👈 corregido
  messagingSenderId: "472801049359",
  appId: "1:472801049359:web:07e66e810c917bf90c1c7a",
  measurementId: "G-YD5CGE37WW"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
