import type {
  StoreTemplateChoice,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { formatLanguage } from "@/lib/displayFormat";
import {
  badgeToneClass,
  templateCategoryPresentation,
  templateStatusPresentation
} from "@/lib/statusPresentation";
import { parseTemplateChoiceKey, templateChoiceKey } from "@/lib/store";
import { templateBodyPreview } from "@/lib/storePage";
import { cn } from "@/lib/utils";

const NONE = "__none";

function Pill({
  presentation
}: {
  presentation: { label: string; tone: keyof typeof badgeToneClass };
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        badgeToneClass[presentation.tone]
      )}
    >
      {presentation.label}
    </span>
  );
}

/** "{{1}} Customer's first name" chips: what each placeholder is filled with. */
export function StoreVariableChips({
  variables
}: {
  variables?: StoreTemplateVariable[];
}) {
  if (!variables?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((variable) => (
        <span
          key={variable.variable}
          className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          <span className="font-mono font-medium text-foreground">
            {variable.variable}
          </span>
          {variable.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Picks the template a store message uses. Options are approved or
 * in-review templates; the chosen one stays listed even when it isn't
 * (rejected later, or from another account) so the picker never goes
 * blank. `error` is the API's reason a template can't be used.
 *
 * The Store page passes `trigger` (a text button such as "Change
 * template" that opens the list; its card shows the chosen template) and
 * `showBodyPreview` (each option led by its text). The screens inside
 * Shopify admin use neither.
 */
export function StoreTemplatePicker({
  id,
  templateName,
  templateLanguage,
  options,
  allTemplates,
  disabled,
  error,
  onChange,
  trigger,
  triggerLabel,
  showBodyPreview = false
}: {
  id: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  options: StoreTemplateChoice[];
  allTemplates: StoreTemplateChoice[];
  disabled?: boolean;
  error?: string | null;
  onChange: (choice: { name: string; language: string } | null) => void;
  trigger?: string;
  /** The accessible name of a `trigger`, e.g. "Change the template for Order confirmed". */
  triggerLabel?: string;
  showBodyPreview?: boolean;
}) {
  const value = templateChoiceKey(templateName, templateLanguage);
  const chosen = value
    ? allTemplates.find(
        (template) =>
          template.name === templateName &&
          template.language === templateLanguage
      )
    : undefined;
  const listed =
    value &&
    !options.some(
      (template) =>
        templateChoiceKey(template.name, template.language) === value
    );

  return (
    // With a `trigger` it sits in its card's row; the card shows errors.
    <div className={trigger ? "contents" : "space-y-2"}>
      <Select
        value={value || NONE}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(next === NONE ? null : parseTemplateChoiceKey(next))
        }
      >
        {trigger ? (
          <SelectTrigger
            id={id}
            aria-label={triggerLabel || trigger}
            className="h-auto min-h-11 border-0 bg-transparent px-0 py-0 font-medium text-primary shadow-none hover:underline sm:min-h-0 [&_svg:not([class*='text-'])]:text-primary"
          >
            {trigger}
          </SelectTrigger>
        ) : (
          <SelectTrigger id={id} className="w-full bg-white">
            <SelectValue placeholder="Choose a template" />
          </SelectTrigger>
        )}
        <SelectContent>
          <SelectItem value={NONE}>No template</SelectItem>
          {listed && (
            <SelectItem value={value}>
              {templateName} · {formatLanguage(templateLanguage)}
            </SelectItem>
          )}
          {options.map((template) =>
            showBodyPreview ? (
              <SelectItem
                key={`${template.name}::${template.language}`}
                value={templateChoiceKey(template.name, template.language)}
                className="max-w-[min(28rem,calc(100vw-2rem))]"
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5 py-0.5">
                  <span className="line-clamp-2 whitespace-normal">
                    {templateBodyPreview(template) || template.name}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {formatLanguage(template.language)} ·{" "}
                    <span className="truncate">{template.name}</span>
                    <Pill
                      presentation={templateStatusPresentation(template.status)}
                    />
                  </span>
                </span>
              </SelectItem>
            ) : (
              <SelectItem
                key={`${template.name}::${template.language}`}
                value={templateChoiceKey(template.name, template.language)}
              >
                <span className="truncate">{template.name}</span>
                <span className="text-muted-foreground">
                  · {formatLanguage(template.language)}
                </span>
                {String(template.status).toUpperCase() !== "APPROVED" && (
                  <span className="text-amber-700">· In review</span>
                )}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>
      {chosen && !trigger && (
        <div className="flex flex-wrap gap-1.5">
          <Pill presentation={templateStatusPresentation(chosen.status)} />
          <Pill presentation={templateCategoryPresentation(chosen.category)} />
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
