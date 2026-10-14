# AITS Content Studio

Private content review dashboard for AITSCCTV. Review Thai captions, images and evidence, edit drafts, then approve publication to Facebook and Instagram. The interface supports English and Thai and remembers the selected language.

## Current status

Dashboard source and a local demo are implemented. Production deployment, the private n8n connection, Meta authorization and a complete live publishing test are pending. Pushing this repository does not deploy the dashboard or enable posting.

The companion n8n workflow researches Thailand trends every two hours, verifies sources, generates captions and images, and delivers draft packages. General service content is secondary. Workflow exports are maintained separately.

## Local development

Use Node.js 22.13+ and pnpm 10.30.3 (development was validated with Node 24):

```sh
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ancient_madame_hydra.sql
pnpm dev
```

Open `http://127.0.0.1:5173/`. The portable profile provides loopback-only mock sign-in at `/signin-with-chatgpt?return_to=%2F`. Local databases, image objects, dependencies and preview state are ignored by Git. A fresh clone starts with an empty library. See [starter/runtime guide](docs/starter-guide.md) for platform details.

## Optional demo

`node scripts/seed-demo.mjs` writes local seed SQL to `.sites-runtime/demo/seed.sql`. Apply it with the D1 command above, replacing the migration file with that seed path and keeping `--local`.

The three demo drafts contain hypothetical scenarios, existing AITS website illustrations and a publication block in both the UI and server. No OpenAI or Meta key is needed for the demo. Its R2 images are local objects:

| Object key | Image source |
| --- | --- |
| `11111111111111111111111111111111.jpg` | https://aitscctv.com/wp-content/uploads/2026/09/smart-home-4.jpeg |
| `22222222222222222222222222222222.jpg` | https://aitscctv.com/wp-content/uploads/2026/09/smart-industrial-4.jpg |

Download the images outside Git, then use `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js r2 object put site-creator-r2/<object-key> --file <local-image> --local --config dist/server/wrangler.json --persist-to .wrangler/state` to upload them to local R2.

## Hosted configuration

The app requires server execution, D1 (`DB`), R2 (`BUCKET`), authentication and runtime secrets. GitHub Pages alone cannot run its backend. The hosting manifest retains the existing Sites project identifier, which is not a credential.

Hosted authentication currently relies on the Sites sign-in gateway. Deploying elsewhere requires a separate trusted authentication integration; do not expose the app directly with client-supplied identity headers.

Configure secrets in the host, never in Git or browser code:

- Private n8n connection: `INGEST_TOKEN`, `SITE_SERVICE_TOKEN`, `OWNER_EMAIL`, `N8N_MEDIA_BASE_URL`.
- Meta authorization: `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_TOKEN`, `META_GRAPH_VERSION`; optional `INSTAGRAM_API_HOST=graph.instagram.com` for the Instagram Login API.
- Keep `POSTING_ENABLED=false` until account setup and controlled live tests succeed. Set `MONITORING_ENABLED=true` only when the n8n schedule is enabled.

The OpenAI credential belongs in n8n, not this dashboard's frontend. Hosting access is separate from GitHub access. For Sites deployment, preserve the existing project identity and owner-only audience.

## Publishing and validation

Post approves the selected saved revision. Each platform has a durable publication record. Published or uncertain results are not automatically resubmitted. Instagram resumes its existing container while processing. Expired trend drafts and demo drafts cannot be published.

```sh
pnpm exec tsc --noEmit
node test-publishing.mjs
node test-post-route.mjs
pnpm build
```

Route tests mock storage and Meta, making no public posts. They cover approval, stale revisions, expired news, duplicate prevention, Instagram resume, uncertain outcomes and the demo publication block. Live account permissions and image-generation access still need validation.
