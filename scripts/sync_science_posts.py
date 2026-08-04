#!/usr/bin/env python3
"""
Pull Science posts from renrua52/domain into src/content/blog/.

Source: https://github.com/renrua52/domain  →  source/_posts/*.md
Filter: frontmatter categories contains "Science"
Rewrite frontmatter for Astro content collections (title / description / pubDate).

Usage:
    python3 scripts/sync_science_posts.py
    DOMAIN_REPO=/path/to/domain python3 scripts/sync_science_posts.py
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src" / "content" / "blog"
REPO_URL = os.environ.get("DOMAIN_REPO_URL", "https://github.com/renrua52/domain.git")
LOCAL_REPO = os.environ.get("DOMAIN_REPO")  # optional local checkout
POSTS_SUBDIR = Path("source") / "_posts"
FM_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?", re.S)


def has_science(fm: str) -> bool:
    if re.search(r"^categories:\s*Science\s*$", fm, re.M):
        return True
    block = re.search(r"^categories:\s*\n((?:[ \t]*-[ \t]*.+\n?)+)", fm, re.M)
    if not block:
        return False
    cats = [c.strip() for c in re.findall(r"-[ \t]*(.+)", block.group(1))]
    return "Science" in cats


def parse_date(fm: str) -> str:
    m = re.search(r"^date:\s*(.+?)\s*$", fm, re.M)
    if not m:
        raise ValueError("missing date")
    raw = m.group(1).strip().strip("'\"")
    # accept YYYY-M-D or YYYY-MM-DD[ HH:MM:SS]
    parts = raw.split()
    day = parts[0]
    y, mo, d = day.split("-")
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"


def parse_title(fm: str, fallback: str) -> str:
    m = re.search(r"^title:\s*(.+?)\s*$", fm, re.M)
    if not m:
        return fallback
    return m.group(1).strip().strip("'\"")


def excerpt(body: str, limit: int = 160) -> str:
    text = body
    text = re.sub(r"\$\$.*?\$\$", " ", text, flags=re.S)
    text = re.sub(r"\$[^$\n]+\$", " ", text)
    text = re.sub(r"`[^`]+`", " ", text)
    text = re.sub(r"!\[.*?\]\(.*?\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[#>*_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return (cut or text[: limit - 1]) + "…"


def yaml_quote(s: str) -> str:
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def normalize_math(body: str) -> str:
    """Normalize display-math fences for remark-math + MathJax (SVG).

    Domain renders with pandoc --mathjax + hexo-filter-mathjax. We keep the
    original TeX (including align environments — MathJax handles them) but
    put $$ fences on their own lines so micromark reliably detects display
    math; otherwise a broken fence swallows the rest of the file and
    underscores become <em>.
    """

    def split_fence(match: re.Match[str]) -> str:
        inner = match.group(1).strip("\n")
        return f"\n$$\n{inner}\n$$\n"

    body = re.sub(r"\$\$\s*\n?(.*?)\n?\s*\$\$", split_fence, body, flags=re.S)
    return body


def convert(src: Path) -> str:
    raw = src.read_text(encoding="utf-8")
    m = FM_RE.match(raw)
    if not m:
        raise ValueError(f"{src.name}: no frontmatter")
    fm, body = m.group(1), raw[m.end() :]
    if not has_science(fm):
        raise ValueError(f"{src.name}: not Science")
    title = parse_title(fm, src.stem)
    pub = parse_date(fm)
    body = normalize_math(body)
    desc = excerpt(body)
    header = "\n".join(
        [
            "---",
            f"title: {yaml_quote(title)}",
            f"description: {yaml_quote(desc)}",
            f"pubDate: {pub}",
            "tags:",
            '  - "Science"',
            "draft: false",
            "---",
            "",
        ]
    )
    return header + body.lstrip("\n")


def fetch_posts_dir() -> tuple[Path, Path | None]:
    """Return (posts_dir, cleanup_root_or_None)."""
    if LOCAL_REPO:
        posts = Path(LOCAL_REPO) / POSTS_SUBDIR
        if not posts.is_dir():
            raise SystemExit(f"DOMAIN_REPO has no {POSTS_SUBDIR}: {posts}")
        return posts, None

    tmp = Path(tempfile.mkdtemp(prefix="domain-posts-"))
    # shallow sparse clone — only source/_posts
    subprocess.run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--filter=blob:none",
            "--sparse",
            REPO_URL,
            str(tmp / "domain"),
        ],
        check=True,
        capture_output=True,
    )
    repo = tmp / "domain"
    subprocess.run(
        ["git", "-C", str(repo), "sparse-checkout", "set", str(POSTS_SUBDIR)],
        check=True,
        capture_output=True,
    )
    return repo / POSTS_SUBDIR, tmp


def main() -> None:
    posts_dir, cleanup = fetch_posts_dir()
    try:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        # wipe previously synced posts (keep .gitkeep)
        for old in OUT_DIR.glob("*.md"):
            old.unlink()

        written = 0
        for src in sorted(posts_dir.glob("*.md")):
            text = src.read_text(encoding="utf-8")
            m = FM_RE.match(text)
            if not m or not has_science(m.group(1)):
                continue
            out = OUT_DIR / src.name
            out.write_text(convert(src), encoding="utf-8")
            written += 1
            print(f"[sync] {src.name} -> {out.relative_to(ROOT)}")

        (OUT_DIR / ".gitkeep").touch()
        print(f"[sync] wrote {written} Science post(s) to {OUT_DIR.relative_to(ROOT)}")
        if written == 0:
            raise SystemExit("no Science posts found — check filter / repo path")
    finally:
        if cleanup and cleanup.exists():
            shutil.rmtree(cleanup, ignore_errors=True)


if __name__ == "__main__":
    main()
