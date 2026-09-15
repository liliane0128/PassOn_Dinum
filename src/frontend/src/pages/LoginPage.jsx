import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, InputPassword } from "@gouvfr-lasuite/ui-components";
import { useAuth } from "../context/AuthContext.jsx";
import { useCollaborators } from "../context/CollaboratorsContext.jsx";
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
  const { collaborators } = useCollaborators();
  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  // Change de clé après chaque tentative pour forcer InputPassword à se
  // réinitialiser (elle gère elle-même l'affichage/masquage en interne, sans
  // prop pour le contrôler) : le mot de passe redevient masqué qu'on
  // réussisse ou échoue, plutôt que de rester visible à l'écran.
  const [passwordFieldKey, setPasswordFieldKey] = useState(0);
  const submitButtonRef = useRef(null);

  function attemptLogin() {
    const user = login(email, password);
    setPasswordFieldKey((key) => key + 1);
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

  function handleSubmit(event) {
    event.preventDefault();
    // Le bouton œil "afficher le mot de passe" est un <button> sans
    // type="button" dans la librairie UI : dans un <form>, ça vaut submit
    // par défaut, donc le cliquer déclenche aussi ce handler. On ignore la
    // tentative de connexion si ce n'est pas notre vrai bouton qui l'a
    // déclenchée.
    const submitter = event.nativeEvent.submitter;
    if (submitter && submitter !== submitButtonRef.current) return;
    attemptLogin();
  }

  // La touche Entrée dans un champ texte déclenche une "soumission
  // implicite" du formulaire : le navigateur simule un clic sur le premier
  // bouton submit du DOM, qui est ici l'œil "afficher le mot de passe" (avant
  // notre bouton "Se connecter"). Ça révèle le mot de passe au lieu de
  // connecter. On intercepte Entrée nous-mêmes pour éviter ce clic simulé.
  function handleKeyDown(event) {
    if (event.key === "Enter" && event.target.tagName === "INPUT") {
      event.preventDefault();
      attemptLogin();
    }
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

          <form
            className="login-page__card"
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
          >
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
              key={passwordFieldKey}
              label="Mot de passe"
              fullWidth
              state={error ? "error" : "default"}
              text={error ? "Email ou mot de passe incorrect." : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button ref={submitButtonRef} type="submit" fullWidth>
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
