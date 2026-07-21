"use client";

import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeChange,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useEdgesState,
  useNodesState,
  useUpdateNodeInternals
} from "@xyflow/react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  ExternalLink,
  ImageIcon,
  Instagram,
  Loader2,
  MessageCircle,
  MousePointerClick,
  PauseCircle,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Tags,
  Trash2,
  UserRound,
  Video,
  Workflow,
  X,
  XCircle
} from "lucide-react";
import {
  DragEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { toast } from "sonner";

import {
  connectInstagramLogin,
  activateInstagramCanvas,
  createInstagramCanvas,
  deleteInstagramCanvas,
  createInstagramCommentRule,
  deleteInstagramCommentRule,
  disableInstagramCommentRule,
  enableInstagramCommentRule,
  getInstagramCanvas,
  getInstagramCanvasDraft,
  getInstagramCanvasPublished,
  getInstagramCanvases,
  getInstagramCommentRules,
  getInstagramFlows,
  getInstagramMedia,
  getInstagramStatus,
  publishInstagramCanvasById,
  publishInstagramCanvas,
  saveInstagramCanvasDraftById,
  saveInstagramCanvasDraft,
  syncInstagramMedia,
  syncInstagramStatus,
  updateInstagramCanvas,
  updateInstagramCommentRule,
  validateInstagramCanvasById,
  validateInstagramCanvas
} from "@/client-api/functions/instagram";
import {
  ConnectInstagramLoginPayload,
  InstagramActionType,
  InstagramBlockType,
  InstagramCanvasAction,
  InstagramCanvasContent,
  InstagramCanvasNode,
  InstagramCanvasState,
  InstagramCommentRule,
  InstagramCommentRulePayload,
  InstagramGenericCard,
  InstagramLoginAccount,
  InstagramMedia,
  InstagramQuickReply,
  InstagramTemplateButton,
  InstagramTriggerType
} from "@/client-api/types/instagram.type";
import { MediaAsset } from "@/client-api/types/media.type";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { InstagramFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import FlowDiagramPreviewDialog from "@/components/flows/FlowDiagramPreviewDialog";
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
import {
  CanvasLoadingSkeleton,
  CardGridLoadingSkeleton
} from "@/components/ui/loading-skeletons";
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

type PageTab = "profile" | "canvas" | "rules" | "media" | "setup";
type CanvasMode = "draft" | "published";
type MediaPickerTarget =
  | { kind: "node"; type: "IMAGE" | "VIDEO" }
  | { kind: "generic-card"; cardIndex: number; type: "IMAGE" | "VIDEO" };

interface InstagramNodeData extends Record<string, unknown> {
  name: string;
  triggerType?: InstagramTriggerType;
  triggerKey?: string;
  blockType: InstagramBlockType;
  content: InstagramCanvasContent;
  actions: InstagramCanvasAction[];
  locked?: boolean;
  invalid?: boolean;
  metadata?: Record<string, unknown>;
}

type InstagramFlowNode = Node<InstagramNodeData, "instagramBlock">;

const blockMeta: Record<
  InstagramBlockType,
  { label: string; icon: React.ElementType; description: string }
> = {
  send_text: {
    label: "Text",
    icon: MessageCircle,
    description: "Plain Instagram DM text"
  },
  send_image: {
    label: "Image",
    icon: ImageIcon,
    description: "Send an image from media library"
  },
  send_video: {
    label: "Video",
    icon: Video,
    description: "Send a video from media library"
  },
  quick_replies: {
    label: "Quick Replies",
    icon: Send,
    description: "Up to 13 temporary reply choices"
  },
  button_template: {
    label: "Button Template",
    icon: MousePointerClick,
    description: "Text with up to 3 URL or postback buttons"
  },
  generic_template: {
    label: "Generic Template",
    icon: Route,
    description: "Carousel with up to 10 cards"
  },
  tag_subscriber: {
    label: "Tag Subscriber",
    icon: Tags,
    description: "Apply tags for segmentation"
  },
  handoff_to_agent: {
    label: "Handoff",
    icon: UserRound,
    description: "Escalate to the team inbox"
  },
  pause_automation: {
    label: "Pause",
    icon: PauseCircle,
    description: "Pause Instagram automation"
  },
  end_flow: {
    label: "End Flow",
    icon: CheckCircle2,
    description: "Resolve this automated path"
  }
};

const triggerLabels: Record<InstagramTriggerType, string> = {
  default: "Default",
  first_dm: "First DM",
  keyword: "Keyword",
  story_reply: "Story Reply",
  comment_private_reply_opened: "Comment opened",
  manual_start: "Manual Start"
};
const visibleTriggerEntries = Object.entries(triggerLabels).filter(
  ([value]) =>
    value !== "comment_private_reply_opened" && value !== "manual_start"
);

const blockTypes = Object.keys(blockMeta) as InstagramBlockType[];
const previewableInstagramBlockTypes = new Set<InstagramBlockType>([
  "send_text",
  "send_image",
  "send_video",
  "quick_replies",
  "button_template",
  "generic_template"
]);

const routeActionTypes = new Set<InstagramActionType>(["go_to_node"]);
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

const normalizeKey = (value: string) =>
  value.trim().replace(/\s+/g, " ").toUpperCase();

const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;

const makeReplyId = (label: string, fallback: string) =>
  normalizeKey(label || fallback)
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, 48) || fallback;

const getRawNodeData = (node: InstagramCanvasNode): InstagramNodeData => {
  const data = node.data || {};
  return {
    name: data.name || data.label || node.name || "Instagram block",
    triggerType: data.triggerType || node.triggerType,
    triggerKey: data.triggerKey || node.triggerKey,
    blockType: data.blockType || node.blockType || "send_text",
    content: data.content || node.content || {},
    actions: data.actions || node.actions || [],
    locked: Boolean(data.locked || node.locked),
    invalid: false,
    metadata: data.metadata || node.metadata || {}
  };
};

const toFlowNodes = (
  state?: InstagramCanvasState | null
): InstagramFlowNode[] =>
  (state?.nodes || []).map((node, index) => {
    const data = getRawNodeData(node);
    const triggerKey = data.triggerKey ? normalizeKey(data.triggerKey) : "";
    const defaultTriggerKey = state?.defaultTriggerKey
      ? normalizeKey(state.defaultTriggerKey)
      : "";
    return {
      id: node.id || data.triggerKey || `ig_node_${index + 1}`,
      type: "instagramBlock",
      position: node.position || { x: 120 + index * 80, y: 120 + index * 100 },
      data: {
        ...data,
        metadata: {
          ...(data.metadata || {}),
          isDefault:
            Boolean(defaultTriggerKey && triggerKey === defaultTriggerKey) ||
            Boolean(data.metadata?.isDefault)
        }
      }
    };
  });

const toFlowEdges = (state?: InstagramCanvasState | null): Edge[] =>
  (state?.edges || []).map((edge, index) => ({
    id: edge.id || `ig_edge_${index + 1}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || edge.actionId || edge.replyId,
    targetHandle: edge.targetHandle || "in",
    data: {
      actionId: edge.actionId,
      replyId: edge.replyId,
      ...(edge.data || {})
    }
  }));

const defaultContentForType = (
  type: InstagramBlockType
): InstagramCanvasContent => {
  if (type === "quick_replies") {
    return {
      text: "What would you like to do?",
      quickReplies: [
        {
          label: "View products",
          replyId: "VIEW_PRODUCTS",
          contentType: "text"
        },
        { label: "Talk to team", replyId: "TALK_TO_TEAM", contentType: "text" }
      ]
    };
  }
  if (type === "button_template") {
    return {
      text: "Choose an option.",
      buttons: [
        { type: "postback", label: "Start", replyId: "START" },
        { type: "web_url", label: "Website", url: "https://example.com" }
      ]
    };
  }
  if (type === "generic_template") {
    return {
      cards: [
        {
          title: "Featured item",
          subtitle: "Add image/video and actions",
          mediaType: "image",
          buttons: [{ type: "postback", label: "View", replyId: "VIEW_ITEM" }]
        }
      ]
    };
  }
  if (type === "pause_automation") return { minutes: 60 };
  if (type === "tag_subscriber") return { tags: ["instagram"] };
  if (type === "handoff_to_agent") return { reason: "instagram_handoff" };
  if (type === "end_flow") return { reason: "completed" };
  return { text: "Write your Instagram message here." };
};

const deriveActions = (
  blockType: InstagramBlockType,
  content: InstagramCanvasContent
): InstagramCanvasAction[] => {
  if (blockType === "quick_replies") {
    return ((content.quickReplies as InstagramQuickReply[]) || []).map(
      (reply, index) => {
        const label = reply.label || reply.title || `Reply ${index + 1}`;
        const replyId =
          reply.replyId ||
          reply.payload ||
          makeReplyId(label, `REPLY_${index + 1}`);
        return {
          actionId: replyId,
          type: "go_to_node",
          label,
          replyId,
          metadata: { contentType: reply.contentType || "text" }
        };
      }
    );
  }

  if (blockType === "button_template") {
    return ((content.buttons as InstagramTemplateButton[]) || []).map(
      (button, index) => {
        const label = button.label || button.title || `Button ${index + 1}`;
        const buttonType = button.type || (button.url ? "web_url" : "postback");
        const replyId =
          button.replyId ||
          button.payload ||
          makeReplyId(label, `BUTTON_${index + 1}`);
        return {
          actionId: button.actionId || replyId,
          type: buttonType === "web_url" ? "open_url" : "go_to_node",
          label,
          replyId: buttonType === "web_url" ? undefined : replyId,
          url: buttonType === "web_url" ? button.url : undefined,
          metadata: {}
        };
      }
    );
  }

  if (blockType === "generic_template") {
    const actions: InstagramCanvasAction[] = [];
    ((content.cards as InstagramGenericCard[]) || []).forEach(
      (card, cardIndex) => {
        (card.buttons || []).forEach((button, buttonIndex) => {
          const label =
            button.label || button.title || `Button ${buttonIndex + 1}`;
          const buttonType =
            button.type || (button.url ? "web_url" : "postback");
          const replyId =
            button.replyId ||
            button.payload ||
            makeReplyId(label, `CARD_${cardIndex + 1}_${buttonIndex + 1}`);
          actions.push({
            actionId: button.actionId || replyId,
            type: buttonType === "web_url" ? "open_url" : "go_to_node",
            label,
            replyId: buttonType === "web_url" ? undefined : replyId,
            url: buttonType === "web_url" ? button.url : undefined,
            metadata: { cardIndex }
          });
        });
      }
    );
    return actions;
  }

  return [];
};

const toCanvasState = (
  nodes: InstagramFlowNode[],
  edges: Edge[],
  version = 1
): InstagramCanvasState => {
  const defaultNode =
    nodes.find((node) =>
      Boolean(
        (node.data.metadata as Record<string, unknown> | undefined)?.isDefault
      )
    ) || nodes[0];
  const defaultTriggerKey = defaultNode?.data.triggerKey
    ? normalizeKey(defaultNode.data.triggerKey)
    : defaultNode?.id
      ? normalizeKey(defaultNode.id)
      : undefined;

  return {
    version,
    defaultTriggerKey,
    nodes: nodes.map((node) => {
      const actions = deriveActions(node.data.blockType, node.data.content);
      const triggerKey = node.data.triggerKey
        ? normalizeKey(node.data.triggerKey)
        : node.id === defaultNode?.id && defaultTriggerKey
          ? defaultTriggerKey
          : undefined;
      return {
        id: node.id,
        type: "instagramBlock",
        position: node.position,
        data: {
          name: node.data.name,
          triggerType:
            node.id === defaultNode?.id ? "default" : node.data.triggerType,
          triggerKey,
          blockType: node.data.blockType,
          content: node.data.content,
          actions,
          locked: node.data.locked,
          metadata: {
            ...(node.data.metadata || {}),
            isDefault: node.id === defaultNode?.id
          }
        }
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || "in",
      actionId:
        edge.sourceHandle || (edge.data?.actionId as string) || undefined,
      replyId: edge.sourceHandle || (edge.data?.replyId as string) || undefined,
      data: {
        actionId: edge.sourceHandle || (edge.data?.actionId as string),
        replyId: edge.sourceHandle || (edge.data?.replyId as string)
      }
    })),
    viewport: { x: 0, y: 0, zoom: 1 }
  };
};

function InstagramBlockNode({
  id,
  data,
  selected
}: NodeProps<InstagramFlowNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const meta = blockMeta[data.blockType] || blockMeta.send_text;
  const Icon = meta.icon;
  const isDefault = Boolean(
    (data.metadata as Record<string, unknown> | undefined)?.isDefault
  );
  const actions = useMemo(
    () =>
      deriveActions(data.blockType, data.content).filter((action) =>
        routeActionTypes.has(action.type)
      ),
    [data.blockType, data.content]
  );
  const outputHandleKey = useMemo(
    () => actions.map((action) => action.actionId).join("|"),
    [actions]
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputHandleKey, updateNodeInternals]);

  return (
    <div
      className={cn(
        "relative min-w-72 max-w-80 rounded-xl border bg-white shadow-sm transition",
        selected && "border-pink-500 shadow-md ring-2 ring-pink-500/15",
        isDefault && "border-2 border-pink-600 shadow-md",
        data.invalid && "border-destructive ring-2 ring-destructive/15"
      )}
    >
      {isDefault && (
        <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
          Default
        </span>
      )}
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!size-3.5 !border-2 !border-white !bg-pink-500"
      />
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-pink-50 text-pink-600">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{data.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {data.triggerType && (
              <Badge variant="outline" className="text-[10px]">
                {triggerLabels[data.triggerType]}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{meta.label}</span>
          </div>
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {data.content.text ||
            (data.content.cards as InstagramGenericCard[] | undefined)?.[0]
              ?.title ||
            data.content.reason ||
            meta.description}
        </p>
        {(data.blockType === "send_image" || data.blockType === "send_video") &&
          data.content.mediaName && (
            <Badge variant="secondary" className="max-w-full truncate">
              {data.content.mediaName}
            </Badge>
          )}
      </div>
      {actions.length > 0 && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 pr-6">
          {actions.map((action) => (
            <div
              key={action.actionId}
              className="relative flex items-center justify-between gap-3 rounded-md bg-white px-2 py-1.5 text-xs shadow-xs"
            >
              <span className="truncate">{action.label || action.replyId}</span>
              <Badge variant="secondary" className="text-[10px]">
                route
              </Badge>
              <Handle
                id={action.actionId}
                type="source"
                position={Position.Right}
                style={{
                  right: -18,
                  top: "50%",
                  transform: "translate(50%, -50%)"
                }}
                className="!size-3.5 !border-2 !border-white !bg-pink-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { instagramBlock: memo(InstagramBlockNode) };

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

type InstagramPageProps = {
  canvasOnly?: boolean;
  forcedCanvasId?: string;
};

export function InstagramPage({
  canvasOnly = false,
  forcedCanvasId = ""
}: InstagramPageProps = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const activeOrgId = activeOrganization?._id;
  const [activeTab, setActiveTab] = useState<PageTab>(
    canvasOnly ? "canvas" : "profile"
  );
  const [selectedCanvasId, setSelectedCanvasId] = useState(forcedCanvasId);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("draft");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [flowPreviewOpen, setFlowPreviewOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<InstagramFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] =
    useState<MediaPickerTarget | null>(null);
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
  const { data: canvasesData, isLoading: isCanvasesLoading } = useQuery({
    queryKey: ["instagram-canvases", activeOrgId],
    queryFn: getInstagramCanvases,
    enabled: Boolean(activeOrgId && isReady)
  });
  const canvases = useMemo(
    () => canvasesData?.data.canvases || [],
    [canvasesData?.data.canvases]
  );
  const canvasDetailQueries = useQueries({
    queries: canvases.map((canvas) => ({
      queryKey: ["instagram-canvas", activeOrgId, canvas._id],
      queryFn: () => getInstagramCanvas(canvas._id),
      enabled: Boolean(activeOrgId && isReady)
    }))
  });
  const canvasDetailsById = useMemo(
    () =>
      new Map(
        canvasDetailQueries.flatMap((query) => {
          const detail = query.data?.data.canvas;
          return detail ? [[detail._id, detail] as const] : [];
        })
      ),
    [canvasDetailQueries]
  );
  useEffect(() => {
    if (forcedCanvasId && selectedCanvasId !== forcedCanvasId) {
      setSelectedCanvasId(forcedCanvasId);
      return;
    }
    if (forcedCanvasId || selectedCanvasId || !canvases.length) return;
    setSelectedCanvasId(
      canvases.find((canvas) => canvas.status === "active")?._id ||
        canvases[0]._id
    );
  }, [canvases, forcedCanvasId, selectedCanvasId]);
  const selectedCanvas =
    canvases.find((canvas) => canvas._id === selectedCanvasId) || null;
  const { data: canvasDetailData, isLoading: isCanvasDetailLoading } = useQuery(
    {
      queryKey: ["instagram-canvas", activeOrgId, selectedCanvasId],
      queryFn: () => getInstagramCanvas(selectedCanvasId),
      enabled: Boolean(activeOrgId && isReady && selectedCanvasId)
    }
  );
  const canvasDetail = canvasDetailData?.data.canvas;
  const { data: draftData, isLoading: isDraftLoading } = useQuery({
    queryKey: ["instagram-canvas-draft", activeOrgId],
    queryFn: getInstagramCanvasDraft,
    enabled: Boolean(activeOrgId && isReady && !selectedCanvasId)
  });
  const { data: publishedData } = useQuery({
    queryKey: ["instagram-canvas-published", activeOrgId],
    queryFn: getInstagramCanvasPublished,
    enabled: Boolean(activeOrgId && isReady && !selectedCanvasId)
  });
  const { data: flowsData } = useQuery({
    queryKey: ["instagram-flows", activeOrgId],
    queryFn: () => getInstagramFlows({ limit: 8 }),
    enabled: Boolean(activeOrgId && isReady)
  });
  const { data: mediaData, isLoading: isMediaLoading } = useQuery({
    queryKey: ["instagram-media", activeOrgId, mediaSearch, mediaTypeFilter],
    queryFn: () =>
      getInstagramMedia({
        limit: 36,
        search: mediaSearch,
        mediaType: mediaTypeFilter
      }),
    enabled: Boolean(activeOrgId && isReady)
  });
  const { data: rulesData, isLoading: isRulesLoading } = useQuery({
    queryKey: ["instagram-comment-rules", activeOrgId],
    queryFn: () => getInstagramCommentRules({ limit: 30 }),
    enabled: Boolean(activeOrgId && isReady)
  });

  const activeCanvasState =
    canvasMode === "draft"
      ? canvasDetail?.draftState || draftData?.data.draftState
      : canvasDetail?.publishedState || publishedData?.data.publishedState;
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const previewNode = useMemo(() => {
    const node = nodes.find((item) => item.id === previewNodeId) || null;
    return node && previewableInstagramBlockTypes.has(node.data.blockType)
      ? node
      : null;
  }, [nodes, previewNodeId]);
  const rules = rulesData?.data.rules || [];
  const media = mediaData?.data.media || [];
  const selectedCanvasVersion =
    canvasDetail?.draftState?.version ||
    draftData?.data.draftState?.version ||
    1;

  useEffect(() => {
    if (!canvasOnly && !isReady && activeTab !== "profile") {
      setActiveTab("profile");
    }
  }, [activeTab, canvasOnly, isReady]);

  useEffect(() => {
    if (!isReady) return;
    setIsConnectOpen(false);
    setLoginSelection(null);
    setSelectedLoginAccount("");
    pendingLoginRef.current = null;
    sessionStorage.removeItem(INSTAGRAM_LOGIN_STATE_KEY);
    sessionStorage.removeItem(INSTAGRAM_LOGIN_REDIRECT_KEY);
  }, [isReady]);

  useEffect(() => {
    setNodes(toFlowNodes(activeCanvasState));
    setEdges(toFlowEdges(activeCanvasState));
    setSelectedNodeId(null);
    setPreviewNodeId(null);
  }, [activeCanvasState, setEdges, setNodes]);

  const connectMutation = useMutation({
    mutationFn: connectInstagramLogin,
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
    onSuccess: () => {
      toast.success("Instagram status refreshed");
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const syncMediaMutation = useMutation({
    mutationFn: () => syncInstagramMedia({ limit: 50 }),
    onSuccess: (data) => {
      toast.success(`Synced ${data.data.synced} Instagram media item(s)`);
      queryClient.invalidateQueries({ queryKey: ["instagram-media"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      const state = toCanvasState(nodes, edges, selectedCanvasVersion);
      return selectedCanvasId
        ? saveInstagramCanvasDraftById({
            canvasId: selectedCanvasId,
            draftState: state
          })
        : saveInstagramCanvasDraft(state);
    },
    onSuccess: async () => {
      const validation = selectedCanvasId
        ? await validateInstagramCanvasById(selectedCanvasId)
        : await validateInstagramCanvas();
      setValidationMessages(validation.data.validation.errors);
      toast.success(
        validation.data.validation.valid
          ? "Draft saved and validated"
          : "Draft saved with validation issues"
      );
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas-draft"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const saveCurrentDraftBeforeMediaLibrary = useCallback(async () => {
    if (canvasMode !== "draft") return;

    try {
      const state = toCanvasState(nodes, edges, selectedCanvasVersion);
      if (selectedCanvasId) {
        await saveInstagramCanvasDraftById({
          canvasId: selectedCanvasId,
          draftState: state
        });
      } else {
        await saveInstagramCanvasDraft(state);
      }
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas-draft"] });
      toast.success("Draft saved before opening media library");
    } catch (error) {
      toast.error(getErrorMessage(error, "Instagram draft could not be saved"));
      throw error;
    }
  }, [
    canvasMode,
    edges,
    nodes,
    queryClient,
    selectedCanvasId,
    selectedCanvasVersion
  ]);

  const validateMutation = useMutation({
    mutationFn: () =>
      selectedCanvasId
        ? validateInstagramCanvasById(selectedCanvasId)
        : validateInstagramCanvas(),
    onSuccess: (data) => {
      setValidationMessages(data.data.validation.errors);
      toast[data.data.validation.valid ? "success" : "error"](
        data.data.validation.valid
          ? "Instagram canvas is valid"
          : "Fix validation errors before publishing"
      );
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const state = toCanvasState(nodes, edges, selectedCanvasVersion);
      if (selectedCanvasId) {
        await saveInstagramCanvasDraftById({
          canvasId: selectedCanvasId,
          draftState: state
        });
        return publishInstagramCanvasById({
          canvasId: selectedCanvasId,
          draftState: state
        });
      }
      await saveInstagramCanvasDraft(state);
      return publishInstagramCanvas(state);
    },
    onSuccess: (data) => {
      setValidationMessages(data.data.validation.warnings || []);
      toast.success("Instagram canvas published");
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas-draft"] });
      queryClient.invalidateQueries({
        queryKey: ["instagram-canvas-published"]
      });
      setCanvasMode("published");
    },
    onError: (error) => {
      const message = getErrorMessage(error, "Instagram publish failed");
      setValidationMessages([message]);
      toast.error(message);
    }
  });

  const createCanvasMutation = useMutation({
    mutationFn: () =>
      createInstagramCanvas({
        name: `Instagram Canvas ${canvases.length + 1}`
      }),
    onSuccess: (data) => {
      toast.success("Instagram canvas created");
      setSelectedCanvasId(data.data.canvas._id);
      setCanvasMode("draft");
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
      if (!canvasOnly) router.push(`/instagram/${data.data.canvas._id}`);
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const activateCanvasMutation = useMutation({
    mutationFn: activateInstagramCanvas,
    onSuccess: () => {
      toast.success("Instagram canvas activated");
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const deleteCanvasMutation = useMutation({
    mutationFn: deleteInstagramCanvas,
    onSuccess: () => {
      toast.success("Instagram canvas deleted");
      setSelectedCanvasId("");
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const renameCanvasMutation = useMutation({
    mutationFn: ({ canvasId, name }: { canvasId: string; name: string }) =>
      updateInstagramCanvas({ canvasId, name }),
    onSuccess: () => {
      toast.success("Instagram canvas renamed");
      queryClient.invalidateQueries({ queryKey: ["instagram-canvases"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-canvas"] });
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
    onSuccess: (_response, variables) => {
      if (variables.action === "delete") {
        setRuleToArchive(null);
        toast.success("Comment automation archived");
      }
      queryClient.invalidateQueries({ queryKey: ["instagram-comment-rules"] });
    },
    onError: (error) => toast.error(getErrorMessage(error))
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (canvasMode === "published") {
        toast.error("Switch to Draft to edit the Instagram canvas");
        return;
      }
      if (!connection.sourceHandle) {
        toast.error("Start the line from a quick reply or postback button");
        return;
      }
      setEdges((currentEdges) => {
        const withoutSameHandle = currentEdges.filter(
          (edge) =>
            !(
              edge.source === connection.source &&
              edge.sourceHandle === connection.sourceHandle
            )
        );
        return addEdge(
          {
            ...connection,
            id: `ig_edge_${connection.source}_${connection.sourceHandle}_${connection.target}`,
            data: {
              actionId: connection.sourceHandle,
              replyId: connection.sourceHandle
            }
          },
          withoutSameHandle
        );
      });
    },
    [canvasMode, setEdges]
  );

  const updateSelectedNode = useCallback(
    (patch: Partial<InstagramNodeData>) => {
      if (canvasMode === "published") {
        toast.error("Published canvas is read-only. Switch to Draft to edit.");
        return;
      }
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node
        )
      );
    },
    [canvasMode, selectedNodeId, setNodes]
  );

  const setSelectedNodeAsDefault = useCallback(() => {
    if (!selectedNode) return;
    if (canvasMode === "published") {
      toast.error("Published canvas is read-only. Switch to Draft to edit.");
      return;
    }
    setNodes((current) =>
      current.map((node) => {
        const isDefault = node.id === selectedNode.id;
        return {
          ...node,
          data: {
            ...node.data,
            triggerType: isDefault
              ? "default"
              : node.data.triggerType === "default"
                ? "manual_start"
                : node.data.triggerType,
            triggerKey:
              isDefault && !node.data.triggerKey
                ? normalizeKey(node.data.name || node.id)
                : node.data.triggerKey,
            metadata: {
              ...(node.data.metadata || {}),
              isDefault
            }
          }
        };
      })
    );
  }, [canvasMode, selectedNode, setNodes]);

  const setSelectedNodeTrigger = useCallback(
    (value: string) => {
      if (!selectedNode) return;
      if (value === "default") {
        setSelectedNodeAsDefault();
        return;
      }

      const triggerType =
        value === "none" ? undefined : (value as InstagramTriggerType);
      const triggerKey =
        triggerType === "first_dm"
          ? "FIRST_DM"
          : triggerType === "keyword"
            ? selectedNode.data.triggerType === "keyword"
              ? selectedNode.data.triggerKey
              : ""
            : triggerType === "story_reply"
              ? selectedNode.data.triggerType === "story_reply"
                ? selectedNode.data.triggerKey
                : "*"
              : selectedNode.data.triggerKey;

      updateSelectedNode({
        triggerType,
        triggerKey,
        metadata: {
          ...(selectedNode.data.metadata || {}),
          isDefault: false
        }
      });
    },
    [selectedNode, setSelectedNodeAsDefault, updateSelectedNode]
  );

  const updateContent = useCallback(
    (patch: Partial<InstagramCanvasContent>) => {
      updateSelectedNode({
        content: { ...(selectedNode?.data.content || {}), ...patch }
      });
    },
    [selectedNode?.data.content, updateSelectedNode]
  );

  const addNode = (
    blockType: InstagramBlockType,
    position?: { x: number; y: number }
  ) => {
    if (canvasMode === "published") {
      toast.error("Switch to Draft to add Instagram blocks");
      return;
    }
    const id = createId("ig_node");
    const meta = blockMeta[blockType];
    const shouldBeDefault = !nodes.some((node) =>
      Boolean(
        (node.data.metadata as Record<string, unknown> | undefined)?.isDefault
      )
    );
    const node: InstagramFlowNode = {
      id,
      type: "instagramBlock",
      position: position || {
        x: 180 + nodes.length * 60,
        y: 160 + nodes.length * 40
      },
      data: {
        name: meta.label,
        triggerType: blockType === "quick_replies" ? "manual_start" : undefined,
        triggerKey: shouldBeDefault
          ? normalizeKey(meta.label)
          : blockType === "quick_replies"
            ? normalizeKey(`${meta.label} ${nodes.length + 1}`)
            : undefined,
        blockType,
        content: defaultContentForType(blockType),
        actions: [],
        metadata: { isDefault: shouldBeDefault }
      }
    };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(id);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const blockType = event.dataTransfer.getData(
      "application/x-instagram-block"
    ) as InstagramBlockType;
    if (!blockType || !blockMeta[blockType]) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    addNode(blockType, {
      x: Math.max(40, event.clientX - (bounds?.left || 0) - 120),
      y: Math.max(40, event.clientY - (bounds?.top || 0) - 80)
    });
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    if (
      Boolean(
        (selectedNode.data.metadata as Record<string, unknown> | undefined)
          ?.isDefault
      )
    ) {
      toast.error(
        "Choose another block as default before deleting this block."
      );
      return;
    }
    if (selectedNode.data.locked) {
      toast.error("System blocks cannot be deleted.");
      return;
    }
    setNodes((current) =>
      current.filter((node) => node.id !== selectedNode.id)
    );
    setEdges((current) =>
      current.filter(
        (edge) =>
          edge.source !== selectedNode.id && edge.target !== selectedNode.id
      )
    );
    setSelectedNodeId(null);
    setPreviewNodeId(null);
  };

  const handleNodesChange = useCallback(
    (changes: NodeChange<InstagramFlowNode>[]) => {
      const lockedNodeIds = new Set(
        nodes.filter((node) => node.data.locked).map((node) => node.id)
      );
      const defaultNodeIds = new Set(
        nodes
          .filter((node) =>
            Boolean(
              (node.data.metadata as Record<string, unknown> | undefined)
                ?.isDefault
            )
          )
          .map((node) => node.id)
      );
      const defaultRemoval = changes.some(
        (change) => change.type === "remove" && defaultNodeIds.has(change.id)
      );
      const lockedRemoval = changes.some(
        (change) => change.type === "remove" && lockedNodeIds.has(change.id)
      );

      if (defaultRemoval) {
        toast.error(
          "Choose another block as default before deleting this block."
        );
      } else if (lockedRemoval) {
        toast.error("System blocks cannot be deleted.");
      }

      const allowedChanges = changes.filter(
        (change) =>
          change.type !== "remove" ||
          (!defaultNodeIds.has(change.id) && !lockedNodeIds.has(change.id))
      );
      if (!allowedChanges.length) return;
      onNodesChange(allowedChanges);
    },
    [nodes, onNodesChange]
  );

  const onMediaSelected = (asset: MediaAsset) => {
    if (!mediaPickerTarget || !selectedNode) return;
    if (mediaPickerTarget.kind === "node") {
      updateContent({
        mediaId: asset._id,
        mediaName: asset.name,
        mediaUrl: asset.cloudinaryUrl
      });
    } else {
      const cards = [
        ...(((selectedNode.data.content.cards as InstagramGenericCard[]) ||
          []) as InstagramGenericCard[])
      ];
      cards[mediaPickerTarget.cardIndex] = {
        ...cards[mediaPickerTarget.cardIndex],
        mediaId: asset._id,
        mediaName: asset.name,
        mediaType: asset.fileType === "video" ? "video" : "image",
        imageUrl: asset.cloudinaryUrl
      };
      updateContent({ cards });
    }
    setMediaPickerTarget(null);
  };

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

  const updateQuickReply = (
    index: number,
    patch: Partial<InstagramQuickReply>
  ) => {
    if (!selectedNode) return;
    const replies = [
      ...((selectedNode.data.content.quickReplies as InstagramQuickReply[]) ||
        [])
    ];
    replies[index] = { ...replies[index], ...patch };
    if (patch.label && !replies[index].replyId) {
      replies[index].replyId = makeReplyId(patch.label, `REPLY_${index + 1}`);
    }
    updateContent({ quickReplies: replies });
  };

  const updateTemplateButton = (
    index: number,
    patch: Partial<InstagramTemplateButton>
  ) => {
    if (!selectedNode) return;
    const buttons = [
      ...((selectedNode.data.content.buttons as InstagramTemplateButton[]) ||
        [])
    ];
    buttons[index] = { ...buttons[index], ...patch };
    if (patch.label && !buttons[index].replyId) {
      buttons[index].replyId = makeReplyId(patch.label, `BUTTON_${index + 1}`);
    }
    updateContent({ buttons });
  };

  const updateCard = (index: number, patch: Partial<InstagramGenericCard>) => {
    if (!selectedNode) return;
    const cards = [
      ...((selectedNode.data.content.cards as InstagramGenericCard[]) || [])
    ];
    cards[index] = { ...cards[index], ...patch };
    updateContent({ cards });
  };

  const renderProperties = () => {
    if (!selectedNode) {
      return (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center">
          <Settings2 className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Select an Instagram block</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure message content, triggers, media, and route choices here.
          </p>
        </div>
      );
    }

    const readOnly = canvasMode === "published";
    const content = selectedNode.data.content;
    const canPreview = previewableInstagramBlockTypes.has(
      selectedNode.data.blockType
    );
    const isDefaultBlock = Boolean(
      (selectedNode.data.metadata as Record<string, unknown> | undefined)
        ?.isDefault
    );

    return (
      <div className="space-y-5">
        {canPreview && (
          <Button
            type="button"
            variant={
              previewNodeId === selectedNode.id ? "secondary" : "outline"
            }
            className="w-full"
            tooltip={
              previewNodeId === selectedNode.id
                ? "Hide the live Instagram message preview"
                : "Preview this block with its current Instagram message data"
            }
            onClick={() =>
              setPreviewNodeId((current) =>
                current === selectedNode.id ? null : selectedNode.id
              )
            }
          >
            <Eye className="size-4" />
            {previewNodeId === selectedNode.id
              ? "Hide preview"
              : "Show preview"}
          </Button>
        )}
        {readOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Published mode is read-only. Switch to Draft to change this block.
          </div>
        )}
        <div className="space-y-2">
          <Label>Block name</Label>
          <Input
            value={selectedNode.data.name}
            disabled={readOnly}
            onChange={(event) =>
              updateSelectedNode({ name: event.target.value })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">Default start block</p>
            <p className="text-xs text-muted-foreground">
              Only one Instagram block can start this canvas.
            </p>
          </div>
          <Switch
            checked={isDefaultBlock}
            disabled={readOnly || isDefaultBlock}
            title="Make this the default Instagram message starting block"
            onCheckedChange={(checked) => {
              if (checked) setSelectedNodeAsDefault();
            }}
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select
              value={
                selectedNode.data.triggerType === "manual_start"
                  ? "none"
                  : selectedNode.data.triggerType || "none"
              }
              disabled={readOnly}
              onValueChange={setSelectedNodeTrigger}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No trigger</SelectItem>
                {visibleTriggerEntries.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedNode.data.triggerType === "keyword" && (
            <div className="space-y-2">
              <Label>Keyword</Label>
              <Input
                value={selectedNode.data.triggerKey || ""}
                disabled={readOnly}
                placeholder="SALE or HELP"
                onChange={(event) =>
                  updateSelectedNode({ triggerKey: event.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Starts this path when an incoming DM contains this keyword.
              </p>
            </div>
          )}
          {selectedNode.data.triggerType === "story_reply" && (
            <div className="space-y-2">
              <Label>Story reply match</Label>
              <Input
                value={selectedNode.data.triggerKey || "*"}
                disabled={readOnly}
                placeholder="* for every story reply"
                onChange={(event) =>
                  updateSelectedNode({ triggerKey: event.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Use * for every story reply, or enter text for a specific reply.
              </p>
            </div>
          )}
          {selectedNode.data.triggerType === "first_dm" && (
            <p className="rounded-lg bg-pink-50 p-3 text-xs text-pink-800">
              Runs once when a person starts their first Instagram DM
              conversation.
            </p>
          )}
        </div>

        {(selectedNode.data.blockType === "send_text" ||
          selectedNode.data.blockType === "quick_replies" ||
          selectedNode.data.blockType === "button_template") && (
          <div className="space-y-2">
            <Label>Message text</Label>
            <Textarea
              value={content.text || ""}
              disabled={readOnly}
              maxLength={
                selectedNode.data.blockType === "button_template" ? 640 : 1000
              }
              onChange={(event) => updateContent({ text: event.target.value })}
              placeholder="Write the DM text"
            />
            <p className="text-xs text-muted-foreground">
              {selectedNode.data.blockType === "button_template"
                ? "Button template text limit: 640 characters."
                : "Instagram DM text limit in this backend: 1000 characters."}
            </p>
          </div>
        )}

        {(selectedNode.data.blockType === "send_image" ||
          selectedNode.data.blockType === "send_video") && (
          <div className="space-y-3">
            <Label>Media</Label>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-sm font-medium">
                {content.mediaName || "No media selected"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Backend requires a library mediaId for Instagram image/video
                blocks.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={readOnly}
                onClick={() =>
                  setMediaPickerTarget({
                    kind: "node",
                    type:
                      selectedNode.data.blockType === "send_video"
                        ? "VIDEO"
                        : "IMAGE"
                  })
                }
              >
                Select{" "}
                {selectedNode.data.blockType === "send_video"
                  ? "video"
                  : "image"}
              </Button>
            </div>
          </div>
        )}

        {selectedNode.data.blockType === "quick_replies" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Quick replies</Label>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  readOnly ||
                  ((content.quickReplies as InstagramQuickReply[]) || [])
                    .length >= 13
                }
                onClick={() => {
                  const replies = [
                    ...((content.quickReplies as InstagramQuickReply[]) || [])
                  ];
                  if (replies.length >= 13) {
                    toast.error("Instagram supports at most 13 quick replies");
                    return;
                  }
                  replies.push({
                    label: `Option ${replies.length + 1}`,
                    replyId: `OPTION_${replies.length + 1}`,
                    contentType: "text"
                  });
                  updateContent({ quickReplies: replies });
                }}
              >
                <Plus className="mr-2 size-4" />
                Add
              </Button>
            </div>
            {((content.quickReplies as InstagramQuickReply[]) || []).map(
              (reply, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl bg-muted/40 p-3"
                >
                  <Input
                    value={reply.label || reply.title || ""}
                    disabled={readOnly}
                    maxLength={20}
                    onChange={(event) =>
                      updateQuickReply(index, {
                        label: event.target.value,
                        replyId: makeReplyId(
                          event.target.value,
                          `REPLY_${index + 1}`
                        )
                      })
                    }
                    placeholder="Button label"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={readOnly}
                      onClick={() =>
                        updateContent({
                          quickReplies: (
                            (content.quickReplies as InstagramQuickReply[]) ||
                            []
                          ).filter((_, itemIndex) => itemIndex !== index)
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Label limit: 20 characters. Text replies create route dots.
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {selectedNode.data.blockType === "button_template" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Buttons</Label>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  readOnly ||
                  ((content.buttons as InstagramTemplateButton[]) || [])
                    .length >= 3
                }
                onClick={() => {
                  const buttons = [
                    ...((content.buttons as InstagramTemplateButton[]) || [])
                  ];
                  if (buttons.length >= 3) {
                    toast.error(
                      "Instagram button templates support at most 3 buttons"
                    );
                    return;
                  }
                  buttons.push({
                    type: "postback",
                    label: `Button ${buttons.length + 1}`,
                    replyId: `BUTTON_${buttons.length + 1}`
                  });
                  updateContent({ buttons });
                }}
              >
                <Plus className="mr-2 size-4" />
                Add
              </Button>
            </div>
            {((content.buttons as InstagramTemplateButton[]) || []).map(
              (button, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl bg-muted/40 p-3"
                >
                  <Input
                    value={button.label || button.title || ""}
                    disabled={readOnly}
                    maxLength={20}
                    onChange={(event) =>
                      updateTemplateButton(index, {
                        label: event.target.value,
                        replyId: makeReplyId(
                          event.target.value,
                          `BUTTON_${index + 1}`
                        )
                      })
                    }
                    placeholder="Button label"
                  />
                  <Select
                    value={button.type || "postback"}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      updateTemplateButton(index, {
                        type: value as InstagramTemplateButton["type"]
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postback">Send message</SelectItem>
                      <SelectItem value="web_url">Open URL</SelectItem>
                    </SelectContent>
                  </Select>
                  {(button.type || "postback") === "web_url" && (
                    <Input
                      value={button.url || ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateTemplateButton(index, { url: event.target.value })
                      }
                      placeholder="https://example.com"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={readOnly}
                    onClick={() =>
                      updateContent({
                        buttons: (
                          (content.buttons as InstagramTemplateButton[]) || []
                        ).filter((_, itemIndex) => itemIndex !== index)
                      })
                    }
                  >
                    <Trash2 className="mr-2 size-4" />
                    Remove
                  </Button>
                </div>
              )
            )}
          </div>
        )}

        {selectedNode.data.blockType === "generic_template" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Cards</Label>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  readOnly ||
                  ((content.cards as InstagramGenericCard[]) || []).length >= 10
                }
                onClick={() => {
                  const cards = [
                    ...((content.cards as InstagramGenericCard[]) || [])
                  ];
                  if (cards.length >= 10) {
                    toast.error("Generic templates support at most 10 cards");
                    return;
                  }
                  cards.push({
                    title: `Card ${cards.length + 1}`,
                    subtitle: "",
                    mediaType: "image",
                    buttons: []
                  });
                  updateContent({ cards });
                }}
              >
                <Plus className="mr-2 size-4" />
                Add
              </Button>
            </div>
            {((content.cards as InstagramGenericCard[]) || []).map(
              (card, cardIndex) => (
                <div
                  key={cardIndex}
                  className="space-y-3 rounded-xl bg-muted/40 p-3"
                >
                  <Input
                    value={card.title || ""}
                    disabled={readOnly}
                    maxLength={80}
                    placeholder="Card title"
                    onChange={(event) =>
                      updateCard(cardIndex, { title: event.target.value })
                    }
                  />
                  <Input
                    value={card.subtitle || ""}
                    disabled={readOnly}
                    maxLength={80}
                    placeholder="Subtitle"
                    onChange={(event) =>
                      updateCard(cardIndex, { subtitle: event.target.value })
                    }
                  />
                  <div className="flex items-center justify-between rounded-lg bg-white p-2 text-xs">
                    <span className="truncate">
                      {card.mediaName || "No image/video selected"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={readOnly}
                      onClick={() =>
                        setMediaPickerTarget({
                          kind: "generic-card",
                          cardIndex,
                          type: card.mediaType === "video" ? "VIDEO" : "IMAGE"
                        })
                      }
                    >
                      Pick media
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(card.buttons || []).map((button, buttonIndex) => (
                      <div
                        key={buttonIndex}
                        className="rounded-lg bg-white p-2"
                      >
                        <div className="grid gap-2">
                          <Input
                            value={button.label || button.title || ""}
                            disabled={readOnly}
                            maxLength={20}
                            placeholder="Button label"
                            onChange={(event) => {
                              const buttons = [...(card.buttons || [])];
                              buttons[buttonIndex] = {
                                ...buttons[buttonIndex],
                                label: event.target.value,
                                replyId: makeReplyId(
                                  event.target.value,
                                  `CARD_${cardIndex + 1}_${buttonIndex + 1}`
                                )
                              };
                              updateCard(cardIndex, { buttons });
                            }}
                          />
                          <Select
                            value={button.type || "postback"}
                            disabled={readOnly}
                            onValueChange={(value) => {
                              const buttons = [...(card.buttons || [])];
                              buttons[buttonIndex] = {
                                ...buttons[buttonIndex],
                                type: value as InstagramTemplateButton["type"]
                              };
                              updateCard(cardIndex, { buttons });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="postback">
                                Send message
                              </SelectItem>
                              <SelectItem value="web_url">Open URL</SelectItem>
                            </SelectContent>
                          </Select>
                          {(button.type || "postback") === "web_url" && (
                            <Input
                              value={button.url || ""}
                              disabled={readOnly}
                              placeholder="https://example.com"
                              onChange={(event) => {
                                const buttons = [...(card.buttons || [])];
                                buttons[buttonIndex] = {
                                  ...buttons[buttonIndex],
                                  url: event.target.value
                                };
                                updateCard(cardIndex, { buttons });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={readOnly || (card.buttons || []).length >= 3}
                      onClick={() => {
                        const buttons = [...(card.buttons || [])];
                        if (buttons.length >= 3) {
                          toast.error(
                            "Each generic card supports at most 3 buttons"
                          );
                          return;
                        }
                        buttons.push({
                          type: "postback",
                          label: `Button ${buttons.length + 1}`,
                          replyId: `CARD_${cardIndex + 1}_${buttons.length + 1}`
                        });
                        updateCard(cardIndex, { buttons });
                      }}
                    >
                      Add button
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={readOnly}
                      onClick={() =>
                        updateContent({
                          cards: (
                            (content.cards as InstagramGenericCard[]) || []
                          ).filter((_, itemIndex) => itemIndex !== cardIndex)
                        })
                      }
                    >
                      Remove card
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {selectedNode.data.blockType === "tag_subscriber" && (
          <div className="space-y-2">
            <Label>Tags</Label>
            <Input
              value={((content.tags as string[]) || []).join(", ")}
              disabled={readOnly}
              placeholder="lead, vip, support"
              onChange={(event) =>
                updateContent({
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                })
              }
            />
          </div>
        )}
        {selectedNode.data.blockType === "pause_automation" && (
          <div className="space-y-2">
            <Label>Pause minutes</Label>
            <Input
              type="number"
              min={1}
              value={Number(content.minutes || content.pauseMinutes || 60)}
              disabled={readOnly}
              onChange={(event) =>
                updateContent({ minutes: Number(event.target.value) })
              }
            />
          </div>
        )}
        {(selectedNode.data.blockType === "handoff_to_agent" ||
          selectedNode.data.blockType === "end_flow") && (
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={String(content.reason || "")}
              disabled={readOnly}
              onChange={(event) =>
                updateContent({ reason: event.target.value })
              }
            />
          </div>
        )}

        <Button
          variant="destructive"
          className="w-full"
          disabled={readOnly}
          onClick={deleteSelectedNode}
        >
          <Trash2 className="mr-2 size-4" />
          Delete block
        </Button>
      </div>
    );
  };

  const renderCanvasList = () => (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-pink-600">
                Instagram automation
              </p>
              <h2 className="font-heading text-3xl font-semibold">
                Message Flow
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage Instagram canvases. Publish any canvas, but only one can
                be active for Instagram automation at a time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                tooltip="Refresh the Instagram message-flow list"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["instagram-canvases"]
                  })
                }
              >
                <RefreshCcw className="size-4" />
                Refresh
              </Button>
              <Button
                type="button"
                className="cursor-pointer bg-pink-600 hover:bg-pink-700"
                disabled={createCanvasMutation.isPending}
                tooltip="Create another Instagram message flow"
                onClick={() => createCanvasMutation.mutate()}
              >
                {createCanvasMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add flow
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {isCanvasesLoading ? (
            <div className="lg:col-span-3">
              <CardGridLoadingSkeleton count={6} />
            </div>
          ) : canvases.length ? (
            canvases.map((canvas) => {
              const isActive = canvas.status === "active";
              const detailedCanvas = canvasDetailsById.get(canvas._id);
              const nodeCount =
                detailedCanvas?.draftState?.nodes?.length ??
                detailedCanvas?.publishedState?.nodes?.length ??
                0;
              return (
                <div
                  key={canvas._id}
                  className="rounded-lg border bg-white p-5 shadow-xs transition hover:border-pink-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Instagram className="size-4 text-pink-600" />
                        <h3 className="truncate font-heading text-xl font-semibold">
                          {canvas.name}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Updated {formatDate(canvas.updatedAt)}
                      </p>
                    </div>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn("capitalize", isActive && "bg-pink-600")}
                    >
                      {canvas.status}
                    </Badge>
                  </div>

                  <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Blocks</p>
                    <p className="mt-1 font-semibold">
                      {canvasDetailsById.has(canvas._id) ? (
                        nodeCount
                      ) : (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Active canvas</p>
                      <p className="text-xs text-muted-foreground">
                        Only one flow handles live Instagram messages.
                      </p>
                    </div>
                    <Switch
                      checked={isActive}
                      disabled={isActive || activateCanvasMutation.isPending}
                      title={
                        isActive
                          ? "This is the active Instagram message flow"
                          : "Make this the active Instagram message flow"
                      }
                      onCheckedChange={(checked) => {
                        if (!checked) return;
                        if (!canvas.latestPublishedVersionId) {
                          toast.error(
                            "Publish this Instagram canvas before activating it."
                          );
                          return;
                        }
                        activateCanvasMutation.mutate(canvas._id);
                      }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="cursor-pointer bg-pink-600 hover:bg-pink-700"
                      tooltip="Open this Instagram message flow editor"
                      onClick={() => router.push(`/instagram/${canvas._id}`)}
                    >
                      <Route className="size-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      disabled={renameCanvasMutation.isPending}
                      tooltip="Rename this Instagram message flow"
                      onClick={() => {
                        const name = window.prompt(
                          "Rename Instagram canvas",
                          canvas.name
                        );
                        if (name?.trim()) {
                          renameCanvasMutation.mutate({
                            canvasId: canvas._id,
                            name: name.trim()
                          });
                        }
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      disabled={deleteCanvasMutation.isPending || isActive}
                      tooltip={
                        isActive
                          ? "Activate another flow before deleting this one"
                          : "Archive this Instagram message flow"
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${canvas.name}? This archives the Instagram canvas.`
                          )
                        ) {
                          deleteCanvasMutation.mutate(canvas._id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg bg-white p-10 text-center shadow-xs lg:col-span-3">
              <Instagram className="mb-3 size-10 text-pink-600" />
              <h2 className="font-heading text-2xl font-semibold">
                No Instagram flows yet
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Create a canvas to start building Instagram DM automation.
              </p>
              <Button
                className="mt-4 cursor-pointer bg-pink-600 hover:bg-pink-700"
                disabled={createCanvasMutation.isPending}
                onClick={() => createCanvasMutation.mutate()}
              >
                <Plus className="size-4" />
                Add flow
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );

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
                    automations. We use Instagram Business Login and send only
                    the returned authorization code to the backend for token
                    exchange.
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
                    ["Page ID", instagram?.pageId],
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
      <div className="flex h-[calc(100vh-1px)] min-h-0 flex-col bg-slate-50">
        <div className="flex shrink-0 items-center justify-between border-b bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white">
              <Instagram className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {canvasOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 cursor-pointer px-2"
                    onClick={() => router.push("/instagram")}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>
                )}
                <h1 className="text-lg font-semibold">
                  {canvasOnly
                    ? selectedCanvas?.name || "Instagram Flow"
                    : "Instagram Automation"}
                </h1>
              </div>
              <p className="text-xs text-muted-foreground">
                {canvasOnly
                  ? "Edit draft, review published state, and publish Instagram automation."
                  : "DM canvas, media, and comment automations."}
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
            <Button
              variant="outline"
              onClick={() => setIsConnectOpen(true)}
              tooltip="Connect or reconnect an Instagram professional account"
            >
              <Settings2 className="mr-2 size-4" />
              Connect
            </Button>
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

        {!canvasOnly && (
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
                <TabsTrigger value="canvas" disabled={!isReady}>
                  Message Flow
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
        )}

        {activeTab === "profile" && !canvasOnly && renderProfile()}
        {canvasOnly && !isReady && renderProfile()}

        {activeTab === "canvas" && !canvasOnly && isReady && renderCanvasList()}

        {activeTab === "canvas" && canvasOnly && isReady && (
          <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_360px]">
            <aside className="min-h-0 overflow-y-auto border-r bg-white p-4">
              <div className="mb-4 space-y-3">
                <Tabs
                  value={canvasMode}
                  onValueChange={(value) => {
                    setCanvasMode(value as CanvasMode);
                    setSelectedNodeId(null);
                    setPreviewNodeId(null);
                  }}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                    <TabsTrigger value="published">Published</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Add blocks
                </p>
                {blockTypes.map((type) => {
                  const meta = blockMeta[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable={canvasMode === "draft"}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/x-instagram-block",
                          type
                        );
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addNode(type)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-pink-200 hover:bg-pink-50"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {meta.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                Quick replies support 13 choices. Button templates support 3
                buttons. Generic templates support 10 cards and 3 buttons per
                card.
              </div>
            </aside>

            <main
              ref={canvasRef}
              className="relative min-h-0"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={handleCanvasDrop}
            >
              {isDraftLoading || isCanvasDetailLoading || isCanvasesLoading ? (
                <CanvasLoadingSkeleton />
              ) : (
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={
                      canvasMode === "draft" ? handleNodesChange : undefined
                    }
                    onEdgesChange={
                      canvasMode === "draft" ? onEdgesChange : undefined
                    }
                    onConnect={onConnect}
                    onNodeClick={(_, node) => {
                      if (node.id !== selectedNodeId) setPreviewNodeId(null);
                      setSelectedNodeId(node.id);
                    }}
                    onPaneClick={() => {
                      setSelectedNodeId(null);
                      setPreviewNodeId(null);
                    }}
                    nodesDraggable={canvasMode === "draft"}
                    nodesConnectable={canvasMode === "draft"}
                    elementsSelectable
                    fitView
                    fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
                    className="bg-white"
                  >
                    <Background gap={20} size={1} />
                    <Controls />
                    <MiniMap pannable zoomable className="!h-28 !w-40" />
                    <ViewportPortal>
                      {previewNode && (
                        <div
                          className="nodrag nopan nowheel absolute z-[1000] w-[280px] max-w-[calc(100vw-2rem)]"
                          style={{
                            transform: `translate(${previewNode.position.x - 26}px, ${previewNode.position.y - 18}px) translateY(-100%)`
                          }}
                        >
                          <InstagramFlowBlockPreview
                            blockType={previewNode.data.blockType}
                            content={previewNode.data.content}
                            onClose={() => setPreviewNodeId(null)}
                          />
                        </div>
                      )}
                    </ViewportPortal>
                  </ReactFlow>
                </ReactFlowProvider>
              )}
              <div className="absolute left-4 top-4 flex flex-wrap gap-2 rounded-xl border bg-white/95 p-2 shadow-sm backdrop-blur">
                <Button
                  size="sm"
                  variant="outline"
                  tooltip="Save the current Instagram flow draft"
                  disabled={
                    canvasMode === "published" || saveDraftMutation.isPending
                  }
                  onClick={() => saveDraftMutation.mutate()}
                >
                  {saveDraftMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Save draft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  tooltip="Check this flow against backend publishing rules"
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                >
                  <ShieldAlert className="mr-2 size-4" />
                  Validate
                </Button>
                <Button
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700"
                  tooltip="Publish this Instagram message flow"
                  disabled={
                    canvasMode === "published" || publishMutation.isPending
                  }
                  onClick={() => publishMutation.mutate()}
                >
                  {publishMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 size-4" />
                  )}
                  Publish
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-4 top-4 bg-white/95 shadow-xs backdrop-blur"
                tooltip="Open a read-only diagram of every Instagram block and connection"
                disabled={!nodes.length}
                onClick={() => setFlowPreviewOpen(true)}
              >
                <Workflow className="size-4" />
                Preview flow
              </Button>
            </main>

            <aside className="min-h-0 overflow-y-auto border-l bg-white p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold">Properties</h2>
                <p className="text-xs text-muted-foreground">
                  Configure the selected Instagram automation block.
                </p>
              </div>
              {validationMessages.length > 0 && (
                <div className="mb-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Publish checks</p>
                  {validationMessages.slice(0, 5).map((message, index) => (
                    <p key={index}>{message}</p>
                  ))}
                </div>
              )}
              {renderProperties()}
            </aside>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {media.map((item) => (
                  <InstagramMediaCard key={item.mediaId} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "setup" && isReady && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-white p-5 lg:col-span-2">
                <h2 className="text-base font-semibold">
                  Backend-supported features
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    "Instagram Business Login connection",
                    "Instagram media sync and search",
                    "Draft and published DM canvas",
                    "Text, image, video, quick replies",
                    "Button and generic templates",
                    "Tag, handoff, pause, and end nodes",
                    "Named flow listing",
                    "Comment automations"
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-base font-semibold">Docs excluded here</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  These Meta doc features are not exposed in the current backend
                  organization routes, so this UI does not pretend to configure
                  them.
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  {[
                    "Persistent menu setup",
                    "Ice breakers setup",
                    "ig.me link generation",
                    "Instagram user profile lookup",
                    "Sender actions: typing_on / mark_seen",
                    "Direct one-off Send API composer outside conversations"
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <XCircle className="size-4 text-muted-foreground" />
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
                  {(flowsData?.data.flows || []).map((flow) => (
                    <div key={flow._id} className="rounded-lg border p-3">
                      <p className="truncate text-sm font-semibold">
                        {flow.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {flow.triggerType} {flow.triggerKey || ""}
                      </p>
                      <Badge variant="outline" className="mt-3">
                        v{flow.version} {flow.status}
                      </Badge>
                    </div>
                  ))}
                  {!flowsData?.data.flows?.length && (
                    <p className="text-sm text-muted-foreground">
                      No separate named Instagram flows have been created.
                    </p>
                  )}
                </div>
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
                Each chip is sent as one item in the backend keywords array.
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
                    className="mt-3"
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
                    className="mt-3"
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
              Continue with Instagram Business Login. The frontend sends the
              returned authorization code to the backend; token exchange and
              storage happen server-side.
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

      <MediaPickerDialog
        open={Boolean(mediaPickerTarget)}
        onOpenChange={(open) => !open && setMediaPickerTarget(null)}
        onSelect={onMediaSelected}
        onBeforeOpenMediaLibrary={saveCurrentDraftBeforeMediaLibrary}
        requiredType={mediaPickerTarget?.type}
        selectedMediaId={
          mediaPickerTarget?.kind === "node"
            ? selectedNode?.data.content.mediaId
            : mediaPickerTarget?.kind === "generic-card"
              ? (
                  selectedNode?.data.content.cards as
                    | InstagramGenericCard[]
                    | undefined
                )?.[mediaPickerTarget.cardIndex]?.mediaId
              : undefined
        }
      />
      <FlowDiagramPreviewDialog
        open={flowPreviewOpen}
        onOpenChange={setFlowPreviewOpen}
        title={`${selectedCanvas?.name || "Instagram flow"} preview`}
        platform="Instagram"
        nodes={nodes}
        edges={edges}
      />
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

export default function InstagramIndexPage() {
  return <InstagramPage />;
}
