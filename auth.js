import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

await setPersistence(auth, browserLocalPersistence);

export function validSixDigitPassword(value) {
  return /^\d{6}$/.test(value);
}

export async function registerUser(name, email, password) {
  name = name.trim();
  email = email.trim();
  if (!name) throw new Error("Please enter your name.");
  if (!email) throw new Error("Please enter your email.");
  if (!validSixDigitPassword(password)) throw new Error("Password must be exactly 6 digits.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

export async function loginUser(email, password) {
  email = email.trim();
  if (!email) throw new Error("Please enter your email.");
  if (!validSixDigitPassword(password)) throw new Error("Password must be exactly 6 digits.");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function forgotPassword(email) {
  email = email.trim();
  if (!email) throw new Error("Enter your email first.");
  await sendPasswordResetEmail(auth, email);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function logout() {
  return signOut(auth);
}
