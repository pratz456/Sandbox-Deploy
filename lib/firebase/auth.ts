import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  onAuthStateChanged,
  getAuth
} from "firebase/auth";
import { auth } from "./client";
import { app } from "./client";

export interface AuthUser {
  id: string;
  email: string | null;
  user_metadata?: {
    name?: string;
  };
}

export async function signInUser(email: string, password: string): Promise<{ data: { user: AuthUser } | null; error: any }> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check if email is verified
    if (!user.emailVerified) {
      return { 
        data: null, 
        error: { 
          message: "Please verify your email before signing in. Check your inbox for a verification link.",
          code: "email-not-verified"
        } 
      };
    }
    
    return {
      data: {
        user: {
          id: user.uid,
          email: user.email,
          user_metadata: {
            name: user.displayName || undefined
          }
        }
      },
      error: null
    };
  } catch (error: any) {
    console.error('Error signing in:', error);
    return { data: null, error: { message: error.message } };
  }
}

export async function signUpUser(email: string, password: string): Promise<{ data: { user: AuthUser } | null; error: any }> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Send email verification
    await sendEmailVerification(user);
    
    return {
      data: {
        user: {
          id: user.uid,
          email: user.email,
          user_metadata: {
            name: user.displayName || undefined
          }
        }
      },
      error: null
    };
  } catch (error: any) {
    console.error('Error signing up:', error);
    return { data: null, error: { message: error.message } };
  }
}

export async function signOutUser(): Promise<{ error: any }> {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    console.error('Error signing out:', error);
    return { error: { message: error.message } };
  }
}

export async function resetPassword(email: string): Promise<{ error: any }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return { error: { message: error.message } };
  }
}

export async function updateUserPassword(newPassword: string): Promise<{ error: any }> {
  try {
    if (!auth.currentUser) {
      throw new Error('No authenticated user');
    }
    await updatePassword(auth.currentUser, newPassword);
    return { error: null };
  } catch (error: any) {
    console.error('Error updating password:', error);
    return { error: { message: error.message } };
  }
}

export async function resendEmailVerification(): Promise<{ error: any }> {
  try {
    if (!auth.currentUser) {
      throw new Error('No authenticated user');
    }
    await sendEmailVerification(auth.currentUser);
    return { error: null };
  } catch (error: any) {
    console.error('Error resending email verification:', error);
    return { error: { message: error.message } };
  }
}

export function getCurrentUser(): Promise<{ data: { user: AuthUser | null }; error: any }> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve({
          data: {
            user: {
              id: user.uid,
              email: user.email,
              user_metadata: {
                name: user.displayName || undefined
              }
            }
          },
          error: null
        });
      } else {
        resolve({ data: { user: null }, error: null });
      }
    });
  });
}

export function getSession(): Promise<{ data: { session: any }; error: any }> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve({
          data: {
            session: {
              user: {
                id: user.uid,
                email: user.email,
                user_metadata: {
                  name: user.displayName || undefined
                }
              }
            }
          },
          error: null
        });
      } else {
        resolve({ data: { session: null }, error: null });
      }
    });
  });
}

// Wait for authentication to be ready before making Firestore calls
export function waitForAuth(): Promise<string> {
  const auth = getAuth(app);
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { 
        unsub(); 
        resolve(u.uid); 
      }
    }, reject);
  });
}
