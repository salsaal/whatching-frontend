const BASE = "/users";

export const AUTH_ENDPOINTS = {
  SIGNUP: `${BASE}/signup`,
  LOGIN: `${BASE}/login`,
  ME: `${BASE}/me`,
  REFRESH_TOKEN: `${BASE}/refresh-token`,
  FORGOT_PASSWORD: `${BASE}/forgot-password`,
  RESEND_VERIFICATION: `${BASE}/resend-verification`,
  RESET_PASSWORD: `${BASE}/reset-password`,
  VERIFY_EMAIL: `${BASE}/verify`
};

const ORGANIZATIONS_BASE = "/organizations";

export const ORGANIZATION_ENDPOINTS = {
  MY_ORGANIZATIONS: `${ORGANIZATIONS_BASE}/my-organizations`,
  GET_ORGANIZATION: `${ORGANIZATIONS_BASE}/`,
  SETUP: `${ORGANIZATIONS_BASE}/setup`,
  INTEGRATION_STATUS: `${ORGANIZATIONS_BASE}/integration-status`,
  CONNECT_META: `${ORGANIZATIONS_BASE}/connect-meta`,
  SYNC_INTEGRATION: `${ORGANIZATIONS_BASE}/integration/sync`,
  BILLING_SUBSCRIBE: `${ORGANIZATIONS_BASE}/billing/subscribe`,
  BILLING_TOPUP_WALLET: `${ORGANIZATIONS_BASE}/billing/topup-wallet`,
  BILLING_HISTORY: `${ORGANIZATIONS_BASE}/billing/history`,
  BILLING_CANCEL: `${ORGANIZATIONS_BASE}/billing/cancel`
};

const TEMPLATES_BASE = "/templates";

export const TEMPLATE_ENDPOINTS = {
  GET_ALL: `${TEMPLATES_BASE}/`,
  SYNC: `${TEMPLATES_BASE}/sync`,
  CREATE: `${TEMPLATES_BASE}/`,
  DRAFTS: `${TEMPLATES_BASE}/drafts`,
  DRAFT_BY_ID: (draftId: string) => `${TEMPLATES_BASE}/drafts/${draftId}`,
  SUBMIT_DRAFT: (draftId: string) =>
    `${TEMPLATES_BASE}/drafts/${draftId}/submit`,
  GET_BY_ID: (templateId: string) => `${TEMPLATES_BASE}/${templateId}`,
  UPDATE_APPROVED: (templateId: string) => `${TEMPLATES_BASE}/${templateId}`,
  DELETE: (templateId: string) => `${TEMPLATES_BASE}/${templateId}`,
  LINK_MEDIA: (templateId: string) =>
    `${TEMPLATES_BASE}/${templateId}/link-media`
};

export const SUBSCRIBER_ENDPOINTS = {
  GET_ALL: `${ORGANIZATIONS_BASE}/subscribers`,
  GET_BY_ID: (subscriberId: string) =>
    `${ORGANIZATIONS_BASE}/subscribers/${subscriberId}`,
  UPDATE: (subscriberId: string) =>
    `${ORGANIZATIONS_BASE}/subscribers/${subscriberId}`,
  IMPORT: `${ORGANIZATIONS_BASE}/subscribers/import`,
  BULK_DELETE: `${ORGANIZATIONS_BASE}/subscribers/bulk-delete`,
  TAGS: `${ORGANIZATIONS_BASE}/tags`,
  TAG_BY_NAME: (tag: string) =>
    `${ORGANIZATIONS_BASE}/tags/${encodeURIComponent(tag)}`,
  SUBSCRIBER_TAGS: (subscriberId: string) =>
    `${ORGANIZATIONS_BASE}/subscribers/${subscriberId}/tags`,
  SUBSCRIBER_TAG_BY_NAME: (subscriberId: string, tag: string) =>
    `${ORGANIZATIONS_BASE}/subscribers/${subscriberId}/tags/${encodeURIComponent(tag)}`
};

export const MEDIA_ENDPOINTS = {
  GET_ALL: `${ORGANIZATIONS_BASE}/media`,
  UPLOAD: `${ORGANIZATIONS_BASE}/media/upload`,
  GET_BY_ID: (mediaId: string) => `${ORGANIZATIONS_BASE}/media/${mediaId}`,
  BULK_DELETE: `${ORGANIZATIONS_BASE}/media/bulk-delete`
};

export const BROADCAST_ENDPOINTS = {
  GET_ALL: `${ORGANIZATIONS_BASE}/broadcasts`,
  CREATE: `${ORGANIZATIONS_BASE}/broadcasts`,
  GET_BY_ID: (broadcastId: string) =>
    `${ORGANIZATIONS_BASE}/broadcasts/${broadcastId}`,
  START: (broadcastId: string) =>
    `${ORGANIZATIONS_BASE}/broadcasts/${broadcastId}/start`,
  CANCEL: (broadcastId: string) =>
    `${ORGANIZATIONS_BASE}/broadcasts/${broadcastId}/cancel`
};
