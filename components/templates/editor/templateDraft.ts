// Pure helpers for the template editor: turn its state into Meta template
// components (used for both the live preview and the saved payload) and
// work out the pre-submit checklist.

import {
  MessageTemplate,
  TemplateButton,
  TemplateComponent,
  TemplateCreationType,
  TemplateHeaderFormat
} from "@/client-api/types/templates.type";

export type HeaderChoice = "NONE" | TemplateHeaderFormat;
export type EditorSection = "basics" | "content" | "buttons" | "review";

export const MEDIA_HEADERS: HeaderChoice[] = ["IMAGE", "VIDEO", "DOCUMENT"];
export const MAX_TOTAL_BUTTONS = 10;
export const MAX_URL_BUTTONS = 2;
export const MAX_PHONE_BUTTONS = 1;
export const MAX_COPY_CODE_BUTTONS = 1;
export const MAX_CAROUSEL_CARD_BUTTONS = 2;
export const MAX_BUTTON_LABEL = 25;
export const MAX_FOOTER = 60;
export const MAX_HEADER_TEXT = 60;
export const MAX_BODY = 1024;

/** A button as the editor holds it: Meta's fields plus our sample inputs. */
export interface ButtonDraft extends TemplateButton {
  /** Full sample link when the URL has {{1}}. */
  sample?: string;
  /** The offer code for a copy-code button. */
  code?: string;
}

export interface CarouselCardDraft {
  mediaId: string;
  mediaName: string;
  mediaUrl: string;
}

export interface TemplateEditorState {
  name: string;
  templateType: TemplateCreationType;
  headerFormat: HeaderChoice;
  headerText: string;
  headerSample: string;
  /** Location link, or a stored media handle. */
  headerExampleUrl: string;
  selectedMediaId: string;
  /** The handle Meta already has, reusable while editing the same type. */
  existingHeaderHandle: string;
  offerText: string;
  carouselCards: CarouselCardDraft[];
  bodyText: string;
  bodyExamples: Record<string, string>;
  footerText: string;
  supportsFooter: boolean;
  buttons: ButtonDraft[];
}

export const sanitizeTemplateName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

export const isValidTemplateName = (value: string) =>
  /^[a-z0-9_]{1,512}$/.test(value);

