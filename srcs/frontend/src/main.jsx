import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CunninghamProvider } from "@gouvfr-lasuite/ui-components";
import "@gouvfr-lasuite/ui-components/style";
import "@gouvfr-lasuite/ui-components/fonts/roboto";
import "@gouvfr-lasuite/ui-components/fonts/material-icons";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CunninghamProvider theme="default">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CunninghamProvider>
  </StrictMode>,
);
