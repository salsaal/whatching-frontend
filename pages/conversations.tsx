"use client";

import {
  Bot,
  CheckCheck,
  Clock3,
  FileText,
  ImageIcon,
  Inbox,
  Instagram,
  Loader2,
  MessageCircle,
  MessageSquareReply,
  Paperclip,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  X
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  ElementType,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

import {
  assignConversation,
  getChatBootstrap,
  getConversationContext,
  getConversationMessages,
  getConversations,
  markConversationRead,
  sendConversationReply,
  sendTemplateMessage,
  updateConversationStatus
} from "@/api/functions/chat";
import { getTeam } from "@/api/functions/organizations";
import { updateSubscriber } from "@/api/functions/subscribers";
import { getAllTemplates } from "@/api/functions/templates";
import {
  ChatMessage,
  Conversation,
  ConversationChannel,
  ConversationMessagesResponse,
  ConversationMode,
  ConversationStatus,
  TemplateSendComponent
} from "@/api/types/chat.type";
import { FaWhatsapp } from "react-icons/fa";
import { MediaAsset } from "@/api/types/media.type";
import {
  MessageTemplate,
  TemplateComponent
} from "@/api/types/templates.type";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";

const statusOptions: Array<{ value: ConversationStatus | "all"; label: string }> =
  [
    { value: "all", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "pending", label: "Pending" },
    { value: "resolved", label: "Resolved" }
  ];

const modeOptions: Array<{ value: ConversationMode | "all"; label: string }> = [
  { value: "all", label: "All modes" },
  { value: "interactive", label: "Bot flow" },
  { value: "ai_fallback", label: "AI fallback" },
  { value: "agent_manual", label: "Agent manual" }
];

const channelOptions: Array<{
  value: ConversationChannel | "all";
  label: string;
  icon: ElementType;
}> = [
  { value: "all", label: "All", icon: Inbox },
  { value: "whatsapp", label: "WhatsApp", icon: FaWhatsapp },
  { value: "instagram", label: "Instagram", icon: Instagram }
];

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value))
    : "-";

const initials = (name?: string) =>
  (name || "C")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const subscriberName = (conversation?: Conversation | null) => {
  const subscriber = conversation?.subscriberId;
  const name = [subscriber?.firstName, subscriber?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || subscriber?.phoneNumber || subscriber?.waId || "Customer";
};

type MessageMediaPreview = {
  type: "image" | "video" | "document";
  url: string;
  name: string;
  caption?: string;
};

type TemplateVariable = {
  key: string;
  label: string;
};

type TemplateMediaHeaderComponent = TemplateComponent & {
  format: "IMAGE" | "VIDEO" | "DOCUMENT";
};

const getTemplateComponent = (
  template: MessageTemplate | null | undefined,
  type: TemplateComponent["type"]
) => template?.components.find((component) => component.type === type) || null;

const extractTemplateVariables = (
  template: MessageTemplate | null | undefined
): TemplateVariable[] => {
  const bodyText = getTemplateComponent(template, "BODY")?.text || "";
  const seen = new Set<string>();
  const variables: TemplateVariable[] = [];

  for (const match of bodyText.matchAll(/{{\s*([^}]+?)\s*}}/g)) {
    const key = match[1].trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    variables.push({ key, label: `{{${key}}}` });
  }

  return variables;
};

const getTemplateQuickReplyButtons = (template: MessageTemplate | null) => {
  const buttonComponent = getTemplateComponent(template, "BUTTONS");
  return (buttonComponent?.buttons || [])
    .map((button, index) => ({ button, index }))
    .filter(({ button }) => button.type === "QUICK_REPLY");
};

const getTemplateMediaHeader = (
  template: MessageTemplate | null
): TemplateMediaHeaderComponent | null => {
  const header = getTemplateComponent(template, "HEADER");
  if (
    header?.format === "IMAGE" ||
    header?.format === "VIDEO" ||
    header?.format === "DOCUMENT"
  ) {
    return header as TemplateMediaHeaderComponent;
  }
  return null;
};

const buildTemplateComponents = ({
  template,
  variables,
  buttonPayloads,
  headerMedia
}: {
  template: MessageTemplate;
  variables: Record<string, string>;
  buttonPayloads: Record<string, string>;
  headerMedia: MediaAsset | null;
}): TemplateSendComponent[] => {
  const components: TemplateSendComponent[] = [];
  const mediaHeader = getTemplateMediaHeader(template);

  if (mediaHeader && headerMedia?.cloudinaryUrl) {
    const mediaType = mediaHeader.format.toLowerCase();
    components.push({
      type: "header",
      parameters: [
        {
          type: mediaType,
          [mediaType]: { link: headerMedia.cloudinaryUrl }
        }
      ]
    });
  }

  const bodyVariables = extractTemplateVariables(template);
  if (bodyVariables.length) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((variable) => ({
        type: "text",
        text: variables[variable.key]?.trim() || ""
      }))
    });
  }

  getTemplateQuickReplyButtons(template).forEach(({ index }) => {
    const payload = buttonPayloads[String(index)]?.trim();
    if (!payload) return;
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index,
      parameters: [{ type: "payload", payload }]
    });
  });

  return components;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getMessageMetaId = (message: ChatMessage) =>
  getString(message.metaMessageId, message.payload?.metaMessageId);

const getReplyContext = (message: ChatMessage) => {
  const payloadContext = asRecord(message.payload?.replyContext);
  const messageContext = asRecord(message.replyContext);
  const messageId = getString(
    messageContext.messageId,
    payloadContext.messageId,
    payloadContext.message_id
  );
  const metaMessageId = getString(
    messageContext.metaMessageId,
    payloadContext.metaMessageId,
    payloadContext.message_id,
    payloadContext.id
  );
  const previewText = getString(
    messageContext.previewText,
    payloadContext.previewText,
    payloadContext.text,
    payloadContext.body
  );

  if (!messageId && !metaMessageId && !previewText) return null;
  return {
    messageId: messageId || null,
    metaMessageId: metaMessageId || null,
    previewText: previewText || null
  };
};

type ReplyContext = NonNullable<ReturnType<typeof getReplyContext>>;

const getMetaMediaUrl = (value: unknown) => {
  const media = asRecord(value);
  return getString(
    media.link,
    media.url,
    media.mediaUrl,
    media.cloudinaryUrl,
    media.proxyUrl,
    media.downloadUrl,
    media.signedUrl,
    media.permalink
  );
};

