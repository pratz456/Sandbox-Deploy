// lib/firebase/transactions-server.ts
import { adminDb } from './admin';

export interface Transaction {
  id: string;
  trans_id: string;
  merchant_name: string;
  amount: number;
  category: string;
  date: string;
  type?: 'expense' | 'income';
  is_deductible?: boolean | null;
  deductible_reason?: string;
  deduction_score?: number | null;
  ai_analysis?: string;
  user_classification_reason?: string;
  description?: string;
  notes?: string;
  receipt_url?: string;
  receipt_filename?: string;

  account_id?: string;
  user_id?: string;
  analyzed?: boolean;
  analysis_status?: 'pending' | 'running' | 'completed' | 'failed';
  analysisStatus?: 'pending' | 'running' | 'completed' | 'failed';
  transactionHash?: string;
  analysisStartedAt?: any;
  analysisCompletedAt?: any;
  created_at?: any;
  updated_at?: any;
  ai?: any | null;
}

/** Helper: convert possible Firestore timestamp or string to ISO date string (safe) */
function parseDateToISO(dateLike: any): string {
  try {
    if (!dateLike) return '';
    // Firestore Timestamp has toDate()
    if (typeof dateLike?.toDate === 'function') {
      return dateLike.toDate().toISOString();
    }
    // If it's a Date
    if (dateLike instanceof Date) return dateLike.toISOString();
    // If it's numeric (epoch millis)
    if (typeof dateLike === 'number') return new Date(dateLike).toISOString();
    // If it's string already
    if (typeof dateLike === 'string') {
      const d = new Date(dateLike);
      return isNaN(d.getTime()) ? dateLike : d.toISOString();
    }
    return String(dateLike);
  } catch {
    return String(dateLike);
  }
}

/** Normalize a single Firestore doc into Transaction shape */
function normalizeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): Transaction {
  const data: any = doc.data();
  const dateIso = parseDateToISO(data.date ?? data.created_at ?? data.updated_at);
  const amount = typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0;

  return {
    id: data.trans_id || doc.id,
    trans_id: data.trans_id || doc.id,
    merchant_name: data.merchant_name || data.merchant || '',
    amount,
    category: data.category || '',
    date: dateIso,
    type: amount < 0 ? 'income' : 'expense',
    is_deductible: data.is_deductible ?? data.deductible ?? null,
    deductible_reason: data.deductible_reason,
    deduction_score: data.deduction_score,
    ai_analysis: data.ai_analysis,
    user_classification_reason: data.user_classification_reason,
    description: data.description,
    notes: data.notes,

    account_id: data.account_id || data.accountId || null,
    user_id: data.user_id || data.userId || null,
    analyzed: data.analyzed ?? false,
    analysisStatus: data.analysis_status || data.analysisStatus,
    transactionHash: data.transactionHash,
    analysisStartedAt: data.analysisStartedAt,
    analysisCompletedAt: data.analysisCompletedAt,
    created_at: data.created_at,
    updated_at: data.updated_at,
    ai: data.ai || null,
  };
}

/**
 * getTransactionsServer - attempt multiple strategies to find a user's transactions.
 *
 * Strategies tried (in order):
 *  1) Top-level collection 'transactions' where 'user_id' == userId
 *  2) Top-level collection 'transactions' where 'userId' == userId
 *  3) collectionGroup('transactions') where 'userId' == userId
 *  4) collectionGroup('transactions') where 'user_id' == userId
 *  5) Fallback: iterate user_profiles/{userId}/accounts/{accountId}/transactions
 *
 * Returns { data: Transaction[], error }
 */
