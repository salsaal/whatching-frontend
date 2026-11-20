"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  Bot,
  Edit3,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Workflow
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveBotCanvas,
  createBotCanvas,
  getBotCanvas,
  updateBotCanvas
} from "@/client-api/functions/bot";
import { BotCanvasRecord } from "@/client-api/types/bot.type";
import { NumberFlowsPanel } from "@/components/bot/NumberFlowsPanel";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { CardGridLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { FlowStatusPill } from "@/components/flows/FlowStatusPill";
import { useBotSettings } from "@/hooks/useBotSettings";
import { isPublishedCanvas, useLiveFlows } from "@/hooks/useLiveFlows";
import { FLOW_STATE_LABELS, getFlowState } from "@/lib/flowBuilder";
import { useOrganizationStore } from "@/stores/organizationStore";
import { formatWhen } from "@/lib/displayFormat";
import BotLayout from "@/components/bot/BotLayout";

const formatDate = (value?: string) => formatWhen(value);

function FlowsPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [name, setName] = useState("");
  const [editingCanvas, setEditingCanvas] = useState<BotCanvasRecord | null>(
    null
  );
  const [deleteCanvas, setDeleteCanvas] = useState<BotCanvasRecord | null>(
    null
  );
  // The server's reason when it refuses a delete our own check allowed
  // (for example, a number changed in another tab).
  const [deleteRefusal, setDeleteRefusal] = useState("");

  const queryKey = ["bot-canvases", activeOrganization?._id];
  const {
    canvases,
    defaultCanvas,
    numbers,
    effectiveCanvasFor,
    isLoading,
    isError,
    refetch,
    isFetching
  } = useLiveFlows();
  const { settings: botSettings } = useBotSettings();
  const canvasDetailQueries = useQueries({
    queries: canvases.map((canvas) => ({
      queryKey: ["bot-canvas-detail", activeOrganization?._id, canvas._id],
      queryFn: () => getBotCanvas(canvas._id),
      enabled: Boolean(activeOrganization?._id && canvas._id),
      staleTime: 30_000
    }))
  });
  const canvasDetailById = new Map(
    canvases.map((canvas, index) => [
      canvas._id,
      canvasDetailQueries[index]?.data?.data?.canvas
    ])
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  // A flow that's answering on a number, or that new numbers start with, can't
  // be deleted: the number would quietly switch to another flow.
  const deleteAnsweringOn = deleteCanvas
    ? numbers
        .filter(
          (number) => effectiveCanvasFor(number)?._id === deleteCanvas._id
        )
        .map((number) => number.displayPhoneNumber || number.phoneNumberId)
    : [];
  const deleteIsNewNumbersFlow =
    Boolean(deleteCanvas) &&
    defaultCanvas?._id === deleteCanvas?._id &&
    numbers.length >= 2;
  const deleteBlockedReason = deleteAnsweringOn.length
    ? `${deleteCanvas?.name} is answering on ${deleteAnsweringOn.join(", ")}. Choose another flow for ${
        deleteAnsweringOn.length === 1 ? "that number" : "those numbers"
      } first, under "Flow on each number".`
    : deleteIsNewNumbersFlow
      ? `New numbers start with ${deleteCanvas?.name}. Choose another flow under "New numbers start with" first.`
      : "";

  const handleError = (error: AxiosError<{ message?: string }>) => {
    toast.error(error.response?.data?.message || "Flow action failed.");
  };

  const { mutate: createCanvasMutate, isPending: isCreating } = useMutation({
    mutationFn: createBotCanvas,
    meta: { showToast: false },
    onSuccess: async (response) => {
      toast.success("Flow created.");
      await invalidate();
      const canvasId = response.data?.canvas?._id || response.data?.canvasId;
      if (canvasId) router.push(`/bot/flows/${canvasId}`);
    },
    onError: handleError
  });

  const { mutate: renameCanvasMutate, isPending: isRenaming } = useMutation({
    mutationFn: updateBotCanvas,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Flow renamed.");
      setEditingCanvas(null);
      await invalidate();
    },
    onError: handleError
  });

  const { mutate: archiveCanvasMutate, isPending: isDeleting } = useMutation({
    mutationFn: archiveBotCanvas,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Flow deleted.");
      setDeleteCanvas(null);
      await invalidate();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      if ((status === 400 || status === 409) && message) {
        setDeleteRefusal(message);
        void invalidate();
        return;
      }
      handleError(error);
    }
  });
  return (
    <>
      <div className="space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Build flows, then choose which one answers on each WhatsApp
              number.
            </p>
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
                onClick={() => createCanvasMutate({})}
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
          <QueryErrorState message="Flows could not be loaded for this organisation." />
        )}

        {!isLoading && !isError && canvases.length > 0 && <NumberFlowsPanel />}

        <section className="grid gap-4 lg:grid-cols-3">
          {isLoading ? (
            <div className="lg:col-span-3">
              <CardGridLoadingSkeleton count={6} />
            </div>
          ) : canvases.length ? (
            canvases.map((canvas) => {
              const hasPublishedVersion = isPublishedCanvas(canvas);
              // Same rule as the number dropdowns: a number's own flow,
              // else the default.
              const answeringOn = numbers
                .filter(
                  (number) => effectiveCanvasFor(number)?._id === canvas._id
                )
                .map(
                  (number) => number.displayPhoneNumber || number.phoneNumberId
                );
              // Same rules as the status pill in the flow editor.
              const flowState = getFlowState({
                botEnabled: botSettings?.isBotEnabled ?? true,
                applied: hasPublishedVersion,
                numberCount: answeringOn.length
              });
              const isNewNumbersFlow =
                defaultCanvas?._id === canvas._id && numbers.length >= 2;
              const detail = canvasDetailById.get(canvas._id);
              const nodeCount =
                canvas.publishedState?.nodes?.length ??
                detail?.publishedState?.nodes?.length ??
                (canvas as { canvas?: BotCanvasRecord }).canvas?.publishedState
                  ?.nodes?.length ??
                0;
              return (
                <Card
                  key={canvas._id}
                  className="rounded-lg transition hover:border-primary/40 hover:shadow-md py-0"
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <Bot className="mt-1.5 size-4 shrink-0 text-primary" />
                        <h2
                          className="line-clamp-2 break-words font-heading text-xl font-semibold"
                          title={canvas.name}
                        >
                          {canvas.name}
                        </h2>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          Updated {formatDate(canvas.updatedAt)}
                        </p>
                        <FlowStatusPill
                          tone={flowState}
                          label={FLOW_STATE_LABELS[flowState]}
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">
                          Answering on:{" "}
                        </span>
                        {answeringOn.length ? (
                          <span className="font-medium text-emerald-700">
                            {answeringOn.join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            No number
                          </span>
                        )}
                        {isNewNumbersFlow && (
                          <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 align-middle text-xs text-muted-foreground">
                            New numbers
                          </span>
                        )}
                      </p>
                      {!hasPublishedVersion && (
                        <p className="text-xs text-muted-foreground">
                          Open it and click Activate to start using it
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {nodeCount} block{nodeCount === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => router.push(`/bot/flows/${canvas._id}`)}
                      >
                        <Edit3 className="size-4" />
                        Edit
                      </Button>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer text-muted-foreground"
                          aria-label={`Rename ${canvas.name}`}
                          title="Rename"
                          onClick={() => {
                            setEditingCanvas(canvas);
                            setName(canvas.name);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${canvas.name}`}
                          title="Delete"
                          onClick={() => setDeleteCanvas(canvas)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="rounded-lg lg:col-span-3">
              <EmptyState
                icon={Workflow}
                title="No flows yet"
                description="Create a canvas to start building WhatsApp automation."
                action={
                  <Button
                    className="cursor-pointer"
                    disabled={isCreating}
                    onClick={() => createCanvasMutate({})}
                  >
                    <Plus className="size-4" />
                    Add flow
                  </Button>
                }
              />
            </Card>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(editingCanvas)}
        onOpenChange={() => setEditingCanvas(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename flow</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="flow-name">Flow name</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main support flow"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setEditingCanvas(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              disabled={!editingCanvas || !name.trim() || isRenaming}
              onClick={() => {
                if (!editingCanvas) return;
                renameCanvasMutate({
                  canvasId: editingCanvas._id,
                  name: name.trim()
                });
              }}
            >
              {isRenaming && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteCanvas)}
        onOpenChange={() => {
          setDeleteCanvas(null);
          setDeleteRefusal("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flow?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlockedReason ||
                deleteRefusal ||
                `This deletes ${deleteCanvas?.name}. It's removed for good after 30 days.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={
                isDeleting ||
                !deleteCanvas ||
                !!deleteBlockedReason ||
                !!deleteRefusal
              }
              onClick={(event) => {
                event.preventDefault();
                if (deleteCanvas) archiveCanvasMutate(deleteCanvas._id);
              }}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function BotFlowsPage() {
  return (
    <BotLayout activeTab="flows">
      <FlowsPageContent />
    </BotLayout>
  );
}
