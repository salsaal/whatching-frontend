"use client";

import {
  CalendarClock,
  Eye,
  Megaphone,
  Play,
  Plus,
  Search,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  cancelBroadcast,
  createBroadcast,
  getAllBroadcasts,
  getBroadcastById,
  startBroadcast
} from "@/api/functions/broadcasts";
import { getAllSubscribers, getTags } from "@/api/functions/subscribers";
import { getAllTemplates } from "@/api/functions/templates";
import { Broadcast, BroadcastAudience } from "@/api/types/broadcasts.type";
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
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";

const formatDate = (date?: string | null) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(date))
    : "-";

const statusClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-50 text-blue-700",
  processing: "bg-amber-50 text-amber-700",
  completed: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground"
};

export default function BroadcastsPage() {
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Broadcast | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [broadcastName, setBroadcastName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [audienceMode, setAudienceMode] =
    useState<BroadcastAudience["mode"]>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>(
    []
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: getAllBroadcasts,
    refetchOnMount: "always"
  });
  const { data: templatesData } = useQuery({
    queryKey: ["templates"],
    queryFn: getAllTemplates
  });
  const { data: subscribersData } = useQuery({
    queryKey: ["subscribers"],
    queryFn: getAllSubscribers
  });
  const { data: tagsData } = useQuery({
    queryKey: ["subscriber-tags"],
    queryFn: getTags
  });
  const { data: selectedBroadcastData, refetch: refetchSelectedBroadcast } =
    useQuery({
      queryKey: ["broadcast", selectedBroadcastId],
      queryFn: () => getBroadcastById(selectedBroadcastId),
      enabled: Boolean(selectedBroadcastId)
    });

  const broadcasts = useMemo(
    () => data?.data.broadcasts || [],
    [data?.data.broadcasts]
  );
  const templates = useMemo(
    () =>
      (templatesData?.data.templates || []).filter(
        (template) => template.status.toUpperCase() === "APPROVED"
      ),
    [templatesData?.data.templates]
  );
  const subscribers = useMemo(
    () => subscribersData?.data.subscribers || [],
    [subscribersData?.data.subscribers]
  );
  const tags = useMemo(() => tagsData?.data.tags || [], [tagsData?.data.tags]);
  const filteredBroadcasts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return broadcasts;

    return broadcasts.filter((broadcast) =>
      [broadcast.name, broadcast.status, broadcast.template?.name]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(value))
    );
  }, [broadcasts, query]);

  const selectedBroadcast = selectedBroadcastData?.data.broadcast;

  const { mutate: createDraft, isPending: isCreating } = useMutation({
    mutationFn: createBroadcast,
    onSuccess: (response) => {
      toast.success("Broadcast draft created");
      setIsCreateOpen(false);
      setSelectedBroadcastId(response.data.broadcast._id);
      setBroadcastName("");
      setTemplateId("");
      setAudienceMode("all");
      setSelectedTags([]);
      setSelectedSubscriberIds([]);
      refetch();
    }
  });

  const { mutate: startSelected, isPending: isStarting } = useMutation({
    mutationFn: startBroadcast,
    onSuccess: () => {
      toast.success("Broadcast accepted for processing");
      setScheduleLocal("");
      refetch();
      refetchSelectedBroadcast();
    }
  });

  const { mutate: cancelSelected, isPending: isCanceling } = useMutation({
    mutationFn: cancelBroadcast,
    onSuccess: () => {
      toast.success("Broadcast canceled");
      setCancelTarget(null);
      refetch();
      refetchSelectedBroadcast();
    }
  });

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!broadcastName.trim() || !templateId) {
      toast.error("Broadcast name and template are required");
      return;
    }

    const audience: BroadcastAudience =
      audienceMode === "tags"
        ? { mode: "tags", tags: selectedTags, tagMatch: "any" }
        : audienceMode === "specific"
          ? { mode: "specific", subscriberIds: selectedSubscriberIds }
          : { mode: "all" };

    createDraft({
      name: broadcastName.trim(),
      templateId,
      audience,
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: "dynamic",
              value: {
                source: "subscriber_field",
                path: "firstName",
                fallback: "Valued Customer"
              }
            }
          ]
        }
      ]
    });
  };

  const canStart =
    selectedBroadcast?.status === "draft" ||
    selectedBroadcast?.status === "scheduled";

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Broadcasts</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              Broadcast campaigns
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create drafts, schedule sends, and track WhatsApp broadcast
              delivery.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            New broadcast
          </Button>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-xs">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search broadcasts by name, status, template"
              className="h-12 rounded-sm border-0 bg-muted/70 pl-9 shadow-none"
            />
          </div>
        </section>

        <section className="rounded-lg bg-white p-2 shadow-xs">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : filteredBroadcasts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-primary">
                    <th className="p-4">Name</th>
                    <th className="p-4">Template</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Recipients</th>
                    <th className="p-4">Created</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBroadcasts.map((broadcast) => (
                    <tr key={broadcast._id} className="border-t">
                      <td className="p-4 font-medium">{broadcast.name}</td>
                      <td className="p-4">{broadcast.template?.name || "-"}</td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "rounded-sm px-2 py-1 text-xs font-medium capitalize",
                            statusClasses[broadcast.status] ||
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {broadcast.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {broadcast.stats?.totalRecipients || 0}
                      </td>
                      <td className="p-4">{formatDate(broadcast.createdAt)}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSelectedBroadcastId(broadcast._id)
                            }
                          >
                            <Eye className="size-4" />
                          </Button>
                          {["draft", "scheduled", "processing"].includes(
                            broadcast.status
                          ) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setCancelTarget(broadcast)}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <Megaphone className="size-10 text-primary" />
              <p className="mt-3 font-heading text-xl font-semibold">
                No broadcasts found
              </p>
            </div>
          )}
        </section>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create broadcast draft</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={broadcastName}
                  onChange={(event) => setBroadcastName(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Template</Label>
                <select
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option
                      key={template.templateId}
                      value={template.templateId}
                    >
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Audience</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["all", "tags", "specific"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAudienceMode(mode)}
                    className={cn(
                      "rounded-sm bg-muted/70 p-3 text-left text-sm font-medium capitalize",
                      audienceMode === mode && "bg-primary/10 text-primary"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {audienceMode === "tags" && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setSelectedTags((current) =>
                        current.includes(tag)
                          ? current.filter((item) => item !== tag)
                          : [...current, tag]
                      )
                    }
                    className={cn(
                      "rounded-sm bg-muted px-3 py-2 text-sm",
                      selectedTags.includes(tag) && "bg-primary/10 text-primary"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {audienceMode === "specific" && (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-sm border p-3">
                {subscribers.map((subscriber) => (
                  <label
                    key={subscriber._id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubscriberIds.includes(subscriber._id)}
                      onChange={(event) =>
                        setSelectedSubscriberIds((current) =>
                          event.target.checked
                            ? [...current, subscriber._id]
                            : current.filter((item) => item !== subscriber._id)
                        )
                      }
                    />
                    {[subscriber.firstName, subscriber.lastName]
                      .filter(Boolean)
                      .join(" ") || subscriber.phoneNumber}
                  </label>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isCreating}>
                Create draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedBroadcastId)}
        onOpenChange={(open) => !open && setSelectedBroadcastId("")}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedBroadcast?.name || "Broadcast"}</DialogTitle>
          </DialogHeader>

          {selectedBroadcast ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Status", selectedBroadcast.status],
                  ["Template", selectedBroadcast.template?.name],
                  ["Recipients", selectedBroadcast.stats.totalRecipients],
                  ["Failed", selectedBroadcast.stats.failedRecipients]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-sm bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-medium capitalize">
                      {value || "-"}
                    </p>
                  </div>
                ))}
              </div>

              {selectedBroadcast.lastError && (
                <div className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
                  {selectedBroadcast.lastError}
                </div>
              )}

              {canStart && (
                <div className="rounded-sm border p-3">
                  <Label>Schedule time</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="datetime-local"
                      value={scheduleLocal}
                      onChange={(event) => setScheduleLocal(event.target.value)}
                      className="sm:max-w-xs"
                    />
                    <Button
                      type="button"
                      isLoading={isStarting}
                      onClick={() =>
                        startSelected({
                          broadcastId: selectedBroadcast._id,
                          payload: scheduleLocal
                            ? {
                                scheduledLocal: scheduleLocal,
                                timezone: "Asia/Kolkata"
                              }
                            : undefined
                        })
                      }
                    >
                      {scheduleLocal ? (
                        <CalendarClock className="size-4" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      {scheduleLocal ? "Schedule" : "Start now"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-sm border">
                <div className="border-b p-3 font-medium">Recipients</div>
                <div className="max-h-64 overflow-y-auto">
                  {(selectedBroadcastData?.data.recipients || []).map(
                    (recipient) => (
                      <div
                        key={recipient._id}
                        className="flex items-center justify-between border-b p-3 text-sm last:border-0"
                      >
                        <span>
                          {recipient.subscriberId?.firstName ||
                            recipient.phoneNumber}
                        </span>
                        <span className="capitalize text-muted-foreground">
                          {recipient.status}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Skeleton className="h-56" />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel {cancelTarget?.name || "this broadcast"} if it is
              still cancelable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep broadcast</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isCanceling}
              onClick={() => cancelTarget && cancelSelected(cancelTarget._id)}
            >
              Cancel broadcast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
