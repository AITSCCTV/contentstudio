# Content Studio on Render

This is a separate service from Floorplan Studio. Hosting uses Render Free and Supabase Free, with no paid Render services or disks. The existing n8n Cloud instance remains the research scheduler and holds the OpenAI credential; their existing costs are separate from hosting.

## Deployment

Create a Render Blueprint from `AITSCCTV/contentstudio`, using `render.yaml` on `main`. It creates one Node 24 **Free** web service in Singapore, with no disk or managed database. Drafts and JPEG images are stored externally in Supabase Free. Render Free's local filesystem is temporary; hosted local SQLite mode is rejected. Keep both providers on their free plans and monitor their limits. Render Free can sleep after 15 minutes idle, so the next request may take about a minute to start. Free Supabase projects may pause after a week of inactivity. Render's free Postgres expires after 30 days and is not used.

The Render build command is `corepack enable && pnpm install --frozen-lockfile && pnpm build:render`; the start command is `node dist-render/server/server.mjs`. The external origin is read from Render's `RENDER_EXTERNAL_URL`; set `PUBLIC_ORIGIN` instead when adding a custom domain, with no trailing slash. The app can deploy without secrets but all application routes stay locked with HTTP 503 until access and external storage are configured. The health endpoint reports liveness and configuration presence, not an active connection test.

## Free persistent storage

Create a project in a **Supabase Free** organization. Create a **private** Storage bucket named `contentstudio-images` (or set `SUPABASE_STORAGE_BUCKET` to your bucket's name), allow JPEG files, and allow up to 8 MB per image. Enter the following privately in Render's Environment page:

- `DATABASE_URL`: Supabase's **Session pooler** PostgreSQL URL (IPv4, port 5432), with the database password URL-encoded. The application creates its tables in the private `aits_contentstudio` schema, not the exposed `public` schema. It requires a database role that can create that schema. Do not add the private schema to the Data API's exposed schemas.
- `DATABASE_PASSWORD` (optional): the raw Supabase database password. When set, this overrides the password inside `DATABASE_URL`; the application encodes it automatically. Enter the original password here without percent encoding. Startup diagnostics include only the connection host, port, username, database name, and password source, never the password or full URL.
- `DATABASE_CA_CERT`, if needed: override the bundled Supabase Root 2021 CA with the project database root CA from Supabase's connection settings. The public certificate is sourced from Supabase's Database Settings → Download certificate link (`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`). System trust roots remain available and TLS certificate verification stays enabled; do not disable it to bypass connection errors.
- `SUPABASE_URL`: the HTTPS project origin, e.g. `https://your-project.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: the backend-only Supabase service-role key. Never use it in the browser or GitHub Pages. Database and storage credentials remain server-only.

Supabase Free currently includes 500 MB database storage and 1 GB file storage. These are quotas, not unlimited storage. No paid upgrade is configured or authorized. See the providers' current free-plan limits before changing plans.

Enter these secrets directly in Render, never Git or chat:

- `STUDIO_PASSWORD`: a unique randomly generated password of at least 24 characters. The shared team username is `aits-team` (`STUDIO_USER`). This initial version has shared team access, not individual accounts or individual approval attribution. Distribute the login through your password manager.
- `INGEST_TOKEN`: an independent random secret of at least 32 characters, shared only with n8n.

The application uses an HttpOnly, Secure, SameSite cookie, expiring after eight hours. Identity headers from the old hosting gateway are ignored. Changing the team password invalidates existing sessions. Failed logins are limited in memory; behind Render's proxy this may apply to the team collectively. Redeploy clears that attempt counter.

## n8n connection

1. Set `MI Configuration → config.studioUrl` to the new Render application origin.
2. In n8n, create an HTTP **Custom Auth** credential named `AITS Content Studio Ingest`, containing `{"headers":{"Authorization":"Bearer <INGEST_TOKEN>"}}`. Enter the actual secret privately.
3. Select that credential for **Deliver to Content Studio**, **Store Research Run**, and the retained image relay if it is used. These endpoints receive drafts/images or research reports at `/api/ingest`.
4. Run an ingestion check, confirm a draft and its images appear after signing in, then run a controlled research preview before enabling delivery and the schedule. `liveEnabled` is still false in the workflow until that validation is complete. `MONITORING_ENABLED` is only a dashboard indicator; it does not start the n8n schedule.

The OpenAI key remains in n8n's `Content Studio` credential. No OpenAI key is required in the Render frontend.

## Publishing

Keep `POSTING_ENABLED=false` until Meta access and a controlled live publishing test succeed. Configure `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_TOKEN`, and `META_GRAPH_VERSION` in Render. Use the supported Meta API version for your app. Optional `INSTAGRAM_API_HOST=graph.instagram.com` applies only to the Instagram Login integration.

Render serves expiring media tickets directly at `/public-media/<ticket>` for Instagram to fetch approved images. `N8N_MEDIA_BASE_URL` defaults to that endpoint, so the extra n8n Approved Image Relay is optional for this deployment. Ordinary `/media/` previews require team sign-in. Never make the image directory public. The token-gated `/api/media-ticket/` endpoint is retained for compatibility with the relay.

The live dashboard and backend share one origin on Render. The GitHub Pages URL continues to be the separate browser-local demo; it is not connected to live drafts and stores no credentials. Use the Render URL for team review and publishing.

## Verification and operations

Run `pnpm build:render`, `node test-render.mjs`, `node test-supabase.mjs`, `node test-publishing.mjs`, `node test-post-route.mjs`, and `pnpm exec tsc --noEmit`. Local integration tests explicitly select `STORAGE_BACKEND=sqlite-local`, use temporary storage and synthetic credentials, and check persisted records/images across process restarts. PostgreSQL portability tests use embedded PostgreSQL and mocked Supabase HTTP responses. They do not claim a live Supabase connection test. Publishing tests use mocked platform responses.

Back up the private Supabase schema with PostgreSQL tools and export the private bucket images to company-controlled storage. Free hosting should not be treated as a backup. The SQLite backup script is for local development only. Restore, live Supabase connectivity, and Meta/OpenAI access still require operational validation. All publishing remains disabled in the Blueprint.
