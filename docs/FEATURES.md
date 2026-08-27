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

- `/instagram` handles Instagram professional account status, Instagram Login connection, sync, disconnect, media sync, canvas listing/building, and comment automation.
- Uses `NEXT_PUBLIC_INSTAGRAM_APP_ID`.
- Reviewer/product wording should keep Instagram Login separate from WhatsApp Embedded Signup.

## Instagram Message Flows

Supported trigger types:

- Default
- First DM
- Keyword
- Story reply
- Comment private reply opened
- Manual start

Supported block types:

- Send text
- Send image
- Send video
- Quick replies
- Button template
- Generic template
- Follower check
- Tag subscriber
- Handoff to agent
- Pause automation
- End flow

Follower check routes users based on:

- follows the business;
- does not follow the business;
- follower status unknown.

Preview is intentionally not shown for non-message/control blocks such as tag subscriber, handoff, pause, and end flow.

## Instagram Comment Automation

- Comment automation records are backend `comment-rules`.
- The UI labels them as comment automation for users.
- The main Instagram Comment Automation tab is temporarily disabled in the frontend and shows a "Coming soon" tooltip.
- The underlying modal/forms still align with backend rule fields and bound public/private reply textareas to keep long content scrollable.
- Automations support enabled/disabled states, archive/delete flow, keyword chips, public replies, private replies, all-media or specific-media scope, and Instagram media selection when the tab is re-enabled.
- Specific-media scope stores selected Instagram media IDs.
- Backend worker normalizes media IDs and supports comment webhook matching.
- Paginated Instagram flows, media, and comment rules deduplicate IDs across pages.

## Settings

- Main settings page exists.
- Billing page uses backend billing/subscription endpoints.
- Plans are selected on `/plans`; paid checkout runs on `/checkout` with base price, 18% GST, total amount, and backend-required India billing profile fields before opening Razorpay. GSTIN is optional and the free-trial flow does not request billing details.
- `/congratulations` shows the post-checkout confirmation state, syncs backend subscription status, and links back to Overview and Billing.
- Billing settings show current plan status, next deduction date and amount for active subscriptions, remaining access for cancelled subscriptions, scheduled plan changes, pending Razorpay authorization links, and billing history.
- Agents page uses team/membership endpoints.
- Knowledge page creates text and FAQ sources and uploads titled TXT/PDF/DOCX file sources. Sources can be viewed, re-ingested, or deleted; editing is not exposed because the backend has no update route.

## Analytics

Backend has `/api/v1/organizations/analytics` and an `analyticsService`. Needs verification: no dedicated top-level frontend analytics page was found in the current page inventory, so analytics may currently be backend-only or surfaced inside another page.
