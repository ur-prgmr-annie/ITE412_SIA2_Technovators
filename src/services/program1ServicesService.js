import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const animalsCol = collection(db, "p1_animals");
const servicesCol = collection(db, "p1_services");

/** animals list (lite) */
export function subscribeAnimalsLite(cb, onErr) {
  const q = query(animalsCol, orderBy("updatedAt", "desc"), limit(500));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onErr?.(e)
  );
}

/** services by animal */
export function subscribeServicesByAnimal(animalId, cb, onErr) {
  if (!animalId) return () => {};
  const q = query(
    servicesCol,
    where("animalId", "==", animalId),
    orderBy("serviceDate", "desc"),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onErr?.(e)
  );
}

export async function createService(payload) {
  const data = {
    animalId: payload.animalId,
    animalTagId: payload.animalTagId || "",
    farmBarangay: payload.farmBarangay || "",

    type: payload.type || "Vaccination",
    serviceDate: payload.serviceDate ? new Date(payload.serviceDate) : new Date(),
    product: payload.product || "",
    dose: payload.dose || "",
    performedBy: payload.performedBy || "",
    notes: payload.notes || "",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(servicesCol, data);
  return ref.id;
}

export async function updateService(id, payload) {
  const ref = doc(db, "p1_services", id);
  await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
}

export async function deleteService(id) {
  const ref = doc(db, "p1_services", id);
  await deleteDoc(ref);
}
