# Architecture

This repository is a client-side Next.js dashboard. It has no active local Next API routes; API calls go through `client-api/` to the Express backend.

## High-Level Flow

Browser UI:

1. A route in `pages/` renders inside `RouteGuard`.
2. Auth and organization state hydrate from persisted Zustand stores.
3. React Query fetches data using wrappers in `client-api/functions/`.
4. The shared Axios instance attaches `Authorization` and `x-org-id` headers.
5. The backend applies auth, organization context, roles, and permissions before controllers/services touch MongoDB or external APIs.

## Application Shell

`pages/_app.tsx` wires:

- global styles and `@xyflow/react` styles;
- TanStack Query with retry disabled, no refetch on focus/mount by default;
- a global mutation cache that shows success/error toasts and optionally invalidates query keys from mutation metadata;
- `NuqsAdapter`;
- `RouteGuard`.

`components/auth/RouteGuard.tsx` treats auth pages, `/verify/*`, `/reset-password/*`, and `/404` as public. Authenticated users on `/auth/login` are redirected to `/organisations`; unauthenticated users on private pages are redirected to login with `next`.

`layouts/AppLayout.tsx` is the authenticated shell. It owns the sidebar, mobile nav, organization/integration refresh, plan checkout modal, logout confirmation, and global WhatsApp number switcher in the header.

`layouts/AuthLayout.tsx` is the login/signup/reset shell using `public/assets/images/auth.png`.

## API Client

`client-api/axiosInstance/index.ts`:

- uses `NEXT_PUBLIC_API_BASE_URL` as `baseURL`;
- sends cookies with `withCredentials: true`;
- attaches Bearer token from Zustand or `localStorage.accessToken`;
- attaches `x-org-id` from active organization or `localStorage.orgId`;
- adds `ngrok-skip-browser-warning` when the API base URL includes `ngrok-free.app`;
- on non-auth 401, calls `/users/refresh-token`, stores the refreshed token/user, retries the original request, or logs out on refresh failure.

Endpoint constants live in `client-api/endpoints/index.ts`; typed wrappers live in `client-api/functions/`; response/payload types live in `client-api/types/`.

## State Model

`stores/authStore.ts` persists:

- `token`
- `user`
- `isAuthenticated`

It writes `accessToken` to `localStorage`, clears organization state when the authenticated user changes, and exposes `logout`.

`stores/organizationStore.ts` persists:

- `organizations`
- `activeOrganization`
- `integration`
- `ownerUserId`
- `selectedWhatsAppPhoneNumberByOrg`

It writes active organization ID to `localStorage.orgId`. On hydration, if organization state exists without an owner user ID, it clears organization state to avoid cross-user leakage.

## Multi-WhatsApp-Number Architecture

The multi-number frontend is centered on `components/whatsapp/WhatsAppNumberSwitcher.tsx`.

Key behaviour:

- `useWhatsAppNumberContext()` fetches `/organizations/whatsapp/phone-numbers`.
- Only numbers with `status === "active"` and `connectionStatus === "ready"` are usable for most send/filter operations.
- Selection is persisted per organization in `selectedWhatsAppPhoneNumberByOrg`.
- `ALL_WHATSAPP_NUMBERS` is a UI filter value, not a backend sender.
- The effective sender falls back to the default usable number when no specific number is selected.

Feature usage:

- `AppLayout` exposes the global switcher.
- `overview` manages syncing, activating, deactivating, setting default, and connecting numbers.
- `flows` shows which WhatsApp canvases are assigned to numbers and allows canvas status/assignment actions.
- `templates` checks quick reply route validity against the selected/effective number's active canvas triggers.
- `broadcasts` filters by selected number and requires an explicit sender number when creating broadcasts.
- `conversations` filters WhatsApp conversations by selected number and sends replies/templates using the conversation sender number.

Backend model evidence:

- `WhatsAppPhoneNumber` stores `wabaId`, `phoneNumberId`, display/verified names, active/default state, quality/limit health, coexistence state, and `activeCanvasId`.
- `Conversation` stores `whatsappPhoneNumberId` and `whatsappPhoneNumberRecordId`.
- `Broadcast` stores `whatsappPhoneNumberId`, `whatsappPhoneNumberRecordId`, display number, and messaging limit tier.

## Templates And Quick Reply Routing

WhatsApp template quick replies can map to bot canvas trigger keys.

Frontend behaviour:

- `TemplateCreateForm` fetches active/published canvas triggers using `getBotCanvasTriggers(phoneNumberId)`.
- Quick reply buttons can store `triggerKey`, `flowTriggerKey`, or `payload`; the canonical local route payload is `quickReplyRoutes: [{ index, label, triggerKey }]`.
- Template create, draft, edit, submit, approved update, and quick-route update can include `phoneNumberId`.
- `/templates` computes an Action Required state when a template has quick replies with missing or stale trigger mappings against active number trigger summaries.
- Broadcast and conversation template sends disable stale quick-route templates for the relevant sender number.

