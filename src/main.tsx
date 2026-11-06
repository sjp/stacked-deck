import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import "./styles/theme.css";
import "./styles/index.css";
import "./styles/cards.css";
import "./styles/table.css";

const root = document.querySelector("#root");
if (root === null) {
  throw new Error("Missing #root element");
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
