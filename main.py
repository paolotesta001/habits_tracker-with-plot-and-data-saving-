from data import load_data, save_data
from habits import add_habits, delete_habit, rename_habit, view_habits, manage_categories
from tracking import (
    track_today,
    track_past_day,
    check_missed_days,
    show_summary,
    show_streaks,
    show_weekly_view,
    monthly_report,
    correlation_insight,
    export_csv,
)
from plots import plot_progress, plot_satisfaction


MENU = """
Habit Tracker Menu
  1.  Add new habit
  2.  Deactivate habit
  3.  Rename habit
  4.  Manage categories
  5.  View active habits
  6.  Fill out today's diary
  7.  Fill a past day
  8.  Show summary
  9.  Show streaks
  10. Show weekly view
  11. Monthly report
  12. Correlation insights
  13. Show progress plot
  14. Show satisfaction plot
  15. Export to CSV
  0.  Exit
"""

ACTIONS = {
    "1": add_habits,
    "2": delete_habit,
    "3": rename_habit,
    "4": manage_categories,
    "5": view_habits,
    "6": track_today,
    "7": track_past_day,
    "8": show_summary,
    "9": show_streaks,
    "10": show_weekly_view,
    "11": monthly_report,
    "12": correlation_insight,
    "13": plot_progress,
    "14": plot_satisfaction,
    "15": export_csv,
}


def main():
    data = load_data()
    print("\nWelcome to your Habit Tracker!")

    # Check for missed days on startup
    check_missed_days(data)
    save_data(data)

    while True:
        print(MENU)
        choice = input("Choose an option (0-15): ").strip()

        if choice == "0":
            save_data(data)
            print("Goodbye! See you tomorrow.\n")
            break

        action = ACTIONS.get(choice)
        if action:
            try:
                action(data)
            except Exception as e:
                print(f"\nError: {e}")
            save_data(data)
        else:
            print("Invalid choice, try again.")


if __name__ == "__main__":
    main()
