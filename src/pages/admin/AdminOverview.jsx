// src/pages/admin/AdminOverview.jsx
import { useEffect, useMemo, useState } from "react";
import "../../styles/adminOverview.css";
import {
  Users,
  Shield,
  BarChart3,
  ThermometerSnowflake,
  CheckCircle2,
  AlertTriangle,
  Activity,
  LayoutGrid,
  Clock,
  UserCheck,
  Database,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { subscribeAdminKpis } from "../../services/adminOverviewService";
import { collection, onSnapshot, query, where, limit, orderBy } from "firebase/firestore";
import { db } from "../../services/firebase";

export default function AdminOverview() {
  const navigate = useNavigate();

  const [kpis, setKpis] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    reportsGenerated: 0,
    lowStockItems: 0,
    coldChainAlerts: 0,
    systemStatus: "online",
    roleAdmin: 0,
    roleField: 0,
    roleInventory: 0,
  });

  const [pendingPreview, setPendingPreview] = useState([]);
  const [pendingErr, setPendingErr] = useState("");

  useEffect(() => {
    const unsub = subscribeAdminKpis(
      (live) => setKpis((p) => ({ ...p, ...live })),
      (err) => {
        console.error("ADMIN OVERVIEW KPI ERROR:", err);
        setKpis((p) => ({ ...p, systemStatus: "offline" }));
      }
    );
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const qy = query(
      collection(db, "users"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(6)
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setPendingErr("");
        setPendingPreview(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (err) => {
        console.error("PENDING PREVIEW ERROR:", err);
        setPendingErr(err?.message || "Failed to load pending approvals.");
        setPendingPreview([]);
      }
    );
    return () => unsub?.();
  }, []);

  const alerts = useMemo(() => {
    const list = [];
    if (kpis.pendingUsers > 0) {
      list.push({
        tone: "warn",
        title: "Pending approvals",
        sub: `${kpis.pendingUsers} request(s) waiting for admin approval.`,
      });
    } else {
      list.push({
        tone: "ok",
        title: "Pending approvals",
        sub: "No pending requests right now.",
      });
    }
    if (kpis.lowStockItems > 0) {
      list.push({
        tone: "warn",
        title: "Low stock items",
        sub: `${kpis.lowStockItems} inventory item(s) reached reorder threshold.`,
      });
    } else {
      list.push({
        tone: "ok",
        title: "Low stock items",
        sub: "No low stock warnings detected.",
      });
    }
    if (kpis.coldChainAlerts > 0) {
      list.push({
        tone: "bad",
        title: "Cold chain alerts",
        sub: `${kpis.coldChainAlerts} alert(s) detected from monitoring units.`,
      });
    } else {
      list.push({
        tone: "ok",
        title: "Cold chain alerts",
        sub: "Cold chain status normal.",
      });
    }
    return list;
  }, [kpis.pendingUsers, kpis.lowStockItems, kpis.coldChainAlerts]);

  return (
    <div className="ao-page">
      {/* Header */}
      <div className="ao-header">
        <div className="ao-header-left">
          <div className="ao-header-icon">
            <LayoutGrid size={28} />
          </div>
          <div>
            <h1>Admin Dashboard</h1>
            <p>View real system status, pending approvals, and user access distribution.</p>
          </div>
        </div>
        <div className="ao-header-right">
          <button
            className="ao-btn ghost"
            onClick={() => navigate("/dashboard")}
            type="button"
          >
            <Activity size={16} /> Back to Programs
          </button>
          <button
            className="ao-btn primary"
            onClick={() => navigate("/admin/panel/users")}
            type="button"
          >
            <Users size={16} /> Manage Users
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="ao-kpis">
        <div className="ao-kpi">
          <div className="ao-kpi-top">
            <span className="ao-kpi-icon">
              <Users size={16} />
            </span>
            <span className="ao-kpi-label">Total Users</span>
          </div>
          <div className="ao-kpi-value">{kpis.totalUsers}</div>
          <div className="ao-kpi-meta">
            <span className="ao-pill ok">{kpis.activeUsers} active</span>
            <span className="ao-pill warn">{kpis.pendingUsers} pending</span>
            <span className="ao-pill neutral">{kpis.disabledUsers} disabled</span>
          </div>
        </div>

        <div className="ao-kpi">
          <div className="ao-kpi-top">
            <span className="ao-kpi-icon">
              <Shield size={16} />
            </span>
            <span className="ao-kpi-label">Roles</span>
          </div>
          <div className="ao-kpi-value">3</div>
          <div className="ao-kpi-meta">
            <span className="ao-pill ok">admin ({kpis.roleAdmin})</span>
            <span className="ao-pill neutral">field ({kpis.roleField})</span>
            <span className="ao-pill neutral">inventory ({kpis.roleInventory})</span>
          </div>
        </div>

        <div className="ao-kpi">
          <div className="ao-kpi-top">
            <span className="ao-kpi-icon">
              <BarChart3 size={16} />
            </span>
            <span className="ao-kpi-label">Reports</span>
          </div>
          <div className="ao-kpi-value">{kpis.reportsGenerated}</div>
          <div className="ao-kpi-meta">
            <span className="ao-pill ok">ready</span>
            <span className="ao-muted">• wire later</span>
          </div>
        </div>

        <div className="ao-kpi">
          <div className="ao-kpi-top">
            <span className="ao-kpi-icon">
              <ThermometerSnowflake size={16} />
            </span>
            <span className="ao-kpi-label">Monitoring</span>
          </div>
          <div className="ao-kpi-value">{kpis.coldChainAlerts + kpis.lowStockItems}</div>
          <div className="ao-kpi-meta">
            <span className={`ao-pill ${kpis.coldChainAlerts ? "bad" : "ok"}`}>
              {kpis.coldChainAlerts ? "cold chain alerts" : "cold chain ok"}
            </span>
            <span className="ao-pill neutral">•</span>
            <span className={`ao-pill ${kpis.lowStockItems ? "warn" : "ok"}`}>
              {kpis.lowStockItems ? "inventory low" : "inventory ok"}
            </span>
          </div>
        </div>
      </div>

      {/* Two‑column content */}
      <div className="ao-grid">
        {/* Pending Approvals */}
        <div className="ao-card">
          <div className="ao-card-head">
            <div className="ao-card-title">
              <Users size={18} /> Pending Approvals
            </div>
            <button
              className="ao-link"
              onClick={() => navigate("/admin/panel/users")}
              type="button"
            >
              Open user manager →
            </button>
          </div>

          {pendingErr ? (
            <div className="ao-note" style={{ marginTop: 10 }}>
              ⚠ {pendingErr}
            </div>
          ) : pendingPreview.length === 0 ? (
            <div className="ao-note" style={{ marginTop: 10 }}>
              No pending requests 🎉
            </div>
          ) : (
            <div className="ao-feed">
              {pendingPreview.map((u) => (
                <div
                  key={u.id}
                  className="ao-feed-item warn"
                  onClick={() => navigate("/admin/panel/users")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="ao-feed-item-left">
                    <div className="ao-feed-item-title">
                      <AlertTriangle size={16} />
                      <span>{u.fullName || "Unnamed User"}</span>
                    </div>
                    <div className="ao-feed-item-sub">{u.email || "No email"}</div>
                  </div>
                  <div className="ao-feed-item-date">Pending</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Alerts */}
        <div className="ao-card">
          <div className="ao-card-head">
            <div className="ao-card-title">
              <Activity size={18} /> System Alerts
            </div>
            <button
              className="ao-link"
              onClick={() => navigate("/admin/panel/ops")}
              type="button"
            >
              View monitoring →
            </button>
          </div>

          <div className="ao-feed">
            {alerts.map((a, idx) => (
              <div key={idx} className={`ao-feed-item ${a.tone}`}>
                <div className="ao-feed-item-left">
                  <div className="ao-feed-item-title">
                    {a.tone === "ok" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                    <span>{a.title}</span>
                  </div>
                  <div className="ao-feed-item-sub">{a.sub}</div>
                </div>
                <div className="ao-feed-item-date">Today</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ao-note">
        Tip: Approve pending users in “Users & Roles” and assign correct role access.
      </div>
    </div>
  );
}