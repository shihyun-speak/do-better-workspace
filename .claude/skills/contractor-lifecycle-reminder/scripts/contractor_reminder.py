#!/usr/bin/env python3
"""Contractor Lifecycle Reminder — reads Google Sheet, outputs Slack-formatted digest."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

SPREADSHEET_ID = "1besywcuvNA8Je93GJrQdJa1im3clma_iRAGZUwRgPgM"

# Webhooks loaded from env vars (do not hardcode secrets)
SLACK_WEBHOOK_DM = os.environ.get("SLACK_WEBHOOK_DM", "")
SLACK_WEBHOOK_CHANNEL = os.environ.get("SLACK_WEBHOOK_CHANNEL", "")
SLACK_WEBHOOK_URL = SLACK_WEBHOOK_CHANNEL or SLACK_WEBHOOK_DM
SLACK_TEAM_URL = "https://usespeak.slack.com/team"

# Manager name -> Slack user ID (for profile links)
SLACK_IDS = {
    # Managers
    "colton gyulay": "U56JF6RMZ",
    "colton": "U56JF6RMZ",
    "connor / colton": "U56JF6RMZ",
    "khunal parkash": "U04TA8X3ZPV",
    "khunal": "U04TA8X3ZPV",
    "charlene xiong": "U025HSRU1SA",
    "charlene (ying) xiong": "U025HSRU1SA",
    "charlen xiong": "U025HSRU1SA",
    "charlene": "U025HSRU1SA",
    "oj": "U08QUHJ9JEA",
    "oj osborne-jones": "U08QUHJ9JEA",
    "alexandra osborne - jones (in her absence pass on to colton)": "U08QUHJ9JEA",
    "alexandra oj (since she is out, you can reach out to colton)": "U08QUHJ9JEA",
    "alexandra osborn-jones": "U08QUHJ9JEA",
    "audrey": "URHQ7HXFB",
    "yan kindyushenko": "U0462LK49CG",
    "yan": "U0462LK49CG",
    "minjeong kim": "U09BCRN3FMH",
    "minjeong": "U09BCRN3FMH",
    "kai hansen": "U0AJUBJ0KRB",
    "katya hadjipetkova": "U07PKRRB1MH",
    "katya": "U07PKRRB1MH",
    "ekaterina hadjipetkova": "U07PKRRB1MH",
    "ekaterina hadjipetkova (katya)": "U07PKRRB1MH",
    "sunjae lee": "U07PHUDU9DK",
    "sunjae": "U07PHUDU9DK",
    # People Ops / submitters — add Slack IDs below as needed
    # "shihyun lee": "",
    # "ginger chen": "",
    # "geunhee lee": "",
    # "serin choi": "",
    # "sean masterman": "",
    # "emily wang": "",
    # "jack cody": "",
    # "leon macalister": "",
    # "mizuki moriyasu": "",
    # "natalia konstantinovskaia": "",
    # "mina choe": "",
    # "naoki tamura": "",
    # "naeun park": "",
    # "jinwoo oh": "",
    # "doohyun chung": "",
    # "yujin kim": "",
    # "zephyrine geneste": "",
    # "virginia anderson": "",
    # "jared forman": "",
    # "alexia marchetti": "",
    # "annie achtien": "",
    # "may nguyen": "",
}

# Contractor name aliases: maps variant -> canonical name (both lowercased).
# Used to deduplicate the same person appearing under different spellings
# across tabs (e.g., legal name on SoT, nickname on Extension form).
NAME_ALIASES = {
    "katya hadjipetkova": "ekaterina hadjipetkova",
    "min oh": "minjin oh",
}

# --- Owner routing -------------------------------------------------------
# People Ops divides contractor coverage by geography:
#   Shihyun = APAC, Hemmi = US + Rest of World.
# Country lookups are substring-based and case-insensitive, so values like
# "South Korea" or "Australia (Sydney)" both match.
APAC_COUNTRIES = (
    "japan", "korea", "south korea", "republic of korea",
    "taiwan", "singapore", "hong kong", "china", "philippines",
    "vietnam", "thailand", "indonesia", "malaysia", "india",
    "australia", "new zealand",
)
SHIHYUN_ID = "U08336ST4HK"  # APAC owner
HEMMI_ID = "U08EJGRKP50"    # US + RoW owner


def owner_for(country: str) -> str:
    """Return 'apac' or 'rowus' (or 'unknown' when country is missing)."""
    c = (country or "").strip().lower()
    if not c:
        return "unknown"
    for apac in APAC_COUNTRIES:
        if apac in c:
            return "apac"
    return "rowus"


def owner_label(owner: str) -> str:
    if owner == "apac":
        return f"_APAC — <@{SHIHYUN_ID}>_"
    if owner == "rowus":
        return f"_US + RoW — <@{HEMMI_ID}>_"
    return f"_Unknown country — <@{SHIHYUN_ID}> / <@{HEMMI_ID}>_"


def canonical_name(name: str) -> str:
    """Return the canonical lowercase name for dedup keys."""
    key = name.strip().lower()
    return NAME_ALIASES.get(key, key)


def fmt_manager(name: str) -> str:
    """Format manager name as @ mention, or plain text if not found."""
    uid = SLACK_IDS.get(name.strip().lower())
    if uid:
        return f"<@{uid}>"
    return name


# --- Google Sheets auth & helpers ---

# Service account key: check env var first, then local file
SA_KEY_PATH = os.environ.get(
    "GOOGLE_SA_KEY_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
                 "10-projects", "13-contractor-lifecycle-reminder", "shihyun-gws-250436643995.json")
)

_access_token_cache = {"token": None, "expires": 0}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _sign_rs256(message: bytes, private_key_pem: str) -> bytes:
    """Sign with RS256 using the cryptography library if available, else fallback to openssl CLI."""
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
        return key.sign(message, padding.PKCS1v15(), hashes.SHA256())
    except BaseException:
        pass
    # Fallback: use openssl CLI
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False) as f:
        f.write(private_key_pem)
        pem_path = f.name
    try:
        proc = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", pem_path],
            input=message, capture_output=True,
        )
        return proc.stdout
    finally:
        os.unlink(pem_path)


def _get_access_token() -> str:
    """Get a Google API access token using service account JWT."""
    now = int(datetime.now().timestamp())
    if _access_token_cache["token"] and now < _access_token_cache["expires"] - 60:
        return _access_token_cache["token"]

    with open(SA_KEY_PATH) as f:
        sa = json.load(f)

    header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/spreadsheets.readonly",
        "aud": sa["token_uri"],
        "iat": now,
        "exp": now + 3600,
    }).encode())

    signing_input = f"{header}.{payload}".encode()
    signature = _b64url(_sign_rs256(signing_input, sa["private_key"]))
    jwt = f"{header}.{payload}.{signature}"

    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt,
    }).encode()
    req = urllib.request.Request(sa["token_uri"], data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    resp = json.loads(urllib.request.urlopen(req).read())

    _access_token_cache["token"] = resp["access_token"]
    _access_token_cache["expires"] = now + resp.get("expires_in", 3600)
    return resp["access_token"]


def read_sheet(range_str: str) -> list[list[str]]:
    """Read from Google Sheets. Uses service account if key exists, falls back to gws CLI."""
    if os.path.exists(SA_KEY_PATH):
        return _read_sheet_api(range_str)
    return _read_sheet_gws(range_str)


def _read_sheet_api(range_str: str) -> list[list[str]]:
    """Read from Google Sheets API directly using service account."""
    token = _get_access_token()
    encoded_range = urllib.parse.quote(range_str)
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{encoded_range}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        resp = json.loads(urllib.request.urlopen(req).read())
        return resp.get("values", [])
    except Exception as e:
        print(f"Error reading {range_str}: {e}", file=sys.stderr)
        return []


def _read_sheet_gws(range_str: str) -> list[list[str]]:
    """Fallback: read from Google Sheets using gws CLI."""
    result = subprocess.run(
        ["gws", "sheets", "+read", "--spreadsheet", SPREADSHEET_ID, "--range", range_str, "--format", "json"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"Error reading {range_str}: {result.stderr}", file=sys.stderr)
        return []
    data = json.loads(result.stdout)
    return data.get("values", [])


# --- Date helpers ---

def parse_date(s: str) -> datetime | None:
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%B %d, %Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None


def working_days_between(start: datetime, end: datetime) -> int:
    if end <= start:
        return 0
    days = 0
    current = start + timedelta(days=1)
    while current <= end:
        if current.weekday() < 5:  # Mon-Fri
            days += 1
        current += timedelta(days=1)
    return days


def working_days_until(target: datetime, today: datetime | None = None) -> int:
    today = today or datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if target.date() <= today.date():
        return 0
    return working_days_between(today, target)


def fmt_date(d: datetime) -> str:
    """Format a date — include year only when it's not the current calendar year,
    so reading 'May 2 (Sat)' isn't ambiguous between this year's and last year's."""
    if d.year == datetime.now().year:
        return d.strftime("%b %-d (%a)")
    return d.strftime("%b %-d, %Y (%a)")


