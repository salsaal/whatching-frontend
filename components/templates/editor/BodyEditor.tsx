import {
  AlertTriangle,
  Bold,
  Code,
  Italic,
  Plus,
  Smile,
  Strikethrough
} from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { bodyWarnings, MAX_BODY, variableKeys } from "./templateDraft";

const EMOJIS = [
  "😀",
  "😊",
  "😍",
  "🥳",
  "😎",
  "🤩",
  "🙏",
  "👍",
  "👋",
  "👏",
  "🙌",
  "💪",
  "🔥",
  "✨",
  "🎉",
  "🎁",
  "💯",
  "❤️",
  "💚",
  "⭐",
  "✅",
  "📦",
  "🚚",
  "🛒",
  "💰",
  "💳",
  "📅",
  "⏰",
  "📍",
  "📞",
  "📩",
  "🔔",
  "🏷️",
  "🆕",
  "⚡",
  "🌟",
  "☀️",
  "🌙",
  "🍕",
  "☕"
];

// Body textarea with WhatsApp formatting buttons, an emoji picker and
// "+ Variable", plus one sample input per {{n}} (Meta needs samples).
export function BodyEditor({
  value,
  onChange,
  examples,
  onExamplesChange,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  examples: Record<string, string>;
  onExamplesChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const keys = variableKeys(value);
  const warnings = bodyWarnings(value);

  // Replace the selection (or insert at the cursor) and keep focus there.
  const edit = (
    transform: (selected: string) => { text: string; cursorOffset?: number }
  ) => {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const { text, cursorOffset } = transform(value.slice(start, end));
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`.slice(
      0,
      MAX_BODY
    );
    onChange(next);
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      const position = start + (cursorOffset ?? text.length);
      element.setSelectionRange(position, position);
    });
  };

  const wrap = (marker: string) =>
    edit((selected) =>
      selected
        ? { text: `${marker}${selected}${marker}` }
        : { text: `${marker}${marker}`, cursorOffset: marker.length }
    );

  const addVariable = () => {
    const next = String(
      keys.reduce((max, key) => Math.max(max, Number(key)), 0) + 1
    );
    edit(() => ({ text: `{{${next}}}` }));
    onExamplesChange({ ...examples, [next]: examples[next] || "" });
  };

  const toolbar: Array<{
    label: string;
    icon: React.ElementType;
    marker: string;
  }> = [
    { label: "Bold", icon: Bold, marker: "*" },
    { label: "Italic", icon: Italic, marker: "_" },
    { label: "Strikethrough", icon: Strikethrough, marker: "~" },
    { label: "Monospace", icon: Code, marker: "```" }
  ];

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border focus-within:border-primary/40">
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
          {toolbar.map(({ label, icon: Icon, marker }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={disabled}
              aria-label={label}
              tooltip={label}
              onClick={() => wrap(marker)}
            >
              <Icon className="size-4" />
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={disabled}
                aria-label="Insert emoji"
              >
                <Smile className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="cursor-pointer rounded p-1 text-lg hover:bg-muted"
                    onClick={() => edit(() => ({ text: emoji }))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8"
            disabled={disabled}
            onClick={addVariable}
          >
            <Plus className="size-4" />
            Variable
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          maxLength={MAX_BODY}
          aria-label="Message body"
          placeholder="Hi {{1}}, your order is on its way!"
          className="min-h-36 resize-y rounded-none border-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <p className="text-right text-xs text-muted-foreground">
        {value.length} / {MAX_BODY}
      </p>

      {keys.length > 0 && (
        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Samples (Meta reviews the message with these)
          </p>
          {keys.map((key) => (
            <div
              key={key}
              className="grid items-center gap-2 sm:grid-cols-[52px_minmax(0,1fr)]"
            >
              <span className="font-mono text-sm">{`{{${key}}}`}</span>
              <div className="space-y-1">
                <Input
                  value={examples[key] || ""}
                  disabled={disabled}
                  placeholder={key === "1" ? "Sample: Priya" : "Sample value"}
                  aria-label={`Sample for {{${key}}}`}
                  className={cn(
                    "h-9 bg-white",
                    !examples[key]?.trim() && "border-amber-300"
                  )}
                  onChange={(event) =>
                    onExamplesChange({ ...examples, [key]: event.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Will be filled from a contact field or fixed text when
                  sending.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {warnings.map((warning) => (
        <p key={warning} className="flex gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {warning}
        </p>
      ))}
    </div>
  );
}
