// src/pages/program1/Program1Layout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "../../styles/programLayout.css";
import logo from "../../images/logo.png";

import {
  ClipboardList,
  Stethoscope,
  Boxes,
  ThermometerSnowflake,
  MapPinned,
  BarChart3,
  LogOut,
  Menu,
  ShieldCheck,
  LayoutGrid,
  X,
  ChevronRight,
  User,
  Bell,
  Home,
  Database,
  Activity,
  Map,
  AlertTriangle,
  CheckCircle2,
  PawPrint,
} from "lucide-react";

import { auth, db, rtdb } from "../../services/firebase";
import { signOut } from "firebase/auth";
import { getCurrentUserRoleAndStatus } from "../../services/authService";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  limit,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, onValue, off } from "firebase/database";

const NAV = [
  { to: "overview", label: "Dashboard", icon: Home },
  { to: "registration", label: "Animal Registration", icon: Database },
  { to: "services", label: "Health Services", icon: Stethoscope },
  { to: "inventory", label: "Vaccine Inventory", icon: Boxes },
  { to: "cold-chain", label: "Cold Chain Monitoring", icon: ThermometerSnowflake },
  { to: "gis", label: "GIS Mapping", icon: Map },
  { to: "reports", label: "Reports & Analytics", icon: Activity },
];

function RoleLabel({ role }) {
  const label =
    role === "admin"
      ? "Administrator"
      : role === "inventory_officer"
      ? "Inventory Officer"
      : role === "field_officer"
      ? "Field Officer"
      : "User";

  return (
    <span className="pl-role-tag">
      <span className="pl-role-indicator"></span>
      {label}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="pl-modal-wrapper" role="dialog" aria-modal="true">
      <button className="pl-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="pl-modal-content">
        <div className="pl-modal-header">
          <div className="pl-modal-title">{title}</div>
          <button className="pl-modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="pl-modal-body">{children}</div>
      </div>
    </div>
  );
}