def fmt_wd(n: int) -> str:
    return f"{n} working {'day' if n == 1 else 'days'} left"


def fmt_wd_until_start(n: int) -> str:
    return f"{n} working {'day' if n == 1 else 'days'} until Start Date"


# --- Data loading ---

def load_country_lookup() -> dict:
    """Build name -> country mapping from Form Responses (col D = name, col H = country)."""
    rows = read_sheet("'Form Responses'!D:H")
    if len(rows) < 2:
        return {}
    lookup = {}
    for row in rows[1:]:
        if len(row) < 5:
            continue
        name = canonical_name(row[0])
        country = row[4].strip()
        if name and country:
            lookup[name] = country
    return lookup


def load_sot_contractors() -> list[dict]:
    rows = read_sheet("'[SoT] Contractor Tracker'!A2:H")
    if not rows:
        return []
    headers = rows[0]  # Row 2 is header row
    contractors = []
    for row in rows[1:]:
        if len(row) < 8:
            row.extend([""] * (8 - len(row)))
        entry = dict(zip(headers, row))
        status = entry.get("Status", "").strip().lower()
        if status in ("ended", "voided", "status", ""):
            continue
        contractors.append({
            "name": entry.get("Contractor Name", "").strip(),
            "job_title": entry.get("Job Title", "").strip(),
            "department": entry.get("Department", "").strip(),
            "manager": entry.get("Speak Manager", "").strip(),
            "approver": entry.get("Contractor Invoice Approver", "").strip(),
            "start_date": parse_date(entry.get("Start Date", "")),
            "end_date": parse_date(entry.get("End Date", "")),
            "source": "sot",
        })
    return contractors


