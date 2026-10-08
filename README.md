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

## Vercel

Import this repository into Vercel. The included vercel.json configures:

/api/cron/collect

to run every 10 minutes.

Set these environment variables:

- CRON_SECRET
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

Optional baseline variables are in .env.example.

## Local

npm install
npm run dev

Then open http://localhost:3000.

## Architecture

- app/page.js — dashboard
- app/api/monitor/route.js — fresh dashboard data
- app/api/cron/collect/route.js — scheduled collector
- lib/trends.js — Google Trends adapter and scoring
- lib/store.js — optional Upstash persistence
- lib/config.js — monitored terms

## Data adapter note

google-trends-api is a community adapter rather than an official Google Trends API. It may require maintenance if Google changes its internal endpoints. For a long-lived commercial deployment, replace lib/trends.js with an approved data provider while preserving the dashboard/storage interfaces.
