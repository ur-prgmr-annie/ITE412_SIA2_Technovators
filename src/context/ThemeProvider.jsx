// src/context/ThemeProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const ThemeCtx = createContext(null);

const applyThemeToDOM = (t) => {
  const theme = t === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const [uid, setUid] = useState(null);

  // Load theme per user (Firestore first, then localStorage fallback)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const newUid = user?.uid || null;
      setUid(newUid);

      // Not logged in -> default light
      if (!newUid) {
        setThemeState("light");
        applyThemeToDOM("light");
        return;
      }

      // 1) try Firestore
      try {
        const ref = doc(db, "users", newUid);
        const snap = await getDoc(ref);
        const fsTheme = snap.exists() ? snap.data()?.theme : null;
        if (fsTheme === "dark" || fsTheme === "light") {
          setThemeState(fsTheme);
          applyThemeToDOM(fsTheme);
          localStorage.setItem(`animis_theme_${newUid}`, fsTheme);
          return;
        }
      } catch {
        // ignore, fallback below
      }

      // 2) fallback to localStorage
      const ls = localStorage.getItem(`animis_theme_${newUid}`);
      const t = ls === "dark" ? "dark" : "light";
      setThemeState(t);
      applyThemeToDOM(t);
    });

    return () => unsub();
  }, []);

  const setTheme = async (t) => {
    const next = t === "dark" ? "dark" : "light";
    setThemeState(next);
    applyThemeToDOM(next);

    // store per-user only
    if (uid) {
      localStorage.setItem(`animis_theme_${uid}`, next);

      // write to Firestore so it follows user on any device
      try {
        await setDoc(
          doc(db, "users", uid),
          { theme: next, updatedAt: Date.now() },
          { merge: true }
        );
      } catch {
        // safe fallback: UI already changed
      }
    }
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}