# "Closed" statuses per tab — anything NOT in these lists is treated as
# action-needed (catches Pending, Action Required, blanks, and any new
# status someone invents later). Done states vary by tab — Extension uses
# "Active" to mean "extension processed, contractor running", whereas
# Onboarding uses "Active" to mean "currently onboarded employee" (also
# done from People Ops' perspective).
_CLOSED_ONBOARDING = {"active", "ended", "void"}
_CLOSED_EXTENSION = {"active", "void"}
_CLOSED_OFFBOARDING = {"completed", "void", "#ref!"}
_CLOSED_RATE_CHANGE = {"completed", "void"}


def load_onboarding() -> list[dict]:
    rows = read_sheet("Onboarding!A:O")
    if len(rows) < 2:
        return []
    items = []
    for row in rows[1:]:
        if len(row) < 15:
            row.extend([""] * (15 - len(row)))
        status = row[0].strip().lower()
        if status in _CLOSED_ONBOARDING:
            continue
        items.append({
            "name": row[3].strip(),
            "manager": row[2].strip(),
            "start_date": parse_date(row[13]),
            "end_date": parse_date(row[14]),
            "status": row[0].strip(),
            "request_type": "Onboarding",
            "source": "onboarding",
        })
    return items


def load_extension() -> list[dict]:
    """Pending extensions only. Sheet row order = submission order, so when
    the same contractor has multiple rows we keep the last (most recent)."""
    rows = read_sheet("Extension!A:F")
    if len(rows) < 2:
        return []
    by_name: dict[str, dict] = {}
    for row in rows[1:]:
        if len(row) < 5:
            row.extend([""] * (5 - len(row)))
        status = row[0].strip().lower()
        if status in _CLOSED_EXTENSION:
            continue
        name = row[3].strip()
        if not name:
            continue
        by_name[canonical_name(name)] = {
            "name": name,
            "manager": row[2].strip(),
            "new_end_date": parse_date(row[4]),
            "status": row[0].strip(),
            "request_type": "Extension",
            "source": "extension",
        }
    return list(by_name.values())


