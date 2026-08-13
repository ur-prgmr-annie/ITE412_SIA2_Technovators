import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export async function fetchAllAnimals() {
  const snap = await getDocs(collection(db, "p1_animals"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchServicesByDateRange(from, to) {
  const col = collection(db, "p1_services");
  const clauses = [];
  if (from) clauses.push(where("serviceDate", ">=", new Date(from)));
  if (to) clauses.push(where("serviceDate", "<=", new Date(to)));
  const snap = await getDocs(query(col, ...clauses));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
