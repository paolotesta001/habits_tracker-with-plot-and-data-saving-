import csv
import os
from datetime import date, timedelta
from habits import get_active_habits, get_habits_by_category, get_category


def _track_day(data, target_date):
    """Core logic for tracking a specific day. Returns True if data was entered."""
    day_str = str(target_date)
    today_str = str(date.today())

    if day_str > today_str:
        print("Cannot track a future date.")
        return False

    if day_str in data["records"]:
        print(f"\nYou already have data for {day_str}.")
        update = input("Want to update it? (y/n): ").strip().lower()
        if update != "y":
            return False

    # Determine which habits were active on that date
    habits_for_day = [
        h for h, meta in data["habits"].items()
        if meta.get("active", True) and meta["created"] <= day_str
    ]

    if not habits_for_day:
        print(f"No habits were active on {day_str}.")
        return False

    print(f"\nFill out the diary for: {day_str}")
    results = {}

    for habit in habits_for_day:
        while True:
            current_status = data["records"].get(day_str, {}).get(habit)
            prompt_suffix = ""
            if current_status is not None:
                prompt_suffix = f" (current: {'y' if current_status else 'n'})"

            response = input(
                f"Have you completed '{habit}'? (y/n){prompt_suffix}: "
            ).strip().lower()
            if response in ["y", "n"]:
                results[habit] = response == "y"
                break
            else:
                print("  Invalid answer. Enter 'y' or 'n'.")

    data["records"][day_str] = results

    while True:
        try:
            satisfaction = int(input(f"\nSatisfaction score for {day_str} (1-100): "))
            if 1 <= satisfaction <= 100:
                data["satisfaction_scores"][day_str] = satisfaction
                break
            else:
                print("Please enter a number between 1 and 100.")
        except ValueError:
            print("Invalid input. Enter an integer.")

    daily_note = input(f"\nReport for {day_str}: ").strip()
    data["daily_notes"][day_str] = daily_note

    print(f"\nData saved for {day_str}.")
    return True


def track_today(data):
    _track_day(data, date.today())


def track_past_day(data):
    date_str = input("\nEnter date to fill (YYYY-MM-DD): ").strip()
    try:
        target = date.fromisoformat(date_str)
    except ValueError:
        print("Invalid date format. Use YYYY-MM-DD.")
        return
    _track_day(data, target)


def check_missed_days(data):
    """Check for gaps since last entry and offer to fill them."""
    if not data["records"]:
        return

    all_dates = sorted(data["records"].keys())
    last_entry = date.fromisoformat(all_dates[-1])
    today = date.today()

    missed = []
    current = last_entry + timedelta(days=1)
    while current < today:
        if str(current) not in data["records"]:
            missed.append(current)
        current += timedelta(days=1)

    if not missed:
        return

    if len(missed) <= 7:
        dates_str = ", ".join(d.strftime("%b %d") for d in missed)
    else:
        dates_str = (
            ", ".join(d.strftime("%b %d") for d in missed[:5])
            + f" ... and {len(missed) - 5} more"
        )

    print(f"\nYou haven't logged {len(missed)} day(s): {dates_str}")
    fill = input("Want to fill them now? (y/n): ").strip().lower()
    if fill != "y":
        return

    for d in missed:
        print(f"\n--- {d} ---")
        filled = _track_day(data, d)
        if not filled:
            skip = input("Skip remaining days? (y/n): ").strip().lower()
            if skip == "y":
                break


def show_summary(data):
    if not data["habits"]:
        print("\nNo habits to summarize.")
        return

    grouped = get_habits_by_category(data, active_only=False)

    print("\nHabit summary:")
    for category, habits in grouped.items():
        print(f"\n  [{category}]")
        for habit in habits:
            meta = data["habits"][habit]
            creation_date = meta["created"]
            is_active = meta.get("active", True)
            status = "" if is_active else " [inactive]"

            relevant_days = [
                d for d in data["records"]
                if d >= creation_date and habit in data["records"][d]
            ]
            done = sum(1 for d in relevant_days if data["records"][d].get(habit))
            total = len(relevant_days)

            if total > 0:
                percentage = (done / total) * 100
                print(f"    - {habit}{status}: {done}/{total} days ({percentage:.1f}%)")
            else:
                print(f"    - {habit}{status}: No data")


