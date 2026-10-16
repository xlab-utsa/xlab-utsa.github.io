"""Find an open-access PDF for every publication and download it.

Sources, in order: OpenAlex (title search -> OA locations, arXiv preferred),
arXiv API (title search), Semantic Scholar (openAccessPdf). A match must agree on
the normalized title (fuzzy >= 92) and, when both sides have one, the year (+-2, preprints often precede the venue).

Writes <cache>/pdfs/<id>.pdf and <cache>/sources.json ({id: {pdf, via, landing}}).
Publications that already have a thumbnail, and patents, are skipped.

Set OPENALEX_API_KEY in the environment to use your own OpenAlex key (the keyless
daily budget is only ~100 title searches). --retry-misses re-runs OpenAlex for
papers an earlier run gave up on (e.g. after the keyless budget ran out).

usage: python resolve_pdfs.py <repo_root> <cache_dir> [--retry-misses]
"""
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
import yaml
from rapidfuzz import fuzz

UA = {"User-Agent": "xlab-utsa-site-thumbnailer/1.0 (academic lab website)"}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def title_ok(a: str, b: str) -> bool:
    return fuzz.ratio(norm(a), norm(b)) >= 92


def year_ok(y1, y2) -> bool:
    return not y1 or not y2 or abs(int(y1) - int(y2)) <= 2


def get(url, retries=3, **kw):
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=UA, timeout=(8, 25), **kw)
            if r.status_code == 429 and attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            return r
        except requests.RequestException:
            time.sleep(2)
    return None


OPENALEX_OFF = False  # set once the keyless daily budget (~100 searches) is spent


def openalex(pub):
    global OPENALEX_OFF
    if OPENALEX_OFF:
        return []
    # exact-title filter first (precise); fall back to relevance search within +-2 years
    year = pub.get("year")
    queries = [{"filter": f"title.search:{norm(pub['title'])[:200]}"}]
    queries.append({"search": pub["title"], **({"filter": f"publication_year:{year - 2}-{year + 2}"} if year else {})})
    out = []
    for params in queries:
        key = {"api_key": os.environ["OPENALEX_API_KEY"]} if os.environ.get("OPENALEX_API_KEY") else {}
        r = get("https://api.openalex.org/works", retries=1, params={**params, "per-page": 10, **key})
        if r is not None and r.status_code == 429:
            OPENALEX_OFF = True
            print("OpenAlex daily budget used up; continuing without it", flush=True)
            return []
        if not r or r.status_code != 200:
            continue
        for w in r.json().get("results", []):
            if not w.get("title") or not title_ok(w["title"], pub["title"]):
                continue
            if not year_ok(year, w.get("publication_year")):
                continue
            urls = [(l.get("pdf_url"), l.get("landing_page_url"), (l.get("source") or {}).get("display_name")) for l in w.get("locations") or []]
            urls.append(((w.get("open_access") or {}).get("oa_url"), None, "oa_url"))
            for pdf, landing, src in urls:
                m = re.search(r"arxiv\.org/(?:abs|pdf)/([\w.\-/]+?)(?:v\d+)?(?:\.pdf)?$", pdf or landing or "")
                if m:
                    out.insert(0, (f"https://arxiv.org/pdf/{m.group(1)}", "openalex:arxiv", f"https://arxiv.org/abs/{m.group(1)}"))
                elif pdf:
                    out.append((pdf, f"openalex:{src or 'oa'}", landing or pdf))
        if out:
            break
    return list(dict.fromkeys(out))


def arxiv(pub):
    time.sleep(3.1)  # arXiv API asks for >= 3 s between calls
    q = " AND ".join(f'ti:"{w}"' for w in norm(pub["title"]).split()[:12])
    r = get("https://export.arxiv.org/api/query", params={"search_query": q, "max_results": 5})
    if not r or r.status_code != 200:
        return []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in ET.fromstring(r.text).findall("a:entry", ns):
        t = " ".join(e.find("a:title", ns).text.split())
        y = e.find("a:published", ns).text[:4]
        if title_ok(t, pub["title"]) and year_ok(pub.get("year"), y):
            abs_url = e.find("a:id", ns).text
            out.append((abs_url.replace("/abs/", "/pdf/"), "arxiv", abs_url))
    return out


