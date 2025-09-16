import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid/client';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromReqOrThrow } from '@/app/api/_lib/auth';

export async function POST(req: Request) {
  try {
    const { uid } = await getUserFromReqOrThrow(req);
    const { public_token } = await req.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    // 1) Exchange token
    const plaidRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const access_token = plaidRes.data.access_token;

    // 2) Get at least one account (adapt if you handle multiple)
    const accountsRes = await plaidClient.accountsGet({ access_token });
    const plaidAccount = accountsRes.data.accounts?.[0];
    if (!plaidAccount) {
      return NextResponse.json({ error: 'No accounts returned by Plaid' }, { status: 502 });
    }
    const accountId = plaidAccount.account_id;

    // 3) Store account with Admin SDK (bypasses rules, enforces UID check)
    const accountRef = adminDb.doc(`user_profiles/${uid}/accounts/${accountId}`);
    await accountRef.set({
      id: accountId,
      name: plaidAccount.name ?? plaidAccount.official_name ?? `Account • ${plaidAccount.mask ?? ''}`,
      mask: plaidAccount.mask ?? null,
      createdAt: Date.now(),
      user_id: uid, // Explicitly set for security
    }, { merge: true });

    // 4) Import transactions with Admin SDK
    let imported = 0;
    try {
      const transactionsRes = await plaidClient.transactionsSync({
        access_token,
        options: {
          include_personal_finance_category: true,
        },
      });

      const transactions = transactionsRes.data.added;
      for (const tx of transactions) {
        const txId = tx.transaction_id;
        const txRef = adminDb.doc(
          `user_profiles/${uid}/accounts/${accountId}/transactions/${txId}`
        );
        await txRef.set({
          analysis_status: 'pending',
          analysisStatus: 'pending', // Add camelCase version for consistency
          user_id: uid,
          account_id: accountId,
          trans_id: txId,
          date: tx.date,
          amount: tx.amount,
          merchant_name: tx.merchant_name || tx.name,
          category: tx.personal_finance_category?.detailed || tx.category?.[0] || 'Other',
          description: tx.name,
          is_deductible: null,
          deduction_score: null,
          deductible_reason: null,
          ai: null,
          analyzed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }, { merge: true });
        imported++;
      }
    } catch (txError) {
      console.warn('Transaction import failed:', txError);
      // Continue even if transaction import fails
    }


    return NextResponse.json({ ok: true, accountId, imported });
  } catch (err: any) {
    console.error('exchange-public-token failed:', err);
    const message = err?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
