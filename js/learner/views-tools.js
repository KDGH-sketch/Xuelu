// Learner views: generator, practice & quizzes, dictionary, pinyin, characters, pronunciation, review,
// saved items, notes, progress, offline downloads, account.
import { h, $$, icon, toast, pyHTML, tr, stripTone, fmtDate, isHan, debounce, rnd, shuffle, errText, dialog } from "../shared/ui.js";
import { t, lang } from "../shared/i18n.js";
import { dict, chars, strokes, searchDict, meaning } from "../shared/dict.js";
import { speak, voices, canListen } from "../shared/speech.js";
import { sentenceEl, openWord, entryEl, ensureTokens } from "../shared/widgets.js";
import { runQuiz, toneSVG } from "../shared/quiz.js";
import { SKILLS, accessState, cacheGet } from "../shared/content.js";
import { A, T, expLang, prefs, setPref, srsDue, srsGrade, streak, skillPct, genSentence, genMany, exampleOf, recordAnswer, quizDone, logEvent, touchDay,
  tierName, isSaved, toggleSave, wordsMastered, srsAdd } from "./core.js";
import { achievementsEl } from "./views-learn.js";

export const VIEWS = {};
const go = (...a) => A.go(...a);
const pageHead = (title, sub, extra) => h("div",{class:"pagehead"}, h("div",{class:"spread"}, h("h1",null,title), extra||null), sub ? h("p",null,sub) : null);
const pMeaning = p => T({ en:p.tr.en.meaning, lo:p.tr.lo&&p.tr.lo.meaning });

// ---------- question generators (pattern drills) ----------
function sentFrom(pool){ const p = rnd(pool); const s = Math.random()<0.7 ? genSentence(p) : null; return s || exampleOf(p, rnd(p.examples)); }
const trOf = s => s.tr && typeof s.tr==="object" ? s.tr : { en: s.en };
function distinct(pool, s, n, key){ const out = new Map(); for (let i=0;i<40 && out.size<n;i++){ const x = sentFrom(pool); const k = key(x); if (k && k!==key(s)) out.set(k, x); } return [...out.values()]; }
const linkTo = s => s.pn ? h("button",{class:"btn sm ghost",onclick:()=>go("pattern",{n:s.pn})}, "#"+s.pn+" "+t("open_pattern")) : null;
const reveal = s => () => h("div",null, h("div",{class:"hz",style:"font-size:1.3rem"},s.zh), h("div",{html:pyHTML(s.py)}), h("div",{class:"muted"}, tr(trOf(s), expLang())));
const MAKERS = {
  order: pool => { const s = sentFrom(pool); const toks = (s.tokens||[]).filter(x=>isHan(x.z[0])); if (toks.length<3 || toks.length>11) return null;
    return { type:"order", skill:"sentence", tokens:toks, answer:toks.map(x=>x.z).join(""), prompt:{ tr:trOf(s), py:s.py }, ask:{en:t("pr_order_d")}, say:s.zh, link:linkTo(s) }; },
  blank: pool => { const p = rnd(pool.filter(x=>x.markers.length)); if (!p) return null; const s = Math.random()<.6 ? genSentence(p) : exampleOf(p, rnd(p.examples)); if (!s) return null;
    const mk = p.markers.find(m => (s.tokens||[]).some(tk=>tk.z===m)); if (!mk) return null;
    const others = shuffle([...new Set(Object.values(A.P).filter(x=>x.n!==p.n).flatMap(x=>x.markers).filter(m=>m!==mk && Math.abs(m.length-mk.length)<=1 && !p.markers.includes(m)))]).slice(0,3);
    let done=false; const zh = s.tokens.map(tk => { if (!done && tk.z===mk){ done=true; return "___"; } return tk.z; }).join("");
    return { type:"fill", skill:"grammar", prompt:{ zh, tr:trOf(s) }, options:[mk,...others], answer:0, ask:{en:t("pr_blank_d")+" · "+p.hz}, reveal:reveal(s), say:s.zh, link:linkTo(s) }; },
  meaning: pool => { const s = sentFrom(pool); const d = distinct(pool, s, 3, x=>tr(trOf(x),expLang())); if (d.length<3) return null;
    return { type:"mc", skill:"reading", prompt:{ zh:s.zh, py:s.py }, options:[trOf(s), ...d.map(trOf)], answer:0, ask:{en:t("pr_meaning_d")}, say:s.zh, link:linkTo(s) }; },
  reverse: pool => { const s = sentFrom(pool); const d = distinct(pool, s, 3, x=>x.zh); if (d.length<3) return null;
    return { type:"mc", skill:"writing", prompt:{ tr:trOf(s) }, options:[{zh:s.zh}, ...d.map(x=>({zh:x.zh}))], answer:0, ask:{en:t("pr_reverse_d")}, reveal:reveal(s), say:s.zh, link:linkTo(s) }; },
  listen: pool => { const s = sentFrom(pool); const d = distinct(pool, s, 3, x=>x.zh); if (d.length<3) return null;
    return { type:"listen_select", skill:"listening", prompt:{ zh:s.zh }, options:[s.zh, ...d.map(x=>x.zh)], answer:0, reveal:reveal(s), link:linkTo(s) }; },
  pattern: pool => { const p = rnd(pool); const s = genSentence(p) || exampleOf(p, rnd(p.examples)); const others = shuffle(Object.values(A.P).filter(x=>x.n!==p.n && x.sec===p.sec)).slice(0,3); if (others.length<3) return null;
    return { type:"mc", skill:"grammar", prompt:{ zh:s.zh, py:s.py }, options:[p,...others].map(x=>({ en:x.hz+" — "+x.tr.en.meaning, lo:x.hz+" — "+((x.tr.lo&&x.tr.lo.meaning)||x.tr.en.meaning) })), answer:0, ask:{en:t("pr_pattern_d")}, link:linkTo(s) }; },
  speak: pool => { const s = sentFrom(pool); if (s.zh.length>16) return null; return { type:"speak", skill:"speaking", prompt:{ zh:s.zh, py:s.py, tr:trOf(s) }, link:linkTo(s) }; }
};
export function patternQuestions(pats, n, types=["order","blank","meaning","listen","reverse"]){
  const qs = []; for (let i=0;i<n;i++){ let q=null; for (let k=0;k<8 && !q;k++){ try { q = MAKERS[rnd(types)](pats); } catch(e){} } if (q) qs.push(q); } return qs;
}
function wordQuestions(n){
  const D = dict(), L = A.profile.level||1, EL = expLang();
  const pool = Object.keys(D).filter(k => D[k].h && D[k].h<=Math.max(2,L) && D[k].en.length<60 && k.length<=3);
  const mean = k => ({ en:D[k].en.split(";")[0], lo:(D[k].lo||D[k].en).split(";")[0] });
  return Array.from({length:n}, () => { const w = rnd(pool), o = shuffle(pool.filter(x=>x!==w)).slice(0,3); const m = rnd(["mean","py","hz"]);
    if (m==="mean") return { type:"mc", skill:"vocabulary", prompt:{ zh:w, py:D[w].p }, options:[mean(w), ...o.map(mean)], answer:0, w };
    if (m==="py") return { type:"mc", skill:"pinyin", prompt:{ zh:w }, options:[{en:D[w].p}, ...o.map(k=>({en:D[k].p}))], answer:0, w };
    return { type:"mc", skill:"characters", prompt:{ tr:mean(w), py:D[w].p }, options:[{zh:w}, ...o.map(k=>({zh:k}))], answer:0, w }; });
}
const TONE_SET = [["妈","mā",1],["麻","má",2],["马","mǎ",3],["骂","mà",4],["汤","tāng",1],["糖","táng",2],["躺","tǎng",3],["烫","tàng",4],["衣","yī",1],["姨","yí",2],["椅","yǐ",3],["意","yì",4],["书","shū",1],["熟","shú",2],["鼠","shǔ",3],["树","shù",4],["八","bā",1],["拔","bá",2],["把","bǎ",3],["爸","bà",4],["天","tiān",1],["甜","tián",2],["舔","tiǎn",3],["电","diàn",4],["他","tā",1],["来","lái",2],["好","hǎo",3],["去","qù",4],["吃","chī",1],["茶","chá",2],["我","wǒ",3],["大","dà",4]];
const toneQuestions = n => shuffle(TONE_SET).slice(0,n).map(([z,p,a]) => ({ type:"tone", skill:"pinyin", prompt:{ zh:z, py:p }, answer:a }));
async function writeQuestions(n){ const S = await strokes(); const D = dict(); const lv = A.profile.level||1;
  const pool = Object.keys(D).filter(k => k.length===1 && S[k] && D[k].h && D[k].h<=Math.max(2,lv));
  return shuffle(pool).slice(0,n).map(c => ({ type:"write_char", skill:"characters", prompt:{ zh:c, py:D[c].p, tr:{ en:D[c].en.split(";")[0], lo:(D[c].lo||"").split(";")[0] } }, ask:{ en:(D[c].en.split(";")[0])+" · "+D[c].p, lo:((D[c].lo||D[c].en).split(";")[0])+" · "+D[c].p } })); }

