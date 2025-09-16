'use client';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // optional
};

// Initialize Firebase (prevent multiple initialization)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseApp = app; // backward compatibility

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Connect to emulators in development (disabled for now)
// Uncomment these lines if you want to use Firebase emulators
// if (process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_EMULATOR === 'true') {
//   try {
//     if (!auth.config.emulator) {
//       connectAuthEmulator(auth, "http://localhost:9099");
//     }
//   } catch (error) {
//     console.log('Firebase Auth emulator already connected or not available');
//   }
//   
//   try {
//     if (!(db as any)._delegate._databaseId.projectId.includes('demo-')) {
//       connectFirestoreEmulator(db, 'localhost', 8080);
//     }
//   } catch (error) {
//     console.log('Firestore emulator already connected or not available');
//   }
// }

// Client-side Firebase client
export function createClient() {
  return { auth, db };
}