Backend evidence:

- `WhatsAppTemplate` and `TemplateDraft` contain `quickReplyRoutes`.
- `PATCH /api/v1/organizations/templates/:templateId/quick-reply-routes` updates local routing without calling Meta.
- Backend template validation is number-aware through `phoneNumberId`.

## WhatsApp Flow Architecture

WhatsApp flows are canvas records rather than only one organization-wide flow.

Frontend:

- `/flows` lists canvases and number assignments.
- `/flows/[canvasId]` is the builder.
- `components/flows/FlowBlockPreview.tsx` renders WhatsApp preview bubbles/cards for selected blocks.
- `components/flows/FlowDiagramPreviewDialog.tsx` can render the flow using preview nodes rather than editor nodes.

Supported WhatsApp block types from frontend types:

- `text`
- `buttons`
- `list`
- `image`
- `document`
- `video`
- `location`
- `location_request`
- `address_request`
- `contacts`
- `product_carousel`
- `generic_carousel`

Backend canvas published state contains a `defaultTriggerKey`, nodes, edges, and compiled indexes for triggers, replies, and keywords.

## Instagram Architecture

Instagram UI is primarily in `pages/instagram.tsx` with detail route `pages/instagram/[canvasId].tsx`.

Supported trigger types from frontend/backend types:

- `default`
- `first_dm`
- `keyword`
- `story_reply`
- `comment_private_reply_opened`
- `manual_start`

Supported Instagram canvas blocks:

- `send_text`
- `send_image`
- `send_video`
- `quick_replies`
- `button_template`
- `generic_template`
- `follow_condition`
- `tag_subscriber`
- `handoff_to_agent`
- `pause_automation`
- `end_flow`

`follow_condition` has three route fields in content:

- `followsTriggerKey`
- `notFollowsTriggerKey`
- `unknownTriggerKey`

The backend `InstagramCanvas` published state compiles trigger, reply, keyword, story reply, and comment entry indexes. The orchestrator uses Meta Instagram user profile follower data where available.

Instagram comment automation uses backend `InstagramCommentRule` records with:

- `status`: `draft`, `enabled`, `disabled`, `archived`
- `scope`: `all_media` or `specific_media`
- `mediaIds`
- `keywordMode`: `any` or `all`
- `keywords`
- public/private reply flags and text
- cooldown seconds

## Conversations

Conversations support WhatsApp and Instagram channels. The frontend list supports filters for status, assignee, priority, mode, unread, escalation, search, channel, and WhatsApp phone number.

Backend model fields include:

- status: `open`, `pending`, `resolved`
- channel: `whatsapp`, `instagram`
- mode: `interactive`, `ai_fallback`, `agent_manual`
- manual takeover and handoff fields
- WhatsApp sender fields
- Instagram automation state

Replies are sent through `POST /api/v1/organizations/conversations/:conversationId/reply`; template sends use `/api/v1/organizations/messages/template-send`.

## Backend Runtime Architecture

The backend uses:

- Express routes/controllers/services/validations.
- MongoDB through Mongoose models.
- Redis/BullMQ queues and workers for webhooks, broadcasts, templates, knowledge ingestion, contact sync, conversation timeouts, and AI replies.
- Socket.IO for realtime updates.
- Meta APIs for WhatsApp/Instagram.
- Gemini for AI functionality.
- Razorpay for subscriptions/payments.
- Cloudinary for media storage.

Needs verification: exact production process manager/deployment wiring should be checked in the backend deployment docs and host config before making infrastructure changes.

## Backend API Route Inventory

The frontend endpoint constants map to these backend route groups in the sibling checkout:

Auth:

- `POST /api/v1/users/signup`
- `GET /api/v1/users/verify/:token`
- `POST /api/v1/users/resend-verification`
- `POST /api/v1/users/login`
- `POST /api/v1/users/refresh-token`
- `POST /api/v1/users/forgot-password`
- `PATCH /api/v1/users/reset-password/:token`
- `GET /api/v1/users/me`
- `GET /api/v1/users/logout`

Organizations, Meta, WhatsApp numbers, team, billing, tags:

