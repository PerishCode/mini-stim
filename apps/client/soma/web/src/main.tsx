import React from "react";
import { createRoot } from "react-dom/client";
import "@mini-stim/components/theme.scss";
import { SantiMqueueProvider } from "@mini-stim/hooks";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SantiMqueueProvider>
      <App />
    </SantiMqueueProvider>
  </React.StrictMode>,
);
