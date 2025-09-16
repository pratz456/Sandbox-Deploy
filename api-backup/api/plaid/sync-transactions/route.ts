import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getUserProfileServer, upsertUserProfileServer } from '@/lib/firebase/profiles-server';
import { getTransactionsServer, createTransactionServer } from '@/lib/firebase/transactions-server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [Plaid Sync] Starting transaction sync...');
    
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      console.error('❌ [Plaid Sync] Authentication failed:', authError);
      return NextResponse.json({ 
        error: 'Authentication failed. Please log in again.',
        details: authError 
      }, { status: 401 });
    }

    console.log('✅ [Plaid Sync] User authenticated:', user.uid);

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the authenticated user matches the requested userId
    if (user.uid !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to user data' }, { status: 403 });
    }

    // Get user's Plaid access token and cursor from Firebase
    const { data: userProfile, error: profileError } = await getUserProfileServer(user.uid);

    if (profileError || !userProfile?.plaid_token) {
      console.error('❌ [Plaid Sync] No Plaid token found for user:', user.uid);
      return NextResponse.json({ 
        error: 'No Plaid token found for user',
        details: profileError 
      }, { status: 404 });
    }

    console.log(`🔄 Syncing transactions for user ${user.uid}...`);
    let totalTransactionsSaved = 0;

    try {
      console.log(`📊 Using cursor for user ${user.uid}:`, userProfile.last_cursor);
      
      // Fetch transactions using Plaid's transactionsSync (for all accounts)
      const transactionsResponse = await client.transactionsSync({
        access_token: userProfile.plaid_token,
        options: {
          include_personal_finance_category: true,
          include_logo_and_counterparty_beta: true,
        },
      });

      console.log(`📊 Plaid transactionsSync response for user ${user.uid}:`);
      console.log('Response structure:', {
        hasAdded: !!transactionsResponse.data.added,
        hasModified: !!transactionsResponse.data.modified,
        hasRemoved: !!transactionsResponse.data.removed,
        hasNextCursor: !!transactionsResponse.data.next_cursor,
        addedCount: transactionsResponse.data.added?.length || 0,
        modifiedCount: transactionsResponse.data.modified?.length || 0,
        removedCount: transactionsResponse.data.removed?.length || 0,
      });

      // Process all transactions (no need to filter by account since we're processing all)
      const allTransactions = transactionsResponse.data.added;
      console.log(`📈 Found ${allTransactions.length} total transactions for user ${user.uid}`);

      if (allTransactions.length > 0) {
        // Save transactions to Firebase
        for (const transaction of allTransactions) {
          const category = transaction.personal_finance_category?.detailed || transaction.category?.[0] || 'Other';
          
          console.log(`📝 Saving transaction: ${transaction.merchant_name || transaction.name} - ${category}`);
          
          const { data: savedTransaction, error: transactionError } = await createTransactionServer(
            user.uid,
            transaction.account_id,
            {
              trans_id: transaction.transaction_id,
              date: transaction.date,
              amount: transaction.amount,
              merchant_name: transaction.merchant_name || transaction.name,
              category: category,
              description: transaction.name,
              is_deductible: null, // Will be updated by AI analysis
              deductible_reason: null,
              deduction_score: 0,
            }
          );

          if (transactionError) {
            console.error(`❌ Failed to save transaction ${transaction.transaction_id}:`, transactionError);
            console.error('Transaction data that failed:', {
              trans_id: transaction.transaction_id,
              account_id: transaction.account_id,
              merchant_name: transaction.merchant_name || transaction.name,
              amount: transaction.amount,
              date: transaction.date,
            });
          } else {
            console.log(`✅ Saved transaction: ${transaction.transaction_id} - ${savedTransaction?.merchant_name}`);
            totalTransactionsSaved++;
          }
        }

        // Update the cursor for this user
        const newCursor = transactionsResponse.data.next_cursor;
        if (newCursor) {
          const { error: cursorError } = await upsertUserProfileServer(user.uid, {
            last_cursor: newCursor
          });

          if (cursorError) {
            console.error(`❌ Failed to update cursor for user ${user.uid}:`, cursorError);
          } else {
            console.log(`✅ Updated cursor for user ${user.uid}: ${newCursor}`);
          }
        }
      } else {
        console.log(`📭 No new transactions for user ${user.uid}`);
      }
    } catch (error) {
      console.error(`❌ Error syncing transactions for user ${user.uid}:`, error);
      return NextResponse.json({ 
        error: 'Failed to sync transactions from Plaid',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    console.log(`🎉 Transaction sync completed! Saved ${totalTransactionsSaved} transactions`);

    return NextResponse.json({
      success: true,
      accounts_processed: 1, // We process all accounts at once
      transactions_saved: totalTransactionsSaved,
    });
  } catch (error) {
    console.error('❌ [Plaid Sync] Error syncing transactions:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('❌ [Plaid Sync] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to sync transactions. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 