import { useState } from "react";
import { ArrowUpRight, Plus, TriangleAlert, X } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { AttentionPoint, Passation } from "@/lib/types";

export function PointsAttentionSection({
  passation,
  onAdd,
  onChange,
  onRemove,
  variant = "card",
  onRequestEdit,
  id,
  onCommit,
}: {
  passation: Passation;
  onAdd: (label: string) => void;
  onChange: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  variant?: "card" | "document";
  onRequestEdit?: () => void;
  id?: string;
  /** Called when the editor is closed, with the list to store. */
  onCommit?: (points: AttentionPoint[]) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const label = draft.trim();
    if (!label) return;
    onAdd(label);
    setDraft("");
  }

  function handleToggleEdit() {
    if (variant === "card") {
      onRequestEdit?.();
      return;
    }
    // Closing the editor is when the edits are meant to stick; saving on
    // every keystroke would be one PATCH per character typed.
    if (isEditing) onCommit?.(passation.attentionPoints);
    setIsEditing((v) => !v);
  }

  return (
    <SectionCard
      id={id}
      icon={TriangleAlert}
      title="Points de blocage"
      tone="warning"
      variant={variant}
      editing={variant === "document" && isEditing}
      onToggleEdit={handleToggleEdit}
      editIcon={variant === "card" ? ArrowUpRight : undefined}
      editLabel={variant === "card" ? "Modifier dans Fichier de passation" : "Modifier"}
    >
      <ul className="flex flex-col gap-2">
        {passation.attentionPoints.map((point) =>
          isEditing ? (
            <li key={point.id} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <input
                value={point.label}
                onChange={(e) => onChange(point.id, e.target.value)}
                className="flex-1 rounded-lg border border-transparent p-1 leading-relaxed text-gray-600 hover:border-gray-200 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                aria-label="Retirer ce point de blocage"
                onClick={() => onRemove(point.id)}
                className="mt-1 shrink-0 text-gray-300 hover:text-gray-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ) : (
            <li key={point.id} className="flex gap-2 text-sm text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="leading-relaxed">{point.label}</span>
            </li>
          ),
        )}
      </ul>
      {isEditing && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="Nouveau point de blocage..."
            className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Ajouter un point de blocage"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </SectionCard>
  );
}
