import {
  FileText,
  ImageIcon,
  MapPin,
  Phone,
  Play,
  Reply,
  SquareArrowOutUpRight
} from "lucide-react";

import {
  MessageTemplate,
  TemplateButton
} from "@/client-api/types/templates.type";
import {
  getButtonsComponent,
  getFooterComponent,
  getHeaderComponent
} from "@/components/templates/templateUtils";
import { getTemplateBodyText } from "@/lib/broadcastComponents";
import { cn } from "@/lib/utils";

export type PreviewValue = {
  text: string;
  /** True while the variable has no mapping yet and shows its sample. */
  isPlaceholder: boolean;
};

function MediaPlaceholder({ format }: { format: string }) {
  const Icon =
    format === "IMAGE"
      ? ImageIcon
      : format === "VIDEO"
        ? Play
        : format === "DOCUMENT"
          ? FileText
          : MapPin;
  return (
    <div className="mb-2 flex aspect-[1.9] items-center justify-center rounded-md bg-slate-100 text-slate-400">
      <Icon className="size-8" />
    </div>
  );
}

function ButtonIcon({ type }: { type: TemplateButton["type"] }) {
  if (type === "PHONE_NUMBER") return <Phone className="size-3.5" />;
  if (type === "URL") return <SquareArrowOutUpRight className="size-3.5" />;
  return <Reply className="size-3.5" />;
}

// Renders the body with each {{n}} swapped for its preview value, so mapped
// values read naturally and unmapped ones stand out.
function BodyText({
  text,
  values
}: {
  text: string;
  values: Record<string, PreviewValue>;
}) {
  const parts = text.split(/({{\d+}})/g);
  return (
    <p className="text-[13px] leading-5 whitespace-pre-wrap text-slate-900">
      {parts.map((part, index) => {
        const match = part.match(/^{{(\d+)}}$/);
        if (!match) return part;
        const value = values[match[1]];
        if (!value) return part;
        return (
          <span
            key={index}
            className={cn(
              value.isPlaceholder &&
                "rounded-sm bg-amber-100 px-0.5 text-amber-900"
            )}
          >
            {value.text}
          </span>
        );
      })}
    </p>
  );
}

// A WhatsApp-style bubble for an approved template, used live while a
// broadcast draft is being set up.
export function BroadcastTemplatePreview({
  template,
  values
}: {
  template?: MessageTemplate;
  values: Record<string, PreviewValue>;
}) {
  const header = getHeaderComponent(template?.components || []);
  const footer = getFooterComponent(template?.components || []);
  const buttons =
    getButtonsComponent(template?.components || [])?.buttons || [];
  const bodyText = getTemplateBodyText(template);

  return (
    <div
      className="rounded-lg bg-[#efeae2] p-4"
      style={{
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)",
        backgroundSize: "14px 14px"
      }}
    >
      {template ? (
        <div className="max-w-[290px]">
          <div className="rounded-lg rounded-tl-none bg-white p-2 shadow-xs">
            {header?.format === "TEXT" && header.text && (
              <p className="mb-1 text-sm font-semibold text-slate-900">
                {header.text}
              </p>
            )}
            {header?.format && header.format !== "TEXT" && (
              <MediaPlaceholder format={header.format} />
            )}
            <BodyText text={bodyText} values={values} />
            {footer?.text && (
              <p className="mt-1 text-[11px] text-slate-500">{footer.text}</p>
            )}
            <p className="mt-0.5 text-right text-[10px] text-slate-400">
              12:00
            </p>
          </div>
          {buttons.length > 0 && (
            <div className="mt-1 space-y-1">
              {buttons.map((button, index) => (
                <div
                  key={`${button.text}-${index}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-[13px] font-medium text-sky-600 shadow-xs"
                >
                  <ButtonIcon type={button.type} />
                  {button.text}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">
          Pick a template to see how it will look.
        </p>
      )}
    </div>
  );
}
