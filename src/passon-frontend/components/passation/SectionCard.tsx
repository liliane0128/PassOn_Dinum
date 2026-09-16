import { Check, LucideIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

interface SectionCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  tone?: "default" | "warning";
  editing?: boolean;
  onToggleEdit?: () => void;
  children: React.ReactNode;
}

export function SectionCard({
  icon: Icon,
  iconClassName,
  title,
  tone = "default",
  editing = false,
  onToggleEdit,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "h-[18px] w-[18px]",
              tone === "warning" ? "text-amber-500" : "text-brand-600",
              iconClassName
            )}
          />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {onToggleEdit && (
          <button
            type="button"
            onClick={onToggleEdit}
            aria-label={editing ? "Terminer la modification" : "Modifier"}
            aria-pressed={editing}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              editing
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            )}
          >
            {editing ? (
              <Check className="h-4 w-4" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
