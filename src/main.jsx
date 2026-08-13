// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// ✅ Theme Provider (global light/dark)
import { ThemeProvider } from "./context/ThemeProvider.jsx";

// ✅ PWA auto-update (requires vite-plugin-pwa)
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  // Safer UX: don't force reload automatically; just keep updated in background.
  // If you want force refresh, uncomment location.reload() in onNeedRefresh.
  onNeedRefresh() {
    // location.reload();
  },
  onOfflineReady() {
    // optional: console.log("App ready to work offline");
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

// ✅ Tell index.html to fade out loader
window.dispatchEvent(new Event("animis:mounted"));