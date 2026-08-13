// src/pages/Settings.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useTheme } from "../context/ThemeProvider";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [user, setUser] = useState(auth.currentUser);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const clearAlerts = () => {
    setMsg("");
    setErr("");
  };

  // Keep user state updated
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u || null));
    return () => unsub();
  }, []);

  // Realtime user doc so changes reflect immediately (also helps Program layouts)
  useEffect(() => {
    if (!user?.uid) {
      setErr("No active session. Please sign in again.");
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setFullName(user.displayName || data?.fullName || "");
        setEmail(user.email || "");
        setPhone(data?.phone || "");
        setLoading(false);
      },
      () => {
        setErr("Failed to load settings.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, user?.displayName, user?.email]);

  const saveProfile = async () => {
    clearAlerts();
    if (!user?.uid) return setErr("No active session.");

    const name = fullName.trim();
    if (!name) return setErr("Full name is required.");

    setSavingProfile(true);
    try {
      // 1) Update Firebase Auth displayName
      await updateProfile(user, { displayName: name });

      // 2) Save to Firestore users/{uid}
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: name,
          phone: phone.trim(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setMsg("Profile updated successfully.");
    } catch (e) {
      setErr("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    clearAlerts();
    if (!user) return setErr("No active session.");
    if (!user.email) return setErr("Email is missing in your account.");

    if (!currentPassword) return setErr("Enter your current password.");
    if (!newPassword || newPassword.length < 6) return setErr("New password must be at least 6 characters.");
    if (newPassword !== confirmNewPassword) return setErr("New passwords do not match.");

    setSavingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      setMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/wrong-password") setErr("Current password is incorrect.");
      else if (code === "auth/too-many-requests") setErr("Too many attempts. Try again later.");
      else setErr("Failed to change password. Please sign in again if needed.");
    } finally {
      setSavingPassword(false);
    }
  };

  const cardStyle = useMemo(
    () => ({
      border: "1px solid var(--app-border)",
      background: "var(--app-card)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "var(--app-shadow)",
    }),
    []
  );

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 950, fontSize: 18 }}>Settings</div>
        <div style={{ marginTop: 8, color: "var(--app-muted)", fontWeight: 700 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: "0 auto", color: "var(--app-text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--app-border)",
              background: "transparent",
              color: "var(--app-text)",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ← Back
          </button>

          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Settings</div>
            <div style={{ marginTop: 6, color: "var(--app-muted)", fontWeight: 700 }}>
              Manage your profile, password, and appearance.
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>Theme</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setTheme("light")}
              disabled={savingProfile || savingPassword}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid var(--app-border)",
                background: theme === "light" ? "rgba(16,185,129,0.18)" : "transparent",
                color: "var(--app-text)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              disabled={savingProfile || savingPassword}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid var(--app-border)",
                background: theme === "dark" ? "rgba(16,185,129,0.18)" : "transparent",
                color: "var(--app-text)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(err || msg) && (
        <div style={{ marginTop: 14 }}>
          {err ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,107,107,0.35)",
                background: "rgba(255,107,107,0.12)",
                color: theme === "dark" ? "rgba(255,240,240,0.96)" : "#991b1b",
                fontWeight: 900,
              }}
            >
              {err}
            </div>
          ) : null}

          {msg ? (
            <div
              style={{
                marginTop: err ? 10 : 0,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(16,185,129,0.35)",
                background: "rgba(16,185,129,0.12)",
                color: "var(--app-text)",
                fontWeight: 900,
              }}
            >
              {msg}
            </div>
          ) : null}
        </div>
      )}

      {/* Profile */}
      <div style={{ marginTop: 14, ...cardStyle }}>
        <div style={{ fontWeight: 950, fontSize: 15 }}>Profile</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>Full Name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={savingProfile || savingPassword}
              placeholder="Your name"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>Email (read-only)</span>
            <input value={email} disabled style={{ ...inputStyle, opacity: 0.8 }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={savingProfile || savingPassword}
              placeholder="09xxxxxxxxx"
              style={inputStyle}
            />
          </label>

          <button type="button" onClick={saveProfile} disabled={savingProfile || savingPassword} style={primaryBtn}>
            {savingProfile ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>

      {/* Password */}
      <div style={{ marginTop: 14, ...cardStyle }}>
        <div style={{ fontWeight: 950, fontSize: 15 }}>Change Password</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>Current Password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={savingProfile || savingPassword}
              placeholder="Enter current password"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={savingProfile || savingPassword}
              placeholder="At least 6 characters"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "var(--app-muted)" }}>Confirm New Password</span>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              disabled={savingProfile || savingPassword}
              placeholder="Repeat new password"
              style={inputStyle}
            />
          </label>

          <button type="button" onClick={changePassword} disabled={savingProfile || savingPassword} style={dangerBtn}>
            {savingPassword ? "Please wait…" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid var(--app-border)",
  background: "transparent",
  color: "var(--app-text)",
  fontWeight: 800,
  outline: "none",
};

const primaryBtn = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "0",
  background: "linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent2) 100%)",
  color: "#081a12",
  fontWeight: 950,
  cursor: "pointer",
};

const dangerBtn = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,107,107,0.35)",
  background: "rgba(255,107,107,0.14)",
  color: "var(--app-text)",
  fontWeight: 950,
  cursor: "pointer",
};