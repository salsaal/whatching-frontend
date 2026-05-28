import {
  MessageTemplate,
  TemplateDraft,
  TemplateButton,
  TemplateComponent
} from "@/api/types/templates.type";

export const templateStatuses = [
  "ALL",
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ACTION_REQUIRED"
] as const;

export type TemplateStatusFilter = (typeof templateStatuses)[number];

export const statusLabel = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getBodyComponent = (components: TemplateComponent[]) =>
  components.find((component) => component.type === "BODY");

export const getHeaderComponent = (components: TemplateComponent[]) =>
  components.find((component) => component.type === "HEADER");

export const getFooterComponent = (components: TemplateComponent[]) =>
  components.find((component) => component.type === "FOOTER");

export const getButtonsComponent = (components: TemplateComponent[]) =>
  components.find((component) => component.type === "BUTTONS");

export const getTemplateType = (template: MessageTemplate) => {
  const header = getHeaderComponent(template.components);

  if (!header) return "TEXT";
  if (header.format === "TEXT") return "TEXT";
  return header.format || "TEXT";
};

export const templateNeedsMedia = (template: MessageTemplate) => {
  const header = getHeaderComponent(template.components);
  if (
    !header ||
    !["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format || "")
  ) {
    return false;
  }

  return !header.mediaId && !template.defaultMediaId;
};

export const getTemplateButtons = (components: TemplateComponent[]) =>
  getButtonsComponent(components)?.buttons || [];

export const extractVariables = (text: string) => {
  const variables = text.match(/{{\d+}}/g) || [];
  return Array.from(new Set(variables)).map((variable) =>
    variable.replace(/[{}]/g, "")
  );
};

export const applyVariableExamples = (
  text: string,
  examples: Record<string, string>
) =>
  text.replace(/{{(\d+)}}/g, (_, key: string) => examples[key] || `{{${key}}}`);

export const buildButtonsComponent = (buttons: TemplateButton[]) =>
  buttons.length
    ? ({
        type: "BUTTONS",
        buttons
      } as TemplateComponent)
    : null;

export const mapDraftToTemplate = (draft: TemplateDraft): MessageTemplate => ({
  _id: draft._id,
  templateId: draft.metaTemplateId || draft.templateId || draft._id,
  draftId: draft._id,
  orgId: draft.orgId,
  name: draft.name,
  language: draft.language,
  category: draft.category,
  status:
    draft.status === "draft"
      ? "DRAFT"
      : draft.status === "pending_review"
        ? "PENDING"
        : draft.status,
  components: draft.components,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  metaTemplateId: draft.metaTemplateId,
  allowCategoryChange: draft.allowCategoryChange,
  defaultMediaId: draft.defaultMediaId,
  source: "draft"
});

export const getTemplateEditId = (template: MessageTemplate) =>
  template.source === "draft"
    ? template.draftId || template._id
    : template.templateId;

export const isPendingTemplate = (template: MessageTemplate) =>
  template.status.toUpperCase() === "PENDING" ||
  template.status.toLowerCase() === "pending_review";
