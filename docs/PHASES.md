# News Pulse implementation phases

1. **Foundation:** JavaScript npm workspaces, separate Next.js and Express apps, Python environment, environment examples.
2. **Collection and grouping:** configurable public RSS feeds; normalization; text extraction and fallback; duplicate indexes; TF-IDF grouping; atomic timeline publication.
3. **API:** cluster lists/details, timeline filtering, persistent ingestion jobs, concurrency protection, validation, CORS, rate limiting, health checks.
4. **Interface:** responsive dashboard, time-spanning bars, article drawer, search/source/date filters, topic cards, explicitly labeled sample mode.
5. **Integration and verification:** refresh/poll/reload, restart recovery, partial failures, automated tests, desktop/mobile browser checks.
6. **Delivery:** README, Docker/Render/Vercel configuration, CI, deployment verification, screenshots, walkthrough script and recorded video.

Live deployment requires a MongoDB Atlas connection string and access to the user's Render/Vercel projects. The original assessment's pages 7–8 were not supplied; the separate nine-page build prompt does not replace those missing assessment pages.

## Verification checkpoint

Phases 1–5 are implemented and locally exercised. Phase 6 includes deployment configuration, documentation, screenshots, CI, and the walkthrough script. Public deployment, cold-start evaluation on hosting, and the actual recorded video remain outstanding.

Live collection processed all three feeds and extracted 75 article bodies in the first run. A repeat run skipped 74 existing feed entries and added one new article; a later unchanged run added zero. Browser checks exercise the real refresh/poll/reload path as well as sample mode. Docker configuration is provided but could not be built locally because Docker is not installed on this machine.
