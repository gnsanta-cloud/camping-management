const CACHE_NAME = "camping-pwa-v2";

const PRECACHE = [
  "./",
  "./index.html",
  "./sites.html",
  "./manifest.webmanifest",
  "./sites-manifest.webmanifest",
  "./css/app.css",
  "./css/mobile-sites.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/config.js",
  "./js/storage.js",
  "./js/mobile-sites-app.js",
  "./js/excel-catalog.js",
  "./js/excel-import.js",
  "./js/categories.js",
  "./js/reservations.js",
  "./js/products.js",
  "./js/pos.js",
  "./js/legacy-sales.js",
  "./js/legacy-sales.json",
  "./js/sales-dashboard.js",
  "./js/daily-sales.js",
  "./js/site-admin.js",
  "./js/app.js",
];

const CDN_ASSETS = ["https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"];

const OFFLINE_PAGES = {
  "/sites.html": "./sites.html",
  "/index.html": "./index.html",
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (CDN_ASSETS.includes(url.href)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

function offlineFallback(request) {
  const path = new URL(request.url).pathname;
  const base = path.substring(path.lastIndexOf("/"));
  if (OFFLINE_PAGES[base]) return caches.match(OFFLINE_PAGES[base]);
  if (path.includes("sites")) return caches.match("./sites.html");
  return caches.match("./index.html");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === "navigate") {
      const fallback = await offlineFallback(request);
      if (fallback) return fallback;
    }
    throw new Error("offline");
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}
