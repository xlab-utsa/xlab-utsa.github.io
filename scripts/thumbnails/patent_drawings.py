"""Thumbnail for each granted patent: its front-page representative drawing.

Lookup: the listed patent number first; if that is missing (many entries carry an
internal docket number), 404s, or names a different patent, search Google Patents by
exact title with the PI as inventor and take the hit whose title matches.

The patent office itself designates one drawing as the patent's representative figure
(printed on the front page; Google Patents lists it first). That's the patent
equivalent of a paper's central figure, so no scoring is needed. The page title must
fuzzy-match ours before anything is saved. Only white margins are trimmed.

usage: python patent_drawings.py <repo_root> <cache_dir>
"""
import io
import json
import re
import sys
import urllib.parse
from pathlib import Path

import requests
import yaml
from PIL import Image, ImageChops
from rapidfuzz import fuzz

UA = {"User-Agent": "Mozilla/5.0 (xlab-utsa-site-thumbnailer; academic lab website)"}


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def trim_white(img):
    bg = Image.new(img.mode, img.size, (255, 255, 255))
    box = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return img
    pad = 24
    return img.crop((max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, img.width), min(box[3] + pad, img.height)))


def fetch_page(patent_path, title):
    """(page_title, drawings, score) for patents.google.com/<patent_path>."""
    r = requests.get(f"https://patents.google.com/{patent_path}", headers=UA, timeout=30)
    if r.status_code != 200:
        return None
    m = re.search(r'<meta name="DC.title" content="([^"]+)"', r.text)
    page_title = " ".join(m.group(1).split()) if m else ""
    drawings = re.findall(r'itemprop="full" content="([^"]+)"', r.text)
    return page_title, drawings, fuzz.token_set_ratio(norm(page_title), norm(title))


def search_by_title(title):
    q = urllib.parse.quote(f'q=("{title}")&inventor=Jinjun+Xiong', safe="")
    r = requests.get(f"https://patents.google.com/xhr/query?url={q}&exp=", headers=UA, timeout=30)
    if r.status_code != 200:
        return []
    hits = []
    for cluster in r.json().get("results", {}).get("cluster", []):
        for res in cluster.get("result", []):
            t = re.sub(r"<[^>]+>", "", res["patent"]["title"])
            if fuzz.ratio(norm(t), norm(title)) >= 90:
                hits.append(res["id"])
    return hits


def main():
    repo, cache = Path(sys.argv[1]), Path(sys.argv[2])
    report = {}
    for path in sorted((repo / "content/publications").glob("patent-*.yaml")):
        pub = yaml.safe_load(path.read_text(encoding="utf-8"))
        if pub.get("thumbnail"):
            continue
        tried = []
        if pub.get("patentNo"):
            number = re.sub(r"[\s,]", "", pub["patentNo"])
            tried.append(f"patent/{number}/en")
        tried += search_by_title(pub["title"])
        found = None
        for patent_path in tried:
            got = fetch_page(patent_path, pub["title"])
            if got and got[2] >= 90 and got[1]:
                found = (patent_path, *got)
                break
        if not found:
            report[pub["id"]] = f"not found (tried {tried})"
            print(f"--   {pub['id']}", flush=True)
            continue
        patent_path, page_title, drawings, score = found
        img = Image.open(io.BytesIO(requests.get(drawings[0], headers=UA, timeout=60).content)).convert("RGB")
        img = trim_white(img)
        img.thumbnail((960, 960))
        dest = repo / "public/images/publications" / pub["id"]
        dest.mkdir(parents=True, exist_ok=True)
        img.save(dest / "thumbnail.webp", quality=88)
        report[pub["id"]] = {"patent": patent_path, "drawing": drawings[0], "title_match": score}
        print(f"OK   {pub['id']}  -> {patent_path}", flush=True)
    (cache / "patents.json").write_text(json.dumps(report, indent=1))
    print(f"{sum(isinstance(v, dict) for v in report.values())}/{len(report)} patents got a drawing")


if __name__ == "__main__":
    main()
