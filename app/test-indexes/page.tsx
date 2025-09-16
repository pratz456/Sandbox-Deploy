"use client";

import React, { useState } from 'react';
import { useTransactions, useUserStats } from '@/lib/firebase/hooks';
import { auth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestIndexesPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const currentUser = auth.currentUser;
  const userId = currentUser?.uid;

  const { transactions, isLoading: transactionsLoading, error: transactionsError } = useTransactions(userId || '');
  const { stats, isLoading: statsLoading, error: statsError } = useUserStats(userId || '');

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const runIndexTests = () => {
    setTestResults([]);
    addTestResult('Starting index tests...');

    // Test 1: Check if transactions query works
    if (transactionsLoading) {
      addTestResult('✅ Transactions query is loading (index may be working)');
    } else if (transactionsError) {
      addTestResult(`❌ Transactions query failed: ${transactionsError.message}`);
    } else {
      addTestResult(`✅ Transactions query successful: ${transactions.length} transactions loaded`);
    }

    // Test 2: Check if stats query works
    if (statsLoading) {
      addTestResult('✅ Stats query is loading (index may be working)');
    } else if (statsError) {
      addTestResult(`❌ Stats query failed: ${statsError.message}`);
    } else {
      addTestResult(`✅ Stats query successful: ${stats?.totalTransactions ?? 0} total transactions`);
    }

    // Test 3: Check data consistency
    if (transactions.length > 0 && stats && stats.totalTransactions > 0) {
      if (transactions.length === stats.totalTransactions) {
        addTestResult('✅ Data consistency check passed');
      } else {
        addTestResult(`⚠️ Data consistency warning: transactions=${transactions.length}, stats=${stats.totalTransactions}`);
      }
    }

    addTestResult('Index tests completed');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
          <p className="text-gray-600">Please sign in to test Firestore indexes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Firestore Indexes Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Status Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions Query</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={transactionsLoading ? 'text-yellow-600' : transactionsError ? 'text-red-600' : 'text-green-600'}>
                    {transactionsLoading ? 'Loading...' : transactionsError ? 'Error' : 'Success'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Count:</span>
                  <span>{transactions.length}</span>
                </div>
                {transactionsError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {transactionsError.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats Query</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={statsLoading ? 'text-yellow-600' : statsError ? 'text-red-600' : 'text-green-600'}>
                    {statsLoading ? 'Loading...' : statsError ? 'Error' : 'Success'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{stats?.totalTransactions ?? 'N/A'}</span>
                </div>
                {statsError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {statsError.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Index Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={runIndexTests} className="mb-4">
              Run Index Tests
            </Button>
            
            <div className="space-y-2">
              <h4 className="font-medium">Test Results:</h4>
              <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                {testResults.length === 0 ? (
                  <p className="text-gray-500">No tests run yet. Click "Run Index Tests" to start.</p>
                ) : (
                  testResults.map((result, index) => (
                    <div key={index} className="text-sm font-mono">
                      {result}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Information */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">User Info:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <div>User ID: {userId}</div>
                  <div>Email: {currentUser.email}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Query Status:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <div>Transactions Loading: {transactionsLoading.toString()}</div>
                  <div>Stats Loading: {statsLoading.toString()}</div>
                  <div>Transactions Error: {transactionsError ? 'Yes' : 'No'}</div>
                  <div>Stats Error: {statsError ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Data Summary:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <div>Transactions Count: {transactions.length}</div>
                  <div>Total Transactions (Stats): {stats?.totalTransactions ?? 'N/A'}</div>
                  <div>Deductible Count: {stats?.deductibleTransactions ?? 'N/A'}</div>
                  <div>Needs Review: {stats?.needsReviewTransactions ?? 'N/A'}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
