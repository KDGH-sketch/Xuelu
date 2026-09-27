// Xuélù Admin Backend
import { getApi } from "../api/index.js";
import { OWNER_EMAIL } from "../config.js";
import { h, $, $$, icon, toast, dialog, confirmDialog, fmtDate, errText } from "../shared/ui.js";
import { setLang, lang } from "../shared/i18n.js";
import { buildBundles, CONTENT_TYPES } from "../shared/content.js";
import { bootstrapOwner, importSeed, ensureDemo, DEMO } from "../shared/setup.js";
import { loadDict } from "../shared/dict.js";
import { S, L, t, go, isSuper, canContent, canSupport, refreshPlans, fld } from "./state.js";
import { viewLearners, viewLearner } from "./learners.js";
import { viewPlans } from "./plans.js";
import { viewContentHome, viewContentList, viewEditor } from "./cms.js";

const root = document.getElementById("root");
const pref = (() => { try { return localStorage.getItem("xuelu.admin.lang") || "en"; } catch(e){ return "en"; } })();
setLang(pref==="lo" ? "lo" : "en");

async function boot(){
  const api = S.api = await getApi();
  if (api.mode==="demo"){ root.innerHTML=""; root.append(h("div",{class:"empty",style:"margin:40px"}, t("loading")+" (demo setup)")); await ensureDemo(api); }
  api.auth.onChange(async user => {
    if (!user){ S.me=null; return renderLogin(); }
    let adm = null; try { adm = await api.db.get(`admins/${user.uid}`); } catch(e){}
    if (!adm){
      let boot = null; try { boot = await api.db.get("settings/bootstrap"); } catch(e){}
      if (!boot) return renderSetup(user);
      return renderNoAccess(user);
    }
    S.me = { uid:user.uid, email:user.email, role:adm.role, name:adm.name||user.email };
    await Promise.all([refreshPlans().catch(()=>[]), api.db.get("settings/app").then(s=>S.settings=s||{}).catch(()=>{}), refreshBundleState()]);
    loadDict();
    S.render = renderShell; renderShell();
  });
}
export async function refreshBundleState(){ try { S.bundle = await S.api.db.get("settings/bundle") || {}; } catch(e){ S.bundle = {}; } }