export async function getTransactionsServer(
  userId: string,
  fields?: string[]
): Promise<{ data: Transaction[]; error: any }> {
  try {
    console.log('🔍 [getTransactionsServer] Fetching transactions for user:', userId);
    if (!userId) return { data: [], error: 'Missing userId' };

    const foundMap = new Map<string, Transaction>(); // dedupe by doc path or trans_id

    // Helper to add docs, dedupe by doc.ref.path (if available) or trans_id
    const addDocs = (docs: FirebaseFirestore.QueryDocumentSnapshot[] | FirebaseFirestore.QuerySnapshot) => {
      const arr = Array.isArray(docs) ? docs : docs.docs;
      arr.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        try {
          const key = doc.ref?.path || (doc.data()?.trans_id || doc.id);
          if (foundMap.has(key)) return;
          const tx = normalizeDoc(doc);
          foundMap.set(key, tx);
        } catch (e) {
          console.warn('[getTransactionsServer] failed to normalize doc', e);
        }
      });
    };

    // 1) Try top-level 'transactions' with user_id (snake_case)
    try {
      const topSnap = await adminDb.collection('transactions').where('user_id', '==', userId).get();
      console.log('📂 [getTransactionsServer] top-level "transactions" (user_id) size:', topSnap.size);
      if (!topSnap.empty) addDocs(topSnap);
    } catch (e) {
      console.warn('[getTransactionsServer] top-level (user_id) query failed:', e?.message ?? e);
    }

    // 2) Try top-level 'transactions' with userId (camelCase)
    try {
      const topSnap2 = await adminDb.collection('transactions').where('userId', '==', userId).get();
      console.log('📂 [getTransactionsServer] top-level "transactions" (userId) size:', topSnap2.size);
      if (!topSnap2.empty) addDocs(topSnap2);
    } catch (e) {
      console.warn('[getTransactionsServer] top-level (userId) query failed:', e?.message ?? e);
    }

    // 3) Try collectionGroup('transactions') with userId
    try {
      const cg1 = await adminDb.collectionGroup('transactions').where('userId', '==', userId).get();
      console.log('🔎 [getTransactionsServer] collectionGroup(userId) size:', cg1.size);
      if (!cg1.empty) addDocs(cg1);
    } catch (e) {
      console.warn('[getTransactionsServer] collectionGroup(userId) query failed:', e?.message ?? e);
    }

    // 4) Try collectionGroup('transactions') with user_id
    try {
      const cg2 = await adminDb.collectionGroup('transactions').where('user_id', '==', userId).get();
      console.log('🔎 [getTransactionsServer] collectionGroup(user_id) size:', cg2.size);
      if (!cg2.empty) addDocs(cg2);
    } catch (e) {
      console.warn('[getTransactionsServer] collectionGroup(user_id) query failed:', e?.message ?? e);
    }

    // If we found docs via the above, return them
    if (foundMap.size > 0) {
      const arr = Array.from(foundMap.values());
      arr.sort((a, b) => {
        const ad = a.date ? new Date(a.date).getTime() : 0;
        const bd = b.date ? new Date(b.date).getTime() : 0;
        return bd - ad;
      });
      console.log(`[getTransactionsServer] Returning ${arr.length} transactions (found via top-level / collectionGroup)`);
      return { data: arr, error: null };
    }

    // 5) Fallback: iterate user_profiles/{userId}/accounts/{accountId}/transactions
    try {
      console.log('[getTransactionsServer] No docs found via collectionGroup/top-level queries — trying per-account fallback');
      const accountsSnap = await adminDb.collection('user_profiles').doc(userId).collection('accounts').get();
      console.log('[getTransactionsServer] accounts found:', accountsSnap.size);

      for (const accountDoc of accountsSnap.docs) {
        try {
          const txSnap = await adminDb
            .collection('user_profiles')
            .doc(userId)
            .collection('accounts')
            .doc(accountDoc.id)
            .collection('transactions')
            .get();
          console.log(`[getTransactionsServer] account ${accountDoc.id} transactions:`, txSnap.size);
          if (!txSnap.empty) addDocs(txSnap);
        } catch (e) {
          console.warn(`[getTransactionsServer] failed to get transactions for account ${accountDoc.id}:`, e?.message ?? e);
        }
      }

      if (foundMap.size > 0) {
        const arr = Array.from(foundMap.values());
        arr.sort((a, b) => {
          const ad = a.date ? new Date(a.date).getTime() : 0;
          const bd = b.date ? new Date(b.date).getTime() : 0;
          return bd - ad;
        });
        console.log(`[getTransactionsServer] Returning ${arr.length} transactions (found via per-account fallback)`);
        return { data: arr, error: null };
      } else {
        console.log('[getTransactionsServer] No transactions found for user after fallback');
        return { data: [], error: null };
      }
    } catch (fallbackError) {
      console.error('[getTransactionsServer] per-account fallback failed:', fallbackError);
      return { data: [], error: fallbackError };
    }
  } catch (error: any) {
    console.error('[getTransactionsServer] Unexpected error:', error);
    return { data: [], error };
  }
}

/**
 * Update a transaction identified by transactionId for a specific userId.
 * Tries collectionGroup first, falls back to searching user's accounts.
 */
