// src/services/adminService.js
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/* =====================================================
   FETCH PENDING USERS
===================================================== */
export async function fetchPendingUsers() {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/* =====================================================
   APPROVE / REJECT
===================================================== */
export async function approveUser(uid, role) {
  await updateDoc(doc(db, "users", uid), {
    status: "active",
    role,
    updatedAt: serverTimestamp(),
  });
}

export async function rejectUser(uid) {
  await updateDoc(doc(db, "users", uid), {
    status: "rejected",
    updatedAt: serverTimestamp(),
  });
}

/* =====================================================
   FETCH ALL USERS (ADMIN TABLE)
===================================================== */
export async function fetchAllUsers() {
  try {
    // 🔹 If createdAt exists → nice ordering
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (e) {
    // 🔹 Fallback if createdAt does not exist or index missing
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  }
}

/* =====================================================
   ADMIN UPDATE USER (ROLE / STATUS / NAME)
===================================================== */
export async function updateUserAdmin(uid, patch) {
  await updateDoc(doc(db, "users", uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/* =====================================================
   DELETE USER (PROFILE ONLY)
   ⚠ Does NOT delete Firebase Auth account
===================================================== */
export async function deleteUserAdmin(uid) {
  await deleteDoc(doc(db, "users", uid));
}

/* =====================================================
   EXTRA HELPERS (for dashboard safety logic)
===================================================== */

// Count users by role
export function countUsersByRole(users) {
  const stats = {
    total: users.length,
    admin: 0,
    field_officer: 0,
    inventory_officer: 0,
    active: 0,
    pending: 0,
    rejected: 0,
  };

  users.forEach((u) => {
    if (u.role && stats[u.role] !== undefined) {
      stats[u.role]++;
    }
    if (u.status && stats[u.status] !== undefined) {
      stats[u.status]++;
    }
  });

  return stats;
}

// Check if this is the last admin
export function isLastAdmin(users, uid) {
  const admins = users.filter((u) => u.role === "admin");
  return admins.length === 1 && admins[0].id === uid;
}
