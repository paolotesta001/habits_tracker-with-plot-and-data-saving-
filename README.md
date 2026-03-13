# Habit Tracker

A personal habit tracking app available as both a **Python CLI** tool and a **Progressive Web App (PWA)** that works on any device.

**Live demo:** [https://paolotesta001.github.io/habits_tracker-with-plot-and-data-saving-/](https://paolotesta001.github.io/habits_tracker-with-plot-and-data-saving-/)

---

## Features

### Daily Tracking
- Create, rename, and delete habits with categories (health, learning, lifestyle, other)
- Fill out your daily diary with yes/no for each habit
- Rate your daily satisfaction (1-100) and write a personal note
- Compact summary view after saving, with the ability to edit throughout the day

### History & Calendar
- Weekly calendar grid showing completion status for each habit
- Navigate between weeks to review past performance
- Click any past day to fill or update its entry

### Statistics
- **Summary** - Overall completion rates and consistency percentages per habit
- **Streaks** - Current and best streaks for each habit
- **Monthly** - Month-by-month breakdown of your performance
- **Insights** - Patterns and trends in your habits
- **Progress Plot** - Cumulative completion chart (click a habit in the legend to isolate it)
- **Satisfaction Plot** - Daily satisfaction score trend over time

### Settings
- **Habits** - Add, rename, toggle, or delete habits
- **Notifications** - Set a daily reminder at your preferred time
- **Data** - Export (JSON/CSV), import, or reset all data

### Other
- Dark / light theme toggle with persistent preference
- Installable as a PWA (works offline via service worker)
- All data stored locally in IndexedDB (nothing leaves your device)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript, HTML, CSS |
| Charts | [Chart.js](https://www.chartjs.org/) |
| Storage | IndexedDB |
| Offline | Service Worker (network-first caching) |
| Hosting | GitHub Pages |
| CLI version | Python 3, matplotlib, mplcursors |

---

## Getting Started

### Web App (recommended)

Visit the [live demo](https://paolotesta001.github.io/habits_tracker-with-plot-and-data-saving-/) or install it on your phone:

1. Open the link in Chrome / Safari
2. Tap **"Add to Home Screen"** (or the install icon in the address bar)
3. The app works fully offline after the first load

### Python CLI

```bash
# Clone the repository
git clone https://github.com/paolotesta001/habits_tracker-with-plot-and-data-saving-.git
cd habits_tracker-with-plot-and-data-saving-

# Install dependencies
pip install matplotlib mplcursors

# Run
python main.py
```

---

## Project Structure

```
.
├── docs/                  # Web app (GitHub Pages root)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── sw.js              # Service worker
│   ├── manifest.json      # PWA manifest
│   └── icons/
├── main.py                # Python CLI entry point
├── habits.py              # Habit management logic
├── plots.py               # Matplotlib charts
├── data.json              # Local data file (Python version)
└── README.md
```

---

## Python CLI Menu

The CLI version provides a numbered menu:

1. Add a new habit
2. Delete a habit
3. Rename a habit
4. View active habits
5. Fill out the daily diary (with satisfaction score and daily note)
6. View habit summary
7. Show progress plot (cumulative completions over time)
8. Show satisfaction plot (interactive - click points to see notes)
9. Exit

---

## Screenshots

### Web App - Today View
Track your daily habits with a clean, mobile-friendly interface. After saving, a compact summary shows your progress (e.g., 3/4 - 75%) with an edit button.

### Web App - Statistics
Six stat tabs give you a full picture: summary, streaks, monthly breakdown, insights, and two interactive Chart.js plots.

### Python CLI - Satisfaction Plot
Click any data point to reveal the date, score, and your personal note for that day.

<img width="1365" height="719" alt="Satisfaction plot" src="https://github.com/user-attachments/assets/cbe304f1-4086-4cde-ae04-47ab736d563d" />

### Python CLI - Progress Plot
Cumulative habit completions over time. Each line represents a habit.

<img width="1365" height="716" alt="Progress plot" src="https://github.com/user-attachments/assets/2c950537-e26e-43e3-a314-d2b80beacfd3" />

---

## License

This project is for personal use and learning purposes.
