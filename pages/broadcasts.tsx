"use client";

import {
  CalendarClock,
  CalendarIcon,
  Clock,
  CreditCard,
  Eye,
  Megaphone,
  Plus,
  RotateCcw,
  Search,
  Send,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  cancelBroadcast,
  consentToBroadcastMessagingLimitRetry,
  createBroadcast,
  getAllBroadcasts,
  getBroadcastById,
  startBroadcast
} from "@/client-api/functions/broadcasts";
import { getBotCanvasTriggers } from "@/client-api/functions/bot";
import {
  getWhatsAppOutboundReadiness,
  testWhatsAppOutboundReadiness
} from "@/client-api/functions/organizations";
import { listCampaigns } from "@/client-api/functions/campaigns";
import { getAllSubscribers, getTags } from "@/client-api/functions/subscribers";
import { getAllTemplates } from "@/client-api/functions/templates";
import {
  Broadcast,
  BroadcastAudience
} from "@/client-api/types/broadcasts.type";
import { MessageTemplate } from "@/client-api/types/templates.type";
import { Subscriber } from "@/client-api/types/subscribers.type";
import {
  ALL_WHATSAPP_NUMBERS,
  WhatsAppNumberSwitcher,
  useWhatsAppNumberContext
} from "@/components/whatsapp/WhatsAppNumberSwitcher";
import {
  extractVariables,
  getBodyComponent,
  getButtonsComponent
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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import AppLayout from "@/layouts/AppLayout";
import {
  hasBroadcastRetryPreference,
  setBroadcastRetryPreference
} from "@/lib/broadcastRetryPreference";
import { buildMetaPaymentMethodUrl } from "@/lib/metaBilling";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

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

const formatCalendarDate = (date?: Date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(date)
    : "Pick date";

const getLocalDateValue = (date: Date, time: string) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T${time || "09:00"}`;
};

const hourOptions = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);
const minuteOptions = ["00", "15", "30", "45"];
const BROADCASTS_PAGE_SIZE = 30;
const BROADCAST_SUBSCRIBERS_PAGE_SIZE = 50;

const statusClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-50 text-blue-700",
  processing: "bg-amber-50 text-amber-700",
  in_progress: "bg-amber-50 text-amber-700",
  paused_limit: "bg-orange-50 text-orange-700",
  completed: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground"
};

type BroadcastVariableSource =
  | "subscriber_field"
  | "metadata_field"
  | "literal";

interface BroadcastVariableMapping {
  source: BroadcastVariableSource;
  path: string;
  fallback: string;
  literal: string;
}

const subscriberFieldOptions = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "fullName", label: "Full name" },
  { value: "phoneNumber", label: "Phone number" },
  { value: "waId", label: "WhatsApp ID" }
] as const;

const getTemplateBodyText = (template?: MessageTemplate) =>
  getBodyComponent(template?.components || [])?.text || "";

const getTemplateBodyVariables = (template?: MessageTemplate) =>
  extractVariables(getTemplateBodyText(template)).sort(
    (a, b) => Number(a) - Number(b)
  );

const getTemplateBodyExample = (
  template: MessageTemplate | undefined,
  key: string
) => {
  const examples = getBodyComponent(template?.components || [])?.example
    ?.body_text;
  const sampleValues = Array.isArray(examples?.[0]) ? examples?.[0] : examples;
  return Array.isArray(sampleValues)
    ? String(sampleValues[Number(key) - 1] || "")
    : "";
};

const defaultVariableMapping = (key: string): BroadcastVariableMapping => ({
  source: key === "1" ? "subscriber_field" : "literal",
  path: key === "1" ? "firstName" : "",
  fallback: key === "1" ? "Valued Customer" : "",
  literal: ""
});

const buildBroadcastComponents = (
  variables: string[],
  mappings: Record<string, BroadcastVariableMapping>
) => {
  if (!variables.length) return [];

  const parameters = variables.map((key) => {
    const mapping = mappings[key] || defaultVariableMapping(key);

    if (mapping.source === "literal") {
      if (!mapping.literal.trim()) {
        toast.error(`Add a value for {{${key}}}`);
        return null;
      }

      return {
        type: "text",
        value: {
          source: "literal",
          text: mapping.literal.trim()
        }
      };
    }

    if (mapping.source === "metadata_field") {
      if (!mapping.path.trim()) {
        toast.error(`Add a metadata path for {{${key}}}`);
        return null;
      }

      return {
        type: "text",
        value: {
          source: "metadata_field",
          path: mapping.path.trim(),
          fallback: mapping.fallback.trim() || undefined
        }
      };
    }

    return {
      type: "text",
      value: {
        source: "subscriber_field",
        path: mapping.path || "firstName",
        fallback: mapping.fallback.trim() || undefined
      }
    };
  });

  if (parameters.some((parameter) => !parameter)) return null;

  return [
    {
      type: "body",
      parameters
    }
  ];
};

export default function BroadcastsPage() {
  const router = useRouter();
  const broadcastLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const subscriberLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Broadcast | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [broadcastName, setBroadcastName] = useState("");
  const { selectedPhoneNumberId, effectiveNumber } = useWhatsAppNumberContext();
  const [senderPhoneNumberId, setSenderPhoneNumberId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [quickReplyRoutes, setQuickReplyRoutes] = useState<
    Record<number, string>
  >({});
  const [variableMappings, setVariableMappings] = useState<
    Record<string, BroadcastVariableMapping>
  >({});
  const [audienceMode, setAudienceMode] =
    useState<BroadcastAudience["mode"]>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>(
    []
  );
  const [selectedCampaignSourceIds, setSelectedCampaignSourceIds] = useState<
    string[]
  >([]);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [retryOnMessagingLimit, setRetryOnMessagingLimit] = useState(true);
  const paymentMethodUrl = buildMetaPaymentMethodUrl({
    businessId: activeOrganization?.metaConfig?.clientBusinessId,
    wabaId: effectiveNumber?.wabaId || activeOrganization?.metaConfig?.wabaId
  });
  const senderRecordId = effectiveNumber?._id || effectiveNumber?.id || "";
  const {
    data: readinessData,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness
  } = useQuery({
    queryKey: ["whatsapp-outbound-readiness", senderRecordId],
    queryFn: () => getWhatsAppOutboundReadiness(senderRecordId),
    enabled: Boolean(senderRecordId),
    refetchInterval: 4000,
    refetchOnWindowFocus: true
  });
  const canCreateBroadcast =
    readinessData?.data.canStartBroadcast === true ||
    readinessData?.data.readiness.status === "ready";
  const readiness = readinessData?.data.readiness;
  const readinessBlocker = readinessData?.data.blocker;

  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["broadcasts", selectedPhoneNumberId, query.trim()],
    queryFn: ({ pageParam }) =>
      getAllBroadcasts({
        page: pageParam,
        limit: BROADCASTS_PAGE_SIZE,
        q: query,
        ...(selectedPhoneNumberId !== ALL_WHATSAPP_NUMBERS
          ? { phoneNumberId: selectedPhoneNumberId }
          : {})
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.pagination.page;
      return currentPage < lastPage.pagination.totalPages
        ? currentPage + 1
        : undefined;
    },
    refetchOnMount: "always",
    refetchInterval: 5000
  });
  const { data: templatesData } = useQuery({
    queryKey: ["templates"],
    queryFn: getAllTemplates
  });
  const {
    data: subscribersData,
    isFetchingNextPage: isFetchingMoreSubscribers,
    hasNextPage: hasMoreSubscribers,
    fetchNextPage: fetchMoreSubscribers
  } = useInfiniteQuery({
    queryKey: ["broadcast-subscribers", subscriberSearch],
    queryFn: ({ pageParam }) =>
      getAllSubscribers({
        channel: "whatsapp",
        page: pageParam,
        limit: BROADCAST_SUBSCRIBERS_PAGE_SIZE,
        q: subscriberSearch,
        broadcastEligibility: "eligible"
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.pagination.page;
      return currentPage < lastPage.pagination.totalPages
        ? currentPage + 1
        : undefined;
    },
    enabled: isCreateOpen && audienceMode === "specific"
  });
  const { data: tagsData } = useQuery({
    queryKey: ["subscriber-tags"],
    queryFn: getTags
  });
  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", "broadcast-audience"],
    queryFn: () => listCampaigns({ sort: "recent", limit: 100 }),
    enabled: isCreateOpen && audienceMode === "campaign"
  });
  const { data: senderTriggersData } = useQuery({
    queryKey: ["bot-canvas-triggers", senderPhoneNumberId],
    queryFn: () => getBotCanvasTriggers(senderPhoneNumberId),
    enabled: Boolean(isCreateOpen && senderPhoneNumberId),
    refetchOnMount: "always"
  });
  const { data: selectedBroadcastData, refetch: refetchSelectedBroadcast } =
    useQuery({
      queryKey: ["broadcast-preview", selectedBroadcastId],
      queryFn: () => getBroadcastById(selectedBroadcastId),
      enabled: Boolean(selectedBroadcastId),
      refetchInterval: selectedBroadcastId ? 3000 : false
    });

  const broadcasts = useMemo(() => {
    const uniqueBroadcasts = new Map<string, Broadcast>();
    data?.pages
      .flatMap((page) => page.data.broadcasts || [])
      .forEach((broadcast) => uniqueBroadcasts.set(broadcast._id, broadcast));
    return Array.from(uniqueBroadcasts.values());
  }, [data?.pages]);
  const templates = useMemo(
    () =>
      (templatesData?.data.templates || []).filter(
        (template) => template.status.toUpperCase() === "APPROVED"
      ),
    [templatesData?.data.templates]
  );
  const subscribers = useMemo(() => {
    const uniqueSubscribers = new Map<string, Subscriber>();
    subscribersData?.pages
      .flatMap((page) => page.data.subscribers || [])
      .filter((subscriber) => Boolean(subscriber.phoneNumber))
      .forEach((subscriber) =>
        uniqueSubscribers.set(subscriber._id, subscriber)
      );
    return Array.from(uniqueSubscribers.values());
  }, [subscribersData?.pages]);
  const tags = useMemo(
    () => (tagsData?.data.tags || []).map((tag) => tag.name),
    [tagsData?.data.tags]
  );
  const campaigns = campaignsData?.data.campaigns || [];
  const filteredBroadcasts = broadcasts;

  const selectedBroadcast = selectedBroadcastData?.data.broadcast;
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.templateId === templateId),
    [templateId, templates]
  );
  const bodyVariables = useMemo(
    () => getTemplateBodyVariables(selectedTemplate),
    [selectedTemplate]
  );
  const bodyText = getTemplateBodyText(selectedTemplate);
  const personalizedBodyText = useMemo(
    () =>
      bodyText.replace(/{{(\d+)}}/g, (placeholder, key: string) => {
        const mapping = variableMappings[key] || defaultVariableMapping(key);
        if (mapping.source === "literal") {
          return mapping.literal.trim() || placeholder;
        }
        return (
          mapping.fallback.trim() ||
          subscriberFieldOptions.find((option) => option.value === mapping.path)
            ?.label ||
          mapping.path ||
          placeholder
        );
      }),
    [bodyText, variableMappings]
  );
  const quickReplyButtons = useMemo(
    () =>
      getButtonsComponent(selectedTemplate?.components || [])
        ?.buttons?.map((button, index) => ({ button, index }))
        .filter(({ button }) => button.type === "QUICK_REPLY") || [],
    [selectedTemplate?.components]
  );
  const senderTriggerKeys = useMemo(
    () => new Set(senderTriggersData?.data?.triggerKeys || []),
    [senderTriggersData?.data?.triggerKeys]
  );
  const selectedQuickReplyRoutes = useMemo(
    () =>
      quickReplyButtons.map(({ button, index }) => ({
        index,
        label: button.text || `Quick reply ${index + 1}`,
        triggerKey: quickReplyRoutes[index] || ""
      })),
    [quickReplyButtons, quickReplyRoutes]
  );

  useEffect(() => {
    if (
      isCreateOpen &&
      !senderPhoneNumberId &&
      effectiveNumber?.phoneNumberId
    ) {
      setSenderPhoneNumberId(effectiveNumber.phoneNumberId);
    }
  }, [effectiveNumber?.phoneNumberId, isCreateOpen, senderPhoneNumberId]);

  useEffect(() => {
    if (!selectedTemplate) {
      setVariableMappings({});
      setQuickReplyRoutes({});
      return;
    }

    setVariableMappings((current) =>
      bodyVariables.reduce<Record<string, BroadcastVariableMapping>>(
        (acc, key) => {
          acc[key] = current[key] || defaultVariableMapping(key);
          return acc;
        },
        {}
      )
    );
    setQuickReplyRoutes({});
  }, [bodyVariables, selectedTemplate]);

  const { mutate: createDraft, isPending: isCreating } = useMutation({
    mutationFn: createBroadcast,
    onSuccess: (response) => {
      setBroadcastRetryPreference(
        response.data.broadcast._id,
        retryOnMessagingLimit
      );
      toast.success("Broadcast draft created");
      setIsCreateOpen(false);
      setSelectedBroadcastId(response.data.broadcast._id);
      setBroadcastName("");
      setTemplateId("");
      setVariableMappings({});
      setQuickReplyRoutes({});
      setAudienceMode("all");
      setSelectedTags([]);
      setSelectedSubscriberIds([]);
      setRetryOnMessagingLimit(true);
      refetch();
    }
  });
  const { mutate: runReadinessTest, isPending: isTestingReadiness } =
    useMutation({
      mutationFn: () => testWhatsAppOutboundReadiness(senderRecordId),
      onSuccess: async (response) => {
        toast.success(
          response.message ||
            "Broadcast verification started. Waiting for Meta's delivery status."
        );
        await refetchReadiness();
      }
    });
  const { mutate: consentToRetry, isPending: isConsentingToRetry } =
    useMutation({
      mutationFn: consentToBroadcastMessagingLimitRetry,
      onSuccess: async (response) => {
        toast.success(response.message);
        setBroadcastRetryPreference(response.data.broadcastId, false);
        await Promise.all([refetch(), refetchSelectedBroadcast()]);
      },
      onError: (_error, broadcastId) => {
        setBroadcastRetryPreference(broadcastId, false);
      }
    });

  useEffect(() => {
    const retryCandidate = broadcasts.find(
      (broadcast) =>
        broadcast.status === "paused_limit" &&
        broadcast.messagingLimitRetry?.status === "awaiting_consent" &&
        hasBroadcastRetryPreference(broadcast._id)
    );
    if (retryCandidate && !isConsentingToRetry) {
      consentToRetry(retryCandidate._id);
    }
  }, [broadcasts, consentToRetry, isConsentingToRetry]);

  useEffect(() => {
    const sentinel = broadcastLoadMoreRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const sentinel = subscriberLoadMoreRef.current;
    if (!sentinel || !hasMoreSubscribers || audienceMode !== "specific") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingMoreSubscribers) {
          fetchMoreSubscribers();
        }
      },
      { rootMargin: "120px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    audienceMode,
    fetchMoreSubscribers,
    hasMoreSubscribers,
    isFetchingMoreSubscribers
  ]);

  const { mutate: startSelected, isPending: isStarting } = useMutation({
    mutationFn: startBroadcast,
    onSuccess: () => {
      toast.success("Broadcast accepted for processing");
      setScheduleDate(undefined);
      setScheduleTime("09:00");
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

    if (!canCreateBroadcast) {
      toast.error("Complete outbound verification before creating broadcasts.");
      return;
    }
    if (!broadcastName.trim() || !templateId) {
      toast.error("Broadcast name and template are required");
      return;
    }
    if (!senderPhoneNumberId) {
      toast.error("Select the WhatsApp sender number");
      return;
    }
    if (
      quickReplyButtons.length &&
      senderTriggersData?.data &&
      !senderTriggersData.data.triggers.length
    ) {
      toast.error(
        "No flow triggers are available for the selected sender number"
      );
      return;
    }
    const missingQuickReplyRoute = selectedQuickReplyRoutes.find(
      (route) => !route.triggerKey || !senderTriggerKeys.has(route.triggerKey)
    );
    if (missingQuickReplyRoute) {
      toast.error("Assign every quick reply to a broadcast trigger");
      return;
    }

    const audience: BroadcastAudience =
      audienceMode === "tags"
        ? { mode: "tags", tags: selectedTags, tagMatch: "any" }
        : audienceMode === "specific"
          ? {
              mode: "specific",
              subscriberIds: selectedSubscriberIds
            }
          : audienceMode === "campaign"
            ? {
                mode: "campaign",
                campaignSourceIds: selectedCampaignSourceIds
              }
            : { mode: "all" };

    const components = buildBroadcastComponents(
      bodyVariables,
      variableMappings
    );
    if (!components) return;

    createDraft({
      name: broadcastName.trim(),
      templateId,
      audience,
      components,
      phoneNumberId: senderPhoneNumberId,
      ...(selectedQuickReplyRoutes.length
        ? { quickReplyRoutes: selectedQuickReplyRoutes }
        : {})
    });
  };

  const canStart =
    selectedBroadcast?.status === "draft" ||
    selectedBroadcast?.status === "scheduled";
  const [scheduleHour, scheduleMinute] = scheduleTime.split(":");

  const handleStartNow = () => {
    if (!selectedBroadcast) return;
    startSelected({
      broadcastId: selectedBroadcast._id
    });
  };

  const handleScheduleBroadcast = () => {
    if (!selectedBroadcast) return;
    if (!scheduleDate) {
      toast.error("Choose a date before scheduling this broadcast.");
      return;
    }

    startSelected({
      broadcastId: selectedBroadcast._id,
      payload: {
        scheduledLocal: getLocalDateValue(scheduleDate, scheduleTime),
        timezone: "Asia/Kolkata"
      }
    });
  };

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
          <div className="flex flex-row flex-wrap items-center gap-2">
            {paymentMethodUrl ? (
              <Button variant="outline" className="whitespace-nowrap" asChild>
                <a
                  href={paymentMethodUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-2 items-center"
                >
                  <CreditCard className="size-4" />
                  Add payment method
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                tooltip="Connect a WhatsApp Business account before adding its payment method"
              >
                <CreditCard className="size-4" />
                Add payment method
              </Button>
            )}
            {canCreateBroadcast && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" />
                New broadcast
              </Button>
            )}
          </div>
        </section>

        {!canCreateBroadcast && senderRecordId && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-amber-950">
                  {isReadinessLoading
                    ? "Checking broadcast setup"
                    : readiness?.status === "testing"
                      ? "Broadcast verification pending"
                      : readiness?.status === "template_pending"
                        ? "Verification template awaiting approval"
                        : "Complete broadcast setup"}
                </p>
                <p className="mt-1 max-w-3xl text-sm text-amber-900/80">
                  {readinessBlocker?.message ||
                    readiness?.failureMessage ||
                    "We send a one-time test template to verify that this sender can start paid business messages. The test costs approximately Rs. 0.115."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {paymentMethodUrl && (
                  <Button variant="outline" asChild>
                    <a
                      href={paymentMethodUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex gap-2 items-center"
                    >
                      <CreditCard className="size-4" />
                      Add payment method
                    </a>
                  </Button>
                )}
                {readiness?.status !== "testing" && (
                  <Button
                    disabled={isTestingReadiness}
                    onClick={() => runReadinessTest()}
                  >
                    <RotateCcw
                      className={cn(
                        "size-4",
                        isTestingReadiness && "animate-spin"
                      )}
                    />
                    {readiness?.status === "template_pending"
                      ? "Check approval and continue"
                      : "Run verification"}
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

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

        {isError && (
          <QueryErrorState message="Broadcasts could not be loaded for this organisation." />
        )}

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
                    <th className="p-4">Sender</th>
                    <th className="p-4">Recipients</th>
                    <th className="p-4">Created</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBroadcasts.map((broadcast) => (
                    <tr key={broadcast._id} className="border-t">
                      <td className="p-4">
                        <p className="font-medium">{broadcast.name}</p>
                        {(broadcast.lastError ||
                          broadcast.messagingLimitRetry
                            ?.lastFailureMessage) && (
                          <p
                            className="mt-1 max-w-64 truncate text-xs text-destructive"
                            title={
                              broadcast.lastError ||
                              broadcast.messagingLimitRetry?.lastFailureMessage
                            }
                          >
                            {broadcast.lastError ||
                              broadcast.messagingLimitRetry?.lastFailureMessage}
                          </p>
                        )}
                      </td>
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
                        {broadcast.whatsappSender?.displayPhoneNumber ||
                          broadcast.whatsappSender?.phoneNumberId ||
                          broadcast.displayPhoneNumber ||
                          broadcast.whatsappPhoneNumberId ||
                          broadcast.phoneNumberId ||
                          "-"}
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
                            tooltip="View broadcast details"
                            onClick={() =>
                              router.push(`/broadcasts/${broadcast._id}`)
                            }
                          >
                            <Eye className="size-4" />
                          </Button>
                          {broadcast.status === "paused_limit" &&
                            broadcast.messagingLimitRetry?.status ===
                              "awaiting_consent" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                tooltip="Consent to retry unfinished recipients after Meta's recovery period"
                                disabled={isConsentingToRetry}
                                onClick={() => consentToRetry(broadcast._id)}
                              >
                                <RotateCcw className="size-4" />
                              </Button>
                            )}
                          {["draft", "scheduled", "processing"].includes(
                            broadcast.status
                          ) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              tooltip="Cancel this broadcast"
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
              <div ref={broadcastLoadMoreRef} className="h-px" />
              {isFetchingNextPage && (
                <div className="space-y-3 border-t p-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12" />
                  ))}
                </div>
              )}
              {!hasNextPage && broadcasts.length > 0 && (
                <p className="border-t p-4 text-center text-xs text-muted-foreground">
                  All matching broadcasts are loaded.
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Megaphone}
              title="No broadcasts found"
              description="Create a broadcast to reach subscribers by tag, campaign, or your full audience."
            />
          )}
        </section>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create broadcast draft</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleCreate}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden pr-1">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={broadcastName}
                    onChange={(event) => setBroadcastName(event.target.value)}
                    placeholder="E.g. July product update"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select
                    value={templateId}
                    onValueChange={(value) => {
                      setTemplateId(value);
                      setQuickReplyRoutes({});
                    }}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem
                          key={template.templateId}
                          value={template.templateId}
                        >
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp sender</Label>
                  <WhatsAppNumberSwitcher
                    includeAll={false}
                    value={senderPhoneNumberId}
                    onValueChange={setSenderPhoneNumberId}
                    className="h-11 w-full"
                  />
                </div>
              </div>

              {selectedTemplate && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedTemplate.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedTemplate.language} ·{" "}
                        {selectedTemplate.category}
                      </p>
                    </div>
                    <span className="rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {bodyVariables.length
                        ? `${bodyVariables.length} variable${bodyVariables.length > 1 ? "s" : ""}`
                        : "No body variables"}
                    </span>
                  </div>
                  {bodyText && (
                    <div className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-muted-foreground shadow-xs">
                      {personalizedBodyText}
                    </div>
                  )}
                  {quickReplyButtons.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold">
                          Quick reply triggers
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choose the flow trigger for each quick reply in this
                          broadcast. Triggers come from the selected sender
                          number, with the organisation fallback used when no
                          number-specific flow is assigned.
                        </p>
                      </div>
                      <div className="space-y-2">
                        {quickReplyButtons.map(({ button, index }) => {
                          const selectedTriggerKey =
                            quickReplyRoutes[index] || "";
                          const selectedTriggerMissing =
                            selectedTriggerKey &&
                            !senderTriggerKeys.has(selectedTriggerKey);

                          return (
                            <div
                              key={`${button.text}-${index}`}
                              className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)]"
                            >
                              <div>
                                <Label>
                                  {button.text || `Quick reply ${index + 1}`}
                                </Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Button {index + 1}
                                </p>
                              </div>
                              <Select
                                value={selectedTriggerKey}
                                onValueChange={(value) =>
                                  setQuickReplyRoutes((current) => ({
                                    ...current,
                                    [index]: value
                                  }))
                                }
                                disabled={!senderPhoneNumberId}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "w-full bg-white",
                                    selectedTriggerMissing &&
                                      "ring-2 ring-amber-400"
                                  )}
                                >
                                  <SelectValue
                                    placeholder={
                                      senderTriggersData
                                        ? "Choose flow trigger"
                                        : "Select sender first"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedTriggerMissing && (
                                    <SelectItem
                                      value={selectedTriggerKey}
                                      disabled
                                    >
                                      {selectedTriggerKey} (unavailable)
                                    </SelectItem>
                                  )}
                                  {(
                                    senderTriggersData?.data?.triggers || []
                                  ).map((trigger) => (
                                    <SelectItem
                                      key={trigger.triggerKey}
                                      value={trigger.triggerKey}
                                    >
                                      {trigger.name} · {trigger.triggerKey}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {bodyVariables.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold">
                          Template variables
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Map each WhatsApp placeholder to subscriber data or a
                          fixed value. The number of fields here must match the
                          template.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {bodyVariables.map((key) => {
                          const mapping =
                            variableMappings[key] ||
                            defaultVariableMapping(key);
                          const sample = getTemplateBodyExample(
                            selectedTemplate,
                            key
                          );

                          return (
                            <div
                              key={key}
                              className="rounded-md bg-muted/40 p-3"
                            >
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <Label>{`{{${key}}}`}</Label>
                                {sample && (
                                  <span className="text-xs text-muted-foreground">
                                    Sample: {sample}
                                  </span>
                                )}
                              </div>
                              <div className="grid gap-2 lg:grid-cols-[180px_1fr_1fr]">
                                <Select
                                  value={mapping.source}
                                  onValueChange={(value) =>
                                    setVariableMappings((current) => ({
                                      ...current,
                                      [key]: {
                                        ...mapping,
                                        source:
                                          value as BroadcastVariableSource,
                                        path:
                                          value === "subscriber_field"
                                            ? "firstName"
                                            : ""
                                      }
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="subscriber_field">
                                      Subscriber field
                                    </SelectItem>
                                    <SelectItem value="metadata_field">
                                      Metadata field
                                    </SelectItem>
                                    <SelectItem value="literal">
                                      Fixed value
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                {mapping.source === "subscriber_field" ? (
                                  <Select
                                    value={mapping.path || "firstName"}
                                    onValueChange={(value) =>
                                      setVariableMappings((current) => ({
                                        ...current,
                                        [key]: { ...mapping, path: value }
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {subscriberFieldOptions.map((option) => (
                                        <SelectItem
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    value={
                                      mapping.source === "literal"
                                        ? mapping.literal
                                        : mapping.path
                                    }
                                    placeholder={
                                      mapping.source === "literal"
                                        ? "Fixed text"
                                        : "metadata.path"
                                    }
                                    onChange={(event) =>
                                      setVariableMappings((current) => ({
                                        ...current,
                                        [key]: {
                                          ...mapping,
                                          ...(mapping.source === "literal"
                                            ? { literal: event.target.value }
                                            : { path: event.target.value })
                                        }
                                      }))
                                    }
                                  />
                                )}

                                <Input
                                  value={mapping.fallback}
                                  placeholder="Fallback optional"
                                  disabled={mapping.source === "literal"}
                                  onChange={(event) =>
                                    setVariableMappings((current) => ({
                                      ...current,
                                      [key]: {
                                        ...mapping,
                                        fallback: event.target.value
                                      }
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Audience</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {(["all", "tags", "specific", "campaign"] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAudienceMode(mode)}
                        className={cn(
                          "rounded-md border bg-white p-3 text-left text-sm font-medium capitalize shadow-xs transition hover:border-primary/30",
                          audienceMode === mode &&
                            "border-primary/40 bg-primary/10 text-primary"
                        )}
                      >
                        {mode}
                      </button>
                    )
                  )}
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
                        selectedTags.includes(tag) &&
                          "bg-primary/10 text-primary"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {audienceMode === "campaign" && (
                <div className="rounded-sm border p-3">
                  {campaigns.length ? (
                    <div className="flex flex-col gap-2">
                      {campaigns.map((campaign) => (
                        <label
                          key={campaign.sourceId}
                          className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <span className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedCampaignSourceIds.includes(
                                campaign.sourceId
                              )}
                              onCheckedChange={() =>
                                setSelectedCampaignSourceIds((current) =>
                                  current.includes(campaign.sourceId)
                                    ? current.filter(
                                        (item) => item !== campaign.sourceId
                                      )
                                    : [...current, campaign.sourceId]
                                )
                              }
                            />
                            {campaign.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {campaign.subscriberCount} contacts
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="p-2 text-sm text-muted-foreground">
                      No campaigns found.
                    </p>
                  )}
                </div>
              )}

              {audienceMode === "specific" && (
                <div className="rounded-sm border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        value={subscriberSearch}
                        onChange={(event) =>
                          setSubscriberSearch(event.target.value)
                        }
                        placeholder="Search subscriber name or phone"
                        className="pl-9"
                      />
                    </div>
                    <Badge variant="outline">
                      {selectedSubscriberIds.length} selected
                    </Badge>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {subscribers.length ? (
                      subscribers.map((subscriber) => (
                        <label
                          key={subscriber._id}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                        >
                          <Checkbox
                            checked={selectedSubscriberIds.includes(
                              subscriber._id
                            )}
                            onCheckedChange={(checked) =>
                              setSelectedSubscriberIds((current) =>
                                checked
                                  ? [...current, subscriber._id]
                                  : current.filter(
                                      (item) => item !== subscriber._id
                                    )
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {[subscriber.firstName, subscriber.lastName]
                                .filter(Boolean)
                                .join(" ") || subscriber.phoneNumber}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {subscriber.phoneNumber}
                            </span>
                          </span>
                        </label>
                      ))
                    ) : (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No eligible subscribers found.
                      </div>
                    )}
                    <div ref={subscriberLoadMoreRef} className="h-px" />
                    {isFetchingMoreSubscribers && (
                      <div className="space-y-2 p-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <Skeleton key={index} className="h-12" />
                        ))}
                      </div>
                    )}
                    {!hasMoreSubscribers && subscribers.length > 0 && (
                      <p className="py-2 text-center text-xs text-muted-foreground">
                        All eligible subscribers are loaded.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-4">
                <div>
                  <Label htmlFor="broadcast-limit-retry">
                    Retry after a Meta messaging-limit pause
                  </Label>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    If Meta pauses this campaign because the business messaging
                    limit was reached, automatically grant consent to retry the
                    unfinished recipients after the backend recovery period.
                    This does not retry recipients that failed for other
                    reasons.
                  </p>
                </div>
                <Switch
                  id="broadcast-limit-retry"
                  checked={retryOnMessagingLimit}
                  onCheckedChange={setRetryOnMessagingLimit}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t pt-4">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedBroadcast?.name || "Broadcast"}</DialogTitle>
          </DialogHeader>

          {selectedBroadcast ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Status", selectedBroadcast.status],
                  ["Template", selectedBroadcast.template?.name],
                  ["Created", formatDate(selectedBroadcast.createdAt)],
                  ["Started", formatDate(selectedBroadcast.startedAt)],
                  ["Completed", formatDate(selectedBroadcast.completedAt)],
                  ["Scheduled", formatDate(selectedBroadcast.scheduledAt)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-sm bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 truncate font-medium capitalize">
                      {value || "-"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Total", selectedBroadcast.stats.totalRecipients],
                  ["Queued", selectedBroadcast.stats.queuedRecipients],
                  ["Sent", selectedBroadcast.stats.sentRecipients],
                  ["Delivered", selectedBroadcast.stats.deliveredRecipients],
                  ["Read", selectedBroadcast.stats.readRecipients],
                  ["Failed", selectedBroadcast.stats.failedRecipients],
                  ["Skipped", selectedBroadcast.stats.skippedRecipients],
                  ["Canceled", selectedBroadcast.stats.canceledRecipients]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-sm border bg-white p-3 shadow-xs"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {selectedBroadcast.lastError && (
                <div className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
                  {selectedBroadcast.lastError}
                </div>
              )}

              {canStart && (
                <div className="rounded-lg border bg-gradient-to-br from-primary/5 via-white to-emerald-50/60 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Send timing</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Start immediately or pick a local schedule in
                        Asia/Kolkata.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setScheduleDate(undefined)}
                      >
                        <Clock className="size-4" />
                        Clear schedule
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px]">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex min-h-20 items-center gap-3 rounded-lg border bg-white px-4 text-left shadow-xs transition hover:border-primary/40",
                            scheduleDate && "border-primary/40 bg-primary/5"
                          )}
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <CalendarIcon className="size-5" />
                          </span>
                          <span>
                            <span className="block text-xs text-muted-foreground">
                              Schedule date
                            </span>
                            <span className="mt-1 block font-medium">
                              {formatCalendarDate(scheduleDate)}
                            </span>
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleDate}
                          onSelect={setScheduleDate}
                          disabled={{ before: new Date() }}
                        />
                      </PopoverContent>
                    </Popover>

                    <div className="rounded-lg border bg-white p-3 shadow-xs">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-4" />
                        Local time
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <Select
                          value={scheduleHour || "09"}
                          onValueChange={(hour) =>
                            setScheduleTime(`${hour}:${scheduleMinute || "00"}`)
                          }
                        >
                          <SelectTrigger className="h-11 w-full border-primary/20 bg-primary/5 font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hourOptions.map((hour) => (
                              <SelectItem key={hour} value={hour}>
                                {hour}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-lg font-semibold text-muted-foreground">
                          :
                        </span>
                        <Select
                          value={scheduleMinute || "00"}
                          onValueChange={(minute) =>
                            setScheduleTime(`${scheduleHour || "09"}:${minute}`)
                          }
                        >
                          <SelectTrigger className="h-11 w-full border-primary/20 bg-primary/5 font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {minuteOptions.map((minute) => (
                              <SelectItem key={minute} value={minute}>
                                {minute}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {["09:00", "12:00", "15:00", "18:00"].map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setScheduleTime(time)}
                        className={cn(
                          "rounded-full border bg-white px-3 py-1.5 text-xs font-medium shadow-xs transition hover:border-primary/40",
                          scheduleTime === time &&
                            "border-primary/40 bg-primary/10 text-primary"
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      isLoading={isStarting}
                      onClick={handleStartNow}
                    >
                      <Send className="size-4" />
                      Start now
                    </Button>
                    <Button
                      type="button"
                      isLoading={isStarting}
                      onClick={handleScheduleBroadcast}
                    >
                      <CalendarClock className="size-4" />
                      Schedule
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-sm border">
                <div className="flex items-center justify-between gap-3 border-b p-3">
                  <p className="font-medium">Recipients</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedBroadcastData?.data.recipientsPagination?.total ??
                      selectedBroadcastData?.data.recipients?.length ??
                      0}{" "}
                    total
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {(selectedBroadcastData?.data.recipients || []).length ? (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white text-left text-primary">
                        <tr>
                          <th className="p-3">Recipient</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Sent</th>
                          <th className="p-3">Delivered</th>
                          <th className="p-3">Read</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBroadcastData?.data.recipients || []).map(
                          (recipient) => (
                            <tr key={recipient._id} className="border-t">
                              <td className="p-3">
                                <p className="font-medium">
                                  {[
                                    recipient.subscriberId?.firstName,
                                    recipient.subscriberId?.lastName
                                  ]
                                    .filter(Boolean)
                                    .join(" ") || recipient.phoneNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {recipient.phoneNumber}
                                </p>
                              </td>
                              <td className="p-3 capitalize">
                                {recipient.status}
                              </td>
                              <td className="p-3">
                                {formatDate(
                                  recipient.sentAt ||
                                    recipient.messageId?.sentAt
                                )}
                              </td>
                              <td className="p-3">
                                {formatDate(
                                  recipient.deliveredAt ||
                                    recipient.messageId?.deliveredAt
                                )}
                              </td>
                              <td className="p-3">
                                {formatDate(
                                  recipient.readAt ||
                                    recipient.messageId?.readAt
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No recipients returned for this broadcast.
                    </div>
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
