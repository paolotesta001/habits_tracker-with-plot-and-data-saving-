import textwrap
import matplotlib.pyplot as plt
import mplcursors


def plot_progress(data):
    if not data["records"]:
        print("\nNo data on habits to display.")
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
    plt.legend(fontsize=10, loc="upper left")
    plt.tight_layout()
    plt.grid(True, linestyle="--", alpha=0.7)
    plt.show()


def plot_satisfaction(data):
    if not data["satisfaction_scores"]:
        print("\nNo satisfaction data to display.")
        return

    dates = sorted(data["satisfaction_scores"].keys())
    scores = [data["satisfaction_scores"][d] for d in dates]
    notes = [data["daily_notes"].get(d, "No note.") for d in dates]

    fig, ax = plt.subplots(figsize=(12, 6))
    (line,) = ax.plot(
        dates, scores, marker="o", linestyle="-", color="purple", linewidth=2
    )

    ax.set_xlabel("Day", fontsize=12)
    ax.set_ylabel("Satisfaction Score (1-100)", fontsize=12)
    ax.set_title("Daily Satisfaction Score Trend", fontsize=14)
    ax.set_ylim(0, 105)
    ax.set_xticks(dates[:: max(1, len(dates) // 10)])
    ax.tick_params(axis="x", rotation=45, labelsize=10)
    ax.tick_params(axis="y", labelsize=10)
    ax.grid(True, linestyle="--", alpha=0.7)

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
