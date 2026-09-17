import { Button } from "@gouvfr-lasuite/ui-components";
import { useTheme } from "../context/ThemeContext.jsx";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="tertiary"
      size="small"
      onClick={toggleTheme}
      icon={
        <span className="material-icons">
          {isDark ? "light_mode" : "dark_mode"}
        </span>
      }
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
    />
  );
}