def load_prior_end_dates() -> dict[str, datetime]:
    """For each contractor with a Pending extension, find the prior contract
    end date — i.e. the date the *current* contract is about to expire on.

    SoT is updated when an Extension request is filed, so SoT's End Date
    reflects the *new* end, not the expiring one. The prior end lives on
    the most recent *Active* (already-processed) Extension row, or — if
    there was no prior extension — on the Onboarding row.
    """
    prior: dict[str, datetime] = {}
    # Onboarding end dates as the baseline (used when no prior extension exists).
    on_rows = read_sheet("Onboarding!A:O")
    for row in on_rows[1:] if len(on_rows) > 1 else []:
        if len(row) < 15:
            row.extend([""] * (15 - len(row)))
        name = row[3].strip()
        if not name:
            continue
        end = parse_date(row[14])
        if end:
            prior[canonical_name(name)] = end
    # Active Extension rows override Onboarding (later sheet rows = more recent;
    # keep the latest by overwriting as we iterate top-to-bottom).
    ext_rows = read_sheet("Extension!A:F")
    for row in ext_rows[1:] if len(ext_rows) > 1 else []:
        if len(row) < 5:
            row.extend([""] * (5 - len(row)))
        status = row[0].strip().lower()
        if status != "active":
            continue
        name = row[3].strip()
        if not name:
            continue
        end = parse_date(row[4])
        if end:
            prior[canonical_name(name)] = end
    return prior


def load_offboarding() -> list[dict]:
    rows = read_sheet("Offboarding!A:H")
    if len(rows) < 2:
        return []
    by_name: dict[str, dict] = {}
    for row in rows[1:]:
        if len(row) < 5:
            row.extend([""] * (5 - len(row)))
        status = row[0].strip().lower()
        if status in _CLOSED_OFFBOARDING:
            continue
        name = row[3].strip()
        if not name:
            continue
        by_name[canonical_name(name)] = {
            "name": name,
            "manager": row[2].strip(),
            "end_date": parse_date(row[4]),
            "status": row[0].strip(),
            "request_type": "Offboarding",
            "source": "offboarding",
        }
    return list(by_name.values())


def load_rate_change() -> list[dict]:
    rows = read_sheet("'Rate Change'!A:I")
    if len(rows) < 2:
        return []
    by_name: dict[str, dict] = {}
    for row in rows[1:]:
        if len(row) < 6:
            row.extend([""] * (6 - len(row)))
        status = row[0].strip().lower()
        if status in _CLOSED_RATE_CHANGE:
            continue
        name = row[3].strip()
        if not name:
            continue
        by_name[canonical_name(name)] = {
            "name": name,
            "manager": row[2].strip(),
            "effective_date": parse_date(row[5]),
            "status": row[0].strip(),
            "request_type": "Rate Change",
            "source": "rate_change",
        }
    return list(by_name.values())


def load_recent_requests(hours: int = 24) -> set[str]:
    rows = read_sheet("'Form Responses'!A:E")
    if len(rows) < 2:
        return set()
    cutoff = datetime.now() - timedelta(hours=hours)
    recent = set()
    for row in rows[1:]:
        if len(row) < 4:
            continue
        ts_str = row[0].strip()
        name = canonical_name(row[3])
        for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%Y-%m-%d %H:%M:%S"):
            try:
                ts = datetime.strptime(ts_str, fmt)
                if ts >= cutoff:
                    recent.add(name)
                break
            except ValueError:
                continue
    return recent


# --- Digest builder ---

