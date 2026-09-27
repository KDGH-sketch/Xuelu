// Small UI toolkit shared by the learner app and the admin panel.
export const $ = (s, r=document) => r.querySelector(s);
export const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
export function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if (attrs) for (const [k,v] of Object.entries(attrs)){
    if (v===null || v===undefined || v===false) continue;
    if (k==="class") el.className = v;
    else if (k==="html") el.innerHTML = v;
    else if (k==="value" && (tag==="input"||tag==="textarea"||tag==="select")) el.value = v;
    else if (k.startsWith("on") && typeof v==="function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v===true ? "" : v);
  }
  for (const k of kids.flat(Infinity)){ if (k===null || k===undefined || k===false) continue; el.append(k instanceof Node ? k : document.createTextNode(String(k))); }
  if (tag==="select" && attrs && attrs.value!==undefined) el.value = attrs.value;
  return el;
}
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const rnd = a => a[Math.floor(Math.random()*a.length)];
export const shuffle = a => { a=a.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
export const isHan = c => !!c && c>="一" && c<="鿿";
export const debounce = (fn, ms=150) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

// Pick a translation: obj = {en:..., lo:..., zh:...}; falls back to English, then any.
export function tr(obj, lang){ if (obj==null) return ""; if (typeof obj!=="object") return String(obj); return obj[lang] ?? obj.en ?? obj.zh ?? Object.values(obj)[0] ?? ""; }
export function trs(obj, lang, key){ if (!obj) return ""; const o = obj[lang] && obj[lang][key] ? obj[lang] : obj.en; return o ? (o[key] ?? "") : ""; }

// ----- pinyin colouring -----
const TONEV = {"ā":1,"á":2,"ǎ":3,"à":4,"ē":1,"é":2,"ě":3,"è":4,"ī":1,"í":2,"ǐ":3,"ì":4,"ō":1,"ó":2,"ǒ":3,"ò":4,"ū":1,"ú":2,"ǔ":3,"ù":4,"ǖ":1,"ǘ":2,"ǚ":3,"ǜ":4};
const V = "aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ";
const SYL = new RegExp("(?:[zcs]h|[bpmfdtnlgkhjqxrzcsyw])?["+V+"]+(?:ng(?!["+V+"])|n(?!["+V+"])|r(?!["+V+"]))?|[a-zA-Z"+V+"]+","gi");
export function toneOf(s){ for (const c of String(s).toLowerCase()) if (TONEV[c]) return TONEV[c]; return 0; }
export function pyHTML(py){
  return esc(py||"").replace(new RegExp("[A-Za-z"+V+V.toUpperCase()+"ĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]+","g"), word => (word.match(SYL)||[word]).map(s => `<span class="t${toneOf(s)}">${s}</span>`).join(""));
}
export const stripTone = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ü/g,"v").replace(/[\s'’·…\-]/g,"").replace(/[1-5]/g,"").toLowerCase();

// ----- icons -----
const IC = {
 home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
 learn:'<path d="M4 5h11a3 3 0 013 3v12H7a3 3 0 01-3-3z"/><path d="M4 17a3 3 0 013-3h11"/>',
 path:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 000-8h-4a4 4 0 010-8h6"/>',
 gen:'<path d="M4 7h10M4 12h16M4 17h7"/><path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
 practice:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h11"/>',
 dict:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
 pinyin:'<path d="M3 17c3-8 5-8 7 0M4.5 13h4"/><path d="M13 9h8M17 9v10"/><path d="M14 5l3-2 3 2"/>',
 chars:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>',
 review:'<path d="M4 12a8 8 0 0114-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 01-14 5l-2-2"/><path d="M4 20v-5h5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
 more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 play:'<path d="M7 5l12 7-12 7z"/>',
 slow:'<path d="M3 16c0-4 3-7 7-7s7 3 7 7"/><path d="M17 16h3M3 16h2"/><circle cx="16" cy="8" r="2"/>',
 repeat:'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
 split:'<rect x="3" y="6" width="5" height="12" rx="1.5"/><rect x="10" y="6" width="5" height="12" rx="1.5"/><rect x="17" y="6" width="4" height="12" rx="1.5"/>',
 star:'<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>', left:'<path d="M15 5l-7 7 7 7"/>', right:'<path d="M9 5l7 7-7 7"/>', down:'<path d="M5 9l7 7 7-7"/>',
 check:'<path d="M5 12l5 5 9-10"/>', spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
 speaker:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
 pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0"/><path d="M16 4.5a3.5 3.5 0 010 7M22 20a7 7 0 00-4-6.3"/>',
 plan:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
 content:'<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 note:'<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>',
 download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
 upload:'<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
 logout:'<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h11"/>',
 shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
 gift:'<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8c-2-5-7-3-4 0M12 8c2-5 7-3 4 0"/>',
 trophy:'<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H4a4 4 0 004 4M16 6h4a4 4 0 01-4 4M12 13v4M8 21h8"/>',
 flame:'<path d="M12 3s5 5 5 10a5 5 0 01-10 0c0-3 2-4 2-7 2 1 3 3 3 3"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', history:'<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3"/><path d="M3 4v4h4M12 7v5l3 2"/>',
 send:'<path d="M4 12l16-8-6 16-3-7z"/>', copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'
};
export function icon(n, cls){ const s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("viewBox","0 0 24 24"); s.setAttribute("aria-hidden","true"); if (cls) s.setAttribute("class",cls); s.innerHTML = IC[n] || IC.more; return s; }

// ----- feedback -----
let toastT;
export function toast(msg, kind){
  let el = $(".toast"); if (!el){ el = h("div",{class:"toast",role:"status"}); document.body.append(el); }
  el.textContent = msg; el.className = "toast" + (kind ? " "+kind : ""); clearTimeout(toastT); toastT = setTimeout(()=>el.remove(), 2800);
}
// In-page dialog (native confirm/prompt are blocked in some viewers)
export function dialog({ title, body, actions=[], wide=false }){
  return new Promise(resolve => {
    const scrim = h("div",{class:"scrim"});
    const box = h("div",{class:"dialog"+(wide?" wide":""),role:"dialog","aria-modal":"true","aria-label":title||""});
    const close = v => { scrim.remove(); box.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = e => { if (e.key==="Escape") close(null); };
    document.addEventListener("keydown", onKey);
    scrim.addEventListener("click", () => close(null));
    box.append(
      title ? h("div",{class:"dialog-h"}, h("h2",null,title), h("button",{class:"ib","aria-label":"Close",onclick:()=>close(null)}, icon("x"))) : null,
      h("div",{class:"dialog-b"}, body),
      actions.length ? h("div",{class:"dialog-f"}, actions.map(a => h("button",{class:"btn"+(a.primary?" primary":"")+(a.danger?" danger":""),onclick:async()=>{ const v = a.value!==undefined ? a.value : (a.onClick ? await a.onClick() : true); if (v!==false) close(v); }}, a.label))) : null);
    document.body.append(scrim, box);
    const f = box.querySelector("input,select,textarea,button.primary"); if (f) f.focus();
  });
}
export const confirmDialog = (title, text, okLabel="OK", cancelLabel="Cancel", danger=false) =>
  dialog({ title, body: h("p",null,text), actions:[{label:cancelLabel, value:false},{label:okLabel, value:true, primary:!danger, danger}] }).then(v=>v===true);

export function fmtDate(ms, lang="en", withTime=false){
  if (!ms) return "—";
  const d = new Date(ms); const loc = lang==="zh"?"zh-CN":lang==="lo"?"lo-LA":"en-GB";
  try { return d.toLocaleDateString(loc, withTime ? {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"} : {year:"numeric",month:"short",day:"numeric"}); } catch(e){ return d.toISOString().slice(0,10); }
}
export const todayKey = (d=new Date()) => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
export function errText(e){
  const c = e && e.code || "";
  const map = {"auth/invalid-credential":"Wrong email or password.","auth/wrong-password":"Wrong email or password.","auth/user-not-found":"No account with that email.",
    "auth/email-already-in-use":"That email already has an account.","auth/weak-password":"Password must be at least 6 characters.","auth/invalid-email":"That email address isn't valid.",
    "auth/too-many-requests":"Too many attempts. Wait a minute and try again.","auth/network-request-failed":"No internet connection.","permission-denied":"You don't have permission to do that."};
  return map[c] || (e && e.message) || String(e);
}
