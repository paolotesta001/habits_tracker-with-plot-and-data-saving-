import sys
import os
import unittest
from unittest.mock import patch
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from data import load_data, _empty_data
from habits import add_habits, delete_habit, rename_habit, get_active_habits, get_category, get_habits_by_category
from tracking import show_summary, correlation_insight, export_csv


def make_data():
    return {
        "habits": {
            "read": {"created": "2025-08-01", "active": True},
            "exercise": {"created": "2025-08-01", "active": True},
            "meditate": {"created": "2025-08-01", "active": False},
        },
        "records": {
            "2025-08-01": {"read": True, "exercise": False, "meditate": True},
            "2025-08-02": {"read": True, "exercise": True, "meditate": False},
            "2025-08-03": {"read": False, "exercise": True},
        },
        "satisfaction_scores": {
            "2025-08-01": 80,
            "2025-08-02": 90,
            "2025-08-03": 50,
        },
        "daily_notes": {
            "2025-08-01": "Good day",
            "2025-08-02": "Great day",
            "2025-08-03": "Bad day",
        },
    }


class TestGetActiveHabits(unittest.TestCase):
    def test_filters_inactive(self):
        data = make_data()
        active = get_active_habits(data)
        self.assertEqual(active, ["read", "exercise"])
        self.assertNotIn("meditate", active)


class TestCategories(unittest.TestCase):
    def test_get_category_known(self):
        cat = get_category("read")
        self.assertEqual(cat, "learning")

    def test_get_category_unknown(self):
        cat = get_category("exercise")
        self.assertEqual(cat, "other")

    def test_get_habits_by_category(self):
        data = make_data()
        grouped = get_habits_by_category(data)
        # "read" is in learning, "exercise" is in other
        self.assertIn("learning", grouped)
        self.assertIn("read", grouped["learning"])


class TestAddHabits(unittest.TestCase):
    @patch("builtins.input", side_effect=["running", ""])
    def test_add_new_habit(self, mock_input):
        data = make_data()
        add_habits(data)
        self.assertIn("running", data["habits"])
        self.assertTrue(data["habits"]["running"]["active"])

    @patch("builtins.input", side_effect=["read", ""])
    def test_add_existing_habit(self, mock_input):
        data = make_data()
        add_habits(data)
        self.assertEqual(len([k for k in data["habits"] if k == "read"]), 1)

    @patch("builtins.input", side_effect=["meditate", "y", ""])
    def test_reactivate_inactive_habit(self, mock_input):
        data = make_data()
        add_habits(data)
        self.assertTrue(data["habits"]["meditate"]["active"])


class TestDeleteHabit(unittest.TestCase):
    @patch("builtins.input", return_value="1")
    def test_deactivate_habit(self, mock_input):
        data = make_data()
        delete_habit(data)
        self.assertFalse(data["habits"]["read"]["active"])

    @patch("builtins.input", return_value="")
    def test_cancel_delete(self, mock_input):
        data = make_data()
        delete_habit(data)
        self.assertTrue(data["habits"]["read"]["active"])


class TestRenameHabit(unittest.TestCase):
    @patch("builtins.input", side_effect=["1", "reading"])
    def test_rename_habit(self, mock_input):
        data = make_data()
        rename_habit(data)
        self.assertNotIn("read", data["habits"])
        self.assertIn("reading", data["habits"])
        self.assertIn("reading", data["records"]["2025-08-01"])
        self.assertNotIn("read", data["records"]["2025-08-01"])

    @patch("builtins.input", side_effect=["1", "exercise"])
    def test_rename_to_existing_name(self, mock_input):
        data = make_data()
        rename_habit(data)
        self.assertIn("read", data["habits"])


class TestShowSummary(unittest.TestCase):
    def test_summary_only_counts_tracked_days(self):
        data = make_data()
        with patch("builtins.print") as mock_print:
            show_summary(data)
            calls = [str(c) for c in mock_print.call_args_list]
            summary_text = " ".join(calls)
            self.assertIn("1/2", summary_text)  # meditate: 1 done out of 2 tracked


class TestCorrelationInsight(unittest.TestCase):
    def test_runs_without_error(self):
        data = make_data()
        # Add more days to meet the 5-day minimum
        for i in range(4, 9):
            d = f"2025-08-{i:02d}"
            data["records"][d] = {"read": True, "exercise": i % 2 == 0}
            data["satisfaction_scores"][d] = 60 + i * 5
            data["daily_notes"][d] = f"Day {i}"

        with patch("builtins.print"):
            correlation_insight(data)  # Should not raise


class TestExportCsv(unittest.TestCase):
    def test_export_creates_file(self):
        data = make_data()
        export_path = os.path.join(os.path.dirname(__file__), "..", "habit_export.csv")
        try:
            with patch("builtins.print"):
                export_csv(data)
            self.assertTrue(os.path.exists(export_path))
        finally:
            if os.path.exists(export_path):
                os.remove(export_path)


class TestEmptyData(unittest.TestCase):
    def test_has_all_keys(self):
        data = _empty_data()
        for key in ("habits", "records", "satisfaction_scores", "daily_notes"):
            self.assertIn(key, data)


if __name__ == "__main__":
    unittest.main()
