// Learner app state, data access and progress tracking
import { h, icon, toast, todayKey, tr, rnd, shuffle, isHan } from "../shared/ui.js";
import { t, lang, setLang } from "../shared/i18n.js";
import { tierFor, loadBundle, SKILLS, TIERS } from "../shared/content.js";
import { loadDict, dict, chars, mergeVocabulary } from "../shared/dict.js";
import { makeEngine } from "../shared/engine.js";
import { setSpeechSettings, setAudioLibrary } from "../shared/speech.js";
import { ctx } from "../shared/widgets.js";

export const A = {
  api:null, user:null, profile:null, access:null, isAdmin:false, tier:0, settings:{}, plans:[],
  B:null, P:{}, byType:{}, catalog:[], examples:[], engine:null,
  prog:{ skills:{}, lessons:{}, patterns:{}, days:{}, answers:{r:0,t:0}, last:null },
  srs:{}, saved:{}, view:{ name:"home", params:{} }, hist:[], render:()=>{}
};
export const prefs = () => Object.assign({ uiLang:"en", explainLang:"", showPy:true, showTr:true, toneColor:true, rate:0.85, voice:"", theme:"auto" }, (A.profile && A.profile.prefs) || {});
export const expLang = () => prefs().explainLang || lang();
let prefT;
export function setPref(k, v){
  A.profile.prefs = Object.assign({}, A.profile.prefs||{}, { [k]:v });
  if (k==="uiLang") setLang(v);
  applyPrefs();
  clearTimeout(prefT); prefT = setTimeout(() => A.api.db.update(`users/${A.user.uid}`, { prefs: A.profile.prefs }).catch(()=>{}), 400);
}
export function applyPrefs(){
  const p = prefs();
  document.body.classList.toggle("hide-py", !p.showPy);
  document.body.classList.toggle("hide-tr", !p.showTr);
  document.body.classList.toggle("no-tone", !p.toneColor);
  if (p.theme==="auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", p.theme);
  document.documentElement.lang = lang()==="zh" ? "zh-CN" : lang();
  setSpeechSettings({ rate:p.rate, voice:p.voice });
}

// ---------- loading ----------
export async function loadAccount(user){
  const api = A.api;
  A.user = user;
  const [profile, access, adm, settings, plans] = await Promise.all([
    api.db.get(`users/${user.uid}`).catch(()=>null), api.db.get(`access/${user.uid}`).catch(()=>null),
    api.db.get(`admins/${user.uid}`).catch(()=>null), api.db.get("settings/app").catch(()=>null), api.db.list("plans").catch(()=>[]) ]);
  A.profile = profile || { email:user.email, name:"", status:"active", level:1, prefs:{} };
  A.access = access; A.isAdmin = !!adm; A.settings = settings || {}; A.plans = plans.sort((a,b)=>(a.order||0)-(b.order||0));
  A.tier = tierFor({ isAdmin:A.isAdmin, user:A.profile, access });
  const p = prefs(); setLang(p.uiLang || "en"); applyPrefs();
  await Promise.all([loadDict(), loadContent(), loadProgress()]);
  if (A.profile.status==="active") api.db.update(`users/${user.uid}`, { lastActive: new Date() }).catch(()=>{});
}
export async function loadContent(){
  A.B = await loadBundle(A.api, A.tier) || { patterns:[], lessons:[], grammar:[], vocabulary:[], dialogues:[], quizzes:[], audio:[], paths:[], releases:[], lexicon:[], catalog:[] };
  const B = A.B; A.byType = {};
  for (const ty of ["lessons","grammar","vocabulary","dialogues","quizzes","audio","paths","releases"]) A.byType[ty] = Object.fromEntries((B[ty]||[]).map(d=>[d.id,d]));
  A.P = {};
  (B.patterns||[]).forEach(p => { p.markers = (p.hz.match(/[一-鿿]+/g)||[]); p.l = p.level; A.P[p.n] = p; });
  A.catalog = B.catalog || [];
  const LEX = {}; (B.lexicon||[]).forEach(x => LEX[x.cat||x.id] = x.data);
  mergeVocabulary(B.vocabulary||[]);
  setAudioLibrary(B.audio||[]);
  A.engine = makeEngine(dict(), chars(), LEX);
  // every example sentence, for "in example sentences" in the dictionary
  A.examples = [];
  (B.patterns||[]).forEach(p => p.examples.forEach(e => A.examples.push(Object.assign({ pn:p.n }, e))));
  (B.grammar||[]).forEach(g => (g.examples||[]).forEach(e => A.examples.push(e)));
  (B.dialogues||[]).forEach(d => (d.lines||[]).forEach(e => A.examples.push(e)));
}
async function loadProgress(){
  const api = A.api, uid = A.user.uid;
  const [prog, srs, saved] = await Promise.all([
    api.db.get(`progress/${uid}`).catch(()=>null), api.db.list(`reviews/${uid}/items`).catch(()=>[]), api.db.list(`bookmarks/${uid}/items`).catch(()=>[]) ]);
  A.prog = Object.assign({ skills:{}, lessons:{}, patterns:{}, days:{}, answers:{r:0,t:0}, last:null }, prog||{});
  if (!prog && A.profile.status==="active") api.db.set(`progress/${uid}`, { skills:{}, lessons:{}, patterns:{}, days:{}, answers:{r:0,t:0}, createdAt:new Date() }).catch(()=>{});
  A.srs = Object.fromEntries(srs.map(x=>[x.id,x]));
  A.saved = Object.fromEntries(saved.map(x=>[x.id,x]));
}

