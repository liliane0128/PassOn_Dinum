import { Check, LucideIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "default" | "warning" | "info" | "success";

// One restrained accent per section, used only in the "card" (Aperçu) look:
// a thin top bar + a tinted icon badge, not a colored background or a bold
// gradient -- the DSFR-ish "small tag of colour" pattern rather than
// anything louder, appropriate for a government product.
const accentConfig: Record<Tone, { icon: string; badge: string; bar: string }> = {
  default: { icon: "text-brand-600", badge: "bg-brand-50", bar: "bg-brand-500" },
  warning: { icon: "text-amber-500", badge: "bg-amber-50", bar: "bg-amber-400" },
  info: { icon: "text-indigo-600", badge: "bg-indigo-50", bar: "bg-indigo-500" },
  success: { icon: "text-teal-600", badge: "bg-teal-50", bar: "bg-teal-400" },
};

interface SectionCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  tone?: Tone;
  editing?: boolean;
  onToggleEdit?: () => void;
  // Lets a "card" (Aperçu) instance swap the pencil for a "go edit it
  // elsewhere" affordance instead, since Aperçu no longer edits inline.
  editIcon?: LucideIcon;
  editLabel?: string;
  // "card": the boxed dashboard look used in the Aperçu tab (border, shadow,
  // rounded corners). "document": plain flowing content for the "Fichier de
  // passation" tab, meant to read like one continuous Docs-style document
  // rather than a grid of separate cards.
  variant?: "card" | "document";
  // Anchor id so the "Fichier de passation" tab can be scrolled to this
  // section from elsewhere (Aperçu's "jump to edit" affordance).
  id?: string;
  // "card" variant only: a soft tint instead of plain white, for the one
  // card (Résumé) meant to read as the lead item rather than an equal
  // fourth of the grid.
  highlight?: boolean;
  children: React.ReactNode;
}

export function SectionCard({
  icon: Icon,
  iconClassName,
  title,
  tone = "default",
  editing = false,
  onToggleEdit,
  editIcon,
  editLabel = "Modifier",
  variant = "card",
  id,
  highlight = false,
  children,
}: SectionCardProps) {
  const accent = accentConfig[tone];
  const EditIcon = editIcon ?? Pencil;
  const editButton = onToggleEdit && (
    <button
      type="button"
      onClick={onToggleEdit}
      aria-label={editing ? "Terminer la modification" : editLabel}
      aria-pressed={editing}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        editing
          ? "bg-brand-600 text-white hover:bg-brand-700"
          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      )}
    >
      {editing ? <Check className="h-4 w-4" /> : <EditIcon className="h-3.5 w-3.5" />}
    </button>
  );

  if (variant === "document") {
    return (
      <section id={id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-[18px] w-[18px]", accent.icon, iconClassName)} />
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
          {editButton}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section
      id={id}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border shadow-card",
        highlight ? "border-brand-100 bg-brand-50/40" : "border-gray-200 bg-white"
      )}
    >
      <div className={cn("h-1 shrink-0", accent.bar)} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                accent.badge
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", accent.icon, iconClassName)} />
            </span>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          {editButton}
        </div>
        {children}
      </div>
    </section>
  );
}
