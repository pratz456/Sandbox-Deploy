export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUserProfileServer } from '@/lib/firebase/profiles-server';
import { getTransactionsServer, updateTransactionServerWithUserId } from '@/lib/firebase/transactions-server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';
import { analyzeTransaction, AIAnalysis } from '@/lib/openai/analysis';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`👤 Analyzing transactions for user: ${user.uid}`);

    // Get user profile for context using Firebase
    const { data: userProfile, error: profileError } = await getUserProfileServer(user.uid);

    if (profileError || !userProfile) {
      console.error('❌ User profile not found:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log(`👤 Found user profile for ${user.uid}:`, {
      profession: userProfile.profession,
      income: userProfile.income,
      state: userProfile.state,
      filing_status: userProfile.filing_status
    });

    // Get all transactions for the user using Firebase
    const { data: allTransactions, error: transactionsError } = await getTransactionsServer(user.uid);
    
    if (transactionsError) {
      console.error('❌ Error fetching transactions:', transactionsError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Filter for transactions that haven't been analyzed yet
    const transactions = allTransactions?.filter(transaction => 
      transaction.amount > 0 && // Only analyze expense transactions (positive amounts)
      (transaction.deduction_score === 0 || transaction.deduction_score === null || transaction.deduction_score === undefined) && // Look for transactions with default deduction_score
      (transaction.is_deductible === false || transaction.is_deductible === null || transaction.is_deductible === undefined) && // And default is_deductible
      !transaction.deductible_reason // And no deductible_reason yet
    ).slice(0, 50) || []; // Limit to 50 transactions at a time

    console.log(`🔍 Found ${transactions?.length || 0} transactions to analyze for user ${user.uid}`);
    
    // Test: Let's see what transactions we can actually read
    if (transactions && transactions.length > 0) {
      console.log(`📋 Sample transaction data:`, {
        trans_id: transactions[0].trans_id,
        merchant_name: transactions[0].merchant_name,
        amount: transactions[0].amount,
        is_deductible: transactions[0].is_deductible,
        deduction_score: transactions[0].deduction_score,
        deductible_reason: transactions[0].deductible_reason
      });
    }
    
    if (!transactions || transactions.length === 0) {
      // We already have all transactions from Firebase above
      const allTransactionsForDebug = allTransactions?.slice(0, 5) || [];

      console.log(`📊 Total transactions for user: ${allTransactions?.length || 0}`);
      if (allTransactions && allTransactions.length > 0) {
        console.log(`📊 Transactions with deduction_score > 0: ${allTransactions.filter(t => t.deduction_score > 0).length}`);
        console.log(`📊 Transactions with deduction_score = 0: ${allTransactions.filter(t => t.deduction_score === 0).length}`);
        console.log(`📊 Transactions with is_deductible = true: ${allTransactions.filter(t => t.is_deductible === true).length}`);
        console.log(`📊 Transactions with deductible_reason: ${allTransactions.filter(t => t.deductible_reason !== null).length}`);
      }

      return NextResponse.json({
        success: true,
        message: 'No transactions to analyze',
        analyzed: 0,
        total: 0,
      });
    }

    console.log(`🤖 Analyzing ${transactions.length} transactions for user ${user.uid}`);

    // Create context for OpenAI analysis
    const userContext = `
User Profile:
- Profession: ${userProfile.profession}
- Income: ${userProfile.income}
- State: ${userProfile.state}
- Filing Status: ${userProfile.filing_status}

Analysis Instructions:
For each transaction, determine if it's tax deductible for this business owner. Consider:
1. The user's profession and business type
2. Current tax laws and regulations
3. Whether the expense is ordinary and necessary for their business
4. The specific details of each transaction

Provide:
- is_deductible: true/false
- deductible_reason: Detailed explanation of why it is or isn't deductible
- deduction_score: Confidence score from 0.0 to 1.0 (0.0 = not deductible, 1.0 = definitely deductible)
`;

    let analyzedCount = 0;
    const analysisResults = [];

    // Analyze each transaction
    for (const transaction of transactions) {
      try {
        console.log(`📊 Analyzing transaction: ${transaction.merchant_name} - $${transaction.amount}`);

        // Mark transaction as currently being analyzed
        await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
          analysisStatus: 'running',
          analysisStartedAt: new Date()
        });

        // Analyze with OpenAI using the shared function (including user context)
        const result: AIAnalysis = await analyzeTransaction({
          merchant_name: transaction.merchant_name,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description,
          date: transaction.date
        }, userProfile);
        
        console.log(`📊 Analysis result for ${transaction.merchant_name}:`, result);
        
        // Update transaction using Firebase server function with userId for better performance
        const { error: updateError } = await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
          is_deductible: result.is_deductible,
          deduction_score: result.deduction_score,
          deductible_reason: result.reasoning, // Keep for backward compatibility
          analysisStatus: 'completed', // Mark as completed
          analyzed: true, // Mark as analyzed
          analysisCompletedAt: new Date()
        });

        if (updateError) {
          console.error(`❌ Failed to update transaction ${transaction.trans_id}:`, updateError);
          console.error(`❌ Update error details:`, {
            trans_id: transaction.trans_id,
            account_id: transaction.account_id,
            error: updateError
          });
          // Mark as failed if update failed
          await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
            analysisStatus: 'failed'
          });
        } else {
          console.log(`✅ Successfully updated transaction: ${transaction.merchant_name} (${transaction.trans_id})`);
          console.log(`   - is_deductible: ${result.is_deductible}`);
          console.log(`   - deduction_score: ${result.deduction_score}`);
          console.log(`   - reason: ${result.reasoning?.substring(0, 50)}...`);
          
          analyzedCount++;
          analysisResults.push({
            transaction_id: transaction.trans_id,
            merchant_name: transaction.merchant_name,
            analysis: result,
          });
        }

        // Minimal delay to avoid rate limiting (reduced from 100ms to 10ms)
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        console.error(`❌ Error analyzing transaction ${transaction.trans_id}:`, error);
        // Mark as failed if any error occurred
        await updateTransactionServerWithUserId(user.uid, transaction.trans_id, {
          analysisStatus: 'failed'
        });
      }
    }

    console.log(`🎉 Transaction analysis completed! Analyzed ${analyzedCount} out of ${transactions.length} transactions`);

    return NextResponse.json({
      success: true,
      analyzed: analyzedCount,
      total: transactions.length,
      results: analysisResults,
    });

  } catch (error) {
    console.error('Error in analyze-transactions API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transactions' },
      { status: 500 }
    );
  }
}