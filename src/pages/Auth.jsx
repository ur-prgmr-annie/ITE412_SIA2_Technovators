// src/pages/Auth.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaEnvelope, FaLock, FaUser, FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/auth.css";
import logo from "../images/logo.png";

import {
  loginEmailPassword,
  requestAccessRegister,
  getCurrentUserRoleAndStatus,
  seedFirstAdmin,
} from "../services/authService";

import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { db, auth } from "../services/firebase";
import { getSystemFlags } from "../services/adminSettingsService";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  
  // ✅ Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ detect if first admin exists
  const [adminExists, setAdminExists] = useState(null);

  // ✅ show message if redirected by MaintenanceGate: /auth?m=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get("m");
    if (m === "1") {
      setError("System is in Maintenance Mode. Only admins can sign in right now.");
    }
  }, [location.search]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "admin"));
        const snap = await getDocs(q);
        if (!alive) return;
        setAdminExists(!snap.empty);
      } catch (e) {
        if (!alive) return;
        // if Firestore fails, default to true so we don't expose seed UI accidentally
        setAdminExists(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const setModeSafe = (m) => {
    setMode(m);
    setError("");
    setInfo("");
    setForm((p) => ({ ...p, password: "", confirmPassword: "", fullName: "" }));
    // Reset password visibility when switching modes
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // ✅ routes user after login (with maintenance gate too)
  const routeByRole = async () => {
    const res = await getCurrentUserRoleAndStatus();
    if (!res) throw new Error("NO_SESSION");

    const role = String(res.role || "").trim().toLowerCase();
    const status = String(res.status || "").trim().toLowerCase();

    if (status === "pending") throw new Error("ACCOUNT_PENDING");
    if (status !== "active") throw new Error("ACCOUNT_INACTIVE");

    // ✅ Maintenance Mode: only admins allowed
    const flags = await getSystemFlags();
    if (flags?.maintenanceMode && role !== "admin") {
      await signOut(auth);
      throw new Error("MAINTENANCE_MODE");
    }

    if (role === "admin") return navigate("/admin/panel");

    // ✅ both field + inventory go here
    if (role === "field_officer" || role === "inventory_officer") {
      return navigate("/dashboard");
    }

    // fallback
    return navigate("/auth");
  };

  const friendlyAuthError = (err) => {
    const code = err?.code || "";
    const msg = err?.message || "";

    if (msg === "MAINTENANCE_MODE")
      return "System is in Maintenance Mode. Only admins can sign in right now.";
    if (msg === "ADMIN_ALREADY_EXISTS") return "An admin already exists.";
    if (msg === "ACCOUNT_PENDING") return "Your request is pending admin approval.";
    if (msg === "ACCOUNT_INACTIVE") return "Your account is inactive. Contact admin.";
    if (msg === "NO_SESSION") return "No active session. Please log in again.";
    if (msg === "NO_PROFILE") return "Profile not found. Contact admin.";
    if (msg === "FULLNAME_REQUIRED") return "Full name is required.";
    if (msg === "EMAIL_REQUIRED") return "Email is required.";
    if (msg === "PASSWORD_REQUIRED") return "Password is required.";
    if (msg === "WEAK_PASSWORD") return "Password must be at least 6 characters.";
    if (msg === "PASSWORD_MISMATCH") return "Passwords do not match.";

    if (code === "auth/user-not-found") return "No account found for this email.";
    if (code === "auth/wrong-password") return "Incorrect password.";
    if (code === "auth/invalid-credential") return "Incorrect email or password.";
    if (code === "auth/invalid-email") return "Invalid email format.";
    if (code === "auth/email-already-in-use") return "Email already in use. Try signing in.";
    if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
    if (code === "auth/network-request-failed") return "Network error. Check your internet.";

    return code || msg || "Authentication failed. Please check your details.";
  };

  const title = useMemo(() => {
    if (mode === "adminSeed") return "Create First Admin";
    return mode === "login" ? "Welcome Back" : "Request Access";
  }, [mode]);

  const subtitle = useMemo(() => {
    if (mode === "adminSeed") return "Create the first Admin account (one-time setup).";
    return mode === "login"
      ? "Sign in with your credentials to access ANIMIS."
      : "Submit your details. Admin approval is required before you can log in.";
  }, [mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password;

      if (!email) throw new Error("EMAIL_REQUIRED");
      if (!password) throw new Error("PASSWORD_REQUIRED");

      // ✅ Block new access requests during maintenance
      if (mode === "register") {
        const flags = await getSystemFlags();
        if (flags?.maintenanceMode) throw new Error("MAINTENANCE_MODE");
      }

      if (mode === "register") {
        const fullName = form.fullName.trim();
        if (!fullName) throw new Error("FULLNAME_REQUIRED");
        if (password.length < 6) throw new Error("WEAK_PASSWORD");
        if (password !== form.confirmPassword) throw new Error("PASSWORD_MISMATCH");

        await requestAccessRegister(fullName, email, password);

        setInfo("Request submitted. Please wait for admin approval before logging in.");
        setMode("login");
        setForm((p) => ({ ...p, password: "", confirmPassword: "" }));
        return;
      }

      if (mode === "adminSeed") {
        const fullName = form.fullName.trim();
        if (!fullName) throw new Error("FULLNAME_REQUIRED");
        if (password.length < 6) throw new Error("WEAK_PASSWORD");
        if (password !== form.confirmPassword) throw new Error("PASSWORD_MISMATCH");

        await seedFirstAdmin(fullName, email, password);
        setInfo("Admin created. Redirecting to Admin Panel...");
        await routeByRole();
        return;
      }

      // ✅ LOGIN FLOW (with immediate maintenance block)
      await loginEmailPassword(email, password);

      const flags = await getSystemFlags();
      const res = await getCurrentUserRoleAndStatus();
      const role = String(res?.role || "").trim().toLowerCase();

      if (flags?.maintenanceMode && role !== "admin") {
        await signOut(auth);
        throw new Error("MAINTENANCE_MODE");
      }

      await routeByRole();
    } catch (err) {
      console.log("AUTH ERROR:", err);
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="bg-layer" />
      <div className="grid-layer" />
      <div className="blob a" aria-hidden />
      <div className="blob b" aria-hidden />
      <div className="blob c" aria-hidden />
      <div className="auth-background">
        <div className="auth-gradient-1"></div>
        <div className="auth-gradient-2"></div>
        <div className="auth-gradient-3"></div>
      </div>

      <div className="auth-container">
        <header className="auth-header">
          <button className="back-button" onClick={() => navigate("/")} type="button">
            <FaArrowLeft /> Back to Home
          </button>

          <div className="auth-logo-section">
            <div className="auth-logo-wrapper">
              <img src={logo} alt="ANIMIS Logo" className="auth-logo" />
            </div>
            <div className="auth-brand-info">
              <span className="auth-system-tag">ACCESS CONTROL</span>
              <h1 className="auth-system-title">ANIMIS</h1>
              <p className="auth-system-desc">Municipal Agriculture Office of Naujan</p>
            </div>
          </div>
        </header>

        <main className="auth-main-centered">
          <div className="auth-form-panel-centered">
            <div className="auth-form-header">
              <div className="auth-mode-tabs">
                <button
                  className={`mode-tab ${mode === "login" ? "active" : ""}`}
                  onClick={() => setModeSafe("login")}
                  type="button"
                  disabled={loading}
                >
                  Sign In
                </button>

                <button
                  className={`mode-tab ${mode === "register" ? "active" : ""}`}
                  onClick={() => setModeSafe("register")}
                  type="button"
                  disabled={loading}
                >
                  Request Access
                </button>

                {/* show only if no admin exists */}
                {adminExists === false && (
                  <button
                    className={`mode-tab ${mode === "adminSeed" ? "active" : ""}`}
                    onClick={() => setModeSafe("adminSeed")}
                    type="button"
                    disabled={loading}
                  >
                    Create Admin
                  </button>
                )}
              </div>

              <h2 className="auth-form-title">{title}</h2>
              <p className="auth-form-subtitle">{subtitle}</p>

              {adminExists === false && mode !== "adminSeed" && (
                <div className="auth-info" style={{ marginTop: 10 }}>
                  No Admin exists yet. Use <b>Create Admin</b> first (one-time setup).
                </div>
              )}
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {!!error && <div className="auth-error">{error}</div>}
              {!!info && <div className="auth-info">{info}</div>}

              {(mode === "register" || mode === "adminSeed") && (
                <div className="form-group">
                  <label className="form-label">
                    <FaUser className="input-icon" /> Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={onChange}
                    className="form-input"
                    placeholder="Enter your full name"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <FaEnvelope className="input-icon" /> Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  className="form-input"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FaLock className="input-icon" /> Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={onChange}
                    className="form-input password-input"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    tabIndex="-1"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {(mode === "register" || mode === "adminSeed") && (
                <div className="form-group">
                  <label className="form-label">
                    <FaLock className="input-icon" /> Confirm Password
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={onChange}
                      className="form-input password-input"
                      placeholder="Confirm password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                      tabIndex="-1"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="submit-button" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Sign In"
                  : mode === "register"
                  ? "Submit Request"
                  : "Create Admin"}
                <FaArrowRight />
              </button>

              <p className="demo-note">
                Admin approves accounts and assigns roles (Admin • Field Officer • Inventory Officer).
              </p>
            </form>
          </div>
        </main>

        <footer className="auth-footer">
          <div className="footer-content">
            <div className="footer-left">
              <span>Municipal Agriculture Office of Naujan</span>
              <span className="footer-divider">•</span>
              <span>ANIMIS</span>
            </div>
            <div className="footer-right">
              <span className="version">v1.0</span>
              <span className="footer-divider">•</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}