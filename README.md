# Search Intent Monitor

Vercel/Next.js service for monitoring aggregated search interest around GST and company-registration demand in India.

## Signals

- GST registration
- GST registration Bangalore
- Company registration
- Company registration Bangalore
- Private limited company registration
- LLP registration Bangalore

## Important limitation

Google Trends data is anonymised, normalised and aggregated. It does not expose a live count of individual people searching and this application does not identify searchers.

The dashboard therefore reports a relative 0–100 search-interest index. Optional Google Ads Keyword Planner baseline volumes can be configured to produce a directional daily estimate.

## Deployment architecture

- **Vercel Hobby** hosts the Next.js dashboard and API.
- **Upstash Redis** stores the latest sample and rolling history.
- **GitHub Actions** triggers `/api/cron/collect` every 10 minutes.
- The browser reads the latest Redis snapshot instead of calling Google Trends on every refresh.

Vercel Cron is intentionally not used, so the project does not depend on Vercel's paid Cron scheduling.

## Vercel environment variables

Set these in Vercel:

- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## GitHub Actions secrets

In the GitHub repository, open:

**Settings → Secrets and variables → Actions → New repository secret**

Add:

- `VERCEL_APP_URL` — your deployed Vercel URL, for example `https://search-engine.example.vercel.app`
- `CRON_SECRET` — exactly the same value used in Vercel.

The workflow file is:

`.github/workflows/collect-search-intent.yml`

It runs every 10 minutes and can also be started manually from the GitHub Actions tab.

## First deployment

1. Deploy the repository to Vercel.
2. Add the three Vercel environment variables.
3. Complete the Vercel deployment.
4. Copy the live Vercel URL.
5. Add `VERCEL_APP_URL` and the same `CRON_SECRET` as GitHub Actions secrets.
6. Open **GitHub → Actions → Collect Search Intent → Run workflow** once to test immediately.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Architecture

- `app/page.js` — dashboard
- `app/api/monitor/route.js` — latest persisted dashboard data
- `app/api/cron/collect/route.js` — scheduled collector endpoint
- `lib/trends.js` — Google Trends adapter and scoring
- `lib/store.js` — Upstash persistence
- `lib/config.js` — monitored terms
- `.github/workflows/collect-search-intent.yml` — 10-minute scheduler

## Scheduler note

GitHub scheduled workflows may be delayed during periods of high Actions load. The workflow is a periodic collector, not a guaranteed exact-to-the-second timer.

## Data adapter note

`google-trends-api` is a community adapter rather than an official Google Trends API. It may require maintenance if Google changes its internal endpoints. For a long-lived commercial deployment, replace `lib/trends.js` with an approved data provider while preserving the dashboard/storage interfaces.
