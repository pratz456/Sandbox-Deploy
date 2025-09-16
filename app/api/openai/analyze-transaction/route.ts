export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'
import { analyzeTransaction, AIAnalysis } from '@/lib/openai/analysis'
import { getAuthenticatedUser } from '@/lib/firebase/api-auth'
import { getUserProfileServer } from '@/lib/firebase/profiles-server'

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transaction } = await request.json()
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction data is required' }, { status: 400 })
    }

    // Validate required fields
    if (!transaction.merchant_name || !transaction.amount) {
      return NextResponse.json({ 
        error: 'Transaction must include merchant_name and amount' 
      }, { status: 400 })
    }

    // Get user profile for context
    const { data: userProfile, error: profileError } = await getUserProfileServer(user.uid);
    
    if (profileError || !userProfile) {
      console.error('❌ [OpenAI Analysis] User profile not found:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log('🤖 Analyzing transaction with OpenAI:', {
      merchant: transaction.merchant_name,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      userProfile: {
        profession: userProfile.profession,
        income: userProfile.income,
        state: userProfile.state,
        filing_status: userProfile.filing_status
      }
    })

    const result: AIAnalysis = await analyzeTransaction(transaction, userProfile)
    
    console.log('✅ Analysis complete:', {
      deductible: result.is_deductible,
      reason: result.reasoning,
      confidence: `${Math.round((result.deduction_score || 0) * 100)}%`,
      status_label: result.status_label
    })

    return NextResponse.json({
      success: true,
      analysis: {
        is_deductible: result.is_deductible,
        deduction_reason: result.reasoning,
        deduction_score: result.deduction_score,
        status_label: result.status_label,
        reasoning: result.reasoning,
        irs_publication: result.irs_publication,
        irs_section: result.irs_section,
        required_docs: result.required_docs,
        category_hint: result.category_hint,
        risk_flags: result.risk_flags,
        model: result.model
      }
    })
  } catch (error) {
    console.error('Error in OpenAI analysis API:', error)
    return NextResponse.json(
      { error: 'Internal server error during analysis' },
      { status: 500 }
    )
  }
}
