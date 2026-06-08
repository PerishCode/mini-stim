import React from "react";
import { createRoot } from "react-dom/client";
import { SantiMqueueProvider } from "@mini-stim/hooks";

import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SantiMqueueProvider>
      <App />
    </SantiMqueueProvider>
  </React.StrictMode>,
);
