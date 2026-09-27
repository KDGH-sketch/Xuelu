// Picks the backend: Firebase when configured, otherwise the in-browser demo.
import { firebaseConfig } from "../config.js";
let apiPromise;
export function getApi(){
  if (!apiPromise){
    apiPromise = firebaseConfig
      ? import("./firebase.js").then(m => m.createFirebaseApi(firebaseConfig))
      : import("./local.js").then(m => m.createLocalApi());
  }
  return apiPromise;
}
