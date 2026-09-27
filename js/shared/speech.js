// Audio engine. Order of preference: a recorded audio file (from the Audio library) → the device's Chinese voice.
// Swap or extend providers here without touching lessons.
let VOICES = [], settings = { rate: 0.85, voice: "" }, AUDIO_MAP = new Map(), onNoVoice = null, current = null;
export function setSpeechSettings(s){ settings = Object.assign(settings, s||{}); }
export function setAudioLibrary(items=[]){ AUDIO_MAP = new Map(items.filter(a=>a.url && a.text).map(a => [a.text.trim(), a])); }
export function onMissingVoice(cb){ onNoVoice = cb; }
export function voices(){ return VOICES; }
function loadVoices(){ try { VOICES = (speechSynthesis.getVoices()||[]).filter(v => /^(zh|cmn)/i.test(v.lang) || /Chinese|Mandarin|普通话|中文/i.test(v.name)); } catch(e){ VOICES = []; } }
if ("speechSynthesis" in window){ loadVoices(); speechSynthesis.addEventListener?.("voiceschanged", loadVoices); }
function pickVoice(){ return VOICES.find(v=>v.name===settings.voice) || VOICES.find(v=>/zh[-_]CN/i.test(v.lang)) || VOICES.find(v=>/^zh/i.test(v.lang)) || VOICES[0] || null; }
export function stop(){ try { speechSynthesis.cancel(); } catch(e){} if (current){ current.pause(); current = null; } }
export function speak(text, opt={}){
  text = String(text||"").trim(); if (!text) return;
  stop();
  const rec = AUDIO_MAP.get(text);
  if (rec){
    let n = opt.times || 1;
    const play = () => { const a = new Audio(rec.url); a.playbackRate = opt.slow ? 0.7 : 1; current = a; a.onended = () => { if (--n > 0) play(); }; a.play().catch(()=>speakTTS(text,opt)); };
    return play();
  }
  speakTTS(text, opt);
}
function speakTTS(text, opt){
  if (!("speechSynthesis" in window)){ onNoVoice && onNoVoice(); return; }
  try {
    for (let i=0;i<(opt.times||1);i++){
      const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; const v = pickVoice(); if (v) u.voice = v;
      u.rate = opt.slow ? Math.max(.4, settings.rate*0.6) : settings.rate; speechSynthesis.speak(u);
    }
    if (!VOICES.length) setTimeout(() => { loadVoices(); if (!VOICES.length && onNoVoice) onNoVoice(); }, 900);
  } catch(e){}
}
// Pronunciation check with the browser's speech recognition (Chrome/Edge/Safari; usually needs internet).
export const canListen = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
export function listen(){
  return new Promise((resolve, reject) => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return reject(new Error("unsupported"));
    const r = new R(); r.lang = "zh-CN"; r.interimResults = false; r.maxAlternatives = 3;
    let done = false;
    const timer = setTimeout(() => { if (!done){ done = true; try { r.abort(); } catch(e){} resolve([]); } }, 8000);
    r.onresult = e => { if (done) return; done = true; clearTimeout(timer); resolve(Array.from(e.results[0]).map(a=>a.transcript)); };
    r.onerror = e => { if (!done){ done = true; clearTimeout(timer); reject(e.error || e); } };
    r.onend = () => { if (!done){ done = true; clearTimeout(timer); resolve([]); } };
    try { r.start(); } catch(e){ reject(e); }
  });
}
// similarity 0..1 between two Chinese strings (character overlap in order)
export function similarity(a, b){
  a = String(a).replace(/[^一-鿿]/g,""); b = String(b).replace(/[^一-鿿]/g,"");
  if (!a || !b) return 0;
  const m = a.length, n = b.length, dp = Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++) dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  return dp[m][n] / Math.max(m, n);
}
