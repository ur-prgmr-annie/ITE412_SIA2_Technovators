import {
  ref,
  set,
  update,
  push,
  onValue,
  query,
  orderByChild,
  limitToLast,
  off,
  get,
  remove,
  serverTimestamp,
} from "firebase/database";
import { rtdb } from "./firebase";

const devicesRef = ref(rtdb, "coldchain");

export function subscribeDevices(cb, onErr) {
  const handleValue = (snap) => {
    const data = snap.val() || {};

    const items = Object.entries(data).map(([id, value]) => ({
      id,
      deviceId: value.deviceId || "ColdChain",
      name: value.name || "ColdChain",
      location: value.location || "—",
      minTemp: value.limits?.tempMin ?? 2,
      maxTemp: value.limits?.tempMax ?? 8,
      lastTemp: value.coldTemp ?? null,
      lastHumidity: value.humidity ?? null,
      lastAmbientTemp: value.ambientTemp ?? null,
      alert: Boolean(value.alert),
      ambientAlert: Boolean(value.ambientAlert),
      humidityAlert: Boolean(value.humidityAlert),
      probeOk: value.probeOk ?? true,
      dhtOk: value.dhtOk ?? true,
      status: value.status || "UNKNOWN",
      lastReadAt: value.timestampMs ?? null,
      updatedAt: value.updatedAt ?? value.timestampMs ?? 0,
      raw: value,
    }));

    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    cb(items);
  };

  const handleError = (err) => onErr?.(err);
  onValue(devicesRef, handleValue, handleError);
  return () => off(devicesRef, "value", handleValue);
}

export function subscribeReadings(deviceDocId, cb, onErr) {
  if (!deviceDocId) return () => {};

  const deviceReadingsRef = ref(rtdb, `coldchain_readings/${deviceDocId}`);
  const readingsQuery = query(
    deviceReadingsRef,
    orderByChild("readAt"),
    limitToLast(100)
  );

  const handleValue = (snap) => {
    const data = snap.val() || {};
    const items = Object.entries(data).map(([id, value]) => ({
      id,
      ...value,
    }));

    items.sort((a, b) => (b.readAt || 0) - (a.readAt || 0));
    cb(items);
  };

  const handleError = (err) => onErr?.(err);
  onValue(readingsQuery, handleValue, handleError);
  return () => off(deviceReadingsRef, "value", handleValue);
}

/**
 * Register a new monitoring device under /coldchain.
 *
 * @param {Object} payload
 * @param {string} payload.name          Display name (e.g. "Vaccine Fridge — RHU Main")
 * @param {string} payload.deviceId      Hardware serial / sensor ID (e.g. "CC-ESP32-002")
 * @param {string} [payload.location]    Human-readable location
 * @param {number} [payload.minTemp=2]   Lower safe temperature bound (°C)
 * @param {number} [payload.maxTemp=8]   Upper safe temperature bound (°C)
 * @returns {Promise<{ id: string, deviceId: string, name: string }>}
 */
