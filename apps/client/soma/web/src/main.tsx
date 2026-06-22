import React from "react";
import { createRoot } from "react-dom/client";
import "@mini-stim/components/theme.scss";
import { SantiMqueueProvider } from "@mini-stim/hooks";

import { App } from "./App";

const root = document.getElementById("root");
if (!root) {
  throw new Error("mini-stim root element is missing");
}

createRoot(root).render(
  <React.StrictMode>
    <SantiMqueueProvider>
      <App />
    </SantiMqueueProvider>
  </React.StrictMode>,
);
