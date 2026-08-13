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
      updatedAt: value.timestampMs ?? 0,
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

export async function addReading(payload) {
  const deviceId = payload.deviceDocId;
  if (!deviceId) throw new Error("deviceDocId is required");

  const now = Date.now();
  const readAt = Math.floor(now / 1000);
  const iso = new Date(now).toISOString();

  const readingData = {
    deviceId: "ColdChain",
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
    deviceId: "ColdChain",
    name: "ColdChain",
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
  });

  return newReadingRef.key;
}

export async function updateDevice(id, payload) {
  const patch = {
    ...(payload.minTemp != null || payload.maxTemp != null
      ? {
          limits: {
            tempMin: Number(payload.minTemp ?? 2),
            tempMax: Number(payload.maxTemp ?? 8),
          },
        }
      : {}),
    ...(payload.name != null ? { name: payload.name } : {}),
    ...(payload.location != null ? { location: payload.location } : {}),
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
    updatedAt: value.timestampMs ?? 0,
    raw: value,
  };
}