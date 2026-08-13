import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Collections (namespaced for Program 1)
 * - p1_farms
 * - p1_animals
 */

const farmsCol = collection(db, "p1_farms");
const animalsCol = collection(db, "p1_animals");

/** ---------- FARMS ---------- */
export async function createFarm(payload) {
  const data = {
    ownerName: payload.ownerName || "",
    contact: payload.contact || "",
    barangay: payload.barangay || "",
    address: payload.address || "",
    // Optional geo later:
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(farmsCol, data);
  return ref.id;
}

export async function updateFarm(id, payload) {
  const ref = doc(db, "p1_farms", id);
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function getFarm(id) {
  const ref = doc(db, "p1_farms", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listFarmsLite(max = 200) {
  const q = query(farmsCol, orderBy("updatedAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ---------- ANIMALS ---------- */
export async function createAnimal(payload) {
  const data = {
    tagId: payload.tagId || "",
    species: payload.species || "",
    breed: payload.breed || "",
    sex: payload.sex || "",
    ageMonths: payload.ageMonths ?? null,

    status: payload.status || "active", // active / sold / dead
    farmId: payload.farmId || "",
    farmBarangay: payload.farmBarangay || "",

    notes: payload.notes || "",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(animalsCol, data);
  return ref.id;
}

export async function updateAnimal(id, payload) {
  const ref = doc(db, "p1_animals", id);
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAnimal(id) {
  const ref = doc(db, "p1_animals", id);
  await deleteDoc(ref);
}

/**
 * Real-time list with optional server-side filters.
 * NOTE: Some combinations may require Firestore composite indexes.
 */
export function subscribeAnimals(filters, cb, onErr) {
  const clauses = [];

  if (filters?.barangay) clauses.push(where("farmBarangay", "==", filters.barangay));
  if (filters?.species) clauses.push(where("species", "==", filters.species));
  if (filters?.status) clauses.push(where("status", "==", filters.status));

  const q = query(animalsCol, ...clauses, orderBy("updatedAt", "desc"), limit(500));

  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onErr?.(e)
  );
}
