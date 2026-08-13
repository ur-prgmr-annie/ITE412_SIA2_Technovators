// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCm8cneN-qMSg5cbd28HBWs86NdC9R7y38",
  authDomain: "animis-naujan.firebaseapp.com",
  databaseURL:
    "https://animis-naujan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "animis-naujan",
  storageBucket: "animis-naujan.firebasestorage.app",
  messagingSenderId: "699129666950",
  appId: "1:699129666950:web:8ca020a3100165ec30e007",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);