def show_streaks(data):
    if not data["records"]:
        print("\nNo data to calculate streaks.")
        return

    active_habits = get_active_habits(data)
    if not active_habits:
        print("\nNo active habits.")
        return

    all_dates = sorted(data["records"].keys())

    print("\nHabit streaks:")
    for habit in active_habits:
        creation_date = data["habits"][habit]["created"]
        habit_dates = [d for d in all_dates if d >= creation_date and habit in data["records"][d]]

        if not habit_dates:
            print(f"  - {habit}: No data yet")
            continue

        # Current streak
        current_streak = 0
        for d in reversed(habit_dates):
            if data["records"][d].get(habit):
                current_streak += 1
            else:
                break

        # Best streak
        best_streak = 0
        streak = 0
        for d in habit_dates:
            if data["records"][d].get(habit):
                streak += 1
                best_streak = max(best_streak, streak)
            else:
                streak = 0

        print(f"  - {habit}: current {current_streak} days, best {best_streak} days")


def show_weekly_view(data):
    if not data["records"]:
        print("\nNo data to display.")
        return

    active_habits = get_active_habits(data)
    if not active_habits:
        print("\nNo active habits.")
        return

    today = date.today()
    week_dates = [str(today - timedelta(days=i)) for i in range(6, -1, -1)]

    day_labels = []
    for d in week_dates:
        day_obj = date.fromisoformat(d)
        day_labels.append(day_obj.strftime("%a %d"))

    max_habit_len = max(len(h) for h in active_habits)
    header = " " * (max_habit_len + 2) + "  ".join(f"{dl:>6}" for dl in day_labels)

    print(f"\nWeekly view (last 7 days):")
    print(header)
    print("-" * len(header))

    for habit in active_habits:
        row = f"  {habit:<{max_habit_len}}"
        for d in week_dates:
            record = data["records"].get(d, {})
            if habit in record:
                mark = "  Y" if record[habit] else "  -"
            else:
                mark = "   "
            row += f"{mark:>8}"
        print(row)


def monthly_report(data):
    """Generate a monthly summary report."""
    month_input = input(
        "\nEnter month (YYYY-MM) or press Enter for last month: "
    ).strip()

    if not month_input:
        today = date.today()
        first_of_this_month = today.replace(day=1)
        last_month_end = first_of_this_month - timedelta(days=1)
        year, month = last_month_end.year, last_month_end.month
    else:
        try:
            parts = month_input.split("-")
            year, month = int(parts[0]), int(parts[1])
            if not (1 <= month <= 12):
                raise ValueError
        except (ValueError, IndexError):
            print("Invalid format. Use YYYY-MM.")
            return

    month_str = f"{year}-{month:02d}"
    month_dates = [
        d for d in sorted(data["records"].keys())
        if d.startswith(month_str)
    ]

    if not month_dates:
        print(f"\nNo data for {month_str}.")
        return

    active_habits = get_active_habits(data)

    print(f"\n{'='*50}")
    print(f"  MONTHLY REPORT: {month_str}")
    print(f"{'='*50}")
    print(f"\n  Days tracked: {len(month_dates)}")

    # Per-habit stats grouped by category
    grouped = get_habits_by_category(data)
    print(f"\n  Completion rates:")
    for category, habits in grouped.items():
        print(f"\n    [{category}]")
        for habit in habits:
            days_with_habit = [d for d in month_dates if habit in data["records"][d]]
            if not days_with_habit:
                continue
            done = sum(1 for d in days_with_habit if data["records"][d][habit])
            total = len(days_with_habit)
            pct = (done / total) * 100
            bar = "#" * int(pct // 5) + "." * (20 - int(pct // 5))
            print(f"      {habit:<22} {done:>2}/{total:<2} [{bar}] {pct:.0f}%")

    # Satisfaction stats
    month_scores = [
        data["satisfaction_scores"][d]
        for d in month_dates
        if d in data["satisfaction_scores"]
    ]
    if month_scores:
        avg = sum(month_scores) / len(month_scores)
        best_day = max(month_dates, key=lambda d: data["satisfaction_scores"].get(d, 0))
        worst_day = min(month_dates, key=lambda d: data["satisfaction_scores"].get(d, 101))
        print(f"\n  Satisfaction:")
        print(f"    Average: {avg:.1f}/100")
        print(f"    Best day:  {best_day} ({data['satisfaction_scores'].get(best_day, '?')})")
        print(f"    Worst day: {worst_day} ({data['satisfaction_scores'].get(worst_day, '?')})")

    # Compare with previous month
    prev_month = month - 1
    prev_year = year
    if prev_month == 0:
        prev_month = 12
        prev_year -= 1
    prev_month_str = f"{prev_year}-{prev_month:02d}"
    prev_dates = [d for d in data["records"] if d.startswith(prev_month_str)]

    if prev_dates:
        prev_scores = [
            data["satisfaction_scores"][d]
            for d in prev_dates
            if d in data["satisfaction_scores"]
        ]
        if prev_scores and month_scores:
            prev_avg = sum(prev_scores) / len(prev_scores)
            diff = avg - prev_avg
            arrow = "^" if diff > 0 else "v" if diff < 0 else "="
            print(f"    vs {prev_month_str}: {arrow} {abs(diff):.1f} points")

    print(f"\n{'='*50}")


def correlation_insight(data):
    """Show correlation between habit completion and satisfaction."""
    if not data["records"] or not data["satisfaction_scores"]:
        print("\nNot enough data for insights.")
        return

    # Days where we have both records and satisfaction
    valid_days = [
        d for d in data["records"]
        if d in data["satisfaction_scores"]
    ]

    if len(valid_days) < 5:
        print("\nNeed at least 5 days of data for meaningful insights.")
        return

    active_habits = get_active_habits(data)

    print("\nCorrelation insights:")

    # Overall: all habits done vs not
    perfect_days = []
    imperfect_days = []
    for d in valid_days:
        tracked = [h for h in active_habits if h in data["records"][d]]
        if not tracked:
            continue
        all_done = all(data["records"][d].get(h) for h in tracked)
        if all_done:
            perfect_days.append(d)
        else:
            imperfect_days.append(d)

    if perfect_days:
        avg_perfect = sum(data["satisfaction_scores"][d] for d in perfect_days) / len(perfect_days)
        print(f"\n  Days with ALL habits done ({len(perfect_days)} days):")
        print(f"    Average satisfaction: {avg_perfect:.1f}")

    if imperfect_days:
        avg_imperfect = sum(data["satisfaction_scores"][d] for d in imperfect_days) / len(imperfect_days)
        print(f"\n  Days with missed habits ({len(imperfect_days)} days):")
        print(f"    Average satisfaction: {avg_imperfect:.1f}")

    if perfect_days and imperfect_days:
        diff = avg_perfect - avg_imperfect
        print(f"\n  Difference: {'+' if diff > 0 else ''}{diff:.1f} points")

    # Per-habit impact
    print(f"\n  Per-habit impact on satisfaction:")
    habit_impacts = []
    for habit in active_habits:
        done_days = [d for d in valid_days if data["records"].get(d, {}).get(habit) is True]
        skip_days = [d for d in valid_days if data["records"].get(d, {}).get(habit) is False]

        if len(done_days) >= 2 and len(skip_days) >= 2:
            avg_done = sum(data["satisfaction_scores"][d] for d in done_days) / len(done_days)
            avg_skip = sum(data["satisfaction_scores"][d] for d in skip_days) / len(skip_days)
            impact = avg_done - avg_skip
            habit_impacts.append((habit, impact, avg_done, avg_skip, len(done_days), len(skip_days)))

    # Sort by absolute impact
    habit_impacts.sort(key=lambda x: abs(x[1]), reverse=True)

    for habit, impact, avg_done, avg_skip, n_done, n_skip in habit_impacts:
        arrow = "^" if impact > 0 else "v"
        print(f"    {habit:<22} {arrow} {abs(impact):+.1f}  (done={avg_done:.0f} over {n_done}d, skipped={avg_skip:.0f} over {n_skip}d)")

    # Category-level insight
    print(f"\n  Per-category impact:")
    from habits import CATEGORIES
    for cat, cat_habits in CATEGORIES.items():
        cat_active = [h for h in cat_habits if h in active_habits]
        if not cat_active:
            continue
        done_scores = []
        skip_scores = []
        for d in valid_days:
            tracked = [h for h in cat_active if h in data["records"].get(d, {})]
            if not tracked:
                continue
            all_done = all(data["records"][d].get(h) for h in tracked)
            if all_done:
                done_scores.append(data["satisfaction_scores"][d])
            else:
                skip_scores.append(data["satisfaction_scores"][d])

        if len(done_scores) >= 2 and len(skip_scores) >= 2:
            avg_d = sum(done_scores) / len(done_scores)
            avg_s = sum(skip_scores) / len(skip_scores)
            diff = avg_d - avg_s
            arrow = "^" if diff > 0 else "v"
            print(f"    [{cat}] all done={avg_d:.0f}, some missed={avg_s:.0f} ({arrow} {abs(diff):.1f})")


def export_csv(data):
    """Export all data to a CSV file."""
    active_habits = get_active_habits(data)
    all_habits = list(data["habits"].keys())
    all_dates = sorted(data["records"].keys())

    if not all_dates:
        print("\nNo data to export.")
        return

    filename = os.path.join(os.path.dirname(__file__), "habit_export.csv")

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        header = ["date"] + all_habits + ["satisfaction", "note"]
        writer.writerow(header)

        for d in all_dates:
            row = [d]
            for habit in all_habits:
                val = data["records"].get(d, {}).get(habit)
                if val is True:
                    row.append("yes")
                elif val is False:
                    row.append("no")
                else:
                    row.append("")
            row.append(data["satisfaction_scores"].get(d, ""))
            row.append(data["daily_notes"].get(d, ""))
            writer.writerow(row)

    print(f"\nExported to {filename}")
