import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionServerWithUserId } from '@/lib/firebase/transactions-server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      console.error('❌ [API UPDATE→DB] Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = params.id;
    const updates = await request.json();

    console.log('🔄 [API UPDATE→DB] Updating transaction:', transactionId, updates);

    // Update the transaction using Firebase server function
    const { data, error } = await updateTransactionServerWithUserId(user.uid, transactionId, updates);

    if (error) {
      console.error('❌ [API UPDATE→DB] Update failed:', error);
      return NextResponse.json(
        { error: 'Update failed', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ [API UPDATE→DB] Update successful:', data);

    return NextResponse.json({
      success: true,
      transaction: data
    });

  } catch (error) {
    console.error('❌ [API UPDATE→DB] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