// ---------- auth screens ----------
function authFrame(...kids){
  root.innerHTML = "";
  root.append(demoBar(), h("div",{class:"auth"},
    h("div",{class:"auth-art",style:"background:var(--ink)"}, h("div",null, h("div",{class:"big",lang:"zh-CN"},"学"), h("h2",{style:"margin-top:12px"},"Xuélù · "+t("adm_title"))), h("p",null,"Manage learners, access and learning content.")),
    h("div",{class:"auth-form"}, ...kids)));
}
function demoBar(){ return S.api && S.api.mode==="demo" ? h("div",{class:"demo-bar"}, t("demo_banner")+" ", h("button",{onclick:async()=>{ if(await confirmDialog(t("reset_demo"), "Delete all demo data in this browser and start again?", t("reset_demo"), t("cancel"), true)){ await S.api._reset(); location.reload(); } }}, t("reset_demo"))) : ""; }
function renderLogin(){
  const email = h("input",{class:"input",type:"email",autocomplete:"username",id:"em"}), pw = h("input",{class:"input",type:"password",autocomplete:"current-password",id:"pw"});
  const msg = h("p",{class:"small",style:"color:var(--bad)"});
  const go_ = async e => { e && e.preventDefault(); msg.textContent=""; try { await S.api.auth.signIn(email.value.trim(), pw.value); } catch(err){ msg.textContent = errText(err); } };
  authFrame(h("h1",null,t("sign_in")),
    h("form",{class:"stack",onsubmit:go_}, h("div",{class:"field"}, h("label",{for:"em"},t("email")), email), h("div",{class:"field"}, h("label",{for:"pw"},t("password")), pw), msg,
      h("button",{class:"btn primary",type:"submit"}, t("sign_in"))),
    h("button",{class:"linkbtn",onclick:async()=>{ if(!email.value) { msg.textContent=t("email")+"?"; return; } try{ await S.api.auth.resetPassword(email.value.trim()); toast(t("reset_sent")); }catch(err){ msg.textContent=errText(err); } }}, t("forgot")),
    S.api.mode==="demo" ? h("div",{class:"banner info"}, h("div",null, h("b",null,t("demo_accounts")), h("div",{class:"small mono"}, DEMO.admin.email+" / "+DEMO.admin.pw)), h("button",{class:"btn sm",onclick:()=>{ email.value=DEMO.admin.email; pw.value=DEMO.admin.pw; go_(); }}, t("sign_in"))) : null,
    h("div",{class:"row"}, langSwitch(), h("a",{href:"../",class:"small"}, t("adm_open_learner"))));
}
function renderNoAccess(user){
  authFrame(h("h1",null,t("adm_title")), h("p",null, t("adm_no_access")), h("p",{class:"muted small"}, user.email),
    h("div",{class:"row"}, h("button",{class:"btn",onclick:()=>S.api.auth.signOut()}, icon("logout"), t("sign_out")), h("a",{href:"../",class:"btn ghost"}, t("adm_open_learner"))));
}
function renderSetup(user){
  const name = h("input",{class:"input",id:"nm",value:""});
  const ok = S.api.mode==="demo" || user.email.toLowerCase()===String(OWNER_EMAIL).toLowerCase();
  const msg = h("p",{class:"small",style:"color:var(--bad)"});
  authFrame(h("h1",null,t("adm_setup_title")), h("p",{class:"muted"}, t("adm_setup_d")), h("p",{class:"small"}, user.email),
    ok ? h("div",{class:"field"}, h("label",{for:"nm"},t("name")), name) : h("div",{class:"banner"}, "This email doesn't match OWNER_EMAIL in js/config.js and firestore.rules."),
    msg,
    h("div",{class:"row"}, ok ? h("button",{class:"btn primary",onclick:async e=>{ e.currentTarget.disabled=true; try{ await bootstrapOwner(S.api, user, name.value.trim()); location.reload(); }catch(err){ msg.textContent=errText(err); e.currentTarget.disabled=false; } }}, icon("shield"), t("adm_become_super")) : null,
      h("button",{class:"btn ghost",onclick:()=>S.api.auth.signOut()}, t("sign_out"))));
}
function langSwitch(){
  return h("div",{class:"langsw"}, [["en","EN"],["lo","ລາວ"]].map(([l,n]) => h("button",{"aria-pressed":String(lang()===l),onclick:()=>{ setLang(l); try{ localStorage.setItem("xuelu.admin.lang",l); }catch(e){} S.me ? renderShell() : renderLogin(); }}, n)));
}

