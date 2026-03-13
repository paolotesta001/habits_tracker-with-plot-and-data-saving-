// ============================================================
// THEME TOGGLE
// ============================================================
const themeToggle = document.getElementById("theme-toggle");
if (localStorage.getItem("theme") === "light") {
    document.documentElement.classList.add("light");
    themeToggle.innerHTML = "&#9728;"; // sun
}
themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("light");
    const isLight = document.documentElement.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeToggle.innerHTML = isLight ? "&#9728;" : "&#9790;"; // sun or moon
    document.querySelector('meta[name="theme-color"]').content = isLight ? "#ffffff" : "#1a1a2e";
});

// ============================================================
// DATA LAYER (IndexedDB)
// ============================================================
const DB_NAME = "HabitTrackerDB";
const DB_VERSION = 1;
const DB_STORE = "appdata";
const DB_KEY = "habit_tracker_data";
const LS_KEY = "habit_tracker_data"; // for migration

let idb = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (idb) return resolve(idb);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(DB_STORE);
        };
        req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
        req.onerror = (e) => reject(e.target.error);
    });
}

function idbGet(key) {
    return new Promise((resolve, reject) => {
        const req = idb.transaction(DB_STORE).objectStore(DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(key, value) {
    return new Promise((resolve, reject) => {
        const req = idb.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

const DEFAULT_CATEGORIES = {
    health: ["brush your teeth", "basal insulin", "eat healthy", "knee supplement"],
    learning: ["read", "reverso", "self-study", "podcast"],
    lifestyle: ["movie", "wake up at 7", "scheduling tomorrow", "No bad habits"],
};

function emptyData() {
    return {
        habits: {},
        records: {},
        satisfaction_scores: {},
        daily_notes: {},
        categories: { ...DEFAULT_CATEGORIES },
    };
}

function normalizeData(d) {
    d.habits = d.habits || {};
    d.records = d.records || {};
    d.satisfaction_scores = d.satisfaction_scores || {};
    d.daily_notes = d.daily_notes || {};
    d.categories = d.categories || { ...DEFAULT_CATEGORIES };
    for (const h in d.habits) {
        if (d.habits[h].active === undefined) d.habits[h].active = true;
    }
    return d;
}

async function loadData() {
    await openDB();
    // Try IndexedDB first
    let d = await idbGet(DB_KEY);
    if (d) return normalizeData(d);
    // Migrate from localStorage if exists
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
        try {
            d = normalizeData(JSON.parse(raw));
            await idbPut(DB_KEY, d);
            localStorage.removeItem(LS_KEY); // clean up old storage
            return d;
        } catch { /* fall through */ }
    }
    return emptyData();
}

async function saveData() {
    await idbPut(DB_KEY, data);
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function dateStr(d) {
    return d.toISOString().slice(0, 10);
}

function getActiveHabits() {
    return Object.keys(data.habits).filter(h => data.habits[h].active);
}

function getCategory(habit) {
    for (const cat in data.categories) {
        if (data.categories[cat].includes(habit)) return cat;
    }
    return "other";
}

function getHabitsByCategory(activeOnly = true) {
    const habits = activeOnly
        ? getActiveHabits()
        : Object.keys(data.habits);
    const grouped = {};
    for (const h of habits) {
        const cat = getCategory(h);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(h);
    }
    return grouped;
}

// ============================================================
// GLOBALS
// ============================================================
let data = emptyData();
let historyWeekOffset = 0;
let monthlyOffset = 0;

// ============================================================
// NAVIGATION
// ============================================================
const navBtns = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view");

navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.view;
        navBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        views.forEach(v => v.classList.remove("active"));
        document.getElementById("view-" + target).classList.add("active");

        if (target === "today") renderToday();
        if (target === "history") renderHistory();
        if (target === "stats") renderStats();
        if (target === "settings") renderSettings();
    });
});

// ============================================================
// TODAY VIEW
// ============================================================
const todayHabits = document.getElementById("today-habits");
const todayStatus = document.getElementById("today-status");
const todaySatisfaction = document.getElementById("today-satisfaction");
const todayNote = document.getElementById("today-note");
const saveBtn = document.getElementById("save-today");
const slider = document.getElementById("satisfaction-slider");
const sliderVal = document.getElementById("satisfaction-value");
const noteInput = document.getElementById("note-input");

let todayChecks = {};
let todayChecksDate = "";
let todayEditing = false;

function renderToday() {
    const today = todayStr();
    const active = getActiveHabits();
    document.getElementById("header-date").textContent = today;

    if (active.length === 0) {
        todayHabits.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">No active habits. Add some in Settings.</p>';
        todayStatus.innerHTML = "";
        todaySatisfaction.classList.add("hidden");
        todayNote.classList.add("hidden");
        saveBtn.classList.add("hidden");
        return;
    }

    // Only reset todayChecks when the date changes or on first load
    const existing = data.records[today];
    if (todayChecksDate !== today) {
        todayChecksDate = today;
        if (existing) {
            todayChecks = { ...existing };
        } else {
            todayChecks = {};
            active.forEach(h => todayChecks[h] = false);
        }
    }

    // COMPACT MODE: already saved today and not editing
    if (existing && !todayEditing) {
        const doneCount = active.filter(h => existing[h]).length;
        const totalCount = active.length;
        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        const summaryColor = pct === 100 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";

        todayStatus.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:1.3rem;font-weight:700;">${doneCount}/${totalCount} <span style="color:${summaryColor}">${pct}%</span></div>
                    <div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px;">${today}</div>
                </div>
                <button id="today-edit-btn" class="btn-secondary" style="padding:8px 18px;font-size:0.85rem;">Edit</button>
            </div>
            <div style="height:6px;border-radius:3px;background:var(--surface);overflow:hidden;margin-top:10px;">
                <div style="width:${pct}%;height:100%;background:${summaryColor};border-radius:3px;transition:width 0.3s;"></div>
            </div>
        `;
        todayStatus.style.background = "var(--surface2)";

        todayHabits.innerHTML = "";
        todaySatisfaction.classList.add("hidden");
        todayNote.classList.add("hidden");
        saveBtn.classList.add("hidden");

        document.getElementById("today-edit-btn").addEventListener("click", () => {
            todayEditing = true;
            renderToday();
        });
        return;
    }

    // EXPANDED MODE: first time today or editing
    todayStatus.innerHTML = "";
    todayStatus.style.background = "none";

    // Render habit checklist grouped by category
    const grouped = {};
    for (const h of active) {
        const cat = getCategory(h);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(h);
    }

    let html = "";
    for (const cat in grouped) {
        html += `<div class="stat-category-title" style="margin:12px 0 6px;font-size:0.7rem;">${cat}</div>`;
        for (const h of grouped[cat]) {
            const done = todayChecks[h] ? "done" : "";
            html += `
                <div class="habit-check ${done}" data-habit="${h}">
                    <div class="checkbox">${todayChecks[h] ? "&#10003;" : ""}</div>
                    <span class="habit-name">${h}</span>
                </div>`;
        }
    }
    todayHabits.innerHTML = html;

    // Click handlers
    todayHabits.querySelectorAll(".habit-check").forEach(el => {
        el.addEventListener("click", () => {
            const h = el.dataset.habit;
            todayChecks[h] = !todayChecks[h];
            renderToday();
        });
    });

    // Show satisfaction + note
    todaySatisfaction.classList.remove("hidden");
    todayNote.classList.remove("hidden");
    saveBtn.classList.remove("hidden");

    if (data.satisfaction_scores[today]) {
        slider.value = data.satisfaction_scores[today];
        sliderVal.textContent = data.satisfaction_scores[today];
    }
    if (data.daily_notes[today]) {
        noteInput.value = data.daily_notes[today];
    }
}

slider.addEventListener("input", () => {
    sliderVal.textContent = slider.value;
});

saveBtn.addEventListener("click", async () => {
    const today = todayStr();
    data.records[today] = { ...todayChecks };
    data.satisfaction_scores[today] = parseInt(slider.value);
    data.daily_notes[today] = noteInput.value.trim();
    await saveData();
    todayEditing = false;
    todayStatus.innerHTML = '<div style="font-size:1rem;font-weight:600;color:var(--green);">Saved!</div>';
    todayStatus.style.background = "rgba(78,204,163,0.15)";
    todayHabits.innerHTML = "";
    todaySatisfaction.classList.add("hidden");
    todayNote.classList.add("hidden");
    saveBtn.classList.add("hidden");
    setTimeout(() => {
        renderToday();
    }, 1200);
});

// ============================================================
// HISTORY VIEW
// ============================================================
function renderHistory() {
    const active = getActiveHabits();
    if (active.length === 0) {
        document.getElementById("weekly-grid").innerHTML = '<p style="color:var(--text-dim)">No habits to show.</p>';
        return;
    }

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 - historyWeekOffset * 7); // Monday

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(d);
    }

    const label = `${dateStr(weekDates[0])} to ${dateStr(weekDates[6])}`;
    document.getElementById("history-week-label").textContent = label;

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let html = '<table class="grid-table"><thead><tr><th>Habit</th>';
    weekDates.forEach((d, i) => {
        const ds = dateStr(d);
        const clickable = ds <= todayStr() ? `class="day-header clickable" data-date="${ds}"` : "";
        html += `<th ${clickable} style="${ds <= todayStr() ? 'cursor:pointer;' : ''}">${dayNames[i]}<br>${d.getDate()}</th>`;
    });
    html += "</tr></thead><tbody>";

    for (const h of active) {
        html += `<tr><td>${h}</td>`;
        for (const d of weekDates) {
            const ds = dateStr(d);
            const rec = data.records[ds];
            const clickAttr = ds <= todayStr() ? `class="day-cell clickable" data-date="${ds}" style="cursor:pointer;"` : "";
            if (rec && h in rec) {
                html += rec[h]
                    ? `<td ${clickAttr}><span class="mark-y-inner">&#10003;</span></td>`
                    : `<td ${clickAttr}><span class="mark-n-inner">&ndash;</span></td>`;
            } else {
                html += `<td ${clickAttr}><span class="mark-empty-inner">&middot;</span></td>`;
            }
        }
        html += "</tr>";
    }
    html += "</tbody></table>";
    document.getElementById("weekly-grid").innerHTML = html;

    // Make day headers and cells clickable to open the fill modal
    document.querySelectorAll(".day-header.clickable, .day-cell.clickable").forEach(el => {
        el.addEventListener("click", () => {
            openDayModal(el.dataset.date);
        });
    });
}

document.getElementById("history-prev").addEventListener("click", () => { historyWeekOffset++; renderHistory(); });
document.getElementById("history-next").addEventListener("click", () => { if (historyWeekOffset > 0) historyWeekOffset--; renderHistory(); });

// Fill past day
document.getElementById("fill-past-btn").addEventListener("click", () => {
    const dateInput = document.getElementById("past-date-input").value;
    if (!dateInput) return;
    if (dateInput > todayStr()) { alert("Cannot fill a future date."); return; }
    openDayModal(dateInput);
});

// ============================================================
// MODAL (for filling past days)
// ============================================================
function openDayModal(dayStr) {
    const overlay = document.getElementById("modal-overlay");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");

    title.textContent = `Fill: ${dayStr}`;

    // Habits active on that day
    const habitsForDay = Object.keys(data.habits).filter(h =>
        data.habits[h].created <= dayStr
        && (data.habits[h].active || data.records[dayStr]?.[h] !== undefined)
    );

    const existing = data.records[dayStr] || {};
    const checks = {};
    habitsForDay.forEach(h => checks[h] = existing[h] || false);

    function renderModalBody() {
        let html = "";
        for (const h of habitsForDay) {
            const done = checks[h] ? "done" : "";
            html += `
                <div class="habit-check ${done}" data-habit="${h}">
                    <div class="checkbox">${checks[h] ? "&#10003;" : ""}</div>
                    <span class="habit-name">${h}</span>
                </div>`;
        }

        const sat = data.satisfaction_scores[dayStr] || 50;
        const note = data.daily_notes[dayStr] || "";

        html += `
            <label>Satisfaction (1-100)</label>
            <input type="range" id="modal-sat" min="1" max="100" value="${sat}">
            <div class="modal-sat-value" id="modal-sat-val">${sat}</div>
            <label>Note</label>
            <textarea id="modal-note" rows="3">${note}</textarea>
        `;
        body.innerHTML = html;

        body.querySelectorAll(".habit-check").forEach(el => {
            el.addEventListener("click", () => {
                const h = el.dataset.habit;
                checks[h] = !checks[h];
                renderModalBody();
            });
        });

        const modalSlider = document.getElementById("modal-sat");
        if (modalSlider) {
            modalSlider.addEventListener("input", () => {
                document.getElementById("modal-sat-val").textContent = modalSlider.value;
            });
        }
    }

    renderModalBody();
    overlay.classList.remove("hidden");

    document.getElementById("modal-save").onclick = async () => {
        data.records[dayStr] = { ...checks };
        data.satisfaction_scores[dayStr] = parseInt(document.getElementById("modal-sat").value);
        data.daily_notes[dayStr] = document.getElementById("modal-note").value.trim();
        await saveData();
        overlay.classList.add("hidden");
        renderHistory();
    };
}

document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("hidden");
});

