"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Account } from '@/lib/firebase/accounts';
// Simple modal component
type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};
function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
import { Search, Calendar, ArrowUpDown, Filter, Camera, Plus, X, FileText, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/firebase/auth-context';
import { useTransactions } from '@/lib/firebase/hooks';
import { getAccounts } from '@/lib/firebase/accounts';
import { createTransaction } from '@/lib/firebase/transactions';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { formatCategory, consolidateCategory } from '@/lib/utils';

interface Transaction {
  id: string;
  trans_id?: string;
  merchant_name: string;
  amount: number;
  category: string;
  date: string;
  is_deductible?: boolean | null;
  deductible_reason?: string;
  deduction_score?: number;
  notes?: string;
  receipt_url?: string;
  receipt_filename?: string;
}

export default function TransactionsPage() {
  const { user } = useAuth(); // Already declared at the top
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ merchant_name: '', amount: '', category: '', account_id: '' });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);

  // Static categories for dropdown (customize as needed)
  const categoryOptions = [
    'Food & Drink',
    'Transportation',
    'Travel',
    'Entertainment',
    'Professional Services',
    'Office & Equipment',
    'Loan & Financial',
    'General Merchandise',
    'Income',
    'Other',
  ];
  // Fetch accounts for dropdown
  useEffect(() => {
    if (!user || !user.id) return;
    setAccountsLoading(true);
    getAccounts(user.id)
      .then(({ data, error }) => {
        if (error) setAccountsError(error);
        else setAccounts(data);
      })
      .finally(() => setAccountsLoading(false));
  }, [user]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'merchant'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [amountRange, setAmountRange] = useState<'all' | 'under-50' | '50-200' | '200-500' | 'over-500'>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const router = useRouter();

  // useAuth() is already called at the top of this component

  // Use real-time transactions hook for instant updates
  const { transactions, isLoading: loading, error } = useTransactions(user?.id || '');

  // Handle error state
  if (error) {
    console.error('Error loading transactions:', error);
  }

  // Calculate summary statistics
  const deductibleTransactions = transactions.filter(t => t.is_deductible === true);
  const personalTransactions = transactions.filter(t => t.is_deductible === false);
  const pendingTransactions = transactions.filter(t => t.is_deductible === null || t.is_deductible === undefined);

  const deductibleTotal = deductibleTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const pendingTotal = pendingTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const potentialSavings = deductibleTotal * 0.3; // 30% tax rate

  // Get unique consolidated categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const consolidatedCategories = transactions.map(t => consolidateCategory(t.category));
    const uniqueConsolidated = [...new Set(consolidatedCategories.map(c => c.consolidatedName))].filter(Boolean);
    return uniqueConsolidated.sort();
  }, [transactions]);

  // Date range helper functions
  const getDateRange = (range: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { start: weekStart, end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) };
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: monthStart, end: monthEnd };
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1);
        return { start: quarterStart, end: quarterEnd };
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
        return { start: yearStart, end: yearEnd };
      case 'custom':
        return {
          start: customDateStart ? new Date(customDateStart) : null,
          end: customDateEnd ? new Date(customDateEnd) : null
        };
      default:
        return { start: null, end: null };
    }
  };

  // Filter transactions based on all filters
  const getFilteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Tab filter (deductible/personal/pending)
    if (activeTab === 'deductible') {
      filtered = filtered.filter(t => t.is_deductible === true);
    } else if (activeTab === 'personal') {
      filtered = filtered.filter(t => t.is_deductible === false);
    } else if (activeTab === 'pending') {
      filtered = filtered.filter(t => t.is_deductible === null || t.is_deductible === undefined);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.merchant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Date range filter
    if (dateRange !== 'all') {
      const { start, end } = getDateRange(dateRange);
      if (start && end) {
        filtered = filtered.filter(t => {
          const transactionDate = new Date(t.date);
          return transactionDate >= start && transactionDate < end;
        });
      }
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => consolidateCategory(t.category).consolidatedName === categoryFilter);
    }

    // Amount range filter
    if (amountRange !== 'all') {
      filtered = filtered.filter(t => {
        const amount = Math.abs(t.amount);
        switch (amountRange) {
          case 'under-50': return amount < 50;
          case '50-200': return amount >= 50 && amount < 200;
          case '200-500': return amount >= 200 && amount < 500;
          case 'over-500': return amount >= 500;
          default: return true;
        }
      });
    }

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'merchant':
          comparison = a.merchant_name.localeCompare(b.merchant_name);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, activeTab, searchTerm, dateRange, categoryFilter, amountRange, sortBy, sortOrder, customDateStart, customDateEnd]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateRange !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (amountRange !== 'all') count++;
    return count;
  }, [dateRange, categoryFilter, amountRange]);

  // Clear all filters
  const clearAllFilters = () => {
    setDateRange('all');
    setCategoryFilter('all');
    setAmountRange('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    setSearchTerm('');
    setActiveTab('all');
  };

  const getStatusBadge = (transaction: Transaction) => {
    if (transaction.is_deductible === true) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="success">Deductible</Badge>
        </div>
      );
    } else if (transaction.is_deductible === false) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Personal</Badge>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Pending</Badge>
        </div>
      );
    }
  };

  const getCategoryBadge = (category: string) => {
    const { consolidatedName, displayName } = consolidateCategory(category);

    const categoryColors: { [key: string]: string } = {
      'FOOD_AND_DRINK': 'bg-orange-100 text-orange-700 border-orange-200',
      'TRANSPORTATION': 'bg-accent/10 text-accent border-accent/20',
      'TRAVEL': 'bg-blue-100 text-blue-700 border-blue-200',
      'ENTERTAINMENT': 'bg-purple-100 text-purple-700 border-purple-200',
      'PROFESSIONAL_SERVICES': 'bg-primary/10 text-primary border-primary/20',
      'OFFICE_AND_EQUIPMENT': 'bg-primary/10 text-primary border-primary/20',
      'LOAN_AND_FINANCIAL': 'bg-red-100 text-red-700 border-red-200',
      'GENERAL_MERCHANDISE': 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20',
      'INCOME': 'bg-accent/10 text-accent border-accent/20'
    };

    const colorClass = categoryColors[consolidatedName] || 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20';

    return <Badge className={`${colorClass} border`}>{displayName}</Badge>;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading transactions...</div>
      </div>
    );
  }

  const filteredTransactions = getFilteredTransactions;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Transactions</h1>
          <p className="text-gray-600">Your transaction management and categorization overview</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div
            className="bg-white rounded-lg p-5 md:p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-border"
            onClick={() => {
              console.log('Deductible transactions card clicked');
              setActiveTab('deductible');
            }}
          >
            <div className="text-2xl font-semibold text-foreground">${deductibleTotal.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">{deductibleTransactions.length} deductible</div>
          </div>
          <div
            className="bg-white rounded-lg p-5 md:p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-border"
            onClick={() => {
              console.log('Pending transactions card clicked');
              setActiveTab('pending');
            }}
          >
            <div className="text-2xl font-semibold text-foreground">${pendingTotal.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">{pendingTransactions.length} needs review</div>
          </div>
          <div
            className="bg-white rounded-lg p-5 md:p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-border"
            onClick={() => {
              console.log('Potential savings card clicked');
              // Could navigate to reports page or show savings breakdown
            }}
          >
            <div className="text-2xl font-semibold text-foreground">${potentialSavings.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Potential savings</div>
          </div>
          <div
            className="bg-white rounded-lg p-5 md:p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-border"
            onClick={() => {
              console.log('Total transactions card clicked');
              setActiveTab('all');
            }}
          >
            <div className="text-2xl font-semibold text-foreground">{transactions.length}</div>
            <div className="text-sm text-muted-foreground">Total transactions</div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6 border border-border">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date Range Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {dateRange === 'all' ? 'All time' :
                      dateRange === 'today' ? 'Today' :
                        dateRange === 'week' ? 'This week' :
                          dateRange === 'month' ? 'This month' :
                            dateRange === 'quarter' ? 'This quarter' :
                              dateRange === 'year' ? 'This year' :
                                dateRange === 'custom' ? 'Custom range' : 'All time'}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDateRange('all')}>
                  All time
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateRange('today')}>
                  Today
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateRange('week')}>
                  This week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateRange('month')}>
                  This month
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateRange('quarter')}>
                  This quarter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateRange('year')}>
                  This year
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDateRange('custom')}>
                  Custom range
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Custom Date Range Inputs */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => setCustomDateStart(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded"
                  placeholder="Start date"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => setCustomDateEnd(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded"
                  placeholder="End date"
                />
              </div>
            )}

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="text-sm">Sort</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSortBy('date'); setSortOrder('desc'); }}>
                  Date (Newest first)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('date'); setSortOrder('asc'); }}>
                  Date (Oldest first)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('amount'); setSortOrder('desc'); }}>
                  Amount (Highest first)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('amount'); setSortOrder('asc'); }}>
                  Amount (Lowest first)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('merchant'); setSortOrder('asc'); }}>
                  Merchant (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy('merchant'); setSortOrder('desc'); }}>
                  Merchant (Z-A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="relative flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">Filters</span>
                  {activeFiltersCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Category Filter */}
                <div className="px-2 py-1">
                  <div className="text-xs font-medium text-gray-700 mb-1">Category</div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {uniqueCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {consolidateCategory(category).displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DropdownMenuSeparator />

                {/* Amount Range Filter */}
                <div className="px-2 py-1">
                  <div className="text-xs font-medium text-gray-700 mb-1">Amount Range</div>
                  <Select value={amountRange} onValueChange={val => setAmountRange(val as typeof amountRange)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All amounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All amounts</SelectItem>
                      <SelectItem value="under-50">Under $50</SelectItem>
                      <SelectItem value="50-200">$50 - $200</SelectItem>
                      <SelectItem value="200-500">$200 - $500</SelectItem>
                      <SelectItem value="over-500">Over $500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={clearAllFilters} className="text-red-600">
                  Clear all filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
              <span>{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active</span>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={clearAllFilters}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            All ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('deductible')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'deductible'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            Deductible ({deductibleTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'personal'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            Personal ({personalTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            Pending ({pendingTransactions.length})
          </button>
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merchant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      // Navigate to transaction detail screen with source page info
                      router.push(`/protected?screen=transaction-detail&transactionId=${transaction.id}&from=transactions`);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {transaction.merchant_name}
                        </div>
                        {transaction.notes && (
                          <div className="text-sm text-gray-500">{transaction.notes}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {getCategoryBadge(transaction.category)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(transaction)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {transaction.receipt_url ? (
                        <div className="flex items-center justify-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <FileText className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <FileText className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Right Action Buttons */}
        <div className="fixed bottom-6 right-6 flex gap-3">
          <Button
            className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            onClick={() => setShowReceiptModal(true)}
          >
            <Camera className="w-4 h-4 mr-2" />
            Receipt
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            + Add
          </Button>
        </div>

        {/* Add Transaction Modal */}
        <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
          <h2 className="text-lg font-bold mb-4">Add Transaction</h2>
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (!user?.id || !newTransaction.account_id || !newTransaction.category) return;
              const txData = {
                ...newTransaction,
                amount: parseFloat(newTransaction.amount),
                date: new Date().toISOString().slice(0, 10), // Default to today
              };
              await createTransaction(user.id, newTransaction.account_id, txData);
              setShowAddModal(false);
              setNewTransaction({ merchant_name: '', amount: '', category: '', account_id: '' });
            }}
          >
            {/* Account Dropdown */}
            <select
              className="w-full border rounded p-2 mb-2"
              value={newTransaction.account_id}
              onChange={e => setNewTransaction({ ...newTransaction, account_id: e.target.value })}
              required
              disabled={accountsLoading}
            >
              <option value="">Select Account</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.account_id}>
                  {acc.name || acc.account_id}
                </option>
              ))}
            </select>
            {/* Merchant Name */}
            <input
              className="w-full border rounded p-2 mb-2"
              placeholder="Merchant Name"
              value={newTransaction.merchant_name}
              onChange={e => setNewTransaction({ ...newTransaction, merchant_name: e.target.value })}
              required
            />
            {/* Amount */}
            <input
              className="w-full border rounded p-2 mb-2"
              placeholder="Amount"
              type="number"
              value={newTransaction.amount}
              onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
              required
            />
            {/* Category Dropdown */}
            <select
              className="w-full border rounded p-2 mb-4"
              value={newTransaction.category}
              onChange={e => setNewTransaction({ ...newTransaction, category: e.target.value })}
              required
            >
              <option value="">Select Category</option>
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
            </div>
          </form>
        </Modal>

        {/* Receipt Upload Modal */}
        <Modal open={showReceiptModal} onClose={() => setShowReceiptModal(false)}>
          <h2 className="text-lg font-bold mb-4">Upload Receipt</h2>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={e => setReceiptFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            className="mb-4"
          />
          {receiptFile && <div className="mb-2 text-sm">Selected: {receiptFile.name}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowReceiptModal(false)}>Cancel</Button>
            <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowReceiptModal(false)}>Upload</Button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
