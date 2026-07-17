export type TemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "DRAFT"
  | "draft"
  | "pending_review"
  | "ACTION_REQUIRED"
  | string;

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type TemplateHeaderFormat =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "LOCATION";

export type TemplateCreationType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "LOCATION"
  | "LIMITED_TIME_OFFER"
  | "CAROUSEL";

export type TemplateButtonType =
  | "URL"
  | "PHONE_NUMBER"
  | "QUICK_REPLY"
  | "COPY_CODE"
  | "CATALOG";

export interface TemplateButton {
  type: TemplateButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface TemplateComponent {
  type:
    | "HEADER"
    | "BODY"
    | "FOOTER"
    | "BUTTONS"
    | "LIMITED_TIME_OFFER"
    | "CAROUSEL";
  format?: TemplateHeaderFormat;
  mediaId?: string;
  text?: string;
  limited_time_offer?: {
    text: string;
    has_expiration: boolean;
  };
  example?: {
    header_handle?: string[];
    body_text?: string[][] | string[];
  };
  buttons?: TemplateButton[];
  cards?: Array<{
    components: TemplateComponent[];
  }>;
}

export interface MessageTemplate {
  _id: string;
  templateId: string;
  orgId: string;
  name: string;
  language: string;
  category: TemplateCategory | string;
  status: TemplateStatus;
  components: TemplateComponent[];
  wabaId?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  __v?: number;
  source?: "meta" | "draft";
  draftId?: string;
  metaTemplateId?: string;
  allowCategoryChange?: boolean;
  defaultMediaId?: string;
}

export interface TemplatesResponse {
  status: string;
  results: number;
  data: {
    templates: MessageTemplate[];
  };
}

export interface TemplateResponse {
  status: string;
  data: {
    template: MessageTemplate;
  };
}

export interface TemplateDraft
  extends Omit<MessageTemplate, "templateId" | "wabaId"> {
  templateId?: string;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lastSubmittedAt?: string;
}

export interface DraftsResponse {
  status: string;
  results: number;
  data: {
    drafts: TemplateDraft[];
  };
}

export interface DraftResponse {
  status: string;
  data: {
    draft: TemplateDraft;
  };
}

export interface SubmitDraftResponse {
  status: string;
  data: {
    draft: TemplateDraft;
    template?: MessageTemplate;
  };
}

export interface SyncTemplatesResponse {
  status: string;
  message: string;
  data: {
    lastSyncedAt: string;
  };
}

export interface CreateTemplatePayload {
  name: string;
  language: string;
  category: TemplateCategory;
  allowCategoryChange: boolean;
  components: TemplateComponent[];
}

export type CreateDraftPayload = CreateTemplatePayload;

export interface UpdateDraftPayload {
  name?: string;
  components?: TemplateComponent[];
}

export interface UpdateApprovedTemplatePayload {
  components: TemplateComponent[];
}