const getMetaMediaName = (value: unknown, fallback: string) => {
  const media = asRecord(value);
  return getString(media.filename, media.name, media.id, fallback);
};

const messageText = (message: ChatMessage) => {
  if (message.systemEvent?.message) return message.systemEvent.message;
  const payload = message.payload || {};
  const text = payload.text;
  const caption = payload.caption;
  if (typeof text === "string" && text.trim()) return text;
  if (typeof caption === "string" && caption.trim()) return caption;
  if (message.interactive?.replyTitle) return message.interactive.replyTitle;
  if (message.type === "template") {
    const templateName =
      typeof payload.templateName === "string"
        ? payload.templateName
        : message.templateId || "message";
    return `Template: ${templateName}`;
  }
  if (message.type === "interactive") {
    const interactive = payload.interactive as
      | {
          type?: string;
          body?: { text?: string };
          header?: { text?: string };
          footer?: { text?: string };
          action?: unknown;
        }
      | undefined;
    return (
      interactive?.body?.text ||
      interactive?.header?.text ||
      [
        message.interactive?.interactiveType || payload.interactiveType,
        message.interactive?.replyTitle || payload.interactiveReplyTitle,
        message.interactive?.replyId || payload.interactiveReplyId
      ]
        .filter((item) => typeof item === "string" && item.trim())
        .join(" · ") ||
      "Interactive message"
    );
  }
  if (typeof text === "object" && text) {
    const candidate = text as Record<string, unknown>;
    if (typeof candidate.body === "string") return candidate.body;
    if (typeof candidate.text === "string") return candidate.text;
  }
  if (message.attachment?.filename) return message.attachment.filename;
  if (message.type === "image") return "Image";
  if (message.type === "video") return "Video";
  if (message.type === "audio") return "Audio";
  if (message.type === "document") return message.attachment?.filename || "Document";
  if (payload.location) return "Shared a location";
  return String(message.displayType || message.type || "Message");
};

const getMessageMedia = (message: ChatMessage): MessageMediaPreview[] => {
  const payload = message.payload || {};
  const previews: MessageMediaPreview[] = [];
  const addPreview = (
    type: MessageMediaPreview["type"],
    source: unknown,
    fallbackName: string,
    fallbackCaption?: unknown
  ) => {
    const url = getMetaMediaUrl(source);
    if (!url) return;
    const sourceRecord = asRecord(source);
    previews.push({
      type,
      url,
      name: getMetaMediaName(source, fallbackName),
      caption: getString(sourceRecord.caption, fallbackCaption)
    });
  };

  if (message.attachment?.mediaUrl) {
    previews.push({
      type:
        message.type === "video"
          ? "video"
          : message.type === "document" || message.type === "audio"
            ? "document"
            : "image",
      url: message.attachment.mediaUrl,
      name: message.attachment.filename || `${message.type} attachment`,
      caption: getString(payload.caption)
    });
  }

  addPreview(message.type === "video" ? "video" : "image", payload, "Media");
  addPreview("image", payload.image, "Image", payload.caption);
  addPreview("video", payload.video, "Video", payload.caption);
  addPreview("document", payload.document, "Document", payload.caption);
  addPreview("image", payload.instagramImage, "Instagram image", payload.caption);
  addPreview("video", payload.instagramVideo, "Instagram video", payload.caption);
  addPreview("image", payload.media, "Media", payload.caption);
  addPreview("image", payload.mediaData, "Media", payload.caption);
  addPreview("image", payload.attachment, "Attachment", payload.caption);
  addPreview("image", payload.headerImage, "Image", payload.caption);

  const interactive = asRecord(payload.interactive);
  const header = asRecord(interactive.header);
  const headerType = getString(header.type);
  if (headerType === "image") addPreview("image", header.image, "Image");
  if (headerType === "video") addPreview("video", header.video, "Video");
  if (headerType === "document") {
    addPreview("document", header.document, "Document");
  }

  const action = asRecord(interactive.action);
  const cards = Array.isArray(action.cards) ? action.cards : [];
  cards.forEach((card, index) => {
    const cardRecord = asRecord(card);
    const cardHeader = asRecord(cardRecord.header);
    const cardBody = asRecord(cardRecord.body);
    const type = getString(cardHeader.type);
    if (type === "image") {
      addPreview(
        "image",
        cardHeader.image,
        `Carousel image ${index + 1}`,
        cardBody.text
      );
    }
    if (type === "video") {
      addPreview(
        "video",
        cardHeader.video,
        `Carousel video ${index + 1}`,
        cardBody.text
      );
    }
  });

  const seen = new Set<string>();
  return previews.filter((preview) => {
    if (seen.has(preview.url)) return false;
    seen.add(preview.url);
    return true;
  });
};

const getAttachmentName = (message: ChatMessage) => {
  const firstMedia = getMessageMedia(message)[0];
  return (
    firstMedia?.name ||
    message.attachment?.filename ||
    getString(message.payload?.filename, message.payload?.originalFilename) ||
    `${message.type} attachment`
  );
};

const getInteractiveActions = (message: ChatMessage) => {
  const interactive = message.payload?.interactive as
    | {
        action?: {
          buttons?: Array<{
            reply?: { title?: string; id?: string };
            title?: string;
            type?: string;
          }>;
          sections?: Array<{
            title?: string;
            rows?: Array<{ title?: string; id?: string; description?: string }>;
          }>;
        };
      }
    | undefined;
  const buttons =
    interactive?.action?.buttons?.map(
      (button) => button.reply?.title || button.title || button.reply?.id
    ) || [];
  const rows =
    interactive?.action?.sections?.flatMap((section) =>
      (section.rows || []).map((row) => row.title || row.id)
    ) || [];
  return [...buttons, ...rows].filter(Boolean) as string[];
};

const statusClass: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  pending: "bg-amber-50 text-amber-700",
  resolved: "bg-primary/10 text-primary"
};

const priorityClass: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  normal: "bg-muted text-muted-foreground",
  low: "bg-slate-100 text-slate-600"
};

const takeoverSourceLabel: Record<string, string> = {
  dashboard: "Dashboard",
  whatsapp_business_app: "WhatsApp Business app",
  instagram_app: "Instagram app",
  automation_handoff: "Automation handoff"
};

