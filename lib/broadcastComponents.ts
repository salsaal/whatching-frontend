import { MessageTemplate } from "@/client-api/types/templates.type";
import {
  extractVariables,
  getBodyComponent
} from "@/components/templates/templateUtils";

export type BroadcastVariableSource =
  | "subscriber_field"
  | "metadata_field"
  | "literal";

export interface BroadcastVariableMapping {
  source: BroadcastVariableSource;
  path: string;
  fallback: string;
  literal: string;
}

export const subscriberFieldOptions = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "fullName", label: "Full name" },
  { value: "phoneNumber", label: "Phone number" },
  { value: "waId", label: "WhatsApp ID" }
] as const;

export const getTemplateBodyText = (template?: MessageTemplate) =>
  getBodyComponent(template?.components || [])?.text || "";

export const getTemplateBodyVariables = (template?: MessageTemplate) =>
  extractVariables(getTemplateBodyText(template)).sort(
    (a, b) => Number(a) - Number(b)
  );

export const getTemplateBodyExample = (
  template: MessageTemplate | undefined,
  key: string
) => {
  const examples = getBodyComponent(template?.components || [])?.example
    ?.body_text;
  const sampleValues = Array.isArray(examples?.[0]) ? examples?.[0] : examples;
  return Array.isArray(sampleValues)
    ? String(sampleValues[Number(key) - 1] || "")
    : "";
};

export const defaultVariableMapping = (
  key: string
): BroadcastVariableMapping => ({
  source: key === "1" ? "subscriber_field" : "literal",
  path: key === "1" ? "firstName" : "",
  fallback: key === "1" ? "Valued Customer" : "",
  literal: ""
});

export type BuildBroadcastComponentsResult =
  | { ok: true; components: Array<Record<string, unknown>> }
  | { ok: false; error: string };

// Returns a discriminated result instead of toasting directly -- keeps this
// a pure function of its inputs (and testable as one), with the caller
// deciding how/whether to surface `error`.
export const buildBroadcastComponents = (
  variables: string[],
  mappings: Record<string, BroadcastVariableMapping>
): BuildBroadcastComponentsResult => {
  if (!variables.length) return { ok: true, components: [] };

  for (const key of variables) {
    const mapping = mappings[key] || defaultVariableMapping(key);
    if (mapping.source === "literal" && !mapping.literal.trim()) {
      return { ok: false, error: `Add a value for {{${key}}}` };
    }
    if (mapping.source === "metadata_field" && !mapping.path.trim()) {
      return { ok: false, error: `Add a metadata path for {{${key}}}` };
    }
  }

  const parameters = variables.map((key) => {
    const mapping = mappings[key] || defaultVariableMapping(key);

    if (mapping.source === "literal") {
      return {
        type: "text",
        value: {
          source: "literal",
          text: mapping.literal.trim()
        }
      };
    }

    if (mapping.source === "metadata_field") {
      return {
        type: "text",
        value: {
          source: "metadata_field",
          path: mapping.path.trim(),
          fallback: mapping.fallback.trim() || undefined
        }
      };
    }

    return {
      type: "text",
      value: {
        source: "subscriber_field",
        path: mapping.path || "firstName",
        fallback: mapping.fallback.trim() || undefined
      }
    };
  });

  return {
    ok: true,
    components: [
      {
        type: "body",
        parameters
      }
    ]
  };
};
