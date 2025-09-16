import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  DocumentData 
} from "firebase/firestore";
import { db } from "./client";
import { waitForAuth } from "./auth";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  profession: string;
  income: string;
  state: string;
  filing_status: string;
  plaid_token?: string;
  onboardingIntroCompleted?: boolean;
  onboardingPlaidGuideCompleted?: boolean;
  created_at?: any;
  updated_at?: any;
}

// Client-side function (for use in components) - now auth-gated
export async function getUserProfileSafe(): Promise<{ data: UserProfile | null; error: any }> {
  try {
    const uid = await waitForAuth(); // gate by auth
    const docRef = doc(db, "user_profiles", uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as DocumentData;
              return {
          data: {
            id: docSnap.id,
            email: data.email || '',
            name: data.name || '',
            profession: data.profession || '',
            income: data.income || '',
            state: data.state || '',
            filing_status: data.filing_status || '',
            plaid_token: data.plaid_token,
            onboardingIntroCompleted: data.onboardingIntroCompleted,
            onboardingPlaidGuideCompleted: data.onboardingPlaidGuideCompleted,
            created_at: data.created_at,
            updated_at: data.updated_at,
          },
          error: null
        };
    } else {
      return { data: null, error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } };
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    // Return a structured error object
    return { 
      data: null, 
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        originalError: error
      }
    };
  }
}

// Backward-compatible function (deprecated - use getUserProfileSafe instead)
export async function getUserProfile(userId: string): Promise<{ data: UserProfile | null; error: any }> {
  try {
    const docRef = doc(db, "user_profiles", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as DocumentData;
      return {
        data: {
          id: data.id || userId,
          email: data.email || '',
          name: data.name || '',
          profession: data.profession || '',
          income: data.income || '',
          state: data.state || '',
          filing_status: data.filing_status || '',
          plaid_token: data.plaid_token,
          onboardingIntroCompleted: data.onboardingIntroCompleted || false,
          onboardingPlaidGuideCompleted: data.onboardingPlaidGuideCompleted || false,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
        error: null
      };
    } else {
      return { data: null, error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } };
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return { 
      data: null, 
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        originalError: error
      }
    };
  }
}

// Client-side function (for use in components)
export async function upsertUserProfile(
  userId: string, 
  profileData: Partial<UserProfile>
): Promise<{ data: UserProfile | null; error: any }> {
  try {
    console.log('🔄 [Firebase Profile] Upserting profile for user:', userId);
    console.log('🔄 [Firebase Profile] Profile data:', profileData);
    
    const docRef = doc(db, "user_profiles", userId);
    const updateData = {
      ...profileData,
      updated_at: serverTimestamp(),
    };
    
    console.log('🔄 [Firebase Profile] Update data prepared:', updateData);
    
    // Check if document exists
    console.log('🔍 [Firebase Profile] Checking if document exists...');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('📝 [Firebase Profile] Document exists, updating...');
      // Update existing document
      await updateDoc(docRef, updateData);
      console.log('✅ [Firebase Profile] Document updated successfully');
    } else {
      console.log('📝 [Firebase Profile] Document does not exist, creating...');
      // Create new document with default onboarding values
      await setDoc(docRef, {
        ...updateData,
        onboardingIntroCompleted: false,
        onboardingPlaidGuideCompleted: false,
        created_at: serverTimestamp(),
      });
      console.log('✅ [Firebase Profile] Document created successfully');
    }
    
    // Return the updated profile
    const updatedDoc = await getDoc(docRef);
    if (updatedDoc.exists()) {
      const data = updatedDoc.data() as DocumentData;
      return {
        data: {
          id: updatedDoc.id,
          email: data.email || '',
          name: data.name || '',
          profession: data.profession || '',
          income: data.income || '',
          state: data.state || '',
          filing_status: data.filing_status || '',
          plaid_token: data.plaid_token,
          onboardingIntroCompleted: data.onboardingIntroCompleted,
          onboardingPlaidGuideCompleted: data.onboardingPlaidGuideCompleted,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
        error: null
      };
    }
    
    return { data: null, error: new Error('Failed to retrieve updated profile') };
  } catch (error) {
    console.error('❌ [Firebase Profile] Error upserting user profile:', error);
    console.error('❌ [Firebase Profile] Error type:', typeof error);
    console.error('❌ [Firebase Profile] Error details:', JSON.stringify(error, null, 2));
    return { data: null, error };
  }
}

// Client-side function to update specific profile fields
export async function updateUserProfile(
  userId: string, 
  updates: Partial<UserProfile>
): Promise<{ data: UserProfile | null; error: any }> {
  try {
    console.log('🔄 [Firebase Profile] Updating profile for user:', userId);
    console.log('🔄 [Firebase Profile] Updates:', updates);
    
    const docRef = doc(db, "user_profiles", userId);
    const updateData = {
      ...updates,
      updated_at: serverTimestamp(),
    };
    
    await updateDoc(docRef, updateData);
    console.log('✅ [Firebase Profile] Profile updated successfully');
    
    // Return the updated profile
    const updatedDoc = await getDoc(docRef);
    if (updatedDoc.exists()) {
      const data = updatedDoc.data() as DocumentData;
      return {
        data: {
          id: updatedDoc.id,
          email: data.email || '',
          name: data.name || '',
          profession: data.profession || '',
          income: data.income || '',
          state: data.state || '',
          filing_status: data.filing_status || '',
          plaid_token: data.plaid_token,
          onboardingIntroCompleted: data.onboardingIntroCompleted,
          onboardingPlaidGuideCompleted: data.onboardingPlaidGuideCompleted,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
        error: null
      };
    }
    
    return { data: null, error: new Error('Failed to retrieve updated profile') };
  } catch (error) {
    console.error('❌ [Firebase Profile] Error updating user profile:', error);
    return { data: null, error };
  }
}
