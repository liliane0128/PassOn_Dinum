import { useState } from "react";
import { ArrowUpRight, FileType2 } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { Passation } from "@/lib/types";

export function ResumeSection({
  passation,
  onResumeChange,
  variant = "card",
  onRequestEdit,
  id,
}: {
  passation: Passation;
  onResumeChange: (resume: string) => void;
  variant?: "card" | "document";
  onRequestEdit?: () => void;
  id?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  // In Aperçu ("card"), the pencil no longer edits inline: it jumps to
  // Fichier de passation, the only place this now happens, so the two tabs
  // stop duplicating the same editable form.
  function handleToggleEdit() {
    if (variant === "card") {
      onRequestEdit?.();
      return;
    }
    setIsEditing((v) => !v);
  }

  return (
    <SectionCard
      id={id}
      icon={FileType2}
      title="Résumé"
      variant={variant}
      editing={variant === "document" && isEditing}
      onToggleEdit={handleToggleEdit}
      editIcon={variant === "card" ? ArrowUpRight : undefined}
      editLabel={variant === "card" ? "Modifier dans Fichier de passation" : "Modifier"}
      highlight
    >
      {isEditing ? (
        <textarea
          autoFocus
          value={passation.resume}
          onChange={(e) => onResumeChange(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-gray-200 p-1.5 text-sm leading-relaxed text-gray-600 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      ) : (
        <p className="text-sm leading-relaxed text-gray-600">{passation.resume}</p>
      )}
    </SectionCard>
  );
}
