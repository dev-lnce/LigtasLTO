
  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";

  // Remove any stuck Family Mode state from previous sessions
  try {
    localStorage.removeItem('ligtaslto_family_mode');
    localStorage.removeItem('ligtaslto_family_role');
    localStorage.removeItem('ligtaslto_share_token');
    localStorage.removeItem('ligtaslto_locked');

    // Also remove any leftover Family Mode session keys (e.g. ligtaslto_family_session_*)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('family')) localStorage.removeItem(k);
    }
  } catch {}

// FIX 4: Apply persisted theme before first render to prevent flash of wrong theme.
(() => {
  try {
    const stored = localStorage.getItem("ligtaslto_theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  } catch {}
})();

  createRoot(document.getElementById("root")!).render(<App />);
  