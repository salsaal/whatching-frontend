import {
  Copy,
  ExternalLink,
  FileText,
  Gift,
  ImageIcon,
  List,
  MapPin,
  Phone,
  Play,
  Reply
} from "lucide-react";

import {
  TemplateButton,
  TemplateComponent
} from "@/client-api/types/templates.type";
import { cn } from "@/lib/utils";
import { renderWhatsAppText } from "@/lib/whatsappText";

// The one WhatsApp-style template preview: template editor, list hover,
// broadcast wizard and details, and the inbox's send-template dialog.

export interface WhatsAppPreviewProps {
  components: TemplateComponent[];
  /**
   * Values keyed by slot id ("body:1", "header:1"); a bare "1" also works
   * for the body. Missing values fall back to the template sample, then to
   * a highlighted {{n}} chip.
   */
  variableValues?: Record<string, string>;
  mediaUrl?: string;
  mediaName?: string;
  /** Carousel card images, by card index. */
  cardMediaUrls?: string[];
  compact?: boolean;
  wallpaper?: "light" | "dark";
  className?: string;
}

const sampleList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const first = value[0];
  return (Array.isArray(first) ? first : value).map((item) =>
    String(item ?? "")
  );
};

const isHttpUrl = (value?: string) =>
  Boolean(value && /^https?:\/\//i.test(value));

function ButtonIcon({ type }: { type: TemplateButton["type"] }) {
  if (type === "PHONE_NUMBER") return <Phone className="size-3.5" />;
  if (type === "URL") return <ExternalLink className="size-3.5" />;
  if (type === "COPY_CODE") return <Copy className="size-3.5" />;
  if (type === "CATALOG") return <List className="size-3.5" />;
  return <Reply className="size-3.5" />;
}

const buttonLabel = (button: TemplateButton) =>
  button.type === "COPY_CODE" ? "Copy offer code" : button.text || "Button";

function ButtonRows({
  buttons,
  compact,
  dark
}: {
  buttons: TemplateButton[];
  compact?: boolean;
  dark: boolean;
}) {
  if (!buttons.length) return null;
  // WhatsApp shows up to 3 rows; with more, the first 2 plus "See all".
  const visible = buttons.length > 3 ? buttons.slice(0, 2) : buttons;
  const rowClass = cn(
    "flex items-center justify-center gap-1.5 rounded-lg text-center font-medium shadow-xs",
    compact ? "py-1.5 text-[12px]" : "py-2 text-[13px]",
    dark ? "bg-[#1f2c34] text-sky-300" : "bg-white text-sky-600"
  );
  return (
    <div className="mt-1 space-y-1">
      {visible.map((button, index) => (
        <div key={`${button.text}-${index}`} className={rowClass}>
          <ButtonIcon type={button.type} />
          <span className="truncate">{buttonLabel(button)}</span>
        </div>
      ))}
      {buttons.length > 3 && (
        <div className={rowClass}>
          <List className="size-3.5" />
          See all options
        </div>
      )}
    </div>
  );
}

function MediaHeader({
  format,
  url,
  name
}: {
  format?: string;
  url?: string;
  name?: string;
}) {
  if (format === "DOCUMENT") {
    return (
      <div className="mb-1.5 flex items-center gap-2 rounded-md bg-slate-100 p-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-white text-rose-500">
          <FileText className="size-4" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-slate-700">
          {name || "Document"}
        </span>
      </div>
    );
  }
  if (format === "LOCATION") {
    return (
      <div className="mb-1.5 flex aspect-[2/1] items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
        <MapPin className="size-7" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative mb-1.5 aspect-[1.91/1] overflow-hidden rounded-md bg-slate-100"
      )}
    >
      {url && format === "IMAGE" ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : url && format === "VIDEO" ? (
        <video
          src={url}
          muted
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          {format === "VIDEO" ? (
            <Play className="size-7" />
          ) : (
            <ImageIcon className="size-7" />
          )}
        </div>
      )}
      {format === "VIDEO" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="size-5 fill-current" />
          </span>
        </span>
      )}
    </div>
  );
}

