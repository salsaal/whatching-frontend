import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit3,
  Instagram,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCcw,
  Send,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/client-api/functions/bot";
import {
  createInstagramCanvas,
  deleteInstagramCanvas,
  getInstagramAutomationSettings,
  getInstagramCanvases,
  updateInstagramCanvas,
  updateInstagramCanvasStatus
} from "@/client-api/functions/instagram";
import { InstagramCanvasRecord } from "@/client-api/types/instagram.type";
import { FlowStatusPill } from "@/components/flows/FlowStatusPill";
import { getInstagramFlowStatus } from "@/components/instagram/flow-editor/instagramFlow";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardGridLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { useOrganizationStore } from "@/stores/organizationStore";

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value))
    : "-";

const isApplied = (canvas: InstagramCanvasRecord) =>
  canvas.hasLiveVersion ?? Boolean(canvas.latestPublishedVersionId);

/** The Flows tab of /instagram: every flow, and which one is switched on. */
export function InstagramFlowsList({ username }: { username?: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const [renaming, setRenaming] = useState<InstagramCanvasRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<InstagramCanvasRecord | null>(null);
  const [confirmOn, setConfirmOn] = useState<{
    canvas: InstagramCanvasRecord;
    current: InstagramCanvasRecord;
  } | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["instagram-canvases", orgId],
    queryFn: getInstagramCanvases,
    enabled: Boolean(orgId)
  });
  const { data: settingsData } = useQuery({
    queryKey: ["instagram-automation-settings", orgId],
    queryFn: getInstagramAutomationSettings,
    enabled: Boolean(orgId)
  });
  const canvases = data?.data.canvases || [];
  const automationEnabled =
    settingsData?.data.settings.isAutomationEnabled !== false;
  const activeFlow = canvases.find((canvas) => canvas.status === "active");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });

  const { mutate: createFlow, isPending: isCreating } = useMutation({
    mutationFn: () => createInstagramCanvas({ name: "Untitled flow" }),
    meta: { showToast: false },
    onSuccess: (response) => {
      void invalidate();
      router.push(`/instagram/${response.data.canvas._id}`);
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't add a flow. Try again."))
  });

  const { mutate: setStatus, isPending: isSwitching } = useMutation({
    mutationFn: updateInstagramCanvasStatus,
    meta: { showToast: false },
    onSuccess: (_response, variables) => {
      toast.success(
        variables.status === "active"
          ? "Flow switched on."
          : "Flow switched off."
      );
      void invalidate();
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas"] });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't change that. Try again."))
  });

  const { mutate: renameFlow, isPending: isRenaming } = useMutation({
    mutationFn: updateInstagramCanvas,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Flow renamed.");
      setRenaming(null);
      void invalidate();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't rename this flow."))
  });

  const { mutate: deleteFlow, isPending: isDeleting } = useMutation({
    mutationFn: deleteInstagramCanvas,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Flow deleted.");
      setDeleting(null);
      void invalidate();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't delete this flow."))
  });

  const switchOn = (canvas: InstagramCanvasRecord) => {
    if (activeFlow && activeFlow._id !== canvas._id) {
      setConfirmOn({ canvas, current: activeFlow });
      return;
    }
    setStatus({ canvasId: canvas._id, status: "active" });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold">
                Instagram flows
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only one flow answers your Instagram messages at a time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => refetch()}
              >
                {isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
                Refresh
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={isCreating}
                onClick={() => createFlow()}
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add flow
              </Button>
            </div>
          </div>
        </section>

        {isError && (
          <QueryErrorState message="Instagram flows could not be loaded." />
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          {isLoading ? (
            <div className="lg:col-span-3">
              <CardGridLoadingSkeleton count={3} />
            </div>
          ) : canvases.length ? (
            canvases.map((canvas) => {
              const applied = isApplied(canvas);
              const isOn = canvas.status === "active";
              const pending = canvas.pendingChangeCount || 0;
              const status = getInstagramFlowStatus({
                automationEnabled,
                applied,
                isActive: isOn,
                pendingCount: pending,
                username
              });
              const blockCount =
                canvas.blockCount ?? canvas.draftState?.nodes?.length ?? 0;
              return (
                <div
                  key={canvas._id}
                  className="space-y-4 rounded-lg border bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Instagram className="size-4 shrink-0 text-pink-600" />
                        <h3 className="truncate font-heading text-xl font-semibold">
                          {canvas.name}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Updated {formatDate(canvas.updatedAt)}
                      </p>
                    </div>
                    {status.href ? (
                      <Link href={status.href} className="hover:opacity-80">
                        <FlowStatusPill
                          tone={status.tone}
                          label={status.label}
                        />
                      </Link>
                    ) : (
                      <FlowStatusPill tone={status.tone} label={status.label} />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {blockCount} block{blockCount === 1 ? "" : "s"}
                    {pending > 0 && (
                      <span className="text-amber-800">
                        {" "}
                        · {pending} pending change{pending === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer"
                      onClick={() => router.push(`/instagram/${canvas._id}`)}
                    >
                      <Edit3 className="size-4" />
                      Edit
                    </Button>
                    {!applied ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        tooltip="Apply this flow once before switching it on"
                        onClick={() => router.push(`/instagram/${canvas._id}`)}
                      >
                        <Send className="size-4" />
                        Open and activate
                      </Button>
                    ) : isOn ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={isSwitching}
                        onClick={() =>
                          setStatus({
                            canvasId: canvas._id,
                            status: "inactive"
                          })
                        }
                      >
                        <PowerOff className="size-4" />
                        Switch off
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={isSwitching}
                        onClick={() => switchOn(canvas)}
                      >
                        <Power className="size-4" />
                        Switch on
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setRenameValue(canvas.name);
                        setRenaming(canvas);
                      }}
                    >
                      Rename
                    </Button>
                    {/* A disabled button gets no hover, so the tooltip sits on
                        a wrapper. */}
                    <span
                      title={isOn ? "Switch it off first" : undefined}
                      className="inline-flex"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        disabled={isOn || isDeleting}
                        onClick={() => setDeleting(canvas)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            !isError && (
              <div className="flex flex-col items-center justify-center rounded-lg bg-white p-10 text-center shadow-xs lg:col-span-3">
                <Instagram className="mb-3 size-10 text-pink-600" />
                <h2 className="font-heading text-2xl font-semibold">
                  No Instagram flows yet
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  A flow answers people who message your Instagram account.
                </p>
                <Button
                  className="mt-4 cursor-pointer"
                  disabled={isCreating}
                  onClick={() => createFlow()}
                >
                  <Plus className="size-4" />
                  Add flow
                </Button>
              </div>
            )
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && !isRenaming && setRenaming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename flow</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = renameValue.trim();
              if (!renaming || !name) return;
              renameFlow({ canvasId: renaming._id, name });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="instagram-flow-name">Flow name</Label>
              <Input
                id="instagram-flow-name"
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!renameValue.trim() || isRenaming}
              >
                {isRenaming && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flow?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.name}&rdquo; will be deleted and permanently
              removed in 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting || !deleting}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) deleteFlow(deleting._id);
              }}
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmOn)}
        onOpenChange={(open) => !open && setConfirmOn(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              &ldquo;{confirmOn?.current.name}&rdquo; is answering{" "}
              {username ? `@${username}` : "your Instagram messages"} now.
              Switch it off and use &ldquo;{confirmOn?.canvas.name}&rdquo;
              instead?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Only one flow answers your Instagram messages at a time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmOn) {
                  setStatus({
                    canvasId: confirmOn.canvas._id,
                    status: "active"
                  });
                }
                setConfirmOn(null);
              }}
            >
              Use this flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
