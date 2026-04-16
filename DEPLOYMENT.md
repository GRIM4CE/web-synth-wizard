# AWS Amplify Deployment Guide

Web Synth Wizard is a static Vue 3 SPA deployed on **AWS Amplify Hosting**,
which provides automatic builds, a global CDN, HTTPS, and PR preview
environments — all with minimal configuration.

## Architecture

```
┌──────────┐     ┌──────────────────┐     ┌────────────┐
│  GitHub   │────▶│  AWS Amplify     │────▶│ CloudFront │────▶ Users
│  (push)   │     │  (build & host)  │     │  (CDN)     │
└──────────┘     └──────────────────┘     └────────────┘
```

- **Amplify** watches the GitHub repo, builds on push, and deploys the `dist/` output
- **CloudFront** (managed by Amplify) delivers assets globally with HTTPS
- **GitHub Actions** runs CI checks (lint, type-check, tests) independently

## Prerequisites

- An AWS account
- This GitHub repository

## Setup (one-time)

### 1. Create the Amplify app

1. Open the [AWS Amplify console](https://console.aws.amazon.com/amplify/)
2. Click **Create new app**
3. Select **GitHub** and authorize access to `grim4ce/web-synth-wizard`
4. Select the `main` branch
5. Amplify will auto-detect the `amplify.yml` build spec — verify the settings:
   - Build command: `npm run build`
   - Output directory: `dist`
6. Click **Save and deploy**

### Using the AWS CLI

```bash
aws amplify create-app \
  --name web-synth-wizard \
  --repository https://github.com/grim4ce/web-synth-wizard \
  --platform WEB \
  --build-spec "$(cat amplify.yml)"
```

### 2. Configure SPA redirects

In the Amplify console, go to **Hosting > Rewrites and redirects** and add:

| Source address | Target address | Type          |
| -------------- | -------------- | ------------- |
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>`  | `/index.html`  | `200 (Rewrite)` |

This ensures all SPA routes serve `index.html` instead of returning 404.

### 3. Enable PR previews (optional)

1. In the Amplify console, go to **Hosting > Previews**
2. Click **Enable previews**
3. Each pull request will get its own preview URL automatically

## Deploying

**Automatic:** Push to `main` and Amplify builds and deploys within minutes.

**Manual (via console):** Go to the Amplify app page and click **Redeploy this version**.

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every
push and PR to `main`:

1. Lint (`eslint`)
2. Type check (`vue-tsc`)
3. Unit tests (`vitest`)
4. Build verification

This runs independently of Amplify's build and catches issues early in PRs.

## Caching Strategy

Configured in `amplify.yml` via custom headers:

| File type                  | Cache header                                       | Rationale                                    |
| -------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Hashed assets (`.js`, `.css`) | `public, max-age=31536000, immutable`           | Content-hashed filenames — safe to cache forever |
| `index.html`               | `public, max-age=60, stale-while-revalidate=86400` | Must revalidate quickly to pick up new deploys |

## Custom Domain

1. In the Amplify console, go to **Hosting > Custom domains**
2. Click **Add domain**
3. Enter your domain and follow the DNS verification steps
4. Amplify provisions and manages the SSL certificate automatically

## Cost Estimate

| Resource             | Free tier                     | After free tier       |
| -------------------- | ----------------------------- | --------------------- |
| Build minutes        | 1,000 min/month               | $0.01/min             |
| Data served          | 15 GB/month                   | $0.15/GB              |
| Data stored          | 5 GB                          | $0.023/GB             |
| **Typical monthly**  |                               | **$0 – $1/month**     |

## Troubleshooting

**Build fails in Amplify but works locally**
Check the build logs in the Amplify console. Common causes:
- Node.js version mismatch — Amplify defaults may differ from your local version.
  Add to `amplify.yml` under `preBuild` commands: `nvm use 20`
- Missing dependencies — ensure `package-lock.json` is committed

**404 on page refresh**
Verify the SPA rewrite rule is configured (see step 2 above).

**Stale content after deploy**
Amplify automatically invalidates the CloudFront cache on deploy. If content
is still stale, check your browser cache or try an incognito window.
