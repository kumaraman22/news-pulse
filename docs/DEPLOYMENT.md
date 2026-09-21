# Deployment and submission

## Current status

Application code and platform configuration are implemented. Source is being handed off through https://github.com/kumaraman22/news-pulse. Only GitHub publication is currently requested; the intended project owner will use her own Vercel, Render, and MongoDB Atlas accounts. The application is not yet live on the public internet. No hosting purchase is required or initiated by this repository.

The GitHub Actions workflow runs checks only. It does not deploy to Vercel or Render and contains no hosting credentials. The owner can import this repository with access granted by its GitHub owner, or use her own fork. Local environment files and the local development database are not part of the handoff.

## 1. MongoDB Atlas

Create/select a database, create a database user scoped to `news_pulse`, and allow the Render service's outbound IPs. Store the connection string in Render's `MONGODB_URI` secret. Set `MONGODB_DB=news_pulse`. Never commit the URI or put it in a `NEXT_PUBLIC_` variable. Python and Express must use the same database name.

## 2. Render: Node.js + Python

Connect the GitHub repository and import `render.yaml` as a Blueprint, or create a Docker web service pointing to the repository root `Dockerfile`.

- Health check: `/api/health`.
- Required environment: `MONGODB_URI`, `MONGODB_DB`, `FRONTEND_ORIGIN` (your Vercel origin), `TRUST_PROXY=1`.
- The Dockerfile provides `PYTHON_BIN=/opt/venv/bin/python` and installs pipeline packages.
- Render supplies the public URL and may supply `PORT`; the API binds to it.
- The blueprint requests the free plan; availability depends on the account. Do not accept an unexpected paid plan without reviewing it.
- Start with one instance. The active-job index prevents concurrent ingestion, but rate limiting is per process; use a shared limiter before horizontally scaling public traffic.
- The API retries database startup and returns `503` until connected.

## 3. Vercel: Next.js

Import the same repository with root directory **frontend** and framework **Next.js**. Enable access to files outside the root directory if the project settings require it for npm workspaces. `frontend/vercel.json` installs from the repository root and runs the frontend build.

Set `NEXT_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api` before building. This is a public URL, not a secret. Redeploy after changing it. Update Render's `FRONTEND_ORIGIN` to the exact resulting Vercel origin; multiple allowed preview origins can be comma-separated. Do not use an unrestricted wildcard.

## 4. Live verification

1. Open `/api/health`; confirm database connected.
2. Open the frontend in a fresh browser session. Confirm it is in live mode.
3. Click Refresh Data. Confirm a job is created, progress is polled, and the timeline reloads.
4. Confirm the status endpoint reports all three sources. Inspect extraction counts and any warnings.
5. Refresh again after cooldown; unchanged feed entries should be skipped.
6. Open topics, verify chronology and original article links, and test source/date/search filters.
7. Inspect the layout at 320px, 768px, and desktop widths.
8. After the free service has slept, open it cold. Confirm the wake-up message appears and the app recovers. If a request times out, retry after the service starts.

## 5. Submission package

- Working public frontend URL.
- Repository URL with README and environment examples, no credentials.
- Backend URL/health endpoint and note that Python runs in the same Render container.
- Atlas noted as the persistent database.
- Actual 2–3 minute walkthrough video; `VIDEO_WALKTHROUGH.md` is the script, not a substitute for the video.
- Review the missing original assessment pages 7–8 before final submission.

## Troubleshooting

- **CORS error:** verify the precise frontend origin, including scheme and port locally, then restart/redeploy the API.
- **Python cannot start:** point `PYTHON_BIN` to the installed virtual environment executable.
- **Job fails / database unavailable:** check Atlas network access and user permissions without printing the connection string.
- **Publisher extraction warnings:** summary fallback is intentional; check per-feed results to distinguish feed failures from blocked article pages.
- **Worker interrupted:** expired jobs recover after the configured maximum duration plus a short grace period. Retrying while a job is active attaches the browser to that job.
- **Low-memory host:** reduce articles per feed/window; the snapshot is capped at 1,000 articles, but TF-IDF processing still needs memory. Review observed usage before choosing a paid tier.
