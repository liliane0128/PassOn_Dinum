import { useState } from "react";
import { Button, DeleteConfirmationModal } from "@gouvfr-lasuite/ui-components";
import { useSummaries } from "../context/SummaryContext.jsx";
import { useCollaborators } from "../context/CollaboratorsContext.jsx";
import { getCollaboratorItems } from "../utils/collaboratorItems.js";
import "./SummaryDetails.css";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ItemActions({ label, onEdit, onRemove }) {
  return (
    <div className="summary-section__list__actions">
      {onEdit && (
        <button
          type="button"
          className="summary-section__list__edit"
          onClick={onEdit}
          aria-label={`Modifier « ${label} »`}
        >
          <span className="material-icons">edit</span>
        </button>
      )}
      <button
        type="button"
        className="summary-section__list__remove"
        onClick={onRemove}
        aria-label={`Retirer « ${label} »`}
      >
        <span className="material-icons">close</span>
      </button>
    </div>
  );
}

function TextListSection({ icon, title, items, onAdd, onEdit, onRemove, placeholder }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const label = draft.trim();
    if (!label) return;
    onAdd(label);
    setDraft("");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditDraft(item.label);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  function handleEditSubmit(event, id) {
    event.preventDefault();
    const label = editDraft.trim();
    if (!label) return;
    onEdit(id, label);
    setEditingId(null);
    setEditDraft("");
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
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id}>
                <form
                  className="summary-section__edit-form"
                  onSubmit={(e) => handleEditSubmit(e, item.id)}
                >
                  <input
                    type="text"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" variant="secondary" size="small">
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="small"
                    onClick={cancelEdit}
                  >
                    Annuler
                  </Button>
                </form>
              </li>
            ) : (
              <li key={item.id}>
                <span>{item.label}</span>
                <ItemActions
                  label={item.label}
                  onEdit={() => startEdit(item)}
                  onRemove={() => onRemove(item.id, item.label)}
                />
              </li>
            ),
          )}
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

function DeadlineSection({ items, onAdd, onEdit, onRemove }) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDate, setEditDate] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!label.trim() || !date) return;
    onAdd(label.trim(), date);
    setLabel("");
    setDate("");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditDate(item.date);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLabel("");
    setEditDate("");
  }

  function handleEditSubmit(event, id) {
    event.preventDefault();
    if (!editLabel.trim() || !editDate) return;
    onEdit(id, editLabel.trim(), editDate);
    setEditingId(null);
    setEditLabel("");
    setEditDate("");
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
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id}>
                <form
                  className="summary-section__edit-form summary-section__edit-form--deadline"
                  onSubmit={(e) => handleEditSubmit(e, item.id)}
                >
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" size="small">
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="small"
                    onClick={cancelEdit}
                  >
                    Annuler
                  </Button>
                </form>
              </li>
            ) : (
              <li key={item.id}>
                <span>
                  {item.label} — {formatDate(item.date)}
                </span>
                <ItemActions
                  label={item.label}
                  onEdit={() => startEdit(item)}
                  onRemove={() => onRemove(item.id, item.label)}
                />
              </li>
            ),
          )}
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

