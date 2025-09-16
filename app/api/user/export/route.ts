// app/api/user/export-transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getAuthenticatedUser } from '@/lib/firebase/api-auth';
import {
  getPaginatedTransactionsServer,
  getTransactionsServer,
  Transaction
} from '@/lib/firebase/transactions-server';
import { getUserProfileServer } from '@/lib/firebase/profiles-server';

function isoDateSafe(d: any) {
  try {
    if (!d) return '';
    if (typeof d?.toDate === 'function') return d.toDate().toISOString();
    if (d instanceof Date) return d.toISOString();
    if (typeof d === 'number') return new Date(d).toISOString();
    const parsed = new Date(String(d));
    return isNaN(parsed.getTime()) ? String(d) : parsed.toISOString();
  } catch {
    return String(d);
  }
}

function stringifyValue(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v?.toDate === 'function') return isoDateSafe(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Flatten a user profile object into [ [field, value], ... ] */
function flattenProfile(profile: Record<string, any>): [string, string][] {
  const rows: [string, string][] = [];
  if (!profile) return rows;

  const visit = (obj: any, prefix = '') => {
    if (obj == null) {
      rows.push([prefix || '(root)', stringifyValue(obj)]);
      return;
    }

    if (typeof obj !== 'object' || typeof obj?.toDate === 'function' || obj instanceof Date) {
      rows.push([prefix || '(value)', stringifyValue(obj)]);
      return;
    }

    // For plain objects/arrays
    if (Array.isArray(obj)) {
      rows.push([prefix || '(array)', stringifyValue(obj)]);
      return;
    }

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (val == null || typeof val !== 'object' || typeof val?.toDate === 'function' || val instanceof Date) {
        rows.push([newKey, stringifyValue(val)]);
      } else {
        // nested object -> flatten one level deeper
        visit(val, newKey);
      }
    }
  };

  visit(profile, '');
  return rows;
}

async function fetchAllTransactionsForUser(userId: string): Promise<{ data: Transaction[]; error: any }> {
  // Try paginated fetch first (efficient for large sets)
  try {
    const all: Transaction[] = [];
    const limit = 1000; // batch size per page
    let page = 1;

    while (true) {
      const { data, error, pagination } = await getPaginatedTransactionsServer(userId, {
        page,
        limit,
        status: 'all',
        search: '',
        sortBy: 'date',
        sortOrder: 'desc'
      });

      if (error) {
        console.warn('[export] getPaginatedTransactionsServer error on page', page, error);
        // abort paginated approach and fallback below
        break;
      }

      if (!Array.isArray(data) || data.length === 0) {
        // no more results
        break;
      }

      all.push(...data);

      // if pagination indicates no more pages, stop
      if (!pagination || !pagination.hasNextPage) break;

      page += 1;
      // safety: avoid infinite loop
      if (page > 1000) break;
    }

    if (all.length > 0) return { data: all, error: null };
  } catch (err) {
    console.warn('[export] paginated fetch failed, will fallback to non-paginated fetch:', err);
  }

  // Final fallback: single-call fetch (collectionGroup / per-account fallback inside)
  try {
    const { data, error } = await getTransactionsServer(userId);
    return { data: data || [], error };
  } catch (err) {
    return { data: [], error: err };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = user.uid;
    console.log('[EXPORT] User requested transactions + profile export:', uid);

    // Fetch transactions
    const { data: transactions, error: fetchError } = await fetchAllTransactionsForUser(uid);
    console.log('[EXPORT] fetched transactions count:', Array.isArray(transactions) ? transactions.length : 0, 'fetchError:', fetchError);

    // Fetch user profile
    const { data: userProfile, error: profileError } = await getUserProfileServer(uid);
    if (profileError) {
      console.warn('[EXPORT] getUserProfileServer returned error:', profileError);
    }
    console.log('[EXPORT] userProfile fetched:', !!userProfile);

    // Build Excel workbook with two sheets: Transactions, User Profile
    const workbook = new ExcelJS.Workbook();

    // --- Transactions sheet ---
    const txSheet = workbook.addWorksheet('Transactions');
    txSheet.columns = [
      { header: 'Transaction ID', key: 'trans_id', width: 28 },
      { header: 'Merchant', key: 'merchant_name', width: 30 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Account ID', key: 'account_id', width: 28 },
      { header: 'Is Deductible', key: 'is_deductible', width: 14 },
      { header: 'Deduction Reason', key: 'deductible_reason', width: 30 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'AI Analysis Summary', key: 'ai_summary', width: 60 }
    ];

    const txRows = (transactions || []).map((tx: Transaction) => {
      const dateIso = isoDateSafe(tx.date ?? tx.created_at ?? tx.updated_at);
      return {
        trans_id: tx.trans_id ?? tx.id,
        merchant_name: tx.merchant_name ?? '',
        amount: typeof tx.amount === 'number' ? tx.amount : Number(tx.amount) || 0,
        category: tx.category ?? '',
        date: dateIso,
        account_id: tx.account_id ?? '',
        is_deductible: typeof tx.is_deductible === 'boolean' ? (tx.is_deductible ? 'Yes' : 'No') : '',
        deductible_reason: tx.deductible_reason ?? '',
        notes: tx.notes ?? '',
        ai_summary: tx.ai?.reasoning ?? tx.ai_analysis ?? ''
      };
    });

    txSheet.addRows(txRows);
    txSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // --- User Profile sheet (Field / Value) ---
    const profileSheet = workbook.addWorksheet('User Profile');
    profileSheet.columns = [
      { header: 'Field', key: 'field', width: 40 },
      { header: 'Value', key: 'value', width: 80 }
    ];
    profileSheet.views = [{ state: 'frozen', ySplit: 1 }];

    if (userProfile) {
      const flattened = flattenProfile(userProfile);
      // Make sure we include some common explicit fields at top for convenience
      const topFields = [
        ['uid', uid],
        ['email', (userProfile.email || userProfile.emailAddress || '')],
        ['displayName', userProfile.displayName || userProfile.name || ''],
        ['firstName', userProfile.firstName || userProfile.first_name || ''],
        ['lastName', userProfile.lastName || userProfile.last_name || ''],
        ['businessName', userProfile.businessName || userProfile.business_name || ''],
        ['created_at', isoDateSafe(userProfile.created_at)],
        ['updated_at', isoDateSafe(userProfile.updated_at)]
      ].map(([k, v]) => ({ field: k, value: stringifyValue(v) }));

      // Add top fields then the flattened rest (avoid duplicates)
      const seen = new Set<string>(topFields.map(r => r.field));
      const rest = flattened
        .filter(([k]) => !seen.has(k))
        .map(([k, v]) => ({ field: k, value: v }));

      profileSheet.addRows([...topFields, ...rest]);
    } else {
      profileSheet.addRow({ field: 'error', value: profileError ? stringifyValue(profileError) : 'No profile found' });
    }

    // Prepare buffer and return
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `transactions_profile_${uid}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const headers = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    };

    console.log('[EXPORT] returning excel with', txRows.length, 'transaction rows and userProfile present:', !!userProfile);
    return new NextResponse(Buffer.from(buffer), { headers });
  } catch (err: any) {
    console.error('[EXPORT] Export failed:', err);
    return NextResponse.json({ error: 'Export failed', details: err?.message ?? String(err) }, { status: 500 });
  }
}
