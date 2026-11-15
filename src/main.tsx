import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Inter is bundled with the app (no Google Fonts request) so it works offline.
import "@fontsource-variable/inter/wght.css";
import "./index.css";

// App-shell service worker (generated at build time, see vite.config.ts):
// lets the installed home-screen app open and export offline. Needs HTTPS
// (or localhost); skipped in development so the dev server is never cached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
