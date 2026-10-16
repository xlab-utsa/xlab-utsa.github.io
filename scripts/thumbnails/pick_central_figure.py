"""Extract every figure from each downloaded PDF and pick the paper's central figure.

Figure extraction (PyMuPDF): find caption blocks ("Figure N" / "Fig. N"), then take
the union of image + vector-drawing boxes sitting directly above (or below) the
caption in the same column, and render that region at 300 dpi.

Central-figure score, following Yang et al. (ICDAR 2019) and Yamamoto et al. (2021):
  position  - earlier figures score higher (Fig. 1 is most often the teaser/overview)
  size      - share of the page the figure occupies
  mentions  - how often the body text refers to "Fig. N"
  abstract  - caption <-> abstract embedding similarity (all-MiniLM-L6-v2)
  overview  - caption announces it ("overview", "framework", "pipeline", ...)
  visual    - CLIP zero-shot: photo / rendered scene / overview diagram  vs  plot / table
The figure itself is never altered beyond cropping to its own bounds.

Writes <cache>/figs/<id>/fig<N>.png for every candidate, <cache>/picks.json, and the
winner to public/images/publications/<id>/thumbnail.webp. To correct a pick, add
"<id>: <figure number>" (or "<id>: none") to overrides.yaml next to this script and rerun.

usage: python pick_central_figure.py <repo_root> <cache_dir>
"""
import json
import re
import sys
from pathlib import Path

import fitz
import open_clip
import torch
import yaml
from PIL import Image
from sentence_transformers import SentenceTransformer, util

CAPTION_RE = re.compile(r"^\s*(fig\.?|figure)\s*(\d+)\s*[:.\-—|]?", re.I)
MENTION_RE = r"\b(?:fig\.?|figure)\s*{n}\b"
# captions that announce the paper's summary figure
OVERVIEW_RE = re.compile(r"\b(overview|framework|pipeline|architecture|illustration|approach|proposed|workflow|teaser)\b", re.I)

CLIP_LABELS = {
    "photo": "a photograph of a real scene, device, person or object",
    "render": "a rendered 3D scene or a qualitative visual result",
    "diagram": "an illustrative overview diagram of a system, framework or pipeline",
    "plot": "a line plot, bar chart or scatter plot with axes",
    "table": "a table of numbers",
    "text": "a block of text or an algorithm listing",
}
CLIP_WEIGHT = {"photo": 1.0, "render": 1.0, "diagram": 0.8, "plot": -0.6, "table": -1.0, "text": -1.0}


def find_figures(doc):
    """Yield (fig_no, page_no, rect, caption) for each captioned figure."""
    seen = set()
    for pno, page in enumerate(doc):
        if pno > 14:
            break
        pw, ph = page.rect.width, page.rect.height
        blocks = [b for b in page.get_text("blocks") if b[6] == 0]
        top, bottom = ph * 0.06, ph * 0.95  # running headers / footers / page numbers
        visual = [fitz.Rect(i["bbox"]) for i in page.get_image_info()]
        visual += [fitz.Rect(d["rect"]) for d in page.get_drawings() if d["rect"].width > 2 or d["rect"].height > 2]
        visual = [r for r in visual if r.width * r.height > 25 and r.width < pw * 0.98 and r.y0 > top and r.y1 < bottom]
        for b in blocks:
            text = b[4].strip()
            m = CAPTION_RE.match(text)
            if not m:
                continue
            n = int(m.group(2))
            if n in seen:
                continue
            cap = fitz.Rect(b[:4])
            # column span: full width when the caption is wide or centered on the page
            # (short captions under two-column figures), else the caption's column
            centered = abs((cap.x0 + cap.x1) / 2 - pw / 2) < pw * 0.08 and cap.x0 < pw * 0.42
            if cap.width > pw * 0.55 or centered:
                x0, x1 = pw * 0.04, pw * 0.96
            elif cap.x0 < pw / 2:
                x0, x1 = 0, pw / 2 + 4
            else:
                x0, x1 = pw / 2 - 4, pw

            # barriers: the figure can't extend past another caption or a body-text paragraph
            def is_barrier(tb):
                t = fitz.Rect(tb[:4])
                if t.x1 < x0 + 12 or t.x0 > x1 - 12 or t == cap:  # must really sit in this column
                    return False
                if CAPTION_RE.match(tb[4].strip()):
                    return True
                # body paragraph: long, column-wide, and not drawn over (a figure's merged
                # math labels can be long too, but they sit on the figure's strokes)
                inner = fitz.Rect(t.x0 + 2, t.y0 + 2, t.x1 - 2, t.y1 - 2)
                return (len(tb[4]) > 100 and t.width > (x1 - x0) * 0.7
                        and sum(1 for r in visual if r.intersects(inner) and r.width < t.width * 0.9) < 3)

            lo = max([top] + [tb[3] for tb in blocks if tb[3] <= cap.y0 + 1 and is_barrier(tb)])
            hi = min([bottom] + [tb[1] for tb in blocks if tb[1] >= cap.y1 - 1 and is_barrier(tb)])
            region = None
            for above in (True, False):
                span = (lo - 1, cap.y0 - 1) if above else (cap.y1 + 1, hi + 1)
                inside = [r for r in visual if r.x0 >= x0 - 2 and r.x1 <= x1 + 2 and r.y0 >= span[0] and r.y1 <= span[1]]
                region = None
                for r in inside:
                    region = fitz.Rect(r) if region is None else region | r
                if region is not None and region.height > 40:
                    break
            if region is None or region.height < 40 or region.width < 60:
                continue
            # pull in the figure's own text labels (short blocks touching it), never body text
            for _ in range(2):
                grown = fitz.Rect(region.x0 - 6, region.y0 - 6, region.x1 + 6, region.y1 + 6)
                for tb in blocks:
                    t = fitz.Rect(tb[:4])
                    outside = t.y1 <= region.y0 + 1 or t.y0 >= region.y1 - 1
                    if (len(tb[4]) < 200 and not CAPTION_RE.match(tb[4].strip()) and t.intersects(grown)
                            and t.y0 >= span[0] and t.y1 <= span[1] and t.x0 >= x0 - 2 and t.x1 <= x1 + 2
                            and not (outside and (t.height > 14 or pno == 0  # one label line; never the title/author block
                                                  or t.x0 < region.x0 - 6 or t.x1 > region.x1 + 6))):
                        region |= t
            region = fitz.Rect(region.x0 - 3, max(region.y0 - 3, span[0]), region.x1 + 3, min(region.y1 + 3, span[1]))
            region &= page.rect
            seen.add(n)
            yield n, pno, region, " ".join(text.split())


