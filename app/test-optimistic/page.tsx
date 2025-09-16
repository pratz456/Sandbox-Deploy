"use client";

import React, { useState } from 'react';
import { useTransactions, useUserStats } from '@/lib/firebase/hooks';
import { useUpdateTransaction } from '@/lib/firebase/mutations';
import { useToasts } from '@/components/ui/toast';
import { ToastContainer } from '@/components/ui/toast';
import { auth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestOptimisticPage() {
  const currentUser = auth.currentUser;
  const userId = currentUser?.uid;

  const { transactions, isLoading: transactionsLoading, error: transactionsError } = useTransactions(userId || '');
  const { stats, isLoading: statsLoading } = useUserStats(userId || '');
  const { toasts, removeToast, showSuccess, showError } = useToasts();
  
  const updateTransactionMutation = useUpdateTransaction();

  const handleToggleDeductible = async (transactionId: string) => {
    if (!userId) {
      showError('Authentication Error', 'Please sign in to test');
      return;
    }

    try {
      // Find the current transaction to toggle its deductible status
      const transaction = transactions.find(t => t.trans_id === transactionId || t.id === transactionId);
      if (!transaction) {
        showError('Transaction Not Found', 'Could not find transaction to update');
        return;
      }

      const newDeductibleStatus = !transaction.is_deductible;
      
      await updateTransactionMutation.mutateAsync({
        transactionId,
        userId,
        updates: {
          is_deductible: newDeductibleStatus,
          deductible_reason: newDeductibleStatus 
            ? 'Toggled to deductible via test' 
            : 'Toggled to non-deductible via test'
        }
      });

      showSuccess('Update Successful', `Transaction ${newDeductibleStatus ? 'marked as deductible' : 'marked as non-deductible'}`);
    } catch (error) {
      console.error('Error updating transaction:', error);
      showError('Update Failed', 'Failed to update transaction');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
          <p className="text-gray-600">Please sign in to test optimistic updates</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Optimistic Updates Test</h1>
          
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.totalTransactions ?? 'N/A'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deductible</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {statsLoading ? '...' : stats?.deductibleTransactions ?? 'N/A'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {statsLoading ? '...' : stats?.needsReviewTransactions ?? 'N/A'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {statsLoading ? '...' : `$${stats?.potentialSavings?.toFixed(2) ?? 'N/A'}`}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p>Loading transactions...</p>
                </div>
              ) : transactionsError ? (
                <div className="text-center py-8 text-red-600">
                  <p>Error loading transactions: {transactionsError.message}</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No transactions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.slice(0, 10).map((transaction) => (
                    <div 
                      key={transaction.trans_id || transaction.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{transaction.merchant_name}</div>
                        <div className="text-sm text-gray-500">
                          {transaction.category} • ${Math.abs(transaction.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(transaction.date).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.is_deductible === true 
                              ? 'bg-green-100 text-green-800' 
                              : transaction.is_deductible === false 
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {transaction.is_deductible === true 
                              ? 'Deductible' 
                              : transaction.is_deductible === false 
                                ? 'Personal' 
                                : 'Needs Review'
                            }
                          </span>
                        </div>
                        
                        <Button
                          onClick={() => handleToggleDeductible(transaction.trans_id || transaction.id)}
                          disabled={updateTransactionMutation.isPending}
                          variant="outline"
                          size="sm"
                        >
                          {updateTransactionMutation.isPending ? 'Updating...' : 'Toggle'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>How to Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>1. Click the &quot;Toggle&quot; button on any transaction to change its deductible status</p>
              <p>2. Notice how the UI updates immediately (optimistic update)</p>
              <p>3. Watch the stats cards update in real-time</p>
              <p>4. If the update fails, the UI will rollback automatically</p>
              <p>5. Check the browser console for detailed logging</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
