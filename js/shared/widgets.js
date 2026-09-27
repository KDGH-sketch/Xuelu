// Shared learning widgets: sentences with word-by-word breakdown, the word sheet, stroke order.
import { h, $$, icon, pyHTML, isHan, esc, toast, tr } from "./ui.js";
import { t, lang } from "./i18n.js";
import { dict, chars, gloss, meaning, strokes, segment } from "./dict.js";
import { speak } from "./speech.js";

// The host app fills this in (bookmarks, navigation, explanation language…)
export const ctx = {
  exp: () => lang(),                    // explanation language
  isSaved: id => false, toggleSave: (id, data) => false,
  openPattern: n => {}, patterns: () => [], examples: () => [],
  track: (type, data) => {}
};
const POS = {n:"noun",v:"verb",adj:"adj",adv:"adv",prep:"prep",conj:"conj",part:"part",pron:"pron",num:"num",m:"m",t:"t",prop:"prop",loc:"loc",int:"int",idiom:"idiom",ph:"ph",mod:"mod",ono:"ono"};
export const posName = p => POS[p] ? t(POS[p]) : (p||"");
export const sentTr = s => typeof s.tr === "string" ? s.tr : (s.tr ? tr(s.tr, ctx.exp()) : (s.en||""));

export function markRanges(zh, markers=[]){
  const set = new Set(); let from = 0;
  for (const m of markers){ const i = zh.indexOf(m, from); if (i<0) continue; for (let k=i;k<i+m.length;k++) set.add(k); from = i+m.length; }
  return set;
}
// Make sure a sentence has tokens (segment + pinyin from the dictionary when missing)
export function ensureTokens(s, engine){
  if (s.tokens && s.tokens.length) return s;
  const toks = segment(s.zh).map(z => isHan(z[0]) ? { z, p: engine ? engine.tokPinyin(z) : (dict()[z]?dict()[z].p:"") } : { z, p:"" });
  return Object.assign({}, s, { tokens: toks });
}
export function toggleBtn(id, data, cls="ib"){
  const b = h("button",{class:cls,title:t("bookmark"),"aria-label":t("bookmark"),"aria-pressed":String(ctx.isSaved(id))}, icon("bookmark"));
  b.addEventListener("click", async () => { const on = await ctx.toggleSave(id, data); b.setAttribute("aria-pressed", String(on)); toast(on ? t("bookmarked") : "✓"); });
  return b;
}
export function sentenceEl(s, opts={}){
  const markers = opts.markers || [];
  const mset = markRanges(s.zh, markers);
  const zhEl = h("div",{class:"zh",lang:"zh-CN"}); let pos = 0;
  (s.tokens||[]).forEach(tk => {
    const mk = [...tk.z].some((_,k)=>mset.has(pos+k)); pos += tk.z.length;
    if (!isHan(tk.z[0])) zhEl.append(h("span",{class:"punct"}, tk.z));
    else zhEl.append(h("button",{class:"w"+(mk?" mk":""),onclick:()=>openWord(tk.z)}, tk.z));
  });
  const trText = sentTr(s);
  const main = h("div",{class:"sent-main"},
    opts.speaker ? h("span",{class:"speaker"}, opts.speaker) : null,
    zhEl, h("div",{class:"py",html:pyHTML(s.py)}), h("div",{class:"tr"+(ctx.exp()==="lo"?" lo":"")}, trText),
    opts.fix ? h("span",{class:"fix"}, t("source_fix")+": "+opts.fix) : null, opts.extra||null);
  const bd = h("div",{class:"bd",hidden:true});
  const actions = h("div",{class:"sent-actions"},
    h("button",{class:"ib",title:t("play"),"aria-label":t("play"),onclick:()=>{ speak(s.zh); ctx.track("listen",{zh:s.zh}); }}, icon("play")),
    h("button",{class:"ib hide-m",title:t("slow"),"aria-label":t("slow"),onclick:()=>speak(s.zh,{slow:1})}, icon("slow")),
    h("button",{class:"ib hide-m",title:t("repeat"),"aria-label":t("repeat"),onclick:()=>speak(s.zh,{times:3})}, icon("repeat")),
    h("button",{class:"ib",title:t("explore"),"aria-label":t("explore"),"aria-pressed":"false",onclick:e=>{ const on=bd.hidden; if (on && !bd.childElementCount) fillBreakdown(bd,s,mset); bd.hidden=!on; e.currentTarget.setAttribute("aria-pressed",String(on)); }}, icon("split")),
    opts.noSave ? null : toggleBtn("s:"+s.zh, { type:"sentence", zh:s.zh, py:s.py, tr: typeof s.tr==="object"?s.tr:{en:trText}, pn:s.pn||0 }));
  const el = h("div",{class:"sent"}, main, actions, bd);
  if (opts.open){ fillBreakdown(bd,s,mset); bd.hidden=false; }
  return el;
}
function fillBreakdown(bd, s, mset){
  let pos = 0;
  const roles = {}; (s.analysis||[]).forEach(a => roles[a.z] = a);
  (s.tokens||[]).forEach(tk => {
    const mk = [...tk.z].some((_,k)=>mset.has(pos+k)); pos += tk.z.length;
    if (!isHan(tk.z[0])) return;
    const d = dict()[tk.z], r = roles[tk.z];
    bd.append(h("div",{class:"bd-cell"+(mk?" mk":""),role:"button",tabindex:"0",onclick:()=>openWord(tk.z),onkeydown:e=>{ if (e.key==="Enter") openWord(tk.z); }},
      h("span",{class:"hz",lang:"zh-CN"}, tk.z), h("span",{class:"bd-py",html:pyHTML(tk.p)}),
      h("span",{class:"bd-gl"+(ctx.exp()==="lo"?" lo":"")}, gloss(tk.z, ctx.exp())),
      r ? h("span",{class:"bd-role"}, tr(r.role, ctx.exp())) : (d && d.pos ? h("span",{class:"bd-pos"}, posName(d.pos)) : null)));
  });
  const notes = (s.analysis||[]).filter(a=>a.note);
  if (notes.length) bd.append(h("div",{class:"bd-notes"}, notes.map(a => h("p",null, h("b",{class:"hz"},a.z), " — ", tr(a.note, ctx.exp())))));
}

