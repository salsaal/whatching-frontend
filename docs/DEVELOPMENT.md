# Development

## Setup

Frontend:

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

Backend sibling:

```bash
cd ../whatching-backend
npm install
npm run dev
```

Backend worker:

```bash
cd ../whatching-backend
npm run dev:worker
```

Needs verification: local MongoDB/Redis availability and exact backend env values are environment-specific.

## Frontend Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npx tsc --noEmit
```

Notes:

- `npm run build` runs `next build` and then `next-sitemap`.
- `npm run lint` is configured as `next lint --fix`, so it may edit files.
- Prefer `npx tsc --noEmit` for a non-mutating TypeScript check.
- `npm run format` formats Markdown too, including docs.

## Backend Commands

From `../whatching-backend`:

```bash
npm run dev
npm run dev:worker
npm run build
npm run start
npm run start:worker
npm run lint
```

Backend `npm run lint` is currently `tsc --noEmit`.

## Environment Files

Frontend env files in this checkout:

- `.env.example`
- `.env.development.local`
- `.env.production.local`

Do not print or commit actual values.

Frontend variable names currently referenced:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_META_APP_ID`
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`
- `NEXT_PUBLIC_INSTAGRAM_APP_ID`
- `NEXT_PUBLIC_META_GRAPH_VERSION`
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_VERSION`
- `NEXT_PUBLIC_DOMAIN`
- `NEXT_APP_BASE_URL`
- `NEXT_APP_ENCRYPTION_KEY`
- `NEXT_APP_TOKEN_NAME`
- `NEXT_APP_CLIENT_ID`
- `NEXT_APP_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Backend variable names are defined/validated in `../whatching-backend/src/config/index.ts` and examples. Key categories:

- server/runtime: `PORT`, `NODE_ENV`, `FRONTEND_URL`, `PUBLIC_API_URL`, `CORS_ORIGINS`, `DEFAULT_ORG_TIMEZONE`
- data/queue: `MONGODB_URI`, `REDIS_URL`
- auth/security: `JWT_SECRET`, `ENCRYPTION_KEY`
- Meta/Instagram: `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTA_APP_ID`, `INSTA_APP_SECRET`
- AI: `GEMINI_API_KEY`, `GEMINI_MODEL`
- payments: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_BASIC_PLAN_ID`, `RAZORPAY_PRO_PLAN_ID`
- media: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- email: `EMAIL_DELIVERY_MODE`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`

## Local Workflow

1. Start backend API and worker if testing live product flows.
2. Start frontend dev server.
3. Log in, select or create an organization.
4. Confirm `NEXT_PUBLIC_API_BASE_URL` points to the backend base URL, usually including `/api/v1` if that is how the backend is exposed locally.
5. Use Overview to connect/sync WhatsApp numbers before testing templates, broadcasts, conversations, or flows.
6. Use the global WhatsApp number switcher to verify per-number behaviour.

## Validation Checklist

For frontend UI/API contract changes:

```bash
npx tsc --noEmit
npm run build
```

For backend contract changes:

```bash
cd ../whatching-backend
npm run lint
npm run build
```

Manual checks recommended after multi-number changes:

- Overview loads and syncs phone numbers.
- Global number switcher loads and persists per organization.
- Templates with quick replies can assign triggers for a concrete active number.
- Templates with stale quick reply routing appear as Action Required.
- Broadcast creation requires/selects a valid sender number.
- Conversations filter by number and send using the conversation sender.
- WhatsApp flow canvas assignment/status works for selected numbers.
- Instagram flow builder saves/publishes follower check nodes.
- Instagram comment automation can create, toggle, select media, and archive with confirmation.

## API Patterns

- Add endpoint strings to `client-api/endpoints/index.ts`.
- Add or update TypeScript contracts in `client-api/types/`.
- Add API wrappers in `client-api/functions/`.
- Keep request payload names aligned with backend validations.
- Use React Query query keys that include active organization and number IDs when data differs by organization/number.
- Invalidate related queries after mutations.

## UI Patterns

- Use existing `components/ui` primitives.
- Use lucide icons where available.
- Keep operational screens dense and scannable.
- Use skeleton components from `components/ui/loading-skeletons.tsx` for data fetching states.
- Use `AppLayout` for authenticated pages and `AuthLayout` for auth pages.
- Use `WhatsAppNumberSwitcher` instead of building separate sender selectors unless the workflow needs a fixed sender field.

## Deployment Notes

- This is a Next.js app intended to build with `npm run build`.
- `postbuild` writes sitemap files through `next-sitemap`.
- Avoid adding frontend client code under a root `api/` folder. Vercel treats root `api/` and `pages/api/*` files as serverless functions.
- The current README is still mostly create-next-app boilerplate and mentions a deleted sample API route. Treat docs in `docs/` as the current navigation source.

## Troubleshooting

- 401 loops: check access token persistence, refresh token cookies, `NEXT_PUBLIC_API_BASE_URL`, and CORS credentials.
- Missing `x-org-id`: check active organization hydration and `localStorage.orgId`.
- Meta embedded signup not showing: check `NEXT_PUBLIC_META_APP_ID` and `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`.
- Instagram login disabled: check `NEXT_PUBLIC_INSTAGRAM_APP_ID`.
- Quick reply route missing/stale: check active published canvas triggers for the selected sender number.
- Number-specific behaviour wrong: check `selectedWhatsAppPhoneNumberByOrg`, backend phone number list, and `phoneNumberId` query/payload values.
