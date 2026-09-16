"use client";

import { useState } from "react";
import { FileText, UserRoundCog } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { Passation } from "@/lib/types";
import { teamMembers } from "@/lib/mock-data";

export function PriorityDocsSection({ passation }: { passation: Passation }) {
  // Local to this component on purpose: unlike validated/validatedAt (see
  // PassationStatusProvider), the current owner of a document doesn't need
  // to be shared across pages, so a plain useState is enough here.
  const [owners, setOwners] = useState<Record<string, string>>(() =>
    Object.fromEntries(passation.documents.map((doc) => [doc.id, doc.proprietaire])),
  );
  const [openFor, setOpenFor] = useState<string | null>(null);

  function handleTransfer(documentId: string, newOwner: string) {
    // TODO: this only simulates the transfer in local state. Once it's
    // confirmed whether Drive's API exposes a real endpoint for reassigning
    // a document's owner, call that here instead -- the button/popover UI
    // below does not need to change, only this function's body.
    setOwners((prev) => ({ ...prev, [documentId]: newOwner }));
    setOpenFor(null);
  }

  return (
    <SectionCard icon={FileText} title={`Docs prioritaires (${passation.documentsTotal})`}>
      <ul className="flex flex-col divide-y divide-gray-100">
        {passation.documents.map((doc) => (
          <li
            key={doc.id}
            className="relative flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0"
          >
            {/* min-w-0 + truncate: real file names ("compte-rendu-comite-
                technique-2026-09-10.md") are far longer than the demo ones and
                wrapped mid-word, breaking the row apart. */}
            <span className="flex min-w-0 flex-1 items-center gap-2 text-gray-800">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate" title={doc.name}>
                {doc.name}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3">
              <span className="whitespace-nowrap text-gray-500">{doc.date}</span>
              <span className="whitespace-nowrap text-gray-500">
                Propriétaire :{" "}
                <span className="font-medium text-gray-700">{owners[doc.id]}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenFor(openFor === doc.id ? null : doc.id)}
                aria-label={`Transférer la propriété de ${doc.name}`}
                title="Transférer la propriété"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              >
                <UserRoundCog className="h-3.5 w-3.5" />
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
      <button className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
        Voir tous les docs prioritaires ({passation.documentsTotal})
      </button>
    </SectionCard>
  );
}
