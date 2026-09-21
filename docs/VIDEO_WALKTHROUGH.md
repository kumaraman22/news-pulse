# 2–3 minute walkthrough script

Record the deployed application with real ingested data after deployment verification. This script is preparation; it is not a recorded video.

- **0:00–0:20 — Purpose.** “News Pulse groups live reporting into topics so you can see how a story develops across publishers and time.” Show the live URL and summary cards.
- **0:20–0:55 — Timeline.** Explain the horizontal time axis and each bar's first/latest publication timestamps. Open a topic and compare chronological articles from different sources. Follow an original article link.
- **0:55–1:15 — Filters.** Select one publisher, search a keyword, choose a date range, and clear the filters. Explain that counts and time ranges reflect the matching articles.
- **1:15–1:45 — Refresh.** Trigger ingestion. Show its job progress and the eventual success message. Mention that duplicate URLs/headlines are skipped and a failed publisher does not stop the other feeds. Prepare an already completed run in case the live job takes longer than the recording.
- **1:45–2:20 — Architecture.** Show the README diagram: Next.js → Express → MongoDB; Express starts Python. Python uses feedparser, trafilatura, BeautifulSoup, and TF-IDF cosine similarity with threshold 0.18.
- **2:20–2:45 — Tradeoffs.** Explain automatic labels, lexical similarity limitations, the bounded seven-day clustering window, and deployment locations. Mention tests and clearly distinguish sample mode from live reporting.

Do not show environment files, connection strings, or hosting account secrets in the recording. Add the actual video link and live URL to the submission once available.
