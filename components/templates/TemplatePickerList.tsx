import {
  Check,
  FileText,
  GalleryHorizontal,
  Gift,
  ImageIcon,
  MapPin,
  Search,
  Type,
  Video
} from "lucide-react";
import { useMemo, useState } from "react";

import { MessageTemplate } from "@/client-api/types/templates.type";
import { TemplateCategoryBadge } from "@/components/shared/StatusBadges";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const templateKind = (template: MessageTemplate) => {
  const has = (type: string) =>
    template.components.some((component) => component.type === type);
  if (has("CAROUSEL")) return { label: "Carousel", icon: GalleryHorizontal };
  if (has("LIMITED_TIME_OFFER")) return { label: "Offer", icon: Gift };
  const header = template.components.find(
    (component) => component.type === "HEADER"
  );
  switch (header?.format) {
    case "IMAGE":
      return { label: "Image", icon: ImageIcon };
    case "VIDEO":
      return { label: "Video", icon: Video };
    case "DOCUMENT":
      return { label: "Document", icon: FileText };
    case "LOCATION":
      return { label: "Location", icon: MapPin };
    default:
      return { label: "Text", icon: Type };
  }
};

export const templateBodyText = (template: MessageTemplate) =>
  template.components.find((component) => component.type === "BODY")?.text ||
  "";

// Searchable cards of approved templates: the broadcast wizard's first step
// and the inbox's "send a template" dialog.
export function TemplatePickerList({
  templates,
  selectedId,
  onSelect,
  isLoading,
  emptyText = "No approved templates yet.",
  className
}: {
  templates: MessageTemplate[];
  selectedId?: string;
  onSelect: (template: MessageTemplate) => void;
  isLoading?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter(
      (template) =>
        !needle ||
        template.name.toLowerCase().includes(needle) ||
        templateBodyText(template).toLowerCase().includes(needle)
    );
  }, [query, templates]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search templates"
          aria-label="Search templates"
          className="h-10 pl-9"
        />
      </div>
      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : visible.length ? (
        <div
          role="listbox"
          aria-label="Approved templates"
          className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
        >
          {visible.map((template) => {
            const kind = templateKind(template);
            const Icon = kind.icon;
            const isSelected = selectedId === template.templateId;
            return (
              <button
                key={template.templateId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(template)}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left transition hover:border-primary/40",
                  isSelected && "border-primary ring-1 ring-primary"
                )}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <span className="flex items-center gap-2 pr-6">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">
                    {template.name}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <TemplateCategoryBadge category={template.category} />
                  <span className="text-[11px] text-muted-foreground">
                    {kind.label} · {template.language}
                  </span>
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {templateBodyText(template)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg bg-muted/50 p-6 text-center text-sm text-muted-foreground">
          {query ? "No templates match that search." : emptyText}
        </p>
      )}
    </div>
  );
}
