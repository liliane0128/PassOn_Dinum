import { createContext, useContext, useState } from "react";
import { CunninghamProvider } from "@gouvfr-lasuite/ui-components";

const STORAGE_KEY = "passon-theme";
const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "default";
  } catch {
    return "default";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "default" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // stockage indisponible (navigation privée...) : le thème ne sera
        // simplement pas mémorisé d'une session à l'autre.
      }
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <CunninghamProvider theme={theme}>{children}</CunninghamProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
