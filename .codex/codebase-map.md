# Whatching Codebase Map

Last reviewed: 2026-07-06

This note is a durable working map for future Codex turns in this repository. It captures how the app is currently structured, where behavior lives, and the project-specific rules that should not be forgotten during edits.

## App Shape

- Framework: Next.js Pages Router with React 19 and TypeScript.
- Styling: Tailwind CSS v4 tokens in `styles/globals.css`, with shadcn/Radix-style primitives under `components/ui`.
- Server state: `@tanstack/react-query` configured globally in `pages/_app.tsx`.
- Local state: Zustand stores under `stores`.
- API client: `api/axiosInstance/index.ts` wraps axios with auth token refresh and organization headers.
- Main authenticated shell: `layouts/AppLayout.tsx`.
- Auth shell: `layouts/AuthLayout.tsx`.

## Request And Session Flow

- `useAuthStore` persists `token`, `user`, and `isAuthenticated` in localStorage under `whatching-auth`.
- `useOrganizationStore` persists organization state under `whatching-organizations`.
- The axios request interceptor reads:
  - bearer token from Zustand or `localStorage.accessToken`
  - active organization id from Zustand or `localStorage.orgId`
  - sends organization id as `x-org-id`
- 401 responses refresh through `POST /users/refresh-token`, update auth store, then retry the original request.
- Refresh is skipped for login, signup, and refresh-token requests.
- On refresh failure, auth and organization state are cleared and the browser redirects to `/auth/login`.
- `RouteGuard` treats these routes as public:
  - `/auth/login`
  - `/auth/signup`
  - `/auth/forgot-password`
  - `/auth/reset-password`
  - `/auth/verify`
- Non-public pages require hydrated auth state plus token.
- The login page redirects authenticated users to `/organisations`.
- Most app API behavior requires an active organization because `x-org-id` is attached from organization state.

## Global Query Behavior

- `pages/_app.tsx` creates a single `QueryClient`.
- Query defaults:
  - no retry
  - no refetch on mount by default
  - no refetch on window focus by default
- Mutation cache:
  - shows `toast.success(apiData.message)` unless mutation meta sets `showToast: false`
  - shows API error messages from `response.data.message`, else generic error toast
  - supports `mutation.meta.invalidateQueries`

## Navigation And Layout

- Main nav order in `AppLayout` is:
  1. Overview
  2. Templates
  3. Broadcasts
  4. Flows
  5. Contacts
  6. Media
  7. Settings
- Keep the sidebar light themed. Current pattern is white rail, muted labels, subtle hover backgrounds, and primary-tinted active state.
- `AppLayout` fetches the selected organization and integration status, upserts them into the organization store, and redirects to `/organisations` if there is no active organization after hydration.
- `AppLayout` also handles plan gating and subscription purchase via organization billing endpoints.

## Endpoint Map

Endpoint constants live in `api/endpoints/index.ts`.

- Auth:
  - `POST /users/signup`
  - `POST /users/login`
  - `GET /users/me`
  - `POST /users/refresh-token`
  - `POST /users/forgot-password`
  - `POST /users/resend-verification`
  - `PATCH /users/reset-password/:token`
  - `GET /users/verify/:token`
- Organizations:
  - `GET /organizations/my-organizations`
  - `GET /organizations/`
  - `POST /organizations/setup`
  - `GET /organizations/integration-status`
  - billing subscribe, topup, history, cancel under `/organizations/billing/...`
- Subscribers and tags:
  - `GET /organizations/subscribers`
  - `GET /organizations/subscribers/:subscriberId`
  - `PATCH /organizations/subscribers/:subscriberId`
  - `POST /organizations/subscribers/import`
  - `POST /organizations/subscribers/bulk-delete`
  - `GET /organizations/tags`
  - `POST /organizations/tags`
  - `DELETE /organizations/tags/:tag`
  - subscriber tag add/remove under `/organizations/subscribers/:subscriberId/tags`
- Media:
  - `GET /organizations/media`
  - `POST /organizations/media/upload`
  - `GET /organizations/media/:mediaId`
  - `POST /organizations/media/bulk-delete`
