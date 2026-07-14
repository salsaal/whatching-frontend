"use client";

import { FileText, ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAllMedia } from "@/api/functions/media";
import { MediaAsset, MediaFileType } from "@/api/types/media.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

interface MediaPickerDialogProps {
  open: boolean;
  selectedMediaId?: string;
  requiredType?: string;
  onBeforeOpenMediaLibrary?: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaAsset) => void;
}

export default function MediaPickerDialog({
  open,
  selectedMediaId,
  requiredType,
  onBeforeOpenMediaLibrary,
  onOpenChange,
  onSelect
}: MediaPickerDialogProps) {
  const router = useRouter();
  const initialTab =
    (requiredType && mediaTypeByHeaderFormat[requiredType]) || "image";
  const [activeTab, setActiveTab] = useState<MediaFileType>(initialTab);
  const { data, isLoading } = useQuery({
    queryKey: ["media"],
    queryFn: getAllMedia,
    enabled: open
  });

  const media = useMemo(() => data?.data.media || [], [data?.data.media]);
  const visibleMedia = useMemo(
    () =>
      media.filter((item) => {
        if (requiredType) {
          return item.fileType === mediaTypeByHeaderFormat[requiredType];
        }
        return item.fileType === activeTab;
      }),
    [activeTab, media, requiredType]
  );

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

        {!requiredType && (
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

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        ) : visibleMedia.length ? (
          <div className="grid max-h-[55vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMedia.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "overflow-hidden rounded-lg bg-white text-left shadow-xs ring-1 ring-transparent transition hover:ring-primary/40",
                  selectedMediaId === item._id && "ring-primary"
                )}
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {item.fileType === "image" ? (
                    <img
                      src={item.cloudinaryUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : item.fileType === "video" ? (
                    <video
                      src={item.cloudinaryUrl}
                      className="h-full w-full object-cover"
                      muted
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileText className="size-10 text-primary" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {item.fileType}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-lg bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            No media found for this template header type.
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
