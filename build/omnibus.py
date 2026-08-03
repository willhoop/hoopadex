#!/usr/bin/env python3
"""HoopaDex — render a Markdown report to PDF.

Run: python build/omnibus.py docs/ARCHITECTURE-REVIEW-2026-08-03.md

Writes <name>.pdf beside the source.

Two renderers, tried in order:

  1. WeasyPrint, which is the intended one.
  2. Headless Chrome or Edge via --print-to-pdf.

The fallback exists because WeasyPrint is a Python package with C library dependencies (Pango,
cairo, GObject) that pip does not install. On the machine this was written on, `pip list` shows
weasyprint 69.0 and `import weasyprint` still fails with "could not import some external
libraries". A build step that only works where someone happened to install GTK is not a build step,
and "the PDF was skipped" is not an acceptable outcome for a report that has to be read.

Edge ships with Windows, so the fallback needs no installation.
"""
import os
import re
import subprocess
import sys
import time
import shutil
import tempfile

CSS = """
@page { size: A4; margin: 18mm 16mm; @bottom-center { content: counter(page); font-size: 9pt; color: #888; } }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; }
h1 { font-size: 21pt; border-bottom: 2.5px solid #b23; padding-bottom: 6px; margin: 0 0 4px; }
h2 { font-size: 15pt; margin: 26px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; page-break-after: avoid; }
h3 { font-size: 12pt; margin: 20px 0 6px; color: #b23; page-break-after: avoid; }
h2, h3 { page-break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 8.8pt; page-break-inside: avoid; }
th { background: #f2f2f4; text-align: left; font-weight: 600; }
th, td { border: 1px solid #ccc; padding: 5px 7px; vertical-align: top; }
code { font-family: "Cascadia Mono", Consolas, monospace; font-size: 8.8pt; background: #f4f4f6; padding: 1px 4px; border-radius: 3px; }
pre { background: #f7f7f9; border: 1px solid #e0e0e4; border-left: 3px solid #b23; padding: 9px 11px;
      font-family: "Cascadia Mono", Consolas, monospace; font-size: 8.5pt; line-height: 1.4;
      white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: inherit; }
blockquote { border-left: 3px solid #ccc; margin: 10px 0; padding: 2px 14px; color: #444; }
hr { border: none; border-top: 1px solid #ddd; margin: 22px 0; }
strong { font-weight: 650; }
a { color: #16c; text-decoration: none; word-break: break-all; }
"""


def to_html(md_text, title):
    import markdown
    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "sane_lists"])
    return (f'<!DOCTYPE html><html><head><meta charset="utf-8">'
            f"<title>{title}</title><style>{CSS}</style></head><body>{body}</body></html>")


def via_weasyprint(html, out, base):
    from weasyprint import HTML
    HTML(string=html, base_url=base).write_pdf(out)
    return "weasyprint"


def find_browser():
    names = ["chrome", "msedge", "chromium", "google-chrome"]
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    for p in [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]:
        if os.path.exists(p):
            return p
    return None


def via_browser(html, out):
    exe = find_browser()
    if not exe:
        raise RuntimeError("no Chrome or Edge found for the PDF fallback")
    tmp = tempfile.mkdtemp(prefix="hoopadex-pdf-")
    src = os.path.join(tmp, "report.html")
    with open(src, "w", encoding="utf-8") as f:
        f.write(html)
    # A fresh --user-data-dir keeps this from colliding with the user's running browser.
    cmd = [exe, "--headless", "--disable-gpu", "--no-pdf-header-footer",
           f"--user-data-dir={os.path.join(tmp, 'profile')}",
           f"--print-to-pdf={os.path.abspath(out)}", "file:///" + src.replace("\\", "/")]
    # Headless Chrome/Edge occasionally exits before the PDF lands, and a leftover instance from a
    # previous run can make the first attempt produce nothing at all. Observed once while building
    # the engineering review: the same command failed, then succeeded unchanged. A build step that
    # works on the second try is a build step that will fail in CI, so retry deliberately rather
    # than leaving it to luck.
    last = ""
    for attempt in range(3):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if os.path.exists(out) and os.path.getsize(out) > 0:
            return os.path.basename(exe) + ("" if attempt == 0 else f", attempt {attempt + 1}")
        last = r.stderr[-500:]
        time.sleep(1.5)
    raise RuntimeError(f"{os.path.basename(exe)} produced no PDF after 3 attempts\n{last}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    src = sys.argv[1]
    md = open(src, encoding="utf-8").read()
    m = re.search(r"^#\s+(.+)$", md, re.M)
    title = m.group(1).strip() if m else os.path.basename(src)
    out = os.path.splitext(src)[0] + ".pdf"
    html = to_html(md, title)

    errors = []
    for fn in (lambda: via_weasyprint(html, out, os.path.dirname(os.path.abspath(src))),
               lambda: via_browser(html, out)):
        try:
            how = fn()
            print(f"wrote {out}  ({os.path.getsize(out):,} bytes, via {how})")
            return 0
        except Exception as e:  # noqa: BLE001 - report every renderer that failed, then fail loudly
            errors.append(f"  {type(e).__name__}: {str(e)[:200]}")
    print("PDF generation failed. Renderers tried:\n" + "\n".join(errors), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