// ---------- generator ----------
VIEWS.gen = () => {
  const sel = new Set((A.genSel||[]).filter(n=>A.P[n])); if (!sel.size){ const first = Object.values(A.P).find(p=>p.level>=(A.profile.level||1)) || Object.values(A.P)[0]; if (first) sel.add(first.n); }
  let lvF = new Set(), q = "", count = 5;
  const listBox = h("div",{class:"plist-s"}), results = h("div"), info = h("span",{class:"muted small"});
  const selInfo = () => { info.textContent = sel.size+" "+t("patterns"); A.genSel = [...sel]; };
  const drawList = () => { listBox.innerHTML=""; const f = q.trim().toLowerCase();
    Object.values(A.P).sort((a,b)=>a.n-b.n).filter(p => (!lvF.size||lvF.has(p.level)) && (!f || String(p.n)===f || p.hz.includes(q.trim()) || pMeaning(p).toLowerCase().includes(f) || stripTone(p.py).includes(stripTone(f)))).forEach(p =>
      listBox.append(h("label",{class:"pick"}, h("input",{type:"checkbox",checked:sel.has(p.n),"aria-label":p.hz,onchange:e=>{ e.target.checked ? sel.add(p.n) : sel.delete(p.n); selInfo(); }}), h("span",{class:"pn"},"#"+p.n), h("span",null, h("span",{class:"hz",lang:"zh-CN"},p.hz), h("small",{class:expLang()==="lo"?"lo":""},pMeaning(p)))))); };
  const run = append => { if (!sel.size){ toast(t("gen_empty")); return; } if (!append) results.innerHTML="";
    const ps = [...sel].map(n=>A.P[n]).filter(Boolean); const grp = h("div",{class:"gen-group"}); results.append(grp);
    for (let i=0;i<count;i++){ const p = rnd(ps); const s = genSentence(p); if (!s) continue; const el = sentenceEl(s, { markers:p.markers }); el.querySelector(".sent-main").prepend(h("button",{class:"sent-src",style:"border:0;background:none;padding:0;text-align:left",onclick:()=>go("pattern",{n:p.n})},"#"+p.n+" "+p.hz)); grp.append(el); }
    logEvent("generate", { ref:[...sel].slice(0,5).join(",") }); touchDay(); };
  const lvChips = h("div",{class:"lvchips"}, [1,2,3,4,5,6].map(L => h("button",{"aria-pressed":"false",onclick:e=>{ lvF.has(L)?lvF.delete(L):lvF.add(L); e.currentTarget.setAttribute("aria-pressed",String(lvF.has(L))); drawList(); }},"HSK "+L)));
  const cnt = h("span",{class:"tabnum",style:"min-width:2ch;font-weight:700"},count);
  const picker = h("aside",{class:"picker"}, h("input",{class:"input",placeholder:t("filter_ph"),oninput:debounce(e=>{ q=e.target.value; drawList(); },120)}), lvChips, listBox,
    h("div",{class:"spread"}, info, h("div",{class:"row"}, h("button",{class:"btn sm",onclick:()=>{ $$("input[type=checkbox]",listBox).forEach(c=>{ if(!c.checked){ c.checked=true; c.dispatchEvent(new Event("change")); } }); }}, t("gen_all")), h("button",{class:"btn sm ghost",onclick:()=>{ sel.clear(); drawList(); selInfo(); }}, t("gen_clear")))));
  const bar = h("div",{class:"gen-bar"}, h("label",{class:"row",style:"gap:8px"}, h("span",{class:"small muted"},t("gen_count")), h("input",{type:"range",min:"1",max:"20",value:count,"aria-label":t("gen_count"),oninput:e=>{ count=+e.target.value; cnt.textContent=count; }}), cnt),
    h("span",{style:"flex:1"}), h("button",{class:"btn primary",onclick:()=>run(false)}, icon("spark"), t("generate")), h("button",{class:"btn",onclick:()=>run(true)}, t("gen_more")));
  drawList(); selInfo(); setTimeout(()=>run(false));
  return h("div",null, pageHead(t("gen_title"), t("gen_sub")), h("div",{class:"gen-layout"}, picker, h("div",{class:"stack"}, bar, results)));
};

