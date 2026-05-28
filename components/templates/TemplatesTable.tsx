import { Edit3, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { MessageTemplate } from "@/api/types/templates.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { getTemplateType, templateNeedsMedia } from "./templateUtils";
import TemplateStatusBadge from "./TemplateStatusBadge";

interface TemplatesTableProps {
  templates: MessageTemplate[];
  isLoading: boolean;
  onDelete: (templateId: string) => void;
  onEdit: (template: MessageTemplate) => void;
  onLinkMedia?: (template: MessageTemplate) => void;
  deletingId?: string | null;
}

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));

export default function TemplatesTable({
  templates,
  isLoading,
  onDelete,
  onEdit,
  onLinkMedia,
  deletingId
}: TemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg bg-white p-4 shadow-xs">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid gap-4 md:grid-cols-7">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ))}
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-xs">
        <p className="font-heading text-xl font-semibold">No templates found</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Create a template or adjust your search and status filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-2 shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="h-14 px-4 text-primary">Name</TableHead>
            <TableHead className="h-14 px-4 text-primary">Category</TableHead>
            <TableHead className="h-14 px-4 text-primary">Status</TableHead>
            <TableHead className="h-14 px-4 text-primary">Type</TableHead>
            <TableHead className="h-14 px-4 text-primary">Language</TableHead>
            <TableHead className="h-14 px-4 text-primary">Created At</TableHead>
            <TableHead className="h-14 px-4 text-right text-primary">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow
              key={template._id}
              className="cursor-pointer border-0 hover:bg-muted/30 [&>td]:border-t [&>td]:border-muted"
              onClick={() => onEdit(template)}
            >
              <TableCell className="px-4 py-5 font-medium">
                <span className="block max-w-[180px] truncate">
                  {template.name}
                </span>
                {templateNeedsMedia(template) && (
                  <span className="mt-1 inline-flex rounded-sm bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    Media required
                  </span>
                )}
              </TableCell>
              <TableCell className="px-4 py-5">{template.category}</TableCell>
              <TableCell className="px-4 py-5">
                <TemplateStatusBadge status={template.status} />
              </TableCell>
              <TableCell className="px-4 py-5">
                {getTemplateType(template)}
              </TableCell>
              <TableCell className="px-4 py-5">{template.language}</TableCell>
              <TableCell className="px-4 py-5">
                {formatDate(template.createdAt)}
              </TableCell>
              <TableCell className="px-4 py-5">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    disabled={template.status.toUpperCase() === "PENDING"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(template);
                    }}
                  >
                    <Edit3 className="size-4" />
                  </Button>
                  {templateNeedsMedia(template) &&
                    template.source !== "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          onLinkMedia?.(template);
                        }}
                      >
                        <ImagePlus className="size-4" />
                      </Button>
                    )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === template.templateId}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(
                        template.source === "draft"
                          ? template._id
                          : template.templateId
                      );
                    }}
                  >
                    {deletingId === template.templateId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
