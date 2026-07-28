# Project Overview

Whatching is a web dashboard for WhatsApp and Instagram automation. This repository is the frontend application. The backend is a separate sibling checkout at `../whatching-backend` and exposes the API consumed by `client-api/`.

This document is derived from the current codebase and recent git history. Information marked "Needs verification" should be checked against the live backend, Meta configuration, or production deployment before relying on it.

## Repository Role

- Frontend repo: `/Users/salsaalshahid/Documents/GitHub/whatching`
- Adjacent backend repo: `/Users/salsaalshahid/Documents/GitHub/whatching-backend`
- Frontend framework: Next.js Pages Router with React 19 and TypeScript.
- UI stack: Tailwind CSS 4, shadcn/Radix UI components, lucide icons, `@xyflow/react` for flow canvases.
- Data fetching: TanStack Query.
- Local state: Zustand persisted stores for auth and organization state.
- HTTP client: Axios instance in `client-api/axiosInstance/index.ts`.

## Frontend Structure

Important directories:

- `pages/`: route-level screens. This app uses the Pages Router.
- `layouts/`: authenticated app shell and auth shell.
- `components/ui/`: shared shadcn/Radix primitives.
- `components/templates/`: WhatsApp template forms, table, preview, and utilities.
- `components/flows/`: block previews, node rendering, and full-flow preview dialog.
- `components/whatsapp/`: WhatsApp number switcher and number management panel.
- `components/subscribers/`, `components/media/`, `components/auth/`: feature-specific UI.
- `client-api/endpoints/`: frontend endpoint constants.
- `client-api/functions/`: typed API wrappers.
- `client-api/types/`: frontend API response and payload types.
- `stores/`: persisted auth and organization state.
- `styles/globals.css`: Tailwind imports, variables, and global styles.
- `public/assets/images/`: logo and auth artwork.
- `docs/`: durable repository documentation.

`pages/api/` and `pages/dashboard/` exist as directories but currently contain no files. Keep them empty unless the app intentionally needs Next API routes.

Compact repository tree:

```text
.
├── AGENTS.md
├── README.md
├── client-api/
│   ├── axiosInstance/
│   ├── endpoints/
│   ├── functions/
│   └── types/
├── components/
│   ├── Seo/
│   ├── app/
│   ├── auth/
│   ├── flows/
│   ├── media/
│   ├── subscribers/
│   ├── templates/
│   ├── ui/
│   └── whatsapp/
├── config/
├── docs/
├── hooks/
├── json/
│   ├── assets/
│   ├── events/
│   ├── lottie/
│   ├── messages/
│   └── mock/
├── layouts/
├── lib/
│   ├── functions/
│   └── regex/
├── pages/
│   ├── auth/
│   ├── broadcasts/
│   ├── flows/
│   ├── instagram/
│   ├── reset-password/
│   ├── settings/
│   ├── templates/
│   └── verify/
├── public/
│   └── assets/images/
├── services/
├── stores/
├── styles/
├── typescript/
│   ├── interface/
│   └── types/
└── ui/
```

Top-level config/support files include `package.json`, `package-lock.json`, `next.config.ts`, `next-sitemap.config.js`, `tsconfig.json`, `components.json`, `postcss.config.mjs`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, and `.husky/`.

## Frontend Pages

Current route files:

- `/` redirects to `/overview`.
- `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify`.
- `/verify/[token]` and `/reset-password/[token]` handle token links from backend emails.
- `/organisations` manages organization selection/setup.
- `/overview` shows workspace overview and Meta/WhatsApp embedded signup integration.
- `/templates` and `/templates/create`, `/templates/[templateId]`.
- `/broadcasts` and `/broadcasts/[broadcastId]`.
- `/flows` and `/flows/[canvasId]` for WhatsApp flow listing and builder.
- `/instagram` and `/instagram/[canvasId]` for Instagram connection, canvases, and comment automation.
- `/conversations`, `/contacts`, `/media`, `/profile`.
- `/settings`, `/settings/agents`, `/settings/billing`, `/settings/knowledge`.
- `/404`.

## Package And Config

Important frontend scripts from `package.json`:

- `npm run dev`: start Next dev server.
- `npm run build`: build Next app, then run `next-sitemap` via `postbuild`.
- `npm run start`: start built Next app.
- `npm run lint`: runs `next lint --fix`; this may modify files.
- `npm run format`: Prettier over JS/TS/JSON/CSS/SCSS/MD.