document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.add("hidden");
    }
});

// ============================================================
// STATS VIEW
// ============================================================
const statsTabs = document.querySelectorAll(".stats-tab");
let currentStatsTab = "summary";

statsTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        statsTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentStatsTab = tab.dataset.tab;
        renderStats();
    });
});

function renderStats() {
    const content = document.getElementById("stats-content");
    switch (currentStatsTab) {
        case "summary": content.innerHTML = renderSummary(); break;
        case "streaks": content.innerHTML = renderStreaks(); break;
        case "monthly": content.innerHTML = renderMonthly(); break;
        case "insights": content.innerHTML = renderInsights(); break;
        case "progress-plot":
            content.innerHTML = '<canvas id="progress-chart"></canvas>';
            renderProgressChart();
            break;
        case "satisfaction-plot":
            content.innerHTML = '<canvas id="satisfaction-chart"></canvas>';
            renderSatisfactionChart();
            break;
    }

    // Monthly nav listeners
    const prevBtn = document.getElementById("monthly-prev");
    const nextBtn = document.getElementById("monthly-next");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => { monthlyOffset++; renderStats(); });
        nextBtn.addEventListener("click", () => { if (monthlyOffset > 0) monthlyOffset--; renderStats(); });
    }
}

function renderSummary() {
    const grouped = getHabitsByCategory(false);
    let html = "";

    for (const cat in grouped) {
        html += `<div class="stat-category"><div class="stat-category-title">${cat}</div>`;
        for (const habit of grouped[cat]) {
            const meta = data.habits[habit];
            const created = meta.created;
            const isActive = meta.active;

            const relevantDays = Object.keys(data.records).filter(
                d => d >= created && data.records[d][habit] !== undefined
            );
            const done = relevantDays.filter(d => data.records[d][habit]).length;
            const total = relevantDays.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";
            const inactiveLabel = isActive ? "" : '<span class="inactive-label">[inactive]</span>';

            html += `
                <div class="stat-row">
                    <span class="name">${habit}${inactiveLabel}</span>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
                    </div>
                    <span class="pct" style="color:${color}">${total > 0 ? pct + "%" : "\u2014"}</span>
                </div>`;
        }
        html += "</div>";
    }

    return html || '<p style="color:var(--text-dim)">No data yet.</p>';
}

