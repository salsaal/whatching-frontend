"use client";

import {
  Check,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Instagram,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import {
  connectInstagramLogin,
  createInstagramCommentRule,
  deleteInstagramCommentRule,
  disableInstagramCommentRule,
  enableInstagramCommentRule,
  getInstagramCanvases,
  getInstagramCommentRules,
  getInstagramFlows,
  getInstagramMedia,
  disconnectInstagram,
  getInstagramStatus,
  syncInstagramMedia,
  syncInstagramStatus,
  updateInstagramCommentRule
} from "@/client-api/functions/instagram";
import {
  ConnectInstagramLoginPayload,
  InstagramCommentRule,
  InstagramCommentRulePayload,
  InstagramFlow,
  InstagramLoginAccount,
  InstagramMedia,
  InstagramStatusResponse
} from "@/client-api/types/instagram.type";
import { InstagramFlowsList } from "@/components/instagram/InstagramFlowsList";
import { InstagramSettingsTab } from "@/components/instagram/InstagramSettingsTab";
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
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardGridLoadingSkeleton } from "@/components/ui/loading-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";
import { PermissionGate } from "@/components/common/NoAccess";

type PageTab = "profile" | "settings" | "canvas" | "rules" | "media" | "setup";
// Tabs that can be linked to with ?tab= (setup is an internal-only view).
const URL_TABS = ["profile", "settings", "canvas", "rules", "media"] as const;

const INSTAGRAM_LOGIN_STATE_KEY = "whatching_instagram_login_state";
const INSTAGRAM_LOGIN_REDIRECT_KEY = "whatching_instagram_login_redirect_uri";
const instagramLoginScopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish"
];

