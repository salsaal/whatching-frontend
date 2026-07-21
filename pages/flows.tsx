"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  Bot,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Workflow
} from "lucide-react";
import { toast } from "sonner";

import {
  activateBotCanvas,
  archiveBotCanvas,
  createBotCanvas,
  getBotCanvas,
  getBotSettings,
  listBotCanvases,
  updateBotCanvas,
  updateBotSettings
} from "@/client-api/functions/bot";
import { BotCanvasRecord } from "@/client-api/types/bot.type";
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
import { CardGridLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { Switch } from "@/components/ui/switch";
import AppLayout from "@/layouts/AppLayout";
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

export default function FlowsPage() {
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

  const queryKey = ["bot-canvases", activeOrganization?._id];
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: listBotCanvases,
    enabled: Boolean(activeOrganization?._id),
    refetchOnMount: "always"
  });
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["bot-settings", activeOrganization?._id],
    queryFn: getBotSettings,
    enabled: Boolean(activeOrganization?._id)
  });

  const canvases = [...(data?.data?.canvases || [])].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
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

  const handleError = (error: AxiosError<{ message?: string }>) => {
    toast.error(error.response?.data?.message || "Flow action failed.");
  };

  const { mutate: createCanvasMutate, isPending: isCreating } = useMutation({
    mutationFn: createBotCanvas,
    onSuccess: async (response) => {
      toast.success("Flow created.");
      await invalidate();
      const canvasId = response.data?.canvas?._id || response.data?.canvasId;
      if (canvasId) router.push(`/flows/${canvasId}`);
    },
    onError: handleError
  });

  const { mutate: renameCanvasMutate, isPending: isRenaming } = useMutation({
    mutationFn: updateBotCanvas,
    onSuccess: async () => {
      toast.success("Flow renamed.");
      setEditingCanvas(null);
      await invalidate();
    },
    onError: handleError
  });

  const { mutate: activateCanvasMutate, isPending: isActivating } = useMutation(
    {
      mutationFn: activateBotCanvas,
      onSuccess: async () => {
        toast.success("Active flow updated.");
        await invalidate();
      },
      onError: handleError
    }
  );

  const { mutate: archiveCanvasMutate, isPending: isDeleting } = useMutation({
    mutationFn: archiveBotCanvas,
    onSuccess: async () => {
      toast.success("Flow archived.");
      setDeleteCanvas(null);
      await invalidate();
    },
    onError: handleError
  });
  const { mutate: updateSettingsMutate, isPending: isUpdatingSettings } =
    useMutation({
      mutationFn: updateBotSettings,
      onSuccess: async () => {
        toast.success("Automation settings updated.");
        await queryClient.invalidateQueries({
          queryKey: ["bot-settings", activeOrganization?._id]
        });
      },
      onError: handleError
    });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Workflow className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">
                  WhatsApp automation
                </p>
                <h1 className="font-heading text-3xl font-semibold">Flows</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage multiple canvases. Publish any canvas, but only one can
                  be active for WhatsApp automation at a time.
                </p>
              </div>
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

        <section className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-xs">
            <div>
              <p className="text-sm font-semibold">Active bot</p>
              <p className="text-xs text-muted-foreground">
                Enable WhatsApp automation for the active published canvas.
              </p>
            </div>
            <Switch
              checked={Boolean(settingsData?.data?.settings.isBotEnabled)}
              disabled={isSettingsLoading || isUpdatingSettings}
              title="Turn the active WhatsApp flow on or off"
              onCheckedChange={(checked) =>
                updateSettingsMutate({ isBotEnabled: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-xs">
            <div>
              <p className="text-sm font-semibold">AI response</p>
              <p className="text-xs text-muted-foreground">
                Let AI answer when no interactive flow route matches.
              </p>
            </div>
            <Switch
              checked={Boolean(settingsData?.data?.settings.isAiEnabled)}
              disabled={isSettingsLoading || isUpdatingSettings}
              title="Allow AI fallback when no flow route matches"
              onCheckedChange={(checked) =>
                updateSettingsMutate({ isAiEnabled: checked })
              }
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {isLoading ? (
            <div className="lg:col-span-3">
              <CardGridLoadingSkeleton count={6} />
            </div>
          ) : canvases.length ? (
            canvases.map((canvas) => {
              const isActive = canvas.status === "active";
              const detail = canvasDetailById.get(canvas._id);
              const nodeCount =
                canvas.draftState?.nodes?.length ||
                canvas.publishedState?.nodes?.length ||
                detail?.draftState?.nodes?.length ||
                detail?.publishedState?.nodes?.length ||
                (canvas as { canvas?: BotCanvasRecord }).canvas?.draftState
                  ?.nodes?.length ||
                (canvas as { canvas?: BotCanvasRecord }).canvas?.publishedState
                  ?.nodes?.length ||
                0;
              return (
                <Card
                  key={canvas._id}
                  className="rounded-lg transition hover:border-primary/40 hover:shadow-md py-0"
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Bot className="size-4 text-primary" />
                          <h2 className="truncate font-heading text-xl font-semibold">
                            {canvas.name}
                          </h2>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Updated {formatDate(canvas.updatedAt)}
                        </p>
                      </div>
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {canvas.status}
                      </Badge>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Blocks</p>
                        <p className="mt-1 font-semibold">{nodeCount}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Active canvas</p>
                        <p className="text-xs text-muted-foreground">
                          Only one flow can receive live inbound messages.
                        </p>
                      </div>
                      <Switch
                        checked={isActive}
                        disabled={isActive || isActivating}
                        title={
                          isActive
                            ? "This is the active WhatsApp flow"
                            : "Make this the active WhatsApp flow"
                        }
                        onCheckedChange={(checked) => {
                          if (checked) activateCanvasMutate(canvas._id);
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => router.push(`/flows/${canvas._id}`)}
                      >
                        <Edit3 className="size-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => {
                          setEditingCanvas(canvas);
                          setName(canvas.name);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => setDeleteCanvas(canvas)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="rounded-lg lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <Workflow className="mb-3 size-10 text-primary" />
                <h2 className="font-heading text-2xl font-semibold">
                  No flows yet
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Create a canvas to start building WhatsApp automation.
                </p>
                <Button
                  className="mt-4 cursor-pointer"
                  disabled={isCreating}
                  onClick={() => createCanvasMutate({})}
                >
                  <Plus className="size-4" />
                  Add flow
                </Button>
              </CardContent>
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
        onOpenChange={() => setDeleteCanvas(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flow?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives {deleteCanvas?.name}. Published versions and active
              automation should be moved to another canvas before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting || !deleteCanvas}
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
    </AppLayout>
  );
}