function renderStreaks() {
    const active = getActiveHabits();
    const allDates = Object.keys(data.records).sort();

    if (active.length === 0 || allDates.length === 0) {
        return '<p style="color:var(--text-dim)">No data yet.</p>';
    }

    let html = "";
    for (const habit of active) {
        const created = data.habits[habit].created;
        const habitDates = allDates.filter(d => d >= created && data.records[d][habit] !== undefined);
        if (habitDates.length === 0) continue;

        let currentStreak = 0;
        for (let i = habitDates.length - 1; i >= 0; i--) {
            if (data.records[habitDates[i]][habit]) currentStreak++;
            else break;
        }

        let bestStreak = 0, streak = 0;
        for (const d of habitDates) {
            if (data.records[d][habit]) { streak++; bestStreak = Math.max(bestStreak, streak); }
            else streak = 0;
        }

        html += `
            <div class="streak-row">
                <span>${habit}</span>
                <span>
                    <span class="streak-current">${currentStreak}d current</span>
                    &nbsp;/&nbsp;
                    <span class="streak-best">${bestStreak}d best</span>
                </span>
            </div>`;
    }

    return html || '<p style="color:var(--text-dim)">No data yet.</p>';
}

function renderMonthly() {
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthlyOffset, 1);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthName = targetMonth.toLocaleDateString("en", { year: "numeric", month: "long" });

    const monthDates = Object.keys(data.records).filter(d => d.startsWith(monthStr)).sort();

    let html = `
        <div class="monthly-nav">
            <button class="btn-icon" id="monthly-prev">&larr;</button>
            <strong>${monthName}</strong>
            <button class="btn-icon" id="monthly-next">&rarr;</button>
        </div>`;

    if (monthDates.length === 0) {
        return html + '<p style="color:var(--text-dim);text-align:center;">No data for this month.</p>';
    }

    html += `<p style="color:var(--text-dim);font-size:0.85rem;">${monthDates.length} days tracked</p>`;

    // Per-habit completion
    const grouped = getHabitsByCategory();
    for (const cat in grouped) {
        html += `<div class="stat-category"><div class="stat-category-title">${cat}</div>`;
        for (const habit of grouped[cat]) {
            const daysWithHabit = monthDates.filter(d => data.records[d][habit] !== undefined);
            if (daysWithHabit.length === 0) continue;
            const done = daysWithHabit.filter(d => data.records[d][habit]).length;
            const total = daysWithHabit.length;
            const pct = Math.round((done / total) * 100);
            const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";

            html += `
                <div class="stat-row">
                    <span class="name">${habit}</span>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
                    </div>
                    <span class="pct" style="color:${color}">${done}/${total}</span>
                </div>`;
        }
        html += "</div>";
    }

    // Satisfaction
    const scores = monthDates.filter(d => data.satisfaction_scores[d]).map(d => data.satisfaction_scores[d]);
    if (scores.length > 0) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const best = Math.max(...scores);
        const worst = Math.min(...scores);
        const bestDay = monthDates.find(d => data.satisfaction_scores[d] === best);
        const worstDay = monthDates.find(d => data.satisfaction_scores[d] === worst);

        html += `
            <div class="satisfaction-summary">
                <div style="text-align:center;">
                    <div class="big-number">${avg}</div>
                    <div style="color:var(--text-dim);font-size:0.8rem;">avg satisfaction</div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:0.85rem;">
                    <span>Best: ${bestDay} (${best})</span>
                    <span>Worst: ${worstDay} (${worst})</span>
                </div>
            </div>`;

        // Compare with previous month
        const prevTarget = new Date(year, month - 1, 1);
        const prevStr = `${prevTarget.getFullYear()}-${String(prevTarget.getMonth() + 1).padStart(2, "0")}`;
        const prevDates = Object.keys(data.records).filter(d => d.startsWith(prevStr));
        const prevScores = prevDates.filter(d => data.satisfaction_scores[d]).map(d => data.satisfaction_scores[d]);

        if (prevScores.length > 0) {
            const prevAvg = Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length);
            const diff = avg - prevAvg;
            const cls = diff > 0 ? "insight-positive" : diff < 0 ? "insight-negative" : "";
            const arrow = diff > 0 ? "&#9650;" : diff < 0 ? "&#9660;" : "=";
            html += `<p class="${cls}" style="margin-top:8px;font-size:0.85rem;">${arrow} ${Math.abs(diff)} points vs previous month (${prevAvg})</p>`;
        }
    }

    return html;
}

