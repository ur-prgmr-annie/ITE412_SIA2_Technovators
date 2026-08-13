// src/pages/admin/AdminReports.jsx
import { useEffect, useMemo, useState } from "react";
import "../../styles/adminReports.css";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Package,
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  FileSpreadsheet,
  FileText,
  BarChart3,
  TrendingUp,
  Calendar,
  PawPrint,
  Syringe,
  AlertTriangle,
} from "lucide-react";

function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const header = keys.map(esc).join(",");
  const body = rows.map((r) => keys.map((k) => esc(r[k])).join(","));
  return [header, ...body].join("\n");
}

function downloadCSV(filename, rows) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AdminReports() {
  const [users, setUsers] = useState([]);
  const [p1, setP1] = useState([]);
  const [p2, setP2] = useState([]);
  const [p3, setP3] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        // Load all users
        const usersSnap = await getDocs(collection(db, "users"));
        const usersData = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(usersData);

        // Load recent users (latest 5)
        const recentQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
        const recentSnap = await getDocs(recentQuery);
        setRecentUsers(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Program data
        const p1Snap = await getDocs(collection(db, "program1_animals"));
        setP1(p1Snap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const p2Snap = await getDocs(collection(db, "program2_estrus"));
        setP2(p2Snap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const p3Snap = await getDocs(collection(db, "program3_cases"));
        setP3(p3Snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const admin = users.filter((u) => u.role === "admin").length;
    const field = users.filter((u) => u.role === "field_officer").length;
    const inventory = users.filter((u) => u.role === "inventory_officer").length;
    const active = users.filter((u) => u.status === "active").length;
    const pending = users.filter((u) => u.status === "pending").length;
    const rejected = users.filter((u) => u.status === "rejected").length;

    return {
      totalUsers,
      admin,
      field,
      inventory,
      active,
      pending,
      rejected,
    };
  }, [users]);

  const programStats = useMemo(() => ({
    program1: p1.length,
    program2: p2.length,
    program3: p3.length,
  }), [p1, p2, p3]);

  if (loading) {
    return (
      <div className="ar-page">
        <div className="ar-loading">
          <div className="ar-spinner"></div>
          <span>Loading reports…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ar-page">
      <div className="ar-header">
        <div className="ar-header-left">
          <div className="ar-header-icon">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1>Reports &amp; Analytics</h1>
            <p>System-wide statistics and data export tools</p>
          </div>
        </div>
        <div className="ar-header-right">
          <span className="ar-last-updated">
            <Calendar size={16} />
            Updated: {new Date().toLocaleString()}
          </span>
        </div>
      </div>

      {/* USER STATISTICS */}
      <section className="ar-section">
        <div className="ar-section-header">
          <h2>
            <Users size={20} /> User Overview
          </h2>
          <span className="ar-section-badge">{stats.totalUsers} total</span>
        </div>

        <div className="ar-stats-grid">
          <div className="ar-stat-card">
            <div className="ar-stat-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <ShieldCheck size={20} />
            </div>
            <div className="ar-stat-content">
              <div className="ar-stat-value">{stats.admin}</div>
              <div className="ar-stat-label">Administrators</div>
            </div>
          </div>

          <div className="ar-stat-card">
            <div className="ar-stat-icon" style={{ background: "#d1fae5", color: "#059669" }}>
              <UserCheck size={20} />
            </div>
            <div className="ar-stat-content">
              <div className="ar-stat-value">{stats.field}</div>
              <div className="ar-stat-label">Field Officers</div>
            </div>
          </div>

          <div className="ar-stat-card">
            <div className="ar-stat-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
              <Package size={20} />
            </div>
            <div className="ar-stat-content">
              <div className="ar-stat-value">{stats.inventory}</div>
              <div className="ar-stat-label">Inventory Officers</div>
            </div>
          </div>

          <div className="ar-stat-card">
            <div className="ar-stat-icon" style={{ background: "#e0e7ff", color: "#4f46e5" }}>
              <CheckCircle size={20} />
            </div>
            <div className="ar-stat-content">
              <div className="ar-stat-value">{stats.active}</div>
              <div className="ar-stat-label">Active Users</div>
            </div>
          </div>

          <div className="ar-stat-card">
            <div className="ar-stat-icon" style={{ background: "#fce4ec", color: "#d32f2f" }}>
              <Clock size={20} />
            </div>
            <div className="ar-stat-content">
              <div className="ar-stat-value">{stats.pending}</div>
              <div className="ar-stat-label">Pending</div>
            </div>
          </div>

          <div className="ar-stat-card">
            <div className="ar-stat-icon" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
              <XCircle size={20} />
            </div>
            <div className="ar-stat-content">
              <div className="ar-stat-value">{stats.rejected}</div>
              <div className="ar-stat-label">Rejected</div>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAM DATA SNAPSHOT */}
      <section className="ar-section">
        <div className="ar-section-header">
          <h2>
            <Activity size={20} /> Program Data
          </h2>
          <span className="ar-section-badge">Live counts</span>
        </div>

        <div className="ar-program-grid">
          <div className="ar-program-card">
            <div className="ar-program-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <PawPrint size={24} />
            </div>
            <div>
              <div className="ar-program-label">Program 1 – Animals</div>
              <div className="ar-program-value">{programStats.program1}</div>
            </div>
          </div>

          <div className="ar-program-card">
            <div className="ar-program-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
              <Syringe size={24} />
            </div>
            <div>
              <div className="ar-program-label">Program 2 – Breeding</div>
              <div className="ar-program-value">{programStats.program2}</div>
            </div>
          </div>

          <div className="ar-program-card">
            <div className="ar-program-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="ar-program-label">Program 3 – Cases</div>
              <div className="ar-program-value">{programStats.program3}</div>
            </div>
          </div>
        </div>
      </section>

      {/* RECENT USERS (optional) */}
      {recentUsers.length > 0 && (
        <section className="ar-section">
          <div className="ar-section-header">
            <h2>
              <Users size={20} /> Recent Users
            </h2>
            <span className="ar-section-badge">Last 5</span>
          </div>

          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.fullName || u.displayName || "—"}</strong>
                    </td>
                    <td>{u.email || "—"}</td>
                    <td>
                      <span className={`ar-role-badge ${u.role}`}>
                        {u.role || "user"}
                      </span>
                    </td>
                    <td>
                      <span className={`ar-status-badge ${u.status || "pending"}`}>
                        {u.status || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* EXPORT SECTION */}
      <section className="ar-section">
        <div className="ar-section-header">
          <h2>
            <Download size={20} /> Export Data
          </h2>
          <span className="ar-section-badge">CSV format</span>
        </div>

        <div className="ar-export-grid">
          <button
            className="ar-export-btn users"
            onClick={() => downloadCSV("users.csv", users)}
          >
            <FileSpreadsheet size={18} />
            <span>Export Users</span>
          </button>

          <button
            className="ar-export-btn program1"
            onClick={() => downloadCSV("program1_animals.csv", p1)}
          >
            <FileText size={18} />
            <span>Program 1 – Animals</span>
          </button>

          <button
            className="ar-export-btn program2"
            onClick={() => downloadCSV("program2_breeding.csv", p2)}
          >
            <FileText size={18} />
            <span>Program 2 – Breeding</span>
          </button>

          <button
            className="ar-export-btn program3"
            onClick={() => downloadCSV("program3_cases.csv", p3)}
          >
            <FileText size={18} />
            <span>Program 3 – Cases</span>
          </button>
        </div>
      </section>
    </div>
  );
}