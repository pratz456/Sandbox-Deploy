// lib/firebase/admin.ts
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp, Firestore } from "firebase-admin/firestore";

// NOTE: keep env vars out of repo. These are expected to be set in environment (Vercel / local .env)
const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
};

// Initialize the admin app only once (guard double-init)
const app: App =
  getApps().length === 0
    ? initializeApp({
        credential: cert(firebaseAdminConfig),
        projectId: firebaseAdminConfig.projectId,
      })
    : (getApps()[0] as App);

// Named exports used by other modules:
export const auth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);

// Also export FieldValue and Timestamp helpers if other modules import them
export { FieldValue, Timestamp };

// Export the admin app itself (some modules import default/admin)
export const admin = app;
export default app;

// Helper function to verify ID tokens
export async function verifyIdToken(idToken: string) {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return { success: true, uid: decodedToken.uid, email: decodedToken.email };
  } catch (error) {
    // keep this console.error - helpful for server logs
    console.error("Error verifying ID token:", error);
    return { success: false, error };
  }
}

// Helper to get user by email
export async function getUserByEmail(email: string) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    return { success: true, user: userRecord };
  } catch (error) {
    console.error("Error getting user by email:", error);
    return { success: false, error };
  }
}

// Helper to update user's email verification status
export async function updateEmailVerified(uid: string, emailVerified: boolean) {
  try {
    await auth.updateUser(uid, { emailVerified });
    return { success: true };
  } catch (error) {
    console.error("Error updating email verification:", error);
    return { success: false, error };
  }
}
