import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, InputPassword } from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { AppFooter } from "../components/AppFooter.jsx";
import suiteLogo from "../assets/suite-logo.svg";
import "./LoginPage.css";

const LAST_EMAIL_KEY = "passon-last-email";

// Les codes viennent du backend (`src/backend/accounts/views.py`). Distinguer
// "mauvais identifiants" de "Drive injoignable" évite de chercher une faute de
// frappe quand c'est le service qui est éteint.
const ERROR_MESSAGES = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  drive_unreachable: "Drive est injoignable. Vérifiez qu'il est démarré.",
  drive_timeout: "Drive met trop de temps à répondre. Réessayez.",
  unexpected_response: "Réponse inattendue de Drive. Réessayez plus tard.",
  network_error: "Impossible de contacter le serveur.",
};

function errorMessage(code) {
  return ERROR_MESSAGES[code] ?? "Connexion impossible pour le moment.";
}

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
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    // Le mot de passe part au backend, qui le vérifie auprès de Drive : rien
    // n'est comparé ici, contrairement à la version mockée.
    const { user, error: failure } = await login(email, password);
    setSubmitting(false);
    if (!user) {
      setError(failure);
      return;
    }
    setError(null);
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
              disabled={submitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <InputPassword
              label="Mot de passe"
              fullWidth
              state={error ? "error" : "default"}
              text={error ? errorMessage(error) : undefined}
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "Connexion..." : "Se connecter"}
            </Button>

            <details className="login-page__hint">
              <summary>Quels identifiants utiliser ?</summary>
              <p>
                Ceux de <strong>Drive</strong> : la connexion est vérifiée par
                l'instance Drive locale, il n'y a pas de compte propre à Pass'on.
              </p>
              <p>
                Comptes de démonstration de Drive :{" "}
                <code>drive@drive.world</code> (mot de passe <code>drive</code>)
                ou <code>paige.turner@library.book</code> (mot de passe{" "}
                <code>pass</code>).
              </p>
            </details>
          </form>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
