# Local verification — updated 22 September 2026

| Check | Result |
| --- | --- |
| Python tests | 9 passed |
| Backend/configuration tests | 12 passed against isolated real MongoDB, including stale-worker recovery |
| Frontend component tests | 5 passed |
| Browser tests | 3 passed, including opt-in live RSS flow |
| Accessibility | Dashboard and drawer: no violations detected by axe WCAG 2 A/AA and 2.1 AA checks |
| Responsive layout | 1440, 768, 375, and 320 pixels; no page-level horizontal overflow |
| Production frontend build | Passed; JavaScript application, self-hosted Inter fonts |
| npm dependency audit at install | 0 known vulnerabilities reported |
| Secret exclusions | Backend/frontend local environment files, virtual environment, and database directory confirmed gitignored |

## Live ingestion evidence

The first run processed 25 articles from each of BBC News, The Guardian, and Al Jazeera: 75 inserted and 75 full bodies extracted. A subsequent run skipped 74 existing feed entries and inserted one newly published article. Later unchanged-feed refreshes inserted zero articles. The latest inspected snapshot contained 76 articles, 71 topics, and five multi-article topics, including cross-publisher stories.

The live browser test triggers the real API, polls job completion, reloads the timeline, filters to BBC News, opens an article drawer, and verifies source attribution and an original article link. No browser page errors were observed in the passing final run.

## Remaining verification

- Public Vercel/Render deployment, Atlas connectivity, and hosting cold-start behavior await account/project configuration.
- The Docker image has not been built locally: Docker is not installed on this machine.
- CI configuration is checked in but has not run on a remote repository.
- Automated accessibility checks do not replace a full manual assistive-technology audit.
- The walkthrough script is ready; an actual 2–3 minute video still needs recording.
- Original assessment pages 7–8 remain unavailable for submission-requirement verification.

## Refresh recovery — 22 September

A refresh stayed marked running after its Python worker disappeared during API restarts. The original maximum-runtime recovery left the UI busy for up to ten minutes. The fix adds worker heartbeats every ten seconds and stale-job recovery after 90 seconds, checked every 15 seconds, while preserving the separate maximum-runtime limit. Normal development now runs the API without automatic file-watch restarts; optional `dev:watch` remains available.

Verified recovery cleared the abandoned job. Clicking Refresh Data in the user's open browser completed in about six seconds, collected 25 new articles, and showed the success message with the button enabled again. A second browser-driven refresh processed all three feeds, skipped all 75 existing entries, and completed with zero new articles and no warnings. The snapshot held 159 articles across 142 topics. All 29 automated tests passed after the fix, including three browser tests covering live refresh, source filtering, article details, accessibility, and responsive layouts.
