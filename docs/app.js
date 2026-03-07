// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = "https://jkgwzgxhceqrizgdkviz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZ3d6Z3hoY2Vxcml6Z2Rrdml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTc1ODIsImV4cCI6MjA4ODM3MzU4Mn0.8uoSethDKgANr3A-LHWuj6JCLvMyqfxCm9q-QzWntjU";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        storageKey: "habit-tracker-auth",
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: { acquireTimeout: 10000 },
    }
});

// ============================================================
// AUTH
// ============================================================
const authScreen = document.getElementById("auth-screen");
const appEl = document.getElementById("app");
const authMessage = document.getElementById("auth-message");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authLoginBtn = document.getElementById("auth-login-btn");
const authSignupBtn = document.getElementById("auth-signup-btn");
const logoutBtn = document.getElementById("logout-btn");

let currentUser = null;
let appInitialized = false;

function showAuth() {
    authScreen.classList.remove("hidden");
    appEl.classList.add("hidden");
    authMessage.textContent = "";
    authMessage.className = "";
}

function showApp() {
    authScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
}

authLoginBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) { authMessage.textContent = "Fill in both fields."; return; }

    authMessage.textContent = "Logging in...";
    authMessage.className = "";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        authMessage.textContent = error.message;
        authMessage.className = "auth-error";
    }
});

authSignupBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) { authMessage.textContent = "Fill in both fields."; return; }
    if (password.length < 6) { authMessage.textContent = "Password must be at least 6 characters."; authMessage.className = "auth-error"; return; }

    authMessage.textContent = "Creating account...";
    authMessage.className = "";
    try {
        const { data: signUpData, error } = await sb.auth.signUp({ email, password });
        if (error) {
            authMessage.textContent = error.message;
            authMessage.className = "auth-error";
        } else if (signUpData?.user?.identities?.length === 0) {
            authMessage.textContent = "Account already exists. Try logging in.";
            authMessage.className = "auth-error";
        } else {
            authMessage.textContent = "Account created! You can now log in.";
            authMessage.className = "auth-success";
        }
    } catch (e) {
        authMessage.textContent = "Error: " + e.message;
        authMessage.className = "auth-error";
    }
});

logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
});

// Listen for auth state changes
sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        currentUser = session.user;
        if (!appInitialized) {
            appInitialized = true;
            try {
                await initApp();
            } catch (e) {
                console.error("initApp failed:", e);
            }
            showApp();
        }
    } else {
        currentUser = null;
        appInitialized = false;
        showAuth();
    }
});

// ============================================================
// DATA LAYER
// ============================================================
const STORAGE_KEY = "habit_tracker_data";

const DEFAULT_CATEGORIES = {
    health: ["brush your teeth", "basal insulin", "eat healthy", "knee supplement"],
    learning: ["read", "reverso", "self-study", "podcast"],
    lifestyle: ["movie", "wake up at 7", "scheduling tomorrow", "No bad habits"],
};

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            data.habits = data.habits || {};
            data.records = data.records || {};
            data.satisfaction_scores = data.satisfaction_scores || {};
            data.daily_notes = data.daily_notes || {};
            data.categories = data.categories || { ...DEFAULT_CATEGORIES };
            for (const h in data.habits) {
                if (data.habits[h].active === undefined) data.habits[h].active = true;
            }
            return data;
        } catch {
            return emptyData();
        }
    }
    return emptyData();
}

function emptyData() {
    return {
        habits: {},
        records: {},
        satisfaction_scores: {},
        daily_notes: {},
        categories: { ...DEFAULT_CATEGORIES },
    };
}

function saveDataLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function saveData() {
    saveDataLocal();
    await syncToCloud();
}

async function syncToCloud() {
    if (!currentUser) return;
    try {
        await sb.from("user_data").upsert({
            id: currentUser.id,
            data: data,
            updated_at: new Date().toISOString(),
        });
    } catch (e) {
        console.warn("Cloud sync failed:", e);
    }
}

