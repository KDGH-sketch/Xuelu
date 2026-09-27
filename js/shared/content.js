// Content model, access tiers, publishing (bundles) and versioning.
export const TIERS = { public:0, free:1, standard:2, premium:3, admin:99 };
export const ACCESS_KEYS = ["public","free","standard","premium","admin"];
export const STATUS_KEYS = ["draft","published","archived"];
export const CONTENT_TYPES = ["lessons","patterns","grammar","vocabulary","dialogues","quizzes","audio","paths","releases","lexicon"];
export const LEVELS = [1,2,3,4,5,6];
export const SKILLS = ["vocabulary","grammar","reading","listening","writing","speaking","pinyin","characters","sentence"];

export const minTier = item => TIERS[item.access] ?? TIERS.free;

// Effective tier of an account (mirrors myTier() in firestore.rules)
export function tierFor({ isAdmin, user, access }){
  if (isAdmin) return 99;
  if (!user || user.status !== "active") return 0;
  if (access && access.status === "active" && (access.expiresAt == null || access.expiresAt > Date.now())) return Math.max(1, access.tier || 1);
  return 1;
}
export function accessState(access){
  if (!access) return "none";
  if (access.status !== "active") return access.status || "none";
  if (access.expiresAt != null && access.expiresAt <= Date.now()) return "expired";
  return "active";
}

// ---------- versioned save ----------
const STRIP = ["id","version","createdAt","updatedAt","updatedBy","createdBy"];
export async function saveContent(api, type, id, data, who){
  const path = `${type}/${id}`;
  const prev = await api.db.get(path);
  const now = new Date();
  const clean = {}; for (const k in data) if (!STRIP.includes(k) && data[k] !== undefined) clean[k] = data[k];
  const ops = [];
  if (prev){
    const snap = {}; for (const k in prev) if (k!=="id") snap[k] = prev[k];
    ops.push({ op:"set", path:`${path}/versions/v${String(prev.version||1).padStart(4,"0")}`, data:{ data: JSON.stringify(snap), version: prev.version||1, savedAt: now, savedBy: who||"" } });
  }
  ops.push({ op:"set", path, data: Object.assign(clean, { version:(prev&&prev.version||0)+1, createdAt: prev&&prev.createdAt ? new Date(prev.createdAt) : now, createdBy: prev&&prev.createdBy || who||"", updatedAt: now, updatedBy: who||"" }) });
  ops.push({ op:"set", path:"settings/bundle", data:{ dirty:true, changedAt: now }, merge:true });
  await api.db.batch(ops);
  return clean.version;
}
export async function listVersions(api, type, id){
  const rows = await api.db.list(`${type}/${id}/versions`, { orderBy:["version","desc"], limit:30 });
  return rows.map(r => ({ version:r.version, savedAt:r.savedAt, savedBy:r.savedBy, data: JSON.parse(r.data) }));
}

// ---------- publishing ----------
// Learners never read raw content. Admins "publish" = build one bundle per tier containing only
// published items that tier may see. Bundles are split into parts under Firestore's 1 MB doc limit.
const PART = 280000; // characters; Chinese text is 3 bytes each, so this stays under 1 MB
function publicView(type, doc){
  const o = {}; for (const k in doc) if (!["createdBy","updatedBy","createdAt","version"].includes(k)) o[k] = doc[k];
  return o;
}
export async function buildBundles(api, who, onStep=()=>{}){
  const all = {};
  for (const t of CONTENT_TYPES){ onStep(t); all[t] = await api.db.list(t); }
  const plans = await api.db.list("plans");
  const tiers = [...new Set([0, 1, ...plans.map(p=>p.tier||1)])].sort((a,b)=>a-b);
  const version = Date.now();
  const pub = t => all[t].filter(d => d.status === "published" && minTier(d) < 99);
  const catalog = [];
  for (const t of ["lessons","patterns","grammar","dialogues","quizzes","paths","releases"]) for (const d of pub(t))
    catalog.push({ type:t, id:d.id, title: d.title || (d.hz ? {en:d.hz} : null), hz:d.hz||"", level:d.level||0, tier:minTier(d), order:d.order??0, kind:d.kind||"" });
  const meta = { version, tiers:{}, builtAt:new Date(), builtBy: who||"", counts:{} };
  const ops = [];
  const existing = await api.db.list("bundles");
  for (const T of tiers){
    const data = { version, tier:T, catalog };
    for (const t of CONTENT_TYPES){
      const items = t==="lexicon" ? all[t] : pub(t).filter(d => minTier(d) <= T);
      data[t] = items.map(d => publicView(t, d));
    }
    const json = JSON.stringify(data);
    const parts = Math.max(1, Math.ceil(json.length / PART));
    for (let i=0;i<parts;i++) ops.push({ op:"set", path:`bundles/t${T}_p${i}`, data:{ tier:T, part:i, parts, version, json: json.slice(i*PART, (i+1)*PART) }, big:true });
    meta.tiers[T] = parts;
    meta.counts[T] = Object.fromEntries(CONTENT_TYPES.map(t=>[t, data[t].length]));
  }
  const keep = new Set(ops.map(o=>o.path.split("/")[1]));
  existing.forEach(b => { if (b.id!=="meta" && !keep.has(b.id)) ops.push({ op:"del", path:`bundles/${b.id}` }); });
  ops.push({ op:"set", path:"bundles/meta", data: meta });
  ops.push({ op:"set", path:"settings/bundle", data:{ dirty:false, builtAt:new Date(), builtBy:who||"", version }, merge:true });
  onStep("write");
  for (const o of ops.filter(o=>o.big)) await api.db.set(o.path, o.data);   // large parts one at a time
  await api.db.batch(ops.filter(o=>!o.big));                                // meta written last

  return meta;
}

// ---------- learner-side loading with an on-device cache ----------
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("xuelu-cache", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export async function cacheGet(key){ try { const d = await idb(); return await new Promise(res => { const q = d.transaction("kv").objectStore("kv").get(key); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }); } catch(e){ return null; } }
export async function cacheSet(key, val){ try { const d = await idb(); await new Promise(res => { const t = d.transaction("kv","readwrite"); t.objectStore("kv").put(val, key); t.oncomplete = res; t.onerror = res; }); } catch(e){} }

export async function loadBundle(api, tier){
  let meta = null;
  try { meta = await api.db.get("bundles/meta"); } catch(e){ meta = null; }
  const cached = await cacheGet("bundle");
  if (!meta){ return cached ? JSON.parse(cached.json) : null; }
  const avail = Object.keys(meta.tiers).map(Number).filter(t => t <= tier).sort((a,b)=>b-a);
  const T = avail.length ? avail[0] : 0;
  if (cached && cached.version === meta.version && cached.tier === T) return JSON.parse(cached.json);
  const parts = meta.tiers[T]; let json = "";
  try {
    for (let i=0;i<parts;i++){ const p = await api.db.get(`bundles/t${T}_p${i}`); json += p.json; }
  } catch(e){ return cached ? JSON.parse(cached.json) : null; }
  await cacheSet("bundle", { version: meta.version, tier: T, json });
  return JSON.parse(json);
}
