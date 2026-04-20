# Deployment Guide — Horizon Healthcare Dashboards

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Build Commands](#build-commands)
- [Vercel Deployment](#vercel-deployment)
  - [Initial Setup](#initial-setup)
  - [Project Configuration](#project-configuration)
  - [SPA Routing Setup](#spa-routing-setup)
  - [Environment Variables](#environment-variables)
- [Preview Deployments for QA](#preview-deployments-for-qa)
- [Production Deployment](#production-deployment)
- [CI/CD — GitHub Actions Integration](#cicd--github-actions-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

Horizon Healthcare Dashboards is a React single-page application built with Vite. This guide covers deploying the application to **Vercel**, configuring environment variables, setting up SPA routing, leveraging preview deployments for QA, and preparing for CI/CD automation with GitHub Actions.

---

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x (or equivalent yarn/pnpm)
- A **Vercel** account ([vercel.com](https://vercel.com))
- Repository hosted on **GitHub**, **GitLab**, or **Bitbucket**

---

## Build Commands

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm install`      | Install all dependencies                         |
| `npm run dev`      | Start the Vite dev server (default: port 5173)   |
| `npm run build`    | Create a production build in the `dist/` folder  |
| `npm run preview`  | Locally preview the production build             |
| `npm run lint`     | Run ESLint across the project                    |
| `npm run test`     | Run the test suite via Vitest                    |

The production build output directory is **`dist`**. All deployment platforms should be configured to serve from this directory.

---

## Vercel Deployment

### Initial Setup

1. **Import the repository** into Vercel:
   - Log in to [vercel.com/dashboard](https://vercel.com/dashboard).
   - Click **"Add New… → Project"**.
   - Select the GitHub repository for `horizon-healthcare-dashboards`.
   - Vercel will auto-detect the Vite framework.

2. **Verify the detected settings** (adjust if needed):

   | Setting              | Value       |
   | -------------------- | ----------- |
   | Framework Preset     | Vite        |
   | Build Command        | `npm run build` |
   | Output Directory     | `dist`      |
   | Install Command      | `npm install`   |
   | Node.js Version      | 18.x        |

3. Click **"Deploy"** to trigger the first deployment.

### Project Configuration

If Vercel does not auto-detect the framework, create or verify the `vercel.json` file in the project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite"
}
```

### SPA Routing Setup

React Router handles client-side routing. When a user navigates directly to a route like `/patients/123`, the server must return `index.html` so React Router can resolve the route on the client.

Add the following **rewrites** rule to `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Complete `vercel.json` example:**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

> **Note:** The `headers` block enables long-term caching for hashed static assets produced by Vite, improving load performance.

### Environment Variables

All client-side environment variables **must** be prefixed with `VITE_` to be exposed to the browser bundle. Never include secrets or API keys that should remain server-side.

#### Required Variables

| Variable                        | Description                                  | Example                              |
| ------------------------------- | -------------------------------------------- | ------------------------------------ |
| `VITE_API_BASE_URL`            | Base URL for the healthcare API              | `https://api.horizon-health.com/v1`  |
| `VITE_APP_TITLE`               | Application title shown in the browser tab   | `Horizon Healthcare Dashboards`      |

#### Optional Variables

| Variable                        | Description                                  | Default   |
| ------------------------------- | -------------------------------------------- | --------- |
| `VITE_ENABLE_ANALYTICS`        | Enable/disable analytics tracking            | `false`   |
| `VITE_LOG_LEVEL`               | Client-side log level                        | `warn`    |

#### Configuring in Vercel

1. Navigate to **Project Settings → Environment Variables**.
2. Add each variable with the appropriate value.
3. Assign variables to the correct **Environment** scope:
   - **Production** — live site only.
   - **Preview** — branch/PR deployments for QA.
   - **Development** — used with `vercel dev` locally.
4. Click **Save**.

> **Security reminder:** Never add `VITE_`-prefixed variables for secrets (database credentials, private API keys). These are embedded in the client bundle and visible to end users.

#### Local Development

Create a `.env.local` file in the project root (this file is git-ignored):

```env
VITE_API_BASE_URL=http://localhost:8080/v1
VITE_APP_TITLE=Horizon Healthcare Dashboards (Dev)
VITE_ENABLE_ANALYTICS=false
VITE_LOG_LEVEL=debug
```

Access variables in code via `import.meta.env.VITE_API_BASE_URL`.

---

## Preview Deployments for QA

Vercel automatically creates a **Preview Deployment** for every push to a non-production branch and for every pull request. This is the primary mechanism for QA review.

### Workflow

1. **Developer** pushes a feature branch or opens a pull request.
2. **Vercel** builds and deploys a unique preview URL (e.g., `horizon-healthcare-dashboards-abc123.vercel.app`).
3. The preview URL is posted as a **comment on the pull request** (GitHub integration).
4. **QA team** clicks the preview link to test the changes in an isolated environment.
5. Once approved, the PR is merged to `main`, triggering a **production deployment**.

### Preview-Specific Environment Variables

You can set different environment variable values for Preview deployments:

- Use a **staging API** endpoint for `VITE_API_BASE_URL` in the Preview scope.
- Disable analytics in Preview by setting `VITE_ENABLE_ANALYTICS=false`.

### Protecting Preview Deployments

For healthcare applications with sensitive data:

1. Go to **Project Settings → Deployment Protection**.
2. Enable **Vercel Authentication** for preview deployments so only team members can access them.
3. Optionally enable **Password Protection** for external QA reviewers.

---

## Production Deployment

### Automatic Deployments

By default, every push to the **`main`** branch triggers a production deployment on Vercel.

### Manual Promotion

To promote a specific preview deployment to production:

```bash
npx vercel --prod
```

Or use the Vercel dashboard: navigate to the deployment and click **"Promote to Production"**.

### Custom Domain

1. Go to **Project Settings → Domains**.
2. Add your custom domain (e.g., `dashboards.horizon-health.com`).
3. Configure DNS records as instructed by Vercel (CNAME or A record).
4. Vercel provisions an SSL certificate automatically.

---

## CI/CD — GitHub Actions Integration

While Vercel handles deployments automatically via Git integration, a GitHub Actions workflow adds pre-deployment quality gates (linting, testing, type checking).

### Recommended Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint & Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm run test -- --run

      - name: Build
        run: npm run build
        env:
          VITE_API_BASE_URL: https://api.staging.horizon-health.com/v1
          VITE_APP_TITLE: Horizon Healthcare Dashboards
```

### Workflow Explanation

| Step                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `npm ci`              | Clean install for reproducible builds                          |
| `npm run lint`        | Catch code style and potential errors before deployment        |
| `npm run test -- --run` | Run Vitest in single-run mode (no watch)                    |
| `npm run build`       | Verify the production build succeeds                           |

### Branch Protection Rules

Configure the following on the `main` branch in GitHub:

1. **Require status checks to pass** — select the `quality` job.
2. **Require pull request reviews** — at least 1 approval.
3. **Require branches to be up to date** before merging.

This ensures no code reaches production without passing lint, tests, and a successful build.

### Future Enhancements

- **Vercel CLI deployment from Actions**: Use `vercel deploy --prod --token=$VERCEL_TOKEN` for full control over the deployment pipeline within GitHub Actions.
- **Lighthouse CI**: Add performance auditing as a CI step to catch regressions in Core Web Vitals.
- **HIPAA compliance scanning**: Integrate security scanning tools (e.g., Snyk, Trivy) to audit dependencies for vulnerabilities relevant to healthcare data.
- **E2E testing**: Add Playwright or Cypress tests as a separate CI job that runs against the Vercel preview URL.

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
| ----- | ----- | -------- |
| 404 on page refresh | SPA routing not configured | Add `rewrites` to `vercel.json` (see [SPA Routing Setup](#spa-routing-setup)) |
| Environment variables undefined | Missing `VITE_` prefix | Ensure all client-side variables start with `VITE_` |
| Build fails on Vercel | Node.js version mismatch | Set Node.js version to 18.x in Project Settings → General |
| Stale preview deployment | Vercel cache | Trigger a redeploy from the Vercel dashboard or push an empty commit |
| Assets return 404 | Incorrect `outputDirectory` | Verify `vercel.json` has `"outputDirectory": "dist"` |

### Vercel CLI Commands

```bash
# Install the Vercel CLI
npm i -g vercel

# Link the project
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Pull environment variables locally
vercel env pull .env.local

# View deployment logs
vercel logs <deployment-url>
```

### Checking Build Output Locally

Before deploying, verify the build works locally:

```bash
npm run build
npm run preview
```

Open `http://localhost:4173` and confirm all routes, assets, and API connections work as expected.

---

## Summary

| Environment | Trigger                  | URL Pattern                                      |
| ----------- | ------------------------ | ------------------------------------------------ |
| Development | `npm run dev`            | `http://localhost:5173`                           |
| Preview     | Push to non-main branch  | `horizon-healthcare-dashboards-*.vercel.app`      |
| Production  | Push to `main`           | `dashboards.horizon-health.com` (custom domain)   |