// ---------- Word sheet ----------
let stack = [];
export function openWord(w, push=true){
  if (push) stack.push(w);
  closeSheet(false);
  ctx.track("word", { w });
  const scrim = h("div",{class:"scrim sheet-scrim",onclick:()=>closeSheet()});
  const sheet = h("aside",{class:"sheet",role:"dialog","aria-modal":"true","aria-label":w},
    h("div",{class:"sheet-h"},
      stack.length>1 ? h("button",{class:"ib","aria-label":t("back"),onclick:()=>{ stack.pop(); openWord(stack[stack.length-1], false); }}, icon("left")) : null,
      h("b",{class:"hz",style:"font-size:1.05rem"}, w), h("span",{style:"flex:1"}),
      toggleBtn("w:"+w, { type:"word", w }),
      h("button",{class:"ib","aria-label":t("close"),onclick:()=>closeSheet()}, icon("x"))),
    h("div",{class:"sheet-b"}, entryEl(w)));
  document.body.append(scrim, sheet);
}
export function closeSheet(all=true){ $$(".sheet-scrim,.sheet").forEach(e=>e.remove()); if (all) stack = []; }
document.addEventListener("keydown", e => { if (e.key==="Escape" && document.querySelector(".sheet")) closeSheet(); });

export function entryEl(w){
  const D = dict(), C = chars(), d = D[w], L = ctx.exp();
  const py = d ? d.p : [...w].map(c => C[c] ? C[c].p.split(",")[0] : "").join("");
  const box = h("div",{class:"stack"});
  box.append(h("div",{class:"entry-h"},
    h("div",{class:"row"}, h("span",{class:"big",lang:"zh-CN"}, w),
      h("button",{class:"btn sm",onclick:()=>speak(w)}, icon("play"), t("play")),
      h("button",{class:"btn sm","aria-label":t("slow"),onclick:()=>speak(w,{slow:1})}, icon("slow"))),
    h("div",{class:"epy",html:pyHTML(py)}),
    h("div",{class:"row"}, d&&d.pos?h("span",{class:"chip"},posName(d.pos)):null, d&&d.h?h("span",{class:"chip lv"},"HSK "+d.h):null, d&&d.n?h("span",{class:"chip"},t("new_hsk")+" "+(d.n>=7?"7–9":d.n)):null)));
  if (d){
    const kv = h("dl",{class:"kv"}, h("dt",null,"English"), h("dd",null,d.en));
    if (d.lo) kv.append(h("dt",null,t("lao")), h("dd",{class:"lo"},d.lo));
    if (d.zh) kv.append(h("dt",null,"中文"), h("dd",{class:"hz"},d.zh));
    if (d.alt) kv.append(h("dt",null,""), h("dd",{class:"muted small"},d.alt));
    box.append(kv);
    if (d.examples && d.examples.length){ const l=h("div"); d.examples.forEach(e=>l.append(sentenceEl(ensureTokens(e),{markers:[w]}))); box.append(h("div",{class:"sect"},h("h3",null,t("examples_label")),l)); }
  }
  const cs = [...w].filter(isHan);
  if (cs.length){
    const cc = h("div",{class:"charcards"});
    cs.forEach(c => { const ci = C[c]||{};
      cc.append(h("div",{class:"charcard"},
        h("button",{class:"cc",lang:"zh-CN","aria-label":c,onclick:()=>{ if (c!==w) openWord(c); else showStroke(box,c); }}, c),
        h("div",{class:"row"}, h("span",{html:pyHTML(ci.p||"")}), ci.s?h("span",{class:"muted small"},ci.s+" "+t("strokes")):null, ci.r?h("span",{class:"muted small"},t("radical")+" "+ci.r):null),
        h("div",{class:"small"}, ci.d||""),
        ci.x && ci.x!=="？" ? h("div",{class:"small muted"}, t("components")+": ", h("span",{class:"hz"}, ci.x.replace(/[⿰-⿻]/g," ").trim()), ci.hi ? " · "+ci.hi : "") : null));
    });
    box.append(h("div",{class:"sect"}, h("h3",null,t("chars_in")), cc));
    if (cs.length===1) showStroke(box, cs[0]);
    else box.append(h("div",{class:"row"}, cs.map(c => h("button",{class:"btn sm",onclick:()=>showStroke(box,c)}, t("stroke_play")+" "+c))));
  }
  if (w.length<=2){
    const comp = Object.keys(D).filter(k => k!==w && k.includes(w) && k.length<=4).sort((a,b)=>((D[a].h||9)-(D[b].h||9))||(D[a].fq-D[b].fq)).slice(0,14);
    if (comp.length) box.append(h("div",{class:"sect"}, h("h3",null,t("words_with")), h("div",{class:"wordchips"}, comp.map(k => h("button",{onclick:()=>openWord(k)}, h("span",{class:"hz"},k)," ", h("span",{class:"small",html:pyHTML(D[k].p)}))))));
  }
  const ex = ctx.examples().filter(e => (e.tokens||[]).some(tk=>tk.z===w)).slice(0,4);
  if (ex.length){ const l=h("div"); ex.forEach(e=>l.append(sentenceEl(e,{markers:[w]}))); box.append(h("div",{class:"sect"},h("h3",null,t("in_sentences")),l)); }
  const pats = ctx.patterns().filter(p => (p.markers||[]).includes(w)).slice(0,6);
  if (pats.length) box.append(h("div",{class:"sect"}, h("h3",null,t("in_patterns")), h("div",{class:"wordchips"}, pats.map(p => h("button",{onclick:()=>{ closeSheet(); ctx.openPattern(p.n); }}, "#"+p.n+" ", h("span",{class:"hz"},p.hz))))));
  return box;
}
export async function showStroke(box, c, opts={}){
  let wrap = box.querySelector(".hw-box"); if (wrap) wrap.remove();
  wrap = h("div",{class:"hw-box"}); box.append(wrap);
  const S = await strokes(); const data = S[c];
  if (!data || !window.HanziWriter){ wrap.append(h("p",{class:"small muted"}, t("no_strokes"))); return null; }
  const target = h("div",{class:"hw-target"});
  const cs = getComputedStyle(document.documentElement);
  let writer;
  wrap.append(target, h("div",{class:"row"},
    h("button",{class:"btn sm",onclick:()=>{ try{ writer.cancelQuiz(); }catch(e){} writer.showCharacter(); writer.animateCharacter(); }}, icon("play"), t("stroke_play")),
    h("button",{class:"btn sm",onclick:()=>{ writer.hideCharacter(); writer.quiz({ onComplete: s => { toast(t("correct")); ctx.track("write",{c, mistakes:s.totalMistakes}); } }); }}, icon("pen"), t("stroke_quiz"))));
  const size = Math.min(220, target.clientWidth||220);
  writer = HanziWriter.create(target, c, { width:size, height:size, padding:12, showOutline:true, strokeAnimationSpeed:1.1, delayBetweenStrokes:180,
    strokeColor: cs.getPropertyValue("--ink").trim()||"#222", radicalColor: cs.getPropertyValue("--accent").trim()||"#b33",
    outlineColor: cs.getPropertyValue("--surface-3").trim()||"#ddd", drawingColor: cs.getPropertyValue("--t1").trim()||"#36c",
    charDataLoader: (ch, done) => done(S[ch]) });
  if (!opts.noAnimate) setTimeout(() => writer.animateCharacter(), 250);
  return writer;
}
