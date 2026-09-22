"""RSS ingestion worker. Invoke via the Node API to obtain a persistent job ID."""
import argparse
import ipaddress
import json
import os
import socket
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit, urljoin
import feedparser
import requests
import trafilatura
from bs4 import BeautifulSoup
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from pymongo.errors import DuplicateKeyError
from core import normalize_entry, normalize_url, group_articles, utcnow

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')
load_dotenv(ROOT.parent / 'backend' / '.env')

def heartbeat(db, job_id, stopped):
    """Renew the worker lease independently of slow publisher requests."""
    while not stopped.is_set():
        try:
            renewed = db.ingestionjobs.update_one(
                {'_id': job_id, 'active': True},
                {'$set': {'heartbeatAt': utcnow()}},
            )
            if not renewed.matched_count:
                return
        except Exception:
            pass  # The API expires the lease if database access does not recover.
        if stopped.wait(10):
            return

def fetch_public(url, timeout=15, max_bytes=3_000_000):
    """Bound downloads and revalidate every redirect, including private-network targets."""
    for _ in range(6):
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
            raise ValueError('Invalid public URL')
        if parts.port not in (None, 80, 443):
            raise ValueError('Nonstandard port')
        addresses = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == 'https' else 80))
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Non-public address')
        with requests.get(url, timeout=(timeout, timeout), allow_redirects=False, stream=True,
                          headers={'User-Agent': 'NewsPulse/1.0 (RSS news research; article attribution retained)'}) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers['Location'])
                continue
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > max_bytes:
                    raise ValueError('Response too large')
                chunks.append(chunk)
            return b''.join(chunks), url
    raise ValueError('Too many redirects')

def extract_article(article, timeout):
    try:
        raw, final_url = fetch_public(article['url'], timeout)
        article['url'] = normalize_url(final_url)
        text = trafilatura.extract(raw, url=final_url, include_comments=False, include_tables=False)
        method = 'trafilatura'
        if not text or len(text) < 160:
            soup = BeautifulSoup(raw, 'html.parser')
            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                tag.decompose()
            body = soup.find('article') or soup.find('main')
            text = '\n'.join(p.get_text(' ', strip=True) for p in body.find_all('p')) if body else ''
            method = 'beautifulsoup'
        if text and len(text) >= 160:
            article.update(content=text[:100000], extractionMethod=method)
    except Exception:
        pass  # One blocked publisher never aborts the feed or the job.
    return article

def run(db, job_id):
    threshold = float(os.getenv('SIMILARITY_THRESHOLD', '0.18'))
    limit = int(os.getenv('MAX_ARTICLES_PER_FEED', '25'))
    days = int(os.getenv('CLUSTER_WINDOW_DAYS', '7'))
    timeout = int(os.getenv('HTTP_TIMEOUT_SECONDS', '15'))
    if not (0 < threshold <= 1 and 1 <= limit <= 100 and 1 <= days <= 30 and 1 <= timeout <= 30):
        raise ValueError('Invalid pipeline configuration')
    feeds = json.loads((ROOT / 'feeds.json').read_text(encoding='utf-8'))
    db.articles.create_index('url', unique=True)
    db.articles.create_index('contentHash', unique=True)
    added, warnings, results = 0, [], []
    for feed in feeds:
        result = {'source': feed['name'], 'discovered': 0, 'added': 0, 'skipped': 0, 'extracted': 0, 'status': 'ok'}
        db.ingestionjobs.update_one({'_id': job_id, 'active': True}, {'$set': {'progress': f"Reading {feed['name']}"}})
        try:
            raw, _ = fetch_public(feed['url'], timeout)
            parsed = feedparser.parse(raw)
            if not parsed.entries:
                raise ValueError('Feed contains no articles')
            candidates, seen = [], set()
            for entry in parsed.entries[:limit]:
                result['discovered'] += 1
                try:
                    article = normalize_entry(entry, feed)
                    if article['contentHash'] in seen or db.articles.find_one({'$or': [{'url': article['url']}, {'contentHash': article['contentHash']}]}, {'_id': 1}):
                        result['skipped'] += 1
                        continue
                    seen.add(article['contentHash'])
                    candidates.append(article)
                except (ValueError, TypeError):
                    result['skipped'] += 1
            with ThreadPoolExecutor(max_workers=4) as pool:
                futures = [pool.submit(extract_article, article, timeout) for article in candidates]
                for future in as_completed(futures):
                    article = future.result()
                    try:
                        db.articles.insert_one(article)
                        added += 1; result['added'] += 1
                        result['extracted'] += int(article['extractionMethod'] != 'rss-summary')
                    except DuplicateKeyError:
                        result['skipped'] += 1
                    db.ingestionjobs.update_one({'_id': job_id, 'active': True}, {'$set': {
                        'articlesAdded': added,
                        'progress': f"Reading {feed['name']}: {result['added']} new articles collected",
                    }})
            if result['added'] > result['extracted']:
                warnings.append(f"{feed['name']}: {result['added'] - result['extracted']} articles use RSS summaries because full text was unavailable.")
        except Exception:
            result['status'] = 'failed'
            warnings.append(f"{feed['name']}: feed unavailable; other sources were processed.")
        results.append(result)
        db.ingestionjobs.update_one({'_id': job_id, 'active': True}, {'$set': {'articlesAdded': added, 'feedResults': results, 'warnings': warnings}})
    if all(r['status'] == 'failed' for r in results):
        raise RuntimeError('All RSS feeds failed. Existing timeline data has been preserved.')
    db.ingestionjobs.update_one({'_id': job_id, 'active': True}, {'$set': {'progress': 'Grouping related stories'}})
    cutoff = utcnow() - timedelta(days=days)
    articles = list(db.articles.find({'publishedAt': {'$gte': cutoff}}, {'content': 0}).sort('publishedAt', -1).limit(1001))
    truncated = len(articles) > 1000
    articles = articles[:1000]
    clusters = group_articles(articles, threshold)
    old = db.snapshots.find_one({'_id': 'timeline'}) or {}
    old_ids = {c['_id'] for c in old.get('clusters', [])}
    if not db.ingestionjobs.find_one({'_id': job_id, 'active': True}):
        raise RuntimeError('The ingestion job expired before publication. Please retry.')
    # A single replace operation is the publication boundary; API readers keep a consistent snapshot.
    db.snapshots.replace_one({'_id': 'timeline'}, {
        '_id': 'timeline', 'clusters': clusters, 'updatedAt': utcnow(), 'sources': sorted({a['source'] for a in articles}),
        'articleCount': len(articles), 'truncated': truncated,
    }, upsert=True)
    if clusters:
        db.articles.bulk_write([UpdateOne({'_id': aid}, {'$set': {'clusterId': c['_id']}}) for c in clusters for aid in c['articleIds']])
    db.ingestionjobs.update_one({'_id': job_id, 'active': True}, {'$set': {
        'status': 'completed', 'active': False, 'completedAt': utcnow(), 'progress': 'Timeline updated',
        'articlesAdded': added, 'clustersCreated': sum(c['_id'] not in old_ids for c in clusters),
        'warnings': warnings, 'feedResults': results,
    }})

if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('--job-id', required=True)
    args = cli.parse_args()
    with MongoClient(os.getenv('MONGODB_URI', 'mongodb://127.0.0.1:27017/news_pulse'), serverSelectionTimeoutMS=10000, tz_aware=True) as client:
        db = client[os.getenv('MONGODB_DB', 'news_pulse')]
        job_id = ObjectId(args.job_id)
        if not db.ingestionjobs.find_one({'_id': job_id, 'active': True}):
            raise SystemExit('Start ingestion through POST /api/ingest/trigger.')
        stopped = threading.Event()
        pulse = threading.Thread(target=heartbeat, args=(db, job_id, stopped), daemon=True)
        pulse.start()
        try:
            run(db, job_id)
        except Exception as error:
            message = str(error) if isinstance(error, RuntimeError) else 'Pipeline failed. Check database connectivity and pipeline configuration.'
            db.ingestionjobs.update_one({'_id': job_id}, {'$set': {'status': 'failed', 'active': False, 'completedAt': utcnow(), 'errorMessage': message}})
            raise SystemExit(1)
        finally:
            stopped.set()
            pulse.join(timeout=2)
