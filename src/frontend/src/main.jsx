import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@gouvfr-lasuite/ui-components/style";
import "@gouvfr-lasuite/ui-components/fonts/roboto";
import "@gouvfr-lasuite/ui-components/fonts/material-icons";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SummaryProvider } from "./context/SummaryContext.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <SummaryProvider>
          <App />
        </SummaryProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>,
);
