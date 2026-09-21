"""Deterministic normalization and bounded, centroid-based topic clustering."""
import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
from dateutil import parser
from bs4 import BeautifulSoup
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
from sklearn.metrics.pairwise import cosine_similarity

def utcnow():
    return datetime.now(timezone.utc)

def normalize_url(url, base=''):
    parts = urlsplit(urljoin(base, url.strip()))
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError('Expected a public HTTP URL')
    query = sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                   if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid', 'mc_cid', 'mc_eid'))
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or '/', urlencode(query), ''))

def clean_html(value):
    return ' '.join(BeautifulSoup(value or '', 'html.parser').get_text(' ', strip=True).split())

def publication_date(entry, now=None):
    now = now or utcnow()
    for key in ('published', 'updated', 'date'):
        if entry.get(key):
            try:
                date = parser.parse(entry[key])
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone.utc)
                date = date.astimezone(timezone.utc)
                if date <= now:
                    return date, False
            except (ValueError, TypeError, OverflowError):
                pass
    return now, True

def normalize_entry(entry, feed, now=None):
    now = now or utcnow()
    title = clean_html(entry.get('title', ''))
    if not title or not entry.get('link'):
        raise ValueError('Article missing headline or link')
    url = normalize_url(entry['link'], feed['url'])
    content = entry.get('content') or []
    summary = clean_html(entry.get('summary') or entry.get('description') or (content[0].get('value', '') if content else ''))
    published, estimated = publication_date(entry, now)
    media = entry.get('media_content') or entry.get('media_thumbnail') or []
    image = media[0].get('url', '') if media else ''
    if not image:
        image = next((e.get('href', '') for e in entry.get('enclosures', []) if e.get('type', '').startswith('image/')), '')
    try:
        image = normalize_url(image, url) if image else ''
    except ValueError:
        image = ''
    fingerprint = re.sub(r'\W+', ' ', title.lower()).strip()
    return {
        'title': title, 'summary': summary, 'content': summary, 'source': feed['name'], 'url': url,
        'imageUrl': image, 'author': clean_html(entry.get('author', '')), 'publishedAt': published,
        'ingestedAt': now, 'dateEstimated': estimated, 'extractionMethod': 'rss-summary',
        'contentHash': hashlib.sha256(f"{feed['name'].lower()}:{fingerprint}".encode()).hexdigest(),
    }

def group_articles(articles, threshold=0.18):
    if not 0 < threshold <= 1:
        raise ValueError('Similarity threshold must be in (0, 1]')
    if not articles:
        return []
    # Sorting makes the greedy pass reproducible for identical inputs.
    articles = sorted(articles, key=lambda a: (a['publishedAt'], str(a['_id'])))
    texts = [f"{a['title']} {a['title']} {a.get('summary', '')}" for a in articles]
    stop_words = sorted(ENGLISH_STOP_WORDS | {'said', 'says', 'bbc', 'guardian', 'jazeera', 'al', 'ms', 'mr', 'mrs', 'news', 'read', 'continue', 'video', 'watch'})
    vectorizer = TfidfVectorizer(stop_words=stop_words, strip_accents='unicode',
                                 token_pattern=r'(?u)\b[a-zA-Z][a-zA-Z]+\b',
                                 ngram_range=(1, 2), max_features=12000, sublinear_tf=True)
    try:
        vectors = vectorizer.fit_transform(texts)
    except ValueError:  # Headlines containing only stop words still form valid singletons.
        vectors = None
    groups, centroids = [], []
    for index in range(len(articles)):
        similarities = cosine_similarity(vectors[index], np.vstack(centroids))[0] if centroids and vectors is not None else []
        best = int(np.argmax(similarities)) if len(similarities) else -1
        if best >= 0 and similarities[best] >= threshold:
            groups[best].append(index)
            centroids[best] = np.asarray(vectors[groups[best]].mean(axis=0)).ravel()
        else:
            groups.append([index])
            if vectors is not None:
                centroids.append(vectors[index].toarray().ravel())
    terms = vectorizer.get_feature_names_out() if vectors is not None else []
    clusters = []
    for indices in groups:
        members = [articles[i] for i in indices]
        keywords = []
        if vectors is not None:
            weights = np.asarray(vectors[indices].mean(axis=0)).ravel()
            for i in weights.argsort()[::-1]:
                term = str(terms[i])
                if weights[i] <= 0:
                    break
                if not any(set(term.split()) & set(k.split()) for k in keywords):
                    keywords.append(term)
                if len(keywords) == 3:
                    break
        cluster_id = hashlib.sha256(min(a['url'] for a in members).encode()).hexdigest()[:24]
        clusters.append({
            '_id': cluster_id, 'label': ' · '.join(k.title() for k in keywords) or members[0]['title'],
            'keywords': keywords, 'articleIds': [a['_id'] for a in members], 'articleCount': len(members),
            'sources': sorted({a['source'] for a in members}), 'startTime': members[0]['publishedAt'],
            'endTime': members[-1]['publishedAt'], 'createdAt': min(a['ingestedAt'] for a in members), 'updatedAt': utcnow(),
        })
    return clusters
