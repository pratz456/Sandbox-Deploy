"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useRouter } from 'next/navigation';
import { PlaidProgress } from './PlaidProgress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, CreditCard, CheckCircle, ArrowLeft, Shield, Building2 } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { useJobProgress } from '@/lib/hooks/useJobProgress';
import { errorLogger, logPollingError, logAPIError } from '@/lib/error-logger';

interface PlaidLinkScreenProps {
  user: any;
  onSuccess: () => void;
  onBack: () => void;
}

export const PlaidLinkScreen: React.FC<PlaidLinkScreenProps> = ({ user, onSuccess, onBack }) => {
  const router = useRouter();
  // Consent for Plaid data access
  const [bankConsent, setBankConsent] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, status: 'running' as const });
  const [analysisStatus, setAnalysisStatus] = useState<'connecting' | 'importing' | 'analyzing' | 'completed' | 'error'>('connecting');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentTransaction, setCurrentTransaction] = useState<string>('');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [importProgress, setImportProgress] = useState({ imported: 0, total: 0 });
  
  // Ref to store the polling interval so we can clear it properly
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);

  // Real-time job subscription (fallback to avoid polling). When `accountId` is
  // present we subscribe to the job document `${uid}_${accountId}` and react to
  // status changes (done -> redirect to review screen).
  const { job: jobProgress, error: jobProgressError, loading: jobProgressLoading } = useJobProgress(accountId ?? '');

  useEffect(() => {
    if (!accountId) return;

    // When the job document reports 'done', consider analysis complete and redirect
    if (jobProgress && jobProgress.status === 'done') {
      console.log('📣 [PlaidLink] Job completed via real-time subscription, redirecting to review');
      setAnalysisStatus('completed');
      setCurrentTransaction('All transactions analyzed successfully!');
      setEstimatedTimeRemaining(0);

      // Clean up any polling interval if it exists
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;

      // Small delay to allow UI to show completion state
      setTimeout(() => {
        router.push(`/protected?screen=review-transactions&accountId=${accountId}`);
      }, 1000);
      return;
    }

    // If job is running, update progress UI to reflect real-time values
    if (jobProgress && jobProgress.status === 'running') {
      setAnalysisStatus('analyzing');
      setAnalysisProgress({ current: jobProgress.processed || 0, total: jobProgress.total || 0, status: 'running' });
      if ((jobProgress.processed ?? 0) < (jobProgress.total ?? 0)) {
        setCurrentTransaction(`Analyzing transactions (${jobProgress.processed} of ${jobProgress.total})`);
      }
    }
  }, [jobProgress, accountId]);

  // Check if we're redirected from account usage page with analyzing state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountIdParam = urlParams.get('accountId');
    const analyzingParam = urlParams.get('analyzing');
    
    if (accountIdParam && analyzingParam === 'true') {
      console.log('🔄 [PlaidLink] Redirected from account usage page, starting analysis monitoring');
      setAccountId(accountIdParam);
      setIsConnected(true);
      setAnalysisStatus('analyzing');
      monitorAnalysisProgress(accountIdParam);
    }
    
    // Cleanup function to clear any intervals when component unmounts
    return () => {
      console.log('🧹 [PlaidLink] Component unmounting, cleaning up...');
      if (pollingIntervalRef.current) {
        console.log('🧹 [PlaidLink] Clearing polling interval');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, []);

  // Create link token on component mount (only if not redirected from account usage)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountIdParam = urlParams.get('accountId');
    const analyzingParam = urlParams.get('analyzing');
    
    // Only create link token if we're not redirected from account usage page
    if (accountIdParam && analyzingParam === 'true') {
      return;
    }
    
    const createLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
          throw new Error('Failed to create link token');
        }

        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (err: any) {
        console.error('Error creating link token:', err);
        setError('Failed to initialize bank connection. Please try again.');
      }
    };

    createLinkToken();
  }, [user.id]);

  // Monitor analysis progress with detailed tracking
  const monitorAnalysisProgress = async (accountId: string) => {
    console.log('🔄 [Progress Monitor] Starting to monitor analysis for account:', accountId);
    
    // Clear any existing interval first
    if (pollingIntervalRef.current) {
      console.log('🧹 [Progress Monitor] Clearing existing interval before starting new one');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Prevent multiple monitoring sessions
    if (isPollingRef.current) {
      console.log('⚠️ [Progress Monitor] Monitoring already in progress, skipping');
      return;
    }
    
    // Set polling flag
    isPollingRef.current = true;
    
    let importComplete = false;
    let analysisStarted = false;
    let pollCount = 0;
    const maxPolls = 200; // Maximum 200 polls (5 minutes at 1.5s intervals)
    const startTime = Date.now();
    setStartTime(startTime);
    
    // Set initial status to show monitoring has started
    setCurrentTransaction('Starting analysis...');
    
    // Use deterministic jobId - one job per (user, account)
    const deterministicJobId = `${user.uid}_${accountId}`;
    setJobId(deterministicJobId);
    
    // Start analysis if not already running
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        
        console.log('🔄 [Auto-Analyze] Starting analysis for account:', accountId);
        const response = await fetch('/api/plaid/auto-analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ accountId })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ [Auto-Analyze] Analysis started:', result);
          // jobId should match our deterministic one
          if (result.jobId && result.jobId === deterministicJobId) {
            console.log('📊 [Auto-Analyze] Job ID confirmed:', result.jobId);
          }
        } else {
          console.error('❌ [Auto-Analyze] Failed to start analysis:', response.status);
        }
      }
    } catch (error) {
      console.error('❌ [Auto-Analyze] Error starting analysis:', error);
    }

    // OLD POLLING CODE - DISABLED
    /*
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      // Safety check - prevent infinite polling
      if (pollCount > maxPolls) {
        console.warn('⚠️ [Progress Monitor] Maximum polls reached, forcing completion');
        setAnalysisStatus('completed');
        setCurrentTransaction('Analysis complete - redirecting...');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        isPollingRef.current = false;
        setTimeout(() => {
          router.push(`/protected?screen=review-transactions&accountId=${accountId}`);
        }, 1000);
        return;
      }
      try {
        // Get Firebase auth token
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error('❌ No authenticated user found for progress monitoring');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          isPollingRef.current = false;
          return;
        }
        
        const token = await currentUser.getIdToken();
        
        // Security check: Validate token
        if (!token || token.length < 10) {
          console.error('❌ [Security] Invalid auth token');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          isPollingRef.current = false;
          return;
        }
        
        // Check analysis status using the new API
        console.log('🔍 [Progress Monitor] Fetching analysis status for account:', accountId);
        console.log('🔍 [Progress Monitor] Poll count:', pollCount, 'Max polls:', maxPolls);
        
        let response = await fetch(`/api/transactions/analysis-status?accountId=${accountId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('🔍 [Progress Monitor] API response status:', response.status);
        
        console.log('📡 [Progress Monitor] API Response status:', response.status);
        
        // Fallback to regular transactions API if analysis-status fails
        if (!response.ok) {
          console.warn('⚠️ [Progress Monitor] Analysis-status API failed, falling back to transactions API');
          console.warn('⚠️ [Progress Monitor] Error details:', response.status, response.statusText);
          
          response = await fetch('/api/transactions', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            console.error('❌ [Progress Monitor] Fallback API also failed:', response.status);
            logAPIError(new Error(`Fallback API failed`), '/api/transactions', response.status, {
              userId: user?.id,
              accountId: accountId,
              message: 'Both analysis-status and transactions APIs failed',
            });
            throw new Error(`API failed with status ${response.status}`);
          }
        }
        
        if (response.ok) {
          const result = await response.json();
          console.log('📊 [Progress Monitor] API Response data:', result);
          
          // Handle both new API format and fallback format
          if (result.success && result.data) {
            // New API format
            const { overallStatus, progress, breakdown, currentlyAnalyzing, summary } = result.data;
            
            console.log('📊 [Progress Monitor] Analysis Status:', { overallStatus, progress, breakdown });
            
            // IMMEDIATE COMPLETION CHECK - if all transactions are done, redirect immediately
            if (overallStatus === 'completed' || 
                (progress.current >= progress.total && progress.total > 0) ||
                (breakdown?.pending === 0 && breakdown?.running === 0 && progress.total > 0)) {
              console.log('🚀 [Progress Monitor] IMMEDIATE COMPLETION DETECTED!', { overallStatus, progress, breakdown });
              console.log('🧹 [Progress Monitor] Clearing interval and stopping polling...');
              setAnalysisStatus('completed');
              setCurrentTransaction('All transactions analyzed successfully!');
              setEstimatedTimeRemaining(0);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              isPollingRef.current = false;
              console.log('✅ [Progress Monitor] Interval cleared, polling stopped');
              
              // Redirect immediately
              setTimeout(() => {
                console.log('🔄 [Progress Monitor] Redirecting to review transactions...');
                router.push(`/protected?screen=review-transactions&accountId=${accountId}`);
              }, 1000); // 1 second delay
              return; // CRITICAL: Exit the polling loop immediately
            }
            
            // Handle different statuses
            if (overallStatus === 'no_transactions' && !importComplete) {
              console.log('⏳ [Progress Monitor] No transactions yet, still importing...');
              setAnalysisStatus('importing');
              setAnalysisProgress({ current: 0, total: 0, status: 'running' });
              setImportProgress({ imported: 0, total: 0 });
              setCurrentTransaction('Connecting to your bank...');
              return;
            }
            
            // Mark import as complete once we see transactions
            if (summary.totalTransactions > 0 && !importComplete) {
              console.log('✅ [Progress Monitor] Import complete, found', summary.totalTransactions, 'transactions');
              importComplete = true;
              setAnalysisStatus('analyzing');
              setImportProgress({ imported: summary.totalTransactions, total: summary.totalTransactions });
            }
            
            // Update progress
            if (importComplete) {
              setAnalysisProgress({ current: progress.current, total: progress.total, status: 'running' });
              
              // Calculate estimated time remaining
              if (progress.current > 0 && progress.total > 0) {
                const elapsedTime = Date.now() - startTime;
                const avgTimePerTransaction = elapsedTime / progress.current;
                const remainingTransactions = progress.total - progress.current;
                const estimatedRemaining = Math.round((remainingTransactions * avgTimePerTransaction) / 1000);
                setEstimatedTimeRemaining(estimatedRemaining);
              }
              
              // Show current transaction being analyzed with real-time updates
              if (currentlyAnalyzing) {
                const merchantName = currentlyAnalyzing.merchant_name || 'Unknown merchant';
                const progressText = `Analyzing: ${merchantName} ($${Math.abs(currentlyAnalyzing.amount || 0).toFixed(2)})`;
                setCurrentTransaction(progressText);
                console.log(`📊 [Progress Monitor] ${progress.current}/${progress.total} (${progress.percentage}%) - ${progressText}`);
              } else if (breakdown.pending > 0) {
                const progressText = `Preparing to analyze ${breakdown.pending} remaining transactions...`;
                setCurrentTransaction(progressText);
                console.log(`📊 [Progress Monitor] ${progress.current}/${progress.total} (${progress.percentage}%) - ${progressText}`);
              } else {
                const progressText = 'Finalizing analysis...';
                setCurrentTransaction(progressText);
                console.log(`📊 [Progress Monitor] ${progress.current}/${progress.total} (${progress.percentage}%) - ${progressText}`);
              }
              
            // Check if analysis is complete - be more aggressive about detection
            console.log('🔍 [Progress Monitor] Checking completion (main):', { overallStatus, progress, breakdown });
            if (overallStatus === 'completed' || 
                (progress.current >= progress.total && progress.total > 0) ||
                (breakdown?.pending === 0 && breakdown?.running === 0 && progress.total > 0)) {
              console.log('✅ [Progress Monitor] Analysis complete!', { overallStatus, progress, breakdown });
              setAnalysisStatus('completed');
              setCurrentTransaction('All transactions analyzed successfully!');
              setEstimatedTimeRemaining(0);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              
              // Redirect to review transactions after a short delay
              setTimeout(() => {
                console.log('🔄 [Progress Monitor] Redirecting to review transactions...');
                router.push(`/protected?screen=review-transactions&accountId=${accountId}`);
              }, 2000); // 2 second delay to show completion message
              return; // Exit the polling loop
            }
            }
          } else if (result.success && result.transactions) {
            // Fallback format - regular transactions API
            console.log('📊 [Progress Monitor] Using fallback transactions API');
            const accountTransactions = result.transactions.filter((t: any) => t.account_id === accountId);
            
            console.log('📊 [Progress Monitor] Found transactions:', accountTransactions.length);
            
            // First, check if transactions are still being imported
            if (accountTransactions.length === 0 && !importComplete) {
              console.log('⏳ [Progress Monitor] No transactions yet, still importing...');
              setAnalysisStatus('importing');
              setAnalysisProgress({ current: 0, total: 0, status: 'running' });
              setImportProgress({ imported: 0, total: 0 });
              setCurrentTransaction('Connecting to your bank...');
              return;
            }
            
            // Mark import as complete once we see transactions
            if (accountTransactions.length > 0 && !importComplete) {
              console.log('✅ [Progress Monitor] Import complete, found', accountTransactions.length, 'transactions');
              importComplete = true;
              setAnalysisStatus('analyzing');
              setImportProgress({ imported: accountTransactions.length, total: accountTransactions.length });
            }
            
            // Now track analysis progress
            if (importComplete) {
              const pending = accountTransactions.filter((t: any) => 
                t.analysisStatus === 'pending' || 
                (t.is_deductible === null && !t.analyzed)
              ).length;
              const running = accountTransactions.filter((t: any) => t.analysisStatus === 'running').length;
              const completed = accountTransactions.filter((t: any) => 
                t.analysisStatus === 'completed' || 
                (t.analyzed && t.is_deductible !== null)
              ).length;
              const failed = accountTransactions.filter((t: any) => t.analysisStatus === 'failed').length;
              
              const total = pending + running + completed + failed;
              const current = completed + failed;
              
              console.log('📊 [Progress Monitor] Analysis Status:', { pending, running, completed, failed, total, current });
              
              // IMMEDIATE COMPLETION CHECK for fallback
              if (pending === 0 && running === 0 && total > 0) {
                console.log('🚀 [Progress Monitor] IMMEDIATE COMPLETION DETECTED (fallback)!', { pending, running, completed, failed, total, current });
                console.log('🧹 [Progress Monitor] Clearing interval and stopping polling (fallback)...');
                setAnalysisStatus('completed');
                setCurrentTransaction('All transactions analyzed successfully!');
                setEstimatedTimeRemaining(0);
                clearInterval(pollInterval);
                pollingIntervalRef.current = null;
                console.log('✅ [Progress Monitor] Interval cleared, polling stopped (fallback)');
                
                // Redirect immediately
                setTimeout(() => {
                  console.log('🔄 [Progress Monitor] Redirecting to review transactions...');
                  router.push(`/protected?screen=review-transactions&accountId=${accountId}`);
                }, 1000); // 1 second delay
                return;
              }
              
              setAnalysisProgress({ current, total, status: 'running' });
              
              // Calculate estimated time remaining
              if (current > 0 && total > 0) {
                const elapsedTime = Date.now() - startTime;
                const avgTimePerTransaction = elapsedTime / current;
                const remainingTransactions = total - current;
                const estimatedRemaining = Math.round((remainingTransactions * avgTimePerTransaction) / 1000);
                setEstimatedTimeRemaining(estimatedRemaining);
              }
              
              // Show current transaction being analyzed
              const currentlyAnalyzing = accountTransactions.find((t: any) => t.analysisStatus === 'running');
              if (currentlyAnalyzing) {
                const merchantName = currentlyAnalyzing.merchant_name || currentlyAnalyzing.name || 'Unknown merchant';
                setCurrentTransaction(`Analyzing: ${merchantName} ($${Math.abs(currentlyAnalyzing.amount || 0).toFixed(2)})`);
              } else if (pending > 0) {
                setCurrentTransaction(`Preparing to analyze ${pending} remaining transactions...`);
              } else {
                setCurrentTransaction('Finalizing analysis...');
              }
              
              // Check if analysis is complete - be more aggressive about detection
              console.log('🔍 [Progress Monitor] Checking completion:', { pending, running, completed, failed, total, current });
              if (pending === 0 && running === 0 && total > 0) {
                console.log('✅ [Progress Monitor] Analysis complete!', { pending, running, completed, failed, total, current });
                console.log('🧹 [Progress Monitor] Clearing interval and stopping polling (main check)...');
                setAnalysisStatus('completed');
                setCurrentTransaction('All transactions analyzed successfully!');
                setEstimatedTimeRemaining(0);
                clearInterval(pollInterval);
                pollingIntervalRef.current = null;
                console.log('✅ [Progress Monitor] Interval cleared, polling stopped (main check)');
                
                // Redirect to review transactions after a short delay
                setTimeout(() => {
                  console.log('🔄 [Progress Monitor] Redirecting to review transactions...');
                  router.push(`/protected?screen=review-transactions&accountId=${accountId}`);
                }, 2000); // 2 second delay to show completion message
                return; // Exit the polling loop
              }
            }
          } else {
            console.error('❌ [Progress Monitor] API request failed:', response.status);
            const errorText = await response.text();
            console.error('❌ [Progress Monitor] Error response:', errorText);
          }
        } else {
          console.error('❌ [Progress Monitor] API request failed:', response.status);
          const errorText = await response.text();
          console.error('❌ [Progress Monitor] Error response:', errorText);
          
          // If API fails multiple times, stop polling to prevent infinite loop
          if (pollCount > 10) {
            console.error('❌ [Progress Monitor] Too many API failures, stopping polling');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            isPollingRef.current = false;
            setAnalysisStatus('error');
            setCurrentTransaction('Analysis failed - please try again');
            return;
          }
        }
      } catch (error) {
        console.error('❌ [Progress Monitor] Error checking progress:', error);
        
        // Log the error with detailed context
        logPollingError(error, pollCount, {
          userId: user?.id,
          accountId: accountId,
          message: `Polling error at attempt ${pollCount}`,
        });
        
        // If we get too many errors, stop polling
        if (pollCount > 10) {
          console.error('❌ [Progress Monitor] Too many errors, stopping polling');
          errorLogger.log({
            level: 'error',
            component: 'plaid-link-screen',
            function: 'monitorAnalysisProgress',
            message: 'Polling stopped due to too many errors',
            details: { pollCount, maxPolls, accountId },
            userId: user?.id,
            accountId: accountId,
          });
          
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          isPollingRef.current = false;
          setAnalysisStatus('error');
          setCurrentTransaction('Analysis failed - please try again');
          return;
        }
      }
    }, 2000); // Poll every 2 seconds
    
    // Store the interval in the ref IMMEDIATELY after creation
    pollingIntervalRef.current = pollInterval;
    
    // IMMEDIATE FALLBACK: Check if analysis is already done and redirect
    setTimeout(async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken();
          
          // Check if analysis is already complete
          const statusResponse = await fetch(`/api/transactions/analysis-status?accountId=${accountId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (statusResponse.ok) {
            const statusResult = await statusResponse.json();
            console.log('🔍 [IMMEDIATE CHECK] Analysis status:', statusResult);
            
            if (statusResult.success && statusResult.data) {
              const { overallStatus, progress } = statusResult.data;
              
              if (overallStatus === 'completed' || (progress?.current >= progress?.total && progress?.total > 0)) {
                console.log('✅ [IMMEDIATE CHECK] Analysis already complete, redirecting immediately');
                setAnalysisStatus('completed');
                setCurrentTransaction('Analysis complete! Redirecting...');
                setTimeout(() => onSuccess(), 1000);
                return;
              }
            }
          }
          
          // Use deterministic jobId - one job per (user, account)
          const deterministicJobId = `${user.uid}_${accountId}`;
          setJobId(deterministicJobId);
          
          // If not complete, trigger analysis
          if ((analysisProgress?.current ?? 0) === 0 && (analysisProgress?.total ?? 0) === 0) {
            console.log('🔄 [IMMEDIATE CHECK] No progress detected, triggering analysis...');
            const response = await fetch('/api/plaid/auto-analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ accountId })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('✅ [IMMEDIATE CHECK] Analysis trigger result:', result);
              // jobId should match our deterministic one
              if (result.jobId && result.jobId === deterministicJobId) {
                console.log('📊 [Auto-Analyze] Job ID confirmed:', result.jobId);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ [IMMEDIATE CHECK] Error:', error);
      }
    }, 1500); // Check every 1.5 seconds for real-time updates
    
    // AGGRESSIVE FALLBACK: Redirect after 2 minutes regardless
    setTimeout(() => {
      clearInterval(pollInterval);
      pollingIntervalRef.current = null;
      console.warn('⚠️ [AGGRESSIVE FALLBACK] 2 minutes reached, redirecting to review transactions');
      setAnalysisStatus('completed');
      setCurrentTransaction('Redirecting to review transactions...');
      setTimeout(() => onSuccess(), 1000);
    }, 120000); // 2 minutes
    
    // EMERGENCY FALLBACK: Redirect after 30 seconds if no progress at all
    setTimeout(() => {
      if ((analysisProgress?.current ?? 0) === 0 && (analysisProgress?.total ?? 0) === 0) {
        console.warn('⚠️ [EMERGENCY FALLBACK] No progress after 30s, redirecting anyway');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        isPollingRef.current = false;
        setAnalysisStatus('completed');
        setCurrentTransaction('Redirecting to review transactions...');
        setTimeout(() => onSuccess(), 1000);
      }
    }, 30000); // 30 seconds
    */
  };

  const onPlaidSuccess = useCallback(async (public_token: string) => {
    setLoading(true);
    setError(null);

    try {
      // Guard Plaid public_token early
      if (!public_token) {
        console.error('Plaid returned empty public_token');
        throw new Error('Could not retrieve public_token from Plaid.');
      }

      // Get Firebase auth token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      
      const token = await currentUser.getIdToken(true); // Force refresh the token
      console.log('🔑 Got Firebase token for Plaid API call');

      const response = await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          public_token,
        }),
      });

      if (!response.ok) {
        let errorText = `HTTP ${response.status}`;
        try {
          const text = await response.text();              // read once
          try {
            const data = JSON.parse(text);                 // attempt JSON
            errorText = data?.error || data?.details || errorText;
            console.error('Plaid connection error (JSON):', data);
          } catch {
            // Non-JSON body
            errorText = text || errorText;
            console.error('Plaid connection error (TEXT):', text);
          }
        } catch {
          console.error('Plaid connection error: empty response');
        }
        throw new Error(`Failed to connect bank account: ${errorText}`);
      }

      const data = await response.json();
      console.log('Bank account connected successfully:', data);
      setIsConnected(true);
      
      // Redirect to account classification page
      if (data.accountId) {
        console.log('🔄 [Plaid Success] Redirecting to account classification for account:', data.accountId);
        router.push(`/protected/account-usage/${data.accountId}`);
      } else {
        // Fallback: proceed after delay if no account ID
        setTimeout(() => {
          console.log('✅ Bank connection successful, calling onSuccess callback');
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error connecting bank account:', err);
      setError(err.message || 'Failed to connect bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user.id, onSuccess]);

  const onPlaidExit = useCallback((err: any) => {
    if (err) {
      console.error('Plaid Link exit error:', err);
      setError('Bank connection was cancelled or failed. Please try again.');
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  const handleConnectBank = () => {
    if (!bankConsent) return;
    if (ready) {
      open();
    }
  };

  const handleSkip = () => {
    onSuccess(); // Continue to next step without connecting bank
  };

  if (isConnected) {
    const getStatusMessage = () => {
      switch (analysisStatus) {
        case 'connecting':
          return 'Connecting to your bank...';
        case 'importing':
          return 'Importing transactions...';
        case 'analyzing':
          return 'Analyzing transactions with AI...';
        case 'completed':
          return 'Analysis complete! Preparing your review...';
        default:
          return 'Processing...';
      }
    };

    const getStatusIcon = () => {
      switch (analysisStatus) {
        case 'connecting':
        case 'importing':
        case 'analyzing':
          return <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>;
        case 'completed':
          return <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />;
        default:
          return <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>;
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="p-8 bg-white border border-gray-200 shadow-sm max-w-md w-full text-center">
          <div className="mb-6">
            {getStatusIcon()}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bank Connected!</h2>
            <p className="text-gray-600 mb-4">Your bank account has been successfully connected.</p>
            <p className="text-blue-600 font-medium mb-4">{getStatusMessage()}</p>
            
            {/* Analysis Progress - Use new PlaidProgress component if accountId available, fallback to old UI */}
            {accountId ? (
              <div className="mb-6">
                <PlaidProgress accountId={accountId} />
              </div>
            ) : (
              (analysisProgress?.total ?? 0) > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-semibold text-gray-800">AI Analysis Progress</span>
                    <span className="text-lg font-bold text-blue-600">{analysisProgress?.current ?? 0} of {analysisProgress?.total ?? 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm"
                      style={{ 
                        width: `${(analysisProgress?.total ?? 0) > 0 ? ((analysisProgress?.current ?? 0) / (analysisProgress?.total ?? 1)) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-sm text-gray-600">
                      {Math.round(((analysisProgress?.current ?? 0) / Math.max(analysisProgress?.total ?? 1, 1)) * 100)}% Complete
                    </span>
                  </div>
                </div>
              )
            )}
            
            {/* Current Transaction Being Analyzed */}
            {currentTransaction && analysisStatus === 'analyzing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-800">Currently Analyzing</span>
                </div>
                <p className="text-sm text-blue-700 font-medium">{currentTransaction}</p>
              </div>
            )}
            
            {/* Status Details */}
            {analysisStatus === 'analyzing' && (
              <div className="text-sm text-gray-500">
                <p>AI is analyzing each transaction to determine deductibility</p>
                <p className="mt-1">This may take a few minutes...</p>
                {(analysisProgress?.total ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    Analyzing {analysisProgress?.total ?? 0} transactions...
                  </p>
                )}
              </div>
            )}
            
            {analysisStatus === 'completed' && (
              <div className="text-sm text-blue-600">
                <p>All transactions have been analyzed!</p>
                <p className="mt-1">Redirecting you to review...</p>
              </div>
            )}
            
            {/* Progress indicator for when no progress data yet */}
            {(analysisProgress?.total ?? 0) === 0 && analysisStatus === 'analyzing' && (
              <div className="text-sm text-gray-500">
                <p>Transactions imported, starting AI analysis...</p>
                <div className="mt-2 flex justify-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            )}
            
            {/* Single Progress Indicator (fallback) - only show when accountId is NOT present to avoid duplicates */}
            {(!accountId && (analysisStatus === 'importing' || analysisStatus === 'analyzing')) && (
              <div className="text-sm text-gray-500">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">
                    {analysisStatus === 'importing' ? 'Importing transactions from your bank...' : 'Analyzing transactions with AI...'}
                  </span>
                </div>
                
                {/* Single Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ 
                      width: analysisStatus === 'importing' 
                        ? importProgress.total > 0 ? `${(importProgress.imported / importProgress.total) * 100}%` : '10%'
                        : (analysisProgress?.total ?? 0) > 0 ? `${((analysisProgress?.current ?? 0) / (analysisProgress?.total ?? 1)) * 100}%` : '0%'
                    }}
                  ></div>
                </div>
                
                {/* Current Status */}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-800 mb-1">{currentTransaction}</p>
                  {estimatedTimeRemaining > 0 && (
                    <p className="text-xs text-gray-500">
                      Estimated time remaining: {estimatedTimeRemaining < 60 
                        ? `${estimatedTimeRemaining} seconds`
                        : `${Math.round(estimatedTimeRemaining / 60)} minutes`
                      }
                    </p>
                  )}
                </div>
                
                {/* Skip to Review Button - Show after 10 seconds */}
                <div className="text-center mt-6 space-y-3">
                  <p className="text-sm text-gray-500">
                    Analysis is taking longer than expected. You can skip to review transactions now.
                  </p>
                  <button
                    onClick={() => {
                      console.log('🔄 [User Action] Skipping analysis, proceeding to review transactions');
                      onSuccess();
                    }}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Skip to Review Transactions
                  </button>
                </div>
              </div>
            )}

            {/* Analysis Complete - Review Button */}
            {analysisStatus === 'completed' && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="font-medium text-blue-600">Analysis Complete!</span>
                </div>
                
                <p className="text-sm text-gray-600 mb-6">
                  All transactions have been analyzed. Review and categorize your expenses to maximize your tax deductions.
                </p>
                
                <button
                  onClick={() => onSuccess()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Go Review Transactions
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <div className="h-6 w-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-1">
              <span className="text-white font-medium text-xs">WriteOff</span>
            </div>
            <h1 className="text-lg font-medium text-foreground">Connect Your <span className="text-primary font-medium">Bank</span></h1>
            <p className="text-xs text-muted-foreground">Securely link your accounts for <span className="font-medium text-primary">expense tracking</span></p>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="p-4 pb-20 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-white font-medium text-xs">✓</div>
            <div className="w-12 h-1 bg-primary rounded-full"></div>
            <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-white font-medium text-xs">2</div>
            <div className="w-12 h-1 bg-muted rounded-full"></div>
            <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center text-muted-foreground font-medium text-xs">3</div>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            <span className="font-medium text-primary">Step 2 of 3:</span> Bank Connection
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Notice at Collection */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          <strong>Notice at Collection:</strong> We collect your bank account and transaction data, employer/workstyle answers, and state to provide tax deduction analysis and generate reports. See our <a href="/privacy" className="underline text-blue-700" target="_blank" rel="noopener noreferrer">Privacy Policy</a> for details.
        </div>
        <div className="space-y-4">
          <Card className="p-4 bg-white border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Connect Your <span className="text-primary font-medium">Bank Account</span></h3>
                <p className="text-xs text-muted-foreground">Automatically track business expenses and transactions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Shield className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground text-xs">Bank-level security</p>
                  <p className="text-xs text-muted-foreground">256-bit encryption</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <CreditCard className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground text-xs">Auto categorization</p>
                  <p className="text-xs text-muted-foreground">AI-powered sorting</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground text-xs">Tax optimization</p>
                  <p className="text-xs text-muted-foreground">Maximize deductions</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Explicit Bank Data Consent */}
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  id="bankConsent"
                  checked={bankConsent}
                  onChange={e => setBankConsent(e.target.checked)}
                  className="mt-1"
                  required
                />
                <label htmlFor="bankConsent" className="text-xs text-foreground">
                  I authorize WriteOff to access and use my account and transaction data via Plaid to analyze potential tax deductions and generate reports, including Schedule C. I understand I can revoke access anytime. (<a href="/privacy" className="underline text-blue-700" target="_blank" rel="noopener noreferrer">Privacy Policy</a> | <a href="https://plaid.com/legal/#end-user-privacy-policy" className="underline text-blue-700" target="_blank" rel="noopener noreferrer">Plaid Privacy Policy</a>)
                  <span className="text-red-600 ml-0.5">*</span>
                </label>
              </div>
              <Button
                onClick={handleConnectBank}
                disabled={!ready || loading || !bankConsent}
                className="w-full h-12 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 text-base font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Connect Bank Account</span>
                  </>
                )}
              </Button>

              <Button
                onClick={handleSkip}
                variant="outline"
                className="w-full h-10 bg-background hover:bg-muted text-foreground border border-border hover:border-primary/30 rounded-lg transition-all duration-200 text-sm font-medium"
              >
                Skip for now (connect later)
              </Button>
            </div>
          </Card>

          <div className="text-center">
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              By connecting your bank account, you agree to Plaid's Privacy Policy and Terms of Service. WriteOff uses bank-level security and never stores your banking credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
