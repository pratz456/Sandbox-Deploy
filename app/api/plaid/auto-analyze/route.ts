export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromReqOrThrow } from '@/app/api/_lib/auth';
import { adminDb, FieldValue } from '@/lib/firebase/admin';
import { analyzeTransaction, AIAnalysis } from '@/lib/openai/analysis';
import { getUserProfileServer } from '@/lib/firebase/profiles-server';

type JobDoc = {
  userId: string;
  accountId: string;
  status: 'running' | 'done' | 'failed' | 'canceled';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  batchSize: number;
  startedAt: any;
  completedAt: any;
  avgMs: number;
  lastUpdate: any;
};

// Atomic progress update with exponential moving average
async function updateProgress(jobRef: any, ok: boolean, ms: number) {
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    const data = snap.data()!;
    const processed = (data.processed ?? 0) + 1;
    const succeeded = (data.succeeded ?? 0) + (ok ? 1 : 0);
    const failed = (data.failed ?? 0) + (ok ? 0 : 1);
    const prevAvg = data.avgMs ?? 0;
    const alpha = 0.2; // smoothness factor
    const avgMs = prevAvg === 0 ? ms : Math.round(alpha * ms + (1 - alpha) * prevAvg);

    tx.update(jobRef, {
      processed,
      succeeded,
      failed,
      avgMs,
      lastUpdate: FieldValue.serverTimestamp(),
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await getUserFromReqOrThrow(request);
    const { accountId } = await request.json().catch(() => ({}));
    
    const userId = uid;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Ensure the account belongs to the user
    const accRef = adminDb.doc(`user_profiles/${uid}/accounts/${accountId}`);
    const accSnap = await accRef.get();
    if (!accSnap.exists) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Deterministic job ID: one job per (user, account)
    const jobId = `${userId}_${accountId}`;
    const jobRef = adminDb.collection('analysis_jobs').doc(jobId);

    // Check if job already exists and is running
    const existing = await jobRef.get();
    if (existing.exists) {
      const d = existing.data() as JobDoc;
      if (d.status === 'running') {
        // Already in progress – return quickly, do not start again
        console.log(`📊 [Auto-Analyze] Job ${jobId} already running, returning existing job`);
        return NextResponse.json({ jobId }, { status: 200 });
      }
    }

    console.log(`🚀 [Auto-Analyze] Starting analysis for user: ${userId}, account: ${accountId}`);

    // Get user profile for context
    const { data: userProfile, error: profileError } = await getUserProfileServer(uid);
    
    if (profileError || !userProfile) {
      console.error('❌ [Auto-Analyze] User profile not found:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get pending transactions ONCE
    const txs = await getPendingTransactions(userId, accountId);
    const total = txs.length;

    console.log(`📊 [Auto-Analyze] Found ${total} pending transactions for analysis`);

    // Initialize the job doc exactly once
    await jobRef.set({
      userId,
      accountId,
      status: 'running',
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      batchSize: 10,
      avgMs: 0,
      startedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      lastUpdate: FieldValue.serverTimestamp(),
    } as JobDoc, { merge: false });

    // If no transactions, mark as done immediately
    if (total === 0) {
      await jobRef.update({
        status: 'done',
        completedAt: FieldValue.serverTimestamp(),
        lastUpdate: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ jobId }, { status: 200 });
    }

    // Kick off the work WITHOUT holding the HTTP request
    void processTransactions(jobRef, txs, userId, accountId, userProfile);

    return NextResponse.json({ jobId }, { status: 200 });

  } catch (error) {
    console.error('❌ [Auto-Analyze] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to get pending transactions
async function getPendingTransactions(userId: string, accountId: string) {
  const snap = await adminDb
    .collection(`user_profiles/${userId}/accounts/${accountId}/transactions`)
    .where('analysis_status', '==', 'pending')
    .limit(500)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Background processor with batch processing and atomic updates
async function processTransactions(
  jobRef: any,
  txs: Array<{ id: string; [key: string]: any }>,
  userId: string,
  accountId: string,
  userProfile: any
) {
  if (!txs.length) return;

  console.log(`🔄 [Auto-Analyze] Processing ${txs.length} transactions in background`);

  const BATCH_SIZE = 10;
  
  // Process in batches of 10
  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    const batch = txs.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    await Promise.all(batch.map(async (tx) => {
      const start = Date.now();
      try {
        await analyzeOneTransaction(tx, userId, accountId, userProfile);
        await updateProgress(jobRef, true, Date.now() - start);
        console.log(`✅ [Auto-Analyze] Successfully analyzed: ${tx.merchant_name}`);
      } catch (err: any) {
        await updateProgress(jobRef, false, Date.now() - start);
        console.error(`❌ [Auto-Analyze] Failed to analyze ${tx.merchant_name}:`, err);
      }
    }));
  }

  // Mark job as completed
  await jobRef.update({
    status: 'done',
    completedAt: FieldValue.serverTimestamp(),
    lastUpdate: FieldValue.serverTimestamp(),
  });

  console.log(`🎉 [Auto-Analyze] Analysis complete for job ${jobRef.id}`);
}

// Analyze a single transaction
async function analyzeOneTransaction(
  tx: { id: string; [key: string]: any },
  userId: string,
  accountId: string,
  userProfile: any
) {
  const txRef = adminDb.doc(`user_profiles/${userId}/accounts/${accountId}/transactions/${tx.id}`);
  
  // Mark as running
  await txRef.update({
    analysis_status: 'running',
    analysisStatus: 'running',
    analysisStartedAt: new Date()
  });

  // Analyze with OpenAI (including user context)
  const result: AIAnalysis = await analyzeTransaction({
    merchant_name: tx.merchant_name,
    amount: tx.amount,
    category: tx.category,
    description: tx.description
  }, userProfile);

  // Update transaction with analysis results
  await txRef.set({
    deduction_score: result.deduction_score,
    deductible_reason: result.reasoning,
    ai: {
      status_label: result.status_label,
      score_pct: typeof result.deduction_score === 'number' ? Math.round(result.deduction_score * 100) : null,
      reasoning: result.reasoning,
      irs: { publication: result.irs_publication, section: result.irs_section },
      required_docs: result.required_docs,
      category_hint: result.category_hint,
      risk_flags: result.risk_flags,
      model: result.model,
      last_analyzed_at: Date.now(),
    },
    analyzed: true,
    analysis_status: 'completed',
    analysisStatus: 'completed',
    updatedAt: Date.now(),
  }, { merge: true });
}