# Features

This file lists functionality visible in the current frontend and contracts present in the sibling backend. It does not describe planned features unless explicitly marked "Needs verification".

## Authentication

- Login, signup, forgot password, reset password, email verification, and token link routes.
- Auth state persists in Zustand/localStorage.
- Backend emails use frontend token routes according to backend code history; verify current deployment env before testing production email links.

## Organizations

- Users can create/select organizations.
- Authenticated pages require an active organization.
- Organization state includes plan tier, subscription status, wallet balance, usage, and Meta integration state.
- Team management exists under settings and backend membership routes.

## Overview And WhatsApp Connection

- `/overview` is the main workspace landing page after auth.
- Supports WhatsApp Embedded Signup using Meta app/config env variables.
- Connect flow extracts WABA ID and phone number ID from embedded signup callback shapes.
- Includes `WhatsAppNumbersPanel` for:
  - listing connected WhatsApp numbers;
  - syncing from backend/Meta;
  - adding another number through signup;
  - setting a default number;
  - activating/deactivating where the backend/plan allows it;
  - showing connection, quality, active alerts, plan limit, and active count.

## WhatsApp Number Switcher

- Global switcher in the app header.
- "All WhatsApp numbers" is available for list/filter contexts.
- Create/send contexts use a concrete usable number.
- Selection is remembered per organization.
- Usable numbers are active and ready.

## WhatsApp Templates

- `/templates` lists templates and drafts.
- `/templates/create` creates new templates.
- `/templates/[templateId]` edits/view templates.
- Supported template formats include text, image, video, document, location, limited time offer, and carousel.
- Supported button types include URL, phone number, quick reply, copy code, and catalog.
- Template preview exists for headers, body, footer, buttons, media, and carousel cards.
- Quick reply buttons can be mapped to active WhatsApp canvas trigger keys.
- Templates with missing/stale quick reply routes are surfaced as Action Required in the UI.
- A local-only quick reply route update endpoint exists so routing can be changed without resubmitting the Meta template.

## Broadcasts

- `/broadcasts` lists broadcasts and supports status/search/WhatsApp-number filtering.
- Broadcast creation uses a template, audience definition, payload components, and sender phone number.
- Audiences can be all subscribers, tag-based, or specific subscribers.
- Tag match can be any/all; opted-in-only is represented in payload types.
- Broadcast detail route shows broadcast metadata, stats, warnings, and recipients.
- Broadcast detail recipients load incrementally and use an infinite-query cache key distinct from the single-response preview query.
- Broadcast statuses include draft, scheduled, processing/in progress, completed, failed, and canceled.
- Quick reply route validation is applied before creating/sending broadcasts.
- The specific-subscriber picker scrolls inside the create form while the create/cancel actions remain fixed.

## WhatsApp Flow Builder

- `/flows` lists WhatsApp canvases and their active/inactive/archive state.
- `/flows/[canvasId]` is the visual builder powered by `@xyflow/react`.
- Flow blocks can be previewed from the side panel.
- Builder nodes keep explicit route rows and visible connection handles, including button and list blocks.
- Full-flow preview dialog renders preview-style nodes connected by the same routing relationships.
- WhatsApp and Instagram builders and full-flow previews render orthogonal step connections.
- Canvas state has nodes, edges, viewport, version, and `defaultTriggerKey`.
- Published state is compiled on the backend into trigger/reply/keyword indexes.

Supported WhatsApp blocks:

- Text message
- Buttons
- List menu
- Image
- Video
- Document
- Location
- Location request
- Address request
- Contacts
- Product carousel
- Generic carousel

Supported WhatsApp action types:

- Go to trigger
- Escalate to agent
- End conversation
- Open URL

## Conversations

- `/conversations` lists inbox conversations with filters and details.
- Supports WhatsApp and Instagram channels.
- Tracks status, priority, mode, unread count, reply window, assignment, manual takeover, and automation handoff state.
- WhatsApp sender information is displayed where available.
- WhatsApp conversations can be filtered by selected number.
- Replies and template sends use the conversation sender number.
- Older history loads seven messages at a time, preserves the viewport, and removes duplicate message IDs across cursor pages.
- Template sends use linked template media by default and let the agent replace it from the media library.
- Conversations with legacy/unassigned WhatsApp sender state may require backend backfill before template sends work reliably.
- Team quick replies (saved answers, not template quick-reply buttons): typing `/` in the reply box opens a filtered list from `/quick-replies`; choosing one inserts its text for the agent to edit, never sends it.
- Messages the inbox can't show use `payload.unsupported` (Meta's original kind and error code) for a specific explanation (`describeUnsupportedMessage` in `lib/inbox.ts`). Stickers (`displayType: "sticker"`) render without a bubble; reactions (`displayType: "reaction"`) show as an emoji on the message they react to, or as a small line when that message isn't loaded.
- WhatsApp customers with a WhatsApp username may have no phone number. Their name falls back to `@username` and then "WhatsApp customer"; the line under the name shows the phone, else `@username`, else nothing (`whatsappContactName` / `whatsappContactLine` in `lib/inbox.ts`, used by the inbox, contacts, broadcasts and Overview). Inbox template sends address them by `subscriberId`. Broadcasts leave them out; a recipient skipped for having no phone reads "Not sent: this customer hasn't shared their phone number." (`lib/recipientOutcome.ts`). Never display `whatsappUserIds`.
- An Instagram contact picture that fails to load asks `/subscribers/:id/instagram-picture/refresh` for a fresh link, once per contact per page load.

## Contacts