- `POST /api/v1/organizations/setup`
- `GET /api/v1/organizations/my-organizations`
- `GET|DELETE /api/v1/organizations`
- `PATCH /api/v1/organizations/settings`
- `PATCH /api/v1/organizations/connect-meta`
- `POST /api/v1/organizations/connect-meta/embedded-signup`
- `GET /api/v1/organizations/integration-status`
- `POST /api/v1/organizations/integration/sync`
- `GET /api/v1/organizations/whatsapp/phone-numbers`
- `POST /api/v1/organizations/whatsapp/phone-numbers/sync`
- `POST /api/v1/organizations/whatsapp/phone-numbers/manual-connect`
- `GET|PATCH|DELETE /api/v1/organizations/whatsapp/phone-numbers/:phoneNumberRecordId`
- `POST /api/v1/organizations/whatsapp/phone-numbers/:phoneNumberRecordId/set-default`
- `POST /api/v1/organizations/whatsapp/phone-numbers/:phoneNumberRecordId/activate`
- `POST /api/v1/organizations/whatsapp/phone-numbers/:phoneNumberRecordId/deactivate`
- `GET /api/v1/organizations/team`
- `POST /api/v1/organizations/add-agent`
- `PATCH /api/v1/organizations/team/:membershipId/permissions`
- `DELETE /api/v1/organizations/team/:membershipId`
- `GET /api/v1/organizations/billing/history`
- `POST /api/v1/organizations/billing/subscribe`
- `POST /api/v1/organizations/billing/change-plan`
- `POST /api/v1/organizations/billing/sync`
- `POST /api/v1/organizations/billing/topup-wallet`
- `POST /api/v1/organizations/billing/cancel`
- `POST /api/v1/organizations/billing/webhook`
- `GET|POST /api/v1/organizations/tags`
- `DELETE /api/v1/organizations/tags/:tag`

Templates and messages:

- `GET|POST /api/v1/organizations/templates`
- `POST /api/v1/organizations/templates/sync`
- `GET|POST /api/v1/organizations/templates/drafts`
- `GET|PATCH|DELETE /api/v1/organizations/templates/drafts/:draftId`
- `POST /api/v1/organizations/templates/drafts/:draftId/submit`
- `GET|PATCH|DELETE /api/v1/organizations/templates/:templateId`
- `PATCH /api/v1/organizations/templates/:templateId/link-media`
- `PATCH /api/v1/organizations/templates/:templateId/quick-reply-routes`
- `POST /api/v1/organizations/messages/template-send`
- `GET /api/v1/organizations/messages/:messageId`

Conversations, chat, contacts, media, broadcasts:

- `GET /api/v1/organizations/chat/bootstrap`
- `GET /api/v1/organizations/conversations`
- `GET /api/v1/organizations/conversations/:conversationId`
- `GET /api/v1/organizations/conversations/:conversationId/messages`
- `GET /api/v1/organizations/conversations/:conversationId/context`
- `PATCH /api/v1/organizations/conversations/:conversationId/assign`
- `PATCH /api/v1/organizations/conversations/:conversationId/status`
- `PATCH /api/v1/organizations/conversations/:conversationId/read`
- `POST /api/v1/organizations/conversations/:conversationId/reply`
- `GET|POST /api/v1/organizations/subscribers`
- `POST /api/v1/organizations/subscribers/import`
- `POST /api/v1/organizations/subscribers/bulk-delete`
- `GET|PATCH|DELETE /api/v1/organizations/subscribers/:subscriberId`
- `GET /api/v1/organizations/media`
- `POST /api/v1/organizations/media/upload`
- `POST /api/v1/organizations/media/bulk-delete`
- `GET /api/v1/organizations/media/:mediaId`
- `GET|POST /api/v1/organizations/broadcasts`
- `GET /api/v1/organizations/broadcasts/:broadcastId`
- `POST /api/v1/organizations/broadcasts/:broadcastId/start`
- `POST /api/v1/organizations/broadcasts/:broadcastId/cancel`

WhatsApp bot and knowledge:

- `GET|PATCH /api/v1/organizations/bot/settings`
- `GET|PUT /api/v1/organizations/bot/canvas/draft`
- `POST /api/v1/organizations/bot/canvas/validate`
- `POST /api/v1/organizations/bot/canvas/publish`
- `GET /api/v1/organizations/bot/canvas/published`
- `GET /api/v1/organizations/bot/canvas/active-published`
- `GET|POST /api/v1/organizations/bot/canvases`
- `GET|PATCH|DELETE /api/v1/organizations/bot/canvases/:canvasId`
- `PUT /api/v1/organizations/bot/canvases/:canvasId/draft`
- `POST /api/v1/organizations/bot/canvases/:canvasId/validate`
- `POST /api/v1/organizations/bot/canvases/:canvasId/publish`
- `POST /api/v1/organizations/bot/canvases/:canvasId/status`
- `GET /api/v1/organizations/bot/knowledge-sources`
- `POST /api/v1/organizations/bot/knowledge-sources/text`
- `POST /api/v1/organizations/bot/knowledge-sources/upload`
- `DELETE /api/v1/organizations/bot/knowledge-sources/:sourceId`
- `POST /api/v1/organizations/bot/knowledge-sources/:sourceId/reingest`
- `GET /api/v1/organizations/bot/status`

