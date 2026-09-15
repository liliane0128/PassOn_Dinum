import { useState } from "react";
import { Button } from "@gouvfr-lasuite/ui-components";
import { useSummaries } from "../context/SummaryContext.jsx";
import { collaborators } from "../data/mockData.js";
import { getCollaboratorItems } from "../utils/collaboratorItems.js";
import "./SummaryDetails.css";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function TextListSection({ icon, title, items, onAdd, onRemove, placeholder }) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const label = draft.trim();
    if (!label) return;
    onAdd(label);
    setDraft("");
  }

  return (
    <div className="summary-section">
      <h3 className="summary-section__title">
        <span className="material-icons summary-section__icon">{icon}</span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="summary-section__empty">Aucun élément pour l'instant.</p>
      ) : (
        <ul className="summary-section__list">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.label}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Retirer « ${item.label} »`}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="summary-section__form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />
        <Button type="submit" variant="secondary" size="small">
          Ajouter
        </Button>
      </form>
    </div>
  );
}

function DeadlineSection({ items, onAdd, onRemove }) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!label.trim() || !date) return;
    onAdd(label.trim(), date);
    setLabel("");
    setDate("");
  }

  return (
    <div className="summary-section">
      <h3 className="summary-section__title">
        <span className="material-icons summary-section__icon">event</span>
        Deadlines
      </h3>
      {items.length === 0 ? (
        <p className="summary-section__empty">Aucune échéance pour l'instant.</p>
      ) : (
        <ul className="summary-section__list">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                {item.label} — {formatDate(item.date)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Retirer « ${item.label} »`}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="summary-section__form summary-section__form--deadline"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Échéance..."
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" variant="secondary" size="small">
          Ajouter
        </Button>
      </form>
    </div>
  );
}

function ContactSection({ collaboratorId, contactIds, onAdd, onRemove }) {
  const [selectedId, setSelectedId] = useState("");
  const contacts = contactIds
    .map((id) => collaborators.find((c) => c.id === id))
    .filter(Boolean);
  const available = collaborators.filter(
    (c) => c.id !== collaboratorId && !contactIds.includes(c.id),
  );

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedId) return;
    onAdd(selectedId);
    setSelectedId("");
  }

  return (
    <div className="summary-section">
      <h3 className="summary-section__title">
        <span className="material-icons summary-section__icon">person</span>
        Contacts clés
      </h3>
      {contacts.length === 0 ? (
        <p className="summary-section__empty">Aucun contact clé pour l'instant.</p>
      ) : (
        <ul className="summary-section__list">
          {contacts.map((c) => (
            <li key={c.id}>
              <span>
                <strong>
                  {c.firstName} {c.lastName}
                </strong>{" "}
                — {c.jobTitle}
              </span>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label={`Retirer ${c.firstName} ${c.lastName}`}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <form className="summary-section__form" onSubmit={handleSubmit}>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Choisir un collaborateur...</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.jobTitle}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="small">
            Ajouter
          </Button>
        </form>
      )}
    </div>
  );
}

function DocumentSection({ collaboratorId, docRefs, onAdd, onRemove }) {
  const [selectedKey, setSelectedKey] = useState("");
  const availableItems = getCollaboratorItems(collaboratorId);
  const selectedItems = docRefs
    .map((ref) =>
      availableItems.find((it) => it.type === ref.type && it.id === ref.id),
    )
    .filter(Boolean);
  const pickable = availableItems.filter(
    (it) => !docRefs.some((ref) => ref.type === it.type && ref.id === it.id),
  );

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedKey) return;
    const [type, id] = selectedKey.split(":");
    onAdd(type, id);
    setSelectedKey("");
  }

  return (
    <div className="summary-section">
      <h3 className="summary-section__title">
        <span className="material-icons summary-section__icon">
          folder_special
        </span>
        Documents importants
      </h3>
      {selectedItems.length === 0 ? (
        <p className="summary-section__empty">
          Aucun document mis en avant pour l'instant.
        </p>
      ) : (
        <ul className="summary-section__list">
          {selectedItems.map((it) => (
            <li key={`${it.type}-${it.id}`}>
              <span>
                <span className="material-icons summary-section__list__icon">
                  {it.icon}
                </span>
                {it.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(it.type, it.id)}
                aria-label={`Retirer ${it.title}`}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pickable.length > 0 && (
        <form className="summary-section__form" onSubmit={handleSubmit}>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            <option value="">Choisir un document...</option>
            {pickable.map((it) => (
              <option key={`${it.type}-${it.id}`} value={`${it.type}:${it.id}`}>
                {it.title}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="small">
            Ajouter
          </Button>
        </form>
      )}
    </div>
  );
}

// Les 6 sections structurées du résumé (actions en cours, décisions,
// deadlines, points de blocage, contacts clés, documents importants),
// partagées entre l'espace employé et l'espace manager : les deux doivent
// pouvoir lire/modifier les mêmes données (voir SummaryContext).
export function SummaryDetails({ collaboratorId }) {
  const { getSummary, updateSummary } = useSummaries();
  const summary = getSummary(collaboratorId);

  function addToList(field, item) {
    updateSummary(collaboratorId, {
      [field]: [...(summary[field] ?? []), item],
    });
  }

  function removeFromList(field, id) {
    updateSummary(collaboratorId, {
      [field]: (summary[field] ?? []).filter((x) => x.id !== id),
    });
  }

  return (
    <div className="summary-details">
      <TextListSection
        icon="task_alt"
        title="Actions en cours"
        items={summary.actions ?? []}
        onAdd={(label) => addToList("actions", { id: crypto.randomUUID(), label })}
        onRemove={(id) => removeFromList("actions", id)}
        placeholder="Nouvelle action..."
      />
      <TextListSection
        icon="gavel"
        title="Décisions importantes"
        items={summary.decisions ?? []}
        onAdd={(label) => addToList("decisions", { id: crypto.randomUUID(), label })}
        onRemove={(id) => removeFromList("decisions", id)}
        placeholder="Nouvelle décision..."
      />
      <DeadlineSection
        items={summary.deadlines ?? []}
        onAdd={(label, date) =>
          addToList("deadlines", { id: crypto.randomUUID(), label, date })
        }
        onRemove={(id) => removeFromList("deadlines", id)}
      />
      <TextListSection
        icon="report_problem"
        title="Points de blocage"
        items={summary.blockers ?? []}
        onAdd={(label) => addToList("blockers", { id: crypto.randomUUID(), label })}
        onRemove={(id) => removeFromList("blockers", id)}
        placeholder="Nouveau point de blocage..."
      />
      <ContactSection
        collaboratorId={collaboratorId}
        contactIds={summary.contactIds ?? []}
        onAdd={(id) =>
          updateSummary(collaboratorId, {
            contactIds: [...(summary.contactIds ?? []), id],
          })
        }
        onRemove={(id) =>
          updateSummary(collaboratorId, {
            contactIds: (summary.contactIds ?? []).filter((x) => x !== id),
          })
        }
      />
      <DocumentSection
        collaboratorId={collaboratorId}
        docRefs={summary.documents ?? []}
        onAdd={(type, id) =>
          updateSummary(collaboratorId, {
            documents: [...(summary.documents ?? []), { type, id }],
          })
        }
        onRemove={(type, id) =>
          updateSummary(collaboratorId, {
            documents: (summary.documents ?? []).filter(
              (x) => !(x.type === type && x.id === id),
            ),
          })
        }
      />
    </div>
  );
}
