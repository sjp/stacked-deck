import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { startPwa } from "./app/pwa.ts";
import "./styles/theme.css";
import "./styles/index.css";
import "./styles/cards.css";
import "./styles/table.css";
import "./styles/app.css";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Missing #root element");
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

try {
  await startPwa();
} catch (error) {
  console.warn("Service worker registration failed", error);
}