export function WhatsAppPreview({
  components,
  variableValues = {},
  mediaUrl,
  mediaName,
  cardMediaUrls = [],
  compact = false,
  wallpaper = "light",
  className
}: WhatsAppPreviewProps) {
  const dark = wallpaper === "dark";
  const header = components.find((component) => component.type === "HEADER");
  const body = components.find((component) => component.type === "BODY");
  const footer = components.find((component) => component.type === "FOOTER");
  const buttons =
    components.find((component) => component.type === "BUTTONS")?.buttons || [];
  const offer = components.find(
    (component) => component.type === "LIMITED_TIME_OFFER"
  );
  const carousel = components.find(
    (component) => component.type === "CAROUSEL"
  );

  const bodySamples = sampleList(body?.example?.body_text);
  const headerSamples = sampleList(
    (header?.example as { header_text?: unknown } | undefined)?.header_text
  );
  const resolveBody = (key: string) =>
    variableValues[`body:${key}`] ??
    variableValues[key] ??
    (bodySamples[Number(key) - 1] || undefined);
  const resolveHeader = (key: string) =>
    variableValues[`header:${key}`] ??
    (headerSamples[Number(key) - 1] || undefined);

  const headerUrl =
    mediaUrl ||
    (isHttpUrl(header?.example?.header_handle?.[0])
      ? header?.example?.header_handle?.[0]
      : undefined);

  const bubbleClass = cn(
    "rounded-lg rounded-tl-none shadow-xs",
    compact ? "p-1.5" : "p-2",
    dark ? "bg-[#1f2c34] text-slate-100" : "bg-white text-slate-900"
  );
  const textClass = cn(
    "whitespace-pre-wrap break-words",
    compact ? "text-[12px] leading-[17px]" : "text-[13px] leading-5"
  );

  return (
    <div
      className={cn(
        "rounded-lg",
        compact ? "p-2.5" : "p-4",
        dark ? "bg-[#0b141a]" : "bg-[#efeae2]",
        className
      )}
      style={{
        backgroundImage: dark
          ? "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)"
          : "radial-gradient(rgba(17,111,91,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px"
      }}
    >
      <div className={cn(carousel ? "max-w-full" : "max-w-[320px]")}>
        <div className={cn(bubbleClass, carousel && "max-w-[320px]")}>
          {offer && (
            <div className="mb-1.5 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-amber-800">
              <Gift className="size-4 shrink-0" />
              <span className="text-xs font-semibold">
                {offer.limited_time_offer?.text || "Limited-time offer"}
              </span>
            </div>
          )}
          {header && header.format === "TEXT" ? (
            <p
              className={cn(
                "mb-1 font-semibold",
                compact ? "text-[12.5px]" : "text-sm"
              )}
            >
              {renderWhatsAppText(header.text || "", resolveHeader)}
            </p>
          ) : header && !carousel ? (
            <MediaHeader
              format={header.format}
              url={headerUrl}
              name={mediaName}
            />
          ) : null}
          <p className={textClass}>
            {body?.text
              ? renderWhatsAppText(body.text, resolveBody)
              : "Your message will appear here."}
          </p>
          {footer?.text && (
            <p
              className={cn(
                "mt-1",
                compact ? "text-[10.5px]" : "text-[11px]",
                dark ? "text-slate-400" : "text-slate-500"
              )}
            >
              {footer.text}
            </p>
          )}
          <p
            className={cn(
              "mt-0.5 text-right text-[10px]",
              dark ? "text-slate-500" : "text-slate-400"
            )}
          >
            12:00
          </p>
        </div>

        {carousel ? (
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {(carousel.cards || []).map((card, index) => {
              const cardHeader = card.components.find(
                (item) => item.type === "HEADER"
              );
              const cardBody = card.components.find(
                (item) => item.type === "BODY"
              );
              const cardButtons =
                card.components.find((item) => item.type === "BUTTONS")
                  ?.buttons || [];
              const handle = cardHeader?.example?.header_handle?.[0];
              return (
                <div key={index} className="w-48 shrink-0">
                  <div className={bubbleClass}>
                    <MediaHeader
                      format={cardHeader?.format || "IMAGE"}
                      url={
                        cardMediaUrls[index] ||
                        (isHttpUrl(handle) ? handle : undefined)
                      }
                    />
                    {cardBody?.text && (
                      <p className={cn(textClass, "line-clamp-3")}>
                        {renderWhatsAppText(cardBody.text, resolveBody)}
                      </p>
                    )}
                  </div>
                  <ButtonRows
                    buttons={cardButtons.slice(0, 2)}
                    compact
                    dark={dark}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <ButtonRows buttons={buttons} compact={compact} dark={dark} />
        )}
      </div>
    </div>
  );
}
