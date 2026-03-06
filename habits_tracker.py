import json
import os
from datetime import date
import matplotlib.pyplot as plt
import mplcursors # Per rendere i punti cliccabili nel grafico
import textwrap # Importa il modulo textwrap

DATA_FILE = os.path.join(os.path.dirname(__file__), "habit_tracker.json")

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
            if isinstance(data["habits"], list): 
                data["habits"] = {h: {"created": str(date.today()), "active": True} for h in data["habits"]}
            
            # Ensure all existing habits have 'active' key
            for habit in data["habits"]:
                if "active" not in data["habits"][habit]:
                    data["habits"][habit]["active"] = True

            return data
    else:
        return {
            "habits": {},               # name of habit: {created: "YYYY-MM-DD", "active": True}
            "records": {},
            "satisfaction_scores": {},
            "daily_notes": {}
        } 

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

def add_habits(data):
    while True:
        new_habit = input("\n Enter a new habit (or press Enter to finish): ").strip()
        if not new_habit:
            break
        if new_habit not in data["habits"]:
            data["habits"][new_habit] = {"created": str(date.today()), "active": True}
            print(f"✅ habit added: {new_habit}")
        else:
            print("⚠️ already exists")

def delete_habit(data):
    view_habits(data)
    habit = input("\nEnter the name of the habit to delete (or Enter to cancel): ").strip()
    if habit in data["habits"] and data["habits"][habit]["active"]:
        data["habits"][habit]["active"] = False  # deactivate instead of deleting
        print(f"🗑 Habit '{habit}' removed from active list (history preserved).")
    else:
        print("\n⚠️ Habit not found or already inactive.")

def rename_habit(data):
    view_habits(data)
    old_name = input("\nEnter the habit to rename: ").strip()
    if old_name not in data["habits"]:
        print("⚠️ Habit not found.")
        return
    
    new_name = input("Enter the new name: ").strip()
    if not new_name or new_name in data["habits"]:
        print("⚠️ Invalid or already existing name.")
        return
    
    # Rename in habits
    data["habits"][new_name] = data["habits"].pop(old_name)

    # Update records
    for day, habits in data["records"].items():
        if old_name in habits:
            habits[new_name] = habits.pop(old_name)

    print(f"\n✏️ Habit renamed from '{old_name}' to '{new_name}'.")

def view_habits(data):
    print("\n📋 Current active habits:")
    active = [h for h, meta in data["habits"].items() if meta.get("active", True)]
    if not active:
        print("⚠️ No active habits.")
    else:
        for h in active:
            print(f"- {h}")

def track_today(data):
    today = str(date.today())
    
    if today in data["records"]:
        print(f"\n📅 You have already entered the data for today ({today}).")
        update_response = input("\nWant to update your data for today? (y/n): ").strip().lower()
        if update_response != "y":
            return

    print(f"\nFill out the diary for today: {today}")
    results = {}

    # ✅ Only active habits
    active_habits = [h for h, meta in data["habits"].items() if meta.get("active", True)]

    for habit in active_habits:
        while True:
            current_status = data["records"].get(today, {}).get(habit)
            prompt_suffix = ""
            if current_status is not None:
                prompt_suffix = f" (current: {'y' if current_status else 'n'})"
            
            response = input(f"\nHave you completed '{habit}' today? (y/n){prompt_suffix}: ").strip().lower()
            if response in ["y", "n"]:
                results[habit] = (response == "y")
                if response == "y":
                    print(f"🎉 Great job, be satisfied you've completed: {habit}!")
                else:
                    print("😔 Don't get discouraged, but try to do better tomorrow.")
                break
            else:
                print("invalid answer! Fill out with 'y' or 'n'.")
    
    data["records"][today] = results
    
    # Ask for satisfaction score
    while True:
        try:
            satisfaction = int(input("\nHow satisfied are you from 1 to 100 for today?: "))
            if 1 <= satisfaction <= 100:
                data["satisfaction_scores"][today] = satisfaction
                break
            else:
                print("Please enter a number between 1 and 100.")
        except ValueError:
            print("Invalid input. Enter an integer.")

    daily_note = input("\nGive a report for today: ").strip()
    data["daily_notes"][today] = daily_note

    print("\n✅ Data saved for today.")