// ---------- tracking (Firestore queues these writes while offline and syncs later) ----------
const safeId = id => String(id).replace(/\//g,"∕").slice(0,300);
function progUpdate(data){ if (A.profile.status!=="active") return; A.api.db.update(`progress/${A.user.uid}`, Object.assign(data, { updatedAt:new Date() })).catch(()=>{}); }
export function touchDay(){ const k = todayKey(); if (!A.prog.days[k]){ A.prog.days[k]=1; progUpdate({ ["days."+k]:1 }); } }
export function recordAnswer(skill, correct){
  skill = SKILLS.includes(skill) ? skill : "reading";
  const s = A.prog.skills[skill] = A.prog.skills[skill] || { r:0, t:0 }; s.t++; if (correct) s.r++;
  A.prog.answers.t++; if (correct) A.prog.answers.r++;
  touchDay();
  progUpdate({ [`skills.${skill}.t`]:A.api.db.inc(1), [`skills.${skill}.r`]:A.api.db.inc(correct?1:0), "answers.t":A.api.db.inc(1), "answers.r":A.api.db.inc(correct?1:0) });
}
export function logEvent(type, data={}, feed=false){
  if (A.profile.status!=="active") return;
  const ev = Object.assign({ type, at:new Date() }, data);
  A.api.db.add(`progress/${A.user.uid}/events`, ev).catch(()=>{});
  if (feed) A.api.db.add("activity", Object.assign({ uid:A.user.uid, name:A.profile.name||A.user.email }, ev)).catch(()=>{});
}
export function setLast(type, id){ A.prog.last = { type, id, at:Date.now() }; progUpdate({ last:{ type, id, at:new Date() } }); }
export function completeLesson(id, score, total){
  A.prog.lessons[id] = { done:true, at:Date.now(), score:score||0, total:total||0 };
  progUpdate({ ["lessons."+safeId(id)]: { done:true, at:new Date(), score:score||0, total:total||0 } });
  logEvent("lesson", { ref:id, score:score||0, total:total||0 }, true); touchDay();
}
export function learnPattern(n, on=true){
  if (on){ A.prog.patterns[n] = Date.now(); progUpdate({ ["patterns."+n]: Date.now() }); logEvent("pattern", { ref:"#"+n }, true); srsAdd("p:"+n, { type:"p", n }); }
  else { delete A.prog.patterns[n]; progUpdate({ ["patterns."+n]: A.api.db.delField() }); }
}
export function quizDone(id, score, total){ logEvent("quiz", { ref:id, score, total }, true); }

// ---------- SRS ----------
export function srsAdd(id, data){
  id = safeId(id); if (A.srs[id]) return false;
  const item = Object.assign({ due:Date.now(), ivl:0, ease:2.5, reps:0, added:Date.now() }, data);
  A.srs[id] = Object.assign({ id }, item);
  A.api.db.set(`reviews/${A.user.uid}/items/${id}`, item).catch(()=>{});
  return true;
}
export const srsDue = () => Object.values(A.srs).filter(x => x.due <= Date.now());
export function srsGrade(id, q){
  const c = A.srs[id]; if (!c) return;
  if (q===0){ c.reps=0; c.ivl=0; c.ease=Math.max(1.3,c.ease-0.2); c.due=Date.now()+5*60000; }
  else { c.reps++; c.ivl = c.reps===1 ? (q===3?3:1) : c.reps===2 ? (q===1?3:6) : Math.round(c.ivl*(q===1?1.2:q===3?c.ease*1.3:c.ease)); c.ease=Math.max(1.3,c.ease+(q===1?-0.15:q===3?0.15:0)); c.due=Date.now()+c.ivl*86400000; }
  const { id:_, ...rest } = c;
  A.api.db.set(`reviews/${A.user.uid}/items/${id}`, rest).catch(()=>{});
  if (c.type==="w" && c.reps===3) logEvent("word_mastered", { ref:c.w });
  logEvent("review", { ref:id, grade:q }); touchDay();
}
export const wordsMastered = () => Object.values(A.srs).filter(x=>x.type==="w" && x.reps>=3).length;

// ---------- bookmarks ----------
export const isSaved = id => !!A.saved[safeId(id)];
export async function toggleSave(id, data){
  id = safeId(id);
  if (A.saved[id]){ delete A.saved[id]; A.api.db.del(`bookmarks/${A.user.uid}/items/${id}`).catch(()=>{}); return false; }
  A.saved[id] = Object.assign({ id, at:Date.now() }, data);
  A.api.db.set(`bookmarks/${A.user.uid}/items/${id}`, Object.assign({ at:new Date() }, data)).catch(()=>{});
  if (data.type==="word") srsAdd("w:"+data.w, { type:"w", w:data.w });
  if (data.type==="sentence") srsAdd("s:"+data.zh, { type:"s", zh:data.zh, py:data.py, tr:data.tr });
  return true;
}

// ---------- skills ----------
export function skillPct(k){ const s = A.prog.skills[k]; if (!s || !s.t) return 0; return Math.round(100 * (s.r/s.t) * Math.min(1, s.t/40)); }
export function streak(){ let n=0; const d=new Date(); if (!A.prog.days[todayKey(d)]) d.setDate(d.getDate()-1); while (A.prog.days[todayKey(d)]){ n++; d.setDate(d.getDate()-1); } return n; }

// ---------- content helpers ----------
export const T = obj => tr(obj, expLang());
export const planForTier = tier => A.plans.find(p => p.tier===tier) || A.plans.find(p => p.tier>=tier);
export const tierName = tier => { if (tier<=1) return t("acc_free")==="acc_free"?"Free":t("acc_free"); const p = planForTier(tier); return p ? tr(p.name, lang()) : "Premium"; };
export const lockedItem = (type, id) => A.catalog.find(c => c.type===type && String(c.id)===String(id) && c.tier > A.tier);
export function orderedLessons(){ return Object.values(A.byType.lessons||{}).sort((a,b)=>(a.level-b.level)||((a.order||0)-(b.order||0))); }
export function nextLesson(){
  const last = A.prog.last && A.prog.last.type==="lesson" && A.byType.lessons[A.prog.last.id];
  if (last && !(A.prog.lessons[last.id]||{}).done) return last;
  const lv = A.profile.level || 1;
  return orderedLessons().find(l => l.level>=lv && !(A.prog.lessons[l.id]||{}).done) || orderedLessons().find(l => !(A.prog.lessons[l.id]||{}).done) || orderedLessons()[0];
}
export function genSentence(p){ if (!p || !p.gen || !p.gen.length) return null;
  for (let i=0;i<6;i++){ try { const g = rnd(p.gen); const r = A.engine.generate([g.zh, g.en, g.slots ? JSON.parse(g.slots) : undefined]); r.pn = p.n; r.tokens = r.toks.map(x=>({z:x.z,p:x.p})); r.tr = { en:r.en }; return r; } catch(e){ console.warn(p.n, e.message); } } return null; }
export function genMany(p, n){ const out=[], seen=new Set(); for (let i=0;i<n*4 && out.length<n;i++){ const s=genSentence(p); if (s && !seen.has(s.zh)){ seen.add(s.zh); out.push(s); } } return out; }
export const exampleOf = (p, e) => Object.assign({ pn:p.n }, e);

// widgets context
ctx.exp = expLang;
ctx.isSaved = isSaved; ctx.toggleSave = toggleSave;
ctx.patterns = () => Object.values(A.P);
ctx.examples = () => A.examples;
ctx.track = (type, data) => { if (type==="word"){ logEvent("word", { ref:data.w }); } if (type==="write"){ recordAnswer("writing", (data.mistakes||0)<=3); logEvent("writing", { ref:data.c }); } if (type==="listen") touchDay(); };
