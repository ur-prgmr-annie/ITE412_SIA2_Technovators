// src/services/adminSettingsService.js
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

const SETTINGS_DOC_PATH = "systemSettings/main";
const FLAGS_DOC_PATH = "systemFlags/main";

// --------------------
// Admin Settings
// --------------------
export function subscribeSystemSettings(cb, onError) {
  const ref = doc(db, SETTINGS_DOC_PATH);
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => onError?.(err)
  );
}

export async function saveSystemSettings(payload) {
  const ref = doc(db, SETTINGS_DOC_PATH);

  await setDoc(
    ref,
    {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: auth?.currentUser?.uid || null,
    },
    { merge: true }
  );

  // Optional: audit log
  try {
    await addDoc(collection(db, "auditLogs"), {
      action: "UPDATE_SYSTEM_SETTINGS",
      actorUid: auth?.currentUser?.uid || null,
      at: serverTimestamp(),
      summary: {
        timezone: payload?.general?.timezone ?? null,
      },
    });
  } catch {}
}

export function getDefaultSettings() {
  return {
    general: {
      systemName: "ANIMIS",
      officeName: "Municipal Agriculturist Office • Naujan",
      timezone: "Asia/Manila",
      maintenanceMode: false, // (kept in defaults for UI, but FLAGS is the truth)
    },
    security: {
      require2FA: false,
      passwordMinLength: 8,
      sessionTimeoutMins: 60,
      allowWeakPasswords: false,
    },
    notifications: {
      emailEnabled: true,
      inAppEnabled: true,
      lowStockAlerts: true,
      coldChainAlerts: true,
      diseaseAlerts: true,
      dailyDigest: false,
    },
    data: {
      auditLogging: true,
      autoBackup: true,
      backupFrequency: "daily",
      retentionDays: 90,
    },
  };
}

// --------------------
// System Flags (Maintenance mode) ✅ SOURCE OF TRUTH
// --------------------
export function subscribeSystemFlags(cb, onError) {
  const ref = doc(db, FLAGS_DOC_PATH);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return cb({ maintenanceMode: false });
      const data = snap.data() || {};
      cb({ maintenanceMode: !!data.maintenanceMode });
    },
    (err) => onError?.(err)
  );
}

export async function getSystemFlags() {
  const ref = doc(db, FLAGS_DOC_PATH);
  const snap = await getDoc(ref);

  if (!snap.exists()) return { maintenanceMode: false };

  const data = snap.data() || {};
  return { maintenanceMode: !!data.maintenanceMode };
}

// ✅ NEW: the export your AdminSettings.jsx is looking for
export async function saveSystemFlags(flags) {
  const ref = doc(db, FLAGS_DOC_PATH);

  await setDoc(
    ref,
    {
      maintenanceMode: !!flags?.maintenanceMode,
      updatedAt: serverTimestamp(),
      updatedBy: auth?.currentUser?.uid || null,
    },
    { merge: true }
  );

  // Optional audit
  try {
    await addDoc(collection(db, "auditLogs"), {
      action: "UPDATE_SYSTEM_FLAGS",
      actorUid: auth?.currentUser?.uid || null,
      at: serverTimestamp(),
      summary: { maintenanceMode: !!flags?.maintenanceMode },
    });
  } catch {}
}

// ✅ ensure the flags doc exists (admin-only write)
export async function ensureSystemFlagsDoc() {
  const ref = doc(db, FLAGS_DOC_PATH);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        maintenanceMode: false,
        createdAt: serverTimestamp(),
        createdBy: auth?.currentUser?.uid || null,
      },
      { merge: true }
    );
  }
}

// ✅ BACKWARD COMPAT: keep this so old code won't break
export async function saveSystemFlagsFromSettings(settingsPayload) {
  return saveSystemFlags({
    maintenanceMode: !!settingsPayload?.general?.maintenanceMode,
  });
}
