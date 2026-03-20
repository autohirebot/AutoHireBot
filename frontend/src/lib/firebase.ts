import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD8zocSGGM6QjDq-CWkN1A7JT7bdA1Weps",
  authDomain: "autohirebot.firebaseapp.com",
  projectId: "autohirebot",
  storageBucket: "autohirebot.firebasestorage.app",
  messagingSenderId: "295514208219",
  appId: "1:295514208219:web:22e3eda8f030cf418d59fe"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
