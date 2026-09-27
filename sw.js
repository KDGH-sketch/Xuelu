// Xuélù service worker: the app shell and data work offline; updates arrive in the background.
const SHELL = "xuelu-shell-v2", RUNTIME = "xuelu-runtime";
const CORE = ["./","index.html","admin/index.html","css/app.css","css/admin.css","manifest.webmanifest","icon.svg",
  "js/config.js","js/api/index.js","js/api/firebase.js","js/api/local.js",
  "js/shared/ui.js","js/shared/i18n.js","js/shared/content.js","js/shared/dict.js","js/shared/engine.js","js/shared/speech.js","js/shared/widgets.js","js/shared/quiz.js","js/shared/setup.js",
  "js/learner/main.js","js/learner/core.js","js/learner/views-learn.js","js/learner/views-tools.js",
  "vendor/hanzi-writer.min.js","vendor/firebase/firebase-app.js","vendor/firebase/firebase-auth.js","vendor/firebase/firebase-firestore.js",
  "data/dictionary.json","data/chars.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("xuelu-shell") && k!==SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Firebase traffic is handled by the Firebase SDK's own offline cache
  if (/googleapis\.com|firebaseio|identitytoolkit|securetoken/.test(url.host)) return;
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!sameOrigin && !isFont && !/\.(mp3|m4a|ogg|wav|webm)$/i.test(url.pathname)) return;
  e.respondWith((async () => {
    const opt = { ignoreSearch: sameOrigin };
    // newest copy first: RUNTIME holds files refreshed from the network, SHELL the install-time copies
    const hit = (await (await caches.open(RUNTIME)).match(req, opt)) || (await caches.match(req, opt));
    const net = fetch(req).then(async res => { if (res && (res.ok || res.type==="opaque")){ const c = await caches.open(RUNTIME); c.put(req, res.clone()); } return res; }).catch(() => null);
    if (hit){ e.waitUntil(net); return hit; }
    const res = await net; if (res) return res;
    if (req.mode === "navigate") return (await caches.match("index.html")) || Response.error();
    return Response.error();
  })());
});
