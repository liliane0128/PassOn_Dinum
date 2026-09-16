"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Cloud, FileText } from "lucide-react";
import { SourceItem, SourceKind } from "@/lib/types";

const kindConfig: Record<SourceKind, { label: string; icon: typeof FileText }> = {
  docs: { label: "Docs", icon: FileText },
  drive: { label: "Drive", icon: Cloud },
};

export function SourcesTab({ sources }: { sources: SourceItem[] }) {
  // Expanded by default: a manager or agent opening this tab wants to see
  // what fed the passation, not have to click each category open first.
  const [collapsed, setCollapsed] = useState<Partial<Record<SourceKind, boolean>>>({});

  function toggle(kind: SourceKind) {
    setCollapsed((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {(Object.keys(kindConfig) as SourceKind[]).map((kind) => {
        const config = kindConfig[kind];
        const Icon = config.icon;
        const items = sources.filter((source) => source.kind === kind);
        const isCollapsed = collapsed[kind];

        return (
          <div key={kind} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => toggle(kind)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Icon className="h-[18px] w-[18px] text-brand-600" />
                {config.label} ({items.length})
              </span>
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {!isCollapsed && (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {items.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-400">Aucun fichier.</li>
                ) : (
                  items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-700"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                        {item.name}
                      </a>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