export const variableKeys = (text: string) => {
  const keys: string[] = [];
  for (const match of String(text || "").matchAll(/{{\s*(\d+)\s*}}/g)) {
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  return keys.sort((a, b) => Number(a) - Number(b));
};

const hasVariable = (text?: string) => /{{\s*\d+\s*}}/.test(String(text || ""));

/** Structure from components (header alone can't tell a carousel apart). */
export const inferTemplateType = (
  template: MessageTemplate
): TemplateCreationType => {
  const types = template.components.map((component) => component.type);
  if (types.includes("CAROUSEL")) return "CAROUSEL";
  if (types.includes("LIMITED_TIME_OFFER")) return "LIMITED_TIME_OFFER";
  const header = template.components.find(
    (component) => component.type === "HEADER"
  );
  if (header?.format && header.format !== "TEXT") return header.format;
  return "TEXT";
};

/** Editor buttons from stored ones (samples and codes pulled out). */
export const buttonsFromTemplate = (
  buttons: TemplateButton[] = []
): ButtonDraft[] =>
  buttons.map((button) => {
    const example = (button as { example?: unknown }).example;
    const first = Array.isArray(example)
      ? String(example[0] ?? "")
      : String(example ?? "");
    if (button.type === "QUICK_REPLY") {
      return { type: "QUICK_REPLY", text: button.text || "" };
    }
    if (button.type === "URL") {
      return {
        type: "URL",
        text: button.text || "",
        url: button.url || "",
        sample: first
      };
    }
    if (button.type === "COPY_CODE") {
      return { type: "COPY_CODE", text: "", code: first };
    }
    return { ...button };
  });

const cleanButtons = (buttons: ButtonDraft[], forPreview: boolean) =>
  buttons
    .filter(
      (button) =>
        forPreview || button.type === "COPY_CODE" || button.text.trim()
    )
    .map((button): TemplateButton => {
      switch (button.type) {
        case "URL": {
          const url = (button.url || "").trim();
          return {
            type: "URL",
            text: button.text.trim(),
            url,
            ...(hasVariable(url) && button.sample?.trim()
              ? { example: [button.sample.trim()] }
              : {})
          };
        }
        case "PHONE_NUMBER":
          return {
            type: "PHONE_NUMBER",
            text: button.text.trim(),
            phone_number: (button.phone_number || "").trim()
          };
        case "COPY_CODE":
          // Meta takes the code as a plain string example; the label is fixed.
          return {
            type: "COPY_CODE",
            example: (button.code || "").trim() as unknown as string[]
          } as TemplateButton;
        default:
          return { type: button.type, text: button.text.trim() };
      }
    });

/**
 * Meta template components from editor state. `forPreview` keeps
 * half-filled buttons so the preview shows what's being typed.
 */
export const composeTemplateComponents = (
  state: TemplateEditorState,
  { forPreview = false }: { forPreview?: boolean } = {}
): TemplateComponent[] => {
  const components: TemplateComponent[] = [];
  const bodyVars = variableKeys(state.bodyText);
  const isCarousel = state.templateType === "CAROUSEL";

  if (state.templateType === "LIMITED_TIME_OFFER") {
    components.push({
      type: "LIMITED_TIME_OFFER",
      limited_time_offer: {
        text: state.offerText.trim() || "Limited-time offer",
        has_expiration: true
      }
    });
  }

  if (isCarousel) {
    const cardButtons = cleanButtons(state.buttons, forPreview).slice(
      0,
      MAX_CAROUSEL_CARD_BUTTONS
    );
    components.push({
      type: "CAROUSEL",
      cards: state.carouselCards.map((card) => ({
        components: [
          {
            type: "HEADER",
            format: "IMAGE",
            ...(card.mediaId ? { mediaId: card.mediaId } : {}),
            ...(forPreview && card.mediaUrl
              ? { example: { header_handle: [card.mediaUrl] } }
              : {})
          },
          { type: "BODY", text: state.bodyText.trim() },
          ...(cardButtons.length
            ? [{ type: "BUTTONS" as const, buttons: cardButtons }]
            : [])
        ]
      }))
    });
  }

  if (state.headerFormat !== "NONE" && !isCarousel) {
    if (state.headerFormat === "TEXT") {
      const text = forPreview ? state.headerText : state.headerText.trim();
      components.push({
        type: "HEADER",
        format: "TEXT",
        text,
        ...(hasVariable(text)
          ? { example: { header_text: [state.headerSample.trim()] } as never }
          : {})
      });
    } else if (MEDIA_HEADERS.includes(state.headerFormat)) {
      components.push({
        type: "HEADER",
        format: state.headerFormat,
        ...(state.selectedMediaId
          ? { mediaId: state.selectedMediaId }
          : state.existingHeaderHandle
            ? { example: { header_handle: [state.existingHeaderHandle] } }
            : {})
      });
    } else {
      components.push({
        type: "HEADER",
        format: state.headerFormat,
        ...(state.headerExampleUrl.trim()
          ? { example: { header_handle: [state.headerExampleUrl.trim()] } }
          : {})
      });
    }
  }

  components.push({
    type: "BODY",
    text: forPreview ? state.bodyText : state.bodyText.trim(),
    ...(bodyVars.length
      ? {
          example: {
            body_text: [
              bodyVars.map(
                (key) =>
                  state.bodyExamples[key]?.trim() ||
                  (forPreview ? "" : "Sample")
              )
            ]
          }
        }
      : {})
  });

  if (state.supportsFooter && state.footerText.trim()) {
    components.push({ type: "FOOTER", text: state.footerText.trim() });
  }

  if (!isCarousel) {
    const buttons = cleanButtons(state.buttons, forPreview);
    if (buttons.length) components.push({ type: "BUTTONS", buttons });
  }

  return components;
};

export interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  section: EditorSection;
  /** Why it isn't ok yet (for the disabled button's tooltip). */
  problem?: string;
}

const isHttpUrl = (value: string) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(value);
const isPhone = (value: string) =>
  /^\+?[1-9]\d{6,14}$/.test(value.replace(/[\s-]/g, ""));

export const buttonProblems = (state: TemplateEditorState): string[] => {
  const problems: string[] = [];
  const buttons = state.buttons;
  const labelled = buttons.filter((button) => button.type !== "COPY_CODE");
  if (labelled.some((button) => !button.text.trim()))
    problems.push("Every button needs a label");
  const labels = labelled
    .map((button) => button.text.trim().toLowerCase())
    .filter(Boolean);
  if (new Set(labels).size !== labels.length)
    problems.push("Button labels must be unique");
  buttons.forEach((button) => {
    if (button.type === "URL") {
      const url = (button.url || "").trim();
      if (!isHttpUrl(url.replace(/{{\s*1\s*}}/, "x")))
        problems.push("Website buttons need a full https:// link");
      else if (hasVariable(url) && !isHttpUrl(button.sample?.trim() || "")) {
        problems.push("Add a sample link for the website button with {{1}}");
      }
    }
    if (button.type === "PHONE_NUMBER" && !isPhone(button.phone_number || "")) {
      problems.push("Call buttons need a phone number with the country code");
    }
    if (button.type === "COPY_CODE" && !button.code?.trim()) {
      problems.push("Add the offer code for the copy-code button");
    }
  });
  const count = (type: string) =>
    buttons.filter((button) => button.type === type).length;
  const max =
    state.templateType === "CAROUSEL"
      ? MAX_CAROUSEL_CARD_BUTTONS
      : MAX_TOTAL_BUTTONS;
  if (buttons.length > max) problems.push(`Use at most ${max} buttons`);
  if (count("URL") > MAX_URL_BUTTONS)
    problems.push("Use at most 2 website buttons");
  if (count("PHONE_NUMBER") > MAX_PHONE_BUTTONS)
    problems.push("Use at most 1 call button");
  if (count("COPY_CODE") > MAX_COPY_CODE_BUTTONS)
    problems.push("Use at most 1 copy-code button");
  return Array.from(new Set(problems));
};

