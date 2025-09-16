import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';
import { getTransactionsServer, updateTransactionServerWithUserId } from '@/lib/firebase/transactions-server';
import { analyzeTransactionDeductibility } from '@/lib/openai/analysis';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      console.error('❌ [Auto-Analyze] Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = await request.json();
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    console.log('🚀 [Auto-Analyze] Starting automatic analysis for user:', user.uid, 'account:', accountId);

    // Get all pending transactions for this user
    const { data: allTransactions, error: fetchError } = await getTransactionsServer(user.uid);
    
    if (fetchError) {
      console.error('❌ [Auto-Analyze] Failed to fetch transactions:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch transactions',
        details: fetchError.message || fetchError
      }, { status: 500 });
    }

    // Filter for pending transactions from the specific account
    const pendingTransactions = allTransactions.filter(t => 
      t.account_id === accountId && 
      (!t.analyzed || t.analysisStatus === 'pending') &&
      t.transactionHash // Only analyze transactions with hash (from Plaid)
    );

    console.log(`📊 [Auto-Analyze] Found ${pendingTransactions.length} pending transactions for analysis`);

    if (pendingTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending transactions to analyze',
        analyzedCount: 0
      });
    }

    // Start analysis for all pending transactions
    const analysisPromises = pendingTransactions.map(async (transaction) => {
      try {
        console.log(`🔍 [Auto-Analyze] Analyzing transaction: ${transaction.merchant_name} (${transaction.trans_id})`);
        
        // Mark as running
        await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
          analysisStatus: 'running',
          analysisStartedAt: new Date()
        });

        // Analyze with OpenAI
        const analysis = await analyzeTransactionDeductibility({
          merchant_name: transaction.merchant_name,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description
        });

        if (analysis.success) {
          // Update transaction with analysis results
          await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
            is_deductible: null, // Always null to require user review
            deductible_reason: analysis.data.deductible_reason,
            deduction_score: analysis.data.deduction_score,
            analyzed: true,
            analysisStatus: 'completed',
            analysisCompletedAt: new Date()
          });

          console.log(`✅ [Auto-Analyze] Successfully analyzed: ${transaction.merchant_name}`);
          return { success: true, transactionId: transaction.trans_id };
        } else {
          throw new Error(analysis.error || 'Analysis failed');
        }
      } catch (error) {
        console.error(`❌ [Auto-Analyze] Failed to analyze ${transaction.merchant_name}:`, error);
        
        // Mark as failed
        await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
          analysisStatus: 'failed',
          analysisCompletedAt: new Date()
        });

        return { success: false, transactionId: transaction.trans_id, error: error.message };
      }
    });

    // Wait for all analyses to complete
    const results = await Promise.allSettled(analysisPromises);
    
    // Count successful analyses
    const successfulAnalyses = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    const failedAnalyses = results.filter(r => 
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length;

    console.log(`🎉 [Auto-Analyze] Analysis complete. Success: ${successfulAnalyses}, Failed: ${failedAnalyses}`);

    return NextResponse.json({
      success: true,
      message: 'Automatic analysis completed',
      totalTransactions: pendingTransactions.length,
      analyzedCount: successfulAnalyses,
      failedCount: failedAnalyses,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    });

  } catch (error) {
    console.error('❌ [Auto-Analyze] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
