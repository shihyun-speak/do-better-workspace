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
SLACK_WEBHOOK_DM = "https://hooks.slack.com/services/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"
SLACK_WEBHOOK_CHANNEL = "https://hooks.slack.com/services/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"
SLACK_WEBHOOK_URL = SLACK_WEBHOOK_CHANNEL  # default to channel
SLACK_TEAM_URL = "https://usespeak.slack.com/team"

# Manager name -> Slack user ID (for profile links)
MANAGER_SLACK_IDS = {
    "colton gyulay": "U56JF6RMZ",
    "colton": "U56JF6RMZ",
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
    "audrey": "URHQ7HXFB",
    "yan kindyushenko": "U0462LK49CG",
    "yan": "U0462LK49CG",
    "minjeong kim": "U09BCRN3FMH",
    "minjeong": "U09BCRN3FMH",
    "kai hansen": "U0AJUBJ0KRB",
    "katya hadjipetkova": "U07PKRRB1MH",
    "katya": "U07PKRRB1MH",
    "sunjae lee": "U07PHUDU9DK",
    "sunjae": "U07PHUDU9DK",
    "connor / colton": "U56JF6RMZ",
}


def fmt_manager(name: str) -> str:
    """Format manager name as @ mention, or plain text if not found."""
    uid = MANAGER_SLACK_IDS.get(name.strip().lower())
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
    except ImportError:
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
    return d.strftime("%b %-d (%a)")


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
        name = row[0].strip().lower()
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
            "start_date": parse_date(entry.get("Start Date", "")),
            "end_date": parse_date(entry.get("End Date", "")),
            "source": "sot",
        })
    return contractors


def load_onboarding() -> list[dict]:
    rows = read_sheet("Onboarding!A:O")
    if len(rows) < 2:
        return []
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    items = []
    for row in rows[1:]:
        if len(row) < 15:
            row.extend([""] * (15 - len(row)))
        status = row[0].strip().lower()
        if status in ("ended", "void", ""):
            continue
        start = parse_date(row[13])
        end = parse_date(row[14])
        # Only include if start date is today or in the future
        if not start or start.date() < today.date():
            continue
        items.append({
            "name": row[3].strip(),
            "manager": row[2].strip(),
            "start_date": start,
            "end_date": end,
            "request_type": "Onboarding",
            "source": "onboarding",
        })
    return items


def load_extension() -> list[dict]:
    rows = read_sheet("Extension!A:F")
    if len(rows) < 2:
        return []
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    items = []
    for row in rows[1:]:
        if len(row) < 5:
            row.extend([""] * (5 - len(row)))
        status = row[0].strip().lower()
        if status in ("ended", "void", ""):
            continue
        new_end = parse_date(row[4])
        if not new_end or new_end.date() < today.date():
            continue
        items.append({
            "name": row[3].strip(),
            "manager": row[2].strip(),
            "new_end_date": new_end,
            "request_type": "Extension",
            "source": "extension",
        })
    return items


def load_offboarding() -> list[dict]:
    rows = read_sheet("Offboarding!A:H")
    if len(rows) < 2:
        return []
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    items = []
    for row in rows[1:]:
        if len(row) < 5:
            row.extend([""] * (5 - len(row)))
        status = row[0].strip().lower()
        if status in ("ended", "void", "completed", ""):
            continue
        end = parse_date(row[4])
        if not end or end.date() < today.date():
            continue
        items.append({
            "name": row[3].strip(),
            "manager": row[2].strip(),
            "end_date": end,
            "request_type": "Offboarding",
            "source": "offboarding",
        })
    return items


