import { NextRequest, NextResponse } from 'next/server';
import { getUserProfileServer } from '@/lib/firebase/profiles-server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [User Profile API] Starting request...');
    
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      console.error('❌ [User Profile API] Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [User Profile API] User authenticated:', user.uid);

    // Get user profile using Firebase server function
    const { data: userProfile, error } = await getUserProfileServer(user.uid);

    if (error) {
      console.error('❌ [User Profile API] Error fetching user profile:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch user profile',
        details: error.message || error
      }, { status: 500 });
    }

    if (!userProfile) {
      console.log('⚠️ [User Profile API] No user profile found for user:', user.uid);
      return NextResponse.json({ 
        error: 'User profile not found',
        details: 'No profile exists for this user'
      }, { status: 404 });
    }

    console.log('✅ [User Profile API] Successfully fetched user profile');

    const response = NextResponse.json({
      success: true,
      data: userProfile
    });

    // Add cache headers for better performance
    response.headers.set('Cache-Control', 'private, max-age=1800'); // 30 minutes
    response.headers.set('ETag', `"${user.uid}-profile"`);

    return response;
  } catch (error) {
    console.error('❌ [User Profile API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch user profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
