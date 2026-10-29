"use client";

import { Check, FileText, ImageIcon, Search, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAllMedia } from "@/client-api/functions/media";
import { MediaAsset, MediaFileType } from "@/client-api/types/media.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";

const mediaTabs: Array<{
  value: MediaFileType;
  label: string;
  icon: React.ElementType;
}> = [
  { value: "image", label: "Images", icon: ImageIcon },
  { value: "video", label: "Videos", icon: Video },
  { value: "document", label: "Documents", icon: FileText }
];

const mediaTypeByHeaderFormat: Record<string, MediaFileType> = {
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "document"
};

const DEFAULT_IMAGE_HINT = "Only JPG or PNG images can be used here";

const isJpgOrPng = (item: MediaAsset) =>
  /\.(jpe?g|png)(?:$|[?#])/i.test(item.cloudinaryUrl || item.name);

const extensionOf = (item: MediaAsset) => {
  const match = (item.name || item.cloudinaryUrl || "").match(
    /\.([a-z0-9]+)(?:$|[?#])/i
  );
  return match ? match[1].toUpperCase() : item.fileType.toUpperCase();
};

const formatSize = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface MediaPickerDialogProps {
  open: boolean;
  selectedMediaId?: string;
  requiredType?: string;
  /** Tooltip on media that can't be used here (e.g. WebP for templates). */
  incompatibleHint?: string;
  onBeforeOpenMediaLibrary?: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaAsset) => void;
}

function MediaThumb({ item }: { item: MediaAsset }) {
  if (item.fileType === "image") {
    return (
      <img
        src={item.cloudinaryUrl}
        alt={item.name}
        loading="lazy"
        className="h-full w-full object-contain"
      />
    );
  }
  if (item.fileType === "video") {
    return (
      <video
        src={item.cloudinaryUrl}
        className="h-full w-full object-contain"
        muted
        preload="metadata"
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center">
      <FileText className="size-10 text-primary" />
    </div>
  );
}

export default function MediaPickerDialog({
  open,
  selectedMediaId,
  requiredType,
  incompatibleHint = DEFAULT_IMAGE_HINT,
  onBeforeOpenMediaLibrary,
  onOpenChange,
  onSelect
}: MediaPickerDialogProps) {
  const { can } = useCurrentMembership();
  const router = useRouter();
  const requiredKind = requiredType
    ? mediaTypeByHeaderFormat[requiredType.toUpperCase()]
    : undefined;
  const [activeTab, setActiveTab] = useState<MediaFileType>(
    requiredKind || "image"
  );
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["media"],
    queryFn: getAllMedia,
    enabled: open && can("media:view")
  });

  const media = useMemo(() => data?.data.media || [], [data?.data.media]);
  // Incompatible files stay visible (dimmed) so users can see why a file
  // they uploaded isn't selectable: non-JPG/PNG images anywhere, and videos
  // when an image is required.
  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    return media
      .filter((item) => {
        if (query && !item.name.toLowerCase().includes(query)) return false;
        if (requiredKind === "image") {
          return item.fileType === "image" || item.fileType === "video";
        }
        if (requiredKind) return item.fileType === requiredKind;
        return item.fileType === activeTab;
      })
      .map((item) => ({
        item,
        isCompatible:
          item.fileType === "image"
            ? isJpgOrPng(item)
            : !requiredKind || item.fileType === requiredKind
      }))
      .sort((a, b) => Number(b.isCompatible) - Number(a.isCompatible));
  }, [activeTab, media, requiredKind, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Select media</DialogTitle>
        </DialogHeader>

        <div className="rounded-sm bg-muted/60 p-3 text-sm text-muted-foreground">
          Need to add media first? Go to{" "}
          <Link
            href="/media"
            className="font-medium text-primary"
            onClick={async (event) => {
              if (!onBeforeOpenMediaLibrary) return;
              event.preventDefault();
              await onBeforeOpenMediaLibrary();
              router.push("/media");
            }}
          >
            Media library
          </Link>
          .
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!requiredKind && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
                      active && "bg-primary/10 text-primary shadow-xs"
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by file name"
              aria-label="Search media by file name"
              className="h-10 pl-9"
            />
          </div>
        </div>

        {!can("media:view") ? (
          <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">
            You need Media → View access to pick from the media library. Ask
            your organization owner.
          </p>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : visibleMedia.length ? (
          // Scrolling lives on this wrapper, not the grid: a height-capped
          // grid shrinks its auto rows and squashed the tiles into strips.
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 content-start gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visibleMedia.map(({ item, isCompatible }) => {
                const isSelected = selectedMediaId === item._id;
                const tile = (
                  <div
                    role="button"
                    tabIndex={isCompatible ? 0 : -1}
                    aria-disabled={!isCompatible}
                    aria-pressed={isSelected}
                    onClick={() => isCompatible && onSelect(item)}
                    onKeyDown={(event) => {
                      if (
                        isCompatible &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        onSelect(item);
                      }
                    }}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-lg bg-card text-left shadow-xs ring-1 ring-border transition",
                      isCompatible
                        ? "cursor-pointer hover:ring-primary/40"
                        : "cursor-not-allowed opacity-45",
                      isSelected && "ring-2 ring-primary hover:ring-primary"
                    )}
                  >
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      <MediaThumb item={item} />
                      {isSelected && (
                        <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p
                        className="truncate text-sm font-medium"
                        title={item.name}
                      >
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[extensionOf(item), formatSize(item.fileSize)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                );

                return isCompatible ? (
                  <div key={item._id}>{tile}</div>
                ) : (
                  <Tooltip key={item._id}>
                    <TooltipTrigger asChild>{tile}</TooltipTrigger>
                    <TooltipContent>{incompatibleHint}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-lg bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            {search.trim()
              ? "No files match that name."
              : requiredKind
                ? "No media found for this template header type."
                : "No media of this type yet."}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
