# AWS Deployment Guide

Web Synth Wizard is a static Vue 3 SPA. The recommended AWS architecture is
**S3 + CloudFront**, giving you global CDN delivery, automatic HTTPS, and
sub-$1/month hosting costs for typical traffic.

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌────────────┐
│  GitHub   │────▶│  CloudFront  │────▶│  S3 Bucket │
│  Actions  │     │  (CDN/HTTPS) │     │  (origin)  │
└──────────┘     └──────────────┘     └────────────┘
     │                                       ▲
     └───── S3 sync + cache invalidation ────┘
```

- **S3** stores the built static files (HTML, JS, CSS, assets)
- **CloudFront** serves them globally with HTTP/2 + HTTP/3, Brotli/gzip
  compression, and HTTPS
- **GitHub Actions** builds, tests, and deploys on every push to `main`
- **OIDC federation** — no long-lived AWS keys stored in GitHub

## Prerequisites

- An AWS account with permissions to create S3, CloudFront, IAM, and
  (optionally) ACM resources
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed locally
- Node.js 20+

## 1. Deploy Infrastructure (one-time)

The CloudFormation template in `infra/cloudformation.yml` provisions everything.

### Without a custom domain

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation.yml \
  --stack-name web-synth-wizard \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### With a custom domain

First, create an ACM certificate in **us-east-1** for your domain and validate
it. Then:

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation.yml \
  --stack-name web-synth-wizard \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1 \
  --parameter-overrides \
    DomainName=synth.example.com \
    CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/abc-123
```

After the stack is created, add a CNAME (or Route 53 alias) from your domain
to the CloudFront distribution domain shown in the stack outputs.

### View stack outputs

```bash
aws cloudformation describe-stacks \
  --stack-name web-synth-wizard \
  --query 'Stacks[0].Outputs' \
  --output table
```

You'll need these values for the next step:
- `BucketName`
- `DistributionId`
- `DeploymentRoleArn`

## 2. Configure GitHub Actions

### Set up OIDC (one-time)

The CloudFormation template creates a deployment IAM role that trusts GitHub's
OIDC provider. You need to ensure the OIDC provider exists in your account:

```bash
# Check if the GitHub OIDC provider already exists
aws iam list-open-id-connect-providers

# If not, create it
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Add repository variables

In your GitHub repository, go to **Settings > Environments**, create a
`production` environment, and add these variables:

| Variable                          | Value                                   |
| --------------------------------- | --------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`             | The `DeploymentRoleArn` from the stack  |
| `AWS_REGION`                      | `us-east-1` (or your chosen region)     |
| `AWS_S3_BUCKET`                   | The `BucketName` from the stack         |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID`  | The `DistributionId` from the stack     |

## 3. Deploy

Push to `main` and the GitHub Actions workflow handles everything:

1. Installs dependencies
2. Runs lint, type-check, and unit tests
3. Builds the production bundle
4. Syncs files to S3 with optimized cache headers
5. Invalidates CloudFront cache for `index.html`

### Manual deployment (without CI)

```bash
# Build locally
npm run build

# Sync to S3
aws s3 sync dist/ s3://YOUR_BUCKET_NAME \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://YOUR_BUCKET_NAME/index.html \
  --cache-control "public, max-age=60, stale-while-revalidate=86400"

# Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/index.html"
```

## Caching Strategy

| File type           | Cache header                                         | Rationale                                  |
| ------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Hashed assets (JS, CSS) | `public, max-age=31536000, immutable`          | Content-hashed filenames — safe to cache forever |
| `index.html`        | `public, max-age=60, stale-while-revalidate=86400`   | Must revalidate quickly to pick up new deploys |
| `manifest.json`     | `public, max-age=60, stale-while-revalidate=86400`   | May change across deploys                  |

## Cost Estimate

For a low-to-moderate traffic site:

| Service      | Estimated monthly cost |
| ------------ | ---------------------- |
| S3 storage   | < $0.01                |
| CloudFront   | $0.00 – $1.00          |
| **Total**    | **~$1/month or less**  |

CloudFront includes 1 TB of free data transfer and 10M requests/month in
the first 12 months (Always Free tier includes 10M requests/month ongoing).

## Troubleshooting

**404 errors on page refresh (SPA routes)**
The CloudFormation template configures CloudFront custom error responses to
return `index.html` for 403/404 errors, enabling Vue Router's history mode.

**Changes not visible after deploy**
CloudFront caches aggressively. The CI pipeline invalidates `index.html`
automatically. For manual deploys, run the invalidation command above.

**CORS issues**
CloudFront's `SecurityHeadersPolicy` is attached to the distribution. If you
need custom CORS headers, create a custom response headers policy in the
CloudFormation template.