function renderInsights() {
    const validDays = Object.keys(data.records).filter(d => data.satisfaction_scores[d]);
    const active = getActiveHabits();

    if (validDays.length < 5) {
        return '<p style="color:var(--text-dim)">Need at least 5 days of data for insights.</p>';
    }

    let html = "";

    // All habits done vs not
    const perfectDays = [];
    const imperfectDays = [];
    for (const d of validDays) {
        const tracked = active.filter(h => data.records[d][h] !== undefined);
        if (tracked.length === 0) continue;
        const allDone = tracked.every(h => data.records[d][h]);
        (allDone ? perfectDays : imperfectDays).push(d);
    }

    if (perfectDays.length > 0 && imperfectDays.length > 0) {
        const avgPerfect = Math.round(perfectDays.reduce((s, d) => s + data.satisfaction_scores[d], 0) / perfectDays.length);
        const avgImperfect = Math.round(imperfectDays.reduce((s, d) => s + data.satisfaction_scores[d], 0) / imperfectDays.length);
        const diff = avgPerfect - avgImperfect;
        const cls = diff > 0 ? "insight-positive" : "insight-negative";

        html += `
            <div class="insight-block">
                <h4>Overall</h4>
                <div class="insight-row">
                    <span>All habits done (${perfectDays.length}d)</span>
                    <span class="insight-positive">${avgPerfect}</span>
                </div>
                <div class="insight-row">
                    <span>Some missed (${imperfectDays.length}d)</span>
                    <span class="insight-negative">${avgImperfect}</span>
                </div>
                <div class="insight-row">
                    <span>Difference</span>
                    <span class="${cls}">${diff > 0 ? "+" : ""}${diff} points</span>
                </div>
            </div>`;
    }

    // Per-habit impact
    const impacts = [];
    for (const habit of active) {
        const doneDays = validDays.filter(d => data.records[d][habit] === true);
        const skipDays = validDays.filter(d => data.records[d][habit] === false);

        if (doneDays.length >= 2 && skipDays.length >= 2) {
            const avgDone = Math.round(doneDays.reduce((s, d) => s + data.satisfaction_scores[d], 0) / doneDays.length);
            const avgSkip = Math.round(skipDays.reduce((s, d) => s + data.satisfaction_scores[d], 0) / skipDays.length);
            impacts.push({ habit, impact: avgDone - avgSkip, avgDone, avgSkip, nDone: doneDays.length, nSkip: skipDays.length });
        }
    }

    impacts.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    if (impacts.length > 0) {
        html += '<div class="insight-block"><h4>Per-habit impact on satisfaction</h4>';
        for (const { habit, impact, avgDone, avgSkip, nDone, nSkip } of impacts) {
            const cls = impact > 0 ? "insight-positive" : "insight-negative";
            html += `
                <div class="insight-row">
                    <span>${habit}</span>
                    <span class="${cls}">${impact > 0 ? "+" : ""}${impact}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:4px;">
                    done=${avgDone} (${nDone}d) / skipped=${avgSkip} (${nSkip}d)
                </div>`;
        }
        html += "</div>";
    }

    // Per-category impact
    let catHtml = "";
    for (const cat in data.categories) {
        const catActive = data.categories[cat].filter(h => active.includes(h));
        if (catActive.length === 0) continue;

        const doneScores = [];
        const skipScores = [];
        for (const d of validDays) {
            const tracked = catActive.filter(h => data.records[d][h] !== undefined);
            if (tracked.length === 0) continue;
            const allDone = tracked.every(h => data.records[d][h]);
            (allDone ? doneScores : skipScores).push(data.satisfaction_scores[d]);
        }

        if (doneScores.length >= 2 && skipScores.length >= 2) {
            const avgD = Math.round(doneScores.reduce((a, b) => a + b, 0) / doneScores.length);
            const avgS = Math.round(skipScores.reduce((a, b) => a + b, 0) / skipScores.length);
            const diff = avgD - avgS;
            const cls = diff > 0 ? "insight-positive" : "insight-negative";
            catHtml += `
                <div class="insight-row">
                    <span>[${cat}]</span>
                    <span class="${cls}">${diff > 0 ? "+" : ""}${diff} pts (done=${avgD}, missed=${avgS})</span>
                </div>`;
        }
    }

    if (catHtml) {
        html += `<div class="insight-block"><h4>Per-category impact</h4>${catHtml}</div>`;
    }

    return html || '<p style="color:var(--text-dim)">Not enough data variation for insights.</p>';
}

