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
- WhatsApp customers with a WhatsApp username may have no phone number. Their name falls back to `@username` and then "WhatsApp customer"; the line under the name shows the phone, else `@username`, else nothing (`whatsappContactName` / `whatsappContactLine` in `lib/inbox.ts`, used by the inbox, contacts, broadcasts and Overview). Inbox template sends address them by `subscriberId`. The contacts WhatsApp filter includes them. Broadcast recipients carry `subscriberId.whatsappUsername`, so the recipient list shows `@username` when there's no phone. Broadcast audiences still leave them out (a backend gap); a recipient skipped for having no phone reads "Not sent: this customer hasn't shared their phone number." (`lib/recipientOutcome.ts`). Never display `whatsappUserIds`.
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
- Screens (`components/store/`): plan notice, connect form (opt-in checkbox, access explanation, same-tab redirect to WooCommerce), the return page (polls every 2 s for up to 60 s; only `success` is read, `user_id` is dropped from the address bar), and the connected store (layout below).
- Layout (spec: the backend's `docs/STORE_REDESIGN_FRONTEND_SPEC.md`; helpers in `lib/storePage.ts`), under the header "WhatsApp for your online store":
  - Store card (`ConnectedStore`): name and status, address · WooCommerce · checked {time}, Check connection (hidden while `connecting`) and a "···" menu with Reconnect and Disconnect store; the setting-up note, the needs-attention banner and the check result sit under it.
  - Summary row (`StoreSummaryRow`, `GET /:id/summary`, this calendar month): Orders messaged, Cash on delivery, Carts recovered, Messages not sent ("See Activity for why" opens Activity › Orders › Not sent, or Carts when only reminders failed). Skeleton while loading; hidden on an error.
  - Tabs, kept in the URL (`/store?tab=messages|carts|activity`, plus `view=carts` and `show=not_sent|cod_waiting` for Activity; `hooks/useStoreView.ts`): Overview · Order messages · Cart reminders (only with the plugin field) · Activity.
  - Overview (`StoreOverviewTab`): "What your customers receive" (each message on or off; a row opens Order messages) and a Setup checklist that stays: store connected, templates approved ("{n} of {m}", counting turned-on messages), sending number (several numbers only; Choose a number / Change opens a picker), cart reminders. Steps that need action get an amber mark and a button.
  - Order messages (`StoreOrderMessagesTab`): a card per message with its switch, when it's sent, the template's status pill, language and Change template (the existing picker, opened from a text button, each option led by the template's text), and a WhatsApp preview (`WhatsAppPreview`) filled with sample values (Zaki, order 1042, the store's name, ₹499.00 in the store's currency, the status label). Then extra status messages as cards (with Remove), "Message for another order status", and the cash-on-delivery card (payment methods line with Change for the codes editor, and the tags note). Ready-made templates is always available.
  - Activity (`StoreActivityTab`): Orders | Carts; Orders has All · Not sent (count from the summary) · Waiting for customer (`GET /:id/orders?show=`), with coloured cash-on-delivery pills and "{message} · {status}" lines (`StoreOrdersTable`); Carts (`StoreCartsTable`) needs the plugin linked.
- A disconnected store (within 30 days of `disconnectedAt`): under the connect form, "Past orders from {store}" with its orders (and carts, if any) read-only, kept until the date shown (`StorePastOrders`). If the owner disconnected it, the form says when. The shared pieces the screens inside Shopify admin use (`StoreMessagesSection`, `StoreCodSection`, `StoreOrderLog`, the picker without options) are unchanged for Shopify.
- While the store is `connecting`, the Store page shows the managed screen with a "Setting up" note and asks `GET /organizations/stores` again every 5 s until the status changes (`useStore({ pollWhileSettingUp })`, passed by `pages/store/index.tsx` only).
- An order with no `customerName` shows "Customer"; with no `subscriberId` there's no link to the chat. One "shipped" status picker (the API accepts up to 5; one is intended). Message statuses `claimed`, `queued` and `sending` all show as "Sending".
- Settings save per change, sending only that field (`useStoreSettings`); the API's reason a template can't be used shows under its picker, and `warnings` show as toasts.
- Inbox: order messages (`payload.storeOrder`) carry a "Store · Order #1201" label above the bubble; cart reminders (`payload.storeCart`) "Store · Cart reminder 2".
- Templates tab: "Used by Store" on a template that turned-on Store messages send (the backend's rule; `storeTemplateUses`), in the list and on the edit page, with the messages in a tooltip. Saving an edit to one asks first ("Edit anyway"). A delete the backend refuses (409 with `details.storeMessages`) shows its message with "Open Store page".
- Contacts: the contact dialog says "Added from your store (order)" or "(checkout)" for `optInSource` `store_checkout` / `store_cart`; a restricted contact's reason shows as a plain sentence in place of the old "Auto-restricted: {code}" (every code the backend sets; anything else, including `recent_engagement`, reads "Currently restricted from broadcasts."; `lib/contactText.ts`).

### Cart reminders and the WordPress plugin (WooCommerce only)

- Spec: the backend's `docs/STORE_CART_FRONTEND_SPEC.md` (live on backend main since f86e54d). Shown only when `connection.platform === "woocommerce"` and `GET /organizations/stores` sends `connection.plugin` (`hasStorePlugin` in `lib/storeCarts.ts`). Helpers and wording live in `lib/storeCarts.ts`.
- Cart reminders tab (`StoreCartRemindersTab` in `StoreCartReminders.tsx`, with `StorePluginInstallCard` / `StorePluginLinkedCard`): not linked, the three install steps (Download plugin (.zip) from `public/downloads/whatching-cart-recovery.zip`, plugin 1.0.2, "Whatching Cart Recovery", as sent by the backend side; replace that file for a new version, the WordPress upload step, Get code); linked, a top card with the "Linked" badge, version and last check-in, a warning after 24 h without a check-in, Get a new code ("Use this if you reinstalled the plugin or moved your store.") and the "Cart reminders on" switch. A code (`POST /:id/plugin-code`) shows with Copy; while it's valid the store is asked for again every 5 s, and a new `plugin.connectedAt` clears it with "Plugin linked."; once it expires it becomes Get a new code.
- Then the explanation, three reminder cards like the order message cards (switch, "Send after the shopper leaves", template, preview with the link button), edited together and saved with Save reminders / Discard ("You have unsaved changes" while there are; leaving the page asks first, `hooks/useLeaveWarning.ts`; the tab stays mounted so other tabs keep the changes). The first switch-on asks for the marketing-consent checkbox and sends `consentConfirmed: true`; delays are checked on the client with the backend's wording (30 minutes to 72 hours, each later than the one before). Create ready-made reminder template (`POST /:id/cart-template`) shows when no reminder has a template, then the approval wait note.
- Reminder template pickers list approved or in-review Marketing templates of the sending number's account with exactly one link button ending in `{{1}}` (`isCartReminderTemplate`), the same rule the backend enforces; its 400 message is shown as is under the reminders.
- With the plugin field present, the Disconnect dialog reads "Order messages and cart reminders will stop. Your order history here is kept for 30 days."; without it, the order-messages-only wording.
- Activity › Carts (`StoreCartsTable` in `StoreCartLog.tsx`, once the plugin is linked): "Recovered this month" from the summary, then `GET /:id/carts`, 25 a page: shopper (opens the chat when there's a contact), cart, last activity, status and one chip per reminder (the order log's status words; the reason under it when there is one, so a failed reminder without a reason is the chip alone).

## Shopify (screens inside Shopify admin)

- `/shopify`, opened by Shopify admin in an iframe when a merchant clicks the Whatching app; backed by `/api/v1/shopify` (`client-api/functions/shopify.ts`). Spec: the backend's `docs/SHOPIFY_EMBEDDED_FRONTEND_SPEC.md`. Not live yet: production answers 503 until the App Store submission.
- No Whatching login: every request carries a fresh Shopify ID token (see `docs/ARCHITECTURE.md`, Shopify section). No pop-ups for essential steps: unlink confirmation and ready-made templates are inline.
- Each open calls `POST /shopify/session`. With no link: the Link screen (email, password, the checkout opt-in checkbox, Connect; a workspace picker when the account has several; "Create an account" opens Whatching sign-up in a new tab). Linked: `GET /shopify/store`, polled every 5 s while `connecting`, and four tabs:
  - Home: status and Check connection (hidden while connecting), plan notice, cost note, and the setup checklist (account linked with Unlink, WhatsApp connected or "Connect WhatsApp on Whatching", templates ready or "Create ready-made templates", and the checkout contact note with a Shopify Help Center link).
  - Messages: the Store page's four cards; "Order shipped" is sent on fulfilment, so there's no status picker and no extra status messages.
  - Cash on delivery: one toggle ("Cancel the order in Shopify when the customer taps Cancel"), its help text and the order tags line; no payment methods.
  - Orders: the Store page's order log, without chat links.
- A 409 `not_linked` on any store call goes back to the Link screen.

## Settings

- Main settings page exists.
- General: owners and admins change the business name (shown inside Whatching only) and timezone through `PATCH /settings`.
- Quick replies (`/settings/quick-replies`): owners and admins add, edit and delete; anyone who can view conversations sees the list.
- Billing page uses backend billing/subscription endpoints.
- Plans are selected on `/plans`; paid checkout runs on `/checkout` with base price, 18% GST, total amount, and backend-required India billing profile fields before opening Razorpay. GSTIN is optional and the free-trial flow does not request billing details.
- `/congratulations` shows the post-checkout confirmation state, syncs backend subscription status, and links back to Overview and Billing.
- Billing settings show current plan status, next deduction date and amount for active subscriptions, remaining access for cancelled subscriptions, scheduled plan changes, pending Razorpay authorization links, and billing history.
- Under the plan details, a note that WhatsApp (Meta) charges for messages separately from the Whatching plan, with each number's 1,000 free customer replies a month and a link to Analytics.
- Agents page uses team/membership endpoints.
- Knowledge page creates text and FAQ sources and uploads titled TXT/PDF/DOCX file sources. Sources can be viewed, re-ingested, or deleted; editing is not exposed because the backend has no update route.

## Analytics

`/analytics` (`pages/analytics.tsx`), backed by `/api/v1/organizations/analytics`. Agents see performance only; owners and admins also see WhatsApp (Meta) costs.

- Free customer replies (owners and admins; spec: the backend's `docs/FREE_REPLIES_FRONTEND_SPEC.md`): `FreeRepliesCard` sits at the top of the costs area, above the spend card. `GET /analytics/free-replies` gives each number's count of WhatsApp's 1,000 free replies a month; one row per number with a bar (grey, amber from 800, red when used up or once a reply was charged), "{n} free replies left" or "All free replies used · {n} charged replies so far", and the small print with when it was updated (`lib/freeReplies.ts`). Before the first 6-hourly refresh (`lastUpdatedAt` null) the rows are replaced by "We'll show your free replies here within a few hours."; with no numbers, or on an error, the card is hidden.
- Meta charges per message, so the cost wording says messages, not conversations: "Charged messages", "Messages in this period", "Charged share", "{x}% charged", "{n} charged · {m} free", "Daily message volume". Inbox wording ("Conversations", "Conversation status") is unchanged. The campaign figure reads "Cost per contact": it is ad spend divided by the contacts the ad brought in, not a Meta message charge. API field names are unchanged.
