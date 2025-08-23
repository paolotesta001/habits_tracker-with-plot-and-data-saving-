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
            # Aggiorna se è nel vecchio formato (lista semplice)
            if isinstance(data["habits"], list):
                data["habits"] = {h: {"created": str(date.today())} for h in data["habits"]}
            return data
    else:
        return {
            "habits": {},  # nome_abitudine: {created: "YYYY-MM-DD"}
            "records": {},
            "satisfaction_scores": {},
            "daily_notes": {}
        }

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

def add_habits(data):
    while True:
        new_habit = input("Inserisci una nuova abitudine (o premi Invio per finire): ").strip()
        if not new_habit:
            break
        if new_habit not in data["habits"]:
            data["habits"][new_habit] = {"created": str(date.today())}
            print(f"✅ Aggiunta: {new_habit}")
        else:
            print("⚠️ Esiste già.")

def track_today(data):
    today = str(date.today())
    
    # Se il giorno è già presente, chiedi se si vuole aggiornare
    if today in data["records"]:
        print(f"\n📅 Hai già inserito i dati per oggi ({today}).")
        update_response = input("Vuoi aggiornare i dati per oggi? (s/n): ").strip().lower()
        if update_response != "s":
            return

    print(f"\nCompila il diario per oggi: {today}")
    results = {}
    for habit in data["habits"].keys():
        while True:
            # Mostra lo stato attuale se già presente
            current_status = data["records"].get(today, {}).get(habit)
            prompt_suffix = ""
            if current_status is not None:
                prompt_suffix = f" (attuale: {'s' if current_status else 'n'})"
            
            response = input(f"Hai completato '{habit}' oggi? (s/n){prompt_suffix}: ").strip().lower()
            if response in ["s", "n"]:
                results[habit] = (response == "s")
                if response == "s":
                    print(f"🎉 Ottimo lavoro, sii soddisfatto di aver completato: {habit}!")
                else:
                    print("😔 Non ti abbattere, domani però cerca di fare meglio.")
                break
            else:
                print("Rispondi con 's' o 'n'.")
    data["records"][today] = results
    
    # Chiedi il punteggio di soddisfazione
    while True:
        try:
            satisfaction = int(input("\nQuanto sei soddisfatto da 1 a 100 per oggi?: "))
            if 1 <= satisfaction <= 100:
                data["satisfaction_scores"][today] = satisfaction
                break
            else:
                print("Per favore, inserisci un numero tra 1 e 100.")
        except ValueError:
            print("Input non valido. Inserisci un numero intero.")

    # Chiedi il resoconto giornaliero
    daily_note = input("Dai un resoconto per oggi: ").strip()
    data["daily_notes"][today] = daily_note

    print("✅ Dati salvati per oggi.")

def show_summary(data):
    print("\n📊 Riepilogo abitudini:")
    for habit, meta in data["habits"].items():
        creation_date = meta["created"]
        relevant_days = [d for d in data["records"] if d >= creation_date]
        done = sum(1 for d in relevant_days if data["records"][d].get(habit))
        total = len(relevant_days)
        if total > 0:
            percentage = (done / total) * 100
            print(f"- {habit}: {done}/{total} giorni completati ({percentage:.1f}%)")
        else:
            print(f"- {habit}: Nessun dato disponibile.")

def plot_progress(data):
    if not data["records"]:
        print("\n📉 Nessun dato sulle abitudini da visualizzare.")
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
                cumulative[habit].append(None)  # Giorni prima dell'inizio

    # Plot
    plt.figure(figsize=(12, 7))
    for habit in habits:
        # Pulisce i valori None e le date corrispondenti
        y = [v for v in cumulative[habit] if v is not None]
        x = [d for v, d in zip(cumulative[habit], all_dates) if v is not None]
        plt.plot(x, y, label=habit, marker="o", linewidth=2)

    plt.xlabel("Giorno", fontsize=12)
    plt.ylabel("Completamenti cumulativi", fontsize=12)
    plt.title("Andamento cumulativo delle abitudini", fontsize=14)
    plt.xticks(rotation=45, fontsize=10) 
    plt.yticks(fontsize=10)
    plt.legend(fontsize=10, loc='upper left')
    plt.tight_layout()
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.show()

def plot_satisfaction(data):
    if not data["satisfaction_scores"]:
        print("\n📉 Nessun dato di soddisfazione da visualizzare.")
        return

    dates = sorted(data["satisfaction_scores"].keys())
    scores = [data["satisfaction_scores"][d] for d in dates]
    notes = [data["daily_notes"].get(d, "Nessuna nota.") for d in dates] # Assicurati che ci sia una nota

    fig, ax = plt.subplots(figsize=(12, 6))
    line, = ax.plot(dates, scores, marker="o", linestyle='-', color='purple', linewidth=2)

    ax.set_xlabel("Giorno", fontsize=12)
    ax.set_ylabel("Punteggio di Soddisfazione (1-100)", fontsize=12)
    ax.set_title("Andamento del Punteggio di Soddisfazione Giornaliero", fontsize=14)
    ax.set_ylim(0, 105) # Estendi leggermente l'asse Y
    ax.set_xticks(dates[::max(1, len(dates)//10)]) # Mostra meno tick se ci sono molti giorni
    ax.tick_params(axis='x', rotation=45, labelsize=10)

    ax.tick_params(axis='y', labelsize=10)
    ax.grid(True, linestyle='--', alpha=0.7)

    # Aggiungi l'interattività con mplcursors
    # Modifica qui per formattare il testo della nota con textwrap
    cursor = mplcursors.cursor(line, hover=False)

    @cursor.connect("add")
    def on_add(sel):
        index = int(sel.index)
        sel.annotation.set_text(
            f"Data: {dates[index]}\n"
            f"Soddisfazione: {scores[index]}\n"
            f"Nota: {textwrap.fill(notes[index], width=40)}"
        )

    
    plt.tight_layout()
    plt.show()

def main():
    data = load_data()
    print("📓 Habit Tracker - Diario giornaliero\n")
    
    if input("Vuoi aggiungere nuove abitudini? (s/n): ").strip().lower() == "s":
        add_habits(data)

    if not data["habits"]:
        print("⚠️ Nessuna abitudine da tracciare. Aggiungine una prima di continuare.")
        return

    track_today(data)
    show_summary(data)
    save_data(data) # Salva dopo ogni operazione per garantire che i dati più recenti siano disponibili

    # Visualizza entrambi i grafici
    plot_progress(data)
    plot_satisfaction(data)

if __name__ == "__main__":
    main()