async function loadFromCloud() {
    if (!currentUser) return null;
    try {
        const { data: row, error } = await sb
            .from("user_data")
            .select("data, updated_at")
            .eq("id", currentUser.id)
            .single();
        if (error && error.code !== "PGRST116") {
            console.warn("Cloud load error:", error);
            return null;
        }
        return row;
    } catch (e) {
        console.warn("Cloud load failed:", e);
        return null;
    }
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
// APP INIT (after login)
// ============================================================
async function initApp() {
    // Load from cloud, merge with local
    const cloudRow = await loadFromCloud();
    const localData = loadData();

    if (cloudRow && cloudRow.data && Object.keys(cloudRow.data.habits || {}).length > 0) {
        // Cloud has data — use it
        data = cloudRow.data;
        data.habits = data.habits || {};
        data.records = data.records || {};
        data.satisfaction_scores = data.satisfaction_scores || {};
        data.daily_notes = data.daily_notes || {};
        data.categories = data.categories || { ...DEFAULT_CATEGORIES };
        for (const h in data.habits) {
            if (data.habits[h].active === undefined) data.habits[h].active = true;
        }

        // If local has data that cloud doesn't, merge local into cloud
        if (Object.keys(localData.habits).length > 0) {
            let merged = false;
            for (const h in localData.habits) {
                if (!data.habits[h]) {
                    data.habits[h] = localData.habits[h];
                    merged = true;
                }
            }
            for (const d in localData.records) {
                if (!data.records[d]) {
                    data.records[d] = localData.records[d];
                    merged = true;
                }
            }
            for (const d in localData.satisfaction_scores) {
                if (!data.satisfaction_scores[d]) {
                    data.satisfaction_scores[d] = localData.satisfaction_scores[d];
                    merged = true;
                }
            }
            for (const d in localData.daily_notes) {
                if (!data.daily_notes[d]) {
                    data.daily_notes[d] = localData.daily_notes[d];
                    merged = true;
                }
            }
            if (merged) {
                await syncToCloud();
            }
        }
    } else if (Object.keys(localData.habits).length > 0) {
        // No cloud data but local data exists — push local to cloud
        data = localData;
        await syncToCloud();
    } else {
        data = emptyData();
    }

    saveDataLocal();
    document.getElementById("header-date").textContent = todayStr();
    renderToday();
}

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

function renderToday() {
    const today = todayStr();
    const active = getActiveHabits();
    document.getElementById("header-date").textContent = today;

    if (active.length === 0) {
        todayHabits.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:40px 0;">No active habits. Add some in Settings.</p>';
        todayStatus.textContent = "";
        todaySatisfaction.classList.add("hidden");
        todayNote.classList.add("hidden");
        saveBtn.classList.add("hidden");
        return;
    }

    const existing = data.records[today];
    if (existing) {
        todayChecks = { ...existing };
    } else {
        todayChecks = {};
        active.forEach(h => todayChecks[h] = false);
    }

    if (existing) {
        todayStatus.textContent = "You already logged today. Tap to edit.";
        todayStatus.style.background = "var(--surface2)";
    } else {
        todayStatus.textContent = "";
        todayStatus.style.background = "none";
    }

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
    todayStatus.textContent = "Saved!";
    todayStatus.style.background = "rgba(78,204,163,0.15)";
    todayStatus.style.color = "var(--green)";
    setTimeout(() => {
        todayStatus.style.color = "";
        renderToday();
    }, 1500);
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
        html += `<th>${dayNames[i]}<br>${d.getDate()}</th>`;
    });
    html += "</tr></thead><tbody>";

    for (const h of active) {
        html += `<tr><td>${h}</td>`;
        for (const d of weekDates) {
            const ds = dateStr(d);
            const rec = data.records[ds];
            if (rec && h in rec) {
                html += rec[h]
                    ? '<td class="mark-y">&#10003;</td>'
                    : '<td class="mark-n">&ndash;</td>';
            } else {
                html += '<td class="mark-empty">&middot;</td>';
            }
        }
        html += "</tr>";
    }
    html += "</tbody></table>";
    document.getElementById("weekly-grid").innerHTML = html;
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

            html += `
                <div class="habit-item">
                    <div class="habit-info">
                        <div class="name">${h}${inactiveBadge}</div>
                        <div class="cat">${cat} &middot; since ${meta.created}</div>
                    </div>
                    <button title="${toggleTitle}" onclick="toggleHabit('${h.replace(/'/g, "\\'")}')">${toggleLabel}</button>
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
// SERVICE WORKER
// ============================================================
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
}

// ============================================================
// INIT — check if already logged in
// ============================================================
// Handled by onAuthStateChange above; calling getSession() triggers it.
sb.auth.getSession();
