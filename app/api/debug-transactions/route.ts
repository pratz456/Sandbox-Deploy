import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/lib/firebase/transactions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const id = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const { data: transactions, error } = await getTransactions(userId);

    if (error) {
      console.error('Error fetching debug transactions:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let filteredTransactions = transactions || [];
    
    if (id) {
      filteredTransactions = filteredTransactions.filter(t => t.id === id || t.trans_id === id);
    } else {
      filteredTransactions = filteredTransactions.slice(0, 10); // Limit to 10 for debug
    }

    return NextResponse.json({ success: true, transactions: filteredTransactions });
  } catch (error) {
    console.error('Unexpected error in debug-transactions API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}