const CACHE_NAME = "habit-tracker-v19";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
];

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

// Handle scheduled reminder notifications
self.addEventListener("message", (e) => {
    if (e.data && e.data.type === "SCHEDULE_REMINDER") {
        const { delayMs, todayKey } = e.data;
        setTimeout(() => {
            self.registration.showNotification("Habit Tracker", {
                body: "Time to log your habits!",
                icon: "./icons/icon-192.png",
                badge: "./icons/icon-192.png",
                tag: "habit-reminder-" + todayKey,
                renotify: true,
            });
        }, delayMs);
    }
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

self.addEventListener("fetch", (e) => {
    const url = e.request.url;

    // Never cache non-http(s) requests
    if (!url.startsWith("http")) {
        return;
    }

    // For app assets: network first, fall back to cache
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
