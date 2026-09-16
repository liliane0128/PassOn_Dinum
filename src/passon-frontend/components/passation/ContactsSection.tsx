import { useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { Contact, Passation } from "@/lib/types";

export function ContactsSection({
  passation,
  onAdd,
  onChange,
  onRemove,
}: {
  passation: Passation;
  onAdd: (contact: Omit<Contact, "id">) => void;
  onChange: (id: string, field: keyof Omit<Contact, "id">, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", role: "", email: "" });

  function handleAdd() {
    if (!draft.name.trim() || !draft.email.trim()) return;
    onAdd({ name: draft.name.trim(), role: draft.role.trim(), email: draft.email.trim() });
    setDraft({ name: "", role: "", email: "" });
  }

  return (
    <SectionCard
      icon={Users}
      title="Contacts clés"
      editing={isEditing}
      onToggleEdit={() => setIsEditing((v) => !v)}
    >
      <div className="flex flex-col divide-y divide-gray-100">
        {passation.contacts.map((contact) =>
          isEditing ? (
            <div key={contact.id} className="flex items-center gap-2 py-2 first:pt-0">
              <input
                value={contact.name}
                onChange={(e) => onChange(contact.id, "name", e.target.value)}
                placeholder="Nom"
                className="w-1/3 rounded-lg border border-gray-200 px-2 py-1 text-sm font-medium text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <input
                value={contact.role}
                onChange={(e) => onChange(contact.id, "role", e.target.value)}
                placeholder="Rôle"
                className="w-1/3 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-600 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <input
                value={contact.email}
                onChange={(e) => onChange(contact.id, "email", e.target.value)}
                placeholder="Email"
                className="w-1/3 rounded-lg border border-gray-200 px-2 py-1 text-sm text-brand-600 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                aria-label="Retirer ce contact"
                onClick={() => onRemove(contact.id)}
                className="shrink-0 text-gray-300 hover:text-gray-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div
              key={contact.id}
              className="grid grid-cols-3 gap-2 py-2.5 text-sm first:pt-0"
            >
              <span className="font-medium text-gray-800">{contact.name}</span>
              <span className="text-gray-500">{contact.role}</span>
              <span className="truncate text-brand-600">{contact.email}</span>
            </div>
          ),
        )}
      </div>
      {isEditing && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Nom"
            className="w-1/3 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
            placeholder="Rôle"
            className="w-1/3 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="Email"
            className="w-1/3 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Ajouter un contact"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
      {!isEditing && (
        <button className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
          Voir tous les contacts ({passation.contactsTotal})
        </button>
      )}
    </SectionCard>
  );
}
