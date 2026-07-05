#!/usr/bin/env python3
"""
Regenerate book-club.html from the LFC Book Club spreadsheet + Google Calendar.

Pulls the current book list (date/host/book/pages/audio) from the sheet and the
matching calendar events (Google Meet link, per-meeting Gemini notes, recordings),
downloads any missing cover art from Open Library, and splices a fresh `books`
array into book-club.html between the BOOKS:START / BOOKS:END markers.

Hand-written blurbs live in book-club-blurbs.json and are preserved across rebuilds.
Everything else on the page (state logic, countdown, modal) is static and needs no
rebuild -- read/upcoming state is computed client-side from each meeting's date.

Idempotent: only commits + pushes when the generated output actually changes.

Usage:
  python3 scripts/build-book-club.py            # rebuild, commit + push if changed
  python3 scripts/build-book-club.py --no-push  # rebuild + commit locally only
  python3 scripts/build-book-club.py --dry-run  # print the books array, touch nothing
"""

import json, os, re, subprocess, sys, urllib.parse, urllib.request, datetime

REPO       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML       = os.path.join(REPO, "book-club.html")
BLURBS     = os.path.join(REPO, "book-club-blurbs.json")
COVER_DIR  = os.path.join(REPO, "assets", "book-club")
SHEET_ID   = "13iZMwy-we1t41gN2m_cMhUBmJ-WkBqDK0cI94JeZhi4"
CLUB_NOTES = "https://docs.google.com/document/d/14lTROyrqvLNncxvcAzBgTAJRnz4d5e2ypDHxpvz2Pak/edit"
CAL_QUERY  = "book club"

GWS        = "/opt/homebrew/bin/gws"
GWS_ENV    = dict(os.environ, GOOGLE_WORKSPACE_CLI_CONFIG_DIR=os.path.expanduser("~/.config/gws-personal"))

DRY  = "--dry-run" in sys.argv
PUSH = "--no-push" not in sys.argv and not DRY

MONTHS = {1:"January",2:"February",3:"March",4:"April",5:"May",6:"June",
          7:"July",8:"August",9:"September",10:"October",11:"November",12:"December"}


def log(*a): print("[book-club]", *a, file=sys.stderr)


def gws(args):
    """Run the personal gws CLI and return parsed JSON (tolerates a keyring banner line)."""
    out = subprocess.run([GWS, *args], env=GWS_ENV, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"gws {args[:2]} failed: {out.stderr.strip() or out.stdout.strip()}")
    txt = out.stdout
    i = txt.find("{")
    if i < 0:
        raise RuntimeError(f"gws {args[:2]} returned no JSON: {txt[:200]}")
    return json.loads(txt[i:])


def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower().replace("'", "").replace("’", "")).strip("-")


def blurb_key(title):
    return re.sub(r"[^a-z0-9]", "", title.lower().replace("'", "").replace("’", ""))


def audio_to_hours(s):
    if not s: return 0.0
    h = re.search(r"(\d+)\s*hour", s)
    m = re.search(r"(\d+)\s*min", s)
    return round((int(h.group(1)) if h else 0) + (int(m.group(1)) if m else 0) / 60, 2)


def audio_short(s):
    """'9 hours and 35 minutes' -> '9h 35m'."""
    if not s: return None
    h = re.search(r"(\d+)\s*hour", s)
    m = re.search(r"(\d+)\s*min", s)
    parts = []
    if h: parts.append(f"{h.group(1)}h")
    if m: parts.append(f"{m.group(1)}m")
    return " ".join(parts) or None


def pages_int(s):
    if not s: return None
    m = re.search(r"(\d+)", str(s))
    return int(m.group(1)) if m else None


def parse_sheet_date(s):
    # "Sunday, March 1, 2026"
    return datetime.datetime.strptime(s.split(", ", 1)[1], "%B %d, %Y").date()


def openlibrary_cover(title, author):
    """Return raw JPEG bytes for the best cover match, or None."""
    q = urllib.parse.urlencode({"title": title, "author": author, "limit": 3,
                                "fields": "cover_i"})
    try:
        with urllib.request.urlopen(f"https://openlibrary.org/search.json?{q}", timeout=20) as r:
            docs = json.load(r).get("docs", [])
        cid = next((d["cover_i"] for d in docs if d.get("cover_i")), None)
        if not cid: return None
        with urllib.request.urlopen(f"https://covers.openlibrary.org/b/id/{cid}-L.jpg", timeout=20) as r:
            data = r.read()
        return data if len(data) > 3000 else None   # guard against 1x1 "no cover" pixels
    except Exception as e:
        log("cover fetch failed for", title, "-", e)
        return None


def js(v):
    if v is None: return "null"
    if isinstance(v, (int, float)): return repr(v)
    return json.dumps(str(v), ensure_ascii=False)


