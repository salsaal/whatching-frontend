# Current State

This document reflects the frontend and verified sibling-backend contracts on 2026-08-08.

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
