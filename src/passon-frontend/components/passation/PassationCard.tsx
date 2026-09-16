"use client";

import { useState } from "react";
import { CheckCircle2, Folder, Mail, MoreVertical, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { AttentionPoint, Contact, Passation } from "@/lib/types";
import { usePassationStatus } from "@/components/PassationStatusProvider";
import { useRole } from "@/context/RoleContext";
import { ResumeSection } from "./ResumeSection";
import { PointsAttentionSection } from "./PointsAttentionSection";
import { ContactsSection } from "./ContactsSection";
import { PriorityDocsSection } from "./PriorityDocsSection";

const tabs = ["Aperçu", "Sources"] as const;
type Tab = (typeof tabs)[number];

// TODO: DINUM Messages does not yet expose a "compose with prefilled
// recipient/subject/body" deep link. Once it does, set this to that URL
// builder/endpoint and swap the mailto: fallback in handleSendByMail() below
// for a redirect to it -- the button and the rest of the UI don't need to
// change, only the body of that function.
const MESSAGES_COMPOSE_URL: string | null = null;

export function PassationCard({
  passation: initialPassation,
  onResumeCommit,
  onBlockersCommit,
  onContactsCommit,
  generating = false,
}: {
  passation: Passation;
  /** Set when the résumé is backed by the API; absent for the demo fixture. */
  onResumeCommit?: (resume: string) => void;
  /** Set when the points de blocage are backed by the API. */
  onBlockersCommit?: (points: AttentionPoint[]) => void;
  /** Set when the contacts are backed by the API. */
  onContactsCommit?: (contacts: Contact[]) => void;
  /** True while a generation is running, for the sections that are wired. */
  generating?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Aperçu");
  const [passation, setPassation] = useState<Passation>(initialPassation);
  const { getStatus, setValidated } = usePassationStatus();
  const status = getStatus(passation.id);
  const { role } = useRole();

  function handlePublish() {
    const now = new Date();
    const date = now.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setValidated(passation.id, `${date} à ${time}`);
  }

  function handleSendByMail() {
    const subject = encodeURIComponent(`Passation - ${passation.title}`);
    const body = encodeURIComponent(
      `Voici le dossier de passation généré par PassOn.\n\n${passation.title}`,
    );
    const href = MESSAGES_COMPOSE_URL ?? `mailto:?subject=${subject}&body=${body}`;
    window.location.href = href;
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

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-card">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-gray-400">Complétude</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${passation.completude}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {passation.completude}%
              </span>
            </div>
          </div>
          <button aria-label="Plus d'options" className="text-gray-400 hover:text-gray-600">
            <MoreVertical className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-5">
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
              {tab === "Sources" ? `Sources (${passation.sourcesCount})` : tab}
            </button>
          ))}
        </nav>

        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendByMail}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Mail className="h-4 w-4" />
            Envoyer par mail
          </button>
          <button
            type="button"
            onClick={handlePublish}
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
              : "Valider et publier dans Docs"}
          </button>
        </div>
      </div>

      {activeTab === "Aperçu" && (
        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <ResumeSection
              passation={passation}
              onResumeChange={updateResume}
              onResumeCommit={onResumeCommit}
              generating={generating}
            />
            <PointsAttentionSection
              passation={passation}
              onAdd={addAttentionPoint}
              onChange={updateAttentionPoint}
              onRemove={removeAttentionPoint}
              onCommit={onBlockersCommit}
              generating={generating}
            />
          </div>
          <div className="flex flex-col gap-5">
            <PriorityDocsSection passation={passation} />
            <ContactsSection
              passation={passation}
              onAdd={addContact}
              onChange={updateContact}
              onRemove={removeContact}
              onCommit={onContactsCommit}
              generating={generating}
            />
          </div>
        </div>
      )}

      {activeTab === "Sources" && (
        <div className="p-5 text-sm text-gray-500">
          {passation.sourcesCount} sources analysées pour cette passation.
        </div>
      )}
    </div>
  );
}
