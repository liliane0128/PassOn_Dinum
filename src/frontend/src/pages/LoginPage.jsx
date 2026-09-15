import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, InputPassword } from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { collaborators } from "../data/mockData.js";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./LoginPage.css";

const LAST_EMAIL_KEY = "passon-last-email";

function getRememberedEmail() {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    const user = login(email, password);
    if (!user) {
      setError(true);
      return;
    }
    setError(false);
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email);
    } catch {
      // stockage indisponible : tant pis, l'email ne sera pas mémorisé.
    }
    navigate(user.accountRole === "manager" ? "/manager" : "/moi");
  }

  return (
    <div className="login-page">
      <div className="login-page__main">
        <div className="login-page__theme-toggle">
          <ThemeToggle />
        </div>

        <div className="login-page__center">
          <img
            src={suiteLogo}
            alt="La Suite numérique"
            className="login-page__logo"
          />

          <form className="login-page__card" onSubmit={handleSubmit}>
            <h1 className="login-page__title">Pass'on</h1>
            <p className="login-page__subtitle">
              Connectez-vous pour accéder à votre espace.
            </p>

            <Input
              label="Email professionnel"
              type="email"
              fullWidth
              state={error ? "error" : "default"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <InputPassword
              label="Mot de passe"
              fullWidth
              state={error ? "error" : "default"}
              text={error ? "Email ou mot de passe incorrect." : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" fullWidth>
              Se connecter
            </Button>

            <details className="login-page__hint">
              <summary>Comptes de test (prototype, pas de vrai backend)</summary>
              <ul>
                {collaborators.map((c) => (
                  <li key={c.id}>
                    {c.email} — {c.accountRole === "manager" ? "manager" : "employé"}
                  </li>
                ))}
              </ul>
              <p>Mot de passe pour tous les comptes : demo</p>
            </details>
          </form>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