// ---------- practice ----------
const PTYPES = [["order","句","pr_order"],["blank","空","pr_blank"],["listen","听","pr_listen"],["meaning","意","pr_meaning"],["reverse","说","pr_reverse"],["pattern","型","pr_pattern"],["words","词","pr_words"],["tones","调","pr_tones"],["write","写","stroke_quiz"],["speak","读","nav_speak"]];
VIEWS.practice = ({ type }) => {
  const root = h("div");
  if (type) return startPractice(root, type);
  const quizzes = Object.values(A.byType.quizzes||{}).sort((a,b)=>(a.level-b.level)||((a.order||0)-(b.order||0)));
  root.append(pageHead(t("practice_title"), t("practice_sub")),
    h("div",{class:"grid2"}, PTYPES.map(([k,ic,l]) => h("button",{class:"pcard",onclick:()=>go("practice",{type:k})}, h("span",{class:"qi",lang:"zh-CN"},ic), h("div",null, h("b",null,t(l)), h("span",null, t(l+"_d")!==l+"_d" ? t(l+"_d") : ""))))),
    h("div",{style:"margin-top:14px"}, h("button",{class:"btn primary",onclick:()=>go("practice",{type:"mix"})}, icon("spark"), t("start")+" · mix")),
    quizzes.length ? h("section",{class:"sect",style:"margin-top:28px"}, h("h2",null,t("quiz")), h("div",{class:"list-card"}, quizzes.map(q => { const r = A.prog.lessons["quiz:"+q.id];
      return h("button",{class:"item-row",onclick:()=>go("quiz",{id:q.id})}, h("span",{class:"stepnum"+(r?" done":"")}, r?icon("check"):icon("star")), h("span",null, h("div",{class:"ttl"},T(q.title)), h("div",{class:"sub"}, "HSK "+q.level+" · "+(q.questions||[]).length+" "+t("questions").toLowerCase()+(r?" · "+r.score+"/"+r.total:""))), icon("right")); }))) : null);
  return root;
};
function startPractice(root, type){
  const lv = A.profile.level || 1, learned = Object.keys(A.prog.patterns).map(Number).filter(n=>A.P[n]);
  let pool = learned.length>=4 ? learned.map(n=>A.P[n]) : Object.values(A.P).filter(p=>p.level<=Math.max(2,lv));
  if (pool.length<4) pool = Object.values(A.P);
  const box = h("div",{class:"quiz"});
  root.append(h("div",{class:"spread",style:"margin-bottom:10px"}, h("button",{class:"btn sm ghost",onclick:()=>go("practice",{},false)}, icon("left"), t("back"))), box);
  const make = async () => type==="words" ? wordQuestions(10) : type==="tones" ? toneQuestions(10) : type==="write" ? await writeQuestions(6)
    : type==="mix" ? shuffle([...patternQuestions(pool, 7, ["order","blank","meaning","listen","reverse","pattern"]), ...wordQuestions(3)]) : patternQuestions(pool, 10, [type]);
  const start = async () => { const qs = await make(); runQuiz(box, qs, { onAnswer:(q,ok)=>{ recordAnswer(q.skill, ok); if (!ok && q.w) srsAdd("w:"+q.w,{type:"w",w:q.w}); if (!ok && q.say) srsAdd("s:"+q.say,{type:"s",zh:q.say}); },
    onFinish:r => logEvent("practice", { ref:type, score:r.right, total:r.total }, true), onAgain:start, onExit:()=>go("practice",{},false) }); };
  start();
  return root;
}
VIEWS.quiz = ({ id }) => {
  const q = A.byType.quizzes[id]; if (!q) return h("div",{class:"empty"},t("no_rows"));
  const box = h("div",{class:"quiz"});
  const start = () => runQuiz(box, q.questions||[], { title:T(q.title), onAnswer:(qq,ok)=>recordAnswer(qq.skill, ok),
    onFinish:r => { A.prog.lessons["quiz:"+id] = { done:true, at:Date.now(), score:r.right, total:r.total }; quizDone(id, r.right, r.total); }, onAgain:start, onExit:()=>A.back() });
  start();
  return h("div",null, h("div",{class:"crumb"}, h("button",{onclick:()=>go("practice")},t("nav_practice")), "›", h("span",null,T(q.title))), box);
};

