// src/pages/admin/AdminSettings.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/adminSettings.css";
import {
  Settings,
  ShieldCheck,
  Save,
  RefreshCcw,
  Bell,
  Mail,
  Database,
  Lock,
  Globe,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Key,
  Clock,
  Users,
} from "lucide-react";

import {
  subscribeSystemSettings,
  saveSystemSettings,
  getDefaultSettings,
  subscribeSystemFlags,
  saveSystemFlags,
} from "../../services/adminSettingsService";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminSettings() {
  const defaults = useMemo(() => getDefaultSettings(), []);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [general, setGeneral] = useState(defaults.general);
  const [security, setSecurity] = useState(defaults.security);
  const [notifications, setNotifications] = useState(defaults.notifications);
  const [data, setData] = useState(defaults.data);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [flagsLoading, setFlagsLoading] = useState(true);

  const baselineRef = useRef(null);

  const showToast = (type, title, msg) => {
    setToast({ type, title, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!baselineRef.current) {
      baselineRef.current = {
        general: defaults.general,
        security: defaults.security,
        notifications: defaults.notifications,
        data: defaults.data,
        maintenanceMode: false,
      };
    }
  }, [defaults]);

  // Load settings
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeSystemSettings(
      (remote) => {
        try {
          const merged = {
            ...defaults,
            ...(remote || {}),
            general: { ...defaults.general, ...(remote?.general || {}) },
            security: { ...defaults.security, ...(remote?.security || {}) },
            notifications: { ...defaults.notifications, ...(remote?.notifications || {}) },
            data: { ...defaults.data, ...(remote?.data || {}) },
          };

          setGeneral(merged.general);
          setSecurity(merged.security);
          setNotifications(merged.notifications);
          setData(merged.data);

          baselineRef.current = {
            ...baselineRef.current,
            general: JSON.parse(JSON.stringify(merged.general)),
            security: JSON.parse(JSON.stringify(merged.security)),
            notifications: JSON.parse(JSON.stringify(merged.notifications)),
            data: JSON.parse(JSON.stringify(merged.data)),
          };

          setLoading(false);
        } catch (e) {
          console.error("SETTINGS SNAPSHOT ERROR:", e);
          setLoading(false);
          showToast("error", "Load failed", "Settings listener crashed.");
        }
      },
      (err) => {
        console.error("SETTINGS SNAPSHOT ERROR:", err);
        setLoading(false);
        showToast("error", "Load failed", "Could not load settings from database.");
      }
    );

    return () => unsub?.();
  }, [defaults]);

  // Load flags (maintenance mode)
  useEffect(() => {
    setFlagsLoading(true);
    const unsub = subscribeSystemFlags(
      (flags) => {
        const newMode = !!flags?.maintenanceMode;
        setMaintenanceMode(newMode);
        if (baselineRef.current) {
          baselineRef.current.maintenanceMode = newMode;
        }
        setFlagsLoading(false);
      },
      (err) => {
        console.error("FLAGS SNAPSHOT ERROR:", err);
        setFlagsLoading(false);
      }
    );

    return () => unsub?.();
  }, []);

  const normalized = useMemo(() => {
    const s = {
      general: {
        systemName: String(general.systemName || "").slice(0, 40),
        officeName: String(general.officeName || "").slice(0, 120),
        timezone: general.timezone || "Asia/Manila",
      },
      security: {
        require2FA: !!security.require2FA,
        passwordMinLength: clamp(safeNum(security.passwordMinLength, 8), 6, 24),
        sessionTimeoutMins: clamp(safeNum(security.sessionTimeoutMins, 60), 10, 480),
        allowWeakPasswords: !!security.allowWeakPasswords,
      },
      notifications: {
        emailEnabled: !!notifications.emailEnabled,
        inAppEnabled: !!notifications.inAppEnabled,
        lowStockAlerts: !!notifications.lowStockAlerts,
        coldChainAlerts: !!notifications.coldChainAlerts,
        diseaseAlerts: !!notifications.diseaseAlerts,
        dailyDigest: !!notifications.dailyDigest,
      },
      data: {
        auditLogging: !!data.auditLogging,
        autoBackup: !!data.autoBackup,
        backupFrequency: ["daily", "weekly", "monthly"].includes(data.backupFrequency)
          ? data.backupFrequency
          : "daily",
        retentionDays: clamp(safeNum(data.retentionDays, 90), 7, 3650),
      },
    };
    return s;
  }, [general, security, notifications, data]);

  const changed = useMemo(() => {
    if (!baselineRef.current) return false;
    const baselineStr = JSON.stringify({
      general: baselineRef.current.general,
      security: baselineRef.current.security,
      notifications: baselineRef.current.notifications,
      data: baselineRef.current.data,
      maintenanceMode: baselineRef.current.maintenanceMode ?? false,
    });
    const currentStr = JSON.stringify({
      general: normalized.general,
      security: normalized.security,
      notifications: normalized.notifications,
      data: normalized.data,
      maintenanceMode,
    });
    return baselineStr !== currentStr;
  }, [normalized, maintenanceMode]);

  const invalid = useMemo(() => {
    if (!normalized.general.systemName.trim()) return "System name is required.";
    if (!normalized.general.officeName.trim()) return "Office/organization is required.";
    if (normalized.security.passwordMinLength < 6) return "Password min length must be at least 6.";
    if (normalized.security.sessionTimeoutMins < 10) return "Session timeout must be at least 10 minutes.";
    if (normalized.data.retentionDays < 7) return "Retention must be at least 7 days.";
    return null;
  }, [normalized]);

  const handleSave = async () => {
    if (invalid) {
      showToast("error", "Invalid settings", invalid);
      return;
    }
    setSaving(true);
    try {
      await saveSystemSettings(normalized);
      await saveSystemFlags({ maintenanceMode });
      baselineRef.current = {
        general: JSON.parse(JSON.stringify(normalized.general)),
        security: JSON.parse(JSON.stringify(normalized.security)),
        notifications: JSON.parse(JSON.stringify(normalized.notifications)),
        data: JSON.parse(JSON.stringify(normalized.data)),
        maintenanceMode,
      };
      showToast("success", "Settings saved", "Your configuration was updated successfully.");
    } catch (e) {
      console.error("SAVE SETTINGS ERROR:", e);
      showToast("error", "Save failed", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!baselineRef.current) return;
    setGeneral(JSON.parse(JSON.stringify(baselineRef.current.general)));
    setSecurity(JSON.parse(JSON.stringify(baselineRef.current.security)));
    setNotifications(JSON.parse(JSON.stringify(baselineRef.current.notifications)));
    setData(JSON.parse(JSON.stringify(baselineRef.current.data)));
    setMaintenanceMode(baselineRef.current.maintenanceMode ?? false);
    showToast("info", "Reset done", "Settings reverted to last saved state.");
  };

  const handleExport = () => {
    const exportPayload = { ...normalized, flags: { maintenanceMode } };
    downloadJson(`ANIMIS-system-settings-${new Date().toISOString().slice(0, 10)}.json`, exportPayload);
    showToast("success", "Export created", "Settings JSON has been downloaded.");
  };

  const handleRunBackup = () => {
    const backup = {
      kind: "ANIMIS_SETTINGS_BACKUP",
      createdAt: new Date().toISOString(),
      payload: { ...normalized, flags: { maintenanceMode } },
    };
    downloadJson(`ANIMIS-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, backup);
    showToast("success", "Backup created", "Backup JSON has been downloaded.");
  };

  return (
    <div className="as-page">
      {/* Header */}
      <div className="as-header">
        <div className="as-header-left">
          <div className="as-header-icon">
            <Settings size={28} />
          </div>
          <div>
            <h1>System Settings</h1>
            <p>Configure ANIMIS behavior, security policies, notifications, and data retention.</p>
          </div>
        </div>
        <div className="as-header-right">
          <button
            className="as-btn ghost"
            type="button"
            onClick={handleReset}
            disabled={loading || saving || flagsLoading}
          >
            <RefreshCcw size={16} /> Reset
          </button>
          <button
            className="as-btn primary"
            type="button"
            onClick={handleSave}
            disabled={loading || saving || flagsLoading || !!invalid}
            title={invalid || ""}
          >
            <Save size={16} /> {saving ? "Saving…" : loading || flagsLoading ? "Loading…" : "Save Settings"}
          </button>
        </div>
      </div>

      {invalid && (
        <div className="as-invalid-banner">
          <AlertTriangle size={18} />
          <span>{invalid}</span>
        </div>
      )}

      <div className="as-grid">
        {/* General */}
        <section className="as-card">
          <div className="as-card-head">
            <div className="as-card-title">
              <Globe size={18} /> General
            </div>
            <div className="as-chip ok">
              <ShieldCheck size={14} /> Admin
            </div>
          </div>

          <div className="as-form">
            <div className="as-field">
              <label>System Name</label>
              <input
                value={general.systemName}
                onChange={(e) => setGeneral((p) => ({ ...p, systemName: e.target.value }))}
                placeholder="ANIMIS"
                disabled={loading || saving || flagsLoading}
              />
            </div>

            <div className="as-field">
              <label>Office / Organization</label>
              <input
                value={general.officeName}
                onChange={(e) => setGeneral((p) => ({ ...p, officeName: e.target.value }))}
                placeholder="Municipal Agriculturist Office • Naujan"
                disabled={loading || saving || flagsLoading}
              />
            </div>

            <div className="as-field">
              <label>Timezone</label>
              <select
                value={general.timezone}
                onChange={(e) => setGeneral((p) => ({ ...p, timezone: e.target.value }))}
                disabled={loading || saving || flagsLoading}
              >
                <option value="Asia/Manila">Asia/Manila</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
            </div>

            <div className="as-toggle-row">
              <div className="as-toggle-label">
                <div className="as-toggle-title">Maintenance Mode</div>
                <div className="as-toggle-hint">Restrict access for non‑admin users.</div>
              </div>
              <button
                className={`as-switch ${maintenanceMode ? "on" : ""}`}
                type="button"
                onClick={() => setMaintenanceMode((v) => !v)}
                aria-label="Toggle maintenance mode"
                disabled={loading || saving || flagsLoading}
              >
                <span className="knob" />
              </button>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="as-card">
          <div className="as-card-head">
            <div className="as-card-title">
              <Lock size={18} /> Security & Access
            </div>
            <div className="as-chip neutral">Policy</div>
          </div>

          <div className="as-form">
            <div className="as-toggle-row">
              <div className="as-toggle-label">
                <div className="as-toggle-title">Require 2FA (future)</div>
                <div className="as-toggle-hint">Enable extra verification for admin users.</div>
              </div>
              <button
                className={`as-switch ${security.require2FA ? "on" : ""}`}
                type="button"
                onClick={() => setSecurity((p) => ({ ...p, require2FA: !p.require2FA }))}
                disabled={loading || saving || flagsLoading}
              >
                <span className="knob" />
              </button>
            </div>

            <div className="as-row2">
              <div className="as-field">
                <label>Password Min Length</label>
                <input
                  type="number"
                  min={6}
                  max={24}
                  value={security.passwordMinLength}
                  onChange={(e) =>
                    setSecurity((p) => ({ ...p, passwordMinLength: safeNum(e.target.value, 8) }))
                  }
                  disabled={loading || saving || flagsLoading}
                />
              </div>
              <div className="as-field">
                <label>Session Timeout (mins)</label>
                <input
                  type="number"
                  min={10}
                  max={480}
                  value={security.sessionTimeoutMins}
                  onChange={(e) =>
                    setSecurity((p) => ({ ...p, sessionTimeoutMins: safeNum(e.target.value, 60) }))
                  }
                  disabled={loading || saving || flagsLoading}
                />
              </div>
            </div>

            <div className="as-toggle-row">
              <div className="as-toggle-label">
                <div className="as-toggle-title">Allow weak passwords</div>
                <div className="as-toggle-hint">Not recommended. Keep OFF for production.</div>
              </div>
              <button
                className={`as-switch ${security.allowWeakPasswords ? "on" : ""}`}
                type="button"
                onClick={() => setSecurity((p) => ({ ...p, allowWeakPasswords: !p.allowWeakPasswords }))}
                disabled={loading || saving || flagsLoading}
              >
                <span className="knob" />
              </button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="as-card">
          <div className="as-card-head">
            <div className="as-card-title">
              <Bell size={18} /> Notifications
            </div>
            <div className="as-chip ok">
              <Mail size={14} /> Alerts
            </div>
          </div>

          <div className="as-form">
            {[
              ["Email notifications", "Send alerts via email.", "emailEnabled"],
              ["In‑app notifications", "Show alerts inside ANIMIS.", "inAppEnabled"],
              ["Low stock alerts", "Notify when inventory falls below reorder level.", "lowStockAlerts"],
              ["Cold chain alerts", "Notify on temperature threshold / offline units.", "coldChainAlerts"],
              ["Disease alerts", "Notify on confirmed cases / hotspots.", "diseaseAlerts"],
              ["Daily digest", "Send a daily summary to admins.", "dailyDigest"],
            ].map(([title, hint, key]) => (
              <div className="as-toggle-row" key={key}>
                <div className="as-toggle-label">
                  <div className="as-toggle-title">{title}</div>
                  <div className="as-toggle-hint">{hint}</div>
                </div>
                <button
                  className={`as-switch ${notifications[key] ? "on" : ""}`}
                  type="button"
                  onClick={() => setNotifications((p) => ({ ...p, [key]: !p[key] }))}
                  disabled={loading || saving || flagsLoading}
                >
                  <span className="knob" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Data & Audit */}
        <section className="as-card">
          <div className="as-card-head">
            <div className="as-card-title">
              <Database size={18} /> Data, Audit &amp; Backups
            </div>
            <div className="as-chip warn">Retention</div>
          </div>

          <div className="as-form">
            <div className="as-toggle-row">
              <div className="as-toggle-label">
                <div className="as-toggle-title">Audit logging</div>
                <div className="as-toggle-hint">Track admin actions for accountability.</div>
              </div>
              <button
                className={`as-switch ${data.auditLogging ? "on" : ""}`}
                type="button"
                onClick={() => setData((p) => ({ ...p, auditLogging: !p.auditLogging }))}
                disabled={loading || saving || flagsLoading}
              >
                <span className="knob" />
              </button>
            </div>

            <div className="as-toggle-row">
              <div className="as-toggle-label">
                <div className="as-toggle-title">Automatic backups</div>
                <div className="as-toggle-hint">Controls whether “Run Backup” is available.</div>
              </div>
              <button
                className={`as-switch ${data.autoBackup ? "on" : ""}`}
                type="button"
                onClick={() => setData((p) => ({ ...p, autoBackup: !p.autoBackup }))}
                disabled={loading || saving || flagsLoading}
              >
                <span className="knob" />
              </button>
            </div>

            <div className="as-row2">
              <div className="as-field">
                <label>Backup Frequency</label>
                <select
                  value={data.backupFrequency}
                  onChange={(e) => setData((p) => ({ ...p, backupFrequency: e.target.value }))}
                  disabled={loading || saving || flagsLoading || !data.autoBackup}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="as-field">
                <label>Retention (days)</label>
                <input
                  type="number"
                  min={7}
                  max={3650}
                  value={data.retentionDays}
                  onChange={(e) => setData((p) => ({ ...p, retentionDays: safeNum(e.target.value, 90) }))}
                  disabled={loading || saving || flagsLoading}
                />
              </div>
            </div>

            <div className="as-actions-row">
              <button className="as-btn ghost" type="button" onClick={handleExport} disabled={loading || saving || flagsLoading}>
                <FileDown size={16} /> Export Data
              </button>
              <button
                className="as-btn primary"
                type="button"
                onClick={handleRunBackup}
                disabled={loading || saving || flagsLoading || !data.autoBackup}
              >
                <Save size={16} /> Run Backup
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`as-toast ${toast.type}`}>
          <div className="as-toast-icon">
            {toast.type === "success" ? (
              <CheckCircle2 size={20} />
            ) : toast.type === "error" ? (
              <AlertTriangle size={20} />
            ) : (
              <Info size={20} />
            )}
          </div>
          <div className="as-toast-body">
            <div className="as-toast-title">{toast.title}</div>
            <div className="as-toast-msg">{toast.msg}</div>
          </div>
          <button className="as-toast-close" onClick={() => setToast(null)} aria-label="Close toast">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}