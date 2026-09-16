import { useState } from "react";
import { Cloud, FileText, FileType2, LoaderCircle, Mail } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { Passation, SourceKind } from "@/lib/types";

const tagConfig: Record<
  SourceKind,
  { label: string; icon: typeof Mail }
> = {
  email: { label: "Email", icon: Mail },
  docs: { label: "Docs", icon: FileText },
  drive: { label: "Drive", icon: Cloud },
};

export function ResumeSection({
  passation,
  onResumeChange,
  onResumeCommit,
  generating = false,
}: {
  passation: Passation;
  onResumeChange: (resume: string) => void;
  /** Called when the editor is closed, with the text to keep. */
  onResumeCommit?: (resume: string) => void;
  /** True while the model is composing this résumé. */
  generating?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function toggleEdit() {
    // Closing the editor is the moment the edit is meant to stick; saving on
    // every keystroke would be a PATCH per character.
    if (isEditing) onResumeCommit?.(passation.resume);
    setIsEditing((v) => !v);
  }

  return (
    <SectionCard
      icon={FileType2}
      title="Résumé"
      editing={isEditing}
      onToggleEdit={toggleEdit}
    >
      {generating ? (
        // No placeholder prose here: a fixed sentence sitting where the résumé
        // belongs reads like a template, which is precisely what this section
        // must never look like.
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin text-brand-600" />
          Lecture de vos documents et de vos mails, puis rédaction du résumé…
        </p>
      ) : isEditing ? (
        <textarea
          autoFocus
          value={passation.resume}
          onChange={(e) => onResumeChange(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-gray-200 p-1.5 text-sm leading-relaxed text-gray-600 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
          {passation.resume || (
            <span className="text-gray-400">
              Aucun résumé : la génération n&rsquo;a rien pu produire.
            </span>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {passation.sourceTags.map((tag) => {
          const config = tagConfig[tag.kind];
          const Icon = config.icon;
          return (
            <span
              key={tag.kind}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
            >
              <Icon className="h-3.5 w-3.5" />
              {config.label} ({tag.count})
            </span>
          );
        })}
      </div>
    </SectionCard>
  );
}