// ============================================================
// SETTINGS VIEW
// ============================================================
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsPanels = document.querySelectorAll(".settings-panel");

settingsTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        settingsTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        settingsPanels.forEach(p => p.classList.remove("active"));
        document.getElementById("stab-" + tab.dataset.stab).classList.add("active");
    });
});

function renderSettings() {
    const list = document.getElementById("habits-list");
    const grouped = getHabitsByCategory(false);
    let html = "";

    for (const cat in grouped) {
        html += `<div class="stat-category-title" style="margin:8px 0 4px;">${cat}</div>`;
        for (const h of grouped[cat]) {
            const meta = data.habits[h];
            const inactiveBadge = meta.active ? "" : '<span class="inactive-badge">inactive</span>';
            const toggleLabel = meta.active ? "&#10005;" : "&#10003;";
            const toggleTitle = meta.active ? "Deactivate" : "Reactivate";

            const esc = h.replace(/'/g, "\\'");
            html += `
                <div class="habit-item">
                    <div class="habit-info">
                        <div class="name">${h}${inactiveBadge}</div>
                        <div class="cat">${cat} &middot; since ${meta.created}</div>
                    </div>
                    <div class="habit-actions">
                        <button title="Rename" onclick="renameHabit('${esc}')">&#9998;</button>
                        <button title="${toggleTitle}" onclick="toggleHabit('${esc}')">${toggleLabel}</button>
                        <button title="Delete" onclick="deleteHabit('${esc}')" style="color:var(--red);">&#128465;</button>
                    </div>
                </div>`;
        }
    }

    list.innerHTML = html || '<p style="color:var(--text-dim)">No habits yet.</p>';
}

window.toggleHabit = async function(name) {
    data.habits[name].active = !data.habits[name].active;
    await saveData();
    renderSettings();
};

window.renameHabit = async function(oldName) {
    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    if (data.habits[trimmed]) { alert("A habit with that name already exists."); return; }

    // Copy habit metadata
    data.habits[trimmed] = { ...data.habits[oldName] };
    delete data.habits[oldName];

    // Update all records
    for (const d in data.records) {
        if (oldName in data.records[d]) {
            data.records[d][trimmed] = data.records[d][oldName];
            delete data.records[d][oldName];
        }
    }

    // Update categories
    for (const cat in data.categories) {
        const idx = data.categories[cat].indexOf(oldName);
        if (idx !== -1) data.categories[cat][idx] = trimmed;
    }

    await saveData();
    todayChecksDate = ""; // force refresh
    renderSettings();
};

window.deleteHabit = async function(name) {
    if (!confirm(`Delete "${name}" and all its history?\n\nThis cannot be undone.`)) return;

    delete data.habits[name];

    // Remove from all records
    for (const d in data.records) {
        delete data.records[d][name];
    }

    // Remove from categories
    for (const cat in data.categories) {
        data.categories[cat] = data.categories[cat].filter(h => h !== name);
    }

    await saveData();
    todayChecksDate = ""; // force refresh
    renderSettings();
};

document.getElementById("add-habit-btn").addEventListener("click", async () => {
    const input = document.getElementById("new-habit-input");
    const catSelect = document.getElementById("new-habit-category");
    const name = input.value.trim();
    if (!name) return;

    if (data.habits[name]) {
        if (!data.habits[name].active) {
            data.habits[name].active = true;
            await saveData();
            renderSettings();
        } else {
            alert("Habit already exists.");
        }
        input.value = "";
        return;
    }

    data.habits[name] = { created: todayStr(), active: true };

    // Add to category
    const cat = catSelect.value;
    if (cat !== "other") {
        if (!data.categories[cat]) data.categories[cat] = [];
        data.categories[cat].push(name);
    }

    await saveData();
    input.value = "";
    renderSettings();
});

// ============================================================
// IMPORT / EXPORT
// ============================================================
document.getElementById("export-json-btn").addEventListener("click", () => {
    downloadFile("habit_tracker_export.json", JSON.stringify(data, null, 2), "application/json");
});

document.getElementById("export-csv-btn").addEventListener("click", () => {
    const allHabits = Object.keys(data.habits);
    const allDates = Object.keys(data.records).sort();
    let csv = ["date," + allHabits.map(csvEscape).join(",") + ",satisfaction,note"];

    for (const d of allDates) {
        let row = [d];
        for (const h of allHabits) {
            const v = data.records[d]?.[h];
            row.push(v === true ? "yes" : v === false ? "no" : "");
        }
        row.push(data.satisfaction_scores[d] || "");
        row.push(csvEscape(data.daily_notes[d] || ""));
        csv.push(row.join(","));
    }
    downloadFile("habit_tracker_export.csv", csv.join("\n"), "text/csv");
});

document.getElementById("import-json-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (imported.habits && imported.records) {
                data = imported;
                data.categories = data.categories || { ...DEFAULT_CATEGORIES };
                await saveData();
                alert("Data imported successfully!");
                renderToday();
            } else {
                alert("Invalid file format.");
            }
        } catch { alert("Could not parse JSON file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
});