export async function updateTransactionServerWithUserId(
  userId: string,
  transactionId: string,
  updates: {
    is_deductible?: boolean | null;
    deductible_reason?: string;
    deduction_score?: number;
    ai_analysis?: string;
    user_classification_reason?: string;
    notes?: string;
    analyzed?: boolean;
    analysisStatus?: 'pending' | 'running' | 'completed' | 'failed';
    analysisStartedAt?: Date;
    analysisCompletedAt?: Date;

    // New AI Analysis Fields
    deductionStatus?: 'Likely Deductible' | 'Possibly Deductible' | 'Non-Deductible';
    confidence?: number;
    reasoning?: string;
    irsPublication?: string;
    irsSection?: string;
    analysisUpdatedAt?: string;
  }
): Promise<{ data: any; error: any }> {
  try {
    console.log('🔄 [UPDATE→DB Server] Updating transaction with userId:', userId, transactionId, updates);

    // Strategy 1: Try collectionGroup query first (more efficient with userId filter)
    try {
      console.log('🔍 [UPDATE→DB Server] Attempting collectionGroup query with userId filter...');
      const transactionsQuery = adminDb
        .collectionGroup('transactions')
        .where('userId', '==', userId)
        .where('trans_id', '==', transactionId)
        .limit(1);

      const querySnapshot = await transactionsQuery.get();

      if (!querySnapshot.empty) {
        console.log('✅ [UPDATE→DB Server] Found transaction via collectionGroup query');
        const docRef = querySnapshot.docs[0].ref;
        const updateData: any = {
          ...updates,
          updated_at: new Date(),
        };

        console.log('📝 [UPDATE→DB Server] Updating document at path:', docRef.path);
        await docRef.update(updateData);

        // Read back to verify the update
        const updatedDoc = await docRef.get();
        if (updatedDoc.exists) {
          const data = updatedDoc.data();
          console.log('✅ [READBACK←DB Server] Update verified:', {
            trans_id: data?.trans_id,
            is_deductible: data?.is_deductible,
            deductible_reason: data?.deductible_reason,
            deduction_score: data?.deduction_score,
          });
          return { data: [data], error: null };
        }

        return { data: null, error: new Error('Failed to verify update') };
      }

      console.log('⚠️ [UPDATE→DB Server] No transaction found via collectionGroup query, trying fallback...');
    } catch (collectionGroupError: any) {
      console.warn('⚠️ [UPDATE→DB Server] CollectionGroup query failed:', collectionGroupError);
      console.warn('⚠️ [UPDATE→DB Server] Error code:', collectionGroupError.code);
      console.warn('⚠️ [UPDATE→DB Server] Error message:', collectionGroupError.message);

      // If it's a FAILED_PRECONDITION, it's likely a missing index
      if (collectionGroupError.code === 9 || collectionGroupError.code === 'FAILED_PRECONDITION') {
        console.log('🔧 [UPDATE→DB Server] FAILED_PRECONDITION detected - likely missing index, using fallback method');
      }
    }

    // Strategy 2: Fallback - search through user's accounts only
    console.log('🔄 [UPDATE→DB Server] Using fallback method - searching through user accounts...');

    try {
      // Get all accounts for this specific user
      const accountsSnapshot = await adminDb.collection('user_profiles').doc(userId).collection('accounts').get();
      console.log(`🔍 [UPDATE→DB Server] Found ${accountsSnapshot.size} accounts for user ${userId}`);

      for (const accountDoc of accountsSnapshot.docs) {
        const accountId = accountDoc.id;
        console.log(`🔍 [UPDATE→DB Server] Checking account: ${accountId}`);

        // Get all transactions for this account
        const transactionsSnapshot = await adminDb
          .collection('user_profiles')
          .doc(userId)
          .collection('accounts')
          .doc(accountId)
          .collection('transactions')
          .get();

        console.log(`🔍 [UPDATE→DB Server] Found ${transactionsSnapshot.size} transactions for account ${accountId}`);

        // Find the specific transaction
        const targetTransaction = transactionsSnapshot.docs.find((doc) => {
          const data = doc.data();
          return data.trans_id === transactionId;
        });

        if (targetTransaction) {
          console.log('✅ [UPDATE→DB Server] Found transaction via fallback method');
          const docRef = targetTransaction.ref;
          const updateData: any = {
            ...updates,
            updated_at: new Date(),
          };

          console.log('📝 [UPDATE→DB Server] Updating document at path:', docRef.path);
          await docRef.update(updateData);

          // Read back to verify the update
          const updatedDoc = await docRef.get();
          if (updatedDoc.exists) {
            const data = updatedDoc.data();
            console.log('✅ [READBACK←DB Server] Update verified:', {
              trans_id: data?.trans_id,
              is_deductible: data?.is_deductible,
              deductible_reason: data?.deductible_reason,
              deduction_score: data?.deduction_score,
            });
            return { data: [data], error: null };
          }

          return { data: null, error: new Error('Failed to verify update') };
        }
      }

      console.error('❌ [UPDATE→DB Server] Transaction not found in user accounts');
      return { data: null, error: new Error('Transaction not found') };
    } catch (fallbackError: any) {
      console.error('❌ [UPDATE→DB Server] Fallback method failed:', fallbackError);
      console.error('❌ [UPDATE→DB Server] Fallback error code:', fallbackError.code);
      console.error('❌ [UPDATE→DB Server] Fallback error message:', fallbackError.message);
      throw fallbackError;
    }
  } catch (error: any) {
    console.error('❌ [UPDATE→DB Server] Update failed:', error);
    console.error('❌ [UPDATE→DB Server] Error type:', typeof error);
    console.error('❌ [UPDATE→DB Server] Error code:', error.code);
    console.error('❌ [UPDATE→DB Server] Error message:', error.message);

    // Handle specific Firebase errors
    if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
      console.error('❌ [UPDATE→DB Server] FAILED_PRECONDITION - This could be due to:');
      console.error('   - Missing composite index for collectionGroup query');
      console.error('   - Security rules preventing the operation');
      console.error('   - Invalid query structure');
      return {
        data: null,
        error: {
          code: 'FAILED_PRECONDITION',
          message: 'Database operation failed. This may be due to missing indexes or security rules.',
          details: error.message,
        },
      };
    } else if (error.code === 'permission-denied') {
      console.error('❌ [UPDATE→DB Server] Permission denied - check Firestore rules');
      return {
        data: null,
        error: {
          code: 'permission-denied',
          message: 'Permission denied. Check Firestore security rules.',
          details: error.message,
        },
      };
    } else if (error.code === 'unavailable') {
      console.error('❌ [UPDATE→DB Server] Firebase service unavailable');
      return {
        data: null,
        error: {
          code: 'unavailable',
          message: 'Database service temporarily unavailable.',
          details: error.message,
        },
      };
    }

    return { data: null, error };
  }
}

