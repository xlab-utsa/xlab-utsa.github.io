"""Point each publication at its generated thumbnail.

Adds `thumbnail: /images/publications/<id>/thumbnail.webp` (right after `category:`,
where the hand-set ones live) to every publication YAML that has a generated file and
no thumbnail yet. Hand-set thumbnails are never touched. Text-level edit, so the rest
of each file keeps its exact formatting.

usage: python apply_thumbnails.py <repo_root>
"""
import re
import sys
from pathlib import Path


def main():
    repo = Path(sys.argv[1])
    added = 0
    for path in sorted((repo / "content/publications").glob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        if re.search(r"^thumbnail:", text, re.M):
            continue
        pid = path.stem
        if not (repo / "public/images/publications" / pid / "thumbnail.webp").exists():
            continue
        line = f"thumbnail: /images/publications/{pid}/thumbnail.webp\n"
        text, n = re.subn(r"^(category: .*\n)", lambda m: m.group(1) + line, text, count=1, flags=re.M)
        if n:
            path.write_text(text, encoding="utf-8")
            added += 1
    print(f"added thumbnail to {added} publications")


if __name__ == "__main__":
    main()
