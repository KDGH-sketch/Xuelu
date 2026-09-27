// Platform setup: first Super Admin, starter content import, and demo-mode sample data.
import { buildBundles, TIERS } from "./content.js";

export async function bootstrapOwner(api, user, name){
  const now = new Date();
  await api.db.batch([
    { op:"set", path:`admins/${user.uid}`, data:{ role:"super", email:user.email, name: name||"", createdAt: now, addedBy: user.uid } },
    { op:"set", path:`users/${user.uid}`, data:{ email:user.email, name: name||"", status:"active", level:1, role:"admin", prefs:{}, createdAt: now, lastActive: now } },
    { op:"set", path:"settings/bootstrap", data:{ at: now, uid: user.uid } }
  ]);
  await api.db.set("settings/app", { appName:"Xuélù", allowRegistration:false, defaultPlanId:"free", supportContact:"" }, true);
}

export async function importSeed(api, who, onStep=()=>{}){
  onStep("download");
  const seed = await fetch(new URL("../../data/seed.json", import.meta.url)).then(r=>r.json());
  const now = new Date(), ops = [];
  const meta = { version:1, createdAt: now, updatedAt: now, createdBy: who, updatedBy: who };
  for (const type of ["patterns","lessons","grammar","vocabulary","dialogues","quizzes","audio","paths","releases","lexicon"]){
    for (const item of (seed[type]||[])){ const { id, ...rest } = item; ops.push({ op:"set", path:`${type}/${id}`, data: Object.assign(rest, meta) }); }
  }
  for (const p of seed.plans){ const { id, ...rest } = p; ops.push({ op:"set", path:`plans/${id}`, data: rest }); }
  ops.push({ op:"set", path:"settings/app", data: seed.settings, merge:true });
  onStep("write");
  await api.db.batch(ops);
  onStep("publish");
  await buildBundles(api, who, onStep);
  return ops.length;
}

// Demo mode: one-time sample platform in this browser
export const DEMO = { admin:{ email:"admin@demo.xuelu", pw:"demo1234", name:"Demo Owner" },
  premium:{ email:"learner@demo.xuelu", pw:"demo1234", name:"Noy Phommachanh" },
  free:{ email:"free@demo.xuelu", pw:"demo1234", name:"Somsack Inthavong" } };
export async function ensureDemo(api, onStep=()=>{}){
  if (api.mode !== "demo" || !api._isEmpty()) return false;
  onStep("demo");
  const adminUid = await api.auth.createAccount(DEMO.admin.email, DEMO.admin.pw);
  await bootstrapOwner(api, { uid: adminUid, email: DEMO.admin.email }, DEMO.admin.name);
  await importSeed(api, adminUid, onStep);
  const now = Date.now(), year = 365*86400000;
  for (const [key, plan, tier, level, days] of [["premium","premium",3,2,Math.round(400)],["free","free",1,1,0]]){
    const d = DEMO[key]; const uid = await api.auth.createAccount(d.email, d.pw);
    await api.db.batch([
      { op:"set", path:`users/${uid}`, data:{ email:d.email, name:d.name, status:"active", level, role:"learner", prefs:{ uiLang: key==="premium"?"lo":"en", explainLang: key==="premium"?"lo":"en" }, createdAt: new Date(now-40*86400000), lastActive: new Date(now-3600000) } },
      { op:"set", path:`access/${uid}`, data:{ planId:plan, tier, status:"active", start: new Date(now-40*86400000), expiresAt: days? new Date(now+days*86400000-40*86400000) : null, source:"manual", updatedAt: new Date(), updatedBy: adminUid } },
      { op:"set", path:`subscriptions/demo-${key}`, data:{ uid, planId:plan, action:"assign", start: new Date(now-40*86400000), expiresAt: days? new Date(now+days*86400000-40*86400000) : null, by: adminUid, at: new Date(now-40*86400000), source:"manual" } },
      { op:"set", path:`adminNotes/${uid}`, data:{ notes:[{ text: key==="premium" ? "Paid in cash for 1 year. Prefers Lao explanations." : "Trial account from the workshop.", by: DEMO.admin.name, at: now-39*86400000 }] } }
    ]);
    if (key==="premium"){
      // a little history so dashboards have something to show
      await api.db.set(`progress/${uid}`, { skills:{ vocabulary:{r:34,t:41}, grammar:{r:22,t:30}, listening:{r:9,t:15}, reading:{r:12,t:14}, sentence:{r:10,t:16}, pinyin:{r:18,t:20}, speaking:{r:2,t:4}, writing:{r:3,t:6}, characters:{r:4,t:5} },
        lessons:{ "hsk1-greetings":{ done:true, at: now-5*86400000, score:8, total:9 }, "hsk1-drinks":{ done:true, at: now-2*86400000, score:5, total:6 } },
        patterns:{ "97":now-6*86400000, "117":now-6*86400000, "118":now-5*86400000, "11":now-2*86400000, "81":now-2*86400000, "169":now-2*86400000 },
        last:{ type:"lesson", id:"hsk1-travel", at: now-86400000 }, days:{ [dk(now-3*86400000)]:1, [dk(now-2*86400000)]:1, [dk(now-86400000)]:1 }, answers:{ r:114, t:151 } });
      for (const [type,ref,sk,ok,score,total,ago] of [["quiz","q-greetings","vocabulary",true,8,9,5],["quiz","q-drinks","grammar",true,5,6,2],["lesson","hsk1-greetings","",true,0,0,5],["lesson","hsk1-drinks","",true,0,0,2]]){
        await api.db.add(`progress/${uid}/events`, { type, ref, skill:sk, correct:ok, score, total, at: new Date(now-ago*86400000) });
        await api.db.add("activity", { uid, name:d.name, type, ref, score, total, at: new Date(now-ago*86400000) });
      }
    }
  }
  await api.auth.signOut();
  if (api._flush) await api._flush();
  return true;
}
const dk = ms => { const d = new Date(ms); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
