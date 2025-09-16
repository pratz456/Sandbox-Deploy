'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function startAnalysis(accountId?: string) {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken?.();
  if (!idToken) throw new Error('no-id-token');

  const res = await fetch('/api/plaid/auto-analyze', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) throw new Error('failed-to-start-analysis');
}

// (optional) brief poll to show progress before moving
async function waitForAnalysisDone(accountId: string, timeoutMs = 20000, stepMs = 1500) {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken?.();
  if (!idToken) return false;
  
  const jobId = `${auth.currentUser?.uid}_${accountId}`;
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      const s = await fetch(`/api/analysis-job?jobId=${jobId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      }).then(r => r.json());
      
      if (s?.data?.status === 'completed' || s?.data?.status === 'failed') {
        return s.data.status === 'completed';
      }
    } catch {}
    await new Promise(r => setTimeout(r, stepMs));
  }
  return false;
}

export default function AccountUsagePage() {
  const router = useRouter();
  const { accountId } = useParams<{accountId: string}>();
  const { user } = useAuth();

  const [usage, setUsage] = useState<'business'|'personal'|'mixed'>('business');
  const [percent, setPercent] = useState<number>(50);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) router.push('/auth/login');
  }, [user, router]);

  async function save() {
    setSaving(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken?.();
      if (!idToken) throw new Error('no-id-token');

      const body: any = { usageType: usage };
      if (usage === 'mixed') body.businessUsePercent = percent;

      // 1) save usage (AUTH HEADER ADDED)
      const r1 = await fetch(`/api/accounts/${accountId}/usage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!r1.ok) {
        const t = await r1.text().catch(()=>'');
        console.error('save-usage server error:', r1.status, t);
        throw new Error('save-usage-failed');
      }

      // 2) branch by usage
      if (usage === 'personal') {
        // Mark all transactions as personal (AUTH HEADER ADDED)
        await fetch(`/api/accounts/${accountId}/mark-personal`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` },
        }).catch(()=>{});
        
        // Show personal account message and redirect to dashboard
        alert('Personal accounts are not useful for tax calculations. All transactions have been marked as personal expenses. Consider connecting a business account for tax deduction analysis.');
        router.push('/protected');
        return;
      }

      // business / mixed → start AI (AUTH HEADER ADDED)
      const r2 = await fetch('/api/plaid/auto-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ accountId }),
      });
      if (!r2.ok) {
        const t = await r2.text().catch(()=> '');
        console.error('auto-analyze server error:', r2.status, t);
        // still continue to transactions; user can retry from there
      }

      // Redirect to PlaidLinkScreen to show analyzing progress
      router.push(`/protected?screen=plaid-link&accountId=${accountId}&analyzing=true`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Classify this bank account</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Choose how this account is primarily used. This helps us provide the most relevant tax deduction analysis.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 border border-green-200 bg-green-50 rounded-lg">
              <input 
                type="radio" 
                id="business" 
                name="usage" 
                value="business" 
                checked={usage === 'business'}
                onChange={(e) => setUsage(e.target.value as 'business'|'personal'|'mixed')}
                className="mt-1"
              />
              <div>
                <label htmlFor="business" className="font-medium text-green-800">Business</label>
                <p className="text-sm text-green-700 mt-1">Best for tax deduction analysis. All transactions will be analyzed for business expense potential.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 border border-orange-200 bg-orange-50 rounded-lg">
              <input 
                type="radio" 
                id="personal" 
                name="usage" 
                value="personal" 
                checked={usage === 'personal'}
                onChange={(e) => setUsage(e.target.value as 'business'|'personal'|'mixed')}
                className="mt-1"
              />
              <div>
                <label htmlFor="personal" className="font-medium text-orange-800">Personal</label>
                <p className="text-sm text-orange-700 mt-1">⚠️ Personal accounts are not useful for tax calculations. All transactions will be marked as personal expenses.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 border border-blue-200 bg-blue-50 rounded-lg">
              <input 
                type="radio" 
                id="mixed" 
                name="usage" 
                value="mixed" 
                checked={usage === 'mixed'}
                onChange={(e) => setUsage(e.target.value as 'business'|'personal'|'mixed')}
                className="mt-1"
              />
              <div>
                <label htmlFor="mixed" className="font-medium text-blue-800">Both (Mixed use)</label>
                <p className="text-sm text-blue-700 mt-1">Good for accounts used for both business and personal expenses. You can specify the business percentage.</p>
              </div>
            </div>
          </div>

          {usage === 'mixed' && (
            <div className="space-y-2">
              <Label htmlFor="percent">Approx. % used for business</Label>
              <div className="flex items-center gap-3">
                <input
                  id="percent"
                  type="range"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e)=>setPercent(parseInt(e.target.value))}
                  className="w-full"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e)=>setPercent(Math.max(0, Math.min(100, parseInt(e.target.value||'0'))))}
                  className="w-20 text-center"
                />
                <span>%</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : (
                usage === 'personal' ? 'Mark as Personal & Continue' : 
                usage === 'business' ? 'Save & Start Analysis' : 
                'Save & Start Analysis'
              )}
            </Button>

            <Button variant="secondary" onClick={() => router.push('/protected/plaid-link')}>
              Connect a different bank
            </Button>

            <Button variant="ghost" onClick={() => router.push('/protected/plaid')}>
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