// ---------- dictionary ----------
VIEWS.dict = ({ q="" }) => {
  const res = h("div"), EL = expLang();
  const listEl = keys => { const D = dict(); return h("div",{class:"dres"}, keys.map(k => h("button",{onclick:()=>openWord(k)}, h("span",{class:"hz",lang:"zh-CN"},k), h("span",{html:pyHTML(D[k].p)}), h("span",{class:"gl"+(EL==="lo"&&D[k].lo?" lo":"")}, meaning(k,EL)), D[k].h ? h("span",{class:"chip lv"},"HSK "+D[k].h) : h("span")))); };
  const draw = () => { res.innerHTML="";
    if (!q.trim()){ const D = dict(); res.append(h("h3",{style:"margin:6px 0 10px"},"HSK 1"), listEl(Object.keys(D).filter(k=>D[k].h===1).sort((a,b)=>D[a].fq-D[b].fq).slice(0,60))); return; }
    const hits = searchDict(q, 60); if (!hits.length){ res.append(h("div",{class:"empty"},t("search_none"))); return; }
    if (dict()[q.trim()]) res.append(h("div",{class:"card",style:"margin-bottom:16px"}, entryEl(q.trim())));
    res.append(h("p",{class:"muted small",style:"margin-bottom:8px"}, hits.length+" "+t("results")), listEl(hits)); };
  draw();
  return h("div",null, pageHead(t("dict_title"), t("dict_sub")), h("input",{class:"input",style:"font-size:1.1rem;padding:12px 14px;margin-bottom:16px",placeholder:t("search_ph"),value:q,oninput:debounce(e=>{ q=e.target.value; draw(); },140)}), res);
};

// ---------- pinyin ----------
VIEWS.pinyin = () => {
  const root = h("div",{class:"stack-l"});
  root.append(pageHead(t("pinyin_title"), t("pinyin_sub")));
  const tones = [[1,"mā","妈","mom"],[2,"má","麻","hemp"],[3,"mǎ","马","horse"],[4,"mà","骂","scold"]];
  root.append(h("section",{class:"sect"}, h("h2",null,t("tones")), h("div",{class:"grid4"}, tones.map(([n,sy,ch,en]) => h("button",{class:"tonecard",onclick:()=>speak(ch)}, toneSVG(n), h("span",{class:"syl t"+n},sy), h("span",{class:"ex",lang:"zh-CN"},ch), h("span",{class:"small muted"}, t("tone"+n)+" · "+en)))),
    h("div",{class:"row"}, h("button",{class:"btn sm",onclick:()=>speak("妈麻马骂")}, icon("play"), "mā má mǎ mà"), h("button",{class:"btn sm",onclick:()=>speak("吗")}, icon("play"), t("tone_n")+": ma 吗"))));
  const INI = [["b","爸","bà"],["p","跑","pǎo"],["m","妈","mā"],["f","飞","fēi"],["d","大","dà"],["t","他","tā"],["n","你","nǐ"],["l","来","lái"],["g","哥","gē"],["k","看","kàn"],["h","好","hǎo"],["j","家","jiā"],["q","去","qù"],["x","小","xiǎo"],["zh","中","zhōng"],["ch","吃","chī"],["sh","是","shì"],["r","人","rén"],["z","在","zài"],["c","菜","cài"],["s","四","sì"],["y","有","yǒu"],["w","我","wǒ"]];
  const FIN = [["a","啊","a"],["o","哦","ó"],["e","饿","è"],["i","衣","yī"],["u","五","wǔ"],["ü","鱼","yú"],["ai","爱","ài"],["ei","累","lèi"],["ao","好","hǎo"],["ou","狗","gǒu"],["an","看","kàn"],["en","门","mén"],["ang","忙","máng"],["eng","冷","lěng"],["ong","东","dōng"],["ia","家","jiā"],["ie","谢","xiè"],["iao","小","xiǎo"],["iu","六","liù"],["ian","天","tiān"],["in","新","xīn"],["iang","想","xiǎng"],["ing","听","tīng"],["iong","熊","xióng"],["ua","花","huā"],["uo","多","duō"],["uai","快","kuài"],["ui","对","duì"],["uan","晚","wǎn"],["un","春","chūn"],["uang","黄","huáng"],["üe","学","xué"],["üan","远","yuǎn"],["ün","云","yún"],["er","二","èr"]];
  const cell = ([a,ch,py]) => h("button",{class:"scell",onclick:()=>{ speak(ch); recordAnswer("pinyin", true); }}, h("b",null,a), h("span",{class:"hz",lang:"zh-CN"},ch), h("small",{html:pyHTML(py)}));
  root.append(h("section",{class:"sect"}, h("h2",null,t("initials")+" · 声母"), h("div",{class:"sgrid"}, INI.map(cell))), h("section",{class:"sect"}, h("h2",null,t("finals")+" · 韵母"), h("div",{class:"sgrid"}, FIN.map(cell))));
  const rule = (title, txt, ex) => h("div",{class:"rule"}, h("h3",null,title), h("p",{class:"muted"},txt), h("div",{class:"row"}, ex.map(([zh,py]) => h("button",{class:"btn sm",onclick:()=>speak(zh)}, icon("play"), h("span",{class:"hz"},zh), " ", h("span",{html:pyHTML(py)})))));
  root.append(h("section",{class:"sect"}, h("h2",null,t("sandhi")),
    rule("3 + 3 → 2 + 3","Two third tones in a row: the first is said as a rising second tone. Pinyin keeps the original marks.",[["你好","nǐ hǎo → ní hǎo"],["很好","hěn hǎo → hén hǎo"]]),
    rule("不 bù → bú","不 becomes second tone before a fourth tone. This app writes the changed tone.",[["不是","bú shì"],["不去","bú qù"],["不好","bù hǎo"]]),
    rule("一 yī → yí / yì","一 becomes yí before a fourth tone and yì before tones 1–3. When counting (一, 十一, 第一) it stays yī.",[["一个","yí ge"],["一起","yìqǐ"],["一天","yì tiān"],["第一","dì-yī"]]),
    rule(t("tone_n"),"Some syllables lose their tone and are said short and light: particles (的 了 吗 呢) and the second half of many words.",[["妈妈","māma"],["东西","dōngxi"],["我的","wǒ de"]])));
  root.append(h("section",{class:"card spread"}, h("div",null,h("h3",null,t("tone_quiz")),h("p",{class:"muted small"},t("pr_tones_d"))), h("button",{class:"btn primary",onclick:()=>go("practice",{type:"tones"})}, t("start"), icon("right"))));
  return root;
};

