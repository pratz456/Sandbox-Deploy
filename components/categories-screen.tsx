"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Search, ChevronDown, ChevronUp, Building, Settings, Info, Home } from 'lucide-react';
import { formatCategory, consolidateCategory } from '@/lib/utils';

const writeOffLogo = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzMzNjZDQyIvPgo8dGV4dCB4PSIxNiIgeT0iMjIiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5XPC90ZXh0Pgo8L3N2Zz4K';

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

interface CategoriesScreenProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      name?: string;
    };
  };
  onBack: () => void;
  transactions: Transaction[];
  onTransactionClick?: (transaction: Transaction) => void;
}



const getCategoryIcon = (category: string) => {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('office') || categoryLower.includes('equipment')) {
    return <Building className="w-5 h-5 text-blue-600" />;
  } else if (categoryLower.includes('software') || categoryLower.includes('tools')) {
    return <Settings className="w-5 h-5 text-purple-600" />;
  } else if (categoryLower.includes('transportation') || categoryLower.includes('travel')) {
    return <Info className="w-5 h-5 text-green-600" />;
  } else if (categoryLower.includes('meals') || categoryLower.includes('entertainment') || categoryLower.includes('food')) {
    return <Home className="w-5 h-5 text-orange-600" />;
  }
  return <Building className="w-5 h-5 text-gray-600" />;
};

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({ 
  user, 
  onBack, 
  transactions,
  onTransactionClick 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showDeductionsTooltip, setShowDeductionsTooltip] = useState(false);
  const [showSavingsTooltip, setShowSavingsTooltip] = useState(false);

  // Filter deductible transactions
  const deductibleTransactions = transactions.filter(t => t.is_deductible === true && t.amount > 0);

  // Debug what we're receiving
  console.log('🏷️ Categories Screen - transactions received:', transactions);
  console.log('🏷️ Categories Screen - transactions length:', transactions.length);
  console.log('🏷️ Categories Screen - sample transaction:', transactions[0]);
  console.log('🏷️ Categories Screen - deductible transactions:', deductibleTransactions);
  console.log('🏷️ Categories Screen - deductible transactions length:', deductibleTransactions.length);
  
  // Debug the filter logic
  const debugTransactions = transactions.slice(0, 5).map(t => ({
    id: t.id.substring(0, 8),
    merchant: t.merchant_name,
    amount: t.amount,
    is_deductible: t.is_deductible,
    category: t.category
  }));
  console.log('🏷️ Categories Screen - first 5 transactions debug:', debugTransactions);

  // Group transactions by consolidated category
  const categoryGroups = deductibleTransactions.reduce((acc, transaction) => {
    const { consolidatedName, displayName } = consolidateCategory(transaction.category);
    
    if (!acc[consolidatedName]) {
      acc[consolidatedName] = {
        displayName,
        transactions: [],
        originalCategories: new Set()
      };
    }
    
    acc[consolidatedName].transactions.push(transaction);
    acc[consolidatedName].originalCategories.add(transaction.category);
    
    return acc;
  }, {} as Record<string, { displayName: string; transactions: Transaction[]; originalCategories: Set<string> }>);

  // Calculate category totals and percentages
  const totalDeductions = deductibleTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const categoryData = Object.entries(categoryGroups).map(([consolidatedName, groupData]) => {
    const totalAmount = groupData.transactions.reduce((sum, t) => sum + t.amount, 0);
    const percentage = totalDeductions > 0 ? (totalAmount / totalDeductions) * 100 : 0;
    const taxSavings = totalAmount * 0.3; // 30% tax rate
    
    return {
      category: consolidatedName,
      displayName: groupData.displayName,
      transactions: groupData.transactions,
      totalAmount,
      percentage,
      taxSavings,
      transactionCount: groupData.transactions.length,
      originalCategories: Array.from(groupData.originalCategories)
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  // Filter categories based on search
  const filteredCategories = categoryData.filter(cat => 
    cat.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.originalCategories.some(orig => formatCategory(orig).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Calculate total tax savings directly from total deductions
  const totalTaxSavings = totalDeductions * 0.30;
  const activeCategories = categoryData.length;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Categories</h1>
          <p className="text-gray-600">Your tax deduction breakdown and category analysis</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 mb-1">${totalDeductions.toFixed(2)}</div>
            <div className="text-sm text-gray-600">{activeCategories} active categories</div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 mb-1">{deductibleTransactions.length}</div>
            <div className="text-sm text-gray-600">Deductible transactions</div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600 mb-1">${totalTaxSavings.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Potential savings</div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 mb-1">{transactions.length}</div>
            <div className="text-sm text-gray-600">Total transactions</div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Category Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
              <div className="col-span-4">CATEGORY</div>
              <div className="col-span-2">TRANSACTIONS</div>
              <div className="col-span-2">TOTAL AMOUNT</div>
              <div className="col-span-2">TAX SAVINGS</div>
              <div className="col-span-2">PERCENTAGE</div>
            </div>
          </div>

          {/* Category Rows */}
          <div className="divide-y divide-gray-200">
            {filteredCategories.map((categoryData) => {
              const isExpanded = expandedCategories.has(categoryData.category);
              
              return (
                <div key={categoryData.category}>
                  <div 
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleCategory(categoryData.category)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          {getCategoryIcon(categoryData.category)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {categoryData.displayName}
                          </div>
                          {categoryData.originalCategories.length > 1 && (
                            <div className="text-xs text-gray-500">
                              {categoryData.originalCategories.length} subcategories
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {categoryData.transactionCount}
                        </span>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="font-semibold text-gray-900">
                          ${categoryData.totalAmount.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="font-semibold text-green-600">
                          ${categoryData.taxSavings.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(categoryData.percentage, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {categoryData.percentage.toFixed(1)}%
                        </span>
                        <button className="ml-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                
                  {/* Expanded Transactions */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      <div className="px-6 py-3">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Transactions in this category</h4>
                        <div className="space-y-1">
                          {categoryData.transactions.map((transaction) => (
                            <div 
                              key={transaction.id} 
                              className="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors"
                              onClick={() => onTransactionClick?.({ ...transaction, _source: 'categories' })}
                            >
                              <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-4 flex items-center gap-3">
                                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <div className="font-medium text-gray-900 text-sm">
                                      {transaction.merchant_name || transaction.description || 'Unknown Merchant'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(transaction.date).toLocaleDateString('en-US', { 
                                        month: '2-digit', day: '2-digit', year: 'numeric'
                                      })} • {formatCategory(transaction.category)}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="col-span-2">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Deductible
                                  </span>
                                </div>
                                
                                <div className="col-span-2">
                                  <div className="font-semibold text-gray-900">
                                    ${transaction.amount.toFixed(2)}
                                  </div>
                                </div>
                                
                                <div className="col-span-2">
                                  <div className="font-semibold text-green-600">
                                    ${(transaction.amount * 0.3).toFixed(2)}
                                  </div>
                                </div>
                                
                                <div className="col-span-2">
                                  <div className="text-xs text-gray-500">
                                    {((transaction.amount / categoryData.totalAmount) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {filteredCategories.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
              <p className="text-gray-600">Try adjusting your search terms</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
