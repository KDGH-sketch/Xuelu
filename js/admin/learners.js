// Learner / client management and manual access (subscriptions)
import { h, icon, toast, dialog, confirmDialog, fmtDate, errText, debounce } from "../shared/ui.js";
import { lang } from "../shared/i18n.js";
import { accessState, SKILLS } from "../shared/content.js";
import { S, t, go, canSupport, planName, fld } from "./state.js";

const DAY = 86400000;
const pill = (cls, label) => h("span",{class:"pill "+cls}, label);
const stLabel = st => st==="disabled" ? t("disable") : st==="none" ? "—" : t(st);
const dateInput = ms => h("input",{class:"input",type:"date",value: ms ? new Date(ms).toISOString().slice(0,10) : ""});
const readDate = inp => inp.value ? new Date(inp.value+"T23:59:59") : null;
const genPw = () => Math.random().toString(36).slice(2,6)+"-"+Math.random().toString(36).slice(2,6);

export async function viewLearners(p){
  const [users, access] = await Promise.all([S.api.db.list("users",{ where:[["role","==","learner"]] }), S.api.db.list("access")]);
  const acc = Object.fromEntries(access.map(a=>[a.id,a]));
  let q = p.q || "", fs = p.status || "", fp = p.plan || "";
  const body = h("tbody");
  const draw = () => {
    body.innerHTML = "";
    const f = q.trim().toLowerCase();
    const rows = users.filter(u => (!f || (u.name||"").toLowerCase().includes(f) || (u.email||"").includes(f))
      && (!fs || (fs==="disabled" ? u.status!=="active" : accessState(acc[u.id])===fs && u.status==="active"))
      && (!fp || (acc[u.id]&&acc[u.id].planId)===fp))
      .sort((a,b)=>(b.lastActive||0)-(a.lastActive||0));
    rows.forEach(u => { const a = acc[u.id], st = u.status!=="active" ? "disabled" : accessState(a);
      body.append(h("tr",{onclick:()=>go("learner",{uid:u.id})},
        h("td",null, h("b",null,u.name||"—"), h("div",{class:"small muted"},u.email)),
        h("td",null, a ? planName(a.planId) : "—"), h("td",null, pill(st, stLabel(st))),
        h("td",{class:"tabnum"}, a ? (a.expiresAt ? fmtDate(a.expiresAt, lang()) : t("never")) : "—"),
        h("td",null, "HSK "+(u.level||1)), h("td",{class:"small muted"}, fmtDate(u.lastActive, lang()))));
    });
    if (!rows.length) body.append(h("tr",null,h("td",{colspan:"6",class:"muted"},t("no_rows"))));
  };
  const wrap = h("div");
  wrap.append(h("div",{class:"pagehead"}, h("div",{class:"spread"}, h("h1",null,t("adm_learners")+" ("+users.length+")"), canSupport() ? h("button",{class:"btn primary",onclick:newLearner}, icon("plus"), t("new_learner")) : null)),
    h("div",{class:"toolbar"},
      h("input",{class:"input grow",placeholder:t("search_learners"),value:q,oninput:debounce(e=>{q=e.target.value; draw();},120)}),
      h("select",{class:"input","aria-label":t("filter_status"),onchange:e=>{fs=e.target.value; draw();}}, [["",t("filter_status")+": "+t("all")],["active",t("active")],["expired",t("expired")],["suspended",t("suspended")],["cancelled",t("cancelled")],["disabled",t("disable")]].map(([v,l])=>h("option",{value:v},l))),
      h("select",{class:"input","aria-label":t("filter_plan"),onchange:e=>{fp=e.target.value; draw();}}, h("option",{value:""},t("filter_plan")+": "+t("all")), S.plans.map(pl=>h("option",{value:pl.id},planName(pl.id))))),
    h("div",{class:"tbl-wrap"}, h("table",{class:"tbl"}, h("thead",null,h("tr",null, [t("learner"),t("plan"),t("status"),t("expiry"),t("level"),t("last_active")].map(x=>h("th",null,x)))), body)));
  draw();
  return wrap;
}

