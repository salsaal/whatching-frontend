"use client";

import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  FilePlus2,
  Inbox,
  RefreshCw,
  Search,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import {
  getTemplateType,
  getTemplateEditId,
  mapDraftToTemplate,
  statusLabel,
  templateNeedsMedia,
  templateStatuses
} from "@/components/templates/templateUtils";
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
import { Input } from "@/components/ui/input";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";
import { useTemplateStore } from "@/stores/templateStore";

const statusIcons: Record<string, React.ElementType> = {
  ALL: CircleDashed,
  DRAFT: Inbox,
  PENDING: Clock3,
  APPROVED: CheckCircle2,
  REJECTED: ShieldAlert,
  ACTION_REQUIRED: ShieldAlert
};

const TEMPLATE_SYNC_SESSION_KEY = "whatching_templates_synced";

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(
    null
  );
  const [mediaTarget, setMediaTarget] = useState<MessageTemplate | null>(null);
  const bootstrappedOrgIdRef = useRef<string | null>(null);
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("ALL")
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
    enabled: Boolean(activeOrgId)
  });

  const { mutate: syncTemplatesMutate, mutateAsync: syncTemplatesAsync } =
    useMutation({
      mutationFn: syncTemplates
    });
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const { mutate: deleteTemplateMutate } = useMutation({
    mutationFn: async (template: MessageTemplate) => {
      const id =
        template.source === "draft" ? template._id : template.templateId;
      setDeletingId(id);
      return template.source === "draft"
        ? deleteDraftTemplate(template._id)
        : deleteTemplate(template.templateId);
    },
    onSuccess: (_data, template) => {
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
    if (!activeOrgId) return;
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
    refetchDrafts,
    refetchTemplates,
    syncTemplatesMutate,
    templateSyncSessionKey
  ]);

  useEffect(() => {
    if (data?.data.templates || draftsData?.data.drafts) {
      setTemplates([
        ...(draftsData?.data.drafts || []).map(mapDraftToTemplate),
        ...(data?.data.templates || []).map((template) => ({
          ...template,
          source: "meta" as const
        }))
      ]);
    }
  }, [data, draftsData, setTemplates]);

  const filteredTemplates = useMemo(() => {
    const normalizedStatus = status.toUpperCase();
    const normalizedQuery = query.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesStatus =
        normalizedStatus === "ALL" ||
        (normalizedStatus === "ACTION_REQUIRED"
          ? template.status.toUpperCase() === normalizedStatus ||
            templateNeedsMedia(template)
          : template.status.toUpperCase() === normalizedStatus);
      const matchesQuery =
        !normalizedQuery ||
        template.name.toLowerCase().includes(normalizedQuery) ||
        template.status.toLowerCase().includes(normalizedQuery) ||
        template.category.toLowerCase().includes(normalizedQuery) ||
        template.language.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, status, templates]);
  const isLoading = isTemplatesLoading || isDraftsLoading;
  const isRefreshing = isManualRefreshing;

  const handleRefresh = async () => {
    setIsManualRefreshing(true);

    try {
      await syncTemplatesAsync();
      sessionStorage.setItem(templateSyncSessionKey, "true");
      await Promise.all([refetchTemplates(), refetchDrafts()]);
    } catch {
      // Keep the button from getting stuck if the refresh request fails.
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleEdit = (template: MessageTemplate) => {
    if (template.status.toUpperCase() === "PENDING") return;

    router.push({
      pathname: `/templates/${getTemplateEditId(template)}`,
      query: template.source === "draft" ? { source: "draft" } : {}
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Templates</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              Message templates
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create, review, and manage WhatsApp templates for this
              organisation.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleRefresh}
              isLoading={isRefreshing}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button className="whitespace-nowrap">
              <Link
                href="/templates/create"
                className="flex items-center gap-1"
              >
                <FilePlus2 className="size-4" />
                Create template
              </Link>
            </Button>
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value || null)}
                placeholder="Search templates by status, name, category"
                className="h-12 rounded-sm border-0 bg-muted/70 pl-9 shadow-none"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {templateStatuses.map((item) => {
                const Icon = statusIcons[item];
                const active = status.toUpperCase() === item;
                const hasActionRequired =
                  item === "ACTION_REQUIRED" &&
                  templates.some((template) => templateNeedsMedia(template));

                return (
                  <button
                    key={item}
                    onClick={() =>
                      setStatus(item === "ALL" ? null : item, {
                        history: "push"
                      })
                    }
                    className={cn(
                      "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
                      active && "bg-primary/10 text-primary shadow-xs"
                    )}
                  >
                    <Icon className="size-4" />
                    {item === "ALL" ? "All" : statusLabel(item)}
                    {hasActionRequired && (
                      <span className="size-2 rounded-full bg-destructive" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <TemplatesTable
          templates={filteredTemplates}
          isLoading={isLoading}
          deletingId={deletingId}
          onEdit={handleEdit}
          onLinkMedia={setMediaTarget}
          onDelete={(templateId) => {
            const template = templates.find(
              (item) =>
                item._id === templateId || item.templateId === templateId
            );
            if (template) setDeleteTarget(template);
          }}
        />
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected template will be
              removed from this organisation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteTemplateMutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPickerDialog
        open={Boolean(mediaTarget)}
        selectedMediaId={mediaTarget?.defaultMediaId}
        requiredType={mediaTarget ? getTemplateType(mediaTarget) : undefined}
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
