import {
  FileText,
  Gift,
  ImageIcon,
  MapPin,
  Phone,
  Play,
  Reply,
  SquareArrowOutUpRight
} from "lucide-react";

import {
  TemplateButton,
  TemplateCreationType,
  TemplateHeaderFormat
} from "@/api/types/templates.type";
import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  headerFormat: "NONE" | TemplateHeaderFormat;
  templateType?: TemplateCreationType;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButton[];
  offerText?: string;
  carouselCardCount?: number;
}

function HeaderPreview({
  format,
  text
}: {
  format: "NONE" | TemplateHeaderFormat;
  text?: string;
}) {
  if (format === "NONE") return null;

  if (format === "TEXT") {
    return <p className="mb-2 font-semibold text-foreground">{text}</p>;
  }

  const Icon =
    format === "IMAGE"
      ? ImageIcon
      : format === "VIDEO"
        ? Play
        : format === "DOCUMENT"
          ? FileText
          : MapPin;

  return (
    <div className="mb-3 flex aspect-[1.9] items-center justify-center rounded-sm bg-[#fff2dd] text-amber-500">
      <Icon className="size-10" />
    </div>
  );
}

function ButtonIcon({ type }: { type: TemplateButton["type"] }) {
  if (type === "PHONE_NUMBER") return <Phone className="size-4" />;
  if (type === "URL") return <SquareArrowOutUpRight className="size-4" />;
  return <Reply className="size-4" />;
}

const carouselBodySamples = [
  "Add a touch of elegance to your collection with the beautiful Aloe 'Blue Elf' succulent. Its deep blue-green leaves have a hint of pink around the edges.",
  "The Crassula succulent is sure to be a favorite with its tightly stacked leaves and intricate color pattern.",
  "Bring fresh texture into your space with a low-maintenance plant that looks great on a desk or shelf."
];

function CarouselMedia({ index }: { index: number }) {
  const palettes = [
    "from-emerald-900 via-teal-500 to-rose-300",
    "from-lime-950 via-emerald-600 to-yellow-200",
    "from-slate-800 via-cyan-600 to-fuchsia-300"
  ];

  return (
    <div
      className={cn(
        "relative aspect-[1.45] overflow-hidden rounded-t-lg bg-gradient-to-br",
        palettes[index % palettes.length]
      )}
    >
      <div className="absolute left-6 top-5 size-28 rounded-full bg-white/20 blur-sm" />
      <div className="absolute bottom-5 left-10 size-32 rounded-full border-[18px] border-white/20" />
      <div className="absolute right-5 top-8 size-24 rotate-45 rounded-[45%] bg-black/20" />
    </div>
  );
}

export default function TemplatePreview({
  headerFormat,
  templateType = "TEXT",
  headerText,
  bodyText,
  footerText,
  buttons = [],
  offerText,
  carouselCardCount = 2
}: TemplatePreviewProps) {
  const inlineButtons = buttons.slice(0, 3);
  const hiddenButtonCount = Math.max(buttons.length - inlineButtons.length, 0);
  const carouselButtons = (
    buttons.length
      ? buttons.slice(0, 2)
      : [
          { type: "QUICK_REPLY", text: "Send me more like this!" },
          { type: "URL", text: "Shop" }
        ]
  ) as TemplateButton[];

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-muted-foreground">
        Template Preview
      </p>
      <div className="rounded-lg bg-[#e5ddd5] p-4 shadow-xs">
        <div
          className={cn(
            "ml-auto rounded-lg bg-white shadow-xs",
            templateType === "CAROUSEL" ? "max-w-sm p-2" : "max-w-sm p-3"
          )}
        >
          {templateType === "LIMITED_TIME_OFFER" && (
            <div className="mb-3 flex items-center gap-2 rounded-sm bg-amber-50 p-3 text-amber-700">
              <Gift className="size-5 shrink-0" />
              <span className="text-sm font-semibold">
                {offerText || "Limited-time offer"}
              </span>
            </div>
          )}

          {templateType === "CAROUSEL" ? (
            <div className="-mx-1 mb-3 overflow-hidden">
              <div className="flex gap-3 overflow-x-auto px-1 pb-2">
                {Array.from({ length: carouselCardCount }).map(
                  (_card, index) => (
                    <div
                      key={index}
                      className="min-w-[250px] overflow-hidden rounded-lg bg-white shadow-xs"
                    >
                      <CarouselMedia index={index} />
                      <p className="p-3 text-sm leading-5 text-foreground">
                        {
                          carouselBodySamples[
                            index % carouselBodySamples.length
                          ]
                        }
                      </p>
                      <div className="divide-y">
                        {carouselButtons.map((button, buttonIndex) => (
                          <div
                            key={`${button.text}-${buttonIndex}`}
                            className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary"
                          >
                            <ButtonIcon type={button.type} />
                            {button.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <HeaderPreview format={headerFormat} text={headerText} />
          )}

          {templateType !== "CAROUSEL" && (
            <>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {bodyText || "Your template body will appear here."}
              </p>
              {footerText && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {footerText}
                </p>
              )}
            </>
          )}

          {buttons.length > 0 && templateType !== "CAROUSEL" && (
            <div className="mt-3 divide-y">
              {inlineButtons.map((button, index) => (
                <div
                  key={`${button.text}-${index}`}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 text-sm font-medium text-primary",
                    !button.text && "text-muted-foreground"
                  )}
                >
                  <ButtonIcon type={button.type} />
                  {button.text || "Button title"}
                </div>
              ))}
              {hiddenButtonCount > 0 && (
                <div className="py-2 text-center text-sm font-medium text-primary">
                  See all options ({hiddenButtonCount} more)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Preview is a visual representation. Meta can render media and variables
        differently after review.
      </p>
    </div>
  );
}
