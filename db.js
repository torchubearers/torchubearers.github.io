// db.js — saves quiz results to Firestore and sends analytics events.
// Put this file in the SAME folder as auth.js (the one index.html imports).
import { auth } from "./auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics, logEvent, isSupported }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

const db = getFirestore(auth.app);
let analytics = null;
isSupported().then(ok => { if (ok) analytics = getAnalytics(auth.app); }).catch(() => {});

window.bqDB = {
  // users/{uid}/attempts/{autoId}
  async saveAttempt(attempt) {
    const u = auth.currentUser;
    if (!u) return;
    await addDoc(collection(db, "users", u.uid, "attempts"), attempt);
  },
  async loadAttempts() {
    const u = auth.currentUser;
    if (!u) return [];
    const snap = await getDocs(
      query(collection(db, "users", u.uid, "attempts"), orderBy("ts", "desc"), limit(200))
    );
    return snap.docs.map(d => d.data());
  },
  track(name, params) {
    try { if (analytics) logEvent(analytics, name, params); } catch (e) {}
  }
};
