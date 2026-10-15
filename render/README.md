# Content Studio on Render

This is a separate service from Floorplan Studio. The existing n8n Cloud instance remains the research scheduler and holds the OpenAI credential.

## Deployment

Create a Render Blueprint from `AITSCCTV/contentstudio`, using `render.yaml` on `main`. It creates one Node 24 Starter web service in Singapore with a 1 GB persistent disk mounted at `/var/data`. This is a paid service; review the price in Render before creating it. No Postgres or Cloudflare account is required for this single-instance deployment. SQLite records and JPEG images are stored on the disk. A disk limits the service to one instance and causes a short interruption during deploys. Monitor disk capacity as the library grows.

The Render build command is `corepack enable && pnpm install --frozen-lockfile && pnpm build:render`; the start command is `node dist-render/server/server.mjs`. The external origin is read from Render's `RENDER_EXTERNAL_URL`; set `PUBLIC_ORIGIN` instead when adding a custom domain, with no trailing slash. A missing or short secret leaves all application routes locked with HTTP 503; the health endpoint still reports liveness.

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

Run `pnpm build:render`, `node test-render.mjs`, `node test-publishing.mjs`, `node test-post-route.mjs`, and `pnpm exec tsc --noEmit`. Integration tests use temporary storage and synthetic credentials, make no external API calls, and check persisted records/images across process restarts. Publishing tests use mocked platform responses.

Back up both the database and images. For a consistent SQLite database copy, use Node's SQLite backup API from the Render Shell (`node scripts/backup-render.mjs`). Download the resulting database backup and image directory to company-controlled backup storage. A Render disk snapshot alone should not be treated as a verified database backup. Restore and live Meta/OpenAI access still require operational validation. All publishing remains disabled in the Blueprint.
