# Whatching Codex Guide

This checkout is the Whatching frontend: a Next.js Pages Router app that calls an Express/Mongo backend through `client-api/`.

Start with these docs before changing code:

- `docs/PROJECT_OVERVIEW.md` for repository shape, stack, pages, env names, and adjacent backend context.
- `docs/ARCHITECTURE.md` for frontend/backend data flow, state, API client behaviour, and multi-number routing.
- `docs/FEATURES.md` for the implemented product surface and supported flow/template blocks.
- `docs/DEVELOPMENT.md` for setup, commands, validation, and local workflow notes.
- `docs/DECISIONS.md` for non-obvious decisions and repo-specific constraints.
- `docs/CURRENT_STATE.md` for completed work, known issues, and recommended next tasks.

Rules for future tasks:

- Do not put secrets or actual `.env*` values in docs, logs, commits, or final replies.
- Keep API client code in `client-api/`; do not recreate a root `api/` client folder or add sample Next API routes.
- Preserve existing workflows/UI unless the user asks for a change. If a fix requires behaviour change, call it out first.
- Check the sibling backend at `../whatching-backend` when frontend API contracts, models, routes, queues, or workers matter.
- Prefer `npx tsc --noEmit` and `npm run build` for frontend validation. `npm run lint` is configured with `--fix`, so it may mutate files.