// ---------- characters ----------
VIEWS.chars = () => {
  const root = h("div"); const grid = h("div",{class:"stack-l"},h("p",{class:"muted"},t("loading")));
  root.append(pageHead(t("chars_title"), t("chars_sub"), h("button",{class:"btn",onclick:()=>go("practice",{type:"write"})}, icon("pen"), t("stroke_quiz"))), grid);
  strokes().then(ST => { const D = dict(); const lvOf = {};
    for (const k in D){ const L = D[k].h; if (!L) continue; for (const c of k) if (ST[c] && (!lvOf[c] || L<lvOf[c])) lvOf[c] = L; }
    const groups = {1:[],2:[],3:[],x:[]}; Object.keys(ST).forEach(c => { const L = lvOf[c]; (L&&L<=3?groups[L]:groups.x).push(c); });
    const fq = c => D[c] ? D[c].fq : 99999; grid.innerHTML = "";
    [[1,"HSK 1"],[2,"HSK 2"],[3,"HSK 3"],["x","+"]].forEach(([k,title]) => { const arr = groups[k].sort((a,b)=>fq(a)-fq(b)); if (!arr.length) return;
      grid.append(h("section",{class:"sect"}, h("div",{class:"spread"},h("h2",null,title),h("span",{class:"muted small"},arr.length)), h("div",{class:"cgrid"}, arr.map(c => h("button",{lang:"zh-CN",onclick:()=>openWord(c)},c))))); }); });
  return root;
};

// ---------- pronunciation ----------
VIEWS.speak = () => {
  const lv = A.profile.level || 1;
  const pool = Object.values(A.P).filter(p=>p.level<=Math.max(2,lv));
  const box = h("div",{class:"quiz"});
  const start = () => { const qs = []; for (let i=0;i<30 && qs.length<8;i++){ const q = MAKERS.speak(pool); if (q) qs.push(q); }
    runQuiz(box, qs, { title:t("speak_title"), onAnswer:(q,ok)=>recordAnswer("speaking", ok), onFinish:r=>logEvent("speaking", { score:r.right, total:r.total }, true), onAgain:start }); };
  start();
  return h("div",null, pageHead(t("speak_title"), t("speak_sub")), canListen() ? null : h("div",{class:"banner",style:"margin-bottom:14px"}, t("no_mic")), box);
};

// ---------- review ----------
VIEWS.review = () => {
  const root = h("div"), due = srsDue(), total = Object.keys(A.srs).length;
  root.append(pageHead(t("review_title"), t("review_sub")),
    h("div",{class:"grid3",style:"margin-bottom:22px"}, h("div",{class:"card stat"}, h("b",null,due.length), h("span",null,t("due_now"))), h("div",{class:"card stat"}, h("b",null,total), h("span",null,t("in_deck"))), h("div",{class:"card stat"}, h("b",null,wordsMastered()), h("span",null,t("learned_words")))));
  if (!due.length){ root.append(h("div",{class:"empty"},t("review_empty"))); return root; }
  const c = due.sort((a,b)=>a.due-b.due)[0], D = dict(), EL = expLang();
  const box = h("div",{class:"qbox flash"}); let front; const back = h("div",{class:"stack",style:"gap:6px;align-items:center",hidden:true});
  if (c.type==="p"){ const p = A.P[c.n]; if (!p){ srsGrade(c.id,3); return VIEWS.review(); } front = h("div",{class:"front hzd"},p.hz); back.append(h("div",{html:pyHTML(p.py)}), h("div",{class:EL==="lo"?"lo":""},pMeaning(p)), h("button",{class:"btn sm ghost",onclick:()=>go("pattern",{n:p.n})},t("open_pattern"))); const s = genSentence(p); if (s) back.append(h("div",{style:"text-align:left;width:100%"}, sentenceEl(s,{markers:p.markers}))); }
  else if (c.type==="w"){ const d = D[c.w]; front = h("div",{class:"front",lang:"zh-CN"},c.w); back.append(h("div",{style:"font-size:1.3rem",html:pyHTML(d?d.p:"")}), h("div",{class:EL==="lo"&&d&&d.lo?"lo":""}, d ? meaning(c.w,EL) : ""), h("button",{class:"btn sm",onclick:()=>speak(c.w)},icon("play"),t("play"))); }
  else { front = h("div",{class:"front",style:"font-size:1.7rem",lang:"zh-CN"},c.zh); back.append(h("div",{html:pyHTML(c.py||"")}), h("div",{class:"muted"}, c.tr ? tr(c.tr, EL) : ""), h("button",{class:"btn sm",onclick:()=>speak(c.zh)},icon("play"),t("play"))); }
  const grades = h("div",{class:"grades",hidden:true}, [["r_again",0,"5m"],["r_hard",1,""],["r_good",2,""],["r_easy",3,""]].map(([k,q,hint]) => h("button",{class:"btn"+(q===2?" primary":""),onclick:()=>{ srsGrade(c.id,q); recordAnswer(c.type==="w"?"vocabulary":c.type==="p"?"grammar":"reading", q>0); go("review",{},false); }}, h("span",null,t(k), hint?h("small",null,hint):null))));
  const show = h("button",{class:"btn primary",onclick:()=>{ back.hidden=false; grades.hidden=false; show.remove(); if (c.type!=="p") speak(c.w||c.zh); }}, t("show_answer"));
  box.append(front, back, show); root.append(box, grades);
  return root;
};