// Import from Python version (habit_tracker.json format)
document.getElementById("import-python-btn").addEventListener("click", () => {
    document.getElementById("import-python-file").click();
});

document.getElementById("import-python-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const py = JSON.parse(ev.target.result);
            if (py.habits && py.records) {
                data.habits = py.habits;
                data.records = py.records;
                data.satisfaction_scores = py.satisfaction_scores || {};
                data.daily_notes = py.daily_notes || {};
                // Ensure active key
                for (const h in data.habits) {
                    if (data.habits[h].active === undefined) data.habits[h].active = true;
                }
                await saveData();
                alert("Python data imported! Your history is now in the web app.");
                renderToday();
            } else {
                alert("Invalid Python habit tracker file.");
            }
        } catch { alert("Could not parse file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
});

// Reset all data
document.getElementById("reset-all-btn").addEventListener("click", async () => {
    const wantSave = confirm("Do you want to export your data before resetting?\n\nClick OK to download a backup first, or Cancel to skip.");
    if (wantSave) {
        downloadFile("habit_tracker_backup.json", JSON.stringify(data, null, 2), "application/json");
    }

    const sure = confirm("Are you sure you want to delete ALL habits and data?\n\nThis cannot be undone.");
    if (!sure) return;

    data = emptyData();
    await saveData();
    todayChecksDate = "";
    todayEditing = false;
    renderToday();
    renderSettings();
    alert("All data has been reset.");
});