def first_page_abstract(doc):
    text = doc[0].get_text()
    m = re.search(r"abstract[\s.:—-]*(.{200,2000}?)(\n\s*(1\.?|I\.)?\s*introduction|\Z)", text, re.I | re.S)
    return " ".join((m.group(1) if m else text[:1500]).split())


def main():
    repo, cache = Path(sys.argv[1]), Path(sys.argv[2])
    sources = json.loads((cache / "sources.json").read_text())
    picks_path = cache / "picks.json"
    picks = json.loads(picks_path.read_text()) if picks_path.exists() else {}
    overrides_path = Path(__file__).with_name("overrides.yaml")
    overrides = (yaml.safe_load(overrides_path.read_text()) or {}) if overrides_path.exists() else {}
    picks = {k: v for k, v in picks.items() if k not in overrides}  # re-pick overridden papers

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    clip, _, prep = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k", device=dev)
    tok = open_clip.get_tokenizer("ViT-B-32")
    with torch.no_grad():
        lab = clip.encode_text(tok(list(CLIP_LABELS.values())).to(dev))
        lab /= lab.norm(dim=-1, keepdim=True)
    st = SentenceTransformer("all-MiniLM-L6-v2", device=dev)

    for pid, src in sources.items():
        if not src or pid in picks:
            continue
        pdf = cache / "pdfs" / f"{pid}.pdf"
        try:
            doc = fitz.open(pdf)
        except Exception as e:  # noqa: BLE001
            picks[pid] = {"error": str(e)}
            continue
        body = " ".join(p.get_text() for p in doc)
        abstract = first_page_abstract(doc)
        abs_emb = st.encode(abstract, convert_to_tensor=True)
        out_dir = cache / "figs" / pid
        out_dir.mkdir(parents=True, exist_ok=True)
        cands = []
        for n, pno, rect, caption in find_figures(doc):
            page = doc[pno]
            png = out_dir / f"fig{n}.png"
            try:
                page.get_pixmap(clip=rect, dpi=300).save(png)
            except Exception:  # noqa: BLE001 - degenerate region; skip this figure
                continue
            img = Image.open(png).convert("RGB")
            with torch.no_grad():
                f = clip.encode_image(prep(img).unsqueeze(0).to(dev))
                f /= f.norm(dim=-1, keepdim=True)
                probs = (100 * f @ lab.T).softmax(dim=-1)[0].tolist()
            kinds = dict(zip(CLIP_LABELS, probs))
            visual = sum(CLIP_WEIGHT[k] * p for k, p in kinds.items())
            mentions = len(re.findall(MENTION_RE.format(n=n), body, re.I)) - 1
            area = rect.width * rect.height / (page.rect.width * page.rect.height)
            sim = float(util.cos_sim(abs_emb, st.encode(caption, convert_to_tensor=True)))
            aspect = rect.width / max(rect.height, 1)
            score = (
                1.2 / n  # position
                + 1.0 * min(area / 0.35, 1.0)  # size
                + 0.15 * min(max(mentions, 0), 6)  # mentions
                + 1.5 * sim  # caption <-> abstract
                + 1.2 * visual  # real-looking imagery over plots/tables
                + (0.8 if OVERVIEW_RE.search(caption) else 0)  # "Overview of our framework..."
                - (0.6 if aspect < 0.6 or aspect > 4.5 else 0)  # awkward in a 16:9 card
            )
            cands.append({
                "fig": n, "page": pno + 1, "score": round(score, 3), "caption": caption[:300],
                "kind": max(kinds, key=kinds.get), "sim": round(sim, 3), "mentions": mentions,
                "area": round(area, 3), "file": png.name,
            })
        cands.sort(key=lambda c: -c["score"])
        # a human override (overrides.yaml: "<id>: <figure number>") beats the score
        if overrides.get(pid) == "none":  # no figure in the paper works as a thumbnail
            picks[pid] = {"candidates": cands, "chosen": None}
            (repo / "public/images/publications" / pid / "thumbnail.webp").unlink(missing_ok=True)
            print(f"{pid}: override -> none", flush=True)
            picks_path.write_text(json.dumps(picks, indent=1))
            continue
        if pid in overrides:
            cands.sort(key=lambda c: c["fig"] != overrides[pid])
        picks[pid] = {"candidates": cands, "chosen": cands[0]["fig"] if cands else None}
        if cands:
            dest = repo / "public/images/publications" / pid
            dest.mkdir(parents=True, exist_ok=True)
            img = Image.open(out_dir / cands[0]["file"]).convert("RGB")
            img.thumbnail((960, 960))
            img.save(dest / "thumbnail.webp", quality=88)
        print(f"{pid}: {len(cands)} figs -> {picks[pid]['chosen']}", flush=True)
        picks_path.write_text(json.dumps(picks, indent=1))


if __name__ == "__main__":
    main()
