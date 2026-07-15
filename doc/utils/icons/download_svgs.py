
#!/usr/bin/env python3

# download_svgs.py
# Usage:
# 1) Fill manifest_full.csv -> add direct SVG download URLs in the 'url' column OR
# 2) Provide a plain urls.txt (one direct SVG URL per line) and run:
#       python3 download_svgs.py --urls urls.txt
#
# The script will download SVG files into svg_sources/ and optionally normalize filenames.
#
# NOTE: This script attempts a basic search on svgrepo.com and freesvg.org if the 'url' column is empty.
#       Web scraping may break if site layout changes. Use direct SVG URLs for reliability.

import os, csv, argparse, re, sys, time
from urllib.parse import urlparse, quote_plus
import requests
from bs4 import BeautifulSoup

OUTDIR = "svg_sources"

def sanitize_filename(s):
    # simple sanitize
    return re.sub(r'[^A-Za-z0-9._-]', '_', s)

def download_url(url, dest_folder, name_hint=None, session=None):
    if session is None:
        session = requests.Session()
    try:
        r = session.get(url, timeout=30, stream=True)
        r.raise_for_status()
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return None
    # try to determine filename
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path)
    if not filename or '.' not in filename:
        # fallback
        filename = (name_hint or "icon") + ".svg"
    filename = sanitize_filename(filename)
    dest_path = os.path.join(dest_folder, filename)
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    return dest_path

def search_svgrepo(query, session=None):
    # Very basic search on svgrepo.com - attempts to return first SVG download link
    if session is None:
        session = requests.Session()
    q = quote_plus(query)
    search_url = f"https://www.svgrepo.com/search/{q}/"
    try:
        r = session.get(search_url, timeout=20)
        r.raise_for_status()
    except Exception as e:
        print("svgrepo search failed:", e)
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    # look for first .svg download link or href to icon page then derive download
    # svgrepo's icon links often look like /svg/ID/name
    a = soup.select_one("a.icon-link")
    if a and a.get("href"):
        href = a["href"]
        # construct download URL pattern: /download/ID/name.svg or /svg/ID/name
        # Try to access href directly
        full = "https://www.svgrepo.com" + href
        # visit icon page
        try:
            r2 = session.get(full, timeout=15)
            r2.raise_for_status()
            s2 = BeautifulSoup(r2.text, "html.parser")
            dl = s2.select_one("a#download-btn")
            if dl and dl.get("href"):
                dl_url = dl["href"]
                if dl_url.startswith("/"):
                    dl_url = "https://www.svgrepo.com" + dl_url
                return dl_url
        except Exception as e:
            return None
    return None

def search_freesvg(query, session=None):
    # Basic freesvg.org search (may return images in various formats)
    if session is None:
        session = requests.Session()
    base = "https://freesvg.org"
    search_url = f"{base}/search?q={quote_plus(query)}"
    try:
        r = session.get(search_url, timeout=20)
        r.raise_for_status()
    except Exception as e:
        print("freesvg search failed:", e)
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    # find first result link
    a = soup.select_one("div.result a")
    if a and a.get("href"):
        page = base + a["href"]
        try:
            r2 = session.get(page, timeout=15)
            r2.raise_for_status()
            s2 = BeautifulSoup(r2.text, "html.parser")
            img = s2.select_one("img[src$='.svg']")
            if img:
                src = img["src"]
                if src.startswith("/"):
                    src = base + src
                return src
        except Exception as e:
            return None
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="manifest_full.csv", help="CSV manifest with columns index,name,url,...")
    parser.add_argument("--urls", default=None, help="Plain text file with one SVG URL per line")
    parser.add_argument("--out", default=OUTDIR, help="Output folder for SVGs")
    parser.add_argument("--try-search", action="store_true", help="Try searching svgrepo/freesvg for empty URLs")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    session = requests.Session()
    downloaded = 0

    if args.urls:
        with open(args.urls, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
        for url in lines:
            print("Downloading:", url)
            p = download_url(url, args.out, name_hint=os.path.basename(url), session=session)
            if p:
                print("Saved to", p)
                downloaded += 1
        print("Done. Downloaded", downloaded, "files.")
        return

    # otherwise read manifest CSV
    with open(args.manifest, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        rows = list(reader)

    for row in rows:
        name = row.get("name") or "icon"
        url = row.get("url") or ""
        license = row.get("license") or ""
        if url:
            print(f"Downloading {name} from manifest URL...")
            p = download_url(url, args.out, name_hint=name, session=session)
            if p:
                print("Saved:", p)
                downloaded += 1
            else:
                print("Failed to download from provided URL for", name)
        else:
            if args.try_search:
                print(f"No URL for '{name}', trying svgrepo search...")
                dl = search_svgrepo(name, session=session)
                if not dl:
                    print("svgrepo didn't find it, trying freesvg...")
                    dl = search_freesvg(name, session=session)
                if dl:
                    print("Found download link:", dl)
                    p = download_url(dl, args.out, name_hint=name, session=session)
                    if p:
                        print("Saved:", p)
                        downloaded += 1
                    else:
                        print("Failed to download from discovered link for", name)
                else:
                    print("No candidate found for", name)
            else:
                print("No URL for", name, "- skipping (use --try-search to attempt auto-search)")

    print("Finished. Total downloaded:", downloaded)

if __name__ == '__main__':
    main()
