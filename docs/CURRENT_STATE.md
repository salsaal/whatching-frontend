# Current State

This document captures the repository state observed while creating durable docs on 2026-07-26.

## Completed Work Present In Code

- Frontend worktree was clean before these docs were added.
- Frontend has a committed multi-WhatsApp-number implementation in recent commit `109e43a phone number`.
- Global WhatsApp number switcher exists and persists selected number per organization.
- Overview includes WhatsApp number management for listing, syncing, adding, activating, deactivating, and setting default numbers.
- Templates support quick reply routing to active canvas triggers and include phone-number-aware payload fields.
- Template list computes Action Required for missing/stale quick reply routes.
- Broadcasts include WhatsApp number filtering and sender selection.
- Conversations include WhatsApp number filtering and sender-aware template/reply behaviour.
- WhatsApp flows support multiple canvases and flow preview rendering.
- Instagram message flows include `follow_condition`.
- Instagram comment automation UI is backed by `comment-rules` endpoints and user-facing comment automation language.
- Backend sibling has analytics routes/service in recent commit `c5f175e Added analytics for organization`.
- Backend sibling has role-based permission work and multiple-number fixes in recent history.
- Backend `botOrchestrator.ts` currently resolves default trigger key from canvas published state before bot settings in the inspected helper path.

## Partially Completed Or Needs Verification

- Frontend `client-api/functions/bot.ts` and `client-api/functions/instagram.ts` call `PATCH /canvases/:canvasId/status`, but backend route files currently declare `POST /canvases/:canvasId/status` for both WhatsApp and Instagram. This contract should be aligned before relying on canvas status toggles.
- `.env.example` does not list all variables referenced by the frontend, including optional Meta graph/signup version variables and `NEXT_PUBLIC_DOMAIN`.
- `next.config.ts` exposes several `NEXT_APP_*` and `NEXTAUTH_*` variables, but current direct frontend usage outside config was not found. Needs verification before deleting or changing them.
- The current README is mostly create-next-app boilerplate and mentions a deleted `pages/api/hello.ts` route. The new docs are more accurate than README.
- Analytics backend exists, but no dedicated top-level frontend analytics page was found. Needs verification whether analytics are surfaced in overview/billing or still pending frontend work.
- Backend production/infrastructure details were not fully audited; use backend docs and deployment files before changing Docker/compose/hosting.

## Known Bugs Or Risks

- Canvas status method mismatch can break activation/deactivation toggles if backend does not accept PATCH.
- Sitemap generation uses `NEXT_PUBLIC_DOMAIN` with a fallback of `https://google.com`; missing production env could generate wrong sitemap URLs.
- Broad image remote pattern in `next.config.ts` allows all HTTPS hosts. This may be intentional for Meta/media previews, but should be reviewed before tightening.
- Auth and organization state are persisted in localStorage. Existing safeguards clear cross-user organization state, but future changes must keep this user-bound clearing intact.
- `npm run lint` may mutate files because it includes `--fix`.
- Empty `pages/api/` directory is safe now, but adding files there creates Next serverless routes and can affect Vercel function count.

## Recommended Next Tasks

- Align frontend/backend canvas status route method: either change frontend to `POST` or backend to `PATCH`, then verify WhatsApp and Instagram canvas toggles.
- Update `.env.example` to include every non-secret frontend env variable actually referenced by code.
- Replace or rewrite stale README content so it points to `docs/`.
- Run frontend validation after docs or the next code change:

```bash
npx tsc --noEmit
npm run build
```

- Run backend validation before deploying contract-sensitive changes:

```bash
cd ../whatching-backend
npm run lint
npm run build
```

- Manually test multi-number critical paths against the backend:
  - connect/sync numbers;
  - select number globally;
  - assign canvas to number;
  - create/edit template quick reply routes;
  - create broadcast from selected sender;
  - send conversation template from conversation sender;
  - publish Instagram follower-check flow;
  - create/archive Instagram comment automation.

## Current Git Context

Frontend recent commits:

- `109e43a phone number`
- `34fd1f5 before phone number`
- `f1dc208 preview for flows and fixes`
- `e5ec9ba api folder name change`
- `7eb5428 multiple canvas done`

Backend recent commits:

- `c5f175e Added analytics for organization`
- `f6e7aa4 docs: add repository context for Codex`
- `5e5597a Implemented Role based agent system, Agents automatic assignment bug, Added contacts fetching from WABA App, etc`
- `7b3028a Solved Multiple phone Numnber Bugs`
- `7305b5b Solved many small problems and bugs`

This file intentionally does not include secrets or actual env values.