const getInstagramRedirectUri = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}/instagram`;

const createInstagramLoginState = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

const getInstagramLoginUrl = (redirectUri: string, state: string) => {
  const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
  if (!appId) return "";
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: instagramLoginScopes.join(","),
    enable_fb_login: "false",
    force_reauth: "true",
    state
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
};

const formatDate = (date?: string | null) => {
  if (!date) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
};

const getErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  const axiosError = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  return (
    axiosError.response?.data?.message ||
    axiosError.response?.data?.error ||
    axiosError.message ||
    fallback
  );
};

const emptyRule: InstagramCommentRulePayload = {
  name: "",
  status: "enabled",
  scope: "all_media",
  keywordMode: "any",
  keywords: [],
  publicReplyText: "",
  privateReplyText: "",
  sendPublicReply: true,
  sendPrivateReply: true,
  cooldownSeconds: 0,
  mediaIds: []
};

const flowStartLabels: Partial<Record<InstagramFlow["triggerType"], string>> = {
  first_dm: "Welcome message",
  keyword: "Keyword",
  story_reply: "Story reply",
  comment_private_reply_opened: "Comment reply",
  manual_start: "Started by another block"
};

const flowStatusLabels: Record<InstagramFlow["status"], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived"
};

const INSTAGRAM_FLOWS_PAGE_SIZE = 12;
const INSTAGRAM_MEDIA_PAGE_SIZE = 36;
const INSTAGRAM_RULES_PAGE_SIZE = 30;

export function InstagramPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const flowsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const mediaLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const rulesLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const ruleMediaLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const activeOrgId = activeOrganization?._id;
  // The tab lives in the URL (?tab=settings) so refresh and back keep it.
  const [urlTab, setUrlTab] = useQueryState(
    "tab",
    parseAsStringLiteral(URL_TABS).withDefault("profile")
  );
  const [internalTab, setInternalTab] = useState<PageTab | null>(null);
  const activeTab: PageTab = internalTab || urlTab;
  const setActiveTab = useCallback(
    (tab: PageTab) => {
      if (tab === "setup") {
        setInternalTab(tab);
        return;
      }
      setInternalTab(null);
      void setUrlTab(tab);
    },
    [setUrlTab]
  );
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [ruleDraft, setRuleDraft] =
    useState<InstagramCommentRulePayload>(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [isRuleMediaPickerOpen, setIsRuleMediaPickerOpen] = useState(false);
  const [ruleToArchive, setRuleToArchive] =
    useState<InstagramCommentRule | null>(null);
  const [pendingRuleMediaIds, setPendingRuleMediaIds] = useState<string[]>([]);
  const [loginSelection, setLoginSelection] = useState<{
    code: string;
    redirectUri: string;
    accounts: InstagramLoginAccount[];
  } | null>(null);
  const [selectedLoginAccount, setSelectedLoginAccount] = useState("");
  const handledLoginCodeRef = useRef("");
  const pendingLoginRef = useRef<ConnectInstagramLoginPayload | null>(null);

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ["instagram-status", activeOrgId],
    queryFn: getInstagramStatus,
    enabled: Boolean(activeOrgId)
  });
  const instagram = statusData?.data.instagram;
  const isReady = instagram?.status === "ready";
  const enabledForPlan = statusData?.data.enabledForPlan !== false;
  // The Settings tab checks whether a flow is switched on.
  const { data: canvasesData } = useQuery({
    queryKey: ["instagram-canvases", activeOrgId],
    queryFn: getInstagramCanvases,
    enabled: Boolean(activeOrgId && isReady)
  });
  const canvases = useMemo(
    () => canvasesData?.data.canvases || [],
    [canvasesData?.data.canvases]
  );
  const {
    data: flowsData,
    isFetchingNextPage: isFetchingMoreFlows,
    hasNextPage: hasMoreFlows,
    fetchNextPage: fetchMoreFlows
  } = useInfiniteQuery({
    queryKey: ["instagram-flows", activeOrgId],
    queryFn: ({ pageParam }) =>
      getInstagramFlows({
        page: pageParam,
        limit: INSTAGRAM_FLOWS_PAGE_SIZE
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.pagination;
      return pagination.page < pagination.pages
        ? pagination.page + 1
        : undefined;
    },
    enabled: Boolean(activeOrgId && isReady)
  });
  const {
    data: mediaData,
    isLoading: isMediaLoading,
    isFetchingNextPage: isFetchingMoreMedia,
    hasNextPage: hasMoreMedia,
    fetchNextPage: fetchMoreMedia
  } = useInfiniteQuery({
    queryKey: ["instagram-media", activeOrgId, mediaSearch, mediaTypeFilter],
    queryFn: ({ pageParam }) =>
      getInstagramMedia({
        page: pageParam,
        limit: INSTAGRAM_MEDIA_PAGE_SIZE,
        search: mediaSearch,
        mediaType: mediaTypeFilter
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.pagination;
      return pagination.page < pagination.pages
        ? pagination.page + 1
        : undefined;
    },
    enabled: Boolean(activeOrgId && isReady)
  });
  const {
    data: rulesData,
    isLoading: isRulesLoading,
    isFetchingNextPage: isFetchingMoreRules,
    hasNextPage: hasMoreRules,
    fetchNextPage: fetchMoreRules
  } = useInfiniteQuery({
    queryKey: ["instagram-comment-rules", activeOrgId],
    queryFn: ({ pageParam }) =>
      getInstagramCommentRules({
        page: pageParam,
        limit: INSTAGRAM_RULES_PAGE_SIZE
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.pagination;
      return pagination.page < pagination.pages
        ? pagination.page + 1
        : undefined;
    },
    enabled: Boolean(activeOrgId && isReady)
  });

  const rules = useMemo(() => {
    const uniqueRules = new Map<string, InstagramCommentRule>();
    rulesData?.pages
      .flatMap((page) => page.data.rules || [])
      .forEach((rule) => uniqueRules.set(rule._id, rule));
    return Array.from(uniqueRules.values());
  }, [rulesData?.pages]);
  const media = useMemo(() => {
    const uniqueMedia = new Map<string, InstagramMedia>();
    mediaData?.pages
      .flatMap((page) => page.data.media || [])
      .forEach((item) => uniqueMedia.set(item._id, item));
    return Array.from(uniqueMedia.values());
  }, [mediaData?.pages]);
  const flows = useMemo(() => {
    const uniqueFlows = new Map<string, InstagramFlow>();
    flowsData?.pages
      .flatMap((page) => page.data.flows || [])
      .forEach((flow) => uniqueFlows.set(flow._id, flow));
    return Array.from(uniqueFlows.values());
  }, [flowsData?.pages]);
  useEffect(() => {
    const sentinel = rulesLoadMoreRef.current;
    if (!sentinel || !hasMoreRules || activeTab !== "rules") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingMoreRules) {
          fetchMoreRules();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, fetchMoreRules, hasMoreRules, isFetchingMoreRules]);

  useEffect(() => {
    const sentinel =
      activeTab === "media"
        ? mediaLoadMoreRef.current
        : isRuleMediaPickerOpen
          ? ruleMediaLoadMoreRef.current
          : null;
    if (!sentinel || !hasMoreMedia) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingMoreMedia) {
          fetchMoreMedia();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    activeTab,
    fetchMoreMedia,
    hasMoreMedia,
    isFetchingMoreMedia,
    isRuleMediaPickerOpen
  ]);

  useEffect(() => {
    const sentinel = flowsLoadMoreRef.current;
    if (!sentinel || !hasMoreFlows || activeTab !== "setup") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingMoreFlows) {
          fetchMoreFlows();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, fetchMoreFlows, hasMoreFlows, isFetchingMoreFlows]);

  // Wait for the status before bouncing, or a refresh on ?tab=settings
  // would always land on Profile.
  useEffect(() => {
    if (!isStatusLoading && !isReady && activeTab !== "profile") {
      setActiveTab("profile");
    }
  }, [activeTab, isReady, isStatusLoading, setActiveTab]);

  useEffect(() => {
    if (!isReady) return;
    setIsConnectOpen(false);
    setLoginSelection(null);
    setSelectedLoginAccount("");
    pendingLoginRef.current = null;
    sessionStorage.removeItem(INSTAGRAM_LOGIN_STATE_KEY);
    sessionStorage.removeItem(INSTAGRAM_LOGIN_REDIRECT_KEY);
  }, [isReady]);

  const connectMutation = useMutation({
    mutationFn: connectInstagramLogin,
    // Every mutation in this file already shows its own specific
    // success/error toast -- suppress the global MutationCache's generic
    // duplicate (pages/_app.tsx).
    meta: { showToast: false },
    onSuccess: (response) => {
      toast.success("Instagram connected");
      setIsConnectOpen(false);
      setLoginSelection(null);
      setSelectedLoginAccount("");
      pendingLoginRef.current = null;
      sessionStorage.removeItem(INSTAGRAM_LOGIN_STATE_KEY);
      sessionStorage.removeItem(INSTAGRAM_LOGIN_REDIRECT_KEY);
      response.data.warnings?.forEach((warning) =>
        toast.warning(warning.message)
      );
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    },
    onError: (error) => {
      const axiosError = error as AxiosError<{
        message?: string;
        data?: {
          requiresSelection?: boolean;
          accounts?: InstagramLoginAccount[];
        };
      }>;
      const selection = axiosError.response?.data?.data;
      if (axiosError.response?.status === 409 && selection?.requiresSelection) {
        setLoginSelection((current) => ({
          code: current?.code || pendingLoginRef.current?.code || "",
          redirectUri:
            current?.redirectUri ||
            pendingLoginRef.current?.redirectUri ||
            getInstagramRedirectUri(),
          accounts: selection.accounts || []
        }));
        setSelectedLoginAccount(
          selection.accounts?.[0]?.igBusinessAccountId || ""
        );
        setIsConnectOpen(true);
        toast.error("Select the Instagram account to connect.");
        return;
      }
      toast.error(getErrorMessage(error));
    }
  });

  const startInstagramLogin = () => {
    const redirectUri = getInstagramRedirectUri();
    const state = createInstagramLoginState();
    const loginUrl = getInstagramLoginUrl(redirectUri, state);

    if (!loginUrl) {
      toast.error(
        "Add NEXT_PUBLIC_INSTAGRAM_APP_ID to enable Instagram login."
      );
      return;
    }

    sessionStorage.setItem(INSTAGRAM_LOGIN_STATE_KEY, state);
    sessionStorage.setItem(INSTAGRAM_LOGIN_REDIRECT_KEY, redirectUri);
    window.location.assign(loginUrl);
  };

  const connectSelectedLoginAccount = () => {
    if (!loginSelection || !selectedLoginAccount) {
      toast.error("Select an Instagram account first.");
      return;
    }
    const account = loginSelection.accounts.find(
      (item) => item.igBusinessAccountId === selectedLoginAccount
    );
    if (!account) {
      toast.error("Selected Instagram account was not found.");
      return;
    }
    const payload = {
      code: loginSelection.code,
      redirectUri: loginSelection.redirectUri,
      pageId: account.pageId,
      igBusinessAccountId: account.igBusinessAccountId
    };
    pendingLoginRef.current = payload;
    connectMutation.mutate(payload);
  };

  useEffect(() => {
    if (!router.isReady || !activeOrgId) return;
    const code = typeof router.query.code === "string" ? router.query.code : "";
    const state =
      typeof router.query.state === "string" ? router.query.state : "";
    const error =
      typeof router.query.error === "string" ? router.query.error : "";

    if (error) {
      toast.error(
        typeof router.query.error_description === "string"
          ? router.query.error_description.replaceAll("+", " ")
          : "Instagram login was cancelled."
      );
      router.replace("/instagram", undefined, { shallow: true });
      return;
    }

    if (!code || handledLoginCodeRef.current === code) return;
    const expectedState =
      sessionStorage.getItem(INSTAGRAM_LOGIN_STATE_KEY) || "";
    const redirectUri =
      sessionStorage.getItem(INSTAGRAM_LOGIN_REDIRECT_KEY) ||
      getInstagramRedirectUri();

    if (expectedState && state && expectedState !== state) {
      toast.error("Instagram login state did not match. Please try again.");
      router.replace("/instagram", undefined, { shallow: true });
      return;
    }

    handledLoginCodeRef.current = code;
    const payload = { code, redirectUri };
    pendingLoginRef.current = payload;
    setLoginSelection({ ...payload, accounts: [] });
    connectMutation.mutate(payload);
    router.replace("/instagram", undefined, { shallow: true });
  }, [activeOrgId, connectMutation, router]);

  const syncStatusMutation = useMutation({
    mutationFn: syncInstagramStatus,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Instagram status refreshed");
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectInstagram,
    meta: { showToast: false },
    onSuccess: (response) => {
      // Write the now-disconnected config straight into the status cache so
      // the Profile tab drops to the Connect flow at once instead of showing
      // the old profile card until the refetch lands.
      queryClient.setQueryData<InstagramStatusResponse>(
        ["instagram-status", activeOrgId],
        (current) =>
          current
            ? {
                ...current,
                data: { ...current.data, instagram: response.data.instagram }
              }
            : current
      );
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
      setIsDisconnectOpen(false);
      setActiveTab("profile");
      toast.success("Instagram disconnected.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Couldn't disconnect Instagram."))
  });

  const syncMediaMutation = useMutation({
    mutationFn: () => syncInstagramMedia({ limit: 50 }),
    meta: { showToast: false },
    onSuccess: (data) => {
      toast.success(`Synced ${data.data.synced} Instagram media item(s)`);
      queryClient.invalidateQueries({ queryKey: ["instagram-media"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const saveRuleMutation = useMutation({
    mutationFn: () =>
      editingRuleId
        ? updateInstagramCommentRule({
            ruleId: editingRuleId,
            payload: ruleDraft
          })
        : createInstagramCommentRule(ruleDraft),
    meta: { showToast: false },
    onSuccess: () => {
      toast.success(
        editingRuleId
          ? "Comment automation updated"
          : "Comment automation created"
      );
      setRuleDraft(emptyRule);
      setEditingRuleId(null);
      setKeywordInput("");
      setIsRuleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["instagram-comment-rules"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const ruleStatusMutation = useMutation({
    mutationFn: ({
      ruleId,
      action
    }: {
      ruleId: string;
      action: "enable" | "disable" | "delete";
    }) => {
      if (action === "enable") return enableInstagramCommentRule(ruleId);
      if (action === "disable") return disableInstagramCommentRule(ruleId);
      return deleteInstagramCommentRule(ruleId);
    },
    meta: { showToast: false },
    onSuccess: (_response, variables) => {
      if (variables.action === "delete") {
        setRuleToArchive(null);
        toast.success("Comment automation archived");
      }
      queryClient.invalidateQueries({ queryKey: ["instagram-comment-rules"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const editRule = (rule: InstagramCommentRule) => {
    setEditingRuleId(rule._id);
    setRuleDraft({
      name: rule.name,
      status: rule.status,
      scope: rule.scope,
      mediaIds: rule.mediaIds,
      keywordMode: rule.keywordMode,
      keywords: rule.keywords,
      publicReplyText: rule.publicReplyText || "",
      privateReplyText: rule.privateReplyText || "",
      sendPublicReply: rule.sendPublicReply,
      sendPrivateReply: rule.sendPrivateReply,
      cooldownSeconds: rule.cooldownSeconds
    });
    setKeywordInput("");
    setIsRuleDialogOpen(true);
  };

  const openNewRule = () => {
    setEditingRuleId(null);
    setRuleDraft({ ...emptyRule, mediaIds: [], keywords: [] });
    setKeywordInput("");
    setIsRuleDialogOpen(true);
  };

  const closeRuleDialog = () => {
    setIsRuleDialogOpen(false);
    setIsRuleMediaPickerOpen(false);
    setEditingRuleId(null);
    setRuleDraft({ ...emptyRule, mediaIds: [], keywords: [] });
    setKeywordInput("");
  };

  const addKeyword = () => {
    const keyword = keywordInput.trim();
    if (!keyword) return;
    const exists = (ruleDraft.keywords || []).some(
      (item) => item.toLowerCase() === keyword.toLowerCase()
    );
    if (exists) {
      toast.error("That keyword is already added.");
      return;
    }
    setRuleDraft((draft) => ({
      ...draft,
      keywords: [...(draft.keywords || []), keyword]
    }));
    setKeywordInput("");
  };

  const openRuleMediaPicker = () => {
    setPendingRuleMediaIds([...(ruleDraft.mediaIds || [])]);
    setIsRuleMediaPickerOpen(true);
  };

  const confirmRuleMediaSelection = () => {
    setRuleDraft((draft) => ({
      ...draft,
      mediaIds: pendingRuleMediaIds
    }));
    setIsRuleMediaPickerOpen(false);
  };

  const validateRuleDraft = () => {
    if (!ruleDraft.name.trim()) return "Automation name is required";
    if (!ruleDraft.sendPublicReply && !ruleDraft.sendPrivateReply) {
      return "Turn on at least one reply action";
    }
    if (ruleDraft.scope === "specific_media" && !ruleDraft.mediaIds?.length) {
      return "Select at least one Instagram media item";
    }
    return "";
  };

  const submitRule = () => {
    const error = validateRuleDraft();
    if (error) {
      toast.error(error);
      return;
    }
    saveRuleMutation.mutate();
  };

  const renderProfile = () => (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        {!isReady ? (
          <section className="rounded-xl border border-pink-100 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                  <Instagram className="size-7" />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-semibold">
                    Connect Instagram first
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Connect an Instagram professional account before using
                    message flows, comment automation, media sync, and
                    automations. You&apos;ll sign in with Instagram, and we
                    never see your password.
                  </p>
                </div>
              </div>
              <Button
                className="cursor-pointer bg-pink-600 hover:bg-pink-700"
                onClick={() => setIsConnectOpen(true)}
              >
                <Instagram className="mr-2 size-4" />
                Connect Instagram
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-xl bg-white shadow-xs">
              <div className="h-28 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400" />
              <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="-mt-10 flex items-end gap-4">
                  <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-pink-50 text-pink-600 shadow-sm">
                    {instagram?.profilePictureUrl ? (
                      <img
                        src={instagram.profilePictureUrl}
                        alt={instagram.username || "Instagram profile"}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Instagram className="size-10" />
                    )}
                  </div>
                  <div className="pb-1">
                    <h2 className="font-heading text-2xl font-semibold">
                      {instagram?.name ||
                        instagram?.username ||
                        "Instagram profile"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      @{instagram?.username || "not_connected"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isReady ? "default" : "outline"}
                  className={cn(isReady && "bg-emerald-600")}
                >
                  {isReady ? "Ready" : "Not connected"}
                </Badge>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {[
                ["Followers", instagram?.followersCount ?? 0],
                ["Following", instagram?.followsCount ?? 0],
                ["Media", instagram?.mediaCount ?? 0]
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg bg-white p-4 shadow-xs"
                >
                  <p className="text-sm text-muted-foreground">
                    {String(label)}
                  </p>
                  <p className="mt-2 font-heading text-3xl font-semibold">
                    {String(value)}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg bg-white p-5 shadow-xs">
                <h3 className="font-semibold">Profile details</h3>
                <div className="mt-4 space-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Bio
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {instagram?.biography || "No biography synced yet."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Website
                    </p>
                    {instagram?.website ? (
                      <a
                        href={instagram.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-pink-600"
                      >
                        {instagram.website}
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        Not available
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-white p-5 shadow-xs">
                <h3 className="font-semibold">Connection</h3>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    // "me" marks an Instagram Login account, not a real page.
                    ...(instagram?.pageId && instagram.pageId !== "me"
                      ? [["Page ID", instagram.pageId]]
                      : []),
                    ["IG business account", instagram?.igBusinessAccountId],
                    ["Connected", formatDate(instagram?.connectedAt)],
                    ["Profile sync", formatDate(instagram?.lastProfileSyncAt)],
                    ["Health check", formatDate(instagram?.lastHealthCheckAt)]
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="flex justify-between gap-4"
                    >
                      <span className="text-muted-foreground">
                        {String(label)}
                      </span>
                      <span className="max-w-[55%] truncate text-right font-medium">
                        {String(value || "-")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout hideHeader fullBleed>
      <div className="relative flex h-[calc(100vh-1px)] min-h-0 flex-col overflow-hidden bg-slate-50">
        <div className="flex shrink-0 items-center justify-between border-b bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white">
              <Instagram className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Instagram Automation</h1>
              <p className="text-xs text-muted-foreground">
                Message flows, media and comment automations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isReady ? "default" : "outline"}
              className={cn(isReady && "bg-emerald-600")}
            >
              {isStatusLoading
                ? "Checking"
                : isReady
                  ? "Ready"
                  : "Not connected"}
            </Badge>
            {!isReady && (
              <Button
                variant="outline"
                onClick={() => setIsConnectOpen(true)}
                tooltip="Connect or reconnect an Instagram professional account"
              >
                <Settings2 className="mr-2 size-4" />
                Connect
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => syncStatusMutation.mutate()}
              disabled={!isReady || syncStatusMutation.isPending}
              tooltip="Refresh the connected Instagram account status"
            >
              {syncStatusMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Refresh profile
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-b bg-white px-5 py-2">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (value !== "profile" && !isReady) {
                setActiveTab("profile");
                toast.error("Connect Instagram first.");
                return;
              }
              setActiveTab(value as PageTab);
            }}
          >
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="settings" disabled={!isReady}>
                Settings
              </TabsTrigger>
              <TabsTrigger value="canvas" disabled={!isReady}>
                Flows
              </TabsTrigger>
              <TabsTrigger value="rules" disabled={!isReady}>
                Comment Automation
              </TabsTrigger>
              <TabsTrigger value="media" disabled={!isReady}>
                Media
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="text-xs text-muted-foreground">
            Last sync: {formatDate(instagram?.lastHealthCheckAt)}
          </div>
        </div>

        {(activeTab === "canvas" || activeTab === "rules") &&
          isReady &&
          !enabledForPlan && (
            <div className="border-b bg-amber-50 px-5 py-2 text-xs text-amber-800">
              Your current plan doesn&apos;t include Instagram automation. You
              can keep building flows, but saving and applying changes will be
              blocked until you upgrade.
            </div>
          )}

        {activeTab === "profile" && renderProfile()}

        {activeTab === "canvas" && isReady && (
          <InstagramFlowsList username={instagram?.username} />
        )}

        {activeTab === "settings" && isReady && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-7xl">
              <InstagramSettingsTab
                canvases={canvases}
                onOpenMessageFlow={() => setActiveTab("canvas")}
                onDisconnect={() => setIsDisconnectOpen(true)}
              />
            </div>
          </div>
        )}

        {activeTab === "rules" && isReady && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-7xl space-y-5">
              <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-pink-600">
                    Instagram engagement
                  </p>
                  <h2 className="font-heading text-2xl font-semibold">
                    Comment automations
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Trigger public replies and private DMs from matching
                    Instagram comments.
                  </p>
                </div>
                <Button
                  className="bg-pink-600 hover:bg-pink-700"
                  onClick={openNewRule}
                  title="Create a new Instagram comment automation"
                >
                  <Plus className="size-4" />
                  Add comment automation
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {isRulesLoading ? (
                  <div className="lg:col-span-2 xl:col-span-3">
                    <CardGridLoadingSkeleton
                      count={6}
                      className="lg:grid-cols-2 xl:grid-cols-3"
                    />
                  </div>
                ) : rules.length ? (
                  rules.map((rule) => (
                    <div
                      key={rule._id}
                      className="group flex min-h-72 flex-col rounded-xl border bg-white p-5 shadow-xs transition hover:border-pink-200 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
                            <MessageCircle className="size-5" />
                          </div>
                          <h3 className="truncate font-heading text-lg font-semibold">
                            {rule.name}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {rule.scope === "all_media"
                              ? "Runs on all eligible Instagram posts"
                              : `${rule.mediaIds.length} selected post${rule.mediaIds.length === 1 ? "" : "s"}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Switch
                            checked={rule.status === "enabled"}
                            disabled={ruleStatusMutation.isPending}
                            onCheckedChange={(checked) =>
                              ruleStatusMutation.mutate({
                                ruleId: rule._id,
                                action: checked ? "enable" : "disable"
                              })
                            }
                            aria-label={`${rule.status === "enabled" ? "Pause" : "Activate"} ${rule.name}`}
                            title={`${rule.status === "enabled" ? "Pause" : "Activate"} this comment automation`}
                          />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {rule.status === "enabled" ? "Active" : "Paused"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-5 flex min-h-7 flex-wrap gap-1.5">
                        {(rule.keywords || []).map((keyword) => (
                          <Badge
                            key={keyword}
                            variant="secondary"
                            className="bg-pink-50 text-pink-700"
                          >
                            {keyword}
                          </Badge>
                        ))}
                        {!(rule.keywords || []).length && (
                          <span className="text-xs text-muted-foreground">
                            No keywords configured
                          </span>
                        )}
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-muted-foreground">Match</p>
                          <p className="mt-0.5 font-medium capitalize">
                            {rule.keywordMode} keyword
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-muted-foreground">Replies</p>
                          <p className="mt-0.5 font-medium">
                            {rule.sendPublicReply && rule.sendPrivateReply
                              ? "Public + DM"
                              : rule.sendPublicReply
                                ? "Public"
                                : "Private DM"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editRule(rule)}
                          title="Edit this comment automation"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setRuleToArchive(rule)}
                          title="Archive this comment automation"
                        >
                          Archive
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed bg-white p-12 text-center lg:col-span-2 xl:col-span-3">
                    <MessageCircle className="mx-auto size-9 text-pink-500" />
                    <p className="mt-3 font-medium">
                      No comment automations yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create one to automatically respond to matching comments.
                    </p>
                    <Button
                      className="mt-4 bg-pink-600 hover:bg-pink-700"
                      onClick={openNewRule}
                    >
                      <Plus className="size-4" />
                      Add comment automation
                    </Button>
                  </div>
                )}
              </div>
              <div ref={rulesLoadMoreRef} className="h-px" />
              {isFetchingMoreRules && (
                <CardGridLoadingSkeleton
                  count={3}
                  className="lg:grid-cols-2 xl:grid-cols-3"
                />
              )}
              {!hasMoreRules && rules.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  All comment automations are loaded.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "media" && isReady && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Instagram media</h2>
                <p className="text-sm text-muted-foreground">
                  Synced posts and reels available for comment automation.
                </p>
              </div>
              <Button
                className="bg-pink-600 hover:bg-pink-700"
                onClick={() => syncMediaMutation.mutate()}
                disabled={syncMediaMutation.isPending}
                tooltip="Sync the latest posts and reels from Instagram"
              >
                {syncMediaMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 size-4" />
                )}
                Sync media
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={mediaSearch}
                  onChange={(event) => setMediaSearch(event.target.value)}
                  placeholder="Search captions"
                />
              </div>
              <Select
                value={mediaTypeFilter}
                onValueChange={setMediaTypeFilter}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="IMAGE">Images</SelectItem>
                  <SelectItem value="VIDEO">Videos</SelectItem>
                  <SelectItem value="CAROUSEL_ALBUM">Carousels</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isMediaLoading ? (
              <CardGridLoadingSkeleton
                count={8}
                className="lg:grid-cols-3 xl:grid-cols-4"
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {media.map((item) => (
                    <InstagramMediaCard key={item.mediaId} item={item} />
                  ))}
                </div>
                <div ref={mediaLoadMoreRef} className="h-px" />
                {isFetchingMoreMedia && (
                  <CardGridLoadingSkeleton
                    count={4}
                    className="lg:grid-cols-3 xl:grid-cols-4"
                  />
                )}
                {!hasMoreMedia && media.length > 0 && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    All Instagram media is loaded.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "setup" && isReady && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-white p-5 lg:col-span-3">
                <h2 className="text-base font-semibold">
                  What you can do here
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    "Connect your Instagram professional account",
                    "Bring in and search your Instagram posts",
                    "Build message flows, save drafts and publish",
                    "Send text, images, videos and quick replies",
                    "Send buttons and swipeable cards",
                    "Tag people, hand chats to your team, pause or end a flow",
                    "Keep several named flows",
                    "Reply to comments automatically"
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-white p-5 lg:col-span-3">
                <h2 className="text-base font-semibold">
                  Current message flows
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {flows.map((flow) => (
                    <div key={flow._id} className="rounded-lg border p-3">
                      <p className="truncate text-sm font-semibold">
                        {flow.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {flowStartLabels[flow.triggerType] ||
                          "Started by another block"}
                      </p>
                      <Badge variant="outline" className="mt-3">
                        Version {flow.version} · {flowStatusLabels[flow.status]}
                      </Badge>
                    </div>
                  ))}
                  {!flows.length && (
                    <p className="text-sm text-muted-foreground">
                      No separate named Instagram flows have been created.
                    </p>
                  )}
                </div>
                <div ref={flowsLoadMoreRef} className="h-px" />
                {isFetchingMoreFlows && (
                  <CardGridLoadingSkeleton
                    count={4}
                    className="mt-3 md:grid-cols-2 xl:grid-cols-4"
                  />
                )}
                {!hasMoreFlows && flows.length > 0 && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    All Instagram flows are loaded.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(ruleToArchive)}
        onOpenChange={(open) => {
          if (!open && !ruleStatusMutation.isPending) setRuleToArchive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive comment automation?</AlertDialogTitle>
            <AlertDialogDescription>
              {ruleToArchive ? `“${ruleToArchive.name}”` : "This automation"}{" "}
              will stop responding to Instagram comments and will be removed
              from the active automation list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ruleStatusMutation.isPending}>
              Keep automation
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={ruleStatusMutation.isPending || !ruleToArchive}
              onClick={(event) => {
                event.preventDefault();
                if (!ruleToArchive) return;
                ruleStatusMutation.mutate({
                  ruleId: ruleToArchive._id,
                  action: "delete"
                });
              }}
            >
              {ruleStatusMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Archive automation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDisconnectOpen}
        onOpenChange={(open) => {
          if (!open && !disconnectMutation.isPending)
            setIsDisconnectOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect @{instagram?.username || "this account"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Automations, comment rules and the message flow stop replying
              until you reconnect. Your conversations and contacts are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={disconnectMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                disconnectMutation.mutate();
              }}
            >
              {disconnectMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isRuleDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeRuleDialog();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingRuleId
                ? "Edit comment automation"
                : "Add comment automation"}
            </DialogTitle>
            <DialogDescription>
              Choose where comments are matched and what Instagram should send
              when a keyword is found.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <Label>Automation name</Label>
              <Input
                value={ruleDraft.name}
                placeholder="Auto-reply to pricing comments"
                onChange={(event) =>
                  setRuleDraft((draft) => ({
                    ...draft,
                    name: event.target.value
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select
                  value={ruleDraft.scope}
                  onValueChange={(value) =>
                    setRuleDraft((draft) => ({
                      ...draft,
                      scope: value as InstagramCommentRulePayload["scope"]
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_media">All media</SelectItem>
                    <SelectItem value="specific_media">
                      Specific media
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Keyword match</Label>
                <Select
                  value={ruleDraft.keywordMode}
                  onValueChange={(value) =>
                    setRuleDraft((draft) => ({
                      ...draft,
                      keywordMode:
                        value as InstagramCommentRulePayload["keywordMode"]
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any keyword</SelectItem>
                    <SelectItem value="all">All keywords</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {ruleDraft.scope === "specific_media" && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Instagram posts</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(ruleDraft.mediaIds || []).length
                        ? `${ruleDraft.mediaIds?.length} post${ruleDraft.mediaIds?.length === 1 ? "" : "s"} selected`
                        : "Choose the posts this automation should watch."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openRuleMediaPicker}
                    title="Open the Instagram post selector"
                  >
                    <ImageIcon className="size-4" />
                    Choose posts
                  </Button>
                </div>
                {!!ruleDraft.mediaIds?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ruleDraft.mediaIds.map((mediaId) => {
                      const selectedMedia = media.find(
                        (item) => item.mediaId === mediaId
                      );
                      return (
                        <Badge
                          key={mediaId}
                          variant="secondary"
                          className="max-w-56 gap-1.5"
                        >
                          <span className="truncate">
                            {selectedMedia?.caption || mediaId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRuleDraft((draft) => ({
                                ...draft,
                                mediaIds: (draft.mediaIds || []).filter(
                                  (item) => item !== mediaId
                                )
                              }))
                            }
                            aria-label="Remove selected post"
                            title="Remove this post"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Keywords</Label>
              {!!ruleDraft.keywords?.length && (
                <div className="flex flex-wrap gap-2 rounded-xl border bg-pink-50/40 p-3">
                  {ruleDraft.keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      className="gap-1.5 bg-pink-600 text-white hover:bg-pink-600"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() =>
                          setRuleDraft((draft) => ({
                            ...draft,
                            keywords: (draft.keywords || []).filter(
                              (item) => item !== keyword
                            )
                          }))
                        }
                        aria-label={`Remove ${keyword}`}
                        title={`Remove ${keyword}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  placeholder="Write a keyword and press Enter"
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addKeyword}
                  disabled={!keywordInput.trim()}
                  title="Add this keyword"
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each keyword is matched on its own.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Public reply</p>
                    <p className="text-xs text-muted-foreground">
                      Reply below the matching comment.
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(ruleDraft.sendPublicReply)}
                    onCheckedChange={(checked) =>
                      setRuleDraft((draft) => ({
                        ...draft,
                        sendPublicReply: checked
                      }))
                    }
                    title="Toggle the public comment reply"
                  />
                </div>
                {ruleDraft.sendPublicReply && (
                  <Textarea
                    className="mt-3 max-h-[220px] overflow-y-auto"
                    value={ruleDraft.publicReplyText}
                    maxLength={2200}
                    placeholder="Check your messages!"
                    onChange={(event) =>
                      setRuleDraft((draft) => ({
                        ...draft,
                        publicReplyText: event.target.value
                      }))
                    }
                  />
                )}
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Private DM</p>
                    <p className="text-xs text-muted-foreground">
                      Send a private Instagram message.
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(ruleDraft.sendPrivateReply)}
                    onCheckedChange={(checked) =>
                      setRuleDraft((draft) => ({
                        ...draft,
                        sendPrivateReply: checked
                      }))
                    }
                    title="Toggle the private Instagram message"
                  />
                </div>
                {ruleDraft.sendPrivateReply && (
                  <Textarea
                    className="mt-3 max-h-[220px] overflow-y-auto"
                    value={ruleDraft.privateReplyText}
                    maxLength={1000}
                    placeholder="Here are the details you asked for..."
                    onChange={(event) =>
                      setRuleDraft((draft) => ({
                        ...draft,
                        privateReplyText: event.target.value
                      }))
                    }
                  />
                )}
              </div>
            </div>

            <div className="max-w-52 space-y-2">
              <Label>Cooldown seconds</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(ruleDraft.cooldownSeconds || 0)}
                onChange={(event) =>
                  setRuleDraft((draft) => ({
                    ...draft,
                    cooldownSeconds: Number(
                      event.target.value.replace(/\D/g, "")
                    )
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRuleDialog}>
              Cancel
            </Button>
            <Button
              className="bg-pink-600 hover:bg-pink-700"
              onClick={submitRule}
              disabled={saveRuleMutation.isPending}
            >
              {saveRuleMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {editingRuleId ? "Update automation" : "Create automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRuleMediaPickerOpen}
        onOpenChange={setIsRuleMediaPickerOpen}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Choose Instagram posts</DialogTitle>
            <DialogDescription>
              Select one or more posts, then proceed to attach them to this
              comment automation.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[62vh] overflow-y-auto pr-1">
            {isMediaLoading ? (
              <CardGridLoadingSkeleton
                count={8}
                className="md:grid-cols-3 lg:grid-cols-4"
              />
            ) : media.length ? (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {media.map((item) => {
                  const selected = pendingRuleMediaIds.includes(item.mediaId);
                  const imageUrl = item.thumbnailUrl || item.mediaUrl;
                  return (
                    <button
                      key={item.mediaId}
                      type="button"
                      disabled={!item.isCommentAutomationEligible}
                      onClick={() =>
                        setPendingRuleMediaIds((current) =>
                          selected
                            ? current.filter(
                                (mediaId) => mediaId !== item.mediaId
                              )
                            : [...current, item.mediaId]
                        )
                      }
                      className={cn(
                        "relative overflow-hidden rounded-xl border-2 bg-white text-left transition",
                        selected
                          ? "border-pink-500 ring-2 ring-pink-100"
                          : "border-transparent hover:border-pink-200",
                        !item.isCommentAutomationEligible &&
                          "cursor-not-allowed opacity-50"
                      )}
                      title={
                        item.isCommentAutomationEligible
                          ? selected
                            ? "Remove this post from the selection"
                            : "Select this post"
                          : "This post is not eligible for comment automation"
                      }
                    >
                      <div className="aspect-square bg-muted">
                        {imageUrl ? (
                          item.mediaType === "VIDEO" ? (
                            <video
                              src={imageUrl}
                              className="h-full w-full object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={imageUrl}
                              alt={item.caption || item.mediaId}
                              className="h-full w-full object-cover"
                            />
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm">
                          {item.caption || "No caption"}
                        </p>
                      </div>
                      {selected && (
                        <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-pink-600 text-white shadow-md">
                          <Check className="size-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Sync Instagram media before selecting posts.
              </div>
            )}
            <div ref={ruleMediaLoadMoreRef} className="h-px" />
            {isFetchingMoreMedia && (
              <CardGridLoadingSkeleton
                count={4}
                className="md:grid-cols-3 lg:grid-cols-4"
              />
            )}
            {!hasMoreMedia && media.length > 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                All Instagram media is loaded.
              </p>
            )}
          </div>
          <DialogFooter className="items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {pendingRuleMediaIds.length} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRuleMediaPickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700"
                onClick={confirmRuleMediaSelection}
                disabled={!pendingRuleMediaIds.length}
              >
                Proceed
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect Instagram Business</DialogTitle>
            <DialogDescription>
              Sign in with your Instagram professional account to connect it. We
              never see your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-pink-50/50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-pink-600">
                  <Instagram className="size-5" />
                </div>
                <div>
                  <p className="font-medium">Permissions requested</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Basic profile, messages, comments, and content access for
                    the Instagram professional account selected by the business.
                  </p>
                </div>
              </div>
            </div>

            {loginSelection?.accounts.length ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Choose Instagram account</Label>
                  <Select
                    value={selectedLoginAccount}
                    onValueChange={setSelectedLoginAccount}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {loginSelection.accounts.map((account) => (
                        <SelectItem
                          key={account.igBusinessAccountId}
                          value={account.igBusinessAccountId}
                        >
                          @{account.username || account.igBusinessAccountId}
                          {account.pageName ? ` · ${account.pageName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full cursor-pointer bg-pink-600 hover:bg-pink-700"
                  onClick={connectSelectedLoginAccount}
                  disabled={connectMutation.isPending}
                >
                  {connectMutation.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Connect selected account
                </Button>
                <Button
                  variant="outline"
                  className="w-full cursor-pointer"
                  onClick={startInstagramLogin}
                >
                  Restart Instagram login
                </Button>
              </div>
            ) : (
              <Button
                className="w-full cursor-pointer bg-pink-600 hover:bg-pink-700"
                onClick={startInstagramLogin}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Continue with Instagram
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function InstagramMediaCard({ item }: { item: InstagramMedia }) {
  const imageUrl = item.thumbnailUrl || item.mediaUrl;
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-xs">
      <div className="aspect-square bg-muted">
        {imageUrl ? (
          item.mediaType === "VIDEO" ? (
            <video
              src={imageUrl}
              className="h-full w-full object-cover"
              muted
            />
          ) : (
            <img
              src={imageUrl}
              alt={item.caption || item.mediaId}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{item.mediaType || "MEDIA"}</Badge>
          {item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-muted-foreground hover:text-pink-600"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm">
          {item.caption || "No caption"}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.commentsCount || 0} comments</span>
          <span>{formatDate(item.timestamp)}</span>
        </div>
        {!item.isCommentAutomationEligible && (
          <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            {(item.eligibilityIssues || []).join(", ") ||
              "Not eligible for comment automation"}
          </div>
        )}
      </div>
    </div>
  );
}

function InstagramIndexPageContent() {
  return <InstagramPage />;
}

export default function InstagramIndexPage() {
  return (
    <PermissionGate permission="instagram:manage" feature="Instagram">
      <InstagramIndexPageContent />
    </PermissionGate>
  );
}
