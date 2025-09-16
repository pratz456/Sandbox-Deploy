import { adminDb } from "./admin";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  profession: string;
  income: string;
  state: string;
  filing_status: string;
  plaid_token?: string;
  created_at?: any;
  updated_at?: any;
}

// Server-side function (for use in API routes)
export async function getUserProfileServer(userId: string): Promise<{ data: UserProfile | null; error: any }> {
  try {
    const docRef = adminDb.collection("user_profiles").doc(userId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) {
        return { data: null, error: new Error('Document data is null') };
      }
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
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
        error: null
      };
    } else {
      return { data: null, error: { code: 'PGRST116', message: 'Profile not found' } };
    }
  } catch (error) {
    console.error('Error getting user profile (server):', error);
    return { data: null, error };
  }
}

// Server-side function (for use in API routes)
export async function upsertUserProfileServer(
  userId: string, 
  profileData: Partial<UserProfile>
): Promise<{ data: UserProfile | null; error: any }> {
  try {
    console.log('🔄 [Firebase Profile Server] Upserting profile for user:', userId);
    console.log('🔄 [Firebase Profile Server] Profile data:', profileData);
    console.log('📂 [Firebase Profile Server] Writing to user_profiles collection for user:', userId);
    
    const docRef = adminDb.collection("user_profiles").doc(userId);
    console.log('📂 [Firebase Profile Server] Document reference created:', docRef.path);
    
    const updateData = {
      ...profileData,
      updated_at: new Date(),
    };
    
    console.log('🔄 [Firebase Profile Server] Update data prepared:', updateData);
    
    // Check if document exists
    console.log('🔍 [Firebase Profile Server] Checking if document exists...');
    const docSnap = await docRef.get();
    console.log('🔍 [Firebase Profile Server] Document exists:', docSnap.exists);
    
    if (docSnap.exists) {
      console.log('📝 [Firebase Profile Server] Document exists, updating...');
      // Update existing document
      await docRef.update(updateData);
      console.log('✅ [Firebase Profile Server] Document updated successfully');
    } else {
      console.log('📝 [Firebase Profile Server] Document does not exist, creating...');
      // Create new document
      const createData = {
        ...updateData,
        created_at: new Date(),
      };
      console.log('📝 [Firebase Profile Server] Creating document with data:', createData);
      await docRef.set(createData);
      console.log('✅ [Firebase Profile Server] Document created successfully');
    }
    
    // Return the updated profile
    console.log('🔄 [Firebase Profile Server] Retrieving updated document...');
    const updatedDoc = await docRef.get();
    if (updatedDoc.exists) {
      const data = updatedDoc.data();
      if (!data) {
        console.error('❌ [Firebase Profile Server] Document exists but data is null');
        return { data: null, error: new Error('Document data is null') };
      }
      console.log('✅ [Firebase Profile Server] Successfully retrieved updated document:', data);
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
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
        error: null
      };
    }
    
    console.error('❌ [Firebase Profile Server] Failed to retrieve updated document');
    return { data: null, error: new Error('Failed to retrieve updated profile') };
  } catch (error) {
    console.error('❌ [Firebase Profile Server] Error upserting user profile:', error);
    console.error('❌ [Firebase Profile Server] Error type:', typeof error);
    console.error('❌ [Firebase Profile Server] Error details:', JSON.stringify(error, null, 2));
    if (error instanceof Error) {
      console.error('❌ [Firebase Profile Server] Error message:', error.message);
      console.error('❌ [Firebase Profile Server] Error code:', (error as any).code);
    }
    return { data: null, error };
  }
}