// ---------- shell ----------
const NAV = [["dashboard","adm_dashboard","chart"],["learners","adm_learners","users"],["plans","adm_plans","plan"],["content","adm_content","content"],["activity","adm_activity","clock"],["admins","adm_admins","shield"],["settings","adm_settings","settings"]];
function renderShell(){
  root.innerHTML = "";
  const side = h("nav",{class:"side","aria-label":"Admin"},
    h("div",{class:"brand"}, h("div",{class:"seal",lang:"zh-CN"},"学"), h("div",null, h("b",null,"Xuélù"), h("small",null,t("adm_title")+" · "+t("role_"+S.me.role)))));
  const activeTop = ["learner"].includes(S.view) ? "learners" : ["contentList","editor"].includes(S.view) ? "content" : S.view;
  NAV.forEach(([id,k,ic]) => { if (id==="admins" && !isSuper()) return; if (id==="content" && !canContent()) return;
    side.append(h("button",{class:"nav-btn","aria-current":activeTop===id?"page":null,onclick:()=>go(id)}, icon(ic), t(k))); });
  side.append(h("div",{class:"sep"}), h("a",{class:"nav-btn",href:"../",style:"text-decoration:none"}, icon("home"), t("adm_open_learner")),
    h("button",{class:"nav-btn",onclick:()=>S.api.auth.signOut()}, icon("logout"), t("sign_out")),
    h("div",{class:"side-foot"}, S.me.email));
  const top = h("header",{class:"topbar"},
    h("div",{class:"mbrand"}, h("span",{class:"seal"},"学"), h("b",null,t("adm_title"))),
    h("div",{style:"flex:1"}), publishChip(), langSwitch(),
    h("select",{class:"input hide-desk",style:"width:auto","aria-label":"Menu",onchange:e=>go(e.target.value)}, NAV.filter(([id])=>!(id==="admins"&&!isSuper())).map(([id,k]) => h("option",{value:id,selected:activeTop===id},t(k)))));
  const main = h("main",{id:"main"});
  root.append(demoBar(), h("div",{class:"app adm"}, side, h("div",{class:"mainwrap"}, top, main)));
  const V = { dashboard:viewDashboard, learners:viewLearners, learner:viewLearner, plans:viewPlans, content:viewContentHome, contentList:viewContentList, editor:viewEditor, activity:viewActivity, admins:viewAdmins, settings:viewSettings };
  const fn = V[S.view] || viewDashboard;
  Promise.resolve(fn(S.params||{})).then(el => { main.innerHTML=""; main.append(el); }).catch(err => { console.error(err); main.innerHTML=""; main.append(h("div",{class:"banner"}, errText(err))); });
}
function publishChip(){
  if (!canContent()) return "";
  const dirty = !!S.bundle.dirty || !S.bundle.builtAt;
  return h("button",{class:"btn sm"+(dirty?" primary":""),title: dirty ? t("unpublished_changes") : t("up_to_date"),onclick:publishFlow}, icon(dirty?"upload":"check"), dirty ? t("publish_now") : t("up_to_date"));
}
export async function publishFlow(){
  const status = h("p",{class:"muted"}, t("publishing"));
  const dlg = dialog({ title: t("adm_publish"), body: status });
  try {
    await buildBundles(S.api, S.me.uid, step => status.textContent = t("publishing")+" "+step);
    await refreshBundleState();
    document.querySelector(".dialog .ib")?.click();
    toast(t("published_ok")); S.render();
  } catch(e){ status.textContent = errText(e); }
  return dlg;
}

// ---------- dashboard ----------
async function viewDashboard(){
  const api = S.api, now = Date.now();
  const [users, access, activity, counts] = await Promise.all([
    api.db.list("users", { where:[["role","==","learner"]] }).catch(()=>[]),
    api.db.list("access").catch(()=>[]),
    api.db.list("activity", { orderBy:["at","desc"], limit:15 }).catch(()=>[]),
    Promise.all(CONTENT_TYPES.filter(t=>t!=="lexicon").map(async ty => [ty, await api.db.count(ty).catch(()=>0)]))
  ]);
  const active = users.filter(u=>u.status==="active").length;
  const accMap = Object.fromEntries(access.map(a=>[a.id,a]));
  const learnerAccess = users.map(u=>accMap[u.id]).filter(Boolean);
  const activeSubs = learnerAccess.filter(a=>a.status==="active" && (a.expiresAt==null || a.expiresAt>now) && a.tier>1).length;
  const expired = learnerAccess.filter(a=>a.expiresAt!=null && a.expiresAt<=now).length;
  const week = activity.filter(a=>a.at>now-7*86400000).length;
  const root_ = h("div",{class:"stack-l"});
  root_.append(h("div",{class:"pagehead"}, h("h1",null,t("adm_dashboard")), h("p",null, S.settings.appName || "Xuélù")));
  root_.append(h("div",{class:"kpis"},
    kpi(users.length, t("total_learners")), kpi(active, t("active_learners")), kpi(users.length-active, t("inactive_learners")),
    kpi(activeSubs, t("active_subs")), kpi(expired, t("expired_subs")), kpi(week, t("adm_activity")+" · 7d")));
  root_.append(h("div",{class:"grid2"},
    h("section",{class:"panel"}, h("h3",null,t("content_counts")), h("div",{class:"kpis"}, counts.map(([ty,n]) => h("button",{class:"kpi",style:"text-align:left",onclick:()=>go("contentList",{type:ty})}, h("b",null,n), h("span",null,t("type_"+ty)))))),
    h("section",{class:"panel"}, h("h3",null,t("publish_state")),
      h("div",{class:"banner "+(S.bundle.dirty||!S.bundle.builtAt?"":"ok")}, h("span",null, S.bundle.dirty||!S.bundle.builtAt ? t("unpublished_changes") : t("up_to_date")), canContent()? h("button",{class:"btn sm",onclick:publishFlow}, t("publish_now")) : null),
      h("p",{class:"small muted"}, t("last_published")+": "+fmtDate(S.bundle.builtAt, lang(), true)),
      h("p",{class:"small muted"}, t("payments_note")))));
  root_.append(h("section",{class:"panel"}, h("h3",null,t("recent_activity"), h("button",{class:"btn sm ghost",onclick:()=>go("activity")}, t("view_all"))), activityFeed(activity)));
  return root_;
}
const kpi = (n, label) => h("div",{class:"kpi"}, h("b",null,n), h("span",null,label));
export function activityFeed(rows){
  if (!rows.length) return h("p",{class:"muted"}, t("no_rows"));
  return h("div",{class:"feed"}, rows.map(a => h("div",{class:"feed-row"},
    h("span",null, h("b",null,a.name||"—"), " · ", a.type, a.ref ? " · "+a.ref : "", a.total ? ` · ${a.score}/${a.total}` : ""),
    h("span",{class:"muted small"}, fmtDate(a.at, lang(), true)))));
}
async function viewActivity(){
  const rows = await S.api.db.list("activity", { orderBy:["at","desc"], limit:200 }).catch(()=>[]);
  return h("div",null, h("div",{class:"pagehead"}, h("h1",null,t("adm_activity"))), h("div",{class:"panel"}, activityFeed(rows)));
}