export async function addDevice(payload) {
  const name = String(payload?.name ?? "").trim();
  const deviceId = String(payload?.deviceId ?? "").trim();
  const location = String(payload?.location ?? "").trim() || "—";

  if (!name) throw new Error("Device name is required.");
  if (!deviceId) throw new Error("Device ID is required.");

  const minTemp = Number(payload?.minTemp ?? 2);
  const maxTemp = Number(payload?.maxTemp ?? 8);

  if (Number.isNaN(minTemp) || Number.isNaN(maxTemp)) {
    throw new Error("Min and max temperature must be valid numbers.");
  }
  if (minTemp >= maxTemp) {
    throw new Error("Min temperature must be lower than max temperature.");
  }

  // Guard against duplicate hardware IDs
  const snapshot = await get(devicesRef);
  const existing = snapshot.val() || {};
  const duplicate = Object.values(existing).some(
    (d) => String(d?.deviceId ?? "").toLowerCase() === deviceId.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Device ID "${deviceId}" is already registered.`);
  }

  const now = Date.now();
  const newRef = push(devicesRef);

  const deviceData = {
    deviceId,
    name,
    location,
    limits: {
      tempMin: minTemp,
      tempMax: maxTemp,
    },
    coldTemp: null,
    humidity: null,
    ambientTemp: null,
    alert: false,
    tempAlert: false,
    humidityAlert: false,
    ambientAlert: false,
    probeOk: true,
    dhtOk: true,
    status: "UNKNOWN",
    createdAt: now,
    updatedAt: now,
    timestampMs: null,
  };

  await set(newRef, deviceData);

  return { id: newRef.key, deviceId, name };
}

/**
 * Remove a device (and its readings) from the database.
 */
export async function removeDevice(id) {
  if (!id) throw new Error("Device id is required.");
  await remove(ref(rtdb, `coldchain/${id}`));
  await remove(ref(rtdb, `coldchain_readings/${id}`));
}

export async function addReading(payload) {
  const deviceId = payload.deviceDocId;
  if (!deviceId) throw new Error("deviceDocId is required");

  const now = Date.now();
  const readAt = Math.floor(now / 1000);
  const iso = new Date(now).toISOString();

  // Pull the current device so we don't clobber name / deviceId / limits.
  const deviceSnap = await get(ref(rtdb, `coldchain/${deviceId}`));
  const existing = deviceSnap.val() || {};

  const readingData = {
    deviceId: existing.deviceId || "ColdChain",
    tempC: Number(payload.tempC),
    ambientTemp: payload.ambientTemp != null ? Number(payload.ambientTemp) : null,
    humidity: payload.humidity != null ? Number(payload.humidity) : null,
    status: payload.status || "NORMAL",
    alert: Boolean(payload.alert ?? false),
    tempAlert: Boolean(payload.tempAlert ?? false),
    humidityAlert: Boolean(payload.humidityAlert ?? false),
    ambientAlert: Boolean(payload.ambientAlert ?? false),
    probeOk: Boolean(payload.probeOk ?? true),
    dhtOk: Boolean(payload.dhtOk ?? true),
    readAt,
    readAtIso: iso,
    createdAt: now,
  };

  const newReadingRef = push(ref(rtdb, `coldchain_readings/${deviceId}`));
  await set(newReadingRef, readingData);

  await update(ref(rtdb, `coldchain/${deviceId}`), {
    coldTemp: Number(payload.tempC),
    humidity: payload.humidity != null ? Number(payload.humidity) : null,
    ambientTemp: payload.ambientTemp != null ? Number(payload.ambientTemp) : null,
    status: payload.status || "NORMAL",
    alert: Boolean(payload.alert ?? false),
    tempAlert: Boolean(payload.tempAlert ?? false),
    humidityAlert: Boolean(payload.humidityAlert ?? false),
    ambientAlert: Boolean(payload.ambientAlert ?? false),
    probeOk: Boolean(payload.probeOk ?? true),
    dhtOk: Boolean(payload.dhtOk ?? true),
    timestampMs: now,
    updatedAt: now,
  });

  return newReadingRef.key;
}

export async function updateDevice(id, payload) {
  const existingSnap = await get(ref(rtdb, `coldchain/${id}`));
  const existing = existingSnap.val() || {};

  const currentMin = existing?.limits?.tempMin ?? 2;
  const currentMax = existing?.limits?.tempMax ?? 8;

  const nextMin = payload.minTemp != null ? Number(payload.minTemp) : currentMin;
  const nextMax = payload.maxTemp != null ? Number(payload.maxTemp) : currentMax;

  if (Number.isNaN(nextMin) || Number.isNaN(nextMax)) {
    throw new Error("Min and max temperature must be valid numbers.");
  }
  if (nextMin >= nextMax) {
    throw new Error("Min temperature must be lower than max temperature.");
  }

  const patch = {
    ...(payload.minTemp != null || payload.maxTemp != null
      ? {
          limits: {
            tempMin: nextMin,
            tempMax: nextMax,
          },
        }
      : {}),
    ...(payload.name != null ? { name: payload.name } : {}),
    ...(payload.location != null ? { location: payload.location } : {}),
    ...(payload.deviceId != null ? { deviceId: payload.deviceId } : {}),
    updatedAt: Date.now(),
  };

  await update(ref(rtdb, `coldchain/${id}`), patch);
}

export async function getDevice(deviceId) {
  const snap = await get(ref(rtdb, `coldchain/${deviceId}`));
  if (!snap.exists()) return null;

  const value = snap.val();
  return {
    id: deviceId,
    deviceId: value.deviceId || "ColdChain",
    name: value.name || "ColdChain",
    location: value.location || "—",
    minTemp: value.limits?.tempMin ?? 2,
    maxTemp: value.limits?.tempMax ?? 8,
    lastTemp: value.coldTemp ?? null,
    lastHumidity: value.humidity ?? null,
    lastAmbientTemp: value.ambientTemp ?? null,
    alert: Boolean(value.alert),
    status: value.status || "UNKNOWN",
    lastReadAt: value.timestampMs ?? null,
    updatedAt: value.updatedAt ?? value.timestampMs ?? 0,
    raw: value,
  };
}