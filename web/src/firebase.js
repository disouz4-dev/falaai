// PT-BR: Firebase Auth — inicialização + login Google + observador de sessão.
//        Usa o SDK modular carregado direto do CDN do Firebase (sem bundler).
// EN:    Firebase Auth — init + Google sign-in + session observer.
//        Uses the Firebase modular SDK loaded directly from the CDN (no bundler).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbCJ8QxKPZTwnbsJsnxVWl5ihflkTjUTs",
  authDomain: "openlingo-app.firebaseapp.com",
  projectId: "openlingo-app",
  storageBucket: "openlingo-app.firebasestorage.app",
  messagingSenderId: "740326087182",
  appId: "1:740326087182:web:3c19a492332e76373fba5f",
  measurementId: "G-G1R424MD7S",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// PT-BR: mantém o login salvo entre sessões (localStorage). EN: keep login across sessions.
setPersistence(auth, browserLocalPersistence).catch(() => {});

const googleProvider = new GoogleAuthProvider();

/** PT-BR: dispara a janela do Google e devolve o usuário. EN: open Google popup, return the user. */
export async function signInWithGoogle() {
  // PT-BR: redirect (não popup) — funciona com localhost em porta não-padrão, pois o
  //        Firebase normaliza a origem 'localhost' no fluxo de redirect.
  // EN:    redirect (not popup) — works on localhost with a non-standard port because
  //        Firebase normalizes the 'localhost' origin in the redirect flow.
  await signInWithRedirect(auth, googleProvider);
  const result = await getRedirectResult(auth);
  return result?.user ? toUser(result.user) : null;
}

/** PT-BR: encerra a sessão. EN: sign out. */
export async function signOutFirebase() {
  await signOut(auth);
}

/** PT-BR: observa a sessão (chama cb sempre que muda). EN: watch session (fires cb on change). */
export function onAuth(cb) {
  return onAuthStateChanged(auth, (user) => cb(user ? toUser(user) : null));
}

function toUser(u) {
  return {
    uid: u.uid,
    email: u.email,
    name: u.displayName || u.email || "Aluno(a)",
    picture: u.photoURL,
  };
}
