import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "@gouvfr-lasuite/ui-components";
import { slugify } from "../utils/user.js";
import "./HomePage.css";

export function HomePage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const canSubmit = firstName.trim() !== "" && lastName.trim() !== "";

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    navigate(`/utilisateur/${slugify(firstName, lastName)}`, {
      state: { firstName: firstName.trim(), lastName: lastName.trim() },
    });
  }

  return (
    <div className="home-page">
      <form className="home-page__card" onSubmit={handleSubmit}>
        <h1 className="home-page__title">Continuité d'activité</h1>
        <p className="home-page__subtitle">
          Renseignez le prénom et le nom du collègue dont vous devez reprendre
          le travail, pour consulter ses mails et documents.
        </p>

        <Input
          label="Prénom du collègue"
          fullWidth
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />

        <Input
          label="Nom du collègue"
          fullWidth
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />

        <Button type="submit" fullWidth disabled={!canSubmit}>
          Voir ses mails et documents
        </Button>

        <p className="home-page__disclaimer">
          Prototype : aucun contrôle d'accès pour l'instant. Un système de
          permissions (visibilité limitée à son N-1 ou plus) sera ajouté par
          la suite.
        </p>
      </form>
    </div>
  );
}
