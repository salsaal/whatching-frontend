// Every value a template needs when it's sent -- body {{n}}, a header text
// {{1}}, a dynamic link button and a copy-code button -- as one list of
// "slots". The broadcast wizard, the inbox and the preview all work from
// this, and the components built here match what the backend checks
// (findMissingTemplateParameters) and resolves per contact.

import { TemplateComponent } from "@/client-api/types/templates.type";

export type SlotScope = "body" | "header" | "button";

export interface TemplateVariableSlot {
  /** Stable id: "body:1", "header:1", "button:2". */
  id: string;
  scope: SlotScope;
  key: string;
  label: string;
  sample: string;
  buttonIndex?: number;
  buttonSubType?: "url" | "copy_code";
  /** Copy codes are always fixed text. */
  literalOnly?: boolean;
}

export type VariableSource = "subscriber_field" | "literal" | "metadata_field";

export interface VariableMapping {
  source: VariableSource;
  path: string;
  fallback: string;
  literal: string;
}

export interface ContactLike {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  waId?: string;
}

export const contactFieldOptions = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "fullName", label: "Full name" },
  { value: "phoneNumber", label: "Phone" }
] as const;

const PLACEHOLDER = /{{\s*([\w.]+)\s*}}/g;

const placeholderKeys = (text?: string) => {
  const keys: string[] = [];
  for (const match of String(text || "").matchAll(PLACEHOLDER)) {
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  return keys.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
};

const asSampleList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const first = value[0];
  return (Array.isArray(first) ? first : value).map((item) =>
    String(item ?? "")
  );
};

const find = (
  components: TemplateComponent[],
  type: TemplateComponent["type"]
) => components.find((component) => component.type === type);

export const getTemplateVariableSlots = (
  components: TemplateComponent[] = []
): TemplateVariableSlot[] => {
  const slots: TemplateVariableSlot[] = [];

  const header = find(components, "HEADER");
  if (header?.format === "TEXT") {
    const samples = asSampleList(
      (header.example as { header_text?: unknown } | undefined)?.header_text
    );
    placeholderKeys(header.text).forEach((key, index) =>
      slots.push({
        id: `header:${key}`,
        scope: "header",
        key,
        label: `Header {{${key}}}`,
        sample: samples[index] || ""
      })
    );
  }

  const body = find(components, "BODY");
  const bodySamples = asSampleList(body?.example?.body_text);
  placeholderKeys(body?.text).forEach((key, index) =>
    slots.push({
      id: `body:${key}`,
      scope: "body",
      key,
      label: `{{${key}}}`,
      sample: bodySamples[Number(key) - 1] ?? bodySamples[index] ?? ""
    })
  );

  const buttons = find(components, "BUTTONS")?.buttons || [];
  buttons.forEach((button, index) => {
    if (button.type === "URL" && placeholderKeys(button.url).length) {
      slots.push({
        id: `button:${index}`,
        scope: "button",
        key: "1",
        label: `Link in "${button.text || "Website"}"`,
        sample: String(button.example?.[0] || ""),
        buttonIndex: index,
        buttonSubType: "url"
      });
    }
    if (button.type === "COPY_CODE") {
      const example = (button as { example?: unknown }).example;
      slots.push({
        id: `button:${index}`,
        scope: "button",
        key: "1",
        label: "Offer code",
        sample: String(
          Array.isArray(example) ? (example[0] ?? "") : (example ?? "")
        ),
        buttonIndex: index,
        buttonSubType: "copy_code",
        literalOnly: true
      });
    }
  });

  return slots;
};

export const defaultMappingForSlot = (
  slot: TemplateVariableSlot
): VariableMapping =>
  slot.scope === "body" && slot.key === "1" && !slot.literalOnly
    ? {
        source: "subscriber_field",
        path: "firstName",
        fallback: "there",
        literal: ""
      }
    : { source: "literal", path: "", fallback: "", literal: "" };

export const isMappingComplete = (mapping?: VariableMapping) =>
  Boolean(
    mapping &&
      (mapping.source === "literal"
        ? mapping.literal.trim()
        : mapping.path.trim())
  );

