import { Copy, GripVertical, Link2, Phone, Plus, Reply, X } from "lucide-react";
import { useState } from "react";

import { TemplateButtonType } from "@/client-api/types/templates.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupTemplateButtons } from "@/components/templates/templateUtils";
import { cn } from "@/lib/utils";
import {
  ButtonDraft,
  MAX_BUTTON_LABEL,
  MAX_CAROUSEL_CARD_BUTTONS,
  MAX_COPY_CODE_BUTTONS,
  MAX_PHONE_BUTTONS,
  MAX_TOTAL_BUTTONS,
  MAX_URL_BUTTONS
} from "./templateDraft";

const typeMeta: Record<string, { label: string; icon: React.ElementType }> = {
  QUICK_REPLY: { label: "Quick reply", icon: Reply },
  URL: { label: "Website", icon: Link2 },
  PHONE_NUMBER: { label: "Call", icon: Phone },
  COPY_CODE: { label: "Copy code", icon: Copy }
};

const emptyButton = (type: TemplateButtonType): ButtonDraft =>
  type === "URL"
    ? { type, text: "", url: "", sample: "" }
    : type === "PHONE_NUMBER"
      ? { type, text: "", phone_number: "" }
      : type === "COPY_CODE"
        ? { type, text: "", code: "" }
        : { type, text: "" };