// ---------- saved ----------
VIEWS.saved = () => {
  const items = Object.values(A.saved).sort((a,b)=>(b.at||0)-(a.at||0));
  const root = h("div"); root.append(pageHead(t("saved_title")));
  if (!items.length){ root.append(h("div",{class:"empty"},t("saved_empty"))); return root; }
  const D = dict(), EL = expLang();
  const group = (title, list, fn) => list.length ? h("section",{class:"sect",style:"margin-bottom:24px"}, h("h2",null,title+" ("+list.length+")"), fn(list)) : null;
  root.append(
    group(t("words"), items.filter(x=>x.type==="word"), l => h("div",{class:"vgrid"}, l.map(x => h("button",{class:"vcard",onclick:()=>openWord(x.w)}, h("span",{class:"hz"},x.w), h("span",{html:pyHTML(D[x.w]?D[x.w].p:"")}), h("span",{class:"m"}, (meaning(x.w,EL)||"").split(";")[0]))))),
    group(t("sentences"), items.filter(x=>x.type==="sentence"), l => h("div",{class:"card",style:"padding-block:4px"}, l.map(x => sentenceEl(ensureTokens({ zh:x.zh, py:x.py, tr:x.tr, pn:x.pn }, A.engine))))),
    group(t("nav_lessons"), items.filter(x=>x.type==="lesson"), l => h("div",{class:"list-card"}, l.map(x => h("button",{class:"item-row",onclick:()=>go("lesson",{id:x.id})}, icon("learn"), h("span",{class:"ttl"},T(x.title)), icon("right"))))),
    group(t("nav_patterns"), items.filter(x=>x.type==="pattern" && A.P[x.n]), l => h("div",{class:"wordchips"}, l.map(x => h("button",{onclick:()=>go("pattern",{n:x.n})}, "#"+x.n+" ", h("span",{class:"hz"},A.P[x.n].hz))))),
    group(t("nav_grammar"), items.filter(x=>x.type==="grammar"), l => h("div",{class:"list-card"}, l.map(x => h("button",{class:"item-row",onclick:()=>go("grammarItem",{id:x.id})}, icon("layers"), h("span",{class:"ttl"},T(x.title)), icon("right"))))));
  return root;
};

// ---------- notes ----------
VIEWS.notes = () => {
  const root = h("div"), list = h("div",{class:"stack"}, h("p",{class:"muted"},t("loading")));
  const input = h("textarea",{class:"input",placeholder:t("note_ph"),"aria-label":t("note_ph")});
  const load = async () => { const rows = (await A.api.db.list(`notes/${A.user.uid}/items`).catch(()=>[])).sort((a,b)=>(b.at||0)-(a.at||0)); list.innerHTML="";
    if (!rows.length) list.append(h("p",{class:"muted"},t("notes_empty")));
    rows.forEach(n => list.append(h("div",{class:"notecard"}, h("p",{style:"white-space:pre-wrap"}, n.text), h("div",{class:"spread"}, h("span",{class:"small muted"}, fmtDate(n.at, lang(), true)+(n.ref?" · "+n.ref:"")), h("button",{class:"btn sm ghost",onclick:async()=>{ await A.api.db.del(`notes/${A.user.uid}/items/${n.id}`); load(); }}, icon("trash"), t("delete")))))); };
  load();
  root.append(pageHead(t("notes_title")), h("div",{class:"card stack",style:"margin-bottom:18px"}, input, h("button",{class:"btn primary",style:"align-self:flex-start",onclick:async()=>{ const v = input.value.trim(); if (!v) return; const ref = A.prog.last ? A.prog.last.type+":"+A.prog.last.id : ""; await A.api.db.add(`notes/${A.user.uid}/items`, { text:v, ref, at:new Date() }); input.value=""; load(); }}, t("add_note"))), list);
  return root;
};