const contactField = (
  contact: ContactLike | null | undefined,
  path: string
) => {
  if (!contact) return "";
  if (path === "fullName") {
    return [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return String((contact as Record<string, unknown>)[path] ?? "").trim();
};

const fieldLabel = (path: string) =>
  contactFieldOptions.find((option) => option.value === path)?.label || path;

/**
 * What a slot will read as. With a contact, the contact's value (or the
 * fallback, or the backend's own default); without one, the template
 * sample so the preview stays readable.
 */
export const resolveSlotValue = (
  slot: TemplateVariableSlot,
  mapping: VariableMapping | undefined,
  contact?: ContactLike | null
): { text: string; isPlaceholder: boolean } => {
  if (!mapping || !isMappingComplete(mapping)) {
    return { text: slot.sample || `{{${slot.key}}}`, isPlaceholder: true };
  }
  if (mapping.source === "literal") {
    return { text: mapping.literal.trim(), isPlaceholder: false };
  }
  if (contact) {
    const value =
      contactField(contact, mapping.path) || mapping.fallback.trim();
    const isName = ["firstName", "lastName", "fullName"].includes(mapping.path);
    return { text: value || (isName ? "there" : "-"), isPlaceholder: false };
  }
  return {
    text:
      slot.sample || mapping.fallback.trim() || `[${fieldLabel(mapping.path)}]`,
    isPlaceholder: false
  };
};

/** Preview values keyed by slot id, for <WhatsAppPreview variableValues>. */
export const resolvePreviewValues = (
  slots: TemplateVariableSlot[],
  mappings: Record<string, VariableMapping>,
  contact?: ContactLike | null
) =>
  Object.fromEntries(
    slots.map((slot) => [
      slot.id,
      resolveSlotValue(slot, mappings[slot.id], contact).text
    ])
  );

const dynamicParameter = (mapping: VariableMapping) =>
  mapping.source === "literal"
    ? {
        type: "text",
        value: { source: "literal", text: mapping.literal.trim() }
      }
    : {
        type: "text",
        value: {
          source: mapping.source,
          path: mapping.path.trim(),
          fallback: mapping.fallback.trim() || undefined
        }
      };

export type BuildComponentsResult =
  | { ok: true; components: Array<Record<string, unknown>> }
  | { ok: false; error: string; slotId: string };

/** Broadcast send components (per-contact values are resolved server-side). */
export const buildBroadcastTemplateComponents = (
  slots: TemplateVariableSlot[],
  mappings: Record<string, VariableMapping>
): BuildComponentsResult => {
  for (const slot of slots) {
    if (!isMappingComplete(mappings[slot.id])) {
      return {
        ok: false,
        error:
          slot.buttonSubType === "copy_code"
            ? "Add the offer code for the copy-code button."
            : `Fill ${slot.label} before continuing.`,
        slotId: slot.id
      };
    }
  }

  const components: Array<Record<string, unknown>> = [];
  const headerSlots = slots.filter((slot) => slot.scope === "header");
  if (headerSlots.length) {
    components.push({
      type: "header",
      parameters: headerSlots.map((slot) => dynamicParameter(mappings[slot.id]))
    });
  }
  const bodySlots = slots.filter((slot) => slot.scope === "body");
  if (bodySlots.length) {
    components.push({
      type: "body",
      parameters: bodySlots.map((slot) => dynamicParameter(mappings[slot.id]))
    });
  }
  slots
    .filter((slot) => slot.scope === "button")
    .forEach((slot) => {
      const mapping = mappings[slot.id];
      components.push({
        type: "button",
        sub_type: slot.buttonSubType,
        index: String(slot.buttonIndex),
        parameters:
          slot.buttonSubType === "copy_code"
            ? [{ type: "coupon_code", coupon_code: mapping.literal.trim() }]
            : [dynamicParameter(mapping)]
      });
    });

  return { ok: true, components };
};

/**
 * Rebuild mappings from a sent broadcast's components, so "Duplicate"
 * reopens with the same variables.
 */
export const mappingsFromComponents = (
  slots: TemplateVariableSlot[],
  components: unknown[] = []
): Record<string, VariableMapping> => {
  const result: Record<string, VariableMapping> = {};
  const list = components as Array<Record<string, unknown>>;
  const paramsFor = (slot: TemplateVariableSlot) => {
    const match = list.find((component) =>
      slot.scope === "button"
        ? component.type === "button" &&
          String(component.index) === String(slot.buttonIndex)
        : component.type === slot.scope
    );
    return Array.isArray(match?.parameters)
      ? (match.parameters as Array<Record<string, unknown>>)
      : [];
  };
  ["header", "body", "button"].forEach((scope) => {
    const scoped = slots.filter((slot) => slot.scope === scope);
    scoped.forEach((slot, index) => {
      const params = paramsFor(slot);
      const parameter = slot.scope === "button" ? params[0] : params[index];
      if (!parameter) return;
      if (parameter.type === "coupon_code") {
        result[slot.id] = {
          source: "literal",
          path: "",
          fallback: "",
          literal: String(parameter.coupon_code || "")
        };
        return;
      }
      const value = parameter.value as Record<string, unknown> | undefined;
      if (!value) {
        if (typeof parameter.text === "string") {
          result[slot.id] = {
            source: "literal",
            path: "",
            fallback: "",
            literal: parameter.text
          };
        }
        return;
      }
      result[slot.id] = {
        source: (value.source as VariableSource) || "literal",
        path: String(value.path || ""),
        fallback: String(value.fallback || ""),
        literal: String(value.text || "")
      };
    });
  });
  return result;
};
