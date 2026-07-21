import {
  ChevronRight,
  ContactRound,
  ExternalLink,
  FileText,
  ImageIcon,
  List,
  LocateFixed,
  Mail,
  MapPin,
  Navigation,
  Package,
  Phone,
  Play,
  Video
} from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import {
  BotAction,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import {
  InstagramBlockType,
  InstagramCanvasContent,
  InstagramGenericCard,
  InstagramQuickReply,
  InstagramTemplateButton
} from "@/client-api/types/instagram.type";
import { cn } from "@/lib/utils";

type PreviewShellProps = {
  platform: "WhatsApp" | "Instagram";
  onClose?: () => void;
  showClose?: boolean;
  children: React.ReactNode;
};

type LooseRecord = Record<string, unknown>;

const stringValue = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value : fallback;

const mediaUrl = (content: LooseRecord) => {
  const media =
    content.media && typeof content.media === "object"
      ? (content.media as LooseRecord)
      : undefined;
  return stringValue(
    content.mediaUrl ||
      content.imageUrl ||
      content.image_url ||
      media?.cloudinaryUrl ||
      media?.url
  );
};

function PreviewShell({
  platform,
  onClose,
  showClose = true,
  children
}: PreviewShellProps) {
  const instagram = platform === "Instagram";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              instagram ? "bg-pink-500" : "bg-emerald-500"
            )}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {platform} preview
          </p>
        </div>
        {showClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label={`Close ${platform} preview`}
          >
            Close
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function RouteSourceHandle({
  id,
  platform
}: {
  id?: string;
  platform: "WhatsApp" | "Instagram";
}) {
  if (!id) return null;
  return (
    <Handle
      id={id}
      type="source"
      position={Position.Right}
      className={cn(
        "!right-[-1px] !size-3.5 !border-2 !border-white !shadow-sm",
        platform === "Instagram" ? "!bg-pink-500" : "!bg-emerald-500"
      )}
    />
  );
}

function WhatsAppMedia({
  content,
  type
}: {
  content: LooseRecord;
  type: string;
}) {
  const url = mediaUrl(content);
  const name = stringValue(content.mediaName, "Selected media");

  if (type === "document") {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-lg bg-slate-100 p-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-500">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-800">{name}</p>
          <p className="text-[10px] uppercase text-slate-500">Document</p>
        </div>
      </div>
    );
  }

  if (url && type === "video") {
    return (
      <video
        src={url}
        controls
        muted
        className="mb-1 aspect-video w-full rounded-lg bg-slate-900 object-cover"
      />
    );
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="mb-1 aspect-video w-full rounded-lg bg-slate-100 object-cover"
      />
    );
  }

  return (
    <div className="mb-1 flex aspect-video w-full items-center justify-center rounded-lg bg-slate-100 text-slate-400">
      {type === "video" ? (
        <Video className="size-8" />
      ) : (
        <ImageIcon className="size-8" />
      )}
    </div>
  );
}

function WhatsAppActions({
  actions,
  showRouteHandles = false
}: {
  actions: BotAction[];
  showRouteHandles?: boolean;
}) {
  if (!actions.length) return null;
  return (
    <div className="mt-1 divide-y divide-slate-200 border-t border-slate-200">
      {actions.slice(0, 3).map((action, index) => (
        <div
          key={action.actionId || index}
          className="relative flex min-h-9 items-center justify-center gap-1.5 px-2 text-center text-xs font-medium text-[#027eb5]"
        >
          {action.type === "open_url" && <ExternalLink className="size-3" />}
          {stringValue(action.label, `Option ${index + 1}`)}
          {showRouteHandles && action.type === "go_to_trigger" && (
            <RouteSourceHandle id={action.actionId} platform="WhatsApp" />
          )}
        </div>
      ))}
    </div>
  );
}

function WhatsAppBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[86%] overflow-hidden rounded-lg rounded-tl-sm bg-white p-1.5 shadow-sm">
      {children}
      <div className="mt-1 flex justify-end px-1 text-[9px] text-slate-400">
        12:34
      </div>
    </div>
  );
}