Important config files:

- `next.config.ts`: strict TypeScript build, broad HTTPS image remote pattern, exposed legacy `NEXT_APP_*` env block.
- `tsconfig.json`: strict TypeScript, `@/*` path alias, `allowJs`, no emit.
- `components.json`: shadcn config, `new-york` style, aliases to `components/ui`, `lib`, and `hooks`.
- `next-sitemap.config.js`: sitemap/robots generation. Uses `NEXT_PUBLIC_DOMAIN` with a fallback placeholder.
- `.eslintrc.json`: Next core web vitals and TypeScript config.

## Environment Variables

Do not document actual values. The frontend code references these names:

- `NEXT_PUBLIC_API_BASE_URL`: Axios base URL and refresh-token URL.
- `NEXT_PUBLIC_META_APP_ID`: WhatsApp Embedded Signup Meta app ID.
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`: WhatsApp Embedded Signup config ID.
- `NEXT_PUBLIC_INSTAGRAM_APP_ID`: Instagram Login app ID.
- `NEXT_PUBLIC_META_GRAPH_VERSION`: optional, defaults to `v20.0` in `pages/overview.tsx`.
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_VERSION`: optional, defaults to `v4` in `pages/overview.tsx`.
- `NEXT_PUBLIC_DOMAIN`: used by `next-sitemap.config.js`.
- `NEXT_APP_BASE_URL`, `NEXT_APP_ENCRYPTION_KEY`, `NEXT_APP_TOKEN_NAME`, `NEXT_APP_CLIENT_ID`, `NEXT_APP_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`: exposed through `next.config.ts`; current frontend usage outside config needs verification.

`.env.example` currently lists only `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`, and `NEXT_PUBLIC_INSTAGRAM_APP_ID`. Needs verification: decide whether to add optional Graph/version/domain variables to the example.

The backend examples reference additional variables for MongoDB, Redis, Meta, Instagram, Gemini, Razorpay, Cloudinary, email, JWT, and encryption. See `../whatching-backend/.env.example` and `../whatching-backend/.env.production.example`; never copy values from `../whatching-backend/.env`.

## Backend Summary

The sibling backend is an Express 5, TypeScript, MongoDB/Mongoose, BullMQ, Redis, Socket.IO application. It mounts:

- `/api/v1/users`
- `/api/v1/organizations`
- `/api/v1/whatsapp`
- `/api/v1/instagram`
- `/api/v1/organizations/templates`
- `/api/v1/organizations/messages`
- `/api/v1/organizations/conversations`
- `/api/v1/organizations/subscribers`
- `/api/v1/organizations/broadcasts`
- `/api/v1/organizations/media`
- `/api/v1/organizations/chat`
- `/api/v1/organizations/bot`
- `/api/v1/organizations/instagram`
- `/api/v1/organizations/analytics`
- `/api/v1/templates`
- `/api/v1/messages`

Main backend model groups include users, organizations, memberships, WhatsApp phone numbers, templates and drafts, conversations/messages, subscribers, media, broadcasts, WhatsApp bot canvases, Instagram canvases, Instagram media, comment rules, logs, knowledge sources/chunks, webhook events, integration logs, and transactions.

## Recent Git History

Frontend recent commits:

- `109e43a phone number`: multi-number frontend implementation, template quick reply routing, WhatsApp number switcher/panel, flows/broadcasts/conversations/template changes.
- `34fd1f5 before phone number`: small flow preview dialog adjustment.
- `f1dc208 preview for flows and fixes`: flow previews, auth layout work, skeletons, tooltips, Instagram comment automation and canvas UI work.
- `e5ec9ba api folder name change`: renamed frontend API client folder from `api` to `client-api` and removed sample Next API route.
- `7eb5428 multiple canvas done`: canvas listing/building changes.

Backend recent commits:

- `c5f175e Added analytics for organization`
- `f6e7aa4 docs: add repository context for Codex`
- `5e5597a Implemented Role based agent system, Agents automatic assignment bug, Added contacts fetching from WABA App, etc`
- `7b3028a Solved Multiple phone Numnber Bugs`
- `7305b5b Solved many small problems and bugs`

At the time this documentation was created, the frontend `git diff` was empty before adding docs.
