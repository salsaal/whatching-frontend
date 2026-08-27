# Decisions

This file captures repo-specific decisions and non-obvious behaviour that future tasks should preserve unless the user explicitly asks to change them.

## Frontend API Client Lives In `client-api`

The frontend API wrapper folder is named `client-api/`, not `api/`. This avoids Vercel treating client modules as serverless functions. Do not recreate a root `api/` client folder. Keep `pages/api/` empty unless implementing intentional Next API routes.

## Backend Is A Sibling Repo

The frontend is not the source of truth for database models, route middleware, queues, or workers. When changing API contracts, inspect `../whatching-backend` and update frontend endpoint constants/types/functions together.

## Central Axios Instance Owns Auth And Org Headers

Do not manually attach auth/org headers in feature modules unless there is a specific exception. `client-api/axiosInstance/index.ts` attaches:

- `Authorization: Bearer <token>`
- `x-org-id: <active org id>`
- `ngrok-skip-browser-warning` for ngrok URLs

It also handles refresh-token retry and logout on refresh failure.

Production deployments with a cross-site frontend/API boundary require the backend refresh cookie to use `SameSite=None; Secure`. A frontend `withCredentials` flag does not override `SameSite=Lax` and cannot repair a cookie omitted by the browser.

## Persisted Stores Must Stay User-Aware

Auth and organization state are persisted. `authStore` clears organization state when the user changes, and `organizationStore` clears stale organization state if owner identity is missing. Preserve this behaviour to avoid leaking one user's active organization into another user's session.

## Multi-Number Selection Is Per Organization

The selected WhatsApp number is persisted as `selectedWhatsAppPhoneNumberByOrg`. "All WhatsApp numbers" is a filter context, not a sender. Sends and creates should resolve to a concrete active/ready number.

## Default WhatsApp Number Is A Fallback

When no specific usable number is selected, the frontend uses the default usable number where a concrete sender is required. The backend still mirrors a default number in organization meta config for legacy/fallback paths.

## Canvas Routing Is Number-Aware

WhatsApp phone numbers can have their own assigned active canvas. Organization active canvas remains a fallback concept. Template quick reply validation and sends should use the selected or conversation sender number, not blindly use organization default triggers.

## Template Quick Reply Routing Is Local

Meta templates define quick reply buttons, but Whatching stores local `quickReplyRoutes` that map button indexes to canvas trigger keys. Updating quick reply routes via `/quick-reply-routes` should not call Meta. It validates against active published canvas triggers.

## Action Required Is Computed

The frontend can treat a template as Action Required when quick reply routing is stale or missing even if the backend template status is otherwise approved/pending. Keep the UI distinction clear: the underlying Meta status and local routing health are related but not identical.

## Flow Published State Must Include Default Trigger Key

Both WhatsApp and Instagram canvases use `defaultTriggerKey` in draft/published state. Published backend state compiles indexes used by orchestrators. Do not drop `defaultTriggerKey`, positions, edges, or action IDs when transforming canvas state.

## Preview Flow Uses Preview Nodes

The full-flow preview dialog is intended to show preview-style nodes connected like the builder canvas. The editable builder uses regular editor blocks, including for WhatsApp buttons and lists, so route handles remain visible. Both surfaces use orthogonal step edges.

## Query Keys Must Match Query Shape

Do not reuse one TanStack Query key for a normal query and an infinite query. Broadcast preview uses `broadcast-preview`; the paginated detail view uses `broadcast-detail`. Reusing a key lets a plain response hydrate an infinite observer and causes client crashes when it expects `pages` and `pageParams`.

## Modal Height Is Bounded Globally

Dialog and alert-dialog primitives cap content at `90vh` and allow vertical scrolling. Feature dialogs that need fixed headers or actions override the outer overflow and scroll only their body.

## Knowledge Editing Follows Backend Capability

Knowledge sources support text/FAQ creation, titled file upload, re-ingestion, and deletion. Do not show an edit action until the backend exposes and validates an update route.

## Paid Plans Require Billing Profile First

Before paid subscribe or plan-change calls, save the India billing profile through `/billing/profile`. Legal name, billing email, address, state, and six-digit PIN are required; GSTIN is optional but validated when present. Trials bypass this form.

Plan selection and paid checkout should stay on dedicated routes instead of the global app shell modal. The backend subscribe/change validators only accept `{ tier }`, so callback URLs or billing fields must not be sent in those payloads. The frontend should open Razorpay Checkout.js with backend-returned `key` and `subscription_id`; for this SPA, use Checkout's `handler` to route to `/congratulations` and let webhooks plus `/billing/sync` confirm the subscription state.

## Instagram And WhatsApp Meta Auth Are Separate

Use precise wording:

- Instagram professional accounts connect via Instagram Login.
- WhatsApp connects through WhatsApp Embedded Signup.

Do not describe Instagram connection as Facebook Login unless the product flow changes.

## Instagram Follow Check Is A Control Block

`follow_condition` routes to follows, not-follows, or unknown trigger keys. It depends on backend/Meta user profile follower fields. It should behave as routing logic, not as a normal message bubble preview.

## Skeleton Loading Is Preferred

The current UI direction is to use skeleton loading states instead of plain "Loading..." text where data is fetched.

## Backend Permissions Are Enforced

Routes use `protect`, `setOrgContext`, `restrictTo`, and `requirePermission`. Frontend should not assume all authenticated users can mutate every module. Backend currently has role/permission checks around templates, flows, conversations, contacts, media, team, integrations, and WhatsApp numbers.

## Lint Command Mutates

`npm run lint` runs `next lint --fix`. Use `npx tsc --noEmit` for a non-mutating frontend type check. Run lint only when file modifications from auto-fix are acceptable.

## Documentation Should Not Contain Secrets

Do not paste `.env.local`, `.env.development.local`, `.env.production.local`, or backend `.env` values into docs. Listing variable names is acceptable.
