import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDXSzZI0yVqgjU61d3_X5_F73ZZdgV8YPE",
  authDomain: "fahrerapp-pro.firebaseapp.com",
  projectId: "fahrerapp-pro",
  storageBucket: "fahrerapp-pro.appspot.com",
  messagingSenderId: "371465716845",
  appId: "1:371465716845:web:27ff414ee40c8204e9eb64",
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);