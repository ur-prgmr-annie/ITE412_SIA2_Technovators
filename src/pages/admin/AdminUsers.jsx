// src/pages/admin/AdminUsers.jsx
import { useEffect, useMemo, useState } from "react";
import "../../styles/adminUsers.css";

import {
  fetchPendingUsers,
  approveUser,
  rejectUser,
  fetchAllUsers,
  updateUserAdmin,
  deleteUserAdmin,
} from "../../services/adminService";

import { logout } from "../../services/authService";

import {
  Users,
  UserCheck,
  UserX,
  Shield,
  UserCog,
  Database,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  LogOut,
  UserPlus,
  XCircle,
} from "lucide-react";

const roleLabel = (r) =>
  r === "admin" ? "Admin" : r === "inventory_officer" ? "Inventory Officer" : "Field Officer";

const statusLabel = (s) =>
  s === "active" ? "Active" : s === "pending" ? "Pending" : "Inactive";

export default function AdminUsers() {
  const [tab, setTab] = useState("pending"); // "pending" | "all"

  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);

  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [message, setMessage] = useState("");
  const [roleSelect, setRoleSelect] = useState({}); // for pending approve dropdown

  const [edit, setEdit] = useState({}); // { [uid]: { role, status } }
  const [savingId, setSavingId] = useState(null);

  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const data = await fetchPendingUsers();
      setPending(Array.isArray(data) ? data : []);
    } finally {
      setLoadingPending(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await fetchAllUsers();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);

      const next = {};
      list.forEach((u) => {
        next[u.id] = {
          role: u.role || "field_officer",
          status: u.status || "active",
        };
      });
      setEdit(next);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadPending();
    loadUsers();
  }, []);

  const counters = useMemo(() => {
    const base = {
      total: users.length,
      role: { admin: 0, field_officer: 0, inventory_officer: 0 },
      status: { active: 0, pending: 0, inactive: 0 },
    };

    users.forEach((u) => {
      const r = (u.role || "field_officer").toLowerCase();
      const s = (u.status || "inactive").toLowerCase();

      if (base.role[r] !== undefined) base.role[r] += 1;
      if (base.status[s] !== undefined) base.status[s] += 1;
    });

    return base;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = q.trim().toLowerCase();

    return users.filter((u) => {
      const r = (u.role || "").toLowerCase();
      const s = (u.status || "").toLowerCase();
      const name = (u.fullName || "").toLowerCase();
      const email = (u.email || "").toLowerCase();

      if (filterRole !== "all" && r !== filterRole) return false;
      if (filterStatus !== "all" && s !== filterStatus) return false;

      if (!query) return true;
      return name.includes(query) || email.includes(query) || u.id?.toLowerCase()?.includes(query);
    });
  }, [users, q, filterRole, filterStatus]);

  const handleApprove = async (user) => {
    const role = roleSelect[user.id] || "field_officer";
    await approveUser(user.id, role);
    setMessage(`Approved ${user.fullName} as ${role.replaceAll("_", " ")}`);
    await loadPending();
    await loadUsers();
  };

  const handleReject = async (user) => {
    await rejectUser(user.id);
    setMessage(`Rejected ${user.fullName}`);
    await loadPending();
    await loadUsers();
  };

  const setEditField = (uid, key, value) => {
    setEdit((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [key]: value },
    }));
  };

  const handleSaveUser = async (u) => {
    const uid = u.id;
    const payload = edit[uid];
    if (!payload) return;

    setSavingId(uid);
    try {
      await updateUserAdmin(uid, {
        role: payload.role,
        status: payload.status,
      });

      setMessage(`Updated ${u.fullName || u.email || uid}`);
      await loadUsers();
    } catch (e) {
      console.error(e);
      setMessage(`Failed to update ${u.fullName || uid}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (u) => {
    const ok = window.confirm(
      `Delete user profile?\n\n${u.fullName || "Unnamed"}\n${u.email || ""}\n\nThis will delete the Firestore /users doc only.`
    );
    if (!ok) return;

    setSavingId(u.id);
    try {
      await deleteUserAdmin(u.id);
      setMessage(`Deleted ${u.fullName || u.email || u.id}`);
      await loadUsers();
    } catch (e) {
      console.error(e);
      setMessage(`Failed to delete ${u.fullName || u.id}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="au-page">
      {/* Header */}
      <div className="au-header">
        <div className="au-header-left">
          <div className="au-header-icon">
            <Users size={28} />
          </div>
          <div>
            <h1>Users & Roles</h1>
            <p>Approve requests, manage roles, activate/disable accounts, and monitor role totals.</p>
          </div>
        </div>
        <div className="au-header-right">
          <button className="au-btn-logout" onClick={logout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Counters */}
      <div className="au-counters">
        <div className="au-chip">
          <Users size={16} />
          <span>Total</span>
          <b>{counters.total}</b>
        </div>
        <div className="au-chip admin">
          <Shield size={16} />
          <span>Admin</span>
          <b>{counters.role.admin}</b>
        </div>
        <div className="au-chip field">
          <UserCheck size={16} />
          <span>Field</span>
          <b>{counters.role.field_officer}</b>
        </div>
        <div className="au-chip inventory">
          <Database size={16} />
          <span>Inventory</span>
          <b>{counters.role.inventory_officer}</b>
        </div>
        <div className="au-chip active">
          <CheckCircle size={16} />
          <span>Active</span>
          <b>{counters.status.active}</b>
        </div>
        <div className="au-chip pending">
          <Clock size={16} />
          <span>Pending</span>
          <b>{counters.status.pending}</b>
        </div>
        <div className="au-chip inactive">
          <XCircle size={16} />
          <span>Inactive</span>
          <b>{counters.status.inactive}</b>
        </div>
      </div>

      {/* Tabs */}
      <div className="au-tabs">
        <button
          className={`au-tab ${tab === "pending" ? "active" : ""}`}
          onClick={() => setTab("pending")}
          type="button"
        >
          <UserPlus size={16} />
          Pending Requests ({pending.length})
        </button>
        <button
          className={`au-tab ${tab === "all" ? "active" : ""}`}
          onClick={() => setTab("all")}
          type="button"
        >
          <Users size={16} />
          All Users ({users.length})
        </button>
      </div>

      {message && <div className="au-message">{message}</div>}

      {/* ======================= PENDING REQUESTS ======================= */}
      {tab === "pending" && (
        <>
          {loadingPending ? (
            <div className="au-loading">
              <div className="au-spinner" />
              <span>Loading pending requests…</span>
            </div>
          ) : pending.length === 0 ? (
            <div className="au-empty">
              <CheckCircle size={40} />
              <p>No pending requests 🎉</p>
            </div>
          ) : (
            <div className="au-pending-grid">
              {pending.map((user) => (
                <div key={user.id} className="au-pending-card">
                  <div className="au-pending-top">
                    <h3>{user.fullName || "Unnamed User"}</h3>
                    <span className="au-pill pending">Pending</span>
                  </div>
                  <p className="au-pending-email">{user.email || "No email"}</p>

                  <div className="au-pending-controls">
                    <select
                      className="au-select"
                      value={roleSelect[user.id] || "field_officer"}
                      onChange={(e) =>
                        setRoleSelect((prev) => ({
                          ...prev,
                          [user.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="field_officer">Field Officer</option>
                      <option value="inventory_officer">Inventory Officer</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button className="au-btn-approve" onClick={() => handleApprove(user)}>
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button className="au-btn-reject" onClick={() => handleReject(user)}>
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================= ALL USERS ======================= */}
      {tab === "all" && (
        <div className="au-all-wrap">
          <div className="au-toolbar">
            <div className="au-search">
              <Search size={16} />
              <input
                placeholder="Search name, email, or UID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <select className="au-filter" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="field_officer">Field Officer</option>
              <option value="inventory_officer">Inventory Officer</option>
            </select>

            <select className="au-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>

            <button className="au-btn-refresh" type="button" onClick={loadUsers}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loadingUsers ? (
            <div className="au-loading">
              <div className="au-spinner" />
              <span>Loading users…</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="au-empty">
              <Search size={40} />
              <p>No users matched your filters.</p>
            </div>
          ) : (
            <div className="au-table">
              <div className="au-thead">
                <div>User</div>
                <div>Role</div>
                <div>Status</div>
                <div>Actions</div>
              </div>

              {filteredUsers.map((u) => {
                const current = edit[u.id] || { role: u.role, status: u.status };
                const isSaving = savingId === u.id;

                return (
                  <div className="au-tr" key={u.id}>
                    <div className="au-user">
                      <div className="au-name">{u.fullName || "Unnamed User"}</div>
                      <div className="au-subline">
                        <span>{u.email || "No email"}</span>
                        <span className="au-dot">•</span>
                        <span className="au-uid">{u.id}</span>
                      </div>
                    </div>

                    <div>
                      <select
                        className="au-select"
                        value={current.role || "field_officer"}
                        onChange={(e) => setEditField(u.id, "role", e.target.value)}
                        disabled={isSaving}
                      >
                        <option value="admin">Admin</option>
                        <option value="field_officer">Field Officer</option>
                        <option value="inventory_officer">Inventory Officer</option>
                      </select>
                    </div>

                    <div>
                      <select
                        className="au-select"
                        value={current.status || "inactive"}
                        onChange={(e) => setEditField(u.id, "status", e.target.value)}
                        disabled={isSaving}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="au-actions">
                      <button className="au-btn-save" onClick={() => handleSaveUser(u)} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button className="au-btn-delete" onClick={() => handleDeleteUser(u)} disabled={isSaving}>
                        Delete
                      </button>
                    </div>

                    <div className="au-badges">
                      <span className={`au-pill ${String(u.role || "").toLowerCase()}`}>
                        {roleLabel(String(u.role || "field_officer").toLowerCase())}
                      </span>
                      <span className={`au-pill ${String(u.status || "").toLowerCase()}`}>
                        {statusLabel(String(u.status || "inactive").toLowerCase())}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}