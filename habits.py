from datetime import date

# Category definitions — edit this to reorganize your habits
CATEGORIES = {
    "health": ["brush your teeth", "basal insulin", "eat healthy", "knee supplement"],
    "learning": ["read", "reverso", "self-study", "podcast"],
    "lifestyle": ["movie", "wake up at 7", "scheduling tomorrow", "No bad habits"],
}


def get_active_habits(data):
    return [h for h, meta in data["habits"].items() if meta.get("active", True)]


def get_category(habit):
    """Return the category name for a habit, or 'other'."""
    for cat, habits in CATEGORIES.items():
        if habit in habits:
            return cat
    return "other"


def get_habits_by_category(data, active_only=True):
    """Return dict of {category: [habit_names]}."""
    habits = get_active_habits(data) if active_only else list(data["habits"].keys())
    grouped = {}
    for h in habits:
        cat = get_category(h)
        grouped.setdefault(cat, []).append(h)
    return grouped


def _select_habit(data, prompt="Select a habit"):
    """Show numbered list of active habits and return the selected name, or None."""
    active = get_active_habits(data)
    if not active:
        print("\nNo active habits.")
        return None

    print(f"\n{prompt}:")
    for i, h in enumerate(active, 1):
        print(f"  {i}. {h}")

    choice = input("\nEnter number (or press Enter to cancel): ").strip()
    if not choice:
        return None
    try:
        index = int(choice) - 1
        if 0 <= index < len(active):
            return active[index]
        else:
            print("Invalid number.")
            return None
    except ValueError:
        print("Invalid input. Please enter a number.")
        return None


def manage_categories(data):
    """Let the user assign habits to categories."""
    active = get_active_habits(data)
    if not active:
        print("\nNo active habits.")
        return

    print("\nCurrent categories:")
    grouped = get_habits_by_category(data)
    for cat, habits in grouped.items():
        print(f"  [{cat}] {', '.join(habits)}")

    print("\nTo change categories, edit the CATEGORIES dict in habits.py")
    print("Available categories:", ", ".join(CATEGORIES.keys()))

    habit = _select_habit(data, "Select a habit to recategorize")
    if habit is None:
        return

    print("\nAvailable categories:")
    cat_list = list(CATEGORIES.keys()) + ["other"]
    for i, c in enumerate(cat_list, 1):
        print(f"  {i}. {c}")

    choice = input("Enter number: ").strip()
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(cat_list):
            new_cat = cat_list[idx]
            # Remove from old category
            for cat, habits in CATEGORIES.items():
                if habit in habits:
                    habits.remove(habit)
            # Add to new category
            if new_cat != "other":
                CATEGORIES.setdefault(new_cat, []).append(habit)
            print(f"'{habit}' moved to [{new_cat}].")
        else:
            print("Invalid number.")
    except ValueError:
        print("Invalid input.")


def add_habits(data):
    while True:
        new_habit = input("\nEnter a new habit (or press Enter to finish): ").strip()
        if not new_habit:
            break
        if new_habit not in data["habits"]:
            data["habits"][new_habit] = {"created": str(date.today()), "active": True}
            print(f"Habit added: {new_habit}")
        else:
            if not data["habits"][new_habit]["active"]:
                reactivate = input(
                    f"'{new_habit}' exists but is inactive. Reactivate? (y/n): "
                ).strip().lower()
                if reactivate == "y":
                    data["habits"][new_habit]["active"] = True
                    print(f"Habit reactivated: {new_habit}")
            else:
                print("Already exists.")


def delete_habit(data):
    habit = _select_habit(data, "Select a habit to deactivate")
    if habit is None:
        return
    data["habits"][habit]["active"] = False
    print(f"Habit '{habit}' removed from active list (history preserved).")


def rename_habit(data):
    old_name = _select_habit(data, "Select a habit to rename")
    if old_name is None:
        return

    new_name = input("Enter the new name: ").strip()
    if not new_name:
        print("Cancelled.")
        return
    if new_name in data["habits"]:
        print("A habit with that name already exists.")
        return

    # Rename in habits
    data["habits"][new_name] = data["habits"].pop(old_name)

    # Update records
    for day, habits in data["records"].items():
        if old_name in habits:
            habits[new_name] = habits.pop(old_name)

    print(f"Habit renamed from '{old_name}' to '{new_name}'.")


def view_habits(data):
    active = get_active_habits(data)
    if not active:
        print("\nNo active habits.")
    else:
        print("\nCurrent active habits:")
        for i, h in enumerate(active, 1):
            print(f"  {i}. {h}")
