# Search Intent Monitor

Vercel/Next.js dashboard for monitoring aggregated Google search interest around GST and company-registration demand in India.

## Signals

- GST registration
- GST registration Bangalore
- Company registration
- Company registration Bangalore
- Private limited company registration
- LLP registration Bangalore

## Important limitation

Google Trends data is anonymised, normalised and aggregated. It does not expose a live count of individual people searching and this application does not identify searchers.

The dashboard therefore reports a relative 0–100 search-interest index.

## Deployment architecture

- **Vercel Hobby** hosts the Next.js dashboard.
- **Upstash Redis** stores the latest sample and rolling history.
- **GitHub Actions** runs the collector every 10 minutes and writes directly to Upstash.
- The dashboard reads the latest Redis snapshot.

There is no Vercel Cron dependency and no public collector endpoint.

## Vercel environment variables

Set these in Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

`CRON_SECRET` is no longer required by the application.

## GitHub Actions secrets

In:

**Settings → Secrets and variables → Actions → Repository secrets**

add:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Use the exact same values you have in Vercel.

The workflow is:

`.github/workflows/collect-search-intent.yml`

It runs every 10 minutes and can also be started manually.

## First test

1. Deploy the repository to Vercel.
2. Confirm the two Upstash variables are present in the Vercel Production environment.
3. Add those same two values as GitHub Actions repository secrets.
4. Open **GitHub → Actions → Collect Search Intent → Run workflow**.
5. Wait for the job to finish.
6. Open the Vercel dashboard and refresh.

## Architecture

- `app/page.js` — dashboard
- `app/api/monitor/route.js` — latest persisted dashboard data
- `lib/store.js` — Upstash persistence
- `lib/config.js` — monitored terms
- `scripts/collect-search-intent.mjs` — direct collector
- `.github/workflows/collect-search-intent.yml` — 10-minute scheduler

## Scheduler note

GitHub scheduled workflows may be delayed during periods of high Actions load. This is a periodic collector, not an exact-to-the-second timer.

## Data adapter note

`google-trends-api` is a community adapter rather than an official Google Trends API. It may require maintenance if Google changes its internal endpoints. For a long-lived commercial deployment, replace the adapter with an approved data provider while preserving the Redis/dashboard interface.