export const buildChecklist = (state: TemplateEditorState): ChecklistItem[] => {
  const bodyVars = variableKeys(state.bodyText);
  const headerVars =
    state.headerFormat === "TEXT" ? variableKeys(state.headerText) : [];
  const missingSamples =
    bodyVars.some((key) => !state.bodyExamples[key]?.trim()) ||
    (headerVars.length > 0 && !state.headerSample.trim());
  const headerVarProblem =
    headerVars.length > 1 || (headerVars.length === 1 && headerVars[0] !== "1");

  let mediaOk = true;
  let mediaLabel = "Header media selected";
  if (state.templateType === "CAROUSEL") {
    mediaOk = state.carouselCards.every((card) => card.mediaId);
    mediaLabel = "Every carousel card has an image";
  } else if (MEDIA_HEADERS.includes(state.headerFormat)) {
    mediaOk = Boolean(state.selectedMediaId || state.existingHeaderHandle);
  } else if (state.headerFormat === "LOCATION") {
    mediaOk = Boolean(state.headerExampleUrl.trim());
    mediaLabel = "Sample location chosen";
  } else if (state.headerFormat === "TEXT") {
    mediaOk = Boolean(state.headerText.trim()) && !headerVarProblem;
    mediaLabel = "Header text filled in";
  }

  const problems = buttonProblems(state);
  const items: ChecklistItem[] = [
    {
      id: "name",
      label: "Name is valid",
      ok: isValidTemplateName(state.name),
      section: "basics",
      problem:
        "Give the template a name (lowercase letters, numbers, underscores)"
    },
    {
      id: "body",
      label: "Body has text",
      ok: Boolean(state.bodyText.trim()) && state.bodyText.length <= MAX_BODY,
      section: "content",
      problem: "Write the message body"
    },
    {
      id: "samples",
      label: "Every variable has a sample",
      ok: !missingSamples,
      section: "content",
      problem: "Add a sample for every variable"
    }
  ];
  if (state.headerFormat !== "NONE" || state.templateType === "CAROUSEL") {
    items.push({
      id: "media",
      label: mediaLabel,
      ok: mediaOk,
      section: "content",
      problem:
        state.headerFormat === "TEXT" && headerVarProblem
          ? "The header can use one variable, {{1}}"
          : mediaLabel
    });
  }
  items.push(
    {
      id: "buttons",
      label: "Buttons valid (labels, links, limits)",
      ok: problems.length === 0,
      section: "buttons",
      problem: problems[0]
    },
    {
      id: "footer",
      label: `Footer is ${MAX_FOOTER} characters or fewer`,
      ok: !state.supportsFooter || state.footerText.length <= MAX_FOOTER,
      section: "content",
      problem: "Shorten the footer"
    }
  );
  return items;
};

/** Gentle body warnings Meta often rejects for; they don't block submit. */
export const bodyWarnings = (bodyText: string): string[] => {
  const text = bodyText.trim();
  const warnings: string[] = [];
  if (!text) return warnings;
  if (/^{{\s*\d+\s*}}/.test(text) || /{{\s*\d+\s*}}[.!?]?$/.test(text)) {
    warnings.push("Avoid starting or ending the message with a variable.");
  }
  if (/}}\s*{{/.test(text)) {
    warnings.push(
      "Two variables sit next to each other; add words between them."
    );
  }
  const keys = variableKeys(text);
  const words = text
    .replace(/{{\s*\d+\s*}}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  if (keys.length > 0 && keys.length > Math.max(1, words / 10)) {
    warnings.push("Meta may reject templates that are mostly variables.");
  }
  const expected = keys.map((_, index) => String(index + 1));
  if (keys.join(",") !== expected.join(",")) {
    warnings.push("Number variables in order: {{1}}, {{2}}, {{3}}…");
  }
  return warnings;
};
