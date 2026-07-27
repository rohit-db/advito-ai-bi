import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { RegistryProvider } from "./registry/RegistryProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <RegistryProvider>
          <App />
        </RegistryProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