- Templates:
  - `GET /templates/`
  - `POST /templates/sync`
  - `POST /templates/`
  - `GET /templates/drafts`
  - `POST /templates/drafts`
  - draft get, patch, submit, delete under `/templates/drafts/:draftId`
  - template get, patch, delete under `/templates/:templateId`
  - `PATCH /templates/:templateId/link-media`
- Broadcasts:
  - `GET /organizations/broadcasts`
  - `POST /organizations/broadcasts`
  - `GET /organizations/broadcasts/:broadcastId`
  - `POST /organizations/broadcasts/:broadcastId/start`
  - `POST /organizations/broadcasts/:broadcastId/cancel`

## Auth Pages

- `pages/auth/signup.tsx`
  - Uses `react-hook-form` plus zod.
  - Builds signup payload as `{ name, email, phoneNumber, password, passwordConfirm }`.
  - After signup, shows email verification state with resend timer.
- `pages/auth/login.tsx`
  - On success, calls `setAuth`, clears React Query cache, and redirects to `next` query or `/organisations`.
- `pages/auth/verify.tsx`
  - Reads `token` and optional `email` query params.
  - Verifies once per token using refs.
  - If verify response includes a token, stores auth and clears query cache.
  - On missing or invalid token, shows error and optional resend button when email is present.
- `pages/auth/forgot-password.tsx` and `pages/auth/reset-password.tsx`
  - Standard forgot/reset flows using auth API helpers.

## Organizations

- `pages/organisations.tsx` is the workspace picker.
- It loads user organizations with `getMyOrganizations`, stores them, and lets the user create a new organization with `setupOrganization`.
- Selecting an organization calls `setActiveOrganization`, writes `localStorage.orgId`, then navigates to `/overview`.
- Logging out clears auth plus organization state.

## Templates

- Main list page: `pages/templates.tsx`.
- Create/edit page wrapper: `pages/templates/[templateId].tsx`.
- New template wrapper: `pages/templates/create.tsx`.
- Large form: `components/templates/TemplateCreateForm.tsx`.
- Shared helpers: `components/templates/templateUtils.ts`.
- Table: `components/templates/TemplatesTable.tsx`.

Important template rules:

- Templates page merges drafts and Meta templates into `useTemplateStore`.
- Drafts are mapped to table-compatible objects with `mapDraftToTemplate`.
- Template sync runs once per organization per browser session using sessionStorage key `whatching_templates_synced:<orgId>`.
- Manual refresh calls `POST /templates/sync` and refetches approved templates plus drafts.
- Pending templates are not editable.
- Delete handles drafts and Meta templates differently:
  - draft: `DELETE /templates/drafts/:draftId`
  - Meta template: `DELETE /templates/:templateId`
- After delete, local store and query caches are updated, then templates are synced/refetched.
- Media-required state is app-side logic:
  - header must be IMAGE, VIDEO, or DOCUMENT
  - missing both `header.mediaId` and `template.defaultMediaId`
  - helper: `templateNeedsMedia`
- Action Required filter includes actual `ACTION_REQUIRED` status and templates that need media.
- Action Required tab shows a red dot if any template needs media.
- Existing Meta templates with missing media use `PATCH /templates/:templateId/link-media`.
- Do not rely on `header_handle` sample URLs as true media linkage.

## Template Create Form

- `TemplateCreateForm` owns most template composition logic.
- Supports text, image, video, document, location, limited time offer, and carousel template types.
- Uses `nuqs` query state for category/language and other page state.
- Maintains local state for header text, selected media, body, footer, variables, examples, buttons, LTO, carousel cards, and action mode.
- Submits through:
  - `createTemplate` for new Meta templates
  - `createDraftTemplate` for saving drafts
  - `updateDraftTemplate` for patching drafts
  - `submitDraftTemplate` for draft submit
  - `updateApprovedTemplate` for approved template edits
- Media headers should send a real `mediaId`.
- Media selection opens `MediaPickerDialog`, constrained to the required media type.

## Contacts

