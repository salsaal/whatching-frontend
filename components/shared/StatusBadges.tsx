import type { DripStatus } from "@/client-api/types/drips.type";
import { dripStatusPresentation } from "@/lib/drips";
import {
  badgeToneClass,
  broadcastStatusPresentation,
  StatusPresentation,
  templateCategoryPresentation,
  templateStatusPresentation
} from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";

function Badge({
  presentation,
  className
}: {
  presentation: StatusPresentation;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        badgeToneClass[presentation.tone],
        className
      )}
    >
      {presentation.live && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      )}
      {presentation.label}
    </span>
  );
}

export function TemplateStatusBadge({
  status,
  className
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <Badge
      presentation={templateStatusPresentation(status)}
      className={className}
    />
  );
}

export function TemplateCategoryBadge({
  category,
  className
}: {
  category?: string | null;
  className?: string;
}) {
  return (
    <Badge
      presentation={templateCategoryPresentation(category)}
      className={cn("font-medium", className)}
    />
  );
}

export function BroadcastStatusBadge({
  status,
  scheduledAt,
  className
}: {
  status?: string | null;
  scheduledAt?: string | null;
  className?: string;
}) {
  return (
    <Badge
      presentation={broadcastStatusPresentation(status, scheduledAt)}
      className={className}
    />
  );
}

export function DripStatusBadge({
  status,
  className
}: {
  status?: DripStatus | null;
  className?: string;
}) {
  return (
    <Badge
      presentation={dripStatusPresentation(status)}
      className={className}
    />
  );
}