def build_digest() -> str:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    recent_names = load_recent_requests(hours=24)
    country_lookup = load_country_lookup()

    # Build a "prior end date" map for Extension entries so urgency anchors
    # on the *expiring* contract, not the new end. SoT can't be used here —
    # SoT is updated as soon as an Extension request comes in, so its End
    # Date already reflects the new (post-extension) date by the time the
    # Pending row exists. The actual prior end lives on the most recent
    # Active Extension row, or — if none — on the Onboarding row.
    prior_end_lookup = load_prior_end_dates()
    sot_contractors = list(load_sot_contractors())
    # Approver lookup: contractor name -> Contractor Invoice Approver from SoT.
    # This is a separate person from the Speak Manager — typically whoever
    # signed off on/submitted the contractor request.
    approver_lookup: dict[str, str] = {
        canonical_name(c["name"]): c.get("approver", "")
        for c in sot_contractors
        if c.get("approver")
    }

    def make_entry(name: str, manager: str) -> dict:
        key = canonical_name(name)
        country = country_lookup.get(key, "")
        return {
            "name": name,
            "manager": manager,
            "approver": approver_lookup.get(key, ""),
            "country": country,
            "owner": owner_for(country),
            "is_new": key in recent_names,
            "priority": None,
            "lines": [],
        }

    def fmt_request(base: str, status: str | None) -> str:
        """Render a request label. `Pending` is the implicit default and gets
        suppressed; non-default statuses (e.g. `Action Required`) are kept
        because they're a real signal from the requester."""
        if not status or status.strip().lower() == "pending":
            return base
        return f"{base} ({status})"

    def date_priority(anchor: datetime | None) -> tuple[str, int | None, str]:
        """Given a key date, return (priority, working_days, flag).
        🔴 if ≤ 5wd or in past; 🟡 otherwise. 🚩 flag if ≤ 5wd."""
        if not anchor:
            return ("yellow", None, "")
        wd = working_days_until(anchor, today)
        flag = " 🚩" if wd <= 5 else ""
        priority = "red" if wd <= 5 else "yellow"
        return (priority, wd, flag)

    entries = []

    # 1. SoT active contractors — surface only when end date is within 10wd.
    # (SoT is huge; we don't want every active contract — only ones approaching
    # their end date, where extend-vs-offboard decision is needed.)
    for c in sot_contractors:
        if not c["end_date"]:
            continue
        if c["end_date"].date() < today.date():
            continue
        wd = working_days_until(c["end_date"], today)
        if wd > 10:
            continue
        entry = make_entry(c["name"], c["manager"])
        flag = " 🚩" if wd <= 5 else ""
        entry["priority"] = "red" if wd <= 5 else "yellow"
        entry["sort_wd"] = wd
        entry["lines"].append(f"Contract ends `{fmt_date(c['end_date'])}` — *{fmt_wd(wd)}*{flag}")
        entries.append(entry)

    # 2. Onboarding — surface every row not in a closed status (loader already
    # filters Active/Ended/Void). These are paperwork to process, regardless
    # of how far out the start date is.
    for o in load_onboarding():
        entry = make_entry(o["name"], o["manager"])
        req_label = fmt_request("Onboarding", o.get("status"))
        start = o.get("start_date")
        priority, wd, flag = date_priority(start)
        entry["priority"] = priority
        entry["sort_wd"] = wd
        if start and wd is not None:
            entry["lines"].append(f"{req_label} — Starts `{fmt_date(start)}` — *{fmt_wd_until_start(wd)}*{flag}")
        elif start:
            entry["lines"].append(f"{req_label} — Starts `{fmt_date(start)}`")
        else:
            entry["lines"].append(f"{req_label} — start date TBD")
        if o.get("end_date") and start:
            entry["lines"].append(f"Contract period: `{fmt_date(start)}` → `{fmt_date(o['end_date'])}`")
        entries.append(entry)

    # 3. Extension — pending rows only (loader filters Active/Void). Urgency
    # is anchored on the PRIOR end date (the contract about to expire), not
    # the new end date — that's the deadline by which the extension must
    # actually be processed. SoT can't be used because it's updated as soon
    # as the request comes in, so its End Date already reflects the new end.
    for e in load_extension():
        key = canonical_name(e["name"])
        entry = make_entry(e["name"], e["manager"])
        req_label = fmt_request("Extension", e.get("status"))
        prior_end = prior_end_lookup.get(key)
        new_end = e.get("new_end_date")
        date_str = ""
        if prior_end and new_end:
            date_str = f" — Current end `{fmt_date(prior_end)}` → new `{fmt_date(new_end)}`"
        elif prior_end:
            date_str = f" — Current end `{fmt_date(prior_end)}`"
        elif new_end:
            date_str = f" — New end date `{fmt_date(new_end)}`"
        anchor = prior_end or new_end
        priority, wd, flag = date_priority(anchor)
        entry["priority"] = priority
        entry["sort_wd"] = wd
        if anchor and wd is not None:
            entry["lines"].append(f"{req_label}{date_str} — *{fmt_wd(wd)}*{flag}")
        else:
            entry["lines"].append(f"{req_label}{date_str}")
        entries.append(entry)

    # 4. Offboarding — pending rows only.
    for o in load_offboarding():
        entry = make_entry(o["name"], o["manager"])
        req_label = fmt_request("Offboarding", o.get("status"))
        end = o.get("end_date")
        priority, wd, flag = date_priority(end)
        entry["priority"] = priority
        entry["sort_wd"] = wd
        if end and wd is not None:
            entry["lines"].append(f"{req_label} — Ends `{fmt_date(end)}` — *{fmt_wd(wd)}*{flag}")
        elif end:
            entry["lines"].append(f"{req_label} — Ends `{fmt_date(end)}`")
        else:
            entry["lines"].append(f"{req_label} — end date TBD")
        entries.append(entry)

    # 5. Rate Change — pending rows only.
    for r in load_rate_change():
        entry = make_entry(r["name"], r["manager"])
        req_label = fmt_request("Rate change", r.get("status"))
        eff = r.get("effective_date")
        priority, wd, flag = date_priority(eff)
        entry["priority"] = priority
        entry["sort_wd"] = wd
        if eff and wd is not None:
            entry["lines"].append(f"{req_label} — Effective `{fmt_date(eff)}` — *{fmt_wd(wd)}*{flag}")
        elif eff:
            entry["lines"].append(f"{req_label} — Effective `{fmt_date(eff)}`")
        else:
            entry["lines"].append(f"{req_label} — effective date TBD")
        entries.append(entry)

    # Deduplicate: keep each contractor in their highest-priority bucket
    priority_rank = {"red": 0, "yellow": 1, "green": 2}
    by_name: dict[str, dict] = {}
    for e in entries:
        key = canonical_name(e["name"])
        if key not in by_name or priority_rank.get(e["priority"], 99) < priority_rank.get(by_name[key]["priority"], 99):
            # Merge is_new flag (keep True if any entry has it)
            if key in by_name and by_name[key]["is_new"]:
                e["is_new"] = True
            by_name[key] = e
        else:
            # Merge lines and is_new into existing higher-priority entry
            by_name[key]["lines"].extend(e["lines"])
            if e["is_new"]:
                by_name[key]["is_new"] = True

    # Within a bucket, sort by working-days-left ascending (most urgent first).
    # Entries without a date sink to the bottom.
    def date_sort_key(e: dict) -> tuple[int, str]:
        wd = e.get("sort_wd")
        return (wd if wd is not None else 10**6, e["name"].strip().lower())

    red = [e for e in by_name.values() if e["priority"] == "red"]
    yellow = [e for e in by_name.values() if e["priority"] == "yellow"]
    # Format message
    lines = []
    date_str = today.strftime("%A, %b %-d")
    lines.append(f"*📋 Contractor Lifecycle Digest — {date_str}*")
    lines.append("")

    if not red and not yellow:
        lines.append("All clear! No items need attention today. ✨")
        return "\n".join(lines)

    def fmt_entry(e):
        new_tag = " (New!)" if e["is_new"] else ""
        country_tag = f" `{e['country']}`" if e.get("country") else ""
        block = []
        block.append(f">*{e['name']}*{new_tag}{country_tag}")
        approver = e.get("approver") or e["manager"]
        block.append(f">Invoice Approver: {fmt_manager(approver)}")
        for line in e["lines"]:
            block.append(f">{line}")
        return "\n".join(block)

    def render_bucket(header: str, items: list[dict]) -> None:
        if not items:
            return
        lines.append(f"*{header}* ({len(items)})")
        lines.append("")
        # Group by owner so APAC entries route to Shihyun, US+RoW to Hemmi.
        # APAC first (smaller, usually), then RoW+US, then unknown country.
        for owner_key in ("apac", "rowus", "unknown"):
            group = sorted(
                (e for e in items if e.get("owner") == owner_key),
                key=date_sort_key,
            )
            if not group:
                continue
            lines.append(owner_label(owner_key))
            lines.append("")
            for e in group:
                lines.append(fmt_entry(e))
                lines.append("")

    render_bucket("🔴 Needs Attention", red)
    render_bucket("🟡 Coming Up", yellow)

    return "\n".join(lines).strip()


