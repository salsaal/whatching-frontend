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
  CONNECT_META_EMBEDDED_SIGNUP: `${ORGANIZATIONS_BASE}/connect-meta/embedded-signup`,
  SYNC_INTEGRATION: `${ORGANIZATIONS_BASE}/integration/sync`,
  TEAM: `${ORGANIZATIONS_BASE}/team`,
  ADD_AGENT: `${ORGANIZATIONS_BASE}/add-agent`,
  TEAM_MEMBER: (membershipId: string) =>
    `${ORGANIZATIONS_BASE}/team/${membershipId}`,
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

const BOT_BASE = `${ORGANIZATIONS_BASE}/bot`;

export const BOT_ENDPOINTS = {
  SETTINGS: `${BOT_BASE}/settings`,
  CANVAS_DRAFT: `${BOT_BASE}/canvas/draft`,
  CANVAS_VALIDATE: `${BOT_BASE}/canvas/validate`,
  CANVAS_PUBLISH: `${BOT_BASE}/canvas/publish`,
  CANVAS_PUBLISHED: `${BOT_BASE}/canvas/published`,
  KNOWLEDGE_SOURCES: `${BOT_BASE}/knowledge-sources`,
  KNOWLEDGE_TEXT: `${BOT_BASE}/knowledge-sources/text`,
  KNOWLEDGE_UPLOAD: `${BOT_BASE}/knowledge-sources/upload`,
  KNOWLEDGE_SOURCE_BY_ID: (sourceId: string) =>
    `${BOT_BASE}/knowledge-sources/${sourceId}`,
  KNOWLEDGE_REINGEST: (sourceId: string) =>
    `${BOT_BASE}/knowledge-sources/${sourceId}/reingest`,
  STATUS: `${BOT_BASE}/status`
};

const CHAT_BASE = `${ORGANIZATIONS_BASE}/chat`;
const CONVERSATIONS_BASE = `${ORGANIZATIONS_BASE}/conversations`;
const MESSAGES_BASE = `${ORGANIZATIONS_BASE}/messages`;

export const CHAT_ENDPOINTS = {
  BOOTSTRAP: `${CHAT_BASE}/bootstrap`
};

export const CONVERSATION_ENDPOINTS = {
  GET_ALL: CONVERSATIONS_BASE,
  GET_BY_ID: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}`,
  MESSAGES: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}/messages`,
  CONTEXT: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}/context`,
  ASSIGN: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}/assign`,
  STATUS: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}/status`,
  READ: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}/read`,
  REPLY: (conversationId: string) =>
    `${CONVERSATIONS_BASE}/${conversationId}/reply`
};

export const MESSAGE_ENDPOINTS = {
  TEMPLATE_SEND: `${MESSAGES_BASE}/template-send`
};

const INSTAGRAM_BASE = `${ORGANIZATIONS_BASE}/instagram`;

export const INSTAGRAM_ENDPOINTS = {
  STATUS: `${INSTAGRAM_BASE}/status`,
  CONNECT_MANUAL: `${INSTAGRAM_BASE}/connect-manual`,
  SYNC: `${INSTAGRAM_BASE}/sync`,
  DISCONNECT: `${INSTAGRAM_BASE}/disconnect`,
  MEDIA: `${INSTAGRAM_BASE}/media`,
  MEDIA_SYNC: `${INSTAGRAM_BASE}/media/sync`,
  CANVAS_DRAFT: `${INSTAGRAM_BASE}/canvas/draft`,
  CANVAS_VALIDATE: `${INSTAGRAM_BASE}/canvas/validate`,
  CANVAS_PUBLISH: `${INSTAGRAM_BASE}/canvas/publish`,
  CANVAS_PUBLISHED: `${INSTAGRAM_BASE}/canvas/published`,
  FLOWS: `${INSTAGRAM_BASE}/flows`,
  FLOW_BY_ID: (flowId: string) => `${INSTAGRAM_BASE}/flows/${flowId}`,
  FLOW_PUBLISH: (flowId: string) =>
    `${INSTAGRAM_BASE}/flows/${flowId}/publish`,
  FLOW_ARCHIVE: (flowId: string) =>
    `${INSTAGRAM_BASE}/flows/${flowId}/archive`,
  COMMENT_RULES: `${INSTAGRAM_BASE}/comment-rules`,
  COMMENT_RULE_BY_ID: (ruleId: string) =>
    `${INSTAGRAM_BASE}/comment-rules/${ruleId}`,
  COMMENT_RULE_ENABLE: (ruleId: string) =>
    `${INSTAGRAM_BASE}/comment-rules/${ruleId}/enable`,
  COMMENT_RULE_DISABLE: (ruleId: string) =>
    `${INSTAGRAM_BASE}/comment-rules/${ruleId}/disable`,
  AUTOMATION_LOGS: `${INSTAGRAM_BASE}/automation-logs`
};