// Notification Toast Component
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
      case "info":
        return <Bell size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case "success":
        return "pl-notification-success";
      case "warning":
        return "pl-notification-warning";
      case "error":
        return "pl-notification-error";
      case "info":
        return "pl-notification-info";
      default:
        return "pl-notification-info";
    }
  };

  return (
    <div className={`pl-notification-toast ${getTypeClass(notification.type)}`}>
      <div className="pl-notification-toast-icon">
        {getIcon(notification.type)}
      </div>
      <div className="pl-notification-toast-content">
        <div className="pl-notification-toast-title">
          {notification.title}
        </div>
        {notification.message && (
          <div className="pl-notification-toast-message">
            {notification.message}
          </div>
        )}
        <div className="pl-notification-toast-time">
          {notification.timeAgo || "Just now"}
        </div>
      </div>
      <button
        className="pl-notification-toast-close"
        onClick={onClose}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Notification Panel Component
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
      case "info":
        return <Bell size={16} />;
      default:
        return <Bell size={16} />;
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case "success":
        return "pl-notification-item-success";
      case "warning":
        return "pl-notification-item-warning";
      case "error":
        return "pl-notification-item-error";
      case "info":
        return "pl-notification-item-info";
      default:
        return "pl-notification-item-info";
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="pl-notification-panel-overlay" onClick={onClose}>
      <div className="pl-notification-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pl-notification-panel-header">
          <div className="pl-notification-panel-title">
            <Bell size={18} />
            Notifications
            {unreadCount > 0 && (
              <span className="pl-notification-panel-count">{unreadCount}</span>
            )}
          </div>
          <div className="pl-notification-panel-actions">
            {unreadCount > 0 && (
              <button
                className="pl-notification-mark-all"
                onClick={onMarkAllRead}
              >
                Mark all read
              </button>
            )}
            <button
              className="pl-notification-panel-close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pl-notification-panel-body">
          {notifications.length === 0 ? (
            <div className="pl-notification-empty">
              <Bell size={32} />
              <p>No notifications yet</p>
              <span>You're all caught up!</span>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`pl-notification-item ${getTypeClass(notification.type)} ${!notification.read ? "unread" : ""}`}
                onClick={() => onMarkAsRead(notification.id)}
              >
                <div className="pl-notification-item-icon">
                  {getIcon(notification.type)}
                </div>
                <div className="pl-notification-item-content">
                  <div className="pl-notification-item-title">
                    {notification.title}
                  </div>
                  {notification.message && (
                    <div className="pl-notification-item-message">
                      {notification.message}
                    </div>
                  )}
                  <div className="pl-notification-item-time">
                    {notification.timeAgo || "Just now"}
                  </div>
                </div>
                {!notification.read && (
                  <div className="pl-notification-item-unread-dot"></div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Program1Layout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);
  const [userName, setUserName] = useState("—");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busyLogout, setBusyLogout] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ ADDED: Function to add notification (exposed to children via context)
  const addNotification = async (title, message, type = "info", link = null) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn("No user logged in, cannot add notification");
        return null;
      }

      const notificationData = {
        userId: user.uid,
        title: title || "Notification",
        message: message || "",
        type: type || "info",
        read: false,
        createdAt: serverTimestamp(),
        link: link || null,
      };

      const docRef = await addDoc(collection(db, "notifications"), notificationData);
      console.log("✅ Notification added with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("❌ Error adding notification:", error);
      throw error;
    }
  };

  // Real-time notification listener
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in, skipping notification listener");
        return;
      }

      console.log("📡 Setting up notification listener for user:", user.uid);

      const notificationsRef = collection(db, "notifications");
      const q = query(
        notificationsRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!isMounted) return;

        const notifs = snapshot.docs.map((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate?.() || data.createdAt || new Date();
          const timeDiff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
          
          let timeAgo = "Just now";
          if (timeDiff > 60) {
            const minutes = Math.floor(timeDiff / 60);
            if (minutes < 60) {
              timeAgo = `${minutes}m ago`;
            } else {
              const hours = Math.floor(minutes / 60);
              if (hours < 24) {
                timeAgo = `${hours}h ago`;
              } else {
                const days = Math.floor(hours / 24);
                timeAgo = `${days}d ago`;
              }
            }
          }

          return {
            id: doc.id,
            ...data,
            timeAgo,
            createdAt: createdAt,
          };
        });

        setNotifications(notifs);
        const unread = notifs.filter(n => !n.read).length;
        setUnreadCount(unread);
        console.log(`📢 Notifications updated: ${notifs.length} total, ${unread} unread`);
      }, (error) => {
        console.error("❌ Error loading notifications:", error);
      });

    } catch (error) {
      console.error("❌ Error setting up notification listener:", error);
    }

    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
        console.log("🔌 Notification listener unsubscribed");
      }
    };
  }, []);

  // Show notification toast for new notifications
  useEffect(() => {
    if (notifications.length === 0 || currentNotification) return;
    
    const unreadNotif = notifications.find(n => !n.read);
    if (unreadNotif) {
      setCurrentNotification(unreadNotif);
      console.log("🔔 Showing toast notification:", unreadNotif.title);
      
      const timer = setTimeout(() => {
        setCurrentNotification(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notifications, currentNotification]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, {
        read: true,
        readAt: serverTimestamp(),
      });
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      console.log("✅ Notification marked as read:", notificationId);
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      
      if (unreadNotifs.length === 0) {
        console.log("No unread notifications to mark");
        return;
      }
      
      const batch = writeBatch(db);
      unreadNotifs.forEach((notif) => {
        const notifRef = doc(db, "notifications", notif.id);
        batch.update(notifRef, {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
      console.log("✅ All notifications marked as read:", unreadNotifs.length);
    } catch (error) {
      console.error("❌ Error marking all notifications as read:", error);
    }
  };

  const allowedNav = useMemo(() => {
    if (role === "inventory_officer") {
      return NAV.filter((x) => ["overview", "inventory", "cold-chain", "reports"].includes(x.to));
    }
    return NAV;
  }, [role]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await getCurrentUserRoleAndStatus();
        if (!alive) return;

        setRole(res?.role || null);
        setStatus(res?.status || null);

        const name = auth.currentUser?.displayName || res?.name || res?.fullName || "—";
        setUserName(name);

        if (res?.status !== "active") {
          await signOut(auth);
          navigate("/auth", { state: { msg: "Your account is inactive. Contact admin." } });
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
    <div className="pl-app">
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
        className={`pl-mobile-menu-overlay ${mobileOpen ? "active" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Close menu"
      />

      {/* Sidebar */}
      <aside className={`pl-side-nav ${mobileOpen ? "expanded" : ""} ${sidebarMinimized ? "minimized" : ""}`}>
        {/* Header */}
        <div className="pl-sidebar-header-wide">
          <div className="pl-app-logo-wide">
            <img src={logo} alt="ANIMIS" />
            <div className="pl-app-badge">
              <ShieldCheck size={12} />
            </div>
          </div>
          <div className="pl-app-info-wide">
            <div className="pl-program-badge-wide">PROGRAM 1</div>
            <div className="pl-app-title-wide">Animal Health Protection</div>
            <div className="pl-municipal-office-wide">Municipal Agriculture Office • Naujan</div>
          </div>
          <button
            className="pl-minimize-btn"
            onClick={() => setSidebarMinimized(!sidebarMinimized)}
            aria-label={sidebarMinimized ? "Expand sidebar" : "Minimize sidebar"}
            title={sidebarMinimized ? "Expand" : "Minimize"}
          >
            {sidebarMinimized ? <ChevronRight size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* User Info */}
        <div className="pl-user-section-wide">
          <div className="pl-user-avatar-wide">
            <User size={18} />
          </div>
          <div className="pl-user-details-wide">
            <div className="pl-user-name-wide">{userName}</div>
            <div className="pl-user-role-wide">
              <RoleLabel role={role} />
              <span className="pl-user-status">• {status || "Active"}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="pl-nav-container-wide">
          <div className="pl-nav-header">
            <span className="pl-nav-section-title">Main Modules</span>
            <span className="pl-nav-count">{allowedNav.length}</span>
          </div>
          
          <nav className="pl-nav-wide">
            {allowedNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `pl-nav-btn-wide ${isActive ? "active" : ""}`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="pl-nav-btn-icon-wide">
                    <Icon size={21} />
                  </div>
                  <span className="pl-nav-btn-text-wide">{item.label}</span>
                  <div className="pl-nav-btn-arrow-wide">
                    <ChevronRight size={18} />
                  </div>
                  <div className="pl-nav-btn-glow"></div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="pl-sidebar-footer-wide">
          <button 
            className="pl-logout-btn-wide" 
            onClick={() => setLogoutOpen(true)}
          >
            <div className="pl-logout-icon-wide">
              <LogOut size={18} />
            </div>
            <span className="pl-logout-text">Sign Out</span>
          </button>
          <div className="pl-system-info-wide">
            <div className="pl-system-status-wide">
              <div className="pl-status-indicator-wide active"></div>
              <span>System Online • ANIMIS v1.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-main-content-area">
        {/* Top Bar */}
        <header className="pl-top-bar-wide">
          <div className="pl-top-left-section">
            <button 
              className="pl-hamburger-large-wide" 
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={28} />
            </button>
            
            <div className="pl-desktop-navigation-wide">
              <button 
                className="pl-back-btn-wide"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutGrid size={19} />
                <span>All Programs</span>
              </button>
              <ChevronRight size={16} className="pl-nav-separator-wide" />
              <span className="pl-current-page-wide">Animal Health Protection</span>
            </div>
          </div>

          <div className="pl-top-center-section">
            <div className="pl-welcome-section-wide">
              <h1 className="pl-welcome-heading-wide">Welcome back, {userName.split(' ')[0] || 'User'}</h1>
              <p className="pl-welcome-subtitle-wide">Manage your animal health operations efficiently</p>
            </div>
          </div>

          <div className="pl-top-right-section">
            <button 
              className="pl-notification-btn-wide" 
              onClick={() => setNotificationPanelOpen(true)}
              aria-label="Notifications"
            >
              <div className="pl-notification-wrapper-wide">
                <Bell size={26} />
                {unreadCount > 0 && (
                  <span className="pl-notification-badge-wide">{unreadCount}</span>
                )}
              </div>
            </button>
            
            <div className="pl-user-profile-wide">
              <span className="pl-user-role-badge-wide">{role || "User"}</span>
            </div>
          </div>
        </header>

        {/* ✅ UPDATED: Content with notification context */}
        <div className="pl-content-main-wide">
          <Outlet context={{ addNotification }} />
        </div>

        {/* Footer */}
        <footer className="pl-footer-wide">
          <div className="pl-footer-content-wide">
            <div className="pl-footer-left-wide">
              <span className="pl-footer-text-wide">© 2026 Municipal Agriculture Office of Naujan • ANIMIS</span>
            </div>
            <div className="pl-footer-right-wide">
              <span className="pl-version-wide">v1.0.1 • Professional Edition • All Systems Operational</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Logout Modal */}
      <Modal
        open={logoutOpen}
        title="Confirm Sign Out"
        onClose={() => (busyLogout ? null : setLogoutOpen(false))}
      >
        <div className="pl-logout-confirmation-wide">
          <div className="pl-logout-icon-modal-wide">
            <LogOut size={44} />
          </div>
          <h3 className="pl-confirm-title-wide">Ready to leave the system?</h3>
          <p className="pl-confirm-message-wide">
            You'll need to sign in again to access your data.
          </p>
          <div className="pl-confirm-actions-wide">
            <button
              className="pl-action-btn-modal secondary"
              onClick={() => setLogoutOpen(false)}
              disabled={busyLogout}
              type="button"
            >
              Cancel
            </button>
            <button
              className="pl-action-btn-modal danger"
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