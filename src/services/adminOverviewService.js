// src/services/adminOverviewService.js
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Live KPI stats from /users collection
 * expected user doc fields: { role, status, fullName, email, ... }
 */
export function subscribeAdminKpis(cb, onError) {
  const ref = collection(db, "users");

  return onSnapshot(
    ref,
    (snap) => {
      const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const kpis = {
        totalUsers: users.length,
        pendingUsers: 0,
        activeUsers: 0,
        disabledUsers: 0, // we treat anything not active/pending as "disabled" (ex: rejected/inactive)
        reportsGenerated: 0, // keep 0 until you connect real reports
        lowStockItems: 0, // keep 0 until you connect inventory
        coldChainAlerts: 0, // keep 0 until you connect iot/coldchain
        systemStatus: "online",

        // extra role stats (useful for Role Control)
        roleAdmin: 0,
        roleField: 0,
        roleInventory: 0,
      };

      for (const u of users) {
        const status = String(u.status || "").trim().toLowerCase();
        const role = String(u.role || "").trim().toLowerCase();

        if (status === "pending") kpis.pendingUsers++;
        else if (status === "active") kpis.activeUsers++;
        else kpis.disabledUsers++;

        if (role === "admin") kpis.roleAdmin++;
        else if (role === "field_officer") kpis.roleField++;
        else if (role === "inventory_officer") kpis.roleInventory++;
      }

      cb(kpis);
    },
    (err) => onError?.(err)
  );
}
