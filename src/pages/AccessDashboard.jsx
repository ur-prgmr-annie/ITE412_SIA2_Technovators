import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/accessDashboard.css";
import logo from "../images/logo.png";
import { auth } from "../services/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getCurrentUserRoleAndStatus } from "../services/authService";
import { getRolePermissions } from "../services/adminRolesService";
import { X, LogOut } from "lucide-react";

const PROGRAMS = [
  {
    id: "animal-health-protection",
    moduleKey: "program1",
    code: "PROGRAM 1",
    title: "Animal Health Protection Program",
    icon: "🛡️",
    subtitle: "Registration • Health Services • Inventory • Cold Chain • GIS • Reports",
    modules: [
      "Animal & Farm Registration",
      "Animal Health Services Monitoring",
      "Vaccine & Supply Inventory Management",
      "IoT Cold Chain Monitoring",
      "GIS Mapping",
      "Reporting & Analytics",
    ],
    route: "/program/animal-health-protection",
    rolesAllowed: ["field_officer", "inventory_officer", "admin"],
  },
  {
    id: "animal-breeding",
    moduleKey: "program2",
    code: "PROGRAM 2",
    title: "Animal Breeding Program",
    icon: "🧬",
    subtitle: "Breeding workflow and performance outcomes",
    modules: [
      "Estrus Synchronization Scheduling & Monitoring",
      "Artificial Insemination Record Management",
      "Pregnancy Check & Outcome Tracking",
      "Breeding Performance Monitoring",
      "Reporting & Analytics (Breeding success & conception rate)",
    ],
    route: "/program/animal-breeding",
    rolesAllowed: ["field_officer", "admin"],
  },
  {
    id: "animal-health-care",
    moduleKey: "program3",
    code: "PROGRAM 3",
    title: "Animal Health Care Program",
    icon: "🩺",
    subtitle: "Disease surveillance, hotspot mapping, and trend reports",
    modules: [
      "Disease Surveillance (ASF / Bird Flu)",
      "Suspected & Confirmed Case Monitoring",
      "Status Tracking (reported → investigated → closed)",
      "Reporting & Analytics (monthly/annual incidence trends)",
      "GIS Mapping (disease hotspots)",
    ],
    route: "/program/animal-health-care",
    rolesAllowed: ["field_officer", "admin"],
  },
  {
    id: "records-all",
    moduleKey: "program4",
    code: "PROGRAM 4",
    title: "Records of All Programs",
    icon: "📚",
    subtitle: "Unified records, audit trail, and consolidated reporting",
    modules: ["All program records overview", "Consolidated reports", "Audit logs and activity history", "Export / print summaries (if enabled)"],
    route: "/program/records-all",
    rolesAllowed: ["field_officer", "inventory_officer", "admin"],
  },
];

function RoleBadge({ role }) {
  const label =
    role === "admin"
      ? "Admin"
      : role === "inventory_officer"
      ? "Inventory Officer"
      : role === "field_officer"
      ? "Field Officer"
      : "User";

  return (
    <span className="role-badge">
      <span className="dot" />
      {label}
    </span>
  );
}

function Modal({ open, title, children, onClose, busy }) {
  if (!open) return null;

  return (
    <div className="admWrap" role="dialog" aria-modal="true">
      <button className="admOverlay" onClick={() => (busy ? null : onClose())} aria-label="Close modal" />
      <div className="admCard">
        <div className="admHead">
          <div className="admTitle">{title}</div>
          <button className="admX" onClick={() => (busy ? null : onClose())} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="admBody">{children}</div>
      </div>
    </div>
  );
}

export default function AccessDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);

  const [rolePerms, setRolePerms] = useState(null);

  const [warn, setWarn] = useState(null);
  const showWarn = (msg) => {
    setWarn(msg);
    window.clearTimeout(showWarn._t);
    showWarn._t = window.setTimeout(() => setWarn(null), 2400);
  };

  // ✅ Logout modal state
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busyLogout, setBusyLogout] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const res = await getCurrentUserRoleAndStatus();
        setRole(res?.role || null);
        setStatus(res?.status || null);

        if (res?.status === "pending") {
          await signOut(auth);
          navigate("/auth", { state: { msg: "Your request is pending admin approval." } });
          return;
        }
        if (res?.status !== "active") {
          await signOut(auth);
          navigate("/auth", { state: { msg: "Your account is inactive. Contact admin." } });
          return;
        }

        try {
          const rp = await getRolePermissions(String(res?.role || "").toLowerCase());
          setRolePerms(rp?.permissions || null);
        } catch {
          setRolePerms(null);
        }

        if (res?.role === "admin") {
          navigate("/admin/panel");
          return;
        }
      } catch (e) {
        await signOut(auth);
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [navigate]);

  const allowedPrograms = useMemo(() => {
    if (!role) return [];
    return PROGRAMS.filter((p) => p.rolesAllowed.includes(role));
  }, [role]);

  const isModuleEnabled = (moduleKey) => {
    if (!rolePerms) return true;
    return !!rolePerms[moduleKey];
  };

  const handleOpen = (p) => {
    if (!isModuleEnabled(p.moduleKey)) {
      showWarn(`${p.code} is currently disabled by the admin.`);
      return;
    }
    navigate(p.route);
  };

  const confirmLogout = async () => {
    setBusyLogout(true);
    try {
      await signOut(auth);
      navigate("/auth", { state: { msg: "Logged out successfully." } });
    } finally {
      setBusyLogout(false);
      setLogoutOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="ad-page">
        <div className="bg-layer" />
        <div className="grid-layer" />
        <div className="blob a" aria-hidden />
        <div className="blob b" aria-hidden />
        <div className="blob c" aria-hidden />

        <div className="ad-shell">
          <div className="ad-loading">Loading dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-page">
      <div className="bg-layer" />
      <div className="grid-layer" />
      <div className="blob a" aria-hidden />
      <div className="blob b" aria-hidden />
      <div className="blob c" aria-hidden />

      <div className="ad-shell">
        {/* Header */}
        <header className="ad-header">
          <div className="ad-brand">
            <div className="ad-logo">
              <img src={logo} alt="ANIMIS Logo" />
            </div>

            <div className="ad-brand-text">
              <div className="ad-kicker">ACCESS DASHBOARD</div>
              <div className="ad-sub">ANIMIS • Municipal Agriculturist Office of Naujan</div>

              <div className="ad-title-row">
                <h1 className="ad-title">Choose Program to Manage</h1>
              </div>
            </div>
          </div>

          <div className="ad-actions">
            <RoleBadge role={role} />

            {/* ✅ CHANGED: Home -> Settings */}
            <button className="ad-btn ghost" onClick={() => navigate("/settings")} type="button">
              Settings
            </button>

            {/* ✅ Logout now shows confirm modal */}
            <button className="ad-btn" onClick={() => setLogoutOpen(true)} type="button">
              Logout
            </button>
          </div>
        </header>

        {/* ✅ No hero background anymore */}
        <main className="ad-main">
          <div className="ad-plainLine">
            <div className="ad-plainStatus">
              Logged in • Status: <b className="ad-plainStrong">{status}</b>
            </div>
            <div className="ad-plainHelp">
              Select a program below. Your access is based on your assigned role.
            </div>
          </div>

          <section className="ad-cards">
            {allowedPrograms.map((p) => {
              const enabled = isModuleEnabled(p.moduleKey);

              return (
                <div key={p.id} className={`ad-card ${enabled ? "" : "disabled"}`}>
                  <div className="ad-card-top">
                    <div className="ad-icon">{p.icon}</div>
                    <div className="ad-card-head">
                      <div className="ad-code">{p.code}</div>
                      <h2 className="ad-card-title">{p.title}</h2>
                      <p className="ad-card-sub">{p.subtitle}</p>

                      {!enabled ? <div className="ad-disabledTag">Disabled by Admin</div> : null}
                    </div>
                  </div>

                  <ul className="ad-list">
                    {p.modules.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>

                  <div className="ad-card-foot">
                    <button
                      className={`ad-open ${enabled ? "" : "is-disabled"}`}
                      onClick={() => handleOpen(p)}
                      type="button"
                    >
                      Open Program →
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          <div className="ad-note">Tip: Program 4 “Records of All Programs” can become your consolidated reporting hub.</div>
        </main>

        <footer className="ad-footer">
          <div className="ad-footer-left">Municipal Agriculturist Office of Naujan • ANIMIS</div>
          <div className="ad-footer-right">v1.0 • Forest Theme</div>
        </footer>
      </div>

      {/* Warning toast */}
      {warn ? <div className="ad-warnToast">⚠️ {warn}</div> : null}

      {/* ✅ Logout confirm modal (Auth-glass style) */}
      <Modal
        open={logoutOpen}
        title="Confirm Logout"
        onClose={() => setLogoutOpen(false)}
        busy={busyLogout}
      >
        <div className="admCenter">
          <div className="admIcon">
            <LogOut size={22} />
          </div>

          <p className="admMsg">Are you sure you want to logout?</p>
          <p className="admHint">You’ll need to sign in again to access ANIMIS.</p>

          <div className="admActions">
            <button className="admBtn" onClick={() => setLogoutOpen(false)} disabled={busyLogout} type="button">
              Cancel
            </button>
            <button className="admBtn danger" onClick={confirmLogout} disabled={busyLogout} type="button">
              {busyLogout ? "Logging out…" : "Logout"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
