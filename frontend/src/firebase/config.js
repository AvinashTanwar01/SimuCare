import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAKBcl9d_m4jzeBjkwuhM3Wb7IueCo7GHs",
  authDomain: "simucare-3dd35.firebaseapp.com",
  projectId: "simucare-3dd35",
  storageBucket: "simucare-3dd35.firebasestorage.app",
  messagingSenderId: "145980605885",
  appId: "1:145980605885:web:e6fbbb72c420bf6559fed4",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