function WhatsAppListPreview({
  content,
  actions,
  showRouteHandles = false
}: {
  content: BotCanvasNodeContent;
  actions: BotAction[];
  showRouteHandles?: boolean;
}) {
  const sections = Array.isArray(content.sections)
    ? (content.sections as Array<LooseRecord>)
    : [];
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <List className="size-4 text-emerald-600" />
        <p className="text-xs font-semibold text-slate-800">
          {stringValue(content.buttonText, "Choose an option")}
        </p>
      </div>
      <div className="max-h-40 overflow-y-auto p-2">
        {sections.length ? (
          sections.map((section, sectionIndex) => {
            const rows = Array.isArray(section.rows)
              ? (section.rows as Array<LooseRecord>)
              : [];
            return (
              <div key={sectionIndex} className="mb-2 last:mb-0">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  {stringValue(section.title, `Section ${sectionIndex + 1}`)}
                </p>
                {rows.map((row, rowIndex) => {
                  const replyId = stringValue(row.replyId || row.id);
                  const action = actions.find(
                    (item) =>
                      item.replyId === replyId ||
                      item.label === String(row.title || row.label || "")
                  );
                  return (
                    <div
                      key={rowIndex}
                      className="relative flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {stringValue(
                            row.title || row.label,
                            `Option ${rowIndex + 1}`
                          )}
                        </p>
                        {!!row.description && (
                          <p className="truncate text-[10px] text-slate-500">
                            {String(row.description)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
                      {showRouteHandles && action?.type === "go_to_trigger" && (
                        <RouteSourceHandle
                          id={action.actionId}
                          platform="WhatsApp"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          <p className="p-3 text-center text-xs text-slate-400">
            Add menu rows to preview them.
          </p>
        )}
      </div>
    </div>
  );
}

function WhatsAppCarousel({
  content,
  actions,
  showRouteHandles = false,
  product = false
}: {
  content: BotCanvasNodeContent;
  actions: BotAction[];
  showRouteHandles?: boolean;
  product?: boolean;
}) {
  const cards = Array.isArray(content.cards)
    ? (content.cards as Array<LooseRecord>)
    : [];
  const productSections = Array.isArray(content.sections)
    ? (content.sections as Array<LooseRecord>)
    : [];
  const productIds = productSections.flatMap((section) =>
    Array.isArray(section.productRetailerIds)
      ? (section.productRetailerIds as unknown[])
      : []
  );
  const visibleCards: LooseRecord[] = product
    ? productIds.map((id) => ({
        title: String(id),
        bodyText: "Catalog item"
      }))
    : cards;

  return (
    <div>
      {!!content.bodyText && (
        <div className="mb-2 w-[86%] rounded-lg rounded-tl-sm bg-white p-2.5 text-xs text-slate-800 shadow-sm">
          {String(content.bodyText)}
        </div>
      )}
      <div
        className={cn(
          "flex snap-x gap-2 pb-1",
          showRouteHandles
            ? "overflow-visible"
            : "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {(visibleCards.length ? visibleCards : [{}]).map((card, index) => {
          const buttons = Array.isArray(card.buttons)
            ? (card.buttons as Array<LooseRecord>)
            : [];
          const cardType = stringValue(card.mediaType, "image");
          return (
            <div
              key={index}
              className="w-44 shrink-0 snap-start overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xs"
            >
              {product ? (
                <div className="flex aspect-video items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Package className="size-8" />
                </div>
              ) : (
                <WhatsAppMedia content={card} type={cardType} />
              )}
              <div className="px-1 py-1">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {stringValue(
                    card.title,
                    product ? "Catalog item" : `Card ${index + 1}`
                  )}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                  {stringValue(card.bodyText, "Card description")}
                </p>
              </div>
              {!!buttons.length && (
                <div className="mt-1 divide-y border-t">
                  {buttons.slice(0, 3).map((button, buttonIndex) => {
                    const action = actions.find(
                      (item) =>
                        item.replyId === String(button.replyId || button.id) ||
                        item.label ===
                          String(button.label || button.title || "")
                    );
                    return (
                      <div
                        key={buttonIndex}
                        className="relative py-1.5 text-center text-[11px] font-medium text-[#027eb5]"
                      >
                        {stringValue(
                          button.label || button.title,
                          `Button ${buttonIndex + 1}`
                        )}
                        {showRouteHandles &&
                          action?.type === "go_to_trigger" && (
                            <RouteSourceHandle
                              id={action.actionId}
                              platform="WhatsApp"
                            />
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
              {product &&
                (() => {
                  const action = actions.find(
                    (item) =>
                      item.replyId === String(card.title || "") ||
                      item.label === String(card.title || "")
                  );
                  return action ? (
                    <div className="relative border-t py-1.5 text-center text-[11px] font-medium text-[#027eb5]">
                      {action.label || "Select item"}
                      {showRouteHandles && action.type === "go_to_trigger" && (
                        <RouteSourceHandle
                          id={action.actionId}
                          platform="WhatsApp"
                        />
                      )}
                    </div>
                  ) : null;
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WhatsAppFlowBlockPreview({
  blockType,
  content,
  actions,
  onClose,
  showClose = true,
  showRouteHandles = false
}: {
  blockType: BotBlockType;
  content: BotCanvasNodeContent;
  actions: BotAction[];
  onClose?: () => void;
  showClose?: boolean;
  showRouteHandles?: boolean;
}) {
  const body = stringValue(
    content.text || content.bodyText,
    "Your message will appear here."
  );
  const footer = stringValue(content.footerText);
  const type = stringValue(content.mediaType, blockType);
  const contact = Array.isArray(content.contacts)
    ? (content.contacts[0] as LooseRecord | undefined)
    : undefined;
  const contactName = contact?.name as LooseRecord | undefined;
  const phones = Array.isArray(contact?.phones)
    ? (contact?.phones as Array<LooseRecord>)
    : [];
  const emails = Array.isArray(contact?.emails)
    ? (contact?.emails as Array<LooseRecord>)
    : [];

  return (
    <PreviewShell platform="WhatsApp" onClose={onClose} showClose={showClose}>
      <div className="bg-[#efeae2] bg-[radial-gradient(circle_at_15%_25%,rgba(17,111,91,0.08)_0_1px,transparent_1.5px)] [background-size:18px_18px] p-3">
        {blockType === "list" ? (
          <>
            <WhatsAppBubble>
              {!!content.headerText && (
                <p className="px-1 pt-1 text-xs font-semibold text-slate-900">
                  {String(content.headerText)}
                </p>
              )}
              <p className="px-1 pt-1 text-xs leading-relaxed text-slate-800">
                {body}
              </p>
              {footer && (
                <p className="px-1 pt-1 text-[10px] text-slate-500">{footer}</p>
              )}
              <div className="mt-1 border-t py-2 text-center text-xs font-medium text-[#027eb5]">
                <List className="mr-1 inline size-3.5" />
                {stringValue(content.buttonText, "Open menu")}
              </div>
            </WhatsAppBubble>
            <WhatsAppListPreview
              content={content}
              actions={actions}
              showRouteHandles={showRouteHandles}
            />
          </>
        ) : blockType === "generic_carousel" ? (
          <WhatsAppCarousel
            content={content}
            actions={actions}
            showRouteHandles={showRouteHandles}
          />
        ) : blockType === "product_carousel" ? (
          <WhatsAppCarousel
            content={content}
            actions={actions}
            showRouteHandles={showRouteHandles}
            product
          />
        ) : (
          <WhatsAppBubble>
            {(blockType === "image" ||
              blockType === "video" ||
              blockType === "document" ||
              (blockType === "buttons" &&
                Boolean(
                  content.mediaId || mediaUrl(content as LooseRecord)
                ))) && (
              <WhatsAppMedia content={content as LooseRecord} type={type} />
            )}

            {blockType === "location" && (
              <div className="mb-1 overflow-hidden rounded-lg border bg-[#dfe7df]">
                <div className="relative flex aspect-[2/1] items-center justify-center bg-[linear-gradient(45deg,transparent_45%,rgba(255,255,255,.75)_46%_54%,transparent_55%),linear-gradient(-45deg,transparent_45%,rgba(255,255,255,.75)_46%_54%,transparent_55%)] [background-size:42px_42px]">
                  <span className="flex size-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                    <MapPin className="size-5" />
                  </span>
                </div>
                <div className="bg-white p-2">
                  <p className="text-xs font-semibold text-slate-800">
                    {stringValue(
                      content.name || content.locationName,
                      "Shared location"
                    )}
                  </p>
                  <p className="line-clamp-2 text-[10px] text-slate-500">
                    {stringValue(
                      content.address || content.locationAddress,
                      `${content.latitude ?? 0}, ${content.longitude ?? 0}`
                    )}
                  </p>
                </div>
              </div>
            )}

            {blockType === "contacts" && (
              <div className="rounded-lg bg-slate-50 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <ContactRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {stringValue(
                        contactName?.formatted_name || contactName?.first_name,
                        "Contact"
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500">Contact card</p>
                  </div>
                </div>
                {!!phones[0]?.phone && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Phone className="size-3" /> {String(phones[0].phone)}
                  </p>
                )}
                {!!emails[0]?.email && (
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-slate-600">
                    <Mail className="size-3" /> {String(emails[0].email)}
                  </p>
                )}
              </div>
            )}

            {(blockType === "text" || blockType === "buttons") && (
              <p className="px-1 pt-1 text-xs leading-relaxed text-slate-800">
                {body}
              </p>
            )}

            {(blockType === "location_request" ||
              blockType === "address_request") && (
              <>
                <p className="px-1 pt-1 text-xs leading-relaxed text-slate-800">
                  {body}
                </p>
                <div className="mt-2 border-t py-2 text-center text-xs font-medium text-[#027eb5]">
                  {blockType === "location_request" ? (
                    <LocateFixed className="mr-1 inline size-3.5" />
                  ) : (
                    <Navigation className="mr-1 inline size-3.5" />
                  )}
                  {blockType === "location_request"
                    ? "Send location"
                    : "Share address"}
                </div>
              </>
            )}

            {footer && !["list"].includes(blockType) && (
              <p className="px-1 pt-1 text-[10px] text-slate-500">{footer}</p>
            )}
            {blockType === "buttons" && (
              <WhatsAppActions
                actions={actions}
                showRouteHandles={showRouteHandles}
              />
            )}
          </WhatsAppBubble>
        )}
      </div>
    </PreviewShell>
  );
}

function InstagramMedia({
  content,
  video = false,
  className
}: {
  content: LooseRecord;
  video?: boolean;
  className?: string;
}) {
  const url = mediaUrl(content);
  if (url && video) {
    return (
      <video
        src={url}
        controls
        muted
        className={cn("w-full bg-black object-cover", className)}
      />
    );
  }
  if (url) {
    return (
      <img
        src={url}
        alt={stringValue(content.mediaName, "Instagram media")}
        className={cn("w-full bg-slate-100 object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-pink-100 via-purple-50 to-orange-100 text-pink-400",
        className
      )}
    >
      {video ? <Play className="size-9" /> : <ImageIcon className="size-9" />}
    </div>
  );
}

function InstagramButtons({
  buttons,
  showRouteHandles = false
}: {
  buttons: InstagramTemplateButton[];
  showRouteHandles?: boolean;
}) {
  if (!buttons.length) return null;
  return (
    <div className="mt-1 space-y-1">
      {buttons.slice(0, 3).map((button, index) => (
        <div
          key={button.actionId || button.replyId || index}
          className="relative rounded-xl bg-[#efefef] px-3 py-2 text-center text-xs font-semibold text-slate-900"
        >
          {button.type === "web_url" && (
            <ExternalLink className="mr-1 inline size-3" />
          )}
          {button.label || button.title || `Button ${index + 1}`}
          {showRouteHandles && button.type !== "web_url" && (
            <RouteSourceHandle
              id={button.actionId || button.replyId || button.payload}
              platform="Instagram"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function InstagramGenericPreview({
  cards,
  showRouteHandles = false
}: {
  cards: InstagramGenericCard[];
  showRouteHandles?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex snap-x gap-2 pb-1",
        showRouteHandles
          ? "overflow-visible"
          : "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {(cards.length ? cards : [{}]).map((card, index) => (
        <div
          key={index}
          className="w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <InstagramMedia
            content={card as LooseRecord}
            video={card.mediaType === "video"}
            className="aspect-square"
          />
          <div className="p-2.5">
            <p className="truncate text-xs font-semibold text-slate-900">
              {card.title || `Card ${index + 1}`}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
              {card.subtitle || "Card subtitle"}
            </p>
          </div>
          <div className="border-t px-2 pb-2">
            <InstagramButtons
              buttons={card.buttons || []}
              showRouteHandles={showRouteHandles}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InstagramFlowBlockPreview({
  blockType,
  content,
  onClose,
  showClose = true,
  showRouteHandles = false
}: {
  blockType: InstagramBlockType;
  content: InstagramCanvasContent;
  onClose?: () => void;
  showClose?: boolean;
  showRouteHandles?: boolean;
}) {
  const text = stringValue(
    content.text,
    "Your Instagram message will appear here."
  );
  const replies =
    (content.quickReplies as InstagramQuickReply[] | undefined) || [];
  const buttons =
    (content.buttons as InstagramTemplateButton[] | undefined) || [];
  const cards = (content.cards as InstagramGenericCard[] | undefined) || [];

  return (
    <PreviewShell platform="Instagram" onClose={onClose} showClose={showClose}>
      <div className="bg-white p-3">
        <div className="mb-3 flex items-center gap-2 border-b pb-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-[10px] font-bold text-white">
            W
          </span>
          <div>
            <p className="text-[11px] font-semibold text-slate-900">
              whatching
            </p>
            <p className="text-[9px] text-slate-400">Instagram</p>
          </div>
        </div>

        {blockType === "generic_template" ? (
          <InstagramGenericPreview
            cards={cards}
            showRouteHandles={showRouteHandles}
          />
        ) : (
          <div className="max-w-[88%]">
            {(blockType === "send_image" || blockType === "send_video") && (
              <InstagramMedia
                content={content as LooseRecord}
                video={blockType === "send_video"}
                className="aspect-square rounded-2xl"
              />
            )}
            {(blockType === "send_text" ||
              blockType === "quick_replies" ||
              blockType === "button_template") && (
              <div className="rounded-2xl rounded-tl-sm bg-[#efefef] px-3 py-2.5 text-xs leading-relaxed text-slate-900">
                {text}
              </div>
            )}
            {blockType === "quick_replies" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(replies.length ? replies : [{}])
                  .slice(0, 13)
                  .map((reply, index) => (
                    <span
                      key={reply.replyId || index}
                      className="relative rounded-full border border-[#3797f0] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3797f0]"
                    >
                      {reply.label || reply.title || `Reply ${index + 1}`}
                      {showRouteHandles && (
                        <RouteSourceHandle
                          id={reply.replyId || reply.payload}
                          platform="Instagram"
                        />
                      )}
                    </span>
                  ))}
              </div>
            )}
            {blockType === "button_template" && (
              <InstagramButtons
                buttons={buttons}
                showRouteHandles={showRouteHandles}
              />
            )}
          </div>
        )}
      </div>
    </PreviewShell>
  );
}
