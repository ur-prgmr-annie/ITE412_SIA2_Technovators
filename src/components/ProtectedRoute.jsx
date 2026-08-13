// src/components/ProtectedRoute.jsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUserRoleAndStatus } from "../services/authService";
import { getRolePermissions } from "../services/adminRolesService"; // ✅ NEW

export default function ProtectedRoute({
  allowRoles = [],
  redirectTo = "/auth",
  roleMismatchTo = "/dashboard",

  // ✅ NEW: block route if role permission says false
  requiredModule = null,          // ex: "program2", "admin_panel"
  moduleDeniedTo = "/dashboard",  // where to send if module disabled

  children,
}) {
  const location = useLocation();

  const allowed = useMemo(
    () => allowRoles.map((r) => String(r || "").trim().toLowerCase()),
    [allowRoles]
  );

  const [state, setState] = useState({
    loading: true,
    ok: false,
    reason: "", // "NO_SESSION" | "PENDING" | "INACTIVE" | "ROLE" | "MODULE" | "ERROR"
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const profile = await getCurrentUserRoleAndStatus();
        if (!alive) return;

        if (!profile) {
          setState({ loading: false, ok: false, reason: "NO_SESSION" });
          return;
        }

        const role = String(profile.role || "").trim().toLowerCase();
        const status = String(profile.status || "").trim().toLowerCase();

        if (status === "pending") {
          setState({ loading: false, ok: false, reason: "PENDING" });
          return;
        }

        if (status !== "active") {
          setState({ loading: false, ok: false, reason: "INACTIVE" });
          return;
        }

        if (allowed.length && !allowed.includes(role)) {
          setState({ loading: false, ok: false, reason: "ROLE" });
          return;
        }

        // ✅ NEW: module permission gate
        if (requiredModule) {
          const rp = await getRolePermissions(role);

          // If doc missing, default to TRUE so you won't lock yourself out accidentally.
          // (You can make this false later if you want strict.)
          const allowedByModule = rp?.permissions
            ? !!rp.permissions[requiredModule]
            : true;

          if (!allowedByModule) {
            setState({ loading: false, ok: false, reason: "MODULE" });
            return;
          }
        }

        setState({ loading: false, ok: true, reason: "" });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, ok: false, reason: "ERROR" });
      }
    })();

    return () => {
      alive = false;
    };
  }, [allowed, requiredModule]); // ✅ include requiredModule

  if (state.loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#05130d",
          color: "#f3fff8",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "min(520px, 92vw)",
            borderRadius: 18,
            border: "1px solid rgba(180,255,220,0.12)",
            background:
              "linear-gradient(180deg, rgba(8,34,24,0.62), rgba(6,24,17,0.82))",
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
            padding: 18,
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 950, letterSpacing: "-0.02em", fontSize: 18 }}>
            Checking access…
          </div>
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
            Verifying account status and role permissions.
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#34d399",
                boxShadow: "0 0 18px rgba(44,255,177,0.8)",
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.25); opacity: .65; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!state.ok) {
    // ✅ keep your existing logic, add MODULE case
    const target =
      state.reason === "ROLE"
        ? roleMismatchTo
        : state.reason === "MODULE"
        ? moduleDeniedTo
        : redirectTo;

    return (
      <Navigate
        to={target}
        replace
        state={{
          from: location.pathname,
          reason: state.reason,
        }}
      />
    );
  }

  return children;
}