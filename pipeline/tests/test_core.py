from datetime import datetime, timezone
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from core import normalize_url, normalize_entry, publication_date, group_articles

NOW = datetime(2026, 9, 21, tzinfo=timezone.utc)
FEED = {'name': 'Example', 'url': 'https://example.com/rss'}

def test_url_tracking_and_relative_urls():
    assert normalize_url('/story?utm_source=rss&b=2&a=1#section', FEED['url']) == 'https://example.com/story?a=1&b=2'
    with pytest.raises(ValueError):
        normalize_url('javascript:alert(1)')

def test_missing_fields_content_and_dedup():
    entry = {'title': '<b>Space mission</b>', 'link': '/news', 'content': [{'value': '<p>Moon landing</p>'}]}
    article = normalize_entry(entry, FEED, NOW)
    assert article['summary'] == 'Moon landing'
    assert article['dateEstimated'] and article['publishedAt'] == NOW
    assert article['contentHash'] == normalize_entry({**entry, 'link': '/different'}, FEED, NOW)['contentHash']
    with pytest.raises(ValueError):
        normalize_entry({'title': 'Missing link'}, FEED, NOW)

@pytest.mark.parametrize('date', ['Sun, 20 Sep 2026 10:00:00 GMT', '2026-09-20T15:30:00+05:30', '2026-09-20 10:00:00'])
def test_dates(date):
    parsed, estimated = publication_date({'published': date}, NOW)
    assert parsed.hour == 10 and not estimated

def test_future_invalid_dates():
    assert publication_date({'published': 'nonsense'}, NOW) == (NOW, True)
    assert publication_date({'published': '2030-01-01'}, NOW) == (NOW, True)

def test_coherent_groups_and_labels():
    titles = ['Lunar spacecraft lands on moon surface', 'Spacecraft lands on lunar moon surface', 'Football league championship final results']
    articles = [{**normalize_entry({'title': t, 'link': f'/story/{i}'}, FEED, NOW), '_id': str(i)} for i,t in enumerate(titles)]
    clusters = group_articles(articles)
    assert sorted(c['articleCount'] for c in clusters) == [1, 2]
    assert all(c['label'] and c['keywords'] for c in clusters)
    assert {c['_id'] for c in clusters} == {c['_id'] for c in group_articles(list(reversed(articles)))}

def test_empty_vocabulary_and_empty_input():
    assert group_articles([]) == []
    article = {**normalize_entry({'title': 'the and a', 'link': '/a'}, FEED, NOW), '_id': '1'}
    assert group_articles([article])[0]['label'] == 'the and a'

def test_extraction_failure_falls_back(monkeypatch):
    import main
    monkeypatch.setattr(main, 'fetch_public', lambda *args: (_ for _ in ()).throw(ValueError('offline')))
    article = normalize_entry({'title': 'News', 'link': '/a', 'summary': 'Available summary'}, FEED, NOW)
    assert main.extract_article(article, 1)['content'] == 'Available summary'
