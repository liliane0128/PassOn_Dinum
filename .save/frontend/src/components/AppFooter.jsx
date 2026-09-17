import { Button } from "@gouvfr-lasuite/ui-components";
import suiteLogo from "../assets/suite-logo.svg";
import "./AppFooter.css";

// Repris de la structure du bandeau de bas de page de lasuite.numerique.gouv.fr,
// avec le bloc "S'abonner à la newsletter / Démarrer avec LaSuite" remplacé par
// un bloc "Nous contacter" (sur demande). Pas de partie institutionnelle
// officielle (logo gouv, liens legifrance/service-public...) : ce projet n'est
// pas un service de l'État, on n'a pas le droit d'afficher cette identité-là.
//
// Pour la même raison, la mention d'indépendance ci-dessous : le logo de La
// Suite est affiché en en-tête des trois pages, à côté du nom Pass'on, ce qui
// peut se lire comme un produit officiel. Ce bandeau étant présent sur les
// trois pages, l'y dire une fois couvre toute l'application.

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__cta">
        <p className="app-footer__cta__title">
          Une question, une suggestion ?
        </p>
        <p className="app-footer__cta__subtitle">
          Notre équipe est là pour vous accompagner.
        </p>
        <Button href="mailto:contact@passon.exemple.fr">
          Nous contacter
        </Button>
      </div>

      <div className="app-footer__brand">
        <img src={suiteLogo} alt="" className="app-footer__brand__logo" />
        <p className="app-footer__brand__name">Pass&apos;on</p>
        <p className="app-footer__brand__tagline">
          Simple. Sécurisé. Pensé pour la continuité d&apos;activité.
        </p>
        <p className="app-footer__brand__disclaimer">
          Projet indépendant construit sur La Suite numérique. Sans affiliation
          ni approbation de la DINUM ou de La Suite numérique, dont le logo
          reste la propriété.
        </p>
      </div>
    </footer>
  );
}
