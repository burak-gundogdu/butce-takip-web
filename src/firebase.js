import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBJnnbiH7i6TRXB4JMu-qNmsw-HyU8BQAc",
  authDomain: "butce-takip-d3682.firebaseapp.com",
  projectId: "butce-takip-d3682",
  storageBucket: "butce-takip-d3682.firebasestorage.app",
  messagingSenderId: "126901601202",
  appId: "1:126901601202:web:3ff4b258cc131747bd1aab"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
