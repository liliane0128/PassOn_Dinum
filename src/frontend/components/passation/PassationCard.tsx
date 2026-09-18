"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Folder, RotateCcw, Send, SquarePen } from "lucide-react";
import { cn } from "@/lib/cn";
import { AttentionPoint, Contact, DocumentAssocie, Passation } from "@/lib/types";
import { usePassationStatus } from "@/components/PassationStatusProvider";
import { useRole } from "@/context/RoleContext";
import { ResumeSection } from "./ResumeSection";
import { PointsAttentionSection } from "./PointsAttentionSection";
import { ContactsSection } from "./ContactsSection";
import { PriorityDocsSection } from "./PriorityDocsSection";
import { SourcesTab } from "./SourcesTab";

const tabs = ["Aperçu", "Fichier de passation", "Sources"] as const;
type Tab = (typeof tabs)[number];

// TODO: replace with the real Docs URL for this passation once publishing
// actually creates a document there (see connectors/generation.py in the
// backend) -- for now every "Voir dans Docs" / "Modifier dans Docs" link
// points at this placeholder.
const DOCS_PLACEHOLDER_URL = "https://docs.numerique.gouv.fr/docs/placeholder-passation";

const secondaryLinkClass =
  "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";

export function PassationCard({
  passation: initialPassation,
  onRegenerate,
  onResumeCommit,
  onBlockersCommit,
  onContactsCommit,
  onValidate,
}: {
  passation: Passation;
  onRegenerate?: () => void;
  /** Set when the sections are backed by the API; absent for the fixture. */
  onResumeCommit?: (resume: string) => void;
  onBlockersCommit?: (points: AttentionPoint[]) => void;
  onContactsCommit?: (contacts: Contact[]) => void;
  /** Set when validation is stored server-side. */
  onValidate?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Aperçu");
  const [passation, setPassation] = useState<Passation>(initialPassation);

  // Re-seed when the stored sheet changes -- a save, a validation, a new
  // generation -- keyed on its timestamp rather than on the object, which the
  // board rebuilds on every render. The card used to be remounted for this,
  // which also reset the active tab: closing an editor in "Fichier de
  // passation" threw the reader back to "Aperçu" mid-edit.
  useEffect(() => {
    setPassation(initialPassation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPassation.lastUpdated, initialPassation.id]);
  const { getStatus, setValidated } = usePassationStatus();
  const status = getStatus(passation.id);
  const { role } = useRole();
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  // The manager's own action on someone else's sheet: separate from
  // `status.validated` above (the agent validating their own sheet) on
  // purpose -- a manager reviewing and transferring a dossier is a different
  // event from the agent having signed off on it, and conflating the two
  // would make "Validée par l'agent" in the header lie the moment a manager
  // clicked their own button. Local to this card, like the rest of this
  // component's edits when there is no onXCommit to persist them.
  const [transferred, setTransferred] = useState(false);
  const [transferredAt, setTransferredAt] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  function confirmTransfer() {
    const now = new Date();
    const date = now.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setTransferred(true);
    setTransferredAt(`${date} à ${time}`);
    setShowTransferConfirm(false);
  }

  // Aperçu no longer edits inline (see ResumeSection/PointsAttentionSection/
  // ContactsSection's onRequestEdit): its pencil jumps here instead, to the
  // matching section, so there is only one place these fields are actually
  // editable.
  function jumpToDocument(sectionId: string) {
    setActiveTab("Fichier de passation");
    setScrollTarget(sectionId);
  }

  useEffect(() => {
    if (activeTab === "Fichier de passation" && scrollTarget) {
      const el = document.getElementById(scrollTarget);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTarget(null);
    }
  }, [activeTab, scrollTarget]);

  function handlePublish() {
    // Backed by the API: validation is stored there and the shared status is
    // refreshed from the answer, since the manager's "Mon équipe" reads the
    // same flag.
    if (onValidate) {
      onValidate();
      return;
    }

    const now = new Date();
    const date = now.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setValidated(passation.id, `${date} à ${time}`);
  }

  function confirmPublish() {
    handlePublish();
    setShowPublishConfirm(false);
  }

  function updateResume(resume: string) {
    setPassation((prev) => ({ ...prev, resume }));
  }

  function addAttentionPoint(label: string) {
    setPassation((prev) => ({
      ...prev,
      attentionPoints: [
        ...prev.attentionPoints,
        { id: crypto.randomUUID(), label },
      ],
    }));
  }

  function updateAttentionPoint(id: string, label: string) {
    setPassation((prev) => ({
      ...prev,
      attentionPoints: prev.attentionPoints.map((point) =>
        point.id === id ? { ...point, label } : point,
      ),
    }));
  }

  function removeAttentionPoint(id: string) {
    setPassation((prev) => ({
      ...prev,
      attentionPoints: prev.attentionPoints.filter((point) => point.id !== id),
    }));
  }

  function addContact(contact: Omit<Contact, "id">) {
    setPassation((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { ...contact, id: crypto.randomUUID() }],
    }));
  }

  function updateContact(id: string, field: keyof Omit<Contact, "id">, value: string) {
    setPassation((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    }));
  }

  function removeContact(id: string) {
    setPassation((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((contact) => contact.id !== id),
    }));
  }

  function addDocument(document: Omit<DocumentAssocie, "id">) {
    setPassation((prev) => ({
      ...prev,
      documents: [...prev.documents, { ...document, id: crypto.randomUUID() }],
    }));
  }

  function removeDocument(id: string) {
    setPassation((prev) => ({
      ...prev,
      documents: prev.documents.filter((document) => document.id !== id),
    }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-card">
      <div className="flex shrink-0 flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Folder className="h-5 w-5 text-brand-600" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                {passation.title}
              </h2>
              {status.validated ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                  {role === "manager" ? "Validée par l’agent" : "Validée"}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  {role === "manager"
                    ? "En attente de validation par l’agent"
                    : "En attente de validation"}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Dernière mise à jour : {passation.lastUpdated}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* A manager reviewing someone else's sheet does not get to
              regenerate it -- that action belongs to the agent it's about. */}
          {onRegenerate && role !== "manager" && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Régénérer
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-5">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 py-3 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab === "Sources" ? `Sources (${passation.sources.length})` : tab}
            </button>
          ))}
        </nav>

        <div className="my-3 flex items-center gap-2">
          {activeTab === "Fichier de passation" && (
            <>
              {role === "agent" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPublishConfirm(true)}
                    disabled={status.validated}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold shadow-card transition-colors",
                      status.validated
                        ? "cursor-not-allowed bg-emerald-50 text-emerald-700"
                        : "bg-brand-600 text-white hover:bg-brand-700"
                    )}
                  >
                    {status.validated ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {status.validated
                      ? `Publiée dans Docs · ${status.validatedAt}`
                      : "Valider et publier"}
                  </button>
                  {status.validated && (
                    <>
                      <a
                        href={DOCS_PLACEHOLDER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={secondaryLinkClass}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Voir dans Docs
                      </a>
                      <a
                        href={DOCS_PLACEHOLDER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={secondaryLinkClass}
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                        Modifier dans Docs
                      </a>
                    </>
                  )}
                </>
              ) : (
                <>
                  {transferred ? (
                    <span className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Transférée · {transferredAt}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTransferConfirm(true)}
                      className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
                    >
                      <Send className="h-4 w-4" />
                      Valider et transférer
                    </button>
                  )}
                  {status.validated && (
                    <>
                      <a
                        href={DOCS_PLACEHOLDER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={secondaryLinkClass}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Voir dans Docs
                      </a>
                      <a
                        href={DOCS_PLACEHOLDER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={secondaryLinkClass}
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                        Modifier dans Docs
                      </a>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "Aperçu" && (
          <div className="grid grid-cols-1 gap-4 p-5 lg:h-full lg:grid-cols-2 lg:grid-rows-2">
            <ResumeSection
              passation={passation}
              onResumeChange={updateResume}
              onRequestEdit={() => jumpToDocument("section-resume")}
            />
            <PriorityDocsSection
              passation={passation}
              onAddDocument={addDocument}
              onRemoveDocument={removeDocument}
              onRequestEdit={() => jumpToDocument("section-priority-docs")}
            />
            <PointsAttentionSection
              passation={passation}
              onAdd={addAttentionPoint}
              onChange={updateAttentionPoint}
              onRemove={removeAttentionPoint}
              onRequestEdit={() => jumpToDocument("section-blocage")}
            />
            <ContactsSection
              passation={passation}
              onAdd={addContact}
              onChange={updateContact}
              onRemove={removeContact}
              onRequestEdit={() => jumpToDocument("section-contacts")}
            />
          </div>
        )}

        {activeTab === "Fichier de passation" && (
          <div className="bg-gray-50 p-5 sm:p-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-gray-200 bg-white p-8 shadow-card sm:p-12">
              <div className="border-b border-gray-100 pb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Fiche de passation — {passation.title}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Dernière mise à jour : {passation.lastUpdated}
                </p>
              </div>
              <ResumeSection
                passation={passation}
                onResumeChange={updateResume}
                onResumeCommit={onResumeCommit}
                variant="document"
                id="section-resume"
              />
              <PointsAttentionSection
                passation={passation}
                onAdd={addAttentionPoint}
                onChange={updateAttentionPoint}
                onRemove={removeAttentionPoint}
                onCommit={onBlockersCommit}
                variant="document"
                id="section-blocage"
              />
              <PriorityDocsSection
                passation={passation}
                onAddDocument={addDocument}
                onRemoveDocument={removeDocument}
                variant="document"
                id="section-priority-docs"
              />
              <ContactsSection
                passation={passation}
                onAdd={addContact}
                onChange={updateContact}
                onRemove={removeContact}
                onCommit={onContactsCommit}
                variant="document"
                id="section-contacts"
              />
            </div>
          </div>
        )}

        {activeTab === "Sources" && <SourcesTab sources={passation.sources} />}
      </div>

      {showPublishConfirm && (
        // No scrim: the page stays as it was and only the dialog appears over
        // it. The layer still covers the viewport so a click outside lands
        // here rather than on the sheet behind, it just does not dim it --
        // hence the ring and the deeper shadow, which is what separates the
        // dialog from the page now that the darkening is gone.
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-gray-900/10">
            <h3 className="text-base font-semibold text-gray-900">
              Publier ce dossier dans Docs ?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              En validant, ce dossier sera publié dans Docs et accessible à votre remplaçant.
              Vous pourrez encore le modifier dans Docs après publication.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPublishConfirm(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmPublish}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-1 ring-gray-900/10">
            <h3 className="text-base font-semibold text-gray-900">
              Valider et transférer ce dossier ?
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              En confirmant, vous validez cette fiche de passation en tant que manager et la
              transférez officiellement à l'équipe. Elle restera consultable ensuite.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTransferConfirm(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmTransfer}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
