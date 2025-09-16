export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeTransactionWithRetry, TransactionInput, UserContext } from '@/lib/ai/analyzeTransaction';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';
import { getUserProfileServer } from '@/lib/firebase/profiles-server';
import { updateTransactionServerWithUserId } from '@/lib/firebase/transactions-server';

// Zod schema for request validation
const AnalyzeTransactionRequestSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  transaction: z.object({
    merchant_name: z.string().min(1, 'Merchant name is required'),
    amount: z.number(),
    category: z.string(),
    date: z.string(),
    account_id: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`👤 [AI Analysis API] Analyzing transaction for user: ${user.uid}`);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = AnalyzeTransactionRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('❌ [AI Analysis API] Validation error:', validationResult.error);
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const { transactionId, transaction } = validationResult.data;

    // Get user profile for context
    const { data: userProfile, error: profileError } = await getUserProfileServer(user.uid);

    if (profileError || !userProfile) {
      console.error('❌ [AI Analysis API] User profile not found:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log(`👤 [AI Analysis API] Found user profile for ${user.uid}:`, {
      profession: userProfile.profession,
      income: userProfile.income,
      state: userProfile.state,
      filing_status: userProfile.filing_status
    });

    // Prepare user context
    const userContext: UserContext = {
      profession: userProfile.profession,
      income: userProfile.income,
      state: userProfile.state,
      filing_status: userProfile.filing_status,
    };

    // Prepare transaction input
    const transactionInput: TransactionInput = {
      merchant_name: transaction.merchant_name,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      account_id: transaction.account_id,
      description: transaction.description,
      notes: transaction.notes,
    };

    console.log(`🤖 [AI Analysis API] Starting analysis for transaction: ${transaction.merchant_name} - $${transaction.amount}`);

    // Analyze transaction with retry logic
    const analysisResult = await analyzeTransactionWithRetry(transactionInput, userContext);

    if (!analysisResult.success) {
      console.error('❌ [AI Analysis API] Analysis failed:', analysisResult.error);
      return NextResponse.json({ 
        error: 'Analysis failed', 
        details: analysisResult.error 
      }, { status: 500 });
    }

    const { result } = analysisResult;

    console.log(`✅ [AI Analysis API] Analysis complete for ${transaction.merchant_name}:`, {
      deductionStatus: result.deductionStatus,
      confidence: result.confidence,
      reasoning: result.reasoning,
      irsReference: result.irsReference,
    });

    // Save analysis results to Firestore
    const analysisData = {
      deductionStatus: result.deductionStatus,
      confidence: result.confidence,
      reasoning: result.reasoning,
      irsPublication: result.irsReference?.publication || null,
      irsSection: result.irsReference?.section || null,
      updatedAt: new Date().toISOString(),
    };

    const { error: updateError } = await updateTransactionServerWithUserId(user.uid, transactionId, analysisData);

    if (updateError) {
      console.error(`❌ [AI Analysis API] Failed to save analysis for transaction ${transactionId}:`, updateError);
      return NextResponse.json({ 
        error: 'Analysis completed but failed to save results' 
      }, { status: 500 });
    }

    console.log(`💾 [AI Analysis API] Successfully saved analysis for transaction: ${transaction.merchant_name} (${transactionId})`);

    // Return the analysis results
    return NextResponse.json({
      success: true,
      analysis: {
        deductionStatus: result.deductionStatus,
        confidence: result.confidence,
        reasoning: result.reasoning,
        irsReference: result.irsReference,
        updatedAt: analysisData.updatedAt,
      }
    });

  } catch (error) {
    console.error('❌ [AI Analysis API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}