- `/contacts` lists subscribers/contacts.
- Subscriber API supports listing, detail, update, import, bulk delete, and tag management.
- Subscriber model includes phone number/WA ID, Instagram ID/username/profile picture, tags, opt-in state, metadata, and interaction timestamps.
- Infinite-scroll contact pages deduplicate subscriber IDs across overlapping/refetched pages.

## Media

- `/media` manages uploaded media.
- API supports listing, upload, detail, and bulk delete.
- Media is used by templates and flow previews.
- Backend uses Cloudinary configuration for storage. Needs verification: exact storage lifecycle and cleanup rules for production media.

## Instagram Connection

- `/instagram` handles Instagram professional account status, Instagram Login connection, sync, disconnect, media sync, the Flows list and editor, and comment automation.
- Uses `NEXT_PUBLIC_INSTAGRAM_APP_ID`.
- Reviewer/product wording should keep Instagram Login separate from WhatsApp Embedded Signup.

## Instagram Message Flows

The Flows tab (`/instagram?tab=canvas`) lists every flow with its status, block count and pending changes. Only one flow is switched on per account. The editor (`/instagram/[canvasId]`) works like the WhatsApp editor: Outline/Add rail, canvas, and a Content / Next steps / Start inspector with a floating preview. It autosaves with `baseRevision`, shows a blocking banner on a 409 conflict, checks the on-screen draft after each save, and lists every issue in the header.

Statuses, first match wins: Paused · automation is off, Draft (never applied), Ready · switched off, Active · N pending changes, Active on @username. The header's main button is Activate (never applied: apply, then switch on), Apply changes, or Up to date.

Starts (one per block): Only from other blocks, Main menu (exactly one; the greeting words from Settings), Welcome message (at most one), Keyword (1–20 whole-word keywords), Story reply (optional keywords). Legacy `manual_start` is read as "only from other blocks".

Blocks: Message, Image, Video, Quick replies (up to 13), Buttons (up to 3; answer or website), Carousel (up to 10 image-only cards), Check if they follow you, Add tag, Hand to a person, Pause automation (1 minute to 7 days), End conversation.

Message, Image, Video and Add tag have a "Then" output (handle `next`): the next block is sent straight away. Check if they follow you has Follows you / Doesn't follow you / Couldn't check (optional; unwired it takes the "Doesn't follow you" path).

Preview is intentionally not shown for control blocks such as the follower check, tag, hand-off, pause and end.

## Instagram Comment Automation

- Comment automation records are backend `comment-rules`.
- The UI labels them as comment automation for users.
- The main Instagram Comment Automation tab is temporarily disabled in the frontend and shows a "Coming soon" tooltip.
- The underlying modal/forms still align with backend rule fields and bound public/private reply textareas to keep long content scrollable.
- Automations support enabled/disabled states, archive/delete flow, keyword chips, public replies, private replies, all-media or specific-media scope, and Instagram media selection when the tab is re-enabled.
- Specific-media scope stores selected Instagram media IDs.
- Backend worker normalizes media IDs and supports comment webhook matching.
- Paginated Instagram flows, media, and comment rules deduplicate IDs across pages.

## Store (WooCommerce order messages)

- `/store` and `/store/woocommerce/return`, backed by `/organizations/stores` (`client-api/functions/stores.ts`). Spec: the backend's `docs/STORE_FRONTEND_SPEC.md`.
- Hidden until the backend answers: `useStore` (`hooks/useStore.ts`) calls `GET /organizations/stores` once; the Store menu item shows only on a 200, and the routes (`StoreGate`) go to Overview on a 404 or without `integrations:view`, with no error message. Editing needs `integrations:manage`.
- Screens (`components/store/`): plan notice, connect form (opt-in checkbox, access explanation, same-tab redirect to WooCommerce), the return page (polls every 2 s for up to 60 s; only `success` is read, `user_id` is dropped from the address bar), and the connected store: status, Check connection, Reconnect, cost note, set-up checklist (ready-made templates, sending number when there are several), a card per order message with its template, the shipped status, extra status messages (up to 10), cash on delivery, the order log (25 a page) and Disconnect.
- Settings save per change, sending only that field (`useStoreSettings`); the API's reason a template can't be used shows under its picker, and `warnings` show as toasts.
- Inbox: order messages (`payload.storeOrder`) carry a "Store · Order #1201" label above the bubble.

## Settings

- Main settings page exists.
- General: owners and admins change the business name (shown inside Whatching only) and timezone through `PATCH /settings`.
- Quick replies (`/settings/quick-replies`): owners and admins add, edit and delete; anyone who can view conversations sees the list.
- Billing page uses backend billing/subscription endpoints.
- Plans are selected on `/plans`; paid checkout runs on `/checkout` with base price, 18% GST, total amount, and backend-required India billing profile fields before opening Razorpay. GSTIN is optional and the free-trial flow does not request billing details.
- `/congratulations` shows the post-checkout confirmation state, syncs backend subscription status, and links back to Overview and Billing.
- Billing settings show current plan status, next deduction date and amount for active subscriptions, remaining access for cancelled subscriptions, scheduled plan changes, pending Razorpay authorization links, and billing history.
- Agents page uses team/membership endpoints.
- Knowledge page creates text and FAQ sources and uploads titled TXT/PDF/DOCX file sources. Sources can be viewed, re-ingested, or deleted; editing is not exposed because the backend has no update route.

## Analytics

Backend has `/api/v1/organizations/analytics` and an `analyticsService`. Needs verification: no dedicated top-level frontend analytics page was found in the current page inventory, so analytics may currently be backend-only or surfaced inside another page.
