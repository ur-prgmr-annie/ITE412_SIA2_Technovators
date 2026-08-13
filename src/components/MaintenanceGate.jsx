// src/components/MaintenanceGate.jsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../services/firebase";

import { getSystemFlags } from "../services/adminSettingsService";
import { getCurrentUserRoleAndStatus } from "../services/authService";

export default function MaintenanceGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!alive) return;

        // Not logged in → don't block; Auth page will handle access
        if (!user) {
          setReady(true);
          return;
        }

        const flags = await getSystemFlags();
        const maintenance = !!flags?.maintenanceMode;

        // Not in maintenance → allow
        if (!maintenance) {
          setReady(true);
          return;
        }

        // In maintenance → allow ONLY admin
        const res = await getCurrentUserRoleAndStatus();
        const role = String(res?.role || "").trim().toLowerCase();

        if (role === "admin") {
          setReady(true);
          return;
        }

        // Non-admin: sign out + send to auth (with message query)
        await signOut(auth);

        // prevent infinite redirect loop if already in /auth
        if (location.pathname !== "/auth") {
          navigate("/auth?m=1", { replace: true });
        } else {
          navigate("/auth?m=1", { replace: true });
        }

        setReady(true);
      } catch (e) {
        // If anything fails, fail-open so the app doesn't get stuck
        setReady(true);
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [navigate, location.pathname]);

  if (!ready) return null;
  return children;
}
