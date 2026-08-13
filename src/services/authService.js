// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

/** wait for firebase auth to be ready (returns user or null) */
function waitForAuthReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

/**
 * Creates FIRST ADMIN only if no admin exists.
 */
export async function seedFirstAdmin(fullName, email, password) {
  const q = query(collection(db, "users"), where("role", "==", "admin"));
  const snap = await getDocs(q);
  if (!snap.empty) throw new Error("ADMIN_ALREADY_EXISTS");

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    fullName,
    email: email.toLowerCase(),
    role: "admin",
    status: "active",
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export async function requestAccessRegister(fullName, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    fullName,
    email: email.toLowerCase(),
    role: "field_officer",
    status: "pending",
    createdAt: serverTimestamp(),
  });

  await signOut(auth);
  return cred.user;
}

export async function loginEmailPassword(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function logout() {
  return signOut(auth);
}

export async function getCurrentUserRoleAndStatus() {
  // ✅ wait until firebase finishes restoring session
  const user = auth.currentUser ?? (await waitForAuthReady());
  if (!user) return null;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();

  return {
    ...data,
    // ✅ normalize so your route checks never fail because of casing/spaces
    role: String(data.role || "").trim().toLowerCase(),
    status: String(data.status || "").trim().toLowerCase(),
  };
}
