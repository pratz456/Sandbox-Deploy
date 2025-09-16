import { NextRequest, NextResponse } from 'next/server';
import { getTransactionsServer } from '@/lib/firebase/transactions-server';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    // Fetch all transactions for the user
    const { data: allTransactions, error } = await getTransactionsServer(user.uid);

    if (error) {
      console.error('Error fetching transactions for analysis status:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    let transactions = allTransactions || [];

    // Filter by account if specified
    if (accountId) {
      transactions = transactions.filter(t => t.account_id === accountId);
    }

    // Calculate analysis status
    const pending = transactions.filter(t => 
      t.analysisStatus === 'pending' || 
      (t.is_deductible === null && !t.analyzed)
    ).length;
    
    const running = transactions.filter(t => t.analysisStatus === 'running').length;
    const completed = transactions.filter(t => 
      t.analysisStatus === 'completed' || 
      (t.analyzed && t.is_deductible !== null)
    ).length;
    const failed = transactions.filter(t => t.analysisStatus === 'failed').length;

    const total = pending + running + completed + failed;
    const current = completed + failed;

    // Find currently analyzing transaction
    const currentlyAnalyzing = transactions.find(t => t.analysisStatus === 'running');

    // Calculate progress percentage
    const progressPercentage = total > 0 ? Math.round((current / total) * 100) : 0;

    // Determine overall status
    let overallStatus = 'idle';
    if (total === 0) {
      overallStatus = 'no_transactions';
    } else if (pending > 0 || running > 0) {
      overallStatus = 'analyzing';
    } else if (completed > 0) {
      overallStatus = 'completed';
    }

    return NextResponse.json({
      success: true,
      data: {
        overallStatus,
        progress: {
          current,
          total,
          percentage: progressPercentage
        },
        breakdown: {
          pending,
          running,
          completed,
          failed
        },
        currentlyAnalyzing: currentlyAnalyzing ? {
          id: currentlyAnalyzing.id,
          merchant_name: currentlyAnalyzing.merchant_name || currentlyAnalyzing.name || 'Unknown',
          amount: currentlyAnalyzing.amount,
          category: currentlyAnalyzing.category
        } : null,
        summary: {
          totalTransactions: total,
          analyzedTransactions: current,
          remainingTransactions: pending + running,
          successRate: total > 0 ? Math.round((completed / total) * 100) : 0
        }
      }
    });

  } catch (error) {
    console.error('Error in analysis status API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
