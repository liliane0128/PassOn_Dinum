import { useState } from "react";
import { Button, DeleteConfirmationModal } from "@gouvfr-lasuite/ui-components";
import { useSummaries } from "../context/SummaryContext.jsx";
import { useCollaborators } from "../context/CollaboratorsContext.jsx";
import { useItems } from "../context/ItemsContext.jsx";
import "./SummaryDetails.css";

function formatDate(iso) {
  // The AI-generated summary can hand back a deadline with no date yet (a
  // real deadline whose trigger date isn't known -- see generation.py's
  // module docstring): `new Date(null)` silently resolves to the Unix
  // epoch, which rendered as "01/01/1970" instead of admitting there's no
  // date.
  if (!iso) return "date à confirmer";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// An AI-generated action/decision/deadline/blocker can carry `evidence`
// (see generation.py): the items that justify it, resolved backend-side so
// a hallucinated title/author/date/content/url can never reach here. A
// manually-added or older bullet simply has none -- render nothing rather
// than an empty note.
//
// `url` isn't necessarily something a browser can open (mock/synthetic ids,
// or a real item's REST resource_url rather than a page -- see
// generation.py's module docstring), so the primary way to check an
// evidence entry is to read its `content` right here, not to follow a link
// that may go nowhere. Click-to-expand mirrors CollaboratorItemsList.jsx's
// pattern for the same reason: a short preview by default, full text on
// demand.
function EvidenceList({ evidence }) {
  const [expandedId, setExpandedId] = useState(null);
  if (!evidence || evidence.length === 0) return null;
  return (
    <ul className="summary-section__evidence">
      {evidence.map((ref) => {
        const isExpanded = expandedId === ref.id;
        return (
          <li key={ref.id}>
            <button
              type="button"
              className="summary-section__evidence__toggle"
              onClick={() => setExpandedId(isExpanded ? null : ref.id)}
              aria-expanded={isExpanded}
            >
              <span>{ref.title || ref.id}</span>
              <span className="material-icons">
                {isExpanded ? "expand_less" : "expand_more"}
              </span>
            </button>
            {isExpanded && (
              <div className="summary-section__evidence__detail">
                {(ref.author || ref.date) && (
                  <p className="summary-section__evidence__meta">
                    {[ref.author, ref.date ? formatDate(ref.date) : null]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                )}
                <p className="summary-section__evidence__content">
                  {ref.content || "Aucun aperçu disponible."}
                </p>
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noreferrer">
                    Ouvrir la source
                  </a>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
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
                <div className="summary-section__list__main">
                  <span>{item.label}</span>
                  <EvidenceList evidence={item.evidence} />
                </div>
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
    // item.date can be null (see formatDate above); the date <input> needs a
    // string, not null, to stay a controlled input.
    setEditDate(item.date ?? "");
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
                <div className="summary-section__list__main">
                  <span>
                    {item.label} — {formatDate(item.date)}
                  </span>
                  <EvidenceList evidence={item.evidence} />
                </div>
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
// Un élément réel porte déjà l'identifiant du backend ("drive:<uuid>"), celui
// que le résumé généré utilise dans ses "documents importants" ; les éléments
// mockés n'en ont pas, on le reconstruit. Comparer des clés entières plutôt
// que de découper sur ":" évite de casser sur les identifiants composés.
function itemKey(item) {
  return item.refId ?? `${item.type}:${item.id}`;
}

function DocumentSection({ collaboratorId, docRefs, onAdd, onRemove }) {
  const [selectedKey, setSelectedKey] = useState("");
  const { getItems } = useItems();
  const availableItems = getItems(collaboratorId);
  const pickable = availableItems.filter(
    (it) => !docRefs.some((ref) => ref.id === itemKey(it)),
  );

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedKey) return;
    const item = availableItems.find((it) => itemKey(it) === selectedKey);
    if (!item) return;
    onAdd({ id: selectedKey, title: item.title, url: item.url ?? null });
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
              <option key={itemKey(it)} value={itemKey(it)}>
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
    const list = summary[field] ?? [];
    const at = list.findIndex((x) => x.id === id);
    if (at === -1) return;
    updateSummary(collaboratorId, {
      [field]: list.map((x, i) => (i === at ? { ...x, ...changes } : x)),
    });
  }

  // Par position, une seule à la fois : filtrer sur l'identifiant supprimait
  // toute la section dès que deux puces le partageaient -- ou, pire, quand
  // aucune n'en avait.
  function removeFromList(field, id) {
    const list = summary[field] ?? [];
    const at = list.findIndex((x) => x.id === id);
    if (at === -1) return;
    updateSummary(collaboratorId, {
      [field]: list.filter((_, i) => i !== at),
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
