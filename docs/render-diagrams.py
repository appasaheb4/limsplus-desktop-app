#!/usr/bin/env python3
"""
Render all Graphviz .dot files in docs/ to docs/rendered/ (PNG + SVG).

Requires one of:
  - Graphviz installed on PATH (`dot`), used by the `graphviz` Python package, or
  - run: pip install graphviz  (and install Graphviz binaries from https://graphviz.org/download/)

Usage (from repo root):
  python3 docs/render-diagrams.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent
OUT_DIR = DOCS_DIR / "rendered"


def find_dot_executable() -> str | None:
    """Graphviz `dot` must be on PATH (pip package `graphviz` does not include it)."""
    return shutil.which("dot")


def print_install_help() -> None:
    print(
        "\nGraphviz **binaries** are missing (`dot` not found on PATH).\n"
        "The pip package `graphviz` is only a wrapper — it still needs `dot` installed.\n",
        file=sys.stderr,
    )
    if sys.platform == "darwin":
        print("macOS (Homebrew):\n  brew install graphviz\n", file=sys.stderr)
    elif sys.platform.startswith("linux"):
        print(
            "Linux (examples):\n"
            "  sudo apt install graphviz   # Debian/Ubuntu\n"
            "  sudo dnf install graphviz   # Fedora\n",
            file=sys.stderr,
        )
    else:
        print("Download: https://graphviz.org/download/\n", file=sys.stderr)
    print(
        "Then verify:\n  which dot\n  dot -V\n"
        "Re-run:\n  python3 docs/render-diagrams.py\n",
        file=sys.stderr,
    )


def main() -> int:
    dot_path = find_dot_executable()
    if not dot_path:
        print_install_help()
        return 1

    try:
        import graphviz
    except ImportError:
        print(
            "Missing Python package. Install:\n"
            "  pip install graphviz\n"
            f"Graphviz binary found: {dot_path}",
            file=sys.stderr,
        )
        return 1

    print(f"Using Graphviz: {dot_path}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dot_files = sorted(DOCS_DIR.glob("*.dot"))
    if not dot_files:
        print("No .dot files found in docs/", file=sys.stderr)
        return 1

    for dot_path in dot_files:
        stem = dot_path.stem
        print(f"Rendering {stem} ...")
        src = graphviz.Source(dot_path.read_text(encoding="utf-8"), filename=stem)
        # render() writes to OUT_DIR/<stem>.<format> when directory= is set
        src.render(
            filename=stem,
            directory=str(OUT_DIR),
            format="png",
            cleanup=True,
        )
        src.render(
            filename=stem,
            directory=str(OUT_DIR),
            format="svg",
            cleanup=True,
        )

    print(f"Done → {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
