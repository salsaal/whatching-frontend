"use client";

import {
  FileText,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  Video
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  bulkDeleteMedia,
  getAllMedia,
  uploadMedia
} from "@/client-api/functions/media";
import { MediaAsset, MediaFileType } from "@/client-api/types/media.type";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/layouts/AppLayout";
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

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));

const maxMediaSize: Record<MediaFileType, number> = {
  image: 1 * 1024 * 1024,
  video: 10 * 1024 * 1024,
  document: 10 * 1024 * 1024
};

const getUploadFileType = (file: File): MediaFileType => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
};

export default function MediaPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<MediaFileType>("image");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["media"],
    queryFn: getAllMedia,
    refetchOnMount: "always"
  });

  const media = useMemo(() => data?.data.media || [], [data?.data.media]);
  const visibleMedia = useMemo(
    () => media.filter((item) => item.fileType === activeTab),
    [activeTab, media]
  );
  const selectedVisibleIds = useMemo(
    () =>
      visibleMedia
        .filter((item) => selectedIds.includes(item._id))
        .map((item) => item._id),
    [selectedIds, visibleMedia]
  );

  const { mutate: uploadFiles, isPending: isUploading } = useMutation({
    mutationFn: uploadMedia,
    onSuccess: () => {
      setSelectedIds([]);
      setUploadError("");
      refetch();
    }
  });

  const { mutate: deleteSelected, isPending: isDeleting } = useMutation({
    mutationFn: bulkDeleteMedia,
    onSuccess: () => {
      setSelectedIds([]);
      setIsDeleteOpen(false);
      refetch();
    }
  });

  const toggleSelection = (mediaId: string) => {
    setSelectedIds((current) =>
      current.includes(mediaId)
        ? current.filter((item) => item !== mediaId)
        : [...current, mediaId]
    );
  };

  const toggleAllVisible = () => {
    if (selectedVisibleIds.length === visibleMedia.length) {
      setSelectedIds((current) =>
        current.filter((item) => !selectedVisibleIds.includes(item))
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...visibleMedia.map((item) => item._id)]))
    );
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    const oversizedFile = files.find((file) => {
      const fileType = getUploadFileType(file);
      return file.size > maxMediaSize[fileType];
    });

    if (oversizedFile) {
      const fileType = getUploadFileType(oversizedFile);
      setUploadError(
        `${oversizedFile.name} exceeds the ${formatFileSize(maxMediaSize[fileType])} ${fileType} limit.`
      );
      event.target.value = "";
      return;
    }

    if (files.length) uploadFiles(files);
    event.target.value = "";
  };

  const renderPreview = (item: MediaAsset) => {
    if (item.fileType === "image") {
      return (
        <img
          src={item.cloudinaryUrl}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      );
    }

    if (item.fileType === "video") {
      return (
        <video
          src={item.cloudinaryUrl}
          className="h-full w-full object-cover"
          muted
          controls
        />
      );
    }

    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <FileText className="size-10 text-primary" />
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Media</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              Media library
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload and manage reusable WhatsApp images, videos, and documents.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete selected
              </Button>
            )}
            <Button
              onClick={() => fileInputRef.current?.click()}
              isLoading={isUploading}
            >
              <Upload className="size-4" />
              Upload media
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.value;
                const count = media.filter(
                  (item) => item.fileType === tab.value
                ).length;

                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
                      active && "bg-primary/10 text-primary shadow-xs"
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                    <span className="text-xs text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={
                  visibleMedia.length > 0 &&
                  selectedVisibleIds.length === visibleMedia.length
                }
                disabled={!visibleMedia.length}
                onCheckedChange={toggleAllVisible}
              />
              Select all visible
            </label>
          </div>
          {uploadError && (
            <p className="mt-3 text-sm text-destructive">{uploadError}</p>
          )}
        </section>

        {isLoading ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
            ))}
          </section>
        ) : visibleMedia.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleMedia.map((item) => {
              const selected = selectedIds.includes(item._id);

              return (
                <article
                  key={item._id}
                  className={cn(
                    "overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-transparent transition",
                    selected && "ring-primary"
                  )}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {renderPreview(item)}
                    <div className="absolute left-3 top-3 rounded-sm bg-white/95 p-1 shadow-xs">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleSelection(item._id)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate font-medium">
                        {item.name}
                      </p>
                      <a
                        href={item.cloudinaryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-sm font-medium text-primary"
                      >
                        Open
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatFileSize(item.fileSize)}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-xs">
            <p className="font-heading text-xl font-semibold">
              No {activeTab} files found
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Upload files to build this organisation media library.
            </p>
          </section>
        )}
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected media?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedIds.length} selected media asset
              {selectedIds.length === 1 ? "" : "s"} from the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSelected(selectedIds)}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
