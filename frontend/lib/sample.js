const topics = [
  [
    "Lunar mission enters a new chapter",
    ["space", "lunar mission", "science"],
    12,
    61,
    4,
  ],
  [
    "The global shift to clean energy",
    ["renewables", "climate", "energy"],
    9,
    68,
    14,
  ],
  [
    "A new era of artificial intelligence",
    ["technology", "artificial intelligence"],
    8,
    49,
    2,
  ],
  [
    "Cities rethink their public spaces",
    ["cities", "transport", "urban planning"],
    6,
    57,
    22,
  ],
  [
    "World leaders meet for climate talks",
    ["climate", "diplomacy", "summit"],
    11,
    40,
    1,
  ],
  [
    "Inside the changing global economy",
    ["economy", "trade", "markets"],
    7,
    65,
    10,
  ],
  [
    "Ocean researchers make a discovery",
    ["ocean", "research", "biodiversity"],
    4,
    31,
    5,
  ],
  [
    "The next generation of world sport",
    ["sport", "athletes", "championship"],
    5,
    25,
    0,
  ],
];
export function sampleData() {
  const now = Date.now();
  const sources = ["BBC News", "The Guardian", "Al Jazeera"];
  const data = topics.map(([label, keywords, count, start, end], index) => {
    const articles = Array.from({ length: count }, (_, i) => ({
      _id: `${index}-${i}`,
      title: `${label}: ${["the latest developments", "what the new findings mean", "a closer look at the story", "the international response"][i % 4]}`,
      source: sources[i % 3],
      publishedAt: new Date(
        now - (start - ((start - end) * i) / (count - 1)) * 3600000,
      ).toISOString(),
      summary:
        "This is an illustrative sample article, created to demonstrate the timeline and story explorer. Switch to live data to read real reporting from the original publishers.",
      url: [
        "https://www.bbc.com/news",
        "https://www.theguardian.com/world",
        "https://www.aljazeera.com/",
      ][i % 3],
      extractionMethod: "sample",
    }));
    return {
      id: index.toString(16).padStart(24, "0"),
      label,
      keywords,
      articleCount: count,
      sources,
      startTime: articles[0].publishedAt,
      endTime: articles.at(-1).publishedAt,
      intensity: count / 12,
      articles,
    };
  });
  return {
    data,
    meta: {
      sources,
      updatedAt: new Date(now).toISOString(),
      mode: "sample",
      totalArticles: data.reduce((sum, c) => sum + c.articleCount, 0),
    },
  };
}
export function filterSample(sample, filters) {
  const data = sample.data.flatMap((c) => {
    if (
      filters.search &&
      !`${c.label} ${c.keywords.join(" ")}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    )
      return [];
    const articles = c.articles.filter(
      (a) =>
        (!filters.source || a.source === filters.source) &&
        (!filters.start ||
          new Date(a.publishedAt) >= new Date(`${filters.start}T00:00:00`)) &&
        (!filters.end ||
          new Date(a.publishedAt) <= new Date(`${filters.end}T23:59:59.999`)),
    );
    return articles.length
      ? [
          {
            ...c,
            articles,
            articleCount: articles.length,
            sources: [...new Set(articles.map((a) => a.source))],
            startTime: articles[0].publishedAt,
            endTime: articles.at(-1).publishedAt,
          },
        ]
      : [];
  });
  return {
    data,
    meta: {
      ...sample.meta,
      totalArticles: data.reduce((s, c) => s + c.articleCount, 0),
    },
  };
}
