"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { getUserProfile } from "@/lib/firebase/profiles";
import { ProfileSetupScreen } from "@/components/profile-setup-screen";
import DashboardScreen from "@/components/dashboard-screen";
import { SettingsScreen } from "@/components/settings-screen";
import { DebugProfile } from "@/components/debug-profile";
import { TestOnboarding } from "@/components/test-onboarding";
import { AddExpenseScreen } from "@/components/add-expense-screen";
import { ReceiptUploadScreen } from "@/components/receipt-upload-screen";
import { TaxCalendarScreen } from "@/components/tax-calendar-screen";
import { TransactionDetailScreen } from "@/components/transaction-detail-screen";
import { ReviewTransactionsScreen } from "@/components/review-transactions-screen";
import { ScheduleCExportScreen } from "@/components/schedule-c-export-screen";
import { DeductionsDetailScreen } from "@/components/deductions-detail-screen";
import { ExpensesDetailScreen } from "@/components/expenses-detail-screen";
import { BanksDetailScreen } from "@/components/banks-detail-screen";
import { ProfitLossDetailScreen } from "@/components/profit-loss-detail-screen";
import { CategoriesScreen } from "@/components/categories-screen";
import { PlaidLinkScreen } from "@/components/plaid-link-screen";
import { PlaidScreen } from "@/components/plaid-screen";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransactions } from "@/lib/firebase/hooks";

interface UserProfile {
  email: string;
  name: string;
  profession: string;
  income: string;
  state: string;
  filingStatus: string;
  plaidToken?: string;
}

interface Transaction {
  id: string;
  merchant_name: string;
  amount: number;
  category: string;
  date: string;
  type?: 'expense' | 'income';
  is_deductible?: boolean | null;
  deductible_reason?: string;
  deduction_score?: number;
  description?: string;
  notes?: string;
}