def _build_date_lookup() -> dict[str, str]:
    """Build name -> date info string from all tabs."""
    lookup: dict[str, str] = {}
    for c in load_sot_contractors():
        key = canonical_name(c["name"])
        if c["end_date"]:
            lookup[key] = f"Ends `{fmt_date(c['end_date'])}`"
    for o in load_onboarding():
        key = canonical_name(o["name"])
        parts = []
        if o.get("start_date"):
            parts.append(f"Starts `{fmt_date(o['start_date'])}`")
        if o.get("end_date"):
            parts.append(f"Ends `{fmt_date(o['end_date'])}`")
        if parts:
            lookup[key] = " → ".join(parts)
    # Use prior end date (from last Active Extension or Onboarding) for the
    # "Current end" side — SoT is already updated to the new end by the time
    # the Pending row exists, so it can't serve as "current".
    prior_end = load_prior_end_dates()
    for e in load_extension():
        key = canonical_name(e["name"])
        if e.get("new_end_date"):
            original = prior_end.get(key)
            if original:
                lookup[key] = f"Current end date `{fmt_date(original)}` → new end date `{fmt_date(e['new_end_date'])}`"
            else:
                lookup[key] = f"New end date `{fmt_date(e['new_end_date'])}`"
    for o in load_offboarding():
        if o.get("end_date"):
            lookup[canonical_name(o["name"])] = f"Ends `{fmt_date(o['end_date'])}`"
    for r in load_rate_change():
        if r.get("effective_date"):
            lookup[canonical_name(r["name"])] = f"Effective `{fmt_date(r['effective_date'])}`"
    return lookup


