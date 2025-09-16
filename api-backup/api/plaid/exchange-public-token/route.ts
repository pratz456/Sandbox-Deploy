import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { upsertUserProfileServer } from '@/lib/firebase/profiles-server';
import { createAccountServer } from '@/lib/firebase/accounts-server';
import { createTransactionServer } from '@/lib/firebase/transactions-server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';
import { createTransactionHash } from '@/lib/utils/transaction-hash';

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
    console.log('🔄 [Plaid Exchange] Starting token exchange...');
    
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      console.error('❌ [Plaid Exchange] Authentication failed:', authError);
      return NextResponse.json({ 
        error: 'Authentication failed. Please log in again.',
        details: authError 
      }, { status: 401 });
    }

    console.log('✅ [Plaid Exchange] User authenticated:', user.uid);

    const { public_token } = await request.json();
    console.log('🔑 [Plaid Exchange] Got public token, length:', public_token?.length || 0);

    if (!public_token) {
      return NextResponse.json({ error: 'Public token is required' }, { status: 400 });
    }

    // Exchange public token for access token
    console.log('🔄 [Plaid Exchange] Exchanging public token...');
    const tokenResponse = await client.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = tokenResponse.data.access_token;
    const itemId = tokenResponse.data.item_id;
    console.log('✅ [Plaid Exchange] Got access token and item ID');

    // Get account information
    console.log('🏦 [Plaid Exchange] Fetching accounts...');
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });
    console.log('✅ [Plaid Exchange] Got', accountsResponse.data.accounts.length, 'accounts');

    // Save the access token to user_profiles table
    console.log('💾 Saving Plaid access token to user_profiles table...');
    
    // Update the user's plaid_token in the user_profiles table using Firebase
    console.log('💾 [Plaid Exchange] Attempting to save Plaid token for user:', user.uid);
    console.log('💾 [Plaid Exchange] Access token length:', accessToken.length);
    
    const { data: profileData, error: profileError } = await upsertUserProfileServer(user.uid, {
      plaid_token: accessToken
    });
    
    if (profileError) {
      console.error('❌ [Plaid Exchange] Failed to save Plaid token:', profileError);
      console.error('❌ [Plaid Exchange] Error type:', typeof profileError);
      console.error('❌ [Plaid Exchange] Error details:', JSON.stringify(profileError, null, 2));
      return NextResponse.json({ 
        error: 'Failed to save Plaid token to database',
        details: profileError 
      }, { status: 500 });
    } else {
      console.log('✅ [Plaid Exchange] Plaid token saved successfully');
      console.log('✅ [Plaid Exchange] Updated profile:', profileData);
    }

    // Save accounts to the accounts table using Firebase
    console.log('💾 Saving accounts to database...');
    console.log('Accounts to save:', accountsResponse.data.accounts);
    
    const savedAccounts = [];
    for (const account of accountsResponse.data.accounts) {
      const { data: savedAccount, error: accountError } = await createAccountServer(user.uid, {
        account_id: account.account_id,
        name: account.name,
        mask: account.mask || '',
        type: account.type,
        subtype: account.subtype || '',
        institution_id: account.institution_id || '',
        access_token: accessToken, // Add access token to each account
      });

      if (accountError) {
        console.error('❌ Failed to save account:', account.account_id, accountError);
        console.error('Account data that failed:', {
          account_id: account.account_id,
          name: account.name,
          mask: account.mask || '',
          type: account.type,
          subtype: account.subtype || '',
          institution_id: account.institution_id || '',
          access_token_length: accessToken.length,
        });
      } else {
        console.log('✅ Saved account:', account.account_id, savedAccount?.name);
        savedAccounts.push(savedAccount);
      }
    }

    // Fetch and save transactions for each account
    console.log('🔄 Fetching transactions for all accounts...');
    let totalTransactionsSaved = 0;

    // Get the current cursor for this user (if any) - for now we'll skip cursor logic
    // TODO: Implement cursor storage in Firebase user profiles
    const cursor = null;
    console.log(`📊 Using cursor for user ${user.uid}:`, cursor);

    // Fetch transactions using Plaid's transactionsSync (for all accounts)
    console.log('📊 [Plaid Exchange] Fetching transactions...');
    const transactionsResponse = await client.transactionsSync({
      access_token: accessToken,
      options: {
        include_personal_finance_category: true,
        include_logo_and_counterparty_beta: true,
      },
    });

    // Process all transactions (no need to filter by account since we're processing all)
    const allTransactions = transactionsResponse.data.added;
    console.log(`📈 [Plaid Exchange] Found ${allTransactions.length} total transactions for user ${user.uid}`);

    if (allTransactions.length > 0) {
      // Save transactions to Firebase
      for (const transaction of allTransactions) {
        const category = transaction.personal_finance_category?.detailed || transaction.category?.[0] || 'Other';
        
        console.log(`📝 Saving transaction: ${transaction.merchant_name || transaction.name} - ${category}`);
        
        // Create transaction hash for idempotency
        const transactionHash = createTransactionHash({
          trans_id: transaction.transaction_id,
          account_id: transaction.account_id,
          date: transaction.date,
          amount: transaction.amount,
          merchant_name: transaction.merchant_name || transaction.name,
          category: category,
          description: transaction.name
        });

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
            analyzed: false,
            analysisStatus: 'pending',
            transactionHash: transactionHash,
            analysisStartedAt: null,
            analysisCompletedAt: null
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
    } else {
      console.log(`📭 No new transactions for user ${user.uid}`);
    }
    
    console.log(`🎉 Bank connection successful! Saved ${totalTransactionsSaved} total transactions`);

    // Automatically trigger analysis for the first account
    if (accountsResponse.data.accounts.length > 0) {
      const firstAccountId = accountsResponse.data.accounts[0].account_id;
      console.log(`🚀 [Auto-Analyze] Triggering automatic analysis for account: ${firstAccountId}`);
      
      try {
        // Start analysis in background (don't wait for completion)
        fetch(`${request.nextUrl.origin}/api/plaid/auto-analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${request.headers.get('authorization')?.replace('Bearer ', '') || ''}`
          },
          body: JSON.stringify({ accountId: firstAccountId })
        }).catch(error => {
          console.warn('⚠️ [Auto-Analyze] Background analysis trigger failed:', error);
        });
        
        console.log('✅ [Auto-Analyze] Analysis triggered successfully');
      } catch (error) {
        console.warn('⚠️ [Auto-Analyze] Failed to trigger analysis:', error);
      }
    }

    return NextResponse.json({
      access_token: accessToken,
      item_id: itemId,
      accounts: accountsResponse.data.accounts,
      transactions_saved: totalTransactionsSaved,
      message: 'Bank connection successful! Analysis started automatically.',
      autoAnalysisTriggered: true,
      accountId: accountsResponse.data.accounts[0]?.account_id
    });
  } catch (error) {
    console.error('❌ [Plaid Exchange] Error exchanging public token:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('❌ [Plaid Exchange] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to exchange public token. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