Instagram:

- `GET /api/v1/instagram/webhook`
- `POST /api/v1/instagram/webhook`
- `GET /api/v1/organizations/instagram/status`
- `PATCH /api/v1/organizations/instagram/connect-manual`
- `POST /api/v1/organizations/instagram/connect-login`
- `POST /api/v1/organizations/instagram/sync`
- `POST /api/v1/organizations/instagram/disconnect`
- `GET /api/v1/organizations/instagram/media`
- `POST /api/v1/organizations/instagram/media/sync`
- `GET|PATCH /api/v1/organizations/instagram/canvas/draft`
- `POST /api/v1/organizations/instagram/canvas/validate`
- `POST /api/v1/organizations/instagram/canvas/publish`
- `GET /api/v1/organizations/instagram/canvas/published`
- `GET|POST /api/v1/organizations/instagram/canvases`
- `GET|PATCH|DELETE /api/v1/organizations/instagram/canvases/:canvasId`
- `PUT /api/v1/organizations/instagram/canvases/:canvasId/draft`
- `POST /api/v1/organizations/instagram/canvases/:canvasId/validate`
- `POST /api/v1/organizations/instagram/canvases/:canvasId/publish`
- `POST /api/v1/organizations/instagram/canvases/:canvasId/status`
- `GET|POST /api/v1/organizations/instagram/flows`
- `GET|PATCH /api/v1/organizations/instagram/flows/:flowId`
- `POST /api/v1/organizations/instagram/flows/:flowId/publish`
- `POST /api/v1/organizations/instagram/flows/:flowId/archive`
- `GET|POST /api/v1/organizations/instagram/comment-rules`
- `GET|PATCH|DELETE /api/v1/organizations/instagram/comment-rules/:ruleId`
- `POST /api/v1/organizations/instagram/comment-rules/:ruleId/enable`
- `POST /api/v1/organizations/instagram/comment-rules/:ruleId/disable`
- `GET /api/v1/organizations/instagram/automation-logs`

Analytics and public webhooks:

- `GET /api/v1/organizations/analytics/...`: exact child routes need verification from `analyticsRoutes.ts`.
- `GET /api/v1/whatsapp/webhook`
- `POST /api/v1/whatsapp/webhook`

## Backend Model Inventory

Observed Mongoose models in `../whatching-backend/src/models`:

- `User`: auth identity, verification/reset tokens, password fields.
- `Organization`: workspace, plan/subscription, wallet, Meta config, integration health, tags, settings.
- `Membership`: user role/status within an organization.
- `WhatsAppPhoneNumber`: per-org WABA number, active/default state, health, quality, coexistence, and assigned canvas.
- `WhatsAppTemplate`: synced Meta template, components, default media, quick reply routes.
- `TemplateDraft`: local draft template state before Meta submission.
- `Subscriber`: WhatsApp/Instagram contact identity, tags, opt-in and interaction metadata.
- `Conversation`: channel inbox thread, status, assignment, sender number, bot state, takeover state, Instagram automation state.
- `Message`: inbound/outbound/system message payloads, delivery status, attachments, interactive replies, sender number.
- `Broadcast`: broadcast definition, sender number, template snapshot, payload, audience, schedule, stats.
- `BroadcastRecipient`: per-recipient broadcast delivery state.
- `Media`: uploaded media metadata and Cloudinary reference.
- `BotCanvas`: WhatsApp visual canvas draft/published state.
- `BotCanvasVersion`: WhatsApp canvas version snapshots and validation output.
- `BotFlow`: legacy or node-level WhatsApp flow data. Needs verification before modifying because current UI uses `BotCanvas`.
- `BotSettings`: WhatsApp bot toggles, AI settings, default trigger key, keywords, escalation/timeout.
- `KnowledgeSource`: text/FAQ/file knowledge source metadata.
- `KnowledgeChunk`: ingested chunks for AI retrieval.
- `InstagramCanvas`: Instagram visual canvas draft/published state.
- `InstagramCanvasVersion`: Instagram canvas version snapshots.
- `InstagramFlow`: Instagram flow record. Needs verification before modifying because current UI emphasizes canvas records.
- `InstagramCommentRule`: comment automation rules.
- `InstagramMedia`: synced Instagram media metadata.
- `InstagramAutomationSettings`: Instagram automation settings/default trigger.
- `InstagramAutomationLog`: Instagram automation execution log.
- `WebhookEvent`: raw or processed webhook event tracking.
- `IntegrationLog`: integration activity/error log.
- `Transaction`: billing/wallet/subscription transaction.