def build_new_request_alert(hours: int = 1) -> str | None:
    recent = load_recent_requests(hours=hours)
    if not recent:
        return None

    rows = read_sheet("'Form Responses'!A:E")
    if len(rows) < 2:
        return None

    country_lookup = load_country_lookup()
    date_lookup = _build_date_lookup()
    approver_lookup = {
        canonical_name(c["name"]): c.get("approver", "")
        for c in load_sot_contractors()
        if c.get("approver")
    }

    cutoff = datetime.now() - timedelta(hours=hours)
    alerts = []
    for row in rows[1:]:
        if len(row) < 5:
            continue
        ts_str = row[0].strip()
        ts = None
        for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%Y-%m-%d %H:%M:%S"):
            try:
                ts = datetime.strptime(ts_str, fmt)
                break
            except ValueError:
                continue
        if not ts or ts < cutoff:
            continue
        name = row[3].strip()
        key = canonical_name(name)
        req_type = row[4].strip() if len(row) > 4 else "Unknown"
        manager = row[2].strip()
        country_tag = f" `{country_lookup.get(key, '')}`" if country_lookup.get(key) else ""
        date_info = date_lookup.get(key, "")

        submitter = row[1].strip() if len(row) > 1 else ""

        block = []
        block.append(f">*{name}*{country_tag}")
        approver = approver_lookup.get(key) or manager
        block.append(f">{req_type} — Invoice Approver: {fmt_manager(approver)}")
        if date_info:
            block.append(f">{date_info}")
        if submitter:
            block.append(f">Submitted by {fmt_manager(submitter)}")
        alerts.append("\n".join(block))

    if not alerts:
        return None

    header = "🆕 *New Contractor Request*\n\n" if len(alerts) == 1 else f"🆕 *{len(alerts)} New Contractor Requests*\n\n"
    return header + "\n\n".join(alerts)


# --- Slack sender ---

def send_to_slack(text: str) -> bool:
    payload = json.dumps({
        "text": text,
        "username": "Contractor Bot",
        "icon_emoji": ":clipboard:",
    }).encode("utf-8")
    req = urllib.request.Request(
        SLACK_WEBHOOK_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req)
        return resp.status == 200
    except Exception as e:
        print(f"Slack send failed: {e}", file=sys.stderr)
        return False


# --- CLI ---

def main():
    if len(sys.argv) < 2:
        print("Usage: contractor_reminder.py [digest|new-requests|send-digest|send-new-requests]", file=sys.stderr)
        sys.exit(1)

    mode = sys.argv[1]

    if mode == "digest":
        print(build_digest())
    elif mode == "new-requests":
        msg = build_new_request_alert()
        print(msg if msg else "NO_NEW_REQUESTS")
    elif mode == "send-digest":
        msg = build_digest()
        if send_to_slack(msg):
            print("Digest sent to Slack!")
        else:
            print("Failed to send digest.", file=sys.stderr)
            sys.exit(1)
    elif mode == "send-new-requests":
        hours = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        msg = build_new_request_alert(hours=hours)
        if not msg:
            print("No new requests.")
        elif send_to_slack(msg):
            print("New request alert sent to Slack!")
        else:
            print("Failed to send alert.", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"Unknown mode: {mode}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