// Quick replies first, then call-to-actions (Meta rejects interleaving).
// Drag reorders within a group only.
export function ButtonsEditor({
  buttons,
  onChange,
  isCarousel,
  disabled,
  structureLocked
}: {
  buttons: ButtonDraft[];
  onChange: (next: ButtonDraft[]) => void;
  isCarousel: boolean;
  disabled?: boolean;
  /** Editing a submitted template: buttons can't be added or removed. */
  structureLocked?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const count = (type: string) =>
    buttons.filter((button) => button.type === type).length;
  const max = isCarousel ? MAX_CAROUSEL_CARD_BUTTONS : MAX_TOTAL_BUTTONS;
  const full = buttons.length >= max;

  const add = (type: TemplateButtonType) =>
    onChange(groupTemplateButtons([...buttons, emptyButton(type)]));
  const update = (index: number, patch: Partial<ButtonDraft>) =>
    onChange(
      buttons.map((button, i) =>
        i === index ? { ...button, ...patch } : button
      )
    );
  const remove = (index: number) =>
    onChange(buttons.filter((_, i) => i !== index));
  const isQuick = (button: ButtonDraft) => button.type === "QUICK_REPLY";

  const move = (from: number, to: number) => {
    if (from === to || isQuick(buttons[from]) !== isQuick(buttons[to])) return;
    const next = [...buttons];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const addOptions: Array<{
    type: TemplateButtonType;
    disabledReason?: string;
  }> = [
    { type: "QUICK_REPLY" },
    {
      type: "URL",
      disabledReason:
        count("URL") >= MAX_URL_BUTTONS ? "2 website buttons max" : undefined
    },
    {
      type: "PHONE_NUMBER",
      disabledReason:
        count("PHONE_NUMBER") >= MAX_PHONE_BUTTONS
          ? "1 call button max"
          : undefined
    },
    ...(isCarousel
      ? []
      : [
          {
            type: "COPY_CODE" as TemplateButtonType,
            disabledReason:
              count("COPY_CODE") >= MAX_COPY_CODE_BUTTONS
                ? "1 copy-code button max"
                : undefined
          }
        ])
  ];

  const groups = [
    {
      title: "Quick replies",
      items: buttons
        .map((button, index) => ({ button, index }))
        .filter(({ button }) => isQuick(button))
    },
    {
      title: "Call-to-action",
      items: buttons
        .map((button, index) => ({ button, index }))
        .filter(({ button }) => !isQuick(button))
    }
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {buttons.length} of {max} buttons · {count("URL")} of {MAX_URL_BUTTONS}{" "}
        websites · {count("PHONE_NUMBER")} of {MAX_PHONE_BUTTONS} call
        {!isCarousel &&
          ` · ${count("COPY_CODE")} of ${MAX_COPY_CODE_BUTTONS} copy code`}
        {isCarousel && " · each card shows the same buttons, up to 2"}
      </p>

      {groups.map((group) =>
        group.items.length ? (
          <div key={group.title} className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </p>
            {group.items.map(({ button, index }) => {
              const meta = typeMeta[button.type] || typeMeta.QUICK_REPLY;
              const Icon = meta.icon;
              const hasUrlVar =
                button.type === "URL" && /{{\s*1\s*}}/.test(button.url || "");
              return (
                <div
                  key={index}
                  draggable={!disabled && !structureLocked}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) move(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className={cn(
                    "flex gap-2 rounded-lg border bg-white p-3",
                    dragIndex === index && "opacity-50"
                  )}
                >
                  {!structureLocked && (
                    <GripVertical
                      className="mt-2 size-4 shrink-0 cursor-grab text-muted-foreground"
                      aria-label="Drag to reorder"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Icon className="size-3.5" />
                      {meta.label}
                    </div>
                    {button.type === "COPY_CODE" ? (
                      <div className="space-y-1">
                        <Input
                          value={button.code || ""}
                          onChange={(event) =>
                            update(index, { code: event.target.value })
                          }
                          disabled={disabled}
                          maxLength={15}
                          placeholder="Offer code, e.g. SAVE10"
                          aria-label="Offer code"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          The button always reads &quot;Copy offer code&quot;.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="relative">
                          <Input
                            value={button.text}
                            onChange={(event) =>
                              update(index, { text: event.target.value })
                            }
                            disabled={disabled}
                            maxLength={MAX_BUTTON_LABEL}
                            placeholder="Button label"
                            aria-label="Button label"
                            className="pr-12"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-muted-foreground">
                            {button.text.length}/{MAX_BUTTON_LABEL}
                          </span>
                        </div>
                        {button.type === "URL" && (
                          <Input
                            value={button.url || ""}
                            onChange={(event) =>
                              update(index, { url: event.target.value })
                            }
                            disabled={disabled}
                            placeholder="https://site.com/track/{{1}}"
                            aria-label="Website link"
                          />
                        )}
                        {button.type === "PHONE_NUMBER" && (
                          <Input
                            value={button.phone_number || ""}
                            onChange={(event) =>
                              update(index, {
                                phone_number: event.target.value
                              })
                            }
                            disabled={disabled}
                            placeholder="+919876543210"
                            aria-label="Phone number"
                          />
                        )}
                        {button.type === "QUICK_REPLY" && (
                          <p className="self-center text-xs text-muted-foreground">
                            The flow block it starts is picked when sending.
                          </p>
                        )}
                      </div>
                    )}
                    {hasUrlVar && (
                      <Input
                        value={button.sample || ""}
                        onChange={(event) =>
                          update(index, { sample: event.target.value })
                        }
                        disabled={disabled}
                        placeholder="Sample link: https://site.com/track/123"
                        aria-label="Sample link"
                      />
                    )}
                  </div>
                  {!structureLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={disabled}
                      aria-label="Remove button"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : null
      )}

      {!structureLocked && (
        <div className="flex flex-wrap gap-2">
          {addOptions.map(({ type, disabledReason }) => {
            const meta = typeMeta[type];
            return (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || full || Boolean(disabledReason)}
                tooltip={full ? `${max} buttons max` : disabledReason}
                onClick={() => add(type)}
              >
                <Plus className="size-4" />
                {meta.label}
              </Button>
            );
          })}
        </div>
      )}
      {structureLocked && (
        <p className="text-xs text-muted-foreground">
          Meta doesn&apos;t allow adding or removing buttons on a submitted
          template; labels and links can change.
        </p>
      )}
    </div>
  );
}
