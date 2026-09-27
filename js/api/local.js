// Demo implementation of the data layer: same interface as Firebase, stored in this browser.
// Used automatically while js/config.js has no firebaseConfig.
const DBKEY = "xuelu.demo.db", AUTHKEY = "xuelu.demo.auth", SESSKEY = "xuelu.demo.session";
const load = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch(e){ return null; } };
const store = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ console.warn("Demo storage full", e); } };
const clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));
const uidGen = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const INC = "__inc__", DELF = "__delete__";

const idb = () => new Promise((res, rej) => { const r = indexedDB.open("xuelu-demo", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbGet(key){ try { const d = await idb(); return await new Promise(res => { const t = d.transaction("kv").objectStore("kv").get(key); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); } catch(e){ return null; } }
async function idbSet(key, val){ try { const d = await idb(); await new Promise(res => { const t = d.transaction("kv","readwrite"); t.objectStore("kv").put(val, key); t.oncomplete = res; t.onerror = res; }); } catch(e){ console.warn(e); } }

export async function createLocalApi(){
  let db = (await idbGet(DBKEY)) || {};
  let accounts = load(AUTHKEY) || {};
  let session = load(SESSKEY);
  const listeners = new Set();
  let saveT;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => idbSet(DBKEY, db), 120); };
  const toStore = v => {
    if (v instanceof Date) return v.getTime();
    if (Array.isArray(v)) return v.map(toStore);
    if (v && typeof v === "object"){ const o={}; for (const k in v) o[k]=toStore(v[k]); return o; }
    return v;
  };
  const applyFields = (target, data) => {
    for (const [k,v] of Object.entries(data)){
      const parts = k.split("."); let t = target;
      for (let i=0;i<parts.length-1;i++){ if (typeof t[parts[i]] !== "object" || t[parts[i]]===null) t[parts[i]]={}; t=t[parts[i]]; }
      const last = parts[parts.length-1];
      if (v && v[INC] !== undefined) t[last] = (typeof t[last]==="number"?t[last]:0) + v[INC];
      else if (v === DELF) delete t[last];
      else t[last] = toStore(v);
    }
  };
  const deepMerge = (a, b) => { for (const k in b){ const v=b[k];
      if (v && typeof v==="object" && !Array.isArray(v) && v[INC]===undefined && a[k] && typeof a[k]==="object" && !Array.isArray(a[k])) deepMerge(a[k], v);
      else if (v && v[INC]!==undefined) a[k]=(typeof a[k]==="number"?a[k]:0)+v[INC];
      else if (v===DELF) delete a[k];
      else a[k]=toStore(v); } return a; };
  const inCol = (path, colPath) => path.startsWith(colPath + "/") && path.slice(colPath.length+1).indexOf("/") === -1;
  const cmp = (a, op, b) => op==="=="?a===b: op==="!="?a!==b: op==="<"?a<b: op==="<="?a<=b: op===">"?a>b: op===">="?a>=b:
    op==="in"?b.includes(a): op==="array-contains"?(Array.isArray(a)&&a.includes(b)): false;
  const getPath = (o, f) => f.split(".").reduce((x,k)=>x==null?x:x[k], o);
  const emit = () => listeners.forEach(cb => cb(session ? { uid: session.uid, email: session.email } : null));
  const hash = s => { let h=0; for (const c of s) h=(h*31+c.charCodeAt(0))|0; return String(h); };

  const api = {
    mode: "demo",
    auth: {
      current: () => session ? { uid: session.uid, email: session.email } : null,
      onChange: cb => { listeners.add(cb); setTimeout(() => cb(api.auth.current()), 0); return () => listeners.delete(cb); },
      signIn: async (e,p) => {
        const a = accounts[e.toLowerCase()];
        if (!a || a.pw !== hash(p)) { const err = new Error("Wrong email or password."); err.code="auth/invalid-credential"; throw err; }
        session = { uid: a.uid, email: e.toLowerCase() }; store(SESSKEY, session); emit(); return api.auth.current();
      },
      signUp: async (e,p) => { const uid = await api.auth.createAccount(e,p); session={uid,email:e.toLowerCase()}; store(SESSKEY,session); emit(); return api.auth.current(); },
      signOut: async () => { session = null; store(SESSKEY, null); emit(); },
      resetPassword: async e => { if (!accounts[e.toLowerCase()]) { const err=new Error("No account with that email."); err.code="auth/user-not-found"; throw err; } },
      changePassword: async (oldPw, newPw) => { const a=accounts[session.email]; if (a.pw!==hash(oldPw)) throw new Error("Current password is wrong."); a.pw=hash(newPw); store(AUTHKEY,accounts); },
      createAccount: async (e,p) => {
        e = e.toLowerCase();
        if (accounts[e]) { const err=new Error("That email already has an account."); err.code="auth/email-already-in-use"; throw err; }
        if (!p || p.length<6) { const err=new Error("Password must be at least 6 characters."); err.code="auth/weak-password"; throw err; }
        const uid = uidGen(); accounts[e] = { uid, pw: hash(p) }; store(AUTHKEY, accounts); return uid;
      },
      // demo only: set a password directly
      _setPassword: (e,p) => { if (accounts[e]) { accounts[e].pw = hash(p); store(AUTHKEY, accounts); } }
    },
    db: {
      get: async p => db[p] ? Object.assign({ id: p.split("/").pop() }, clone(db[p])) : null,
      set: async (p, d, merge=false) => { if (merge && db[p]) deepMerge(db[p], d); else { db[p] = {}; applyFields(db[p], d); } persist(); },
      update: async (p, d) => { if (!db[p]) throw new Error("Document not found: "+p); applyFields(db[p], d); persist(); },
      del: async p => { delete db[p]; Object.keys(db).forEach(k => { if (k.startsWith(p+"/")) delete db[k]; }); persist(); },
      add: async (p, d) => { const id = uidGen(); await api.db.set(p+"/"+id, d); return id; },
      list: async (p, o={}) => {
        let rows = Object.keys(db).filter(k => inCol(k, p)).map(k => Object.assign({ id: k.split("/").pop() }, clone(db[k])));
        (o.where||[]).forEach(([f,op,v]) => { rows = rows.filter(r => cmp(getPath(r,f), op, v)); });
        if (o.orderBy){ const [f,dir] = o.orderBy; rows.sort((a,b)=>{ const x=getPath(a,f), y=getPath(b,f); return (x>y?1:x<y?-1:0)*(dir==="desc"?-1:1); }); }
        if (o.limit) rows = rows.slice(0, o.limit);
        return rows;
      },
      count: async (p, o) => (await api.db.list(p, o)).length,
      batch: async ops => { for (const o of ops){ if (o.op==="del") await api.db.del(o.path); else if (o.op==="update") await api.db.update(o.path, o.data); else await api.db.set(o.path, o.data, !!o.merge); } },
      inc: n => ({ [INC]: n }),
      delField: () => DELF
    },
    storage: {
      upload: async file => {
        if (file.size > 1.5e6) throw new Error("In demo mode files must be under 1.5 MB.");
        return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      }
    },
    _isEmpty: () => Object.keys(db).length === 0,
    _flush: () => idbSet(DBKEY, db),
    _reset: async () => { db = {}; accounts = {}; session = null; await idbSet(DBKEY, {}); localStorage.removeItem(AUTHKEY); localStorage.removeItem(SESSKEY); }
  };
  return api;
}
