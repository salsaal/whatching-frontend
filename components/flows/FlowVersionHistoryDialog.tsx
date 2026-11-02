import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { useState } from "react";

import { listBotCanvasVersions } from "@/client-api/functions/bot";
import { BotCanvasVersion } from "@/client-api/types/bot.type";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const formatWhen = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export const describeVersion = (version: BotCanvasVersion) =>
  [
    `Version ${version.versionNumber}`,
    // Only the version customers get now is current.
    version.publishedAt
      ? `${version.isLive ? "Current since" : "Applied"} ${formatWhen(version.publishedAt)}`
      : "",
    version.publishedBy?.name ? `by ${version.publishedBy.name}` : "",
    typeof version.blockCount === "number"
      ? `${version.blockCount} block${version.blockCount === 1 ? "" : "s"}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");

/** Every version that was applied, with View (current one) and Restore. */
export function FlowVersionHistoryDialog({
  open,
  onOpenChange,
  canvasId,
  readOnly,
  onViewLive,
  onRestore,
  listVersions = listBotCanvasVersions,
  queryKeyPrefix = "bot-canvas-versions"
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
  readOnly: boolean;
  onViewLive: () => void;
  /** Resolves true once the version is in the editor. */
  onRestore: (version: BotCanvasVersion) => Promise<boolean>;
  /** Loads the versions; WhatsApp's by default. */
  listVersions?: (
    canvasId: string
  ) => Promise<{ data?: { versions?: BotCanvasVersion[] } }>;
  queryKeyPrefix?: string;
}) {
  const [confirming, setConfirming] = useState<BotCanvasVersion | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [queryKeyPrefix, canvasId],
    queryFn: () => listVersions(canvasId),
    enabled: open && Boolean(canvasId),
    refetchOnMount: "always"
  });
  const versions = data?.data?.versions || [];

  const restore = async (version: BotCanvasVersion) => {
    setRestoringId(version._id);
    try {
      if (await onRestore(version)) onOpenChange(false);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="left-auto right-0 top-0 flex h-dvh max-h-dvh translate-x-0 translate-y-0 flex-col gap-4 rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" />
              Version history
            </DialogTitle>
            <DialogDescription>
              Every version of this flow that was applied, newest first.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            {isError && (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p>Couldn&apos;t load the versions.</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {!isLoading && !isError && !versions.length && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                This flow hasn&apos;t been applied yet.
              </p>
            )}
            {versions.map((version) => (
              <div
                key={version._id}
                className="space-y-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p>{describeVersion(version)}</p>
                  {version.isLive && (
                    <Badge className="shrink-0">Current</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {version.isLive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onViewLive();
                        onOpenChange(false);
                      }}
                    >
                      View
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={readOnly || Boolean(restoringId)}
                    onClick={() => setConfirming(version)}
                  >
                    {restoringId === version._id && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(confirming)}
        onOpenChange={(next) => !next && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Copy version {confirming?.versionNumber} into your editor?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your pending changes are replaced. Customers keep getting the
              current version until you apply changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) void restore(confirming);
                setConfirming(null);
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
