# Current State

This document reflects the frontend and verified sibling-backend contracts on 2026-08-27.

## 2026-11-23 — Drip campaigns and offer preferences

- Built from the backend's `docs/DRIP_FRONTEND_SPEC.md` (backend main d414f4e): the Drip campaigns pages, the Stop offers switch on contacts, the ready-made "Stop promotions" button for marketing templates, and the drip link when a template can't be deleted (see `docs/FEATURES.md`). The inbox already shows the `subscriber_stopped_offers` note like other system notes.
- Backend gap, flagged and worked around: drips drop text-header values (see `docs/DECISIONS.md`), so templates with a header variable aren't offered for drips.
- Choices: the menu item reads "Drip campaigns"; the once-a-day offer note shows only when a step is an offer; Add people has no consent tick (the endpoint takes none).

## 2026-11-22 — Store redesign

- Built from the backend's `docs/STORE_REDESIGN_FRONTEND_SPEC.md` (backend main 970b47e): the tabbed Store page, summary row, previews, lasting setup checklist, Activity filters, a disconnected store's past orders, and the Store in the Templates tab, inbox and Contacts (see `docs/FEATURES.md`). It replaces the earlier Store UX spec. Shopify screens are unchanged.
- Spec differences, handled on our side: the store card's "checked" time uses `lastSyncAt` (the connection has no `lastHealthCheckAt`), and "disconnected by the owner" is a disconnected store without `setupFailure` (`disconnectReason` isn't sent).
- Choices: the eyebrow reads "Store" like other pages' eyebrows; "Choose a number" opens a small picker (the spec doesn't place it), and the sending number has Change once chosen; Get a new code's help text shows on the linked card; the Setup templates step says "Waiting for WhatsApp…" only when templates are in review, and points to Order messages when an extra status message has no usable template.

## 2026-11-22 — Free customer replies and per-message wording