function ContactSection({ collaboratorId, contactIds, onAdd, onEdit, onRemove }) {
  const { collaborators } = useCollaborators();
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editSelection, setEditSelection] = useState("");
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

  function startEdit(contact) {
    setEditingId(contact.id);
    setEditSelection("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSelection("");
  }

  function handleEditSubmit(event, oldId) {
    event.preventDefault();
    if (!editSelection) return;
    onEdit(oldId, editSelection);
    setEditingId(null);
    setEditSelection("");
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
          {contacts.map((c) =>
            editingId === c.id ? (
              <li key={c.id}>
                <form
                  className="summary-section__edit-form"
                  onSubmit={(e) => handleEditSubmit(e, c.id)}
                >
                  <select
                    value={editSelection}
                    onChange={(e) => setEditSelection(e.target.value)}
                    autoFocus
                  >
                    <option value="">Choisir un remplaçant...</option>
                    {available.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.firstName} {opt.lastName} — {opt.jobTitle}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary" size="small">
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="small"
                    onClick={cancelEdit}
                  >
                    Annuler
                  </Button>
                </form>
              </li>
            ) : (
              <li key={c.id}>
                <span>
                  <strong>
                    {c.firstName} {c.lastName}
                  </strong>{" "}
                  — {c.jobTitle}
                </span>
                <ItemActions
                  label={`${c.firstName} ${c.lastName}`}
                  onEdit={available.length > 0 ? () => startEdit(c) : undefined}
                  onRemove={() => onRemove(c.id, `${c.firstName} ${c.lastName}`)}
                />
              </li>
            ),
          )}
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

// docRefs entries are self-contained { id, title, url } objects -- either
// produced by the backend's /api/dossier/ (real doc/drive/message ids,
// e.g. "docs:b8eb2e3a-...", with a real url) or built here from the
// frontend's own mock items when picked manually (url left null). Keeping
// a single shape means this section never needs to know which side an
// entry came from.
function DocumentSection({ collaboratorId, docRefs, onAdd, onRemove }) {
  const [selectedKey, setSelectedKey] = useState("");
  const availableItems = getCollaboratorItems(collaboratorId);
  const pickable = availableItems.filter(
    (it) => !docRefs.some((ref) => ref.id === `${it.type}:${it.id}`),
  );

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedKey) return;
    const [type, id] = selectedKey.split(":");
    const item = availableItems.find((it) => it.type === type && it.id === id);
    if (!item) return;
    onAdd({ id: selectedKey, title: item.title, url: null });
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
      {docRefs.length === 0 ? (
        <p className="summary-section__empty">
          Aucun document mis en avant pour l'instant.
        </p>
      ) : (
        <ul className="summary-section__list">
          {docRefs.map((doc) => (
            <li key={doc.id}>
              <span>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    {doc.title}
                  </a>
                ) : (
                  doc.title
                )}
              </span>
              <ItemActions
                label={doc.title}
                onRemove={() => onRemove(doc.id, doc.title)}
              />
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
              <option key={`${it.type}:${it.id}`} value={`${it.type}:${it.id}`}>
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
  const [pendingDelete, setPendingDelete] = useState(null);

  function addToList(field, item) {
    updateSummary(collaboratorId, {
      [field]: [...(summary[field] ?? []), item],
    });
  }

  function editInList(field, id, changes) {
    updateSummary(collaboratorId, {
      [field]: (summary[field] ?? []).map((x) =>
        x.id === id ? { ...x, ...changes } : x,
      ),
    });
  }

  function removeFromList(field, id) {
    updateSummary(collaboratorId, {
      [field]: (summary[field] ?? []).filter((x) => x.id !== id),
    });
  }

  // Toute suppression d'un élément déjà enregistré passe par cette
  // confirmation, plutôt que de retirer l'élément directement au clic.
  function requestRemove(label, onConfirm) {
    setPendingDelete({ label, onConfirm });
  }

  function handleDeleteDecide(decision) {
    if (decision === "delete" && pendingDelete) {
      pendingDelete.onConfirm();
    }
    setPendingDelete(null);
  }

  return (
    <div className="summary-details">
      <TextListSection
        icon="task_alt"
        title="Actions en cours"
        items={summary.actions ?? []}
        onAdd={(label) => addToList("actions", { id: crypto.randomUUID(), label })}
        onEdit={(id, label) => editInList("actions", id, { label })}
        onRemove={(id, label) =>
          requestRemove(label, () => removeFromList("actions", id))
        }
        placeholder="Nouvelle action..."
      />
      <TextListSection
        icon="gavel"
        title="Décisions importantes"
        items={summary.decisions ?? []}
        onAdd={(label) => addToList("decisions", { id: crypto.randomUUID(), label })}
        onEdit={(id, label) => editInList("decisions", id, { label })}
        onRemove={(id, label) =>
          requestRemove(label, () => removeFromList("decisions", id))
        }
        placeholder="Nouvelle décision..."
      />
      <DeadlineSection
        items={summary.deadlines ?? []}
        onAdd={(label, date) =>
          addToList("deadlines", { id: crypto.randomUUID(), label, date })
        }
        onEdit={(id, label, date) => editInList("deadlines", id, { label, date })}
        onRemove={(id, label) =>
          requestRemove(label, () => removeFromList("deadlines", id))
        }
      />
      <TextListSection
        icon="report_problem"
        title="Points de blocage"
        items={summary.blockers ?? []}
        onAdd={(label) => addToList("blockers", { id: crypto.randomUUID(), label })}
        onEdit={(id, label) => editInList("blockers", id, { label })}
        onRemove={(id, label) =>
          requestRemove(label, () => removeFromList("blockers", id))
        }
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
        onEdit={(oldId, newId) =>
          updateSummary(collaboratorId, {
            contactIds: (summary.contactIds ?? []).map((x) =>
              x === oldId ? newId : x,
            ),
          })
        }
        onRemove={(id, label) =>
          requestRemove(label, () =>
            updateSummary(collaboratorId, {
              contactIds: (summary.contactIds ?? []).filter((x) => x !== id),
            }),
          )
        }
      />
      <DocumentSection
        collaboratorId={collaboratorId}
        docRefs={summary.documents ?? []}
        onAdd={(doc) =>
          updateSummary(collaboratorId, {
            documents: [...(summary.documents ?? []), doc],
          })
        }
        onRemove={(id, label) =>
          requestRemove(label, () =>
            updateSummary(collaboratorId, {
              documents: (summary.documents ?? []).filter((x) => x.id !== id),
            }),
          )
        }
      />
      <DeleteConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onDecide={handleDeleteDecide}
      >
        {pendingDelete
          ? `Voulez-vous vraiment supprimer « ${pendingDelete.label} » ? Cette action est irréversible.`
          : null}
      </DeleteConfirmationModal>
    </div>
  );
}