// ---------- progress ----------
VIEWS.progress = () => {
  const root = h("div",{class:"stack-l"});
  root.append(pageHead(t("progress_title"), t("progress_sub")));
  const lessons = Object.entries(A.prog.lessons).filter(([id,x])=>x.done && !id.startsWith("quiz:")).length, pats = Object.keys(A.prog.patterns).length;
  root.append(h("div",{class:"grid4"}, h("div",{class:"card stat"}, h("b",null,lessons), h("span",null,t("lessons_done"))), h("div",{class:"card stat"}, h("b",null,pats+" / "+Object.keys(A.P).length), h("span",null,t("patterns_learned"))),
    h("div",{class:"card stat"}, h("b",null,wordsMastered()), h("span",null,t("learned_words"))), h("div",{class:"card stat"}, h("b",null,Object.keys(A.prog.days).length), h("span",null,t("study_days")))));
  root.append(h("section",{class:"sect"}, h("h2",null,t("skills")), h("div",{class:"card stack",style:"gap:12px"}, SKILLS.map(k => { const s = A.prog.skills[k]||{r:0,t:0};
    return h("div",{class:"skill"}, h("span",null,t("sk_"+k)), h("div",{class:"bar"},h("i",{style:`width:${skillPct(k)}%`})), h("span",{class:"tabnum small",title:s.r+"/"+s.t}, s.t ? skillPct(k)+"%" : "—")); }))));
  const byLevel = h("div",{class:"card stack",style:"gap:10px"});
  for (let L=1; L<=6; L++){ const all = Object.values(A.P).filter(p=>p.level===L); if (!all.length) continue; const d = all.filter(p=>A.prog.patterns[p.n]).length;
    byLevel.append(h("div",{class:"lvbar"}, h("b",null,"HSK "+L), h("div",{class:"bar"},h("i",{style:`width:${100*d/all.length}%`})), h("span",{class:"muted tabnum",style:"text-align:right"}, d+" / "+all.length))); }
  root.append(h("section",{class:"sect"}, h("h2",null,t("by_level")), byLevel), achievementsEl(false));
  const hist = h("div",{class:"feed"}, h("p",{class:"muted"},t("loading")));
  A.api.db.list(`progress/${A.user.uid}/events`, { orderBy:["at","desc"], limit:60 }).then(ev => { hist.innerHTML=""; const rows = ev.filter(e=>["quiz","practice","lesson","speaking"].includes(e.type)).slice(0,20);
    if (!rows.length) hist.append(h("p",{class:"muted"},t("no_rows")));
    rows.forEach(e => hist.append(h("div",{class:"feed-row"}, h("span",null, e.type+" · "+(e.ref||"")+(e.total?" · "+e.score+"/"+e.total:"")), h("span",{class:"small muted"}, fmtDate(e.at, lang(), true))))); }).catch(()=>{ hist.innerHTML=""; });
  root.append(h("section",{class:"sect"}, h("h2",null,t("quiz_history")), h("div",{class:"card"}, hist)));
  return root;
};

// ---------- offline downloads ----------
VIEWS.downloads = () => {
  const root = h("div"); const rows = h("div",{class:"card"});
  const state = async url => { try { const c = await caches.open("xuelu-runtime"); return !!(await c.match(url)); } catch(e){ return false; } };
  const fetchTo = async urls => { const c = await caches.open("xuelu-runtime"); let n=0; for (const u of urls){ try { const r = await fetch(u, { mode: u.startsWith(location.origin)?"same-origin":"no-cors" }); await c.put(u, r); n++; } catch(e){} } return n; };
  const base = new URL("./", location.href).href;
  const row = (label, desc, urls) => { const btn = h("button",{class:"btn sm"}, icon("download"), t("dl_btn")); const st = h("span",{class:"small muted"});
    (async () => { const ok = urls.length && (await Promise.all(urls.map(state))).every(Boolean); if (ok){ btn.replaceWith(h("span",{class:"chip lv"}, icon("check"), t("dl_done"))); } })();
    btn.addEventListener("click", async () => { if (!("caches" in window)){ toast("Not supported in this browser","err"); return; } btn.disabled = true; st.textContent = t("loading"); const n = await fetchTo(urls); st.textContent = n+"/"+urls.length; btn.replaceWith(h("span",{class:"chip lv"}, icon("check"), t("dl_done"))); });
    return h("div",{class:"dl-row"}, h("div",null, h("b",null,label), desc ? h("div",{class:"small muted"},desc) : null, st), btn); };
  const core = ["","index.html","css/app.css","js/learner/main.js","js/learner/core.js","js/learner/views-learn.js","js/learner/views-tools.js","js/shared/ui.js","js/shared/i18n.js","js/shared/content.js","js/shared/dict.js","js/shared/engine.js","js/shared/speech.js","js/shared/widgets.js","js/shared/quiz.js","js/shared/setup.js","js/api/index.js","js/api/firebase.js","js/api/local.js","js/config.js","vendor/hanzi-writer.min.js","vendor/firebase/firebase-app.js","vendor/firebase/firebase-auth.js","vendor/firebase/firebase-firestore.js","manifest.webmanifest","icon.svg"].map(p=>base+p);
  rows.append(row(t("dl_core"), t("sync_note"), core), row(t("dl_dict"), "≈ 1.3 MB", [base+"data/dictionary.json", base+"data/chars.json"]), row(t("dl_strokes"), "≈ 1.9 MB", [base+"data/strokes.json"]));
  const audio = (A.B.audio||[]).filter(a=>a.url);
  for (let L=1; L<=6; L++){ const words = new Set(Object.values(A.byType.lessons||{}).filter(l=>l.level===L).flatMap(l=>l.vocab||[]));
    const urls = audio.filter(a => words.has(a.text) || (a.relatedType==="lessons" && A.byType.lessons[a.relatedId] && A.byType.lessons[a.relatedId].level===L)).map(a=>a.url);
    rows.append(urls.length ? row(t("dl_audio",{n:L}), urls.length+" files", urls) : h("div",{class:"dl-row"}, h("div",null, h("b",null,t("dl_audio",{n:L})), h("div",{class:"small muted"},t("dl_none_audio"))), h("span"))); }
  const usage = h("p",{class:"small muted",style:"margin-top:12px"});
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => usage.textContent = t("dl_storage")+": "+(e.usage/1048576).toFixed(1)+" MB");
  root.append(pageHead(t("dl_title"), t("dl_sub")), rows, usage);
  return root;
};

