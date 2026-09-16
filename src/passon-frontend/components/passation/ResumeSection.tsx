import { useState } from "react";
import { Cloud, FileText, FileType2, Mail } from "lucide-react";
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
}: {
  passation: Passation;
  onResumeChange: (resume: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <SectionCard
      icon={FileType2}
      title="Résumé"
      editing={isEditing}
      onToggleEdit={() => setIsEditing((v) => !v)}
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