def s2(pub):
    r = get(
        "https://api.semanticscholar.org/graph/v1/paper/search/match",
        params={"query": pub["title"], "fields": "title,year,openAccessPdf,externalIds"},
        retries=1,  # unauthenticated S2 is often rate-limited; don't stall on it
    )
    time.sleep(1.1)
    if not r or r.status_code != 200:
        return []
    out = []
    for p in r.json().get("data", []):
        if not title_ok(p.get("title", ""), pub["title"]) or not year_ok(pub.get("year"), p.get("year")):
            continue
        ax = (p.get("externalIds") or {}).get("ArXiv")
        if ax:
            out.append((f"https://arxiv.org/pdf/{ax}", "s2:arxiv", f"https://arxiv.org/abs/{ax}"))
        oa = (p.get("openAccessPdf") or {}).get("url")
        if oa:
            out.append((oa, "s2:oa", oa))
    return out


def download(url, dest: Path) -> bool:
    """Fetch a PDF, giving up after 60 s or 60 MB (some hosts trickle bytes forever)."""
    try:
        with requests.get(url, headers=UA, timeout=(8, 20), stream=True, allow_redirects=True) as r:
            if r.status_code != 200:
                return False
            start, chunks, size = time.time(), [], 0
            for chunk in r.iter_content(65536):
                chunks.append(chunk)
                size += len(chunk)
                if time.time() - start > 60 or size > 60_000_000:
                    return False
    except requests.RequestException:
        return False
    data = b"".join(chunks)
    if not data.startswith(b"%PDF"):
        return False
    dest.write_bytes(data)
    return True


def main():
    repo, cache = Path(sys.argv[1]), Path(sys.argv[2])
    (cache / "pdfs").mkdir(parents=True, exist_ok=True)
    sources_path = cache / "sources.json"
    sources = json.loads(sources_path.read_text()) if sources_path.exists() else {}

    pubs = [yaml.safe_load(p.read_text(encoding="utf-8")) for p in sorted((repo / "content/publications").glob("*.yaml"))]
    # sources[id]: dict = found; {} = every finder tried, nothing open; None/absent = not finished
    retry = "--retry-misses" in sys.argv
    tried_before = {pid for pid, v in sources.items() if v == {}}  # arXiv/S2 already done for these
    todo = [
        p for p in pubs
        if p["category"] != "patent" and not p.get("thumbnail")
        and (sources.get(p["id"]) is None or (retry and p["id"] in tried_before))
    ]
    print(f"{len(todo)} publications to resolve", flush=True)

    def try_finders(pub, finders):
        for finder in finders:
            for url, via, landing in finder(pub):
                if download(url, cache / "pdfs" / f"{pub['id']}.pdf"):
                    return {"pdf": url, "via": via, "landing": landing}
        return None

    # pass 1: OpenAlex, 6 at a time (it tolerates light concurrency)
    with ThreadPoolExecutor(6) as pool:
        for pub, found in zip(todo, pool.map(lambda p: try_finders(p, [openalex]), todo)):
            sources[pub["id"]] = found
            print(f"openalex {'OK  ' if found else 'none'} {pub['id']}", flush=True)
    sources_path.write_text(json.dumps(sources, indent=1))

    # pass 2: arXiv then Semantic Scholar for the misses, one at a time (rate limits)
    misses = [p for p in todo if not sources[p["id"]] and p["id"] not in tried_before]
    for p in todo:
        if p["id"] in tried_before and not sources[p["id"]]:
            sources[p["id"]] = {}
    for i, pub in enumerate(misses, 1):
        found = try_finders(pub, [arxiv, s2])
        sources[pub["id"]] = found or {}
        print(f"[{i}/{len(misses)}] arxiv/s2 {'OK  ' if found else 'none'} {pub['id']}", flush=True)
        sources_path.write_text(json.dumps(sources, indent=1))

    ok = sum(1 for v in sources.values() if v)  # {} and None are both misses
    print(f"resolved {ok}/{len(sources)}")


if __name__ == "__main__":
    main()
