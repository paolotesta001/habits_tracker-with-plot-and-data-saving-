const CACHE_NAME = "habit-tracker-v21";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
];

const DB_NAME = "HabitTrackerDB";
const DB_VERSION = 1;
const DB_STORE = "appdata";

function swOpenDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(DB_STORE);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function swIDBGet(db, key) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function swIDBPut(db, key, value) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function checkReminder() {
    try {
        const db = await swOpenDB();
        const config = await swIDBGet(db, "habit_reminder");
        if (!config || !config.enabled) return;

        const now = new Date();
        const [h, m] = config.time.split(":").map(Number);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const targetMinutes = h * 60 + m;
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        if (nowMinutes >= targetMinutes && config.lastNotified !== todayKey) {
            config.lastNotified = todayKey;
            await swIDBPut(db, "habit_reminder", config);
            await self.registration.showNotification("Habit Tracker", {
                body: "Time to log your habits!",
                icon: "./icons/icon-192.png",
                badge: "./icons/icon-192.png",
                tag: "habit-reminder",
                renotify: true,
            });
        }
        db.close();
    } catch (err) {
        // silently fail - don't break fetch handling
    }
}

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Check reminder whenever the SW wakes up for any reason
self.addEventListener("message", (e) => {
    if (e.data && e.data.type === "REMINDER_UPDATED") {
        checkReminder();
    }
});

// Check reminder on every fetch event (SW wakes up for network requests)
self.addEventListener("fetch", (e) => {
    const url = e.request.url;

    // Check reminder in the background on every fetch
    checkReminder();

    if (!url.startsWith("http")) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                return response;
            })
            .catch(() => caches.match(e.request))
    );
});

self.addEventListener("notificationclick", (e) => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: "window" }).then((windowClients) => {
            if (windowClients.length > 0) {
                windowClients[0].focus();
            } else {
                clients.openWindow("./");
            }
        })
    );
});

// Periodic Background Sync (Chrome Android for installed PWAs)
self.addEventListener("periodicsync", (e) => {
    if (e.tag === "habit-reminder-sync") {
        e.waitUntil(checkReminder());
    }
});
