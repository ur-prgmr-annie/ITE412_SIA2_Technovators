// src/layouts/AdminLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "../../styles/adminLayout.css";
import logo from "../../images/logo.png";

import {
  Users,
  Shield,
  Settings,
  BarChart3,
  Boxes,
  ThermometerSnowflake,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
  Bell,
  LayoutGrid,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { auth, db } from "../../services/firebase";
import { signOut } from "firebase/auth";
import { getCurrentUserRoleAndStatus } from "../../services/authService";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  writeBatch,
} from "firebase/firestore";

const NAV = [
  { to: "overview", label: "Admin Dashboard", icon: LayoutGrid },
  { to: "users", label: "Users & Roles", icon: Users },
  { to: "roles", label: "Role Permissions", icon: Shield },
  { to: "settings", label: "System Settings", icon: Settings },
  { to: "reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "ops", label: "Inventory & Cold Chain", icon: ThermometerSnowflake },
  { to: "billing", label: "Billing Services", icon: CreditCard },
];

// ---------- Notification Toast ----------
function NotificationToast({ notification, onClose }) {
  if (!notification) return null;

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={18} />;
      case "warning":
        return <AlertTriangle size={18} />;
      case "error":
        return <AlertTriangle size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case "success":
        return "adml-toast-success";
      case "warning":
        return "adml-toast-warning";
      case "error":
        return "adml-toast-error";
      default:
        return "adml-toast-info";
    }
  };

  return (
    <div className={`adml-toast ${getTypeClass(notification.type)}`}>
      <div className="adml-toast-icon">{getIcon(notification.type)}</div>
      <div className="adml-toast-content">
        <div className="adml-toast-title">{notification.title}</div>
        {notification.message && (
          <div className="adml-toast-message">{notification.message}</div>
        )}
        <div className="adml-toast-time">{notification.timeAgo || "Just now"}</div>
      </div>
      <button className="adml-toast-close" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

// ---------- Notification Panel ----------
function NotificationPanel({ open, onClose, notifications, onMarkAsRead, onMarkAllRead }) {
  if (!open) return null;

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} />;
      case "warning":
        return <AlertTriangle size={16} />;
      case "error":
        return <AlertTriangle size={16} />;
      default:
        return <Bell size={16} />;
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case "success":
        return "adml-notif-success";
      case "warning":
        return "adml-notif-warning";
      case "error":
        return "adml-notif-error";
      default:
        return "adml-notif-info";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="adml-notif-overlay" onClick={onClose}>
      <div className="adml-notif-panel" onClick={(e) => e.stopPropagation()}>
        <div className="adml-notif-head">
          <div className="adml-notif-title">
            <Bell size={18} />
            Notifications
            {unreadCount > 0 && (
              <span className="adml-notif-count">{unreadCount}</span>
            )}
          </div>
          <div className="adml-notif-actions">
            {unreadCount > 0 && (
              <button className="adml-notif-mark-all" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
            <button className="adml-notif-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="adml-notif-body">
          {notifications.length === 0 ? (
            <div className="adml-notif-empty">
              <Bell size={32} />
              <p>No notifications yet</p>
              <span>You're all caught up!</span>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`adml-notif-item ${getTypeClass(notif.type)} ${!notif.read ? "unread" : ""}`}
                onClick={() => onMarkAsRead(notif.id)}
              >
                <div className="adml-notif-item-icon">{getIcon(notif.type)}</div>
                <div className="adml-notif-item-content">
                  <div className="adml-notif-item-title">{notif.title}</div>
                  {notif.message && (
                    <div className="adml-notif-item-message">{notif.message}</div>
                  )}
                  <div className="adml-notif-item-time">{notif.timeAgo || "Just now"}</div>
                </div>
                {!notif.read && <div className="adml-notif-item-dot" />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Modal ----------
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="adml-modal-wrap" role="dialog" aria-modal="true">
      <button className="adml-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="adml-modal">
        <div className="adml-modal-head">
          <div className="adml-modal-title">{title}</div>
          <button className="adml-iconBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="adml-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busyLogout, setBusyLogout] = useState(false);

  const [userName, setUserName] = useState("—");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState("active");

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);

  // Add notification function (exposed to children)
  const addNotification = async (title, message, type = "info", link = null) => {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const docRef = await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        title: title || "Notification",
        message: message || "",
        type: type || "info",
        read: false,
        createdAt: serverTimestamp(),
        link: link || null,
      });
      console.log("✅ Notification added (admin):", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error adding notification:", error);
      return null;
    }
  };

  // Real-time notification listener
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    try {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const notifs = snapshot.docs.map((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate?.() || data.createdAt || new Date();
            const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
            let timeAgo = "Just now";
            if (diff > 60) {
              const mins = Math.floor(diff / 60);
              if (mins < 60) timeAgo = `${mins}m ago`;
              else {
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) timeAgo = `${hrs}h ago`;
                else {
                  const days = Math.floor(hrs / 24);
                  timeAgo = `${days}d ago`;
                }
              }
            }
            return { id: doc.id, ...data, timeAgo };
          });
          setNotifications(notifs);
          setUnreadCount(notifs.filter((n) => !n.read).length);
        },
        (error) => console.error("❌ Notification listener error:", error)
      );
    } catch (e) {
      console.error("❌ Notification setup error:", e);
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Show toast for new unread notifications
  useEffect(() => {
    if (!notifications.length || currentNotification) return;
    const firstUnread = notifications.find((n) => !n.read);
    if (firstUnread) {
      setCurrentNotification(firstUnread);
      const timer = setTimeout(() => setCurrentNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications, currentNotification]);

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), {
        read: true,
        readAt: serverTimestamp(),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("❌ Mark as read error:", error);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("❌ Mark all read error:", error);
    }
  };

  const allowedNav = useMemo(() => NAV, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getCurrentUserRoleAndStatus();
        if (!alive) return;
        setRole(res?.role || "admin");
        setStatus(res?.status || "active");
        const name =
          auth.currentUser?.displayName ||
          res?.name ||
          res?.fullName ||
          auth.currentUser?.email ||
          "—";
        setUserName(name);
        if (res?.status !== "active") {
          await signOut(auth);
          navigate("/auth", { state: { msg: "Your account is inactive." } });
        }
      } catch {
        await signOut(auth);
        navigate("/auth");
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

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

  return (
    <div className="adml-app">
      {/* Notification Toast */}
      {currentNotification && (
        <NotificationToast
          notification={currentNotification}
          onClose={() => setCurrentNotification(null)}
        />
      )}

      {/* Notification Panel */}
      <NotificationPanel
        open={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllRead={markAllRead}
      />

      {/* Mobile overlay */}
      <button
        className={`adml-overlay ${mobileOpen ? "active" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Close menu"
      />

      {/* Sidebar */}
      <aside className={`adml-side ${mobileOpen ? "expanded" : ""}`}>
        <div className="adml-sideHead">
          <div className="adml-logo">
            <img src={logo} alt="ANIMIS" />
            <span className="adml-badge">ADMIN</span>
          </div>
          <div className="adml-brand">
            <div className="adml-kicker">SYSTEM ADMIN</div>
            <div className="adml-title">ANIMIS Control Center</div>
            <div className="adml-sub">Municipal Agriculture Office • Naujan</div>
          </div>
        </div>

        <div className="adml-user">
          <div className="adml-avatar">
            <User size={18} />
          </div>
          <div className="adml-userInfo">
            <div className="adml-userName">{userName}</div>
            <div className="adml-userMeta">
              <span className="adml-rolePill">
                <span className="dot" />
                {role || "admin"}
              </span>
              <span className="adml-status">• {status || "active"}</span>
            </div>
          </div>
        </div>

        <div className="adml-navWrap">
          <div className="adml-navHead">
            <span className="adml-navTitle">Admin Modules</span>
            <span className="adml-navCount">{allowedNav.length}</span>
          </div>

          <nav className="adml-nav">
            {allowedNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `adml-link ${isActive ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="adml-ico">
                    <Icon size={20} />
                  </span>
                  <span className="adml-text">{item.label}</span>
                  <span className="adml-arrow">
                    <ChevronRight size={18} />
                  </span>
                  <span className="adml-glow" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="adml-sideFoot">
          <button className="adml-logout" onClick={() => setLogoutOpen(true)}>
            <span className="adml-logoutIco">
              <LogOut size={18} />
            </span>
            <span>Sign Out</span>
          </button>

          <div className="adml-sys">
            <span className="adml-online" />
            System Online • ANIMIS v1.0
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="adml-main">
        {/* Topbar */}
        <header className="adml-top">
          <div className="adml-topLeft">
            <button
              className="adml-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={28} />
            </button>

            <div className="adml-crumbs">
              <button className="adml-back" onClick={() => navigate("/dashboard")}>
                <LayoutGrid size={18} />
                <span>All Programs</span>
              </button>
              <ChevronRight size={16} className="adml-sep" />
              <span className="adml-current">Admin Panel</span>
            </div>
          </div>

          <div className="adml-topCenter">
            <div className="adml-welcome">
              <div className="adml-wH">Administrator Controls</div>
              <div className="adml-wS">
                Manage users, roles, settings, reports, and system monitoring
              </div>
            </div>
          </div>

          <div className="adml-topRight">
            <button
              className="adml-bell"
              aria-label="Notifications"
              onClick={() => setNotificationPanelOpen(true)}
            >
              <Bell size={26} />
              {unreadCount > 0 && (
                <span className="adml-bellBadge">{unreadCount}</span>
              )}
            </button>

            <span className="adml-roleBadge">ADMIN</span>
          </div>
        </header>

        <div className="adml-content">
          <Outlet context={{ addNotification }} />
        </div>

        <footer className="adml-footer">
          <div>© 2024 Municipal Agriculture Office of Naujan • ANIMIS</div>
          <div className="adml-ver">v1.0.2 • Admin Edition • All Systems Operational</div>
        </footer>
      </main>

      {/* Logout Modal */}
      <Modal
        open={logoutOpen}
        title="Confirm Sign Out"
        onClose={() => (busyLogout ? null : setLogoutOpen(false))}
      >
        <div className="adml-logoutBox">
          <div className="adml-logoutBig">
            <LogOut size={44} />
          </div>
          <h3 className="adml-confirmTitle">Ready to leave the Admin Panel?</h3>
          <p className="adml-confirmMsg">
            You’ll need to sign in again to manage the system.
          </p>

          <div className="adml-actions">
            <button
              className="adml-btn ghost"
              onClick={() => setLogoutOpen(false)}
              disabled={busyLogout}
              type="button"
            >
              Cancel
            </button>
            <button
              className="adml-btn danger"
              onClick={confirmLogout}
              disabled={busyLogout}
              type="button"
            >
              {busyLogout ? "Signing out..." : "Yes, Sign Out"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}