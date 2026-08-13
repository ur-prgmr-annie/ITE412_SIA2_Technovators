// src/pages/admin/AdminRoles.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/adminRoles.css";
import {
  Shield,
  Save,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Lock,
  Users,
  Settings,
  Database,
  FileText,
  UserCog,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  ROLES,
  MODULES,
  getDefaultRolePermissions,
  ensureRoleDoc,
  subscribeRolePermissions,
  saveRolePermissions,
} from "../../services/adminRolesService";

const deepClone = (obj) => JSON.parse(JSON.stringify(obj || {}));

export default function AdminRoles() {
  const defaults = useMemo(() => getDefaultRolePermissions(), []);
  const [activeRole, setActiveRole] = useState("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");

  // local editable permissions
  const [permissions, setPermissions] = useState(defaults[activeRole]);

  // baseline for "changed" detection
  const baselineRef = useRef(null);

  const showToast = (type, title, msg) => {
    setToast({ type, title, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3000);
  };

  // load role permissions realtime
  useEffect(() => {
    let unsub;

    (async () => {
      setLoading(true);
      try {
        await ensureRoleDoc(activeRole);

        unsub = subscribeRolePermissions(
          activeRole,
          (remote) => {
            const remotePerm = remote?.permissions || {};
            const merged = {
              ...(defaults[activeRole] || {}),
              ...remotePerm,
            };

            setPermissions(merged);
            baselineRef.current = deepClone(merged);
            setLoading(false);
          },
          (err) => {
            console.error("LOAD ROLES ERROR:", err);
            setLoading(false);
            showToast("error", "Load failed", err?.message || "Missing or insufficient permissions.");
          }
        );
      } catch (e) {
        console.error("ROLE INIT ERROR:", e);
        setLoading(false);
        showToast("error", "Load failed", e?.message || "Missing or insufficient permissions.");
      }
    })();

    return () => unsub?.();
  }, [activeRole, defaults]);

  const changed = useMemo(() => {
    if (!baselineRef.current) return false;
    return JSON.stringify(permissions) !== JSON.stringify(baselineRef.current);
  }, [permissions]);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MODULES;

    return MODULES.map((g) => {
      const items = g.items.filter(
        (it) => it.label.toLowerCase().includes(q) || it.key.toLowerCase().includes(q)
      );
      return { ...g, items };
    }).filter((g) => g.items.length > 0);
  }, [search]);

  const togglePerm = (key) => {
    setPermissions((p) => ({ ...p, [key]: !p?.[key] }));
  };

  const setAllInGroup = (groupItems, value) => {
    setPermissions((p) => {
      const next = { ...p };
      groupItems.forEach((it) => {
        next[it.key] = value;
      });
      return next;
    });
  };

  const handleReset = () => {
    const base = defaults[activeRole] || {};
    setPermissions(deepClone(base));
    showToast("info", "Reset", "Defaults restored (not saved yet).");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRolePermissions(activeRole, permissions);
      baselineRef.current = deepClone(permissions);
      showToast("success", "Saved", "Role permissions updated.");
    } catch (e) {
      console.error("SAVE ROLE ERROR:", e);
      showToast("error", "Save failed", e?.message || "Missing or insufficient permissions.");
    } finally {
      setSaving(false);
    }
  };

  // Helper icon for role
  const getRoleIcon = (roleId) => {
    switch (roleId) {
      case "admin":
        return <Shield size={18} />;
      case "field_officer":
        return <Users size={18} />;
      case "inventory_officer":
        return <Database size={18} />;
      default:
        return <UserCog size={18} />;
    }
  };

  return (
    <div className="ar-role-page">
      {/* Header */}
      <div className="ar-role-header">
        <div className="ar-role-header-left">
          <div className="ar-role-header-icon">
            <Key size={28} />
          </div>
          <div>
            <h1>Role Permissions</h1>
            <p>Configure which modules each role can access. (Admin‑only)</p>
          </div>
        </div>
        <div className="ar-role-header-right">
          <button
            className="ar-role-btn ghost"
            type="button"
            onClick={handleReset}
            disabled={loading || saving}
          >
            <RefreshCcw size={16} /> Reset
          </button>
          <button
            className="ar-role-btn primary"
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !changed}
            title={!changed ? "No changes to save" : ""}
          >
            <Save size={16} /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="ar-role-grid">
        {/* Left: role selector */}
        <aside className="ar-role-side">
          <div className="ar-role-side-card">
            <div className="ar-role-side-title">
              <Users size={18} /> Roles
            </div>

            <div className="ar-role-list">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  className={`ar-role-btn ${activeRole === r.id ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveRole(r.id)}
                  disabled={loading || saving}
                >
                  <span className="ar-role-dot" />
                  <span className="ar-role-name">{getRoleIcon(r.id)} {r.label}</span>
                  <span className="ar-role-id">{r.id}</span>
                </button>
              ))}
            </div>

            <div className="ar-role-hint">
              <Lock size={14} />
              <span>Only admins can edit role permissions.</span>
            </div>
          </div>
        </aside>

        {/* Right: permissions */}
        <section className="ar-role-main">
          <div className="ar-role-card">
            <div className="ar-role-card-top">
              <div>
                <div className="ar-role-card-title">
                  Editing:{" "}
                  <span className="ar-role-badge">
                    {ROLES.find((r) => r.id === activeRole)?.label || activeRole}
                  </span>
                </div>
                <div className="ar-role-card-sub">
                  Toggle access per module. Use search to find permissions quickly.
                </div>
              </div>

              <div className="ar-role-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search module…"
                  disabled={loading}
                />
              </div>
            </div>

            {loading ? (
              <div className="ar-role-loading">
                <div className="ar-role-spinner" />
                <span>Loading permissions…</span>
              </div>
            ) : (
              <div className="ar-role-groups">
                {filteredModules.map((g) => {
                  const allOn = g.items.every((it) => !!permissions?.[it.key]);
                  const allOff = g.items.every((it) => !permissions?.[it.key]);

                  return (
                    <div className="ar-role-group" key={g.group}>
                      <div className="ar-role-group-head">
                        <div className="ar-role-group-title">
                          <FileText size={16} />
                          <span>{g.group}</span>
                        </div>

                        <div className="ar-role-group-actions">
                          <button
                            className="ar-role-mini enable"
                            type="button"
                            onClick={() => setAllInGroup(g.items, true)}
                            disabled={saving || allOn}
                            title="Enable all"
                          >
                            Enable all
                          </button>
                          <button
                            className="ar-role-mini disable"
                            type="button"
                            onClick={() => setAllInGroup(g.items, false)}
                            disabled={saving || allOff}
                            title="Disable all"
                          >
                            Disable all
                          </button>
                        </div>
                      </div>

                      <div className="ar-role-items">
                        {g.items.map((it) => (
                          <div className="ar-role-item" key={it.key}>
                            <div className="ar-role-item-info">
                              <div className="ar-role-item-label">{it.label}</div>
                              <div className="ar-role-item-key">{it.key}</div>
                            </div>

                            <button
                              className={`ar-role-switch ${permissions?.[it.key] ? "on" : ""}`}
                              type="button"
                              onClick={() => togglePerm(it.key)}
                              disabled={saving}
                              aria-label={`Toggle ${it.label}`}
                            >
                              <span className="ar-role-knob" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {filteredModules.length === 0 && (
                  <div className="ar-role-empty">
                    <EyeOff size={24} />
                    <p>No modules match your search.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`ar-role-toast ${toast.type}`}>
          <div className="ar-role-toast-icon">
            {toast.type === "success" ? (
              <CheckCircle2 size={20} />
            ) : toast.type === "error" ? (
              <AlertTriangle size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
          </div>
          <div className="ar-role-toast-body">
            <div className="ar-role-toast-title">{toast.title}</div>
            <div className="ar-role-toast-msg">{toast.msg}</div>
          </div>
          <button
            className="ar-role-toast-close"
            onClick={() => setToast(null)}
            aria-label="Close toast"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}