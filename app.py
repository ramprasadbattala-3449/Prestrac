"""
Leave Tracker — Flask Application
MSS Pharma Associates | Team Attendance & Roster Management
"""

from flask import Flask, render_template, request, jsonify, send_file
from datetime import datetime, date, timedelta
import json
import os
import csv
import io

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory data store (replace with a DB in production)
# ---------------------------------------------------------------------------
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "entries.json")

TEAM_MEMBERS = [
    "Ramprasad",
    "Anil Kumar",
    "Divya Sree",
    "Kiran Rao",
    "Sunita Mehta",
]

WORK_MODES = {
    "office": "Office",
    "wfh": "Work from home",
    "shift": "Shift change",
    "leave": "Planned leave",
    "sick": "Sick leave",
}

SHIFTS = {
    "morning": "Morning (6 AM – 2 PM)",
    "general": "General (9 AM – 6 PM)",
    "afternoon": "Afternoon (2 PM – 10 PM)",
    "night": "Night (10 PM – 6 AM)",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_entries():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return _seed_data()


def save_entries(entries):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(entries, f, indent=2, default=str)


def _seed_data():
    """Sample data so the app looks populated on first run."""
    data = [
        {"from": "2025-04-01", "to": "2025-04-02", "name": "Anil Kumar",
         "mode": "office", "notes": "", "shift": "", "shiftReason": ""},
        {"from": "2025-04-01", "to": "2025-04-04", "name": "Divya Sree",
         "mode": "wfh", "notes": "Remote sprint", "shift": "", "shiftReason": ""},
        {"from": "2025-04-02", "to": "2025-04-04", "name": "Kiran Rao",
         "mode": "leave", "notes": "Family event", "shift": "", "shiftReason": ""},
        {"from": "2025-04-03", "to": "2025-04-03", "name": "Sunita Mehta",
         "mode": "sick", "notes": "", "shift": "", "shiftReason": ""},
        {"from": "2025-04-04", "to": "2025-04-06", "name": "Ramprasad",
         "mode": "wfh", "notes": "", "shift": "", "shiftReason": ""},
        {"from": "2025-04-07", "to": "2025-04-07", "name": "Anil Kumar",
         "mode": "shift", "notes": "", "shift": "night", "shiftReason": "Covering Kiran"},
        {"from": "2025-04-08", "to": "2025-04-08", "name": "Divya Sree",
         "mode": "shift", "notes": "", "shift": "morning", "shiftReason": "Client call"},
        {"from": "2025-04-07", "to": "2025-04-09", "name": "Ramprasad",
         "mode": "office", "notes": "", "shift": "", "shiftReason": ""},
        {"from": "2025-04-08", "to": "2025-04-10", "name": "Kiran Rao",
         "mode": "wfh", "notes": "", "shift": "", "shiftReason": ""},
        {"from": "2025-04-09", "to": "2025-04-09", "name": "Sunita Mehta",
         "mode": "wfh", "notes": "", "shift": "", "shiftReason": ""},
        {"from": "2025-04-10", "to": "2025-04-11", "name": "Anil Kumar",
         "mode": "leave", "notes": "Wedding", "shift": "", "shiftReason": ""},
    ]
    save_entries(data)
    return data


def count_weekdays(from_str, to_str):
    """Count Mon–Fri days between two date strings (inclusive)."""
    d = datetime.strptime(from_str, "%Y-%m-%d").date()
    end = datetime.strptime(to_str, "%Y-%m-%d").date()
    count = 0
    while d <= end:
        if d.weekday() < 5:  # 0=Mon … 4=Fri
            count += 1
        d += timedelta(days=1)
    return count


def expand_entry(entry):
    """Return list of weekday date strings covered by an entry."""
    d = datetime.strptime(entry["from"], "%Y-%m-%d").date()
    end = datetime.strptime(entry["to"], "%Y-%m-%d").date()
    days = []
    while d <= end:
        if d.weekday() < 5:
            days.append(str(d))
        d += timedelta(days=1)
    return days


def build_tally(entries, month):
    """Build per-person day counts for a given month (YYYY-MM)."""
    tally = {n: {"office": 0, "wfh": 0, "shift": 0, "leave": 0, "sick": 0}
             for n in TEAM_MEMBERS}
    for e in entries:
        for day in expand_entry(e):
            if day.startswith(month) and e["name"] in tally:
                mode = e["mode"]
                if mode in tally[e["name"]]:
                    tally[e["name"]][mode] += 1
    return tally


def available_months():
    """Return last 6 months as (value, label) tuples."""
    months = []
    today = date.today()
    for i in range(6):
        d = date(today.year, today.month, 1) - timedelta(days=30 * i)
        val = d.strftime("%Y-%m")
        label = d.strftime("%B %Y")
        months.append((val, label))
    return months


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template(
        "index.html",
        team=TEAM_MEMBERS,
        modes=WORK_MODES,
        shifts=SHIFTS,
        months=available_months(),
        today=str(date.today()),
    )


# --- Entry CRUD ---

@app.route("/api/entries", methods=["GET"])
def get_entries():
    entries = load_entries()
    month = request.args.get("month", "")
    name = request.args.get("name", "")
    if month:
        filtered = [e for e in entries if e["from"].startswith(month) or e["to"].startswith(month)]
    else:
        filtered = entries
    if name:
        filtered = [e for e in filtered if e["name"] == name]
    for e in filtered:
        e["days"] = count_weekdays(e["from"], e["to"])
    return jsonify(filtered)


@app.route("/api/entries", methods=["POST"])
def add_entry():
    data = request.get_json()

    # Validation
    required = ["from", "to", "name", "mode"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' is required."}), 400

    if data["to"] < data["from"]:
        return jsonify({"error": "To date must be on or after From date."}), 400

    if data["name"] not in TEAM_MEMBERS:
        return jsonify({"error": "Unknown team member."}), 400

    if data["mode"] not in WORK_MODES:
        return jsonify({"error": "Invalid work mode."}), 400

    if data["mode"] == "shift" and not data.get("shift"):
        return jsonify({"error": "Shift type is required for Shift change mode."}), 400

    entry = {
        "from": data["from"],
        "to": data["to"],
        "name": data["name"],
        "mode": data["mode"],
        "notes": data.get("notes", ""),
        "shift": data.get("shift", ""),
        "shiftReason": data.get("shiftReason", ""),
    }

    entries = load_entries()
    entries.insert(0, entry)
    save_entries(entries)

    days = count_weekdays(entry["from"], entry["to"])
    return jsonify({"success": True, "days": days, "entry": entry}), 201


@app.route("/api/entries/<int:idx>", methods=["PUT"])
def update_entry(idx):
    """Manager overwrite — update any field of an existing entry."""
    data = request.get_json()
    entries = load_entries()

    if idx < 0 or idx >= len(entries):
        return jsonify({"error": "Entry not found."}), 404

    updatable = ["from", "to", "name", "mode", "notes", "shift", "shiftReason"]
    for field in updatable:
        if field in data:
            entries[idx][field] = data[field]

    save_entries(entries)
    return jsonify({"success": True, "entry": entries[idx]})


@app.route("/api/entries/<int:idx>", methods=["DELETE"])
def delete_entry(idx):
    entries = load_entries()
    if idx < 0 or idx >= len(entries):
        return jsonify({"error": "Entry not found."}), 404
    removed = entries.pop(idx)
    save_entries(entries)
    return jsonify({"success": True, "removed": removed})


# --- Analytics ---

@app.route("/api/summary", methods=["GET"])
def summary():
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    entries = load_entries()
    tally = build_tally(entries, month)

    totals = {"office": 0, "wfh": 0, "shift": 0, "leave": 0, "sick": 0}
    for person_data in tally.values():
        for k, v in person_data.items():
            totals[k] += v

    result = {
        "month": month,
        "totals": totals,
        "grand_total": sum(totals.values()),
        "persons": []
    }

    for name in TEAM_MEMBERS:
        r = tally[name]
        total = sum(r.values()) or 1
        wfh_pct = round(r["wfh"] / total * 100)
        result["persons"].append({
            "name": name,
            "initials": "".join(w[0] for w in name.split())[:2].upper(),
            **r,
            "total": sum(r.values()),
            "wfh_pct": wfh_pct,
        })

    return jsonify(result)


# --- Export ---

@app.route("/api/export/csv", methods=["GET"])
def export_csv():
    month = request.args.get("month", date.today().strftime("%Y-%m"))
    entries = load_entries()
    tally = build_tally(entries, month)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Office", "WFH", "Shift Changes",
                     "Planned Leave", "Sick Leave", "Total", "WFH %"])
    for name in TEAM_MEMBERS:
        r = tally[name]
        total = sum(r.values()) or 1
        wfh_pct = round(r["wfh"] / total * 100)
        writer.writerow([
            name, r["office"], r["wfh"], r["shift"],
            r["leave"], r["sick"], sum(r.values()), f"{wfh_pct}%"
        ])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"leave_tracker_{month}.csv"
    )


# --- Team & config ---

@app.route("/api/team", methods=["GET"])
def get_team():
    return jsonify(TEAM_MEMBERS)


@app.route("/api/team", methods=["POST"])
def add_member():
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required."}), 400
    if name in TEAM_MEMBERS:
        return jsonify({"error": "Member already exists."}), 400
    TEAM_MEMBERS.append(name)
    return jsonify({"success": True, "team": TEAM_MEMBERS}), 201


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    app.run(debug=True, host="0.0.0.0", port=5000)
