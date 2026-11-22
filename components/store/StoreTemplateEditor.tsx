import { Plus } from "lucide-react";
import { useRef } from "react";

import type { StoreTemplateVariable } from "@/client-api/types/stores.type";
import type {
  TemplateButton,
  TemplateComponent
} from "@/client-api/types/templates.type";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppPreview } from "@/components/whatsapp/WhatsAppPreview";

/** "Customer’s first name" reads as "First name" on an insert button. */
const shortLabel = (label: string) =>
  label.replace(/^Customer[’']s\s+/i, "").replace(/^./, (c) => c.toUpperCase());

/**
 * A ready-made message's text, with buttons that insert a detail (the
 * customer's first name, the order number…) where the cursor is, and a
 * WhatsApp preview with sample values beside it. Stacks on a phone.
 */
export function StoreTemplateEditor({
  id,
  value,
  onChange,
  variables = [],
  previewValues,
  buttons = [],
  label
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  variables?: StoreTemplateVariable[];
  previewValues: Record<string, string>;
  buttons?: TemplateButton[];
  /** The text box's accessible name. */
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const tooShort = value.trim().length < 10;

  const insert = (placeholder: string) => {
    const field = ref.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${placeholder}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      const at = start + placeholder.length;
      field.setSelectionRange(at, at);
    });
  };

  const components: TemplateComponent[] = [
    { type: "BODY", text: value || " " },
    ...(buttons.length
      ? [{ type: "BUTTONS", buttons } as TemplateComponent]
      : [])
  ];

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="min-w-0 space-y-2">
        <Textarea
          id={id}
          ref={ref}
          value={value}
          rows={5}
          maxLength={1024}
          aria-label={label}
          aria-invalid={tooShort}
          className="min-h-28 resize-y bg-white leading-relaxed"
          onChange={(event) => onChange(event.target.value)}
        />
        {variables.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {variables.map((variable) => (
              <button
                key={variable.variable}
                type="button"
                onClick={() => insert(variable.variable)}
                title={`Adds ${variable.variable}, filled with the ${variable.label.toLowerCase()}`}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border bg-white px-2.5 text-xs font-medium text-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <Plus className="size-3" />
                {shortLabel(variable.label)}
              </button>
            ))}
          </div>
        )}
        {tooShort && (
          <p className="text-xs text-destructive">
            Write at least 10 characters.
          </p>
        )}
      </div>
      <div className="min-w-0">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          What customers see
        </p>
        <WhatsAppPreview
          components={components}
          variableValues={previewValues}
          className="rounded-lg"
        />
      </div>
    </div>
  );
}