// ---------- administrators ----------
async function viewAdmins(){
  if (!isSuper()) return h("div",{class:"banner"}, t("only_super"));
  const admins = await S.api.db.list("admins");
  const wrap = h("div");
  const table = h("div",{class:"tbl-wrap"}, h("table",{class:"tbl"}, h("thead",null,h("tr",null,h("th",null,t("email")),h("th",null,t("name")),h("th",null,t("role")),h("th",null,""))),
    h("tbody",null, admins.map(a => h("tr",{style:"cursor:default"}, h("td",null,a.email), h("td",null,a.name||""),
      h("td",null, h("select",{class:"input",style:"width:auto",disabled:a.id===S.me.uid,onchange:async e=>{ await S.api.db.update(`admins/${a.id}`,{role:e.target.value}); toast(t("saved_ok")); }}, ["super","content","support"].map(r=>h("option",{value:r,selected:a.role===r},t("role_"+r))))),
      h("td",null, a.id===S.me.uid ? "" : h("button",{class:"btn sm ghost",onclick:async()=>{ if(await confirmDialog(t("remove"), a.email, t("remove"), t("cancel"), true)){ await S.api.db.del(`admins/${a.id}`); S.render(); } }}, t("remove"))))))));
  wrap.append(h("div",{class:"pagehead"}, h("div",{class:"spread"}, h("h1",null,t("adm_admins")), h("button",{class:"btn primary",onclick:addAdmin}, icon("plus"), t("add_admin")))),
    h("p",{class:"muted",style:"margin-bottom:14px"}, "Super Admin: everything · Content Admin: lessons and content · Support Admin: learners and access."), table);
  return wrap;
}
async function addAdmin(){
  const email = h("input",{class:"input",type:"email"}), name = h("input",{class:"input"}), pw = h("input",{class:"input",type:"text",placeholder:"(only for a new account)"});
  const role = h("select",{class:"input"}, ["content","support","super"].map(r=>h("option",{value:r},t("role_"+r))));
  const msg = h("p",{class:"small",style:"color:var(--bad)"});
  await dialog({ title:t("add_admin"), body:h("div",{class:"stack"}, h("p",{class:"muted small"},t("admin_email_d")), fld(t("email"),email), fld(t("name"),name), fld(t("password"),pw), fld(t("role"),role), msg),
    actions:[{label:t("cancel"),value:false},{label:t("add"),primary:true,onClick:async()=>{
      try {
        const e = email.value.trim().toLowerCase(); if (!e) return false;
        let u = (await S.api.db.list("users",{ where:[["email","==",e]] }))[0];
        let uid = u && u.id;
        if (!uid){ if (!pw.value) { msg.textContent="No account with that email. Enter a password to create one."; return false; }
          uid = await S.api.auth.createAccount(e, pw.value);
          await S.api.db.set(`users/${uid}`, { email:e, name:name.value.trim(), status:"active", level:1, role:"admin", prefs:{}, createdAt:new Date() }); }
        await S.api.db.set(`admins/${uid}`, { role:role.value, email:e, name:name.value.trim() || (u&&u.name) || "", createdAt:new Date(), addedBy:S.me.uid });
        toast(t("saved_ok")); S.render(); return true;
      } catch(err){ msg.textContent = errText(err); return false; }
    }}] });
}

// ---------- settings ----------
async function viewSettings(){
  const s = Object.assign({ appName:"Xuélù", allowRegistration:false, defaultPlanId:"free", supportContact:"" }, await S.api.db.get("settings/app").catch(()=>null)||{});
  const name = h("input",{class:"input",value:s.appName}), reg = h("input",{type:"checkbox",class:"switch",checked:!!s.allowRegistration,"aria-label":t("allow_reg")});
  const plan = h("select",{class:"input"}, S.plans.map(p=>h("option",{value:p.id,selected:p.id===s.defaultPlanId},(p.name&&p.name.en)||p.id)));
  const contact = h("input",{class:"input",value:s.supportContact,placeholder:"WhatsApp / email / Facebook page"});
  const wrap = h("div",{class:"stack-l"});
  wrap.append(h("div",{class:"pagehead"}, h("h1",null,t("adm_settings"))));
  wrap.append(h("section",{class:"panel"},
    fld(t("app_name"), name), h("div",{class:"set-row"}, h("div",null,h("label",null,t("allow_reg")),h("p",null,t("allow_reg_d"))), reg),
    fld(t("support_contact"), contact),
    h("div",{class:"row"}, h("button",{class:"btn primary",disabled:!isSuper(),onclick:async()=>{ await S.api.db.set("settings/app",{appName:name.value.trim(),allowRegistration:reg.checked,defaultPlanId:plan.value,supportContact:contact.value.trim()},true); S.settings = await S.api.db.get("settings/app"); toast(t("saved_ok")); }}, t("save")), isSuper()?null:h("span",{class:"muted small"},t("only_super")))));
  wrap.append(h("section",{class:"panel"}, h("h3",null,t("adm_import")), h("p",{class:"muted"},t("adm_import_d")),
    h("div",{class:"row"}, h("button",{class:"btn",disabled:!isSuper(),onclick:async()=>{
      if (!await confirmDialog(t("adm_import"), t("confirm_import"), t("adm_import"), t("cancel"))) return;
      const st = h("p",{class:"muted"}, t("importing")); dialog({ title:t("adm_import"), body:st });
      try { const n = await importSeed(S.api, S.me.uid, step => st.textContent = t("importing")+" "+step); await refreshPlans(); await refreshBundleState(); document.querySelector(".dialog .ib")?.click(); toast(t("imported")+" ("+n+")"); S.render(); }
      catch(e){ st.textContent = errText(e); }
    }}, icon("download"), t("adm_import")),
    h("button",{class:"btn",onclick:exportAll}, icon("copy"), t("export")))));
  if (S.api.mode==="demo") wrap.append(h("section",{class:"panel"}, h("h3",null,t("danger")), h("button",{class:"btn danger",style:"align-self:flex-start",onclick:async()=>{ if(await confirmDialog(t("reset_demo"),"Delete all demo data in this browser?",t("reset_demo"),t("cancel"),true)){ await S.api._reset(); location.reload(); } }}, t("reset_demo"))));
  return wrap;
}
async function exportAll(){
  const out = {};
  for (const ty of [...CONTENT_TYPES, "plans"]) out[ty] = await S.api.db.list(ty);
  const text = JSON.stringify(out, null, 1);
  const ta = h("textarea",{class:"code",style:"min-height:320px","aria-label":"JSON"}); ta.value = text;
  dialog({ title:t("export"), wide:true, body:h("div",{class:"stack"}, h("p",{class:"muted small"}, Math.round(text.length/1024)+" KB"), ta),
    actions:[{label:t("copy"),primary:true,onClick:async()=>{ try{ await navigator.clipboard.writeText(text); toast(t("copied")); }catch(e){ ta.select(); } return false; }}] });
}

boot().catch(e => { root.innerHTML=""; root.append(h("div",{class:"banner",style:"margin:40px"}, errText(e))); console.error(e); });