def show_summary(data):
    print("\n📊 Habit summary:")
    for habit, meta in data["habits"].items():
        creation_date = meta["created"]
        relevant_days = [d for d in data["records"] if d >= creation_date]
        done = sum(1 for d in relevant_days if data["records"][d].get(habit))
        total = len(relevant_days)
        if total > 0:
            percentage = (done / total) * 100
            print(f"- {habit}: {done}/{total} days completed ({percentage:.1f}%)")
        else:
            print(f"- {habit}: No data available.")

def plot_progress(data):
    if not data["records"]:
        print("\n📉 No data on habits to display.")
        return

    all_dates = sorted(data["records"].keys())
    habits = data["habits"].keys()

    cumulative = {habit: [] for habit in habits}
    counters = {habit: 0 for habit in habits}

    for d in all_dates:
        for habit in habits:
            if d >= data["habits"][habit]["created"]:
                if data["records"][d].get(habit):
                    counters[habit] += 1
                cumulative[habit].append(counters[habit])
            else:
                cumulative[habit].append(None)  

    # Plot
    plt.figure(figsize=(12, 7))
    for habit in habits:
        y = [v for v in cumulative[habit] if v is not None]
        x = [d for v, d in zip(cumulative[habit], all_dates) if v is not None]
        plt.plot(x, y, label=habit, marker="o", linewidth=2)

    plt.xlabel("Day", fontsize=12)
    plt.ylabel("Cumulative completions", fontsize=12)
    plt.title("Cumulative trend of habits", fontsize=14)
    plt.xticks(rotation=45, fontsize=10) 
    plt.yticks(fontsize=10)
    plt.legend(fontsize=10, loc='upper left')
    plt.tight_layout()
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.show()

def plot_satisfaction(data):
    if not data["satisfaction_scores"]:
        print("\n📉 No satisfaction data to display.")
        return

    dates = sorted(data["satisfaction_scores"].keys())
    scores = [data["satisfaction_scores"][d] for d in dates]
    notes = [data["daily_notes"].get(d, "Nessuna nota.") for d in dates] 

    fig, ax = plt.subplots(figsize=(12, 6))
    line, = ax.plot(dates, scores, marker="o", linestyle='-', color='purple', linewidth=2)

    ax.set_xlabel("Day", fontsize=12)
    ax.set_ylabel("Satisfaction Score (1-100)", fontsize=12)
    ax.set_title("Daily Satisfaction Score Trend", fontsize=14)
    ax.set_ylim(0, 105) # Extend the Y axis slightly
    ax.set_xticks(dates[::max(1, len(dates)//10)]) # Show less tick if there are many days
    ax.tick_params(axis='x', rotation=45, labelsize=10)

    ax.tick_params(axis='y', labelsize=10)
    ax.grid(True, linestyle='--', alpha=0.7)

    # Add interactivity with mplcursors
    cursor = mplcursors.cursor(line, hover=False)

    @cursor.connect("add")
    def on_add(sel):
        index = int(sel.index)
        sel.annotation.set_text(
            f"date: {dates[index]}\n"
            f"satisfaction: {scores[index]}\n"
            f"note: {textwrap.fill(notes[index], width=40)}"
        )

    
    plt.tight_layout()
    plt.show()

def main():
    data = load_data()
    while True:
        print("\n👋 hi, welcome to your habits tracker. Happy to see you here 🙂")
        print("\n📓 Habit Tracker Menu")
        print("1. Add new habit")
        print("2. Delete habit (deactivate)")
        print("3. Rename habit")
        print("4. View active habits")
        print("5. Fill out today's diary")
        print("6. Show summary")
        print("7. Show progress plot")
        print("8. Show satisfaction plot")
        print("9. Exit")

        choice = input("" \
        "\n Choose an option (1-9): ").strip()

        if choice == "1":
            add_habits(data)
        elif choice == "2":
            delete_habit(data)
        elif choice == "3":
            rename_habit(data)
        elif choice == "4":
            view_habits(data)
        elif choice == "5":
            track_today(data)
        elif choice == "6":
            show_summary(data)
        elif choice == "7":
            plot_progress(data)
        elif choice == "8":
            plot_satisfaction(data)
        elif choice == "9":
            save_data(data)
            print("👋 Goodbye! See you tomorrow. I hope you have a satisfying day 😊" \
            "\n")
            break
        else:
            print("⚠️ Invalid choice, try again.")

        save_data(data)  # auto-save after each action

if __name__ == "__main__":
    main()