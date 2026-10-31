import {
  Copy,
  Edit3,
  ImagePlus,
  Megaphone,
  MoreHorizontal,
  Trash2
} from "lucide-react";
import { useRef, useState } from "react";

import { MessageTemplate } from "@/client-api/types/templates.type";
import {
  TemplateCategoryBadge,
  TemplateStatusBadge
} from "@/components/shared/StatusBadges";
import {
  templateBodyText,
  templateKind
} from "@/components/templates/TemplatePickerList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { WhatsAppPreview } from "@/components/whatsapp/WhatsAppPreview";
import { formatRelative } from "@/lib/displayFormat";
import { templateStatusHint } from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";
import { templateNeedsMedia } from "./templateUtils";

export interface TemplateRowActions {
  onOpen: (template: MessageTemplate) => void;
  onDelete: (template: MessageTemplate) => void;
  onDuplicate: (template: MessageTemplate) => void;
  onUseInBroadcast?: (template: MessageTemplate) => void;
  onLinkMedia?: (template: MessageTemplate) => void;
}

interface TemplatesTableProps extends TemplateRowActions {
  templates: MessageTemplate[];
  isLoading: boolean;
  deletingId?: string | null;
  // View-only members see the list but none of the edit/delete actions.
  canManage?: boolean;
}

const qualityTone = (value: MessageTemplate["qualityScore"]) => {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? value.score || ""
        : "";
  const score = raw.toUpperCase();
  if (score.includes("GREEN") || score === "HIGH")
    return { dot: "bg-emerald-500", label: "High" };
  if (score.includes("YELLOW") || score === "MEDIUM")
    return { dot: "bg-amber-500", label: "Medium" };
  if (score.includes("RED") || score === "LOW")
    return { dot: "bg-red-500", label: "Low" };
  return null;
};

const isDraft = (template: MessageTemplate) =>
  template.source === "draft" || template.status.toUpperCase() === "DRAFT";

function QualityDot({ template }: { template: MessageTemplate }) {
  const tone = qualityTone(template.qualityScore);
  if (!tone) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-block size-2 shrink-0 rounded-full", tone.dot)}
          aria-label={`Meta's quality rating: ${tone.label}`}
        />
      </TooltipTrigger>
      <TooltipContent>Meta&apos;s quality rating: {tone.label}</TooltipContent>
    </Tooltip>
  );
}

function StatusCell({ template }: { template: MessageTemplate }) {
  const hint = templateNeedsMedia(template)
    ? "Link a media file before sending"
    : templateStatusHint(template.status);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <TemplateStatusBadge
          status={
            templateNeedsMedia(template) ? "ACTION_REQUIRED" : template.status
          }
        />
        <QualityDot template={template} />
      </div>
      {hint && !isDraft(template) && (
        <p className="max-w-56 text-xs leading-4 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function RowMenu({
  template,
  canManage,
  actions
}: {
  template: MessageTemplate;
  canManage: boolean;
  actions: TemplateRowActions;
}) {
  const draft = isDraft(template);
  const isApproved = template.status.toUpperCase() === "APPROVED";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for ${template.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        {isApproved && actions.onUseInBroadcast && (
          <DropdownMenuItem
            onSelect={() => actions.onUseInBroadcast?.(template)}
          >
            <Megaphone className="size-4" />
            Use in broadcast
          </DropdownMenuItem>
        )}
        {canManage && templateNeedsMedia(template) && actions.onLinkMedia && (
          <DropdownMenuItem onSelect={() => actions.onLinkMedia?.(template)}>
            <ImagePlus className="size-4" />
            Link media
          </DropdownMenuItem>
        )}
        {canManage && (
          <>
            <DropdownMenuItem onSelect={() => actions.onOpen(template)}>
              <Edit3 className="size-4" />
              {draft ? "Continue editing" : "Edit"}
            </DropdownMenuItem>
            {!draft && (
              <DropdownMenuItem onSelect={() => actions.onDuplicate(template)}>
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => actions.onDelete(template)}
            >
              <Trash2 className="size-4" />
              {draft ? "Delete draft" : "Delete"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TypeLabel({ template }: { template: MessageTemplate }) {
  const kind = templateKind(template);
  const Icon = kind.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      {kind.label}
    </span>
  );
}

export default function TemplatesTable({
  templates,
  isLoading,
  deletingId,
  canManage = true,
  ...actions
}: TemplatesTableProps) {
  const [previewTemplate, setPreviewTemplate] =
    useState<MessageTemplate | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mobile: tap-and-hold a card to preview it.
  const pressHandlers = (template: MessageTemplate) => ({
    onTouchStart: () => {
      pressTimer.current = setTimeout(() => setPreviewTemplate(template), 450);
    },
    onTouchEnd: () => pressTimer.current && clearTimeout(pressTimer.current),
    onTouchMove: () => pressTimer.current && clearTimeout(pressTimer.current)
  });

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg bg-white p-4 shadow-xs">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="hidden rounded-lg bg-white shadow-xs md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Language</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => {
              const id =
                template.source === "draft"
                  ? template._id
                  : template.templateId;
              return (
                <HoverCard
                  key={`${template.source}-${id}`}
                  openDelay={350}
                  closeDelay={80}
                >
                  <HoverCardTrigger asChild>
                    <tr
                      onClick={() => actions.onOpen(template)}
                      className={cn(
                        "cursor-pointer border-b transition last:border-0 hover:bg-muted/40",
                        deletingId === id && "opacity-50"
                      )}
                    >
                      <td className="max-w-80 px-4 py-3">
                        <p className="truncate font-medium">{template.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {templateBodyText(template)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <TemplateCategoryBadge category={template.category} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusCell template={template} />
                      </td>
                      <td className="px-4 py-3">
                        <TypeLabel template={template} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {template.language}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatRelative(
                          template.updatedAt || template.createdAt
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RowMenu
                          template={template}
                          canManage={canManage}
                          actions={actions}
                        />
                      </td>
                    </tr>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="right"
                    align="start"
                    className="w-[340px] p-2"
                  >
                    <WhatsAppPreview components={template.components} compact />
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {templates.map((template) => {
          const id =
            template.source === "draft" ? template._id : template.templateId;
          return (
            <li
              key={`${template.source}-${id}`}
              onClick={() => actions.onOpen(template)}
              {...pressHandlers(template)}
              className="space-y-2 rounded-lg bg-white p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{template.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {templateBodyText(template)}
                  </p>
                </div>
                <RowMenu
                  template={template}
                  canManage={canManage}
                  actions={actions}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TemplateCategoryBadge category={template.category} />
                <TypeLabel template={template} />
                <span className="text-xs text-muted-foreground">
                  {formatRelative(template.updatedAt || template.createdAt)}
                </span>
              </div>
              <StatusCell template={template} />
            </li>
          );
        })}
      </ul>

      <Dialog
        open={Boolean(previewTemplate)}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <WhatsAppPreview components={previewTemplate.components} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
