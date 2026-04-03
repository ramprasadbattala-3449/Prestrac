# Leave Tracker — MSS Pharma Associates

Team attendance and roster management web app built with Flask.

## Features

- Log attendance by date range (from / to) with weekday-only counting
- Work modes: Office, WFH, Shift change (Morning / General / Afternoon / Night), Planned leave, Sick leave
- Visual reference tab — donut chart, stacked bar chart, per-person breakdown before logging
- Monthly dashboard with summary stats and WFH % bar
- History tab with manager overwrite (Edit) and delete
- CSV export per month
- Data persisted to `data/entries.json`

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/leave-tracker.git
cd leave-tracker

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run
python app.py
```

Open `http://localhost:5000` in your browser.

## Project structure

```
leave_tracker/
├── app.py                  # Flask routes and business logic
├── requirements.txt
├── data/
│   └── entries.json        # Auto-created on first run
├── templates/
│   └── index.html          # Jinja2 template
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

## API endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/entries` | List entries (filter by `?month=` or `?name=`) |
| POST | `/api/entries` | Add new entry |
| PUT | `/api/entries/<idx>` | Manager overwrite — update entry |
| DELETE | `/api/entries/<idx>` | Delete entry |
| GET | `/api/summary` | Monthly tally per person (`?month=YYYY-MM`) |
| GET | `/api/export/csv` | Download CSV (`?month=YYYY-MM`) |
| GET | `/api/team` | List team members |
| POST | `/api/team` | Add team member |

## Notes

- Replace `data/entries.json` with a proper database (SQLite / PostgreSQL) for production use.
- Add authentication before deploying to a shared environment.
