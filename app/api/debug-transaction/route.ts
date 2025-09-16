import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';
import { getTransactionsServer } from '@/lib/firebase/transactions-server';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { merchantName } = await request.json();
    
    console.log(`🔍 [Debug] Looking for transactions for merchant: ${merchantName}`);

    // Get all transactions for the user
    const { data: allTransactions, error: transactionsError } = await getTransactionsServer(user.uid);
    
    if (transactionsError) {
      console.error('❌ Error fetching transactions:', transactionsError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Find transactions matching the merchant name
    const matchingTransactions = allTransactions.filter(t => 
      t.merchant_name && t.merchant_name.toLowerCase().includes(merchantName.toLowerCase())
    );
    
    console.log(`📊 [Debug] Found ${matchingTransactions.length} matching transactions`);

    const debugInfo = matchingTransactions.map(transaction => ({
      id: transaction.id,
      trans_id: transaction.trans_id,
      merchant_name: transaction.merchant_name,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      is_deductible: transaction.is_deductible,
      deductible_reason: transaction.deductible_reason,
      deduction_score: transaction.deduction_score,
      analysisStatus: transaction.analysisStatus,
      analyzed: transaction.analyzed,
      // Check all possible fields that might contain analysis
      allFields: {
        ...transaction
      }
    }));

    return NextResponse.json({
      success: true,
      merchantName,
      totalTransactions: allTransactions.length,
      matchingTransactions: matchingTransactions.length,
      transactions: debugInfo
    });

  } catch (error) {
    console.error('❌ [Debug] Error debugging transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error during debug' },
      { status: 500 }
    );
  }
}