const canReplyToMessage = (message: ChatMessage) =>
  message.direction !== "system" &&
  message.senderRole !== "system" &&
  message.status !== "failed" &&
  Boolean(getMessageMetaId(message));

function ConversationListItem({
  conversation,
  selected,
  onSelect
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = subscriberName(conversation);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer gap-2.5 border-b p-2.5 text-left transition hover:bg-muted/50",
        selected && "bg-primary/5"
      )}
    >
      <Avatar className="size-9">
        <AvatarFallback className="bg-primary/10 text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatDateTime(conversation.lastMessageAt || conversation.updatedAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {conversation.lastMessage || "No messages yet"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Badge className={cn("px-1.5 py-0 text-[10px] capitalize", statusClass[conversation.status])}>
            {conversation.status}
          </Badge>
          <Badge
            variant="secondary"
            className={cn("px-1.5 py-0 text-[10px] capitalize", priorityClass[conversation.priority])}
          >
            {conversation.priority}
          </Badge>
          {conversation.unreadCount > 0 && (
            <Badge className="px-1.5 py-0 text-[10px]">{conversation.unreadCount}</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({
  message,
  onPreview,
  onReplyTo,
  replyContext,
  replyPreview
}: {
  message: ChatMessage;
  onPreview: (preview: MessageMediaPreview) => void;
  onReplyTo: (message: ChatMessage) => void;
  replyContext?: ReplyContext | null;
  replyPreview?: ChatMessage | null;
}) {
  const isOutbound = message.direction === "outbound";
  const isSystem = message.direction === "system" || message.senderRole === "system";
  const attachmentName = getAttachmentName(message);
  const mediaPreviews = getMessageMedia(message);
  const imageVideoPreviews = mediaPreviews.filter((item) =>
    ["image", "video"].includes(item.type)
  );
  const documentPreviews = mediaPreviews.filter(
    (item) => item.type === "document"
  );
  const interactiveActions = getInteractiveActions(message);
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-md rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
          {messageText(message)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2",
        isOutbound ? "justify-end" : "justify-start"
      )}
      onDoubleClick={() => {
        if (canReplyToMessage(message)) onReplyTo(message);
      }}
    >
      {!isOutbound && canReplyToMessage(message) && (
        <button
          type="button"
          className="order-2 flex size-8 cursor-pointer items-center justify-center rounded-full border bg-white text-muted-foreground opacity-0 shadow-sm transition hover:text-primary group-hover:opacity-100"
          onClick={() => onReplyTo(message)}
          title="Reply"
        >
          <MessageSquareReply className="size-4" />
        </button>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-xs",
          isOutbound
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-white"
        )}
      >
        {imageVideoPreviews.length > 0 && (
          <div
            className={cn(
              "mb-2 grid gap-2",
              imageVideoPreviews.length > 1 && "grid-cols-2"
            )}
          >
            {imageVideoPreviews.map((preview) => (
              <button
                key={preview.url}
                type="button"
                onClick={() => onPreview(preview)}
                className="group relative cursor-pointer overflow-hidden rounded-lg bg-black/5 text-left"
              >
                {preview.type === "image" ? (
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="max-h-64 w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <video
                    src={preview.url}
                    className="max-h-64 w-full object-cover"
                    muted
                    playsInline
                  />
                )}
                <span className="absolute inset-x-2 bottom-2 rounded-md bg-black/55 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  Preview
                </span>
              </button>
            ))}
          </div>
        )}
        {replyContext && (
          <div
            className={cn(
              "mb-2 rounded-lg border-l-2 px-2 py-1 text-xs",
              isOutbound
                ? "border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground/80"
                : "border-primary bg-muted text-muted-foreground"
            )}
          >
            <p className="font-medium">
              Reply to {replyPreview ? messageText(replyPreview) : "message"}
            </p>
            {replyPreview ? (
              <p className="mt-0.5 line-clamp-2 opacity-80">
                {getAttachmentName(replyPreview)}
              </p>
            ) : (
              <p className="mt-0.5 opacity-80">
                {replyContext.previewText ||
                  (replyContext.messageId
                    ? `Message ${replyContext.messageId.slice(-6)}`
                    : "WhatsApp message")}
              </p>
            )}
          </div>
        )}
        {documentPreviews.map((preview) => (
          <a
            key={preview.url}
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            className="mb-2 flex items-center gap-2 rounded-lg bg-black/5 p-2"
          >
            <FileText className="size-4" />
            <span className="truncate">{preview.name || attachmentName}</span>
          </a>
        ))}
        <p className="whitespace-pre-wrap break-words">{messageText(message)}</p>
        {interactiveActions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {interactiveActions.map((action) => (
              <span
                key={action}
                className={cn(
                  "rounded-full border px-2 py-1 text-xs",
                  isOutbound
                    ? "border-primary-foreground/30 text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {action}
              </span>
            ))}
          </div>
        )}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            isOutbound ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {formatDateTime(message.createdAt || message.sentAt)}
          {isOutbound && <CheckCheck className="size-3" />}
        </div>
      </div>
      {isOutbound && canReplyToMessage(message) && (
        <button
          type="button"
          className="order-first flex size-8 cursor-pointer items-center justify-center rounded-full border bg-white text-muted-foreground opacity-0 shadow-sm transition hover:text-primary group-hover:opacity-100"
          onClick={() => onReplyTo(message)}
          title="Reply"
        >
          <MessageSquareReply className="size-4" />
        </button>
      )}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-14 w-2/3 rounded-2xl" />
      <Skeleton className="ml-auto h-16 w-1/2 rounded-2xl" />
      <Skeleton className="h-20 w-3/4 rounded-2xl" />
    </div>
  );
}

export default function ConversationsPage() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedIdRef = useRef("");
  const socketRef = useRef<Socket | null>(null);
  const joinedConversationRef = useRef("");
  const replyContextCacheRef = useRef<Record<string, ReplyContext>>({});
  const realtimeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ConversationStatus | "all">("all");
  const [channel, setChannel] = useState<ConversationChannel | "all">("all");
  const [mode, setMode] = useState<ConversationMode | "all">("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pendingEscalation, setPendingEscalation] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MessageMediaPreview | null>(
    null
  );
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateMediaPickerOpen, setTemplateMediaPickerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, string>
  >({});
  const [templateButtonPayloads, setTemplateButtonPayloads] = useState<
    Record<string, string>
  >({});
  const [templateHeaderMedia, setTemplateHeaderMedia] =
    useState<MediaAsset | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");

  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      status,
      mode,
      assignedTo: assignedTo === "all" ? undefined : assignedTo,
      unreadOnly,
      pendingEscalation
    }),
    [
      page,
      search,
      status,
      mode,
      assignedTo,
      unreadOnly,
      pendingEscalation
    ]
  );

  const { data: bootstrap } = useQuery({
    queryKey: ["chat-bootstrap", activeOrganization?._id],
    queryFn: getChatBootstrap,
    enabled: Boolean(activeOrganization?._id),
    refetchOnMount: "always"
  });

  const { data: teamData } = useQuery({
    queryKey: ["team", activeOrganization?._id],
    queryFn: getTeam,
    enabled: Boolean(activeOrganization?._id)
  });

  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ["conversation-templates", activeOrganization?._id],
    queryFn: getAllTemplates,
    enabled: Boolean(activeOrganization?._id && isTemplateModalOpen)
  });

  const {
    data: conversationsData,
    isLoading: isConversationsLoading
  } = useQuery({
    queryKey: ["conversations", activeOrganization?._id, queryParams],
    queryFn: () => getConversations(queryParams),
    enabled: Boolean(activeOrganization?._id),
    staleTime: 30_000
  });

  const conversations = useMemo(
    () => conversationsData?.data.conversations || [],
    [conversationsData]
  );
  const visibleConversations = useMemo(
    () =>
      channel === "all"
        ? conversations
        : conversations.filter((conversation) => conversation.channel === channel),
    [channel, conversations]
  );
  const selectedConversation =
    visibleConversations.find((conversation) => conversation._id === selectedId) ||
    null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!visibleConversations.some((conversation) => conversation._id === selectedId)) {
      setSelectedId(visibleConversations[0]?._id || "");
    }
  }, [selectedId, visibleConversations]);

  const { data: messagesData, isLoading: isMessagesLoading } = useQuery({
    queryKey: ["conversation-messages", activeOrganization?._id, selectedId],
    queryFn: () => getConversationMessages({ conversationId: selectedId }),
    enabled: Boolean(activeOrganization?._id && selectedId),
    staleTime: 15_000
  });

  const { data: contextData } = useQuery({
    queryKey: ["conversation-context", activeOrganization?._id, selectedId],
    queryFn: () => getConversationContext(selectedId),
    enabled: Boolean(activeOrganization?._id && selectedId)
  });

  const invalidateConversations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation-context"] }),
      queryClient.invalidateQueries({ queryKey: ["chat-bootstrap"] })
    ]);
  };

  useEffect(() => {
    const orgId = activeOrganization?._id;
    const authToken =
      token ||
      (typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!orgId || !authToken || !apiBase) return;

    const socketBase = apiBase.replace(/\/api\/v1\/?$/, "");
    const socket: Socket = io(socketBase, {
      auth: { token: authToken },
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    const scheduleRealtimeRefresh = (
      conversationId?: string,
      options: { messages?: boolean; context?: boolean } = {}
    ) => {
      const key = conversationId || "list";
      if (realtimeTimersRef.current[key]) {
        clearTimeout(realtimeTimersRef.current[key]);
      }
      realtimeTimersRef.current[key] = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["chat-bootstrap"] });
        if (conversationId && conversationId === selectedIdRef.current) {
          if (options.messages !== false) {
            queryClient.invalidateQueries({
              queryKey: ["conversation-messages", orgId, conversationId]
            });
          }
          if (options.context) {
            queryClient.invalidateQueries({
              queryKey: ["conversation-context", orgId, conversationId]
            });
          }
        }
        delete realtimeTimersRef.current[key];
      }, 300);
    };

    socket.on("connect", () => {
      socket.emit("org:join", { orgId });
      if (selectedIdRef.current) {
        socket.emit("conversation:join", {
          orgId,
          conversationId: selectedIdRef.current
        });
        joinedConversationRef.current = selectedIdRef.current;
      }
    });
    socket.on("conversation.updated", (payload: { conversation?: Conversation }) =>
      scheduleRealtimeRefresh(payload.conversation?._id, {
        messages: true,
        context: true
      })
    );
    socket.on("conversation.read", (payload: { conversationId?: string }) =>
      scheduleRealtimeRefresh(payload.conversationId, {
        messages: false,
        context: true
      })
    );
    socket.on("conversation.escalated", (payload: { conversation?: Conversation }) =>
      scheduleRealtimeRefresh(payload.conversation?._id, { context: true })
    );
    socket.on(
      "conversation.agent_takeover",
      (payload: { conversation?: Conversation }) =>
        scheduleRealtimeRefresh(payload.conversation?._id, { context: true })
    );
    socket.on("conversation.bot_resumed", (payload: { conversation?: Conversation }) =>
      scheduleRealtimeRefresh(payload.conversation?._id, { context: true })
    );
    socket.on(
      "message.created",
      (payload: { conversationId?: string; message?: ChatMessage }) => {
        const incomingMessage = payload.message;
        if (payload.conversationId && incomingMessage) {
          queryClient.setQueryData<ConversationMessagesResponse>(
            ["conversation-messages", orgId, payload.conversationId],
            (current) => {
              if (!current) return current;
              if (
                current.data.messages.some(
                  (message) => message._id === incomingMessage._id
                )
              ) {
                return current;
              }
              return {
                ...current,
                results: current.results + 1,
                data: {
                  ...current.data,
                  messages: [...current.data.messages, incomingMessage]
                }
              };
            }
          );
        }
        scheduleRealtimeRefresh(payload.conversationId, { messages: true });
      }
    );
    socket.on("message.updated", (payload: { conversationId?: string }) =>
      scheduleRealtimeRefresh(payload.conversationId, { messages: true })
    );
    socket.on("socket.error", (payload: { message?: string }) => {
      if (payload.message) toast.error(payload.message);
    });

    return () => {
      Object.values(realtimeTimersRef.current).forEach(clearTimeout);
      realtimeTimersRef.current = {};
      socketRef.current = null;
      socket.disconnect();
    };
  }, [activeOrganization?._id, queryClient, token]);

  useEffect(() => {
    const orgId = activeOrganization?._id;
    const socket = socketRef.current;
    if (!orgId || !socket) return;
    if (joinedConversationRef.current) {
      socket.emit("conversation:leave", {
        orgId,
        conversationId: joinedConversationRef.current
      });
      joinedConversationRef.current = "";
    }
    if (selectedId) {
      socket.emit("conversation:join", { orgId, conversationId: selectedId });
      joinedConversationRef.current = selectedId;
      queryClient.invalidateQueries({
        queryKey: ["conversation-messages", orgId, selectedId]
      });
    }
  }, [activeOrganization?._id, queryClient, selectedId]);

  const { mutate: markRead } = useMutation({
    mutationFn: markConversationRead,
    onSuccess: invalidateConversations
  });

  useEffect(() => {
    if (selectedConversation && selectedConversation.unreadCount > 0) {
      markRead(selectedConversation._id);
    }
  }, [markRead, selectedConversation]);

  const { mutate: assignMutate, isPending: isAssigning } = useMutation({
    mutationFn: assignConversation,
    onSuccess: async () => {
      toast.success("Conversation assignment updated.");
      await invalidateConversations();
    }
  });

  const { mutate: updateStatusMutate, isPending: isUpdatingStatus } =
    useMutation({
      mutationFn: updateConversationStatus,
      onSuccess: async () => {
        toast.success("Conversation status updated.");
        await invalidateConversations();
      }
    });

  const { mutate: updateContactMutate, isPending: isUpdatingContact } =
    useMutation({
      mutationFn: updateSubscriber,
      onSuccess: async () => {
        toast.success("Contact name updated.");
        await invalidateConversations();
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        toast.error(error.response?.data?.message || "Contact could not be updated.");
      }
    });

  const { mutate: sendReply, isPending: isSending } = useMutation({
    mutationFn: sendConversationReply,
    onSuccess: async () => {
      setReplyText("");
      setReplyTarget(null);
      setAttachment(null);
      setSelectedMedia(null);
      toast.success("Reply queued.");
      await invalidateConversations();
    }
  });

  const { mutate: sendTemplateMutate, isPending: isSendingTemplate } =
    useMutation({
      mutationFn: sendTemplateMessage,
      onSuccess: async () => {
        setIsTemplateModalOpen(false);
        setSelectedTemplateId("");
        setTemplateVariables({});
        setTemplateButtonPayloads({});
        setTemplateHeaderMedia(null);
        toast.success("Template queued for delivery.");
        await invalidateConversations();
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        toast.error(error.response?.data?.message || "Template could not be sent.");
      }
    });

  const team = teamData?.data.team || [];
  const assigneeOptions = team.filter((member) => member.status === "active");
  const approvedTemplates = useMemo(
    () =>
      (templatesData?.data.templates || []).filter(
        (template) => template.status?.toUpperCase?.() === "APPROVED"
      ),
    [templatesData]
  );
  const selectedTemplate =
    approvedTemplates.find((template) => template._id === selectedTemplateId) ||
    null;
  const selectedTemplateBody = getTemplateComponent(selectedTemplate, "BODY");
  const selectedTemplateFooter = getTemplateComponent(selectedTemplate, "FOOTER");
  const selectedTemplateButtons = getTemplateComponent(
    selectedTemplate,
    "BUTTONS"
  )?.buttons;
  const selectedTemplateVariables = useMemo(
    () => extractTemplateVariables(selectedTemplate),
    [selectedTemplate]
  );
  const selectedTemplateQuickReplies = useMemo(
    () => getTemplateQuickReplyButtons(selectedTemplate),
    [selectedTemplate]
  );
  const selectedTemplateMediaHeader = getTemplateMediaHeader(selectedTemplate);
  const messages = useMemo(
    () => messagesData?.data.messages || [],
    [messagesData]
  );
  const messagesById = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    const byMetaId = new Map<string, ChatMessage>();
    messages.forEach((message) => {
      byId.set(message._id, message);
      const metaId = getMessageMetaId(message);
      if (metaId) byMetaId.set(metaId, message);
    });
    return { byId, byMetaId };
  }, [messages]);
  useEffect(() => {
    messages.forEach((message) => {
      const replyContext = getReplyContext(message);
      if (replyContext) replyContextCacheRef.current[message._id] = replyContext;
    });
  }, [messages]);
  const contextConversation = contextData?.data.conversation || selectedConversation;
  const replyWindow = contextConversation?.replyWindow;
  const canReply = Boolean(replyWindow?.isOpen && selectedId);
  const isInstagramConversation = contextConversation?.channel === "instagram";
  const canSendMediaReply = canReply;
  const canSendTemplate = contextConversation?.channel === "whatsapp";
  const summary = conversationsData?.data.summary || bootstrap?.data.sidebar;
  const templateRecipientPhone =
    contextConversation?.subscriberId?.phoneNumber ||
    contextConversation?.subscriberId?.waId ||
    "";

  useEffect(() => {
    const subscriber = contextData?.data.subscriber || contextConversation?.subscriberId;
    setContactFirstName(subscriber?.firstName || "");
    setContactLastName(subscriber?.lastName || "");
  }, [
    contextConversation?.subscriberId,
    contextData?.data.subscriber,
    selectedId
  ]);

  const saveContactName = () => {
    const subscriberId =
      contextData?.data.subscriber?._id || contextConversation?.subscriberId?._id;
    if (!subscriberId) {
      toast.error("Subscriber record is not loaded yet.");
      return;
    }
    updateContactMutate({
      subscriberId,
      payload: {
        firstName: contactFirstName.trim(),
        lastName: contactLastName.trim()
      }
    });
  };

  const submitReply = () => {
    if (!selectedId) return;
    if (!replyText.trim() && !attachment && !selectedMedia) {
      toast.error("Type a reply, attach a file, or choose media.");
      return;
    }
    sendReply({
      conversationId: selectedId,
      payload: {
        text: replyText.trim(),
        caption: attachment || selectedMedia ? replyText.trim() : undefined,
        mediaId: selectedMedia?._id,
        attachment,
        replyToMessageId: replyTarget?._id
      }
    });
  };

  const handleReply = (event: FormEvent) => {
    event.preventDefault();
    submitReply();
  };

  const handleAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setAttachment(file);
    if (file) setSelectedMedia(null);
    if (file) requestAnimationFrame(() => replyInputRef.current?.focus());
  };

  const attachFile = (file?: File | null) => {
    if (!file) return;
    setAttachment(file);
    setSelectedMedia(null);
    requestAnimationFrame(() => replyInputRef.current?.focus());
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    if (!canSendMediaReply || isSending) return;
    attachFile(event.dataTransfer.files?.[0]);
  };

  const handleReplyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitReply();
  };

  const selectReplyTarget = (message: ChatMessage) => {
    setReplyTarget(message);
    requestAnimationFrame(() => replyInputRef.current?.focus());
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setTemplateVariables({});
    setTemplateButtonPayloads({});
    setTemplateHeaderMedia(null);
  };

  const submitTemplate = () => {
    if (!selectedTemplate) {
      toast.error("Select an approved template first.");
      return;
    }

    if (!templateRecipientPhone) {
      toast.error("This conversation does not have a phone number.");
      return;
    }

    const missingVariable = selectedTemplateVariables.find(
      (variable) => !templateVariables[variable.key]?.trim()
    );
    if (missingVariable) {
      toast.error(`Fill ${missingVariable.label} before sending.`);
      return;
    }

    if (selectedTemplateMediaHeader && !templateHeaderMedia) {
      toast.error(
        `Select a ${selectedTemplateMediaHeader.format.toLowerCase()} for this template header.`
      );
      return;
    }

    sendTemplateMutate({
      phoneNumber: templateRecipientPhone,
      templateName: selectedTemplate.name,
      languageCode: selectedTemplate.language || "en_US",
      components: buildTemplateComponents({
        template: selectedTemplate,
        variables: templateVariables,
        buttonPayloads: templateButtonPayloads,
        headerMedia: templateHeaderMedia
      })
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedId]);

  useEffect(() => {
    setReplyTarget(null);
    setAttachment(null);
    setSelectedMedia(null);
  }, [selectedId]);

  useEffect(() => {
    if (!attachment || !attachment.type.startsWith("image/")) {
      setAttachmentPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(attachment);
    setAttachmentPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  return (
    <AppLayout hideHeader fullBleed>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden p-3">
        <section className="mb-3 grid shrink-0 gap-3 md:grid-cols-5">
          {[
            ["Total", summary?.total || 0, Inbox],
            ["Open", summary?.open || 0, MessageCircle],
            ["Pending", summary?.pending || 0, Clock3],
            ["Unread", summary?.unread || 0, ShieldAlert],
            ["Manual", conversationsData?.data.summary.agentManual || 0, UserCheck]
          ].map(([label, value, Icon]) => {
            const StatIcon = Icon as typeof Inbox;
            return (
              <div key={String(label)} className="rounded-lg bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{String(label)}</p>
                  <StatIcon className="size-4 text-primary" />
                </div>
                <p className="mt-2 font-heading text-2xl font-semibold">
                  {String(value)}
                </p>
              </div>
            );
          })}
        </section>

        <section className="grid min-h-0 flex-1 overflow-hidden rounded-xl bg-white shadow-xs xl:grid-cols-[360px_1fr_340px]">
          <aside className="flex min-h-0 flex-col border-r">
            <div className="border-b p-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  value={search}
                  placeholder="Search name or phone"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {channelOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setChannel(option.value);
                        setPage(1);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition",
                        channel === option.value &&
                          "bg-white text-foreground shadow-xs"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as ConversationStatus | "all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select
                  value={mode}
                  onValueChange={(value) => {
                    setMode(value as ConversationMode | "all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={assignedTo}
                  onValueChange={(value) => {
                    setAssignedTo(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {assigneeOptions.map((member) => (
                      <SelectItem key={member.userId._id} value={member.userId._id}>
                        {member.userId.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={unreadOnly ? "default" : "outline"}
                  onClick={() => {
                    setUnreadOnly((value) => !value);
                    setPage(1);
                  }}
                >
                  Unread
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pendingEscalation ? "default" : "outline"}
                  onClick={() => {
                    setPendingEscalation((value) => !value);
                    setPage(1);
                  }}
                >
                  Escalations
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isConversationsLoading ? (
                <div className="space-y-3 p-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : visibleConversations.length ? (
                visibleConversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation._id}
                    conversation={conversation}
                    selected={conversation._id === selectedId}
                    onSelect={() => setSelectedId(conversation._id)}
                  />
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No conversations match these filters.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t p-3 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {conversationsData?.pagination.page || page} /{" "}
                {conversationsData?.pagination.totalPages || 1}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  (conversationsData?.pagination.page || page) >=
                  (conversationsData?.pagination.totalPages || 1)
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:22px_22px]">
            {contextConversation ? (
              <>
                <div className="flex items-center justify-between border-b bg-white/95 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {initials(subscriberName(contextConversation))}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">
                        {subscriberName(contextConversation)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contextConversation.subscriberId?.phoneNumber ||
                          contextConversation.subscriberId?.waId ||
                          contextConversation.channel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "capitalize",
                        statusClass[contextConversation.status]
                      )}
                    >
                      {contextConversation.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {contextConversation.mode.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {isMessagesLoading ? (
                    <ThreadSkeleton />
                  ) : messages.length ? (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        (() => {
                          const replyContext =
                            getReplyContext(message) ||
                            replyContextCacheRef.current[message._id] ||
                            null;
                          return (
                            <MessageBubble
                              key={message._id}
                              message={message}
                              onPreview={setPreviewMedia}
                              onReplyTo={selectReplyTarget}
                              replyContext={replyContext}
                              replyPreview={
                                (replyContext?.messageId
                                  ? messagesById.byId.get(replyContext.messageId)
                                  : null) ||
                                (replyContext?.metaMessageId
                                  ? messagesById.byMetaId.get(
                                      replyContext.metaMessageId
                                    )
                                  : null) ||
                                null
                              }
                            />
                          );
                        })()
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No messages in this conversation yet.
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleReply}
	                  onDragEnter={(event) => {
	                    event.preventDefault();
	                    if (canSendMediaReply) setIsDraggingFile(true);
	                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setIsDraggingFile(false);
                    }
                  }}
                  onDrop={handleDrop}
                  className={cn(
                    "relative border-t bg-white/95 p-3 transition",
                    isDraggingFile && "bg-primary/5 ring-2 ring-inset ring-primary/30"
                  )}
                >
                  {isDraggingFile && (
                    <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border border-dashed border-primary bg-white/80 text-sm font-medium text-primary">
                      Drop file to attach
                    </div>
                  )}
	                  {!canReply && (
	                    <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
	                      {isInstagramConversation
	                        ? "The 24-hour customer service window is closed for this Instagram conversation."
	                        : "The 24-hour customer service window is closed. Send an approved template to re-open chat."}
	                    </div>
	                  )}
                  {(attachment || selectedMedia) && (
                    <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        {attachmentPreviewUrl ? (
                          <img
                            src={attachmentPreviewUrl}
                            alt={attachment?.name || "Attachment preview"}
                            className="size-12 rounded-md object-cover"
                          />
                        ) : selectedMedia?.fileType === "image" ? (
                          <img
                            src={selectedMedia.cloudinaryUrl}
                            alt={selectedMedia.name}
                            className="size-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex size-12 items-center justify-center rounded-md bg-white">
                            <FileText className="size-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {attachment?.name || selectedMedia?.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {attachment?.type || selectedMedia?.fileType || "File"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachment(null);
                          setSelectedMedia(null);
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                  {replyTarget && (
                    <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-1 font-medium text-primary">
                          <MessageSquareReply className="size-4" />
                          Replying to {subscriberName(contextConversation)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">
                          {messageText(replyTarget)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                        onClick={() => setReplyTarget(null)}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border hover:bg-muted">
                      <Paperclip className="size-4" />
                      <input
                        type="file"
                        className="hidden"
	                        disabled={!canSendMediaReply || isSending}
	                        onChange={handleAttachment}
	                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-10 shrink-0 rounded-full p-0"
	                      disabled={!canSendMediaReply || isSending}
	                      onClick={() => setIsMediaPickerOpen(true)}
                    >
                      <ImageIcon className="size-4" />
                    </Button>
	                    {canSendTemplate && (
	                      <Button
	                        type="button"
	                        variant="outline"
	                        className="h-10 shrink-0 rounded-full px-3"
	                        disabled={!selectedId || isSendingTemplate}
	                        onClick={() => setIsTemplateModalOpen(true)}
	                      >
	                        <FileText className="mr-2 size-4" />
	                        Template
	                      </Button>
	                    )}
	                    <Textarea
	                      ref={replyInputRef}
                      className="max-h-32 min-h-11 resize-none rounded-2xl"
                      value={replyText}
                      disabled={!canReply || isSending}
                      placeholder={
                        attachment ? "Add a caption..." : "Type a reply..."
                      }
                      onChange={(event) => setReplyText(event.target.value)}
                      onKeyDown={handleReplyKeyDown}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="size-11 shrink-0 rounded-full p-0"
                      disabled={!canReply || isSending}
                    >
                      {isSending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-5 translate-x-px" />
                      )}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MessageCircle className="mb-3 size-10 text-primary" />
                Select a conversation to read and reply.
              </div>
            )}
          </main>

          <aside className="hidden min-h-0 flex-col border-l bg-white xl:flex">
            {contextConversation ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="text-center">
                  <Avatar className="mx-auto size-16">
                    <AvatarFallback className="bg-primary/10 text-xl text-primary">
                      {initials(subscriberName(contextConversation))}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="mt-3 font-heading text-xl font-semibold">
                    {subscriberName(contextConversation)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {contextConversation.subscriberId?.phoneNumber ||
                      contextConversation.subscriberId?.waId}
                  </p>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Contact name</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        First name
                      </Label>
                      <Input
                        className="mt-1"
                        value={contactFirstName}
                        placeholder="First name"
                        onChange={(event) =>
                          setContactFirstName(event.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Last name
                      </Label>
                      <Input
                        className="mt-1"
                        value={contactLastName}
                        placeholder="Last name"
                        onChange={(event) =>
                          setContactLastName(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full cursor-pointer"
                    disabled={isUpdatingContact}
                    onClick={saveContactName}
                  >
                    {isUpdatingContact && (
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                    )}
                    Save contact
                  </Button>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Assigned agent
                    </p>
                    <Select
                      value={contextConversation.assignedTo?._id || "unassigned"}
                      disabled={isAssigning}
                      onValueChange={(value) =>
                        assignMutate({
                          conversationId: contextConversation._id,
                          assignedToUserId:
                            value === "unassigned" ? null : value
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {assigneeOptions.map((member) => (
                          <SelectItem
                            key={member.userId._id}
                            value={member.userId._id}
                          >
                            {member.userId.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Status
                    </p>
                    <Select
                      value={contextConversation.status}
                      disabled={isUpdatingStatus}
                      onValueChange={(value) =>
                        updateStatusMutate({
                          conversationId: contextConversation._id,
                          status: value as ConversationStatus
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions
                          .filter((option) => option.value !== "all")
                          .map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid gap-3 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Reply window</p>
                    <p className="mt-1 font-medium">
                      {replyWindow?.isOpen ? "Open" : "Closed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDateTime(replyWindow?.expiresAt)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Bot state</p>
                    <p className="mt-1 font-medium capitalize">
                      {contextConversation.mode.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trigger:{" "}
                      {contextConversation.botState?.activeTriggerKey || "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Handoff</p>
                    <p className="mt-1 font-medium">
                      {contextConversation.takeoverState?.handoffReason ||
                        "No handoff reason"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested{" "}
                      {formatDateTime(
                        contextConversation.takeoverState?.handoffRequestedAt
                      )}
                    </p>
                    <div className="mt-2 rounded-md bg-white px-2 py-1 text-xs">
                      <span className="text-muted-foreground">Manual source: </span>
                      <span className="font-medium">
                        {contextConversation.takeoverState?.manualTakeoverSource
                          ? takeoverSourceLabel[
                              contextConversation.takeoverState
                                .manualTakeoverSource
                            ] ||
                            contextConversation.takeoverState.manualTakeoverSource
                          : "Not in manual takeover"}
                      </span>
                    </div>
                    {contextConversation.takeoverState?.manualTakeoverBy && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        By{" "}
                        {contextConversation.takeoverState.manualTakeoverBy.name}
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <p className="mb-2 text-sm font-semibold">Subscriber</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Opted in</span>
                      <span>
                        {contextData?.data.subscriber?.isOptedIn ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Last inbound</span>
                      <span>
                        {formatDateTime(
                          contextData?.data.subscriber?.lastInboundAt
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(contextData?.data.subscriber?.tags || []).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <p className="mb-2 text-sm font-semibold">Message media</p>
                  <div className="grid gap-2">
                    {(contextData?.data.mediaSummary || []).length ? (
                      contextData?.data.mediaSummary.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                        >
                          <span className="inline-flex items-center gap-2 capitalize">
                            {item._id === "image" ? (
                              <ImageIcon className="size-4" />
                            ) : (
                              <FileText className="size-4" />
                            )}
                            {item._id}
                          </span>
                          <Badge variant="outline">{item.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No media in this conversation.
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="rounded-lg bg-primary/5 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-primary">
                    <Bot className="size-4" />
                    Bot readiness
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Meta: {bootstrap?.data.messaging.metaStatus || "pending"} ·
                    Default flow:{" "}
                    {bootstrap?.data.bot.defaultFlowReady ? "ready" : "missing"}
                  </p>
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Send approved template</DialogTitle>
            <DialogDescription>
              Queue a WhatsApp template to{" "}
              {templateRecipientPhone || "this subscriber"} without creating a
              broadcast.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateChange}
                disabled={isTemplatesLoading || isSendingTemplate}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isTemplatesLoading
                        ? "Loading templates..."
                        : "Select an approved template"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {approvedTemplates.map((template) => (
                    <SelectItem key={template._id} value={template._id}>
                      {template.name} · {template.language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isTemplatesLoading && !approvedTemplates.length && (
                <p className="text-sm text-muted-foreground">
                  No approved templates found. Sync or create templates first.
                </p>
              )}
            </div>

            {selectedTemplate && (
              <>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedTemplate.category}</Badge>
                    <Badge variant="outline">{selectedTemplate.language}</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      Approved
                    </Badge>
                  </div>
                  {selectedTemplateMediaHeader && (
                    <div className="mb-3 rounded-lg bg-white p-3 text-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {selectedTemplateMediaHeader.format} header
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Select media from your media library for this send.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSendingTemplate}
                          onClick={() => setTemplateMediaPickerOpen(true)}
                        >
                          Choose media
                        </Button>
                      </div>
                      {templateHeaderMedia ? (
                        <div className="flex items-center gap-3 rounded-lg bg-muted p-2">
                          {templateHeaderMedia.fileType === "image" ? (
                            <img
                              src={templateHeaderMedia.cloudinaryUrl}
                              alt={templateHeaderMedia.name}
                              className="size-12 rounded-md object-cover"
                            />
                          ) : templateHeaderMedia.fileType === "video" ? (
                            <video
                              src={templateHeaderMedia.cloudinaryUrl}
                              className="size-12 rounded-md object-cover"
                              muted
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center rounded-md bg-white">
                              <FileText className="size-5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {templateHeaderMedia.name}
                            </p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {templateHeaderMedia.fileType}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => setTemplateHeaderMedia(null)}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="space-y-2 rounded-lg bg-white p-3 text-sm">
                    <p className="whitespace-pre-wrap font-medium">
                      {selectedTemplateBody?.text || "No body text configured."}
                    </p>
                    {selectedTemplateFooter?.text && (
                      <p className="border-t pt-2 text-xs text-muted-foreground">
                        {selectedTemplateFooter.text}
                      </p>
                    )}
                    {selectedTemplateButtons?.length ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedTemplateButtons.map((button, index) => (
                          <span
                            key={`${button.text}-${index}`}
                            className="rounded-full border bg-muted px-3 py-1 text-xs font-medium"
                          >
                            {button.text} · {button.type.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedTemplateVariables.length ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Body variables</Label>
                      <p className="text-sm text-muted-foreground">
                        These values fill the template placeholders in order.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedTemplateVariables.map((variable) => (
                        <div key={variable.key} className="space-y-2">
                          <Label>{variable.label}</Label>
                          <Input
                            value={templateVariables[variable.key] || ""}
                            disabled={isSendingTemplate}
                            placeholder={`Value for ${variable.label}`}
                            onChange={(event) =>
                              setTemplateVariables((current) => ({
                                ...current,
                                [variable.key]: event.target.value
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedTemplateQuickReplies.length ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Quick reply payloads</Label>
                      <p className="text-sm text-muted-foreground">
                        Optional payloads are sent when the user taps a quick
                        reply button.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedTemplateQuickReplies.map(({ button, index }) => (
                        <div key={`${button.text}-${index}`} className="space-y-2">
                          <Label>
                            {button.text}{" "}
                            <span className="text-muted-foreground">
                              index {index}
                            </span>
                          </Label>
                          <Input
                            value={templateButtonPayloads[String(index)] || ""}
                            disabled={isSendingTemplate}
                            placeholder="Optional payload"
                            onChange={(event) =>
                              setTemplateButtonPayloads((current) => ({
                                ...current,
                                [String(index)]: event.target.value
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTemplateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedTemplate || isSendingTemplate}
              onClick={submitTemplate}
            >
              {isSendingTemplate ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Send template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MediaPickerDialog
        open={isMediaPickerOpen}
        selectedMediaId={selectedMedia?._id}
        onOpenChange={setIsMediaPickerOpen}
        onSelect={(media) => {
          setSelectedMedia(media);
          setAttachment(null);
          setIsMediaPickerOpen(false);
          requestAnimationFrame(() => replyInputRef.current?.focus());
        }}
      />
      <MediaPickerDialog
        open={templateMediaPickerOpen}
        selectedMediaId={templateHeaderMedia?._id}
        requiredType={selectedTemplateMediaHeader?.format}
        onOpenChange={setTemplateMediaPickerOpen}
        onSelect={(media) => {
          setTemplateHeaderMedia(media);
          setTemplateMediaPickerOpen(false);
        }}
      />
      {previewMedia && (
        <MediaLightbox
          preview={previewMedia}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </AppLayout>
  );
}

function MediaLightbox({
  preview,
  onClose
}: {
  preview: MessageMediaPreview;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close preview"
      >
        <X className="size-5" />
      </button>
      <div
        className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden rounded-xl bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{preview.name}</p>
            {preview.caption && (
              <p className="truncate text-xs text-white/65">{preview.caption}</p>
            )}
          </div>
          <a
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1.5 text-xs transition hover:bg-white/20"
          >
            Open original
          </a>
        </div>
        <div className="flex min-h-0 items-center justify-center bg-black">
          {preview.type === "image" ? (
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[80vh] max-w-full object-contain"
            />
          ) : (
            <video
              src={preview.url}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