- Page: `pages/contacts.tsx`.
- Modals:
  - `components/subscribers/SubscriberModal.tsx`
  - `components/subscribers/ImportSubscribersModal.tsx`
- Fetches subscribers with `GET /organizations/subscribers`.
- Fetches tag list with `GET /organizations/tags`. This exact GET route matters.
- Search filters by phone, first name, last name, WhatsApp id, and tags.
- Tag chips above the table are filters. Active tags are highlighted.
- Multiple selected tag filters are combined with `every`, so subscribers must include all active tags.
- Row tags are display-only. Do not put tag delete/edit controls in table rows.
- Tag create/edit/delete lives in the tag dialog.
- Editing a tag creates the new tag and deletes the old tag when names differ.
- Single subscriber add/edit uses import for create and patch for edit.
- Bulk import reads rows in the import modal and posts `dryRun: false`.
- Single delete and bulk delete both use `POST /organizations/subscribers/bulk-delete`.
- Delete actions use confirmation dialogs and destructive styling.
- The control layout intentionally places `Select all visible` on the left and `Add tag` on the right under the search/tag filter row.

## Media

- Page: `pages/media.tsx`.
- Picker: `components/media/MediaPickerDialog.tsx`.
- Media tabs: image, video, document.
- Upload uses multipart `files` array via `POST /organizations/media/upload`.
- Upload size limits in UI:
  - image: 1 MB
  - video: 10 MB
  - document: 10 MB
- Selection is per media id, and `Select all visible` applies only to the active tab.
- Bulk delete uses `POST /organizations/media/bulk-delete`.
- Images and videos show previews; documents show a file icon.
- `MediaPickerDialog` fetches media only when open.
- If `requiredType` is passed, picker filters to the matching file type and hides tabs.
- Picker includes a link to `/media` for adding assets.

## Broadcasts

- Page: `pages/broadcasts.tsx`.
- Fetches broadcasts, approved templates, subscribers, and tags.
- Search filters by broadcast name, status, and template name.
- Create flow makes a broadcast draft with:
  - name
  - approved template id
  - audience mode
  - default body parameter sourced from subscriber `firstName` with fallback `Valued Customer`
- Audience modes:
  - all
  - tags with `tagMatch: "any"`
  - specific subscriber ids
- Detail dialog fetches `GET /organizations/broadcasts/:id`.
- Detail shows status, template, dates, stats, last error, scheduling controls, and recipient table.
- Draft and scheduled broadcasts can be started.
- Starting immediately posts an empty payload.
- Scheduling posts `{ scheduledLocal, timezone }`.
- Current scheduling timezone is hardcoded to `Asia/Kolkata`.
- Cancelable statuses in the list are draft, scheduled, and processing.
- Cancel uses confirmation dialog plus destructive styling.

## Billing, Profile, Misc Pages

- `pages/settings.tsx` shows billing history and cancel subscription.
- `pages/profile.tsx` fetches `/users/me`, updates auth store user, and supports logout.
- `pages/overview.tsx` is a simple organization dashboard using active organization store values.
- `pages/flows.tsx` is currently a placeholder.
- `pages/index.tsx` redirects or acts as a minimal entry page.

## UI Conventions To Preserve

- Use existing UI primitives from `components/ui` before adding new controls.
- Buttons use `components/ui/button.tsx`; destructive variant exists but many dialogs also set explicit destructive classes.
- Cards and panels are mostly white, rounded-lg, subtle shadow.
- The app should remain light themed.
- Destructive actions should be visibly destructive and usually confirmed.
- Keep dense operational screens scannable: header section, search/filter section, then table/grid.
- Existing filters usually use pill buttons with `bg-primary/10 text-primary` for active state.
- Selection affordance pattern is `Select all visible`, not global select-all.

## Validation Commands

Use these after substantial changes:

```bash
./node_modules/.bin/tsc --noEmit
npm run build
```

Notes:

- `npm run lint` is configured as `next lint --fix`, which may mutate files.
- The repo currently has uncommitted changes in multiple app files. Do not revert user changes unless explicitly asked.