export default function ProtectedPage() {
  const { user, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'settings' | 'debug' | 'test-onboarding' | 'add-expense' | 'receipt-upload' | 'tax-calendar' | 'transactions' | 'review-transactions' | 'schedule-c-export' | 'edit-expense' | 'deductions-detail' | 'expenses-detail' | 'banks-detail' | 'profit-loss-detail' | 'categories' | 'plaid-link' | 'plaid' | 'transaction-detail' | 'reports'>('dashboard');
  const [navigationStack, setNavigationStack] = useState<string[]>(['dashboard']);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [analyzingTransactions, setAnalyzingTransactions] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Use real-time transactions hook for instant updates
  const {
    transactions
  } = useTransactions(user?.id || '');

  // Force re-renders when transactions are updated
  useEffect(() => {
    // This will trigger a re-render whenever transactions are updated
    console.log('🔄 Transactions updated, forcing re-render');
  }, [transactions]);

  // Transaction state is now managed by useTransactionState hook

  // Check bank connection and fetch transactions
  const checkBankConnectionAndFetchTransactions = async (currentUser: any) => {
    try {
      // Check if user has a Plaid token in their profile
      const { data: profile, error } = await getUserProfile(currentUser.id);
      
      if (profile?.plaid_token) {
        setBankConnected(true);
        // Only sync transactions if explicitly requested, not on every page load
        // This prevents the massive slowdown on home screen
        console.log('✅ Bank connected - transactions will be synced on demand');
        
        // Transactions are now automatically managed by useTransactionState
      } else {
        setBankConnected(false);
        // Transactions are now automatically managed by useTransactionState
      }
    } catch (error) {
      console.error('Error checking bank connection:', error);
      setBankConnected(false);
      // Transactions are now automatically managed by useTransactionState
    }
  };

  useEffect(() => {
    const checkUserAndProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {

        // Check if user has completed profile setup
        const { data: profile, error: profileError } = await getUserProfile(user.id);
        
        // Debug: Log the raw response from getUserProfile
        console.log('🔍 [Profile Check] getUserProfile response:', {
          hasData: !!profile,
          hasError: !!profileError,
          errorType: typeof profileError,
          errorKeys: profileError ? Object.keys(profileError) : [],
                      errorStringified: profileError ? (() => {
              try {
                return JSON.stringify(profileError, null, 2);
              } catch (e) {
                return `[Circular reference or non-serializable: ${e instanceof Error ? e.message : String(e)}]`;
              }
            })() : 'null',
          errorIsEmpty: profileError && Object.keys(profileError).length === 0,
          errorIsNull: profileError === null,
          errorIsUndefined: profileError === undefined
        });
        
        if (profileError) {
          // Check for empty error objects (which can cause console errors)
          if (profileError && typeof profileError === 'object' && Object.keys(profileError).length === 0) {
            console.log('⚠️ [Profile Check] Empty error object detected, treating as no profile');
            setHasProfile(false);
            return;
          }
          
          // Enhanced error logging with better structure
          const errorInfo = {
            error: profileError,
            errorType: typeof profileError,
            errorCode: profileError?.code,
            errorMessage: profileError?.message,
            hasOriginalError: !!profileError?.originalError,
            originalErrorMessage: profileError?.originalError?.message,
            errorKeys: Object.keys(profileError || {}),
            errorStringified: (() => {
              try {
                return JSON.stringify(profileError, null, 2);
              } catch (e) {
                return `[Circular reference or non-serializable: ${e instanceof Error ? e.message : String(e)}]`;
              }
            })()
          };
          
          console.log('🔍 [Profile Check] Profile error details:', errorInfo);
          
          // Handle specific error codes
          if (profileError.code === 'PGRST116' || profileError.code === 'PROFILE_NOT_FOUND') {
            console.log('ℹ️ [Profile Check] No profile found for user, showing setup screen');
            setHasProfile(false);
          } else if (profileError.code === 'FETCH_ERROR') {
            console.log('⚠️ [Profile Check] Fetch error occurred, checking details');
            
            // Check if it's a permissions error
            const isPermissionsError = profileError?.message?.includes('permissions') || 
                                     profileError?.message?.includes('permission-denied') ||
                                     profileError?.originalError?.message?.includes('permissions') ||
                                     profileError?.originalError?.message?.includes('permission-denied');
            
            if (isPermissionsError) {
              console.log('🔒 [Profile Check] Permissions issue detected, user needs to set up profile');
            } else {
              console.log('⚠️ [Profile Check] Other fetch error, defaulting to profile setup');
            }
            setHasProfile(false);
          } else {
            // Handle any other error types gracefully
            console.log('⚠️ [Profile Check] Unknown profile error, defaulting to profile setup');
            setHasProfile(false);
          }
        } else if (profile) {
          // Success case: user has a profile
          console.log('✅ [Profile Check] Profile found, user has completed setup');
          setHasProfile(true);
          setUserProfile(profile);
          
          // Check bank connection and fetch transactions
          await checkBankConnectionAndFetchTransactions(user);
        } else {
          // No error but also no profile data
          console.log('ℹ️ [Profile Check] No profile data returned, showing setup screen');
          setHasProfile(false);
        }
      } catch (error) {
        // Enhanced error handling for unexpected errors
        const errorInfo = {
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        };
        
        console.error('❌ [Profile Check] Unexpected error in checkUserAndProfile:', errorInfo);
        
        // Don't redirect to login for profile errors - just show setup screen
        // Only redirect for authentication errors
        if (error instanceof Error && 
            (error.message.includes('auth') || 
             error.message.includes('token') || 
             error.message.includes('unauthorized'))) {
          console.log('🔐 [Profile Check] Authentication error detected, redirecting to login');
          router.push("/auth/login");
        } else {
          console.log('⚠️ [Profile Check] Non-authentication error, showing profile setup screen');
          setHasProfile(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAndProfile();
  }, [user, router]);

  // Refresh transactions when navigating to dashboard
  // Real-time updates are handled automatically by useTransactions hook

  // Handle URL parameters for navigation
  useEffect(() => {
    if (searchParams) {
      const screen = searchParams.get('screen');
      const transactionId = searchParams.get('transactionId');
      const fromPage = searchParams.get('from');
      
      if (screen === 'transaction-detail' && transactionId) {
        // Find the transaction by ID
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) {
          // Use the explicit 'from' parameter to determine navigation source
          if (fromPage === 'transactions') {
            // Coming from transactions page, add it to navigation stack
            console.log('Coming from transactions page, adding to navigation stack');
            setNavigationStack(prev => [...prev, 'transactions']);
          } else if (fromPage) {
            // Coming from another specified page
            console.log('Coming from specified page:', fromPage);
            setNavigationStack(prev => [...prev, fromPage]);
          } else {
            // Coming from internal navigation, add current screen to stack
            setNavigationStack(prev => [...prev, currentScreen]);
          }
          
          setViewingTransaction(transaction);
          setCurrentScreen('transaction-detail');
        }
      } else if (screen) {
        // Add current screen to navigation stack before changing screens
        setNavigationStack(prev => [...prev, currentScreen]);
        setCurrentScreen(screen as any);
      }
    }
  }, [searchParams, transactions, currentScreen]);

  // Watch for pathname changes to detect home navigation
  useEffect(() => {
    console.log('Pathname changed:', pathname);
    
    // If we're on /protected without query params, we're on the home/dashboard
    if (pathname === '/protected' && !searchParams.has('screen')) {
      console.log('Navigated to home page, updating currentScreen to dashboard');
      setCurrentScreen('dashboard');
    }
  }, [pathname, searchParams]);

  const handleProfileComplete = async (profile: UserProfile, redirectTo?: string) => {
    console.log('Profile setup completed:', profile);
    setHasProfile(true);
    
    // Fetch the complete profile from database to ensure we have all fields
    if (user) {
      try {
        const { data: userProfile, error: profileError } = await getUserProfile(user.id);
        
        if (profileError) {
          console.error('Error fetching user profile after completion:', profileError);
        } else {
          console.log('✅ User profile loaded after completion:', userProfile);
          setUserProfile(userProfile);
        }
        
        // Check bank connection and fetch transactions after profile completion
        await checkBankConnectionAndFetchTransactions(user);
        
        // Redirect to specified screen if provided
        if (redirectTo) {
          console.log(`🔄 Redirecting to ${redirectTo} after profile completion`);
          setCurrentScreen(redirectTo);
        }
      } catch (error) {
        console.error('Error in handleProfileComplete:', error);
      }
    }
  };

  // Handle Plaid connection success
  const handlePlaidConnectionSuccess = async () => {
    if (user) {
      try {
        // Refresh user profile to get updated Plaid token
        const { data: userProfile, error: profileError } = await getUserProfile(user.id);
        
        if (!profileError && userProfile) {
          setUserProfile(userProfile);
          
          // If this is the first Plaid connection and Plaid guide hasn't been shown,
          // trigger the Plaid guide tutorial
          if (userProfile.plaid_token && !userProfile.onboardingPlaidGuideCompleted) {
            // Small delay to ensure the profile update is processed
            setTimeout(() => {
              const plaidGuideButton = document.getElementById('open-plaid-guide');
              if (plaidGuideButton) {
                plaidGuideButton.click();
              }
            }, 1000);
          }
        }
        
        // Update bank connection status
        setBankConnected(true);
        // Transactions are now automatically managed by useTransactionState
        
        // Navigate to review transactions screen to show the newly synced transactions
        setCurrentScreen('review-transactions');
      } catch (error) {
        console.error('Error handling Plaid connection success:', error);
      }
    }
  };

  const handleBack = async () => {
    // Handle logout or back to login
    try {
      const { signOutUser } = await import("@/lib/firebase/auth");
      await signOutUser();
      router.push("/");
    } catch (error) {
      console.error('Error signing out:', error);
      router.push("/");
    }
  };

  // Handle navigation between screens with history tracking
  const handleNavigate = (screen: string) => {
    console.log('Navigate to:', screen);
    
    // Add current screen to navigation stack before navigating
    setNavigationStack(prev => [...prev, currentScreen]);
    
    if (screen === 'settings') {
      setCurrentScreen('settings');
    } else if (screen === 'dashboard') {
      // Navigate to dashboard using Next.js router
      router.push('/protected');
      // Also update the local state immediately for responsive UI
      setCurrentScreen('dashboard');
    } else if (screen === 'debug') {
      setCurrentScreen('debug');
    } else if (screen === 'test-onboarding') {
      setCurrentScreen('test-onboarding');
    } else if (screen === 'categorize' || screen === 'add-expense') {
      setEditingTransaction(null);
      setCurrentScreen('add-expense');
    } else if (screen === 'receipt-upload') {
      setCurrentScreen('receipt-upload');
    } else if (screen === 'tax-calendar') {
      setCurrentScreen('tax-calendar');
    } else if (screen === 'transactions') {
      // Navigate to transactions page using Next.js router
      router.push('/protected/transactions');
    } else if (screen === 'review-transactions') {
      setCurrentScreen('review-transactions');
    } else if (screen === 'schedule-c-export') {
      setCurrentScreen('schedule-c-export');
    } else if (screen === 'deductions-detail') {
      setCurrentScreen('deductions-detail');
    } else if (screen === 'expenses-detail') {
      setCurrentScreen('expenses-detail');
    } else if (screen === 'banks-detail') {
      setCurrentScreen('banks-detail');
    } else if (screen === 'profit-loss-detail') {
      setCurrentScreen('profit-loss-detail');
    } else if (screen === 'categories') {
      // Navigate to categories page using Next.js router with query parameter
      router.push('/protected?screen=categories');
    } else if (screen === 'plaid-link') {
      setCurrentScreen('plaid-link');
    } else if (screen === 'plaid') {
      setCurrentScreen('plaid');
    } else if (screen === 'transaction-detail') {
      setCurrentScreen('transaction-detail');
    } else if (screen === 'reports') {
      // Navigate to reports page using Next.js router
      router.push('/protected/reports');
    } else if (screen === 'settings') {
      // Navigate to internal settings screen
      setCurrentScreen('settings');
    }
    // You can add more screen navigation logic here
  };

  // Handle going back to previous screen
  const handleGoBack = () => {
    console.log('Navigation stack:', navigationStack);
    
    // If we're going back from a screen that should go to dashboard, use router
    if (currentScreen === 'transactions' || currentScreen === 'reports') {
      router.push('/protected');
      setCurrentScreen('dashboard');
      // Clear navigation stack when going to dashboard
      setNavigationStack(['dashboard']);
      return;
    }
    
    // Get the previous screen from the navigation stack
    if (navigationStack.length > 0) {
      const previousScreen = navigationStack[navigationStack.length - 1];
      console.log('Going back from', currentScreen, 'to', previousScreen);
      
      // Remove the current screen from the stack
      setNavigationStack(prev => prev.slice(0, -1));
      
      // Special handling for going back to transactions page
      if (previousScreen === 'transactions') {
        router.push('/protected/transactions');
        setCurrentScreen('transactions');
      } else {
        // Go back to the previous screen
        setCurrentScreen(previousScreen as any);
      }
    } else {
      // Fallback to dashboard if no navigation history
      console.log('No navigation history, going to dashboard');
      setCurrentScreen('dashboard');
    }
  };

  // Handle navigation from external pages back to main app
  const handleExternalPageBack = (fromPage: string) => {
    console.log('Coming back from external page:', fromPage);
    
    // If we have navigation history, go back to the last screen
    if (navigationStack.length > 0) {
      const lastScreen = navigationStack[navigationStack.length - 1];
      console.log('Going back to last screen:', lastScreen);
      setCurrentScreen(lastScreen as any);
    } else {
      // Otherwise go to dashboard
      setCurrentScreen('dashboard');
    }
  };

  // Handle viewing transaction details
  const handleViewTransaction = (transaction: Transaction & { _source?: string }) => {
    // Use the source information if available, otherwise use current screen
    const sourceScreen = transaction._source || currentScreen;
    console.log('Viewing transaction from source:', sourceScreen);
    
    // Add source screen to navigation stack before viewing transaction
    setNavigationStack(prev => [...prev, sourceScreen]);
    setViewingTransaction(transaction);
    setCurrentScreen('transaction-detail');
  };

  // Handle viewing transaction details from external pages (like /protected/transactions)
  const handleViewTransactionFromExternal = (transaction: Transaction, fromPage: string) => {
    console.log('Viewing transaction from external page:', fromPage);
    
    // Add the external page to navigation stack
    setNavigationStack(prev => [...prev, fromPage]);
    setViewingTransaction(transaction);
    setCurrentScreen('transaction-detail');
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      const { signOutUser } = await import("@/lib/firebase/auth");
      await signOutUser();
      router.push("/");
    } catch (error) {
      console.error('Error signing out:', error);
      router.push("/");
    }
  };

  // Handle saving transactions - now handled by real-time updates
  const handleSaveTransaction = async (transaction: Transaction) => {
    // Real-time updates are handled automatically by the useTransactions hook
    // Just update the viewing transaction if it's the same one
    setViewingTransaction(prev => prev && prev.id === transaction.id ? transaction : prev);
  };

  // Handle editing a transaction
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setCurrentScreen('add-expense');
  };

  // Handle transaction update (for review screen) - now handled by real-time updates
  const handleTransactionUpdate = async (updatedTransaction: Transaction) => {
    console.log('🔄 [UI RERENDER] Parent handleTransactionUpdate called for:', updatedTransaction.id, 'is_deductible:', updatedTransaction.is_deductible);
    
    // Real-time updates are handled automatically by the useTransactions hook
    // Just update the viewing transaction if it's the same one
    setViewingTransaction(prev => prev && prev.id === updatedTransaction.id ? { ...prev, ...updatedTransaction } : prev);
  };

  // Handle receipt upload completion
  const handleReceiptUploadComplete = (expenseData: any) => {
    const transaction: Transaction = {
      id: expenseData.id,
      merchant_name: expenseData.description,
      amount: expenseData.amount,
      category: expenseData.category,
      date: expenseData.date,
      type: 'expense',
      is_deductible: expenseData.isDeductible,
      notes: `Receipt uploaded: ${expenseData.receipt?.fileName || 'receipt.jpg'}`
    };
    handleSaveTransaction(transaction);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show profile setup screen if user hasn't completed their profile
  if (user && hasProfile === false) {
    return (
      <ProfileSetupScreen
        user={user}
        onBack={handleBack}
        onComplete={handleProfileComplete}
      />
    );
  }

  // Show dashboard if user has completed profile setup
  if (user && hasProfile === true) {
    if (currentScreen === 'debug') {
      return (
        <div>
          <div className="p-4">
            <button 
              onClick={handleGoBack} 
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Back
            </button>
          </div>
          <DebugProfile user={user} />
        </div>
      );
    }

    if (currentScreen === 'test-onboarding') {
      return (
        <div>
          <div className="p-4">
            <button 
              onClick={handleGoBack} 
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Back
            </button>
          </div>
          <TestOnboarding />
        </div>
      );
    }
    
    if (currentScreen === 'settings') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <SettingsScreen
          user={safeUser}
          onBack={handleGoBack}
          onNavigate={handleNavigate}
          inAppNavigation={true}
        />
      );
    }

    if (currentScreen === 'add-expense') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <AddExpenseScreen
          user={safeUser}
          onBack={handleGoBack}
          onSave={handleSaveTransaction}
          editingExpense={editingTransaction}
        />
      );
    }

    if (currentScreen === 'receipt-upload') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <ReceiptUploadScreen
          user={safeUser}
          onBack={handleGoBack}
          onUploadComplete={handleReceiptUploadComplete}
        />
      );
    }

    if (currentScreen === 'tax-calendar') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <TaxCalendarScreen
          user={safeUser}
          onBack={handleGoBack}
        />
      );
    }



    if (currentScreen === 'review-transactions') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <ReviewTransactionsScreen
          user={safeUser}
          onBack={handleGoBack}
          transactions={transactions}
          onTransactionUpdate={handleTransactionUpdate}
          onTransactionClick={handleViewTransaction}
        />
      );
    }

    if (currentScreen === 'schedule-c-export') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <ScheduleCExportScreen
          user={safeUser}
          onBack={handleGoBack}
          transactions={transactions}
        />
      );
    }

    if (currentScreen === 'deductions-detail') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <DeductionsDetailScreen
          user={safeUser}
          onBack={handleGoBack}
          transactions={transactions}
        />
      );
    }

    if (currentScreen === 'expenses-detail') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <ExpensesDetailScreen
          user={safeUser}
          onBack={handleGoBack}
          transactions={transactions}
        />
      );
    }

    if (currentScreen === 'banks-detail') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <BanksDetailScreen
          user={safeUser}
          onBack={handleGoBack}
          onConnectBank={() => {
            // You can implement Plaid connection here or navigate to a connect screen
            router.push('/protected');
          }}
        />
      );
    }

    if (currentScreen === 'profit-loss-detail') {
      return (
        <ProfitLossDetailScreen
          onNavigate={handleNavigate}
          transactions={transactions}
        />
      );
    }

    if (currentScreen === 'categories') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <CategoriesScreen
          user={safeUser}
          onBack={handleGoBack}
          transactions={transactions}
          onTransactionClick={(transaction) => handleViewTransaction(transaction)}
        />
      );
    }

    if (currentScreen === 'plaid-link') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <PlaidLinkScreen
          user={safeUser}
          onSuccess={handlePlaidConnectionSuccess}
          onBack={handleGoBack}
        />
      );
    }

    if (currentScreen === 'plaid') {
      const safeUser = { ...user, email: user.email ?? undefined };
      return (
        <PlaidScreen
          user={safeUser}
          onBack={handleGoBack}
          onConnect={() => setCurrentScreen('plaid-link')}
        />
      );
    }

    if (currentScreen === 'transaction-detail' && viewingTransaction) {
      return (
        <TransactionDetailScreen
          transaction={viewingTransaction}
          onBack={handleGoBack}
          onSave={handleSaveTransaction}
        />
      );
    }

    if (currentScreen === 'reports') {
      // For reports, we'll redirect to the reports page
      router.push('/protected/reports');
      return null;
    }
    
    return (
      <DashboardScreen 
        profile={userProfile}
        transactions={transactions}
        onNavigate={handleNavigate}
        onTransactionClick={(transaction) => handleViewTransaction(transaction)}
        analyzingTransactions={analyzingTransactions}
        onSignOut={handleSignOut}
      />
    );
  }

  return null;
}