/**
 * Paginated transactions using collectionGroup with optional filters.
 * NOTE: offset-based pagination used for simplicity — consider cursor-based for large datasets.
 */
export async function getPaginatedTransactionsServer(
  userId: string,
  options: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
): Promise<{ data: Transaction[]; error: any; pagination: any }> {
  try {
    console.log('🔍 [Firebase Server] Fetching paginated transactions for user:', userId, options);

    const { page, limit, status, search, sortBy = 'updated_at', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query: any = adminDb.collectionGroup('transactions').where('userId', '==', userId);

    // Apply status filter if specified
    if (status && status !== 'all') {
      if (status === 'deductible') {
        query = query.where('is_deductible', '==', true);
      } else if (status === 'personal') {
        query = query.where('is_deductible', '==', false);
      } else if (status === 'pending') {
        query = query.where('is_deductible', '==', null);
      }
    }

    // Apply sorting
    if (sortBy === 'updated_at') {
      query = query.orderBy('updated_at', sortOrder);
    } else if (sortBy === 'date') {
      query = query.orderBy('date', sortOrder);
    } else if (sortBy === 'amount') {
      query = query.orderBy('amount', sortOrder);
    } else if (sortBy === 'merchant_name') {
      query = query.orderBy('merchant_name', sortOrder);
    }

    // Get total count first
    const countQuery = query;
    const countSnapshot = await countQuery.get();
    const totalCount = countSnapshot.size;

    // Apply pagination (offset-based)
    query = query.limit(limit);
    if (offset > 0) {
      // For offset-based pagination, we need to skip documents
      // Note: This is not efficient for large offsets, consider using cursor-based pagination
      const skipSnapshot = await countQuery.limit(offset).get();
      const lastDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
    }

    const querySnapshot = await query.get();
    console.log(`📊 [Firebase Server] Found ${querySnapshot.size} transactions for page ${page}`);

    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const transaction: Transaction = {
        id: data.trans_id || doc.id,
        trans_id: data.trans_id || doc.id,
        merchant_name: data.merchant_name || '',
        amount: data.amount || 0,
        category: data.category || '',
        date: data.date || '',
        type: data.amount < 0 ? 'income' : 'expense',
        is_deductible: data.is_deductible,
        deductible_reason: data.deductible_reason,
        deduction_score: data.deduction_score,
        ai_analysis: data.ai_analysis,
        user_classification_reason: data.user_classification_reason,
        description: data.description,
        notes: data.notes,

        account_id: data.account_id,
        user_id: data.user_id,
        analyzed: data.analyzed,
        analysisStatus: data.analysis_status || data.analysisStatus, // Support both field names
        transactionHash: data.transactionHash,
        analysisStartedAt: data.analysisStartedAt,
        analysisCompletedAt: data.analysisCompletedAt,
        created_at: data.created_at,
        updated_at: data.updated_at,

        // Include AI analysis data
        ai: data.ai || null,
      };

      // Apply search filter if specified
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          transaction.merchant_name.toLowerCase().includes(searchLower) ||
          transaction.category.toLowerCase().includes(searchLower) ||
          (transaction.notes && transaction.notes.toLowerCase().includes(searchLower))
        ) {
          transactions.push(transaction);
        }
      } else {
        transactions.push(transaction);
      }
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const pagination = {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage,
      hasPrevPage,
      offset,
    };

    console.log('✅ [Firebase Server] Successfully processed paginated transactions:', {
      count: transactions.length,
      pagination,
    });

    return {
      data: transactions,
      error: null,
      pagination,
    };
  } catch (error: any) {
    console.error('❌ [Firebase Server] Error getting paginated transactions:', error);

    // Handle specific Firebase errors
    if (error.code === 'permission-denied') {
      return {
        data: [],
        error: { code: 'permission-denied', message: 'Permission denied. Check Firestore security rules.' },
        pagination: null,
      };
    } else if (error.code === 'unavailable') {
      return {
        data: [],
        error: { code: 'unavailable', message: 'Database service temporarily unavailable.' },
        pagination: null,
      };
    } else if (error.code === 'failed-precondition') {
      return {
        data: [],
        error: { code: 'failed-precondition', message: 'Database query failed. Missing required index.' },
        pagination: null,
      };
    }

    return { data: [], error, pagination: null };
  }
}

