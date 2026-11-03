# Orb Data Freshness Dashboard

This Next.js dashboard queries Snowflake using server-side service credentials.
Access requires Google Workspace authentication and an explicit email allowlist.

## Authentication setup

1. Create a Google OAuth web client for the dashboard. Register
   `https://<dashboard-host>/api/auth/callback/google` as an authorized redirect URI
   (use `http://localhost:3000/api/auth/callback/google` for local development).
2. Set the variables shown in `.env.example` in each deployment environment.
   For local development, copy that file to `.env.local` and fill in the values.
   Set `NEXTAUTH_URL` to the deployment's canonical URL and generate a unique
   `NEXTAUTH_SECRET` with `openssl rand -base64 32`.
3. Set `DASHBOARD_ALLOWED_EMAILS` to a comma-separated list of authorized
   `@vercel.com` email addresses. There are no default authorized users.

Google must report both a verified email and membership in the `vercel.com`
Workspace domain. The domain hint on the login screen is not the access check:
the server validates the returned profile before issuing an encrypted session
cookie. Sessions expire after eight hours. The current allowlist is checked on
every page request and before every Snowflake query, so removing an address
also denies existing sessions on their next request.

Missing authentication configuration denies access without querying Snowflake.
Unauthorized visitors receive only a generic access-restricted page. The
dashboard is rendered per request and is not statically cached. Vercel Deployment
Protection can be enabled as an additional deployment-level control.

## Development

Use pnpm 10 (the package overrides in `package.json` require pnpm 10 or earlier).

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Existing Snowflake account, warehouse, and session-token configuration is also
required to load dashboard data.

```sh
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
```