async function newLearner(){
  const name = h("input",{class:"input"}), email = h("input",{class:"input",type:"email"}), pw = h("input",{class:"input",value:genPw()});
  const level = h("select",{class:"input"}, [1,2,3,4,5,6].map(n=>h("option",{value:n},"HSK "+n)));
  const plan = h("select",{class:"input"}, S.plans.map(p=>h("option",{value:p.id,selected:p.id===(S.settings.defaultPlanId||"free")},planName(p.id))));
  const exp = dateInput(Date.now()+365*DAY);
  const reset = h("input",{type:"checkbox",checked:S.api.mode!=="demo"});
  const msg = h("p",{class:"small",style:"color:var(--bad)"});
  await dialog({ title:t("new_learner"), body:h("div",{class:"stack"},
      fld(t("name"),name), fld(t("email"),email), fld(t("temp_pw"),pw),
      h("div",{class:"field-row"}, fld(t("level"),level), fld(t("plan"),plan), fld(t("expiry"),exp, t("never")+" = empty")),
      h("label",{class:"row small"}, reset, t("send_reset_after")), msg),
    actions:[{label:t("cancel"),value:false},{label:t("create"),primary:true,onClick:async()=>{
      try {
        const e = email.value.trim().toLowerCase(); if (!e || !name.value.trim()){ msg.textContent = t("name")+" / "+t("email")+"?"; return false; }
        const uid = await S.api.auth.createAccount(e, pw.value);
        const pl = S.plans.find(x=>x.id===plan.value) || { tier:1 };
        const now = new Date(), expires = readDate(exp);
        await S.api.db.batch([
          { op:"set", path:`users/${uid}`, data:{ email:e, name:name.value.trim(), status:"active", level:+level.value, role:"learner", prefs:{ uiLang: lang(), explainLang: lang() }, createdAt:now, createdBy:S.me.uid } },
          { op:"set", path:`access/${uid}`, data:{ planId:plan.value, tier:pl.tier||1, status:"active", start:now, expiresAt:expires, source:"manual", updatedAt:now, updatedBy:S.me.uid } },
          { op:"set", path:`subscriptions/${uid}-${now.getTime()}`, data:{ uid, planId:plan.value, action:"assign", start:now, expiresAt:expires, by:S.me.uid, at:now, source:"manual" } }
        ]);
        if (reset.checked){ try { await S.api.auth.resetPassword(e); } catch(err){} }
        toast(t("saved_ok")); go("learner",{uid}); return true;
      } catch(err){ msg.textContent = errText(err); return false; }
    }}] });
}

