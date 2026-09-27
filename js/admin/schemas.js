// Content schemas drive the admin editor: add a field here and it appears in the CMS.
// Labels are [English, Lao].
export const SECS = "ABCDEFGHIJKLMNOPQRS".split("");
const lv = { key:"level", type:"select", label:["HSK level","ລະດັບ HSK"], options:[1,2,3,4,5,6].map(n=>[n,"HSK "+n]), num:true };
const sentence = (key, label) => ({ key, type:"list", label, itemLabel:["Sentence","ປະໂຫຍກ"], item:[{ key:"", type:"sentence" }], summary: s => s.zh || "" });

export const SCHEMAS = {
  lessons: { title: d => d.title, idHint:"hsk1-greetings", defaults:{ level:1, topic:"", title:{en:"",lo:"",zh:""}, desc:{en:"",lo:"",zh:""}, objectives:{en:[],lo:[],zh:[]}, vocab:[], patterns:[], grammar:[], dialogues:[], quizzes:[], audio:[], images:[], examples:[] },
    fields:[
      { key:"title", type:"tr", label:["Title","ຫົວຂໍ້"] },
      { key:"desc", type:"tr", multiline:true, label:["Description","ຄຳອະທິບາຍ"] },
      { row:[ lv, { key:"topic", type:"text", label:["Topic","ຫົວຂໍ້ຍ່ອຍ"], placeholder:"Daily life" } ] },
      { key:"objectives", type:"trlines", label:["Learning objectives (one per line)","ຈຸດປະສົງການຮຽນ (ແຖວລະອັນ)"] },
      { key:"vocab", type:"words", label:["Vocabulary (Chinese words)","ຄຳສັບ (ຄຳພາສາຈີນ)"] },
      { key:"patterns", type:"refs", to:"patterns", num:true, label:["Sentence patterns","ໂຄງສ້າງປະໂຫຍກ"] },
      { key:"grammar", type:"refs", to:"grammar", label:["Grammar","ໄວຍາກອນ"] },
      { key:"dialogues", type:"refs", to:"dialogues", label:["Dialogues","ບົດສົນທະນາ"] },
      sentence("examples", ["Extra example sentences","ປະໂຫຍກຕົວຢ່າງເພີ່ມເຕີມ"]),
      { key:"quizzes", type:"refs", to:"quizzes", label:["Quizzes & exercises","ແບບທົດສອບ"] },
      { key:"audio", type:"refs", to:"audio", label:["Audio","ສຽງ"] },
      { key:"images", type:"tags", label:["Image links","ລິ້ງຮູບພາບ"], placeholder:"https://…" } ] },
  patterns: { title: d => ({ en: d.hz+" — "+((d.tr&&d.tr.en&&d.tr.en.meaning)||"") }), idHint:"p251", defaults:{ n:0, sec:"A", hz:"", py:"", gloss:"", level:1, formula:"", tr:{en:{meaning:"",how:"",note:""},lo:{meaning:""},zh:{}}, mistake:null, examples:[], gen:[] },
    fields:[
      { row:[ { key:"n", type:"number", label:["Number","ເລກ"] }, { key:"sec", type:"select", label:["Section","ພາກ"], options:SECS.map(s=>[s,s]) }, lv ] },
      { row:[ { key:"hz", type:"text", label:["Pattern (Chinese)","ໂຄງສ້າງ (ພາສາຈີນ)"], cls:"hz" }, { key:"py", type:"text", label:["Pinyin","ພິນອິນ"] }, { key:"gloss", type:"text", label:["Grammar label","ປ້າຍໄວຍາກອນ"] } ] },
      { key:"formula", type:"text", label:["Structure formula","ສູດໂຄງສ້າງ"], help:["Use S, V, O, Adj, N, Time, Place joined with +","ໃຊ້ S, V, O, Adj, N, Time, Place ເຊື່ອມດ້ວຍ +"] },
      { key:"tr", type:"trgroup", label:["Meaning & explanation","ຄວາມໝາຍ ແລະ ຄຳອະທິບາຍ"], fields:[ { key:"meaning", type:"text", label:["Meaning","ຄວາມໝາຍ"] }, { key:"how", type:"textarea", label:["How and why","ໃຊ້ແນວໃດ ແລະ ເປັນຫຍັງ"] }, { key:"note", type:"textarea", label:["Usage note","ໝາຍເຫດ"] } ] },
      { key:"mistake", type:"object", nullable:true, label:["Common mistake","ຂໍ້ຜິດພາດທີ່ພົບເລື້ອຍ"], fields:[ { row:[ { key:"wrong", type:"text", label:["Wrong","ຜິດ"], cls:"hz" }, { key:"right", type:"text", label:["Right","ຖືກ"], cls:"hz" } ] }, { key:"tr", type:"tr", label:["Why","ເປັນຫຍັງ"] } ] },
      sentence("examples", ["Examples","ຕົວຢ່າງ"]),
      { key:"gen", type:"list", label:["Sentence generator templates","ແມ່ແບບສ້າງປະໂຫຍກ"], itemLabel:["Template","ແມ່ແບບ"], summary: g => g.zh||"",
        help:["Chinese words separated by spaces. {P} = a person, {VO} = an activity, {PL} = a place… or define your own lists in Slots, e.g. {\"X\":[\"咖啡|coffee\",\"茶|tea\"]}. English: {P} {V@} agrees the verb; [[like]] conjugates.","ຄຳພາສາຈີນແຍກດ້ວຍຍະຫວ່າງ. {P} = ຄົນ, {VO} = ກິດຈະກຳ, {PL} = ສະຖານທີ່… ຫຼື ກຳນົດລາຍການເອງໃນ Slots."],
        item:[ { key:"zh", type:"text", label:["Chinese template","ແມ່ແບບພາສາຈີນ"], cls:"hz" }, { key:"en", type:"text", label:["English template","ແມ່ແບບພາສາອັງກິດ"] }, { key:"slots", type:"text", label:["Slots (JSON, optional)","Slots (JSON, ບໍ່ບັງຄັບ)"], cls:"mono" } ] } ] },
  grammar: { title: d => d.title, idHint:"g-ba", defaults:{ level:1, title:{en:"",lo:"",zh:""}, structure:"", tr:{en:{explain:"",usage:[]},lo:{explain:"",usage:[]},zh:{explain:"",usage:[]}}, examples:[], mistakes:[], patterns:[] },
    fields:[
      { key:"title", type:"tr", label:["Title","ຫົວຂໍ້"] }, { row:[ lv, { key:"structure", type:"text", label:["Structure","ໂຄງສ້າງ"], cls:"hz" } ] },
      { key:"tr", type:"trgroup", label:["Explanation","ຄຳອະທິບາຍ"], fields:[ { key:"explain", type:"textarea", label:["Explanation","ຄຳອະທິບາຍ"] }, { key:"usage", type:"lines", label:["How to use it (one per line)","ວິທີໃຊ້ (ແຖວລະອັນ)"] } ] },
      sentence("examples", ["Examples","ຕົວຢ່າງ"]),
      { key:"mistakes", type:"list", label:["Common mistakes","ຂໍ້ຜິດພາດ"], itemLabel:["Mistake","ຂໍ້ຜິດພາດ"], summary: m => m.wrong||"", item:[ { row:[ { key:"wrong", type:"text", label:["Wrong","ຜິດ"], cls:"hz" }, { key:"right", type:"text", label:["Right","ຖືກ"], cls:"hz" } ] }, { key:"tr", type:"tr", label:["Why","ເປັນຫຍັງ"] } ] },
      { key:"patterns", type:"refs", to:"patterns", num:true, label:["Related patterns","ໂຄງສ້າງທີ່ກ່ຽວຂ້ອງ"] } ] },
  vocabulary: { title: d => ({ en: d.hz+"  "+(d.py||"")+" — "+((d.tr&&d.tr.en&&d.tr.en.meaning)||"") }), idFrom:"hz", idHint:"学习", defaults:{ hz:"", py:"", pos:"v", level:1, tr:{en:{meaning:""},lo:{meaning:""},zh:{meaning:""}}, examples:[], tags:[] },
    fields:[
      { row:[ { key:"hz", type:"text", label:["Word (Chinese)","ຄຳ (ພາສາຈີນ)"], cls:"hz" }, { key:"py", type:"pinyin", from:"hz", label:["Pinyin","ພິນອິນ"] }, { key:"pos", type:"select", label:["Part of speech","ປະເພດຄຳ"], options:["n","v","adj","adv","prep","conj","part","pron","num","m","t","prop","loc","mod","int","idiom","ph"].map(x=>[x,x]) }, lv ] },
      { key:"tr", type:"trgroup", label:["Meaning","ຄວາມໝາຍ"], fields:[ { key:"meaning", type:"text", label:["Meaning","ຄວາມໝາຍ"] }, { key:"usage", type:"textarea", label:["Usage (optional)","ການໃຊ້ (ບໍ່ບັງຄັບ)"] } ] },
      sentence("examples", ["Example sentences","ປະໂຫຍກຕົວຢ່າງ"]),
      { key:"tags", type:"tags", label:["Tags","ແທັກ"], placeholder:"food, travel" } ] },
  dialogues: { title: d => d.title, idHint:"d-shopping", defaults:{ level:1, title:{en:"",lo:"",zh:""}, lines:[] },
    fields:[
      { key:"title", type:"tr", label:["Title","ຫົວຂໍ້"] }, lv,
      { key:"lines", type:"list", label:["Lines","ແຖວສົນທະນາ"], itemLabel:["Line","ແຖວ"], summary: l => (l.speaker?l.speaker+": ":"")+(l.zh||""), item:[ { key:"speaker", type:"text", label:["Speaker","ຜູ້ເວົ້າ"], placeholder:"A" }, { key:"", type:"sentence" } ] } ] },
  quizzes: { title: d => d.title, idHint:"q-food", defaults:{ level:1, kind:"quiz", lesson:"", title:{en:"",lo:"",zh:""}, questions:[] },
    fields:[
      { key:"title", type:"tr", label:["Title","ຫົວຂໍ້"] },
      { row:[ lv, { key:"kind", type:"select", label:["Kind","ປະເພດ"], options:[["quiz","Quiz"],["exercise","Exercise"]] }, { key:"lesson", type:"ref", to:"lessons", label:["Lesson","ບົດຮຽນ"] } ] },
      { key:"questions", type:"questions", label:["Questions","ຄຳຖາມ"] } ] },
  audio: { title: d => ({ en: (d.text||"")+" · "+(d.type||"") }), idHint:"a-nihao", defaults:{ text:"", lang:"zh", type:"word", speaker:"", speed:"normal", url:"", relatedType:"", relatedId:"" },
    fields:[
      { key:"text", type:"text", label:["Text spoken (exactly as written in lessons)","ຂໍ້ຄວາມທີ່ເວົ້າ"], cls:"hz" },
      { row:[ { key:"lang", type:"select", label:["Language","ພາສາ"], options:[["zh","中文"],["en","English"],["lo","ລາວ"]] }, { key:"type", type:"select", label:["Type","ປະເພດ"], options:["word","sentence","dialogue","lesson"].map(x=>[x,x]) }, { key:"speaker", type:"text", label:["Speaker","ຜູ້ເວົ້າ"] }, { key:"speed", type:"select", label:["Speed","ຄວາມໄວ"], options:[["normal","normal"],["slow","slow"]] } ] },
      { key:"url", type:"audio", label:["Audio file","ໄຟລ໌ສຽງ"] },
      { row:[ { key:"relatedType", type:"select", label:["Related to","ກ່ຽວຂ້ອງກັບ"], options:[["",""],["lessons","lesson"],["vocabulary","word"],["dialogues","dialogue"],["patterns","pattern"]] }, { key:"relatedId", type:"text", label:["Related ID","ID ທີ່ກ່ຽວຂ້ອງ"] } ] } ] },
  paths: { title: d => d.title, idHint:"business", defaults:{ kind:"topic", level:0, title:{en:"",lo:"",zh:""}, desc:{en:"",lo:"",zh:""}, steps:[] },
    fields:[
      { key:"title", type:"tr", label:["Title","ຫົວຂໍ້"] }, { key:"desc", type:"tr", multiline:true, label:["Description","ຄຳອະທິບາຍ"] },
      { row:[ { key:"kind", type:"select", label:["Kind","ປະເພດ"], options:[["level","HSK level"],["topic","Topic (travel, business…)"],["skill","Skill (grammar, listening…)"]] }, { key:"level", type:"select", label:["Level","ລະດັບ"], options:[[0,"—"],...[1,2,3,4,5,6].map(n=>[n,"HSK "+n])], num:true } ] },
      { key:"steps", type:"list", label:["Steps","ຂັ້ນຕອນ"], itemLabel:["Step","ຂັ້ນ"], summary: s => s.type+": "+s.id, item:[ { row:[ { key:"type", type:"select", label:["Type","ປະເພດ"], options:[["lesson","Lesson"],["pattern","Pattern"],["grammar","Grammar"],["quiz","Quiz"],["dialogue","Dialogue"],["page","App page (pinyin, chars, speak)"]] }, { key:"id", type:"stepref", label:["Item","ລາຍການ"] } ] } ] } ] },
  releases: { title: d => d.title, idHint:"2026-11", defaults:{ date:new Date().toISOString().slice(0,10), title:{en:"",lo:"",zh:""}, notes:{en:"",lo:"",zh:""}, items:[] },
    fields:[
      { key:"title", type:"tr", label:["Title","ຫົວຂໍ້"] }, { key:"date", type:"date", label:["Release date","ວັນທີອັບເດດ"] },
      { key:"notes", type:"tr", multiline:true, label:["Release notes","ລາຍລະອຽດ"] },
      { key:"items", type:"list", label:["Highlighted items","ລາຍການເດັ່ນ"], itemLabel:["Item","ລາຍການ"], summary: s => s.type+": "+s.id, item:[ { row:[ { key:"type", type:"select", label:["Type","ປະເພດ"], options:[["lesson","Lesson"],["pattern","Pattern"],["grammar","Grammar"],["quiz","Quiz"],["dialogue","Dialogue"]] }, { key:"id", type:"stepref", label:["Item","ລາຍການ"] } ] } ] } ] },
  lexicon: { title: d => ({ en: d.cat || d.id }), idHint:"FRUIT", defaults:{ cat:"", data:[] }, noAccess:true,
    fields:[ { key:"cat", type:"text", label:["Slot name (use in templates as {NAME})","ຊື່ Slot"], cls:"mono" },
      { key:"data", type:"json", label:["Items (JSON)","ລາຍການ (JSON)"], help:["Array of objects like {\"z\":\"咖啡\",\"e\":\"coffee\"}. People need e (subject), o (object), s (1 = he/she).","ອາເຣຂອງອອບເຈັກ ເຊັ່ນ {\"z\":\"咖啡\",\"e\":\"coffee\"}."] } ] }
};
export const STEP_TYPE_TO_COL = { lesson:"lessons", pattern:"patterns", grammar:"grammar", quiz:"quizzes", dialogue:"dialogues" };
export const APP_PAGES = [["pinyin","Pinyin & tones"],["chars","Characters"],["speak","Pronunciation"],["gen","Sentence generator"],["dict","Dictionary"]];
