// src/services/adminRolesService.js
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
} from "firebase/firestore";
import { db, auth } from "./firebase";

const ROLE_DOC = (roleId) => `rolePermissions/${roleId}`;

// ✅ Your system roles
export const ROLES = [
  { id: "admin", label: "Admin" },
  { id: "field_officer", label: "Field Officer" },
  { id: "inventory_officer", label: "Inventory Officer" },
];

// ✅ Modules / pages you want to control
export const MODULES = [
  {
    group: "Core Access",
    items: [
      { key: "dashboard", label: "Shared Dashboard (/dashboard)" },
      { key: "admin_panel", label: "Admin Panel (/admin/panel)" },
    ],
  },
  {
    group: "Programs",
    items: [
      { key: "program1", label: "Program 1: Animal Health Protection" },
      { key: "program2", label: "Program 2: Animal Breeding" },
      { key: "program3", label: "Program 3: Animal Health Care" },
      { key: "program4", label: "Program 4: Records of All Programs" }, // ✅ NEW
    ],
  },
];

// ✅ Default permissions (safe + matches your current routing)
export function getDefaultRolePermissions() {
  return {
    admin: {
      dashboard: true,
      admin_panel: true,
      program1: true,
      program2: true,
      program3: true,
      program4: true, // ✅ NEW
    },
    field_officer: {
      dashboard: true,
      admin_panel: false,
      program1: true,
      program2: true,
      program3: true,
      program4: true, // ✅ NEW
    },
    inventory_officer: {
      dashboard: true,
      admin_panel: false,
      program1: true,
      program2: false,
      program3: false,
      program4: true, // ✅ NEW (set to false if you want to restrict it)
    },
  };
}

// ✅ Ensure doc exists (admin page can call this)
export async function ensureRoleDoc(roleId) {
  const ref = doc(db, ROLE_DOC(roleId));
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const defaults = getDefaultRolePermissions();
    await setDoc(
      ref,
      {
        roleId,
        permissions: defaults[roleId] || {},
        createdAt: serverTimestamp(),
        createdBy: auth?.currentUser?.uid || null,
      },
      { merge: true }
    );
  }
}

// ✅ Simple fetch for ProtectedRoute / AccessDashboard
export async function getRolePermissions(roleId) {
  const ref = doc(db, ROLE_DOC(roleId));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export function subscribeRolePermissions(roleId, cb, onError) {
  const ref = doc(db, ROLE_DOC(roleId));
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => onError?.(err)
  );
}

export async function saveRolePermissions(roleId, permissions) {
  const ref = doc(db, ROLE_DOC(roleId));

  await setDoc(
    ref,
    {
      roleId,
      permissions: permissions || {},
      updatedAt: serverTimestamp(),
      updatedBy: auth?.currentUser?.uid || null,
    },
    { merge: true }
  );

  // Optional audit log
  try {
    await addDoc(collection(db, "auditLogs"), {
      action: "UPDATE_ROLE_PERMISSIONS",
      roleId,
      actorUid: auth?.currentUser?.uid || null,
      at: serverTimestamp(),
      summary: permissions || {},
    });
  } catch {}
}
