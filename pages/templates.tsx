"use client";

import {
  FilePlus2,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAllBroadcasts } from "@/client-api/functions/broadcasts";
import {
  deleteDraftTemplate,
  deleteTemplate,
  getAllDraftTemplates,
  getAllTemplates,
  linkTemplateMedia,
  syncTemplates
} from "@/client-api/functions/templates";
import { MediaAsset } from "@/client-api/types/media.type";
import { MessageTemplate } from "@/client-api/types/templates.type";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import TemplatesTable from "@/components/templates/TemplatesTable";
import { templateBodyText } from "@/components/templates/TemplatePickerList";
import {
  getTemplateType,
  getTemplateEditId,
  mapDraftToTemplate,
  templateNeedsMedia
} from "@/components/templates/templateUtils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { formatRelative } from "@/lib/displayFormat";
import { describePermission } from "@/lib/permissions";
import {
  isTemplateInReview,
  isTemplateNeedingAttention
} from "@/lib/statusPresentation";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";
import { useTemplateStore } from "@/stores/templateStore";
import { LockedButton, PermissionGate } from "@/components/common/NoAccess";

const TEMPLATE_SYNC_SESSION_KEY = "whatching_templates_synced";

const statusTabs = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "review", label: "In review" },
  { value: "drafts", label: "Drafts" },
  { value: "attention", label: "Needs attention" }
] as const;
type StatusTab = (typeof statusTabs)[number]["value"];

const categoryChips = [
  { value: "all", label: "All" },
  { value: "marketing", label: "Marketing" },
  { value: "utility", label: "Utility" },
  { value: "authentication", label: "Authentication" }
] as const;

const isDraftTemplate = (template: MessageTemplate) =>
  template.source === "draft" || template.status.toUpperCase() === "DRAFT";

const matchesTab = (template: MessageTemplate, tab: string) => {
  switch (tab) {
    case "approved":
      return (
        !isDraftTemplate(template) &&
        template.status.toUpperCase() === "APPROVED"
      );
    case "review":
      return isTemplateInReview(template.status);
    case "drafts":
      return isDraftTemplate(template);
    case "attention":
      return (
        isTemplateNeedingAttention(template.status) ||
        templateNeedsMedia(template)
      );
    default:
      return true;
  }
};

const ACTIVE_BROADCAST_STATUSES = [
  "scheduled",
  "processing",
  "in_progress",
  "paused_limit"
];

const isMergeKey = (value: string | undefined): value is string =>
  Boolean(value);

const getTemplateMergeKeys = (template: MessageTemplate) =>
  [
    template.templateId,
    template.metaTemplateId,
    template.draftId,
    template._id,
    `${template.name}:${template.language}:${template.category}`
  ].filter(isMergeKey);

const mergeTemplateLists = (
  drafts: MessageTemplate[],
  metaTemplates: MessageTemplate[]
) => {
  const merged: MessageTemplate[] = [];
  const keyToIndex = new Map<string, number>();

  [...drafts, ...metaTemplates].forEach((template) => {
    const keys = getTemplateMergeKeys(template);
    const existingIndex = keys
      .map((key) => keyToIndex.get(key))
      .find((index): index is number => typeof index === "number");

    if (typeof existingIndex === "number") {
      const existing = merged[existingIndex];
      const preferred =
        existing.source === "draft" && template.source === "meta"
          ? template
          : template.source === "meta" &&
              Date.parse(template.updatedAt || "") >=
                Date.parse(existing.updatedAt || "")
            ? template
            : existing;
      merged[existingIndex] = preferred;
      getTemplateMergeKeys(preferred).forEach((key) =>
        keyToIndex.set(key, existingIndex)
      );
      return;
    }

    const nextIndex = merged.length;
    merged.push(template);
    keys.forEach((key) => keyToIndex.set(key, nextIndex));
  });

  return merged;
};