/**
 * Create a new transaction under user_profiles/{userId}/accounts/{accountId}/transactions/{transId}
 */
export async function createTransactionServer(
  userId: string,
  accountId: string,
  transactionData: Partial<Transaction>
): Promise<{ data: Transaction | null; error: any }> {
  try {
    const transId = transactionData.trans_id || `trans_${Date.now()}`;
    const docRef = adminDb
      .collection('user_profiles')
      .doc(userId)
      .collection('accounts')
      .doc(accountId)
      .collection('transactions')
      .doc(transId);

    const newTransaction = {
      ...transactionData,
      trans_id: transId,
      userId: userId,
      account_id: accountId,
      analyzed: transactionData.analyzed || false,
      analysisStatus: transactionData.analysisStatus || 'pending',
      transactionHash: transactionData.transactionHash,
      analysisStartedAt: transactionData.analysisStartedAt || null,
      analysisCompletedAt: transactionData.analysisCompletedAt || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await docRef.set(newTransaction);

    // Return the created transaction
    const createdDoc = await docRef.get();
    if (createdDoc.exists) {
      const data = createdDoc.data();
      return {
        data: {
          id: data?.trans_id || createdDoc.id,
          trans_id: data?.trans_id || createdDoc.id,
          merchant_name: data?.merchant_name || '',
          amount: data?.amount || 0,
          category: data?.category || '',
          date: data?.date || '',
          type: data?.amount < 0 ? 'income' : 'expense',
          is_deductible: data?.is_deductible,
          deductible_reason: data?.deductible_reason,
          deduction_score: data?.deduction_score,
          description: data?.description,
          notes: data?.notes,

          account_id: data?.account_id,
          user_id: data?.user_id,
          analyzed: data?.analyzed,
          analysisStatus: data?.analysisStatus,
          transactionHash: data?.transactionHash,
          analysisStartedAt: data?.analysisStartedAt,
          analysisCompletedAt: data?.analysisCompletedAt,
          created_at: data?.created_at,
          updated_at: data?.updated_at,
        } as Transaction,
        error: null,
      };
    }

    return { data: null, error: new Error('Failed to retrieve created transaction') };
  } catch (error: any) {
    console.error('Error creating transaction (server):', error);
    return { data: null, error };
  }
}