// ---------- account & settings ----------
VIEWS.account = () => {
  const p = prefs(), a = A.access, root = h("div",{class:"stack-l"});
  const row = (label, ctrl, desc) => h("div",{class:"set-row"}, h("div",null, h("label",null,label), desc ? h("p",null,desc) : null), ctrl);
  const sw = k => h("input",{type:"checkbox",class:"switch",checked:!!p[k],"aria-label":k,onchange:e=>setPref(k, e.target.checked)});
  const nameIn = h("input",{class:"input",value:A.profile.name||"",style:"max-width:260px"});
  const vs = voices();
  root.append(pageHead(t("account_title")));
  root.append(h("section",{class:"card"},
    row(t("name"), h("div",{class:"row"}, nameIn, h("button",{class:"btn sm",onclick:async()=>{ A.profile.name = nameIn.value.trim(); await A.api.db.update(`users/${A.user.uid}`,{ name:A.profile.name }).catch(e=>toast(errText(e),"err")); toast(t("saved")); }}, t("save_btn")))),
    row(t("email"), h("span",{class:"muted"}, A.user.email)),
    row(t("level_label"), h("span",{class:"chip lv"}, "HSK "+(A.profile.level||1))),
    row(t("member_since"), h("span",{class:"muted"}, fmtDate(A.profile.createdAt, lang())))));
  root.append(h("section",{class:"card"}, h("h2",{style:"margin-bottom:6px"},t("current_plan")),
    h("div",{class:"spread"}, h("div",null, h("b",{style:"font-size:1.3rem"}, A.isAdmin ? t("adm_title") : tierName(A.tier)), a ? h("p",{class:"small muted"}, t("status")+": "+t(accessState(a))+" · "+t("expires")+": "+(a.expiresAt?fmtDate(a.expiresAt, lang()):t("no_expiry"))) : null),
      A.settings.supportContact ? h("span",{class:"small"}, t("contact")+": "+A.settings.supportContact) : null),
    h("div",{class:"grid3",style:"margin-top:14px"}, A.plans.filter(pl=>pl.active!==false).map(pl => h("div",{class:"card",style:(a&&a.planId===pl.id)?"border-color:var(--jade)":""}, h("b",null,tr(pl.name, lang())), h("ul",{class:"obj small"+(lang()==="lo"?" lo":"")}, ((pl.features&&(pl.features[lang()]||pl.features.en))||[]).map(f=>h("li",null,f))))))));
  root.append(h("section",{class:"card"},
    row(t("ui_lang"), h("div",{class:"seg"}, [["en","English"],["lo","ລາວ"],["zh","中文"]].map(([l,n]) => h("button",{"aria-pressed":String(lang()===l),onclick:()=>{ setPref("uiLang",l); try{ localStorage.setItem("xuelu.lang",l); }catch(e){} A.render(); }}, n)))),
    row(t("explain_lang"), h("div",{class:"seg"}, [["","Auto"],["en","English"],["lo","ລາວ"],["zh","中文"]].map(([l,n]) => h("button",{"aria-pressed":String((p.explainLang||"")===l),onclick:()=>{ setPref("explainLang",l); A.render(); }}, n))), t("explain_lang_d")),
    row(t("theme"), h("div",{class:"seg"}, [["auto","theme_auto"],["light","theme_light"],["dark","theme_dark"]].map(([k,l]) => h("button",{"aria-pressed":String(p.theme===k),onclick:()=>{ setPref("theme",k); A.render(); }}, t(l))))),
    row(t("show_pinyin"), sw("showPy")), row(t("show_trans"), sw("showTr")), row(t("tone_colors"), sw("toneColor")),
    row(t("speech_rate"), h("input",{type:"range",min:"0.5",max:"1.2",step:"0.05",value:p.rate,"aria-label":t("speech_rate"),onchange:e=>{ setPref("rate",+e.target.value); speak("我每天学习中文。"); }})),
    row(t("voice"), vs.length ? h("select",{class:"input",style:"width:auto;max-width:220px",onchange:e=>{ setPref("voice",e.target.value); speak("你好，欢迎学习中文。"); }}, h("option",{value:""},"Auto"), vs.map(v=>h("option",{value:v.name,selected:v.name===p.voice},v.name+" ("+v.lang+")"))) : h("span",{class:"chip warn"},t("voice_none")), vs.length ? null : t("voice_help"))));
  const oldPw = h("input",{class:"input",type:"password",autocomplete:"current-password"}), newPw = h("input",{class:"input",type:"password",autocomplete:"new-password"});
  root.append(h("section",{class:"card stack"}, h("h2",null,t("change_pw")), h("div",{class:"field-row"}, h("div",{class:"field"},h("label",null,t("current_pw")),oldPw), h("div",{class:"field"},h("label",null,t("new_pw")),newPw)),
    h("div",{class:"row"}, h("button",{class:"btn",onclick:async()=>{ try { await A.api.auth.changePassword(oldPw.value, newPw.value); toast(t("pw_changed")); oldPw.value=newPw.value=""; } catch(e){ toast(errText(e),"err"); } }}, t("change_pw")),
      h("button",{class:"btn ghost",onclick:()=>A.api.auth.signOut()}, icon("logout"), t("sign_out")))));
  return root;
};

// ---------- more (mobile) ----------
VIEWS.more = () => h("div",null, pageHead(t("nav_more")), h("div",{class:"stack",style:"gap:10px"},
  [["lessons","nav_lessons","learn"],["patterns","nav_patterns","gen"],["gen","gen_title","spark"],["vocab","nav_vocab","dict"],["grammar","nav_grammar","layers"],["dict","nav_dict","dict"],["pinyin","nav_pinyin","pinyin"],["chars","nav_chars","chars"],["speak","nav_speak","mic"],["saved","nav_saved","bookmark"],["notes","nav_notes","note"],["progress","nav_progress","chart"],["news","nav_new","gift"],["downloads","nav_offline","download"],["account","nav_account","user"]]
    .map(([id,k,ic]) => h("button",{class:"qs",onclick:()=>go(id)}, h("span",{class:"qi",style:"background:var(--surface-2)"},icon(ic)), h("b",null,t(k))))),
  A.isAdmin ? h("a",{class:"qs",href:"admin/",style:"margin-top:10px;text-decoration:none;color:inherit"}, h("span",{class:"qi",style:"background:var(--surface-2)"},icon("shield")), h("b",null,t("adm_title"))) : null);