export async function viewLearner({ uid }){
  const api = S.api;
  const [u, a, subs, notesDoc, prog, events] = await Promise.all([
    api.db.get(`users/${uid}`), api.db.get(`access/${uid}`), api.db.list("subscriptions",{ where:[["uid","==",uid]] }).catch(()=>[]),
    api.db.get(`adminNotes/${uid}`).catch(()=>null), api.db.get(`progress/${uid}`).catch(()=>null),
    api.db.list(`progress/${uid}/events`,{ orderBy:["at","desc"], limit:100 }).catch(()=>[]) ]);
  if (!u) return h("div",{class:"banner"}, t("no_rows"));
  const wrap = h("div",{class:"stack-l"});
  const st = u.status!=="active" ? "disabled" : accessState(a);
  wrap.append(h("div",null, h("div",{class:"crumb"}, h("button",{onclick:()=>go("learners")}, t("adm_learners")), "›", h("span",null,u.name||u.email)),
    h("div",{class:"spread"}, h("div",null, h("h1",null,u.name||"—"), h("p",{class:"muted"}, u.email)),
      h("div",{class:"row"}, pill(st, stLabel(st)), h("span",{class:"chip lv"},"HSK "+(u.level||1))))));

  // profile
  const name = h("input",{class:"input",value:u.name||""});
  const level = h("select",{class:"input"}, [1,2,3,4,5,6].map(n=>h("option",{value:n,selected:(u.level||1)===n},"HSK "+n)));
  const profile = h("section",{class:"panel"}, h("h3",null,t("account_title")),
    h("div",{class:"field-row"}, fld(t("name"),name), fld(t("level"),level)),
    h("p",{class:"small muted"}, t("created")+": "+fmtDate(u.createdAt, lang())+" · "+t("last_active")+": "+fmtDate(u.lastActive, lang(), true)),
    canSupport() ? h("div",{class:"row"},
      h("button",{class:"btn primary",onclick:async()=>{ await api.db.update(`users/${uid}`,{ name:name.value.trim(), level:+level.value }); toast(t("saved_ok")); }}, t("save")),
      h("button",{class:"btn",onclick:async()=>{ try{ await api.auth.resetPassword(u.email); toast(t("reset_sent")); }catch(e){ toast(errText(e),"err"); } }}, t("reset_pw")),
      u.status==="active"
        ? h("button",{class:"btn ghost",style:"color:var(--bad)",onclick:async()=>{ if(await confirmDialog(t("disable"), u.email, t("disable"), t("cancel"), true)){ await api.db.update(`users/${uid}`,{status:"disabled"}); S.render(); } }}, t("disable"))
        : h("button",{class:"btn jade",onclick:async()=>{ await api.db.update(`users/${uid}`,{status:"active"}); S.render(); }}, t("enable"))) : null);

  // access
  const accBox = h("section",{class:"panel"}, h("h3",null,t("plan")),
    a ? h("dl",{class:"kv"}, h("dt",null,t("plan")), h("dd",null,h("b",null,planName(a.planId))," · tier "+a.tier), h("dt",null,t("status")), h("dd",null,pill(accessState(a), stLabel(accessState(a)))),
      h("dt",null,t("start")), h("dd",null,fmtDate(a.start, lang())), h("dt",null,t("expiry")), h("dd",null, a.expiresAt ? fmtDate(a.expiresAt, lang()) : t("never")), h("dt",null,""), h("dd",{class:"small muted"}, a.source||""))
      : h("p",{class:"muted"},"—"));
  if (canSupport()){
    const base = a && a.expiresAt && a.expiresAt > Date.now() ? a.expiresAt : Date.now();
    const setAccess = async (patch, action) => {
      const now = new Date(); const next = Object.assign({ planId:"free", tier:1, status:"active", start:now, expiresAt:null, source:"manual" }, a||{}, patch, { updatedAt:now, updatedBy:S.me.uid });
      ["start","expiresAt"].forEach(k => { if (typeof next[k]==="number") next[k] = new Date(next[k]); });
      await api.db.batch([
        { op:"set", path:`access/${uid}`, data: next },
        { op:"set", path:`subscriptions/${uid}-${now.getTime()}`, data:{ uid, planId:next.planId, action, start: next.start, expiresAt: next.expiresAt, status: next.status, by:S.me.uid, at:now, source:"manual" } } ]);
      toast(t("saved_ok")); S.render();
    };
    accBox.append(h("div",{class:"row"},
      h("button",{class:"btn primary",onclick:()=>assignDialog(a, setAccess)}, t("assign_plan")),
      h("button",{class:"btn sm",onclick:()=>setAccess({ expiresAt: base+30*DAY, status:"active" },"extend")}, t("ext_1m")),
      h("button",{class:"btn sm",onclick:()=>setAccess({ expiresAt: base+91*DAY, status:"active" },"extend")}, t("ext_3m")),
      h("button",{class:"btn sm",onclick:()=>setAccess({ expiresAt: base+365*DAY, status:"active" },"extend")}, t("ext_1y"))),
      h("div",{class:"row"},
        a && a.status==="active" ? h("button",{class:"btn sm",onclick:()=>setAccess({ status:"suspended" },"suspend")}, t("suspend")) : h("button",{class:"btn sm jade",onclick:()=>setAccess({ status:"active" },"reactivate")}, t("reactivate")),
        h("button",{class:"btn sm",onclick:()=>setAccess({ planId:"free", tier:1, status:"active", expiresAt:null },"free")}, t("grant_free")),
        h("button",{class:"btn sm ghost",style:"color:var(--bad)",onclick:async()=>{ if(await confirmDialog(t("cancel_access"),u.email,t("cancel_access"),t("cancel"),true)) setAccess({ status:"cancelled" },"cancel"); }}, t("cancel_access"))));
  }
  const hist = subs.sort((x,y)=>(y.at||0)-(x.at||0));
  accBox.append(h("details",null, h("summary",{class:"small"}, t("history")+" ("+hist.length+")"),
    h("div",{class:"feed"}, hist.map(s => h("div",{class:"feed-row"}, h("span",{class:"small"}, s.action+" · "+planName(s.planId)+" · "+(s.expiresAt?fmtDate(s.expiresAt,lang()):t("never"))), h("span",{class:"small muted"}, fmtDate(s.at, lang(), true)))))));

  // progress
  const sk = (prog && prog.skills) || {};
  const progBox = h("section",{class:"panel"}, h("h3",null,t("learner_progress")),
    h("div",{class:"stack",style:"gap:8px"}, SKILLS.map(k => { const s = sk[k]||{r:0,t:0}; const pct = s.t ? Math.round(100*s.r/s.t) : 0;
      return h("div",{class:"skill"}, h("span",null,t("sk_"+k)), h("div",{class:"bar"},h("i",{style:`width:${pct}%`})), h("span",{class:"tabnum small"}, s.t?pct+"%":"—")); })),
    h("p",{class:"small muted"}, t("lessons_done")+": "+Object.values((prog&&prog.lessons)||{}).filter(x=>x.done).length+" · "+t("patterns_learned")+": "+Object.keys((prog&&prog.patterns)||{}).length));
  const quizzes = events.filter(e=>e.type==="quiz");
  const resBox = h("section",{class:"panel"}, h("h3",null,t("quiz_results")),
    quizzes.length ? h("div",{class:"feed"}, quizzes.slice(0,15).map(e => h("div",{class:"feed-row"}, h("span",null, e.ref+" · ", h("b",null, e.score+"/"+e.total)), h("span",{class:"small muted"}, fmtDate(e.at, lang(), true))))) : h("p",{class:"muted"},t("no_rows")),
    h("details",null, h("summary",{class:"small"}, t("adm_activity")+" ("+events.length+")"), h("div",{class:"feed"}, events.slice(0,50).map(e => h("div",{class:"feed-row"}, h("span",{class:"small"}, e.type+" · "+(e.ref||"")+(e.skill?" · "+e.skill:"")), h("span",{class:"small muted"}, fmtDate(e.at, lang(), true)))))));

  // notes
  const notes = (notesDoc && notesDoc.notes) || [];
  const noteIn = h("textarea",{class:"input",placeholder:t("note_ph")});
  const notesBox = h("section",{class:"panel"}, h("h3",null,t("notes")),
    notes.length ? h("div",{class:"feed"}, notes.slice().reverse().map(n => h("div",{class:"feed-row"}, h("span",null,n.text), h("span",{class:"small muted"}, (n.by||"")+" · "+fmtDate(n.at, lang()))))) : h("p",{class:"muted small"},t("no_rows")),
    canSupport() ? h("div",{class:"stack",style:"gap:8px"}, noteIn, h("button",{class:"btn sm",style:"align-self:flex-start",onclick:async()=>{ if(!noteIn.value.trim()) return; await api.db.set(`adminNotes/${uid}`,{ notes:[...notes,{ text:noteIn.value.trim(), by:S.me.name||S.me.email, at:Date.now() }] }); S.render(); }}, t("add_note_admin"))) : null);

  wrap.append(h("div",{class:"grid2"}, h("div",{class:"stack"}, profile, accBox), h("div",{class:"stack"}, progBox, resBox, notesBox)));
  return wrap;
}

