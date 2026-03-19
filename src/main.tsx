
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

// FIX 4: Apply persisted theme before first render to prevent flash of wrong theme.
(() => {
  try {
    const stored = localStorage.getItem("ligtaslto_theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  } catch {}
})();

  createRoot(document.getElementById("root")!).render(<App />);
  