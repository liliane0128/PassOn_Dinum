"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Plus, UserRoundCog, X } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { DocumentAssocie, Passation } from "@/lib/types";
import { currentUser, teamMembers } from "@/lib/mock-data";

export function PriorityDocsSection({
  passation,
  onAddDocument,
  onRemoveDocument,
  variant = "card",
  onRequestEdit,
  id,
}: {
  passation: Passation;
  onAddDocument: (document: Omit<DocumentAssocie, "id">) => void;
  onRemoveDocument: (id: string) => void;
  variant?: "card" | "document";
  onRequestEdit?: () => void;
  id?: string;
}) {
  // Local to this component on purpose: unlike validated/validatedAt (see
  // PassationStatusProvider), the current owner of a document doesn't need
  // to be shared across pages, so a plain useState is enough here.
  const [owners, setOwners] = useState<Record<string, string>>(() =>
    Object.fromEntries(passation.documents.map((doc) => [doc.id, doc.proprietaire])),
  );
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [unclearOwnerAlertOpen, setUnclearOwnerAlertOpen] = useState(false);
  const [unclearOwnerPickerOpen, setUnclearOwnerPickerOpen] = useState(false);

  // A document still owned by the departing agent (currentUser) doesn't have
  // a clear owner going forward -- that's what the banner above the list
  // tracks and lets the user clear in one batch action.
  const unassignedDocIds = passation.documents
    .filter((doc) => (owners[doc.id] ?? doc.proprietaire) === currentUser.name)
    .map((doc) => doc.id);
  const unassignedCount = unassignedDocIds.length;

  // passation.documents is owned by PassationCard (add/remove go through it,
  // same as contacts/points de blocage), so ids for new rows are generated
  // there. Keep the local owners map in step with whatever that list ends up
  // being, rather than only ever seeding it once on mount.
  useEffect(() => {
    setOwners((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const doc of passation.documents) {
        next[doc.id] = doc.id in prev ? prev[doc.id] : doc.proprietaire;
        if (next[doc.id] !== prev[doc.id]) changed = true;
      }
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
  }, [passation.documents]);

  function handleAddDocument() {
    if (!draftName.trim()) return;
    onAddDocument({
      name: draftName.trim(),
      date: draftDate.trim(),
      proprietaire: currentUser.name,
    });
    setDraftName("");
    setDraftDate("");
  }

  function handleTransfer(documentId: string, newOwner: string) {
    // TODO: this only simulates the transfer in local state. Once it's
    // confirmed whether Drive's API exposes a real endpoint for reassigning
    // a document's owner, call that here instead -- the button/popover UI
    // below does not need to change, only this function's body.
    setOwners((prev) => ({ ...prev, [documentId]: newOwner }));
    setOpenFor(null);
  }

  function handleReassignAllUnclearOwners(newOwner: string) {
    // Same simulation as handleTransfer above, but targets every document
    // still sitting with the departing agent rather than a manual selection.
    setOwners((prev) => {
      const next = { ...prev };
      for (const id of unassignedDocIds) next[id] = newOwner;
      return next;
    });
    setUnclearOwnerPickerOpen(false);
    setUnclearOwnerAlertOpen(false);
  }

  return (
    <SectionCard
      id={id}
      icon={FileText}
      title={`Dossiers propritaires (${passation.documentsTotal})`}
      tone="info"
      variant={variant}
      headerExtra={
        <div className="relative">
          {unassignedCount > 0 ? (
            <button
              type="button"
              onClick={() => setUnclearOwnerAlertOpen((v) => !v)}
              aria-label={`${unassignedCount} dossier${unassignedCount > 1 ? "s" : ""} sans propriétaire clair`}
              title="Dossiers sans propriétaire clair"
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
                {unassignedCount}
              </span>
            </button>
          ) : null}

          {unclearOwnerAlertOpen && unassignedCount > 0 && (
            <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {unassignedCount} dossier{unassignedCount > 1 ? "s" : ""} n’
                {unassignedCount > 1 ? "ont" : "a"} plus de propriétaire clair
              </div>
              <div className="relative mt-3">
                <button
                  type="button"
                  onClick={() => setUnclearOwnerPickerOpen((v) => !v)}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700"
                >
                  Transférer la propriété
                </button>
                {unclearOwnerPickerOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-card">
                    {teamMembers
                      .filter((member) => member.name !== currentUser.name)
                      .map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleReassignAllUnclearOwners(member.name)}
                          className="flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {member.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    >
      <ul className="flex flex-col divide-y divide-gray-100">
        {passation.documents.map((doc) => (
          <li
            key={doc.id}
            className="relative flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0"
          >
            {/* min-w-0 + truncate: real file names
                ("compte-rendu-comite-technique-2026-09-10.md") are far longer
                than the demo ones and wrap mid-word without this. */}
            <span className="flex min-w-0 flex-1 items-center gap-2 text-gray-800">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate" title={doc.name}>
                {doc.name}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3">
              <span className="whitespace-nowrap text-gray-500">{doc.date}</span>
              <button
                type="button"
                onClick={() => setOpenFor(openFor === doc.id ? null : doc.id)}
                aria-label={`Transférer la propriété de ${doc.name}`}
                title="Transférer la propriété"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              >
                <UserRoundCog className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveDocument(doc.id)}
                aria-label={`Supprimer ${doc.name}`}
                title="Supprimer ce dossier"
                className="shrink-0 text-gray-300 hover:text-gray-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>

            {openFor === doc.id && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-card">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleTransfer(doc.id, member.name)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Nouveau dossier..."
          className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <input
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddDocument();
          }}
          placeholder="Date"
          className="w-32 shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="button"
          onClick={handleAddDocument}
          aria-label="Ajouter un dossier"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRequestEdit}
        aria-label="Voir tous les dossiers propritaires dans Fichier de passation"
        className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ...
      </button>
    </SectionCard>
  );
}