async function assignDialog(a, setAccess){
  const plan = h("select",{class:"input"}, S.plans.map(p=>h("option",{value:p.id,selected:a?a.planId===p.id:false},planName(p.id)+" (tier "+p.tier+")")));
  const start = dateInput(Date.now());
  const pl0 = S.plans.find(p=>p.id===(a?a.planId:S.plans[0]&&S.plans[0].id)) || {};
  const exp = dateInput(pl0.durationDays ? Date.now()+pl0.durationDays*DAY : null);
  plan.addEventListener("change", () => { const p = S.plans.find(x=>x.id===plan.value); exp.value = p && p.durationDays ? new Date(Date.now()+p.durationDays*DAY).toISOString().slice(0,10) : ""; });
  const tmp = h("input",{class:"input",type:"number",min:"1",placeholder:"7"});
  tmp.addEventListener("input", () => { const n=+tmp.value; if (n>0) exp.value = new Date(Date.now()+n*DAY).toISOString().slice(0,10); });
  await dialog({ title:t("assign_plan"), body:h("div",{class:"stack"}, fld(t("plan"),plan), h("div",{class:"field-row"}, fld(t("start"),start), fld(t("expiry"),exp, t("never")+" = empty")), fld(t("temporary"),tmp), h("p",{class:"small muted"},t("payments_note"))),
    actions:[{label:t("cancel"),value:false},{label:t("save"),primary:true,onClick:async()=>{ const p = S.plans.find(x=>x.id===plan.value); await setAccess({ planId:p.id, tier:p.tier||1, status:"active", start: readDate(start)||new Date(), expiresAt: readDate(exp) }, tmp.value ? "temporary" : "assign"); return true; }}] });
}
