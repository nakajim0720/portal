import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCypeHH3dX5WfVgzT0pw3uVGlgmJ-SDL8o",
  authDomain: "portal-5e03b.firebaseapp.com",
  projectId: "portal-5e03b",
  storageBucket: "portal-5e03b.firebasestorage.app",
  messagingSenderId: "494727611069",
  appId: "1:494727611069:web:44f945bd53fa4adbcfadd4",
  measurementId: "G-JN42QEN20P"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut };