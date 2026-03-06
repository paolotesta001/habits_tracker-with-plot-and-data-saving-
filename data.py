import json
import os
from datetime import date


DATA_FILE = os.path.join(os.path.dirname(__file__), "habit_tracker.json")


def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                data = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"Warning: Could not parse {DATA_FILE}: {e}")
            print("Starting with empty data. The corrupted file was NOT overwritten.")
            print("Fix or delete the JSON file manually if needed.")
            return _empty_data()

        # Validate expected keys
        for key in ("habits", "records", "satisfaction_scores", "daily_notes"):
            if key not in data:
                data[key] = {} if key != "habits" else {}

        # Migrate old list format to dict format
        if isinstance(data["habits"], list):
            data["habits"] = {
                h: {"created": str(date.today()), "active": True}
                for h in data["habits"]
            }

        # Ensure all existing habits have 'active' key
        for habit in data["habits"]:
            if "active" not in data["habits"][habit]:
                data["habits"][habit]["active"] = True

        return data
    else:
        return _empty_data()


def _empty_data():
    return {
        "habits": {},
        "records": {},
        "satisfaction_scores": {},
        "daily_notes": {},
    }


def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)