function TemplatesPageContent() {
  const router = useRouter();
  // The list itself only needs templates:view; drafts, sync, create, edit,
  // and delete all need templates:manage, so view-only members skip them.
  const { can, permissionSchema } = useCurrentMembership();
  const canManageTemplates = can("templates:manage");
  const canBroadcast = can("broadcasts:manage");
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<{
    message: string;
    broadcastHref: string;
  } | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MessageTemplate | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const bootstrappedOrgIdRef = useRef<string | null>(null);
  // Filters live in the URL so refresh and back keep them.
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all")
  );
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withDefault("all")
  );
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const { templates, setTemplates, removeTemplate } = useTemplateStore();
  const activeOrgId = useOrganizationStore(
    (state) => state.activeOrganization?._id
  );
  const templatesQueryKey = useMemo(
    () => ["templates", activeOrgId] as const,
    [activeOrgId]
  );
  const templateDraftsQueryKey = useMemo(
    () => ["template-drafts", activeOrgId] as const,
    [activeOrgId]
  );
  const templateSyncSessionKey = `${TEMPLATE_SYNC_SESSION_KEY}:${activeOrgId || "none"}`;

  const {
    data,
    isLoading: isTemplatesLoading,
    isError: isTemplatesError,
    error: templatesError,
    refetch: refetchTemplates
  } = useQuery({
    queryKey: templatesQueryKey,
    queryFn: getAllTemplates,
    enabled: Boolean(activeOrgId)
  });

  const {
    data: draftsData,
    isLoading: isDraftsLoading,
    refetch: refetchDrafts
  } = useQuery({
    queryKey: templateDraftsQueryKey,
    queryFn: getAllDraftTemplates,
    enabled: Boolean(activeOrgId) && canManageTemplates
  });

  const { mutate: syncTemplatesMutate, mutateAsync: syncTemplatesAsync } =
    useMutation({
      mutationFn: syncTemplates,
      onSuccess: (response) =>
        setLastSyncedAt(response.data?.lastSyncedAt || new Date().toISOString())
    });
  const [isSyncing, setIsSyncing] = useState(false);

  const findActiveBroadcastHref = async (template: MessageTemplate) => {
    try {
      const response = await getAllBroadcasts({ limit: 50 });
      const match = response.data.broadcasts.find(
        (broadcast) =>
          broadcast.template?.templateId === template.templateId &&
          ACTIVE_BROADCAST_STATUSES.includes(broadcast.status)
      );
      return match ? `/broadcasts/${match._id}` : "/broadcasts";
    } catch {
      return "/broadcasts";
    }
  };

  const { mutate: deleteTemplateMutate, isPending: isDeletingTemplate } =
    useMutation({
      mutationFn: async (template: MessageTemplate) => {
        const id =
          template.source === "draft" ? template._id : template.templateId;
        setDeletingId(id);
        return template.source === "draft"
          ? deleteDraftTemplate(template._id)
          : deleteTemplate(template.templateId);
      },
      meta: { showToast: false },
      onSuccess: (_data, template) => {
        toast.success(
          template.source === "draft"
            ? "Draft deleted."
            : "Template deleted. Meta may take a few days to remove it everywhere."
        );
        const id =
          template.source === "draft" ? template._id : template.templateId;

        removeTemplate(id);
        queryClient.setQueryData<typeof data>(templatesQueryKey, (current) =>
          current?.data.templates
            ? {
                ...current,
                data: {
                  ...current.data,
                  templates: current.data.templates.filter(
                    (item) => item.templateId !== id && item._id !== id
                  )
                }
              }
            : current
        );
        queryClient.setQueryData<typeof draftsData>(
          templateDraftsQueryKey,
          (current) =>
            current?.data.drafts
              ? {
                  ...current,
                  data: {
                    ...current.data,
                    drafts: current.data.drafts.filter(
                      (item) => item.templateId !== id && item._id !== id
                    )
                  }
                }
              : current
        );
        setDeleteTarget(null);
        syncTemplatesMutate(undefined, {
          onSuccess: async () => {
            await Promise.all([refetchTemplates(), refetchDrafts()]);
          }
        });
      },
      onError: async (error: AxiosError<{ message?: string }>, template) => {
        const message =
          error.response?.data?.message || "Couldn't delete this template.";
        // 409: a scheduled or running broadcast still uses it. Explain in
        // the dialog (which stays open) and link to that broadcast.
        if (error.response?.status === 409) {
          setDeleteError({
            message,
            broadcastHref: await findActiveBroadcastHref(template)
          });
          return;
        }
        setDeleteError({ message, broadcastHref: "" });
      },
      onSettled: () => setDeletingId(null)
    });

  const { mutate: linkMediaMutate } = useMutation({
    mutationFn: linkTemplateMedia,
    onSuccess: async () => {
      setMediaTarget(null);
      await refetchTemplates();
    }
  });

  useEffect(() => {
    setTemplates([]);
    bootstrappedOrgIdRef.current = null;
  }, [activeOrgId, setTemplates]);

  useEffect(() => {
    if (!activeOrgId || !canManageTemplates) return;
    if (bootstrappedOrgIdRef.current === activeOrgId) return;
    bootstrappedOrgIdRef.current = activeOrgId;

    if (sessionStorage.getItem(templateSyncSessionKey)) return;

    syncTemplatesMutate(undefined, {
      onSuccess: async () => {
        sessionStorage.setItem(templateSyncSessionKey, "true");
        await Promise.all([refetchTemplates(), refetchDrafts()]);
      }
    });
  }, [
    activeOrgId,
    canManageTemplates,
    refetchDrafts,
    refetchTemplates,
    syncTemplatesMutate,
    templateSyncSessionKey
  ]);

  useEffect(() => {
    if (data?.data.templates || draftsData?.data.drafts) {
      setTemplates(
        mergeTemplateLists(
          (draftsData?.data.drafts || []).map(mapDraftToTemplate),
          (data?.data.templates || []).map((template) => ({
            ...template,
            source: "meta" as const
          }))
        )
      );
    }
  }, [data, draftsData, setTemplates]);

  const byCategory = useMemo(
    () =>
      templates.filter(
        (template) =>
          category === "all" || template.category.toLowerCase() === category
      ),
    [category, templates]
  );
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        statusTabs.map((tab) => [
          tab.value,
          byCategory.filter((item) => matchesTab(item, tab.value)).length
        ])
      ) as Record<StatusTab, number>,
    [byCategory]
  );
  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return byCategory.filter(
      (template) =>
        matchesTab(template, status) &&
        (!needle ||
          template.name.toLowerCase().includes(needle) ||
          templateBodyText(template).toLowerCase().includes(needle))
    );
  }, [byCategory, query, status]);
  const counts = {
    approved: templates.filter((item) => matchesTab(item, "approved")).length,
    review: templates.filter((item) => matchesTab(item, "review")).length,
    rejected: templates.filter(
      (item) => item.status.toUpperCase() === "REJECTED"
    ).length
  };
  const isLoading = isTemplatesLoading || isDraftsLoading;

  const handleSync = async () => {
    setIsSyncing(true);
    if (!canManageTemplates) {
      // Syncing from Meta needs templates:manage; view-only members just
      // reload what's already stored.
      await refetchTemplates();
      setIsSyncing(false);
      return;
    }
    try {
      await syncTemplatesAsync();
      sessionStorage.setItem(templateSyncSessionKey, "true");
      await Promise.all([refetchTemplates(), refetchDrafts()]);
    } catch (error) {
      toast.error(
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
          "Couldn't sync from Meta."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpen = (template: MessageTemplate) => {
    if (!canManageTemplates) return;
    if (isTemplateInReview(template.status) && !isDraftTemplate(template)) {
      toast.info(
        "This template is in review with Meta and can't be edited yet."
      );
      return;
    }
    router.push({
      pathname: `/templates/${getTemplateEditId(template)}`,
      query: template.source === "draft" ? { source: "draft" } : {}
    });
  };

  const handleDuplicate = (template: MessageTemplate) =>
    router.push({
      pathname: "/templates/create",
      query: {
        duplicate: getTemplateEditId(template),
        ...(template.source === "draft" ? { source: "draft" } : {})
      }
    });

  const errorText =
    (templatesError as AxiosError<{ message?: string }> | null)?.response?.data
      ?.message || "Templates couldn't be loaded.";

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold">
              Message templates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved templates can be sent in broadcasts and from the inbox.
            </p>
            {!isLoading && (
              <p className="mt-2 text-xs text-muted-foreground">
                {counts.approved} approved · {counts.review} in review ·{" "}
                {counts.rejected} rejected
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {lastSyncedAt && (
              <span className="text-xs text-muted-foreground sm:mr-1">
                Synced{" "}
                {formatRelative(lastSyncedAt) === "Just now"
                  ? "just now"
                  : formatRelative(lastSyncedAt)}
              </span>
            )}
            <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw
                className={cn("size-4", isSyncing && "animate-spin")}
              />
              Sync from Meta
            </Button>
            {canManageTemplates ? (
              <Button asChild className="whitespace-nowrap">
                <Link href="/templates/create">
                  <FilePlus2 className="size-4" />
                  Create template
                </Link>
              </Button>
            ) : (
              <LockedButton
                className="whitespace-nowrap"
                reason={`You need ${describePermission("templates:manage", permissionSchema)} access`}
              >
                <FilePlus2 className="size-4" />
                Create template
              </LockedButton>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-lg bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value || null)}
                placeholder="Search name or message text"
                aria-label="Search templates"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() =>
                    setStatus(tab.value === "all" ? null : tab.value, {
                      history: "push"
                    })
                  }
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
                    status === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px]",
                      status === tab.value ? "bg-white/25" : "bg-muted",
                      tab.value === "attention" &&
                        tabCounts.attention > 0 &&
                        status !== tab.value &&
                        "bg-red-100 text-red-700"
                    )}
                  >
                    {tabCounts[tab.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categoryChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() =>
                  setCategory(chip.value === "all" ? null : chip.value, {
                    history: "push"
                  })
                }
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition",
                  category === chip.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:border-primary/40"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>

        {isTemplatesError ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <ShieldAlert className="size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{errorText}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTemplates()}
            >
              Retry
            </Button>
          </div>
        ) : !isLoading && templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg bg-white px-6 py-14 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FilePlus2 className="size-6" />
            </span>
            <p className="max-w-md text-sm text-muted-foreground">
              No templates yet — templates are the messages you can send first
              to customers.
            </p>
            {canManageTemplates && (
              <Button asChild>
                <Link href="/templates/create">Create template</Link>
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help items-center gap-1 text-xs text-muted-foreground underline decoration-dotted">
                  <HelpCircle className="size-3.5" />
                  What&apos;s a template?
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Meta must approve every message you start; replies within 24h
                don&apos;t need one.
              </TooltipContent>
            </Tooltip>
          </div>
        ) : !isLoading && filteredTemplates.length === 0 ? (
          <div className="rounded-lg bg-white p-10 text-center text-sm text-muted-foreground shadow-xs">
            No templates match these filters.
          </div>
        ) : (
          <TemplatesTable
            templates={filteredTemplates}
            isLoading={isLoading}
            deletingId={deletingId}
            canManage={canManageTemplates}
            onOpen={handleOpen}
            onDuplicate={handleDuplicate}
            onUseInBroadcast={
              canBroadcast
                ? (template) =>
                    router.push({
                      pathname: "/broadcasts",
                      query: { new: "1", templateId: template.templateId }
                    })
                : undefined
            }
            onLinkMedia={setMediaTarget}
            onDelete={(template) => {
              setDeleteError(null);
              setDeleteTarget(template);
            }}
          />
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete <span className="font-mono">{deleteTarget?.name}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && isDraftTemplate(deleteTarget)
                ? "This draft was never submitted to Meta. It's removed for good."
                : "It's removed from Meta for every language. Broadcasts already sent keep their history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div
              role="alert"
              className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <p>{deleteError.message}</p>
              {deleteError.broadcastHref && (
                <Link
                  href={deleteError.broadcastHref}
                  className="font-medium underline"
                >
                  Open broadcast
                </Link>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeletingTemplate}
              onClick={() => deleteTarget && deleteTemplateMutate(deleteTarget)}
            >
              {isDeletingTemplate && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPickerDialog
        open={Boolean(mediaTarget)}
        selectedMediaId={mediaTarget?.defaultMediaId}
        requiredType={mediaTarget ? getTemplateType(mediaTarget) : undefined}
        incompatibleHint="Image templates support JPG or PNG"
        onOpenChange={(open) => !open && setMediaTarget(null)}
        onSelect={(media: MediaAsset) => {
          if (!mediaTarget) return;
          linkMediaMutate({
            templateId: mediaTarget.templateId,
            mediaId: media._id
          });
        }}
      />
    </AppLayout>
  );
}

export default function TemplatesPage() {
  return (
    <PermissionGate permission="templates:view" feature="Templates">
      <TemplatesPageContent />
    </PermissionGate>
  );
}