function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

function csvEscape(str) {
    if (typeof str !== "string") return str;
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// ============================================================
// CHARTS
// ============================================================
const CHART_COLORS = [
    "#4ecda3","#f5a623","#e74c3c","#9b59b6","#3498db",
    "#e67e22","#1abc9c","#e84393","#636e72","#fdcb6e",
    "#00cec9","#6c5ce7","#d63031","#0984e3","#fab1a0",
];

let progressChartInstance = null;
let satisfactionChartInstance = null;

function renderProgressChart() {
    const canvas = document.getElementById("progress-chart");
    if (!canvas) return;
    if (typeof Chart === "undefined") {
        canvas.parentElement.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">Chart library loading... Please try again.</p>';
        return;
    }

    const allDates = Object.keys(data.records).sort();
    const habits = Object.keys(data.habits);

    if (allDates.length === 0 || habits.length === 0) {
        canvas.parentElement.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">No data to display.</p>';
        return;
    }

    const datasets = [];
    habits.forEach((habit, i) => {
        const created = data.habits[habit].created;
        let cumulative = 0;
        const points = [];
        for (const d of allDates) {
            if (d < created) continue;
            if (data.records[d]?.[habit]) cumulative++;
            points.push({ x: d, y: cumulative });
        }
        if (points.length > 0) {
            datasets.push({
                label: habit,
                data: points,
                borderColor: CHART_COLORS[i % CHART_COLORS.length],
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                borderWidth: 2,
                pointRadius: allDates.length > 30 ? 1 : 3,
                tension: 0.1,
                fill: false,
            });
        }
    });

    const isLight = document.documentElement.classList.contains("light");
    const textColor = isLight ? "#333" : "#ccc";
    const gridColor = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";

    if (progressChartInstance) progressChartInstance.destroy();
    progressChartInstance = new Chart(canvas, {
        type: "line",
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: { display: true, text: "Cumulative trend of habits", color: textColor, font: { size: 16 } },
                legend: {
                    labels: { color: textColor, font: { size: 11 } },
                    onClick: (e, legendItem, legend) => {
                        const chart = legend.chart;
                        const ci = legendItem.datasetIndex;
                        const allVisible = chart.data.datasets.every((ds, i) => !chart.getDatasetMeta(i).hidden);
                        const onlyThisVisible = chart.data.datasets.every((ds, i) =>
                            i === ci ? !chart.getDatasetMeta(i).hidden : chart.getDatasetMeta(i).hidden
                        );
                        if (onlyThisVisible) {
                            // Click again on the solo habit → show all
                            chart.data.datasets.forEach((ds, i) => { chart.getDatasetMeta(i).hidden = false; });
                        } else {
                            // Show only the clicked habit
                            chart.data.datasets.forEach((ds, i) => { chart.getDatasetMeta(i).hidden = i !== ci; });
                        }
                        chart.update();
                    },
                },
            },
            scales: {
                x: {
                    type: "category",
                    labels: allDates,
                    ticks: { color: textColor, maxRotation: 45, maxTicksLimit: 15 },
                    grid: { color: gridColor },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: gridColor },
                    title: { display: true, text: "Cumulative completions", color: textColor },
                },
            },
        },
    });
}

