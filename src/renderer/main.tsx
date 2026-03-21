import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import { AppRuntime } from "./AppRuntime";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found.");

createRoot(root).render(
  <StrictMode>
    <AppRuntime />
  </StrictMode>,
);