- Built from the backend's `docs/FREE_REPLIES_FRONTEND_SPEC.md` (backend live on production, main dbedcaa): the Analytics free replies card, the Meta-charge wording from conversations to messages, and the Billing note (see `docs/FEATURES.md`).
- The spec listed the campaign "Cost per conversation" as "Cost per message", but it is ad spend divided by the contacts the ad brought in, not a Meta message charge; with the user's agreement it reads "Cost per contact".
- Beyond the spec's table, the same rule changed "Billable share" to "Charged share", the category card's empty text to "No message data for this range.", and the "figures haven't arrived" note to messages and "every few hours" (the backend now refreshes Meta's figures every 6 hours).

## 2026-11-21 — Cart reminders and the WordPress plugin

- Built on the Store page for WooCommerce (see `docs/FEATURES.md`), shown when the backend sends `connection.plugin`. Live: the backend is on production (main f86e54d) and the frontend release added the plugin zip at `public/downloads/whatching-cart-recovery.zip` (now 1.0.2, renamed "Whatching Cart Recovery" for WordPress.org, without a Plugin URI; identical to the backend's `woocommerce-plugin/` on main).
- The plugin checks in every 15 minutes on its own (1.0.1), so the 24-hour quiet warning means the plugin is off or the site can't reach Whatching.
- Add the "Or install it from WordPress.org" link once the plugin is listed there.
- Shopify work is paused (waiting on Shopify's billing answer); `/shopify` stays as it is.

## 2026-11-20 — Store page and WhatsApp usernames

- The Store page (WooCommerce order messages) is built and stays hidden until `GET /organizations/stores` answers 200. The store backend isn't on production yet (it answers 404), so the page hasn't been tried against a real store. Do that once the backend says it's live.
- Backend gap, known and accepted: broadcast audiences leave out contacts without a phone number (WhatsApp username only). The "Not sent: this customer hasn't shared their phone number." reason is built and will appear once broadcasts include them.
- The Shopify screens inside Shopify admin (`/shopify`) are built and tested in jsdom, and a production build checked the header, App Bridge placement and the outside-Shopify message. They haven't run inside Shopify admin yet: that needs `NEXT_PUBLIC_SHOPIFY_API_KEY` locally, a frontend tunnel (its host added to `allowedDevOrigins`, development only) and the backend's dev tunnel as the API address. Production answers 503 until the App Store submission.
- Still to do on the Whatching Store page for a Shopify store (`connection.platform === "shopify"`): word Disconnect as "This stops Whatching messages for this store. To remove the Whatching app from Shopify, uninstall it in your Shopify admin." The shared message cards and cash on delivery section already follow the platform.

## 2026-08-27 — Backend feature-parity pass

A full audit compared this frontend against `../Whatching_backend`'s current routes/models and closed the gaps found:

- Backend: fixed the production 15-minute logout bug — `authController.ts` refresh-cookie `sameSite` is now `'none'` in production, `'lax'` otherwise (previously hardcoded `'lax'`, breaking cross-site refresh). Deploy this and confirm `CORS_ORIGINS` matches the exact frontend origin.
- Fixed a real (previously unknown) bug: the org tags list endpoint returns full `Tag` objects, but the frontend's `TagsResponse` type still declared `tags: string[]` — this only failed at runtime, not at typecheck. New `client-api/types/tags.type.ts` carries the correct `Tag`/`TagAutomation` shape.
- Automatic subscriber tagging: `TagFormDialog` supports `mode` (manual/bot_decides), `channelScope`, and keyword/AI/inactivity automation triggers. `TagAssignmentLog` audit trail is still backend-gap (no GET route exists) — raised as a backend follow-up, not built.
- Billing: added Invoices (list/PDF download/retry) and AI token top-up (packages, usage, Razorpay payment-link top-up) to `/settings/billing`. `topup-wallet` intentionally left out of scope — confirmed legacy/unused by the backend team.
- Campaign attribution: `/analytics` now has Campaigns and Costs tabs (Costs gated to owner/admin via new `useCurrentMembership()` hook). Broadcast audience now supports a `campaign` mode alongside all/tags/specific. Subscriber detail shows campaign touch history.
- Meta cost & template-click analytics live under the Costs tab, including the permanent, one-way template-insights opt-in consent flow.
- Manual WhatsApp number connect (fallback to Embedded Signup) added to Overview. Org timezone editing added at `/settings/general`. Subscriber broadcast-eligibility toggle added to the subscriber detail dialog.
- Removed unused `next-auth`/`nookies` dependencies and their dead call sites.
- Added a shared `QueryErrorState` component and wired `isError` handling into contacts, media, conversations, and settings/agents (remaining ~29 pages still rely on toast-only mutation error feedback — not covered in this pass).
- Instagram Comment Automation tab remains behind its `COMMENT_AUTOMATION_ENABLED` flag in `pages/instagram.tsx` — a product decision, not an engineering gap.

## Completed

- Conversation history now requests seven older messages per upward scroll, preserves the viewport after prepending, and deduplicates messages by ID across cursor pages and realtime updates.
- Realtime message creation updates the current infinite-query cache without immediately refetching every loaded history page.
- Conversation template sending resolves linked template media before asking for a replacement upload.
- Broadcast preview and paginated detail queries use distinct TanStack Query keys, preventing the detail-page `pages.length` crash after navigation from the list.
- Paginated broadcast, recipient, subscriber/contact, support-ticket, and Instagram lists are deduplicated by record ID.
- The broadcast create modal keeps its footer fixed and scrolls only the form body; the specific audience list remains bounded inside it.
- WhatsApp list/button blocks use normal editor nodes with visible route handles again.
- WhatsApp and Instagram builders and full-flow previews use dashed orthogonal step edges.
- WhatsApp list blocks show section dividers, section names, row titles, and row descriptions inside the standard editor node.
- The Instagram Connect action is hidden once the account is ready, and the Comment Automation tab is temporarily disabled with a "Coming soon" tooltip.
- Login automatically resends a verification link and redirects to the verification screen when the backend returns `Please verify your email to log in.`.
- Template draft submission replaces the draft store entry with the submitted template and de-duplicates draft/meta records on the listing page.
- Dialog and alert-dialog primitives cap content at `90vh`; knowledge details cap at `85vh` with fixed header, timestamps, close action, and a scrollable body.
- Knowledge creation supports text, FAQ, and explicitly titled TXT/PDF/DOCX file sources. The text areas cap at 400px and scroll internally.
- Plan selection moved out of the app-shell modal and into `/plans`; paid plan checkout now uses `/checkout` with required India billing profile fields, base price, 18% GST, and total amount. Trial checkout remains billing-free.
- Paid checkout opens Razorpay Checkout.js with the backend-returned `key` and subscription ID; `/congratulations` shows the post-checkout state, runs backend billing sync, and links back to Overview and Billing.
- Billing settings now show current plan status, next deduction amount/date for active subscriptions, remaining access for cancelled subscriptions, scheduled plan changes, pending Razorpay links, manual billing sync, and billing history.
- AppLayout shows a cancelled-plan banner when backend subscription fields indicate access continues until the period end.
- `npx tsc --noEmit` and `npm run build` pass for this worktree. The build reports existing `no-img-element` warnings.

## Remaining Work

- The production 15-minute logout requires a backend cookie change in `src/controllers/authController.ts`. Both refresh-cookie option blocks must use `sameSite: config.env === 'production' ? 'none' : 'lax'` while retaining `secure: config.env === 'production'`. The requested backend edit was not authorized, so it was not applied.
- Run focused browser checks for conversation history anchoring, linked media sends, direct broadcast-detail navigation, both flow canvases, knowledge file upload, route-based plan checkout, Razorpay return, and billing sync against a running backend.
- Deploy the backend cookie correction with an exact credentialed CORS allowlist for the frontend origin, then verify refresh in the deployed browser environment after more than 15 minutes.
- If a server-side Razorpay callback flow is needed later, add a backend callback-verification route and redirect from that route to `/congratulations`.

## Known Issues And Risks

- Production users will still be logged out when the 15-minute access token expires if frontend and API are cross-site: the backend currently marks the refresh cookie `SameSite=Lax`, so browsers omit it from the refresh XHR.
- Razorpay subscriptions are created by the backend without a callback URL field, and subscribe/change validation rejects extra frontend fields. Checkout.js handles the frontend payment modal; webhooks plus `/billing/sync` remain the source of truth after the client redirects.
- Knowledge sources cannot be edited because the backend exposes no GET-by-ID or PATCH update route. View, re-ingest, and delete remain available.
- Orthogonal step edges make routes predictable but cannot guarantee zero overlap when users place several nodes on the same coordinates; manual node spacing still matters.
- The frontend worktree contained pre-existing changes in `TemplateCreateForm.tsx`, `AppLayout.tsx`, `pages/flows/[canvasId].tsx`, and `public/sitemap-0.xml`; this work preserves them.

## Recommended Next Step

1. Apply and deploy the backend refresh-cookie policy correction.
2. Validate the production `Set-Cookie` response contains `HttpOnly; Secure; SameSite=None` and that the refresh request includes the cookie.
3. Complete the focused browser checks listed above before release, including Razorpay Checkout.js success, dismiss, and webhook/sync timing.

Do not place secrets or actual environment values in this file.