def load_rate_change() -> list[dict]:
    rows = read_sheet("'Rate Change'!A:I")
    if len(rows) < 2:
        return []
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    items = []
    for row in rows[1:]:
        if len(row) < 6:
            row.extend([""] * (6 - len(row)))
        status = row[0].strip().lower()
        if status in ("ended", "void", "completed", ""):
            continue
        eff = parse_date(row[5])
        if not eff or eff.date() < today.date():
            continue
        items.append({
            "name": row[3].strip(),
            "manager": row[2].strip(),
            "effective_date": eff,
            "request_type": "Rate Change",
            "source": "rate_change",
        })
    return items


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
        name = row[3].strip().lower()
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

    # Collect all items into a unified list
    entries = []

    # 1. SoT active contractors — check end dates
    for c in load_sot_contractors():
        if not c["end_date"]:
            continue
        # Skip if end date is already past
        if c["end_date"].date() < today.date():
            continue
        wd = working_days_until(c["end_date"], today)
        entry = {
            "name": c["name"],
            "manager": c["manager"],
            "country": country_lookup.get(c["name"].strip().lower(), ""),
            "is_new": c["name"].strip().lower() in recent_names,
            "priority": None,
            "lines": [],
        }
        if wd <= 7:
            entry["priority"] = "red"
            entry["lines"].append(f"End date approaching — `{fmt_date(c['end_date'])}` · *{wd} working days left*")
        elif wd <= 14:
            entry["priority"] = "yellow"
            entry["lines"].append(f"End date — `{fmt_date(c['end_date'])}` · *{wd} working days left*")
        if entry["priority"]:
            entries.append(entry)

    # 2. Onboarding — check start date proximity + late flag
    for o in load_onboarding():
        if not o["start_date"]:
            continue
        wd_start = working_days_until(o["start_date"], today)
        entry = {
            "name": o["name"],
            "manager": o["manager"],
            "country": country_lookup.get(o["name"].strip().lower(), ""),
            "is_new": o["name"].strip().lower() in recent_names,
            "priority": None,
            "lines": [],
        }
        # Late request: check if request was submitted with < 7 working days lead time
        is_late = o["name"].strip().lower() in recent_names and wd_start < 7
        if wd_start <= 7:
            if is_late:
                entry["priority"] = "red"
                entry["lines"].append(f"Onboarding / Starts `{fmt_date(o['start_date'])}` · ⚠️ *{wd_start} working days — late request*")
            else:
                entry["priority"] = "red" if wd_start <= 3 else "yellow"
                entry["lines"].append(f"Onboarding / Starts `{fmt_date(o['start_date'])}` · *{wd_start} working days left*")
        elif wd_start <= 14:
            entry["priority"] = "yellow"
            entry["lines"].append(f"Onboarding / Starts `{fmt_date(o['start_date'])}` · *{wd_start} working days left*")
        if o.get("end_date"):
            entry["lines"].append(f"Contract period: `{fmt_date(o['start_date'])}` → `{fmt_date(o['end_date'])}`")
        if entry["priority"]:
            entries.append(entry)

    # 3. Extension — active extensions
    for e in load_extension():
        entry = {
            "name": e["name"],
            "manager": e["manager"],
            "country": country_lookup.get(e["name"].strip().lower(), ""),
            "is_new": e["name"].strip().lower() in recent_names,
            "priority": None,
            "lines": [],
        }
        detail = f"Extension"
        if e.get("new_end_date"):
            detail += f" / New end date: {fmt_date(e['new_end_date'])}"
        entry["lines"].append(detail)
        # Extensions are new requests if recent
        if entry["is_new"]:
            entry["priority"] = "green"
        if entry["priority"]:
            entries.append(entry)

    # 4. Offboarding
    for o in load_offboarding():
        entry = {
            "name": o["name"],
            "manager": o["manager"],
            "country": country_lookup.get(o["name"].strip().lower(), ""),
            "is_new": o["name"].strip().lower() in recent_names,
            "priority": None,
            "lines": [],
        }
        if o.get("end_date"):
            wd = working_days_until(o["end_date"], today)
            if wd <= 7:
                entry["priority"] = "red"
                entry["lines"].append(f"Offboarding / Ends `{fmt_date(o['end_date'])}` · *{wd} working days left*")
            elif wd <= 14:
                entry["priority"] = "yellow"
                entry["lines"].append(f"Offboarding / Ends `{fmt_date(o['end_date'])}` · *{wd} working days left*")
        if not entry["priority"] and entry["is_new"]:
            entry["priority"] = "green"
            entry["lines"].append("Offboarding — new request")
        if entry["priority"]:
            entries.append(entry)

    # 5. Rate Change
    for r in load_rate_change():
        entry = {
            "name": r["name"],
            "manager": r["manager"],
            "country": country_lookup.get(r["name"].strip().lower(), ""),
            "is_new": r["name"].strip().lower() in recent_names,
            "priority": None,
            "lines": [],
        }
        detail = "Rate Change"
        if r.get("effective_date"):
            detail += f" / Effective {fmt_date(r['effective_date'])}"
        entry["lines"].append(detail)
        if entry["is_new"]:
            entry["priority"] = "green"
        if entry["priority"]:
            entries.append(entry)

    # Deduplicate: keep each contractor in their highest-priority bucket
    priority_rank = {"red": 0, "yellow": 1, "green": 2}
    by_name: dict[str, dict] = {}
    for e in entries:
        key = e["name"].strip().lower()
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

    # Group by bucket
    red = [e for e in by_name.values() if e["priority"] == "red"]
    yellow = [e for e in by_name.values() if e["priority"] == "yellow"]
    green = [e for e in by_name.values() if e["priority"] == "green"]

    # Format message
    lines = []
    divider = "━━━━━━━━━━━━━━━━━━━━"
    date_str = today.strftime("%A, %b %-d")
    lines.append(f"*📋 Contractor Lifecycle Digest — {date_str}*")
    lines.append("")

    if not red and not yellow and not green:
        lines.append("All clear! No items need attention today. ✨")
        return "\n".join(lines)

    def fmt_entry(e, force_new=False):
        new_tag = " (New!)" if (force_new or e["is_new"]) else ""
        country_tag = f" `{e['country']}`" if e.get("country") else ""
        block = []
        block.append(f">*{e['name']}*{new_tag}{country_tag}")
        block.append(f">Managed by {fmt_manager(e['manager'])}")
        for line in e["lines"]:
            block.append(f">{line}")
        return "\n".join(block)

    if red:
        lines.append(f"*🔴 Needs Attention* ({len(red)})")
        lines.append("")
        for e in red:
            lines.append(fmt_entry(e))
            lines.append("")

    if yellow:
        lines.append(f"*🟡 Coming Up* ({len(yellow)})")
        lines.append("")
        for e in yellow:
            lines.append(fmt_entry(e))
            lines.append("")

    if green:
        lines.append(f"*🟢 New Requests* ({len(green)})")
        lines.append("")
        for e in green:
            lines.append(fmt_entry(e, force_new=True))
            lines.append("")
    return "\n".join(lines).strip()


def _build_date_lookup() -> dict[str, str]:
    """Build name -> date info string from all tabs."""
    lookup: dict[str, str] = {}
    for c in load_sot_contractors():
        if c["end_date"]:
            lookup[c["name"].strip().lower()] = f"Ends {fmt_date(c['end_date'])}"
    for o in load_onboarding():
        key = o["name"].strip().lower()
        parts = []
        if o.get("start_date"):
            parts.append(f"Starts {fmt_date(o['start_date'])}")
        if o.get("end_date"):
            parts.append(f"Ends {fmt_date(o['end_date'])}")
        if parts:
            lookup[key] = " → ".join(parts)
    for e in load_extension():
        if e.get("new_end_date"):
            lookup[e["name"].strip().lower()] = f"New end date: {fmt_date(e['new_end_date'])}"
    for o in load_offboarding():
        if o.get("end_date"):
            lookup[o["name"].strip().lower()] = f"Ends {fmt_date(o['end_date'])}"
    for r in load_rate_change():
        if r.get("effective_date"):
            lookup[r["name"].strip().lower()] = f"Effective {fmt_date(r['effective_date'])}"
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
        key = name.strip().lower()
        req_type = row[4].strip() if len(row) > 4 else "Unknown"
        manager = row[2].strip()
        country_tag = f" `{country_lookup.get(key, '')}`" if country_lookup.get(key) else ""
        date_info = date_lookup.get(key, "")

        submitter = row[1].strip() if len(row) > 1 else ""

        block = []
        block.append(f">*{name}*{country_tag}")
        block.append(f">{req_type} · Managed by {fmt_manager(manager)}")
        if date_info:
            block.append(f">{date_info}")
        if submitter:
            block.append(f">Submitted by {submitter}")
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
