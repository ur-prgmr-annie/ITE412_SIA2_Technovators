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

const itemsCol = collection(db, "p1_items");
const batchesCol = collection(db, "p1_batches");
const movesCol = collection(db, "p1_stock_movements");

/** Items */
export function subscribeItems(cb, onErr) {
  const q = query(itemsCol, orderBy("name", "asc"), limit(500));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onErr?.(e)
  );
}
export async function createItem(payload) {
  const ref = await addDoc(itemsCol, {
    name: payload.name || "",
    unit: payload.unit || "pcs",
    category: payload.category || "Vaccine",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
export async function updateItem(id, payload) {
  await updateDoc(doc(db, "p1_items", id), { ...payload, updatedAt: serverTimestamp() });
}
export async function deleteItem(id) {
  await deleteDoc(doc(db, "p1_items", id));
}

/** Batches */
export function subscribeBatches(itemId, cb, onErr) {
  const clauses = [];
  if (itemId) clauses.push(where("itemId", "==", itemId));
  const q = query(batchesCol, ...clauses, orderBy("expiryDate", "asc"), limit(500));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onErr?.(e)
  );
}
export async function createBatch(payload) {
  const ref = await addDoc(batchesCol, {
    itemId: payload.itemId,
    itemName: payload.itemName || "",
    batchNo: payload.batchNo || "",
    expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
    qtyOnHand: Number(payload.qtyOnHand || 0),
    location: payload.location || "Main Storage",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
export async function updateBatch(id, payload) {
  await updateDoc(doc(db, "p1_batches", id), { ...payload, updatedAt: serverTimestamp() });
}
export async function deleteBatch(id) {
  await deleteDoc(doc(db, "p1_batches", id));
}

/** Stock movements (in/out/adjust) */
export function subscribeMovements(batchId, cb, onErr) {
  const clauses = [];
  if (batchId) clauses.push(where("batchId", "==", batchId));
  const q = query(movesCol, ...clauses, orderBy("movedAt", "desc"), limit(500));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onErr?.(e)
  );
}
export async function createMovement(payload) {
  const ref = await addDoc(movesCol, {
    batchId: payload.batchId,
    itemName: payload.itemName || "",
    batchNo: payload.batchNo || "",
    type: payload.type || "IN", // IN / OUT / ADJUST
    qty: Number(payload.qty || 0),
    reference: payload.reference || "",
    movedAt: payload.movedAt ? new Date(payload.movedAt) : new Date(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
export async function deleteMovement(id) {
  await deleteDoc(doc(db, "p1_stock_movements", id));
}
