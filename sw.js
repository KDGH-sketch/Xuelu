// Xuélù offline cache
const CACHE="xuelu-v1";
const CORE=["./","./index.html","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const req=e.request; if(req.method!=="GET") return;
  e.respondWith(caches.match(req).then(hit=>{
    const net=fetch(req).then(res=>{ if(res && (res.ok||res.type==="opaque")){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); } return res; }).catch(()=>hit);
    return hit || net;
  }));
});
