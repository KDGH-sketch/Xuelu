// Firebase implementation of the Xuélù data layer.
import { initializeApp, getApps } from "../../vendor/firebase/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword, setPersistence, browserLocalPersistence } from "../../vendor/firebase/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, collection, query, where, orderBy, limit as qlimit, getDocs, writeBatch, increment, getCountFromServer, Timestamp, deleteField } from "../../vendor/firebase/firebase-firestore.js";

export function createFirebaseApi(config){
  const app = initializeApp(config);
  const auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(()=>{});
  let fs;
  try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch(e){ fs = initializeFirestore(app, {}); }

  // Timestamps → milliseconds so the rest of the app only sees numbers.
  const norm = v => {
    if (v instanceof Timestamp) return v.toMillis();
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object" && v.constructor === Object){ const o={}; for (const k in v) o[k]=norm(v[k]); return o; }
    return v;
  };
  // Date objects are stored as Firestore Timestamps automatically.
  const ref = p => doc(fs, ...p.split("/"));
  const col = p => collection(fs, ...p.split("/"));
  const buildQuery = (path, o={}) => {
    const parts=[];
    (o.where||[]).forEach(([f,op,v]) => parts.push(where(f,op,v)));
    if (o.orderBy) parts.push(orderBy(o.orderBy[0], o.orderBy[1]||"asc"));
    if (o.limit) parts.push(qlimit(o.limit));
    return query(col(path), ...parts);
  };
  let secondary = null;
  const api = {
    mode: "firebase",
    auth: {
      current: () => auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null,
      onChange: cb => onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)),
      signIn: (e,p) => signInWithEmailAndPassword(auth, e, p).then(c => ({ uid: c.user.uid, email: c.user.email })),
      signUp: (e,p) => createUserWithEmailAndPassword(auth, e, p).then(c => ({ uid: c.user.uid, email: c.user.email })),
      signOut: () => signOut(auth),
      resetPassword: e => sendPasswordResetEmail(auth, e),
      changePassword: async (oldPw, newPw) => {
        const u = auth.currentUser; await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, oldPw)); await updatePassword(u, newPw);
      },
      // Create another person's login without signing the admin out (uses a second app instance).
      createAccount: async (e,p) => {
        if (!secondary) secondary = getApps().find(a=>a.name==="secondary") || initializeApp(config, "secondary");
        const a2 = getAuth(secondary);
        const c = await createUserWithEmailAndPassword(a2, e, p);
        const uid = c.user.uid; await signOut(a2); return uid;
      }
    },
    db: {
      get: async p => { const s = await getDoc(ref(p)); return s.exists() ? Object.assign({ id: s.id }, norm(s.data())) : null; },
      set: (p, d, merge=false) => setDoc(ref(p), d, { merge }),
      update: (p, d) => updateDoc(ref(p), d),
      del: p => deleteDoc(ref(p)),
      add: async (p, d) => (await addDoc(col(p), d)).id,
      list: async (p, o) => (await getDocs(buildQuery(p, o))).docs.map(s => Object.assign({ id: s.id }, norm(s.data()))),
      count: async (p, o) => { try { return (await getCountFromServer(buildQuery(p, o))).data().count; } catch(e){ return (await api.db.list(p,o)).length; } },
      batch: async ops => {
        for (let i=0; i<ops.length; i+=400){
          const b = writeBatch(fs);
          ops.slice(i,i+400).forEach(o => { if (o.op==="del") b.delete(ref(o.path)); else if (o.op==="update") b.update(ref(o.path), o.data); else b.set(ref(o.path), o.data, { merge: !!o.merge }); });
          await b.commit();
        }
      },
      inc: n => increment(n),
      delField: () => deleteField()
    },
    storage: {
      upload: async (file, path) => {
        if (!config.storageBucket) throw new Error("Storage is not set up for this project.");
        const st = await import("../../vendor/firebase/firebase-storage.js");
        const r = st.ref(st.getStorage(app), path);
        await st.uploadBytes(r, file, { contentType: file.type });
        return st.getDownloadURL(r);
      }
    }
  };
  return api;
}
