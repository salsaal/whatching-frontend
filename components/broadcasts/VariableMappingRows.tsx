import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  contactFieldOptions,
  isMappingComplete,
  TemplateVariableSlot,
  VariableMapping
} from "@/lib/templateVariables";
import { cn } from "@/lib/utils";

// One row per template variable: Contact field (with a fallback) or Fixed
// text. Unfilled rows are marked so the step can't continue silently.
export function VariableMappingRows({
  slots,
  mappings,
  onChange,
  showMissing
}: {
  slots: TemplateVariableSlot[];
  mappings: Record<string, VariableMapping>;
  onChange: (slotId: string, mapping: VariableMapping) => void;
  /** Mark unfilled rows red (after the user tries to continue). */
  showMissing?: boolean;
}) {
  return (
    <div className="space-y-2">
      {slots.map((slot) => {
        const mapping = mappings[slot.id] || {
          source: "literal" as const,
          path: "",
          fallback: "",
          literal: ""
        };
        const isFixed = slot.literalOnly || mapping.source === "literal";
        const isMissing = !isMappingComplete(mapping);
        const update = (patch: Partial<VariableMapping>) =>
          onChange(slot.id, { ...mapping, ...patch });

        return (
          <div
            key={slot.id}
            className={cn(
              "space-y-2 rounded-md bg-muted/40 p-3",
              isMissing && showMissing && "bg-red-50 ring-1 ring-red-300"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {slot.label}
              </span>
              {isMissing && showMissing && (
                <span className="text-xs font-medium text-red-700">
                  Required
                </span>
              )}
              {!slot.literalOnly && (
                <div
                  role="radiogroup"
                  aria-label={`Value for ${slot.label}`}
                  className="ml-auto inline-flex rounded-md bg-white p-0.5 shadow-xs"
                >
                  {(
                    [
                      ["subscriber_field", "Contact field"],
                      ["literal", "Fixed text"]
                    ] as const
                  ).map(([source, label]) => {
                    const active = source === "literal" ? isFixed : !isFixed;
                    return (
                      <button
                        key={source}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() =>
                          update(
                            source === "literal"
                              ? { source: "literal" }
                              : {
                                  source: "subscriber_field",
                                  path:
                                    mapping.source !== "literal" && mapping.path
                                      ? mapping.path
                                      : "firstName",
                                  fallback: mapping.fallback || "there"
                                }
                          )
                        }
                        className={cn(
                          "cursor-pointer rounded-sm px-2.5 py-1 text-xs font-medium transition",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {isFixed ? (
              <Input
                value={mapping.literal}
                className="bg-white"
                placeholder={
                  slot.sample ? `Sample: ${slot.sample}` : "Type the text"
                }
                onChange={(event) =>
                  update({ source: "literal", literal: event.target.value })
                }
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={mapping.path || undefined}
                  onValueChange={(path) => update({ path })}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Choose a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={mapping.fallback}
                  className="bg-white"
                  placeholder="Fallback: there"
                  aria-label="Fallback when the contact has no value"
                  onChange={(event) => update({ fallback: event.target.value })}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
