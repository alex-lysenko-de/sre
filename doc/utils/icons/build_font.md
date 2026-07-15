
# Build instructions — BraceletSymbols

This package contains:
- `manifest_full.csv` — a CSV with 162 icon names. Fill the `url` column with direct SVG download URLs OR use the `download_svgs.py` script to auto-search.
- `download_svgs.py` — Python script to download SVGs listed in `manifest_full.csv` or a plain `urls.txt`.
- `build_font.pe` — FontForge script to generate a TTF/WOFF font from SVG files in a folder.
- `urls_example.txt` — example format for a URLs file.

## 1) Install dependencies (on macOS / Linux)
- Python 3.10+
- pip install:
    pip install requests beautifulsoup4

- FontForge:
    - macOS: `brew install fontforge`
    - Ubuntu/Debian: `sudo apt-get install fontforge`
    - Windows: install FontForge from https://fontforge.org

## 2) Download SVGs
Option A — If you have a `urls.txt`:
    python3 download_svgs.py --urls urls.txt

Option B — Using the manifest (tries to download URLs from the 'url' column):
    python3 download_svgs.py --manifest manifest_full.csv

Option C — Try auto-search (experimental; may break if site layout changes):
    python3 download_svgs.py --manifest manifest_full.csv --try-search

Downloaded SVGs will be saved in `svg_sources/`.

## 3) Clean / inspect SVGs
- Open `svg_sources/` and ensure each SVG is a clean monochrome silhouette.
- Optionally use SVGO (npm) to optimize:
    npm install -g svgo
    svgo -f svg_sources -o svg_sources_opt

## 4) Generate font (using FontForge)
Example:
    fontforge -script build_font.pe svg_sources BraceletSymbols.ttf

This will create `BraceletSymbols.ttf` and a `.woff` in the same folder.

## 5) Test and use
- Use the generated TTF in your design software or convert to web fonts.
- I recommend preparing a `demo.html` to map glyph codepoints. The FontForge script assigns icons starting from U+E001 in sorted filename order.

## Notes and licensing
- Ensure each SVG you download is allowed for commercial use without attribution, or keep track of attribution requirements in `manifest_full.csv`.
- Official brand logos (Mercedes, Audi, Porsche) are trademarks and should not be used without permission. Use generic "automotive-inspired" emblems instead.
