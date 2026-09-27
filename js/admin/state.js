// Shared admin state
import { t, lang } from "../shared/i18n.js";
import { h } from "../shared/ui.js";
export const S = { api:null, me:null, view:"dashboard", params:{}, plans:[], settings:{}, bundle:{}, render:()=>{} };
export const L = pair => Array.isArray(pair) ? (lang()==="lo" && pair[1] ? pair[1] : pair[0]) : pair;
export const canContent = () => S.me && ["super","content"].includes(S.me.role);
export const canSupport = () => S.me && ["super","support"].includes(S.me.role);
export const isSuper = () => S.me && S.me.role==="super";
export function go(view, params={}){ S.view = view; S.params = params; S.render(); window.scrollTo(0,0); }
export async function refreshPlans(){ S.plans = (await S.api.db.list("plans")).sort((a,b)=>(a.order||0)-(b.order||0)); return S.plans; }
export const planName = id => { const p = S.plans.find(x=>x.id===id); return p ? (p.name && (p.name[lang()]||p.name.en)) || p.id : (id||"—"); };
export { t };
export const fld = (label, ctrl, help) => h("div",{class:"field"}, h("span",{class:"lbl"},label), ctrl, help ? h("span",{class:"help"},help) : null);