def main():
    blurbs = json.load(open(BLURBS)) if os.path.exists(BLURBS) else {}

    # --- sheet ---
    sheet = gws(["sheets", "spreadsheets", "values", "get",
                 "--params", json.dumps({"spreadsheetId": SHEET_ID, "range": "A1:E60"})])
    rows = sheet.get("values", [])[1:]  # drop header

    # --- calendar: map date -> {meet, gemini, recording} ---
    cal = gws(["calendar", "events", "list", "--params", json.dumps({
        "calendarId": "primary", "timeMin": "2026-01-01T00:00:00Z",
        "timeMax": "2027-01-15T00:00:00Z", "maxResults": 250,
        "singleEvents": True, "orderBy": "startTime", "q": CAL_QUERY})])
    by_date = {}
    for ev in cal.get("items", []):
        start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
        if not start: continue
        d = start[:10]
        info = {"meet": ev.get("hangoutLink"), "when": start, "gemini": None, "recording": None}
        for att in ev.get("attachments", []):
            title = att.get("title", "")
            url = att.get("fileUrl", "")
            if title == "Notes by Gemini":
                info["gemini"] = url
            elif "Recording" in title:
                info["recording"] = url
        by_date[d] = info

    os.makedirs(COVER_DIR, exist_ok=True)
    books = []
    for row in rows:
        row = (row + [""] * 5)[:5]
        date_s, host, title, pages_s, audio_s = row
        if not date_s.strip():
            continue
        d = parse_sheet_date(date_s)
        iso = d.isoformat()
        cal_info = by_date.get(iso, {})
        title = title.strip()

        book = {
            "month": MONTHS[d.month],
            "when": cal_info.get("when") or f"{iso}T19:00:00-06:00",
            "host": host.strip(),
            "title": title or None,
            "author": None,
            "pages": pages_int(pages_s),
            "audio": audio_short(audio_s),
            "audioH": audio_to_hours(audio_s),
            "cover": None,
            "blurb": None,
            "gemini": cal_info.get("gemini"),
            "recording": cal_info.get("recording"),
        }

        if title:
            entry = blurbs.get(blurb_key(title), {})
            book["author"] = entry.get("author")
            book["blurb"] = entry.get("blurb") or f"{host.strip()}'s pick for {MONTHS[d.month]}."
            slug = slugify(title)
            cover_file = os.path.join(COVER_DIR, f"{slug}.jpg")
            if not os.path.exists(cover_file):
                log("fetching cover for", title)
                data = openlibrary_cover(title, entry.get("author") or "")
                if data:
                    open(cover_file, "wb").write(data)
            if os.path.exists(cover_file):
                book["cover"] = f"assets/book-club/{slug}.jpg"
        else:
            # No book chosen yet -- ignore any placeholder GEMINI() values in the sheet.
            book["pages"] = book["audio"] = None
            book["audioH"] = 0.0
            book["blurb"] = f"{host.strip()}'s pick — still to be announced. Check back once the choice is in."

        books.append(book)

    # --- emit JS array ---
    keys = ["month", "when", "host", "title", "author", "pages", "audio", "audioH", "cover", "blurb", "gemini", "recording"]
    lines = ["const books = ["]
    for b in books:
        opt = "".join(f", {k}:{js(b[k])}" for k in ("gemini", "recording") if b.get(k))
        lines.append(
            f'  {{ month:{js(b["month"])}, when:{js(b["when"])}, host:{js(b["host"])}, '
            f'title:{js(b["title"])}, author:{js(b["author"])},\n'
            f'    pages:{js(b["pages"])}, audio:{js(b["audio"])}, audioH:{js(b["audioH"])}, cover:{js(b["cover"])},\n'
            f'    blurb:{js(b["blurb"])}{opt} }},')
    lines.append("];")
    block = "\n".join(lines)

    if DRY:
        print(block)
        return

    # --- splice into HTML ---
    html = open(HTML).read()
    new_html = re.sub(r"const books = \[.*?\n\];",
                      block.replace("\\", "\\\\"), html, count=1, flags=re.DOTALL)
    if new_html == html:
        # markers/content identical
        if "const books = [" not in html:
            raise RuntimeError("could not find books array in book-club.html")
    open(HTML, "w").write(new_html)

    # --- commit + push only on change ---
    status = subprocess.run(["git", "-C", REPO, "status", "--porcelain",
                             "book-club.html", "assets/book-club"],
                            capture_output=True, text=True).stdout.strip()
    if not status:
        log("no changes; nothing to commit")
        return
    log("changes detected:\n" + status)
    subprocess.run(["git", "-C", REPO, "add", "book-club.html", "assets/book-club"], check=True)
    subprocess.run(["git", "-C", REPO, "commit", "-q", "-m",
                    "Book club: auto-refresh from sheet + calendar"], check=True)
    if PUSH:
        subprocess.run(["git", "-C", REPO, "push", "-q", "origin", "main"], check=True)
        log("pushed")
    else:
        log("committed (push skipped)")


if __name__ == "__main__":
    main()