function renderSatisfactionChart() {
    const canvas = document.getElementById("satisfaction-chart");
    if (!canvas) return;
    if (typeof Chart === "undefined") {
        canvas.parentElement.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">Chart library loading... Please try again.</p>';
        return;
    }

    const dates = Object.keys(data.satisfaction_scores).sort();
    const scores = dates.map(d => data.satisfaction_scores[d]);

    if (dates.length === 0) {
        canvas.parentElement.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">No satisfaction data to display.</p>';
        return;
    }

    const isLight = document.documentElement.classList.contains("light");
    const textColor = isLight ? "#333" : "#ccc";
    const gridColor = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";

    if (satisfactionChartInstance) satisfactionChartInstance.destroy();
    satisfactionChartInstance = new Chart(canvas, {
        type: "line",
        data: {
            labels: dates,
            datasets: [{
                label: "Satisfaction",
                data: scores,
                borderColor: "#9b59b6",
                backgroundColor: "rgba(155,89,182,0.15)",
                borderWidth: 2,
                pointRadius: dates.length > 30 ? 2 : 4,
                pointBackgroundColor: "#9b59b6",
                tension: 0.1,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: { display: true, text: "Daily Satisfaction Score Trend", color: textColor, font: { size: 16 } },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterLabel: (ctx) => {
                            const d = dates[ctx.dataIndex];
                            const note = data.daily_notes[d];
                            return note ? `Note: ${note}` : "";
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxRotation: 45, maxTicksLimit: 15 },
                    grid: { color: gridColor },
                },
                y: {
                    min: 0, max: 100,
                    ticks: { color: textColor },
                    grid: { color: gridColor },
                    title: { display: true, text: "Satisfaction Score (1-100)", color: textColor },
                },
            },
        },
    });
}

// ============================================================
// REMINDERS
// ============================================================
const reminderTimeInput = document.getElementById("reminder-time");
const reminderEnableBtn = document.getElementById("reminder-enable-btn");
const reminderDisableBtn = document.getElementById("reminder-disable-btn");
const reminderStatus = document.getElementById("reminder-status");
let reminderInterval = null;

function showNotification(title, body) {
    // Use service worker notification (works on mobile + background)
    if (navigator.serviceWorker) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
                body,
                icon: "./icons/icon-192.png",
                badge: "./icons/icon-192.png",
                tag: "habit-reminder",
                renotify: true,
            });
        });
    } else if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "./icons/icon-192.png" });
    }
}

function loadReminder() {
    const saved = localStorage.getItem("habit_reminder");
    if (saved) {
        const { time, enabled } = JSON.parse(saved);
        reminderTimeInput.value = time;
        if (enabled) {
            reminderEnableBtn.classList.add("hidden");
            reminderDisableBtn.classList.remove("hidden");
            reminderStatus.textContent = `Reminder active at ${time} daily`;
            startReminderCheck(time);
        }
    }
}

function checkAndNotify(time) {
    const now = new Date();
    const [h, m] = time.split(":").map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = h * 60 + m;
    // Fire if we're within 2 minutes past the target (catches missed exact checks)
    if (nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + 2) {
        const tk = todayStr();
        if (localStorage.getItem("habit_reminder_last") !== tk) {
            localStorage.setItem("habit_reminder_last", tk);
            showNotification("Habit Tracker", "Time to log your habits!");
        }
    }
}

function startReminderCheck(time) {
    if (reminderInterval) clearInterval(reminderInterval);
    // Check immediately in case we just opened the app past the reminder time
    checkAndNotify(time);
    // Check every 30 seconds
    reminderInterval = setInterval(() => checkAndNotify(time), 30000);
}

// When app comes back to foreground, check immediately
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        const saved = localStorage.getItem("habit_reminder");
        if (saved) {
            const { time, enabled } = JSON.parse(saved);
            if (enabled) checkAndNotify(time);
        }
    }
});

reminderEnableBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) {
        alert("Your browser does not support notifications.");
        return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
        alert("Notification permission denied. Please allow notifications in your browser settings.");
        return;
    }
    const time = reminderTimeInput.value;
    localStorage.setItem("habit_reminder", JSON.stringify({ time, enabled: true }));
    reminderEnableBtn.classList.add("hidden");
    reminderDisableBtn.classList.remove("hidden");
    reminderStatus.textContent = `Reminder active at ${time} daily`;
    startReminderCheck(time);
    // Show a test notification via service worker
    showNotification("Habit Tracker", `Reminder set for ${time} daily!`);
});

reminderDisableBtn.addEventListener("click", () => {
    localStorage.setItem("habit_reminder", JSON.stringify({ time: reminderTimeInput.value, enabled: false }));
    if (reminderInterval) clearInterval(reminderInterval);
    reminderEnableBtn.classList.remove("hidden");
    reminderDisableBtn.classList.add("hidden");
    reminderStatus.textContent = "Reminder disabled";
});

// ============================================================
// SERVICE WORKER
// ============================================================
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
}

// ============================================================
// INIT
// ============================================================
(async () => {
    data = await loadData();
    document.getElementById("header-date").textContent = todayStr();
    renderToday();
    loadReminder();
})();
