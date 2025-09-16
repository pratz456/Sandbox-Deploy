"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/simple-select';
import {
  ArrowLeft,
  User,
  Mail,
  Briefcase,
  DollarSign,
  MapPin,
  FileText,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  X,
  Home,
  Calculator,
  Plus,
  Trash2,
  Shield
} from 'lucide-react';
import { getUserProfile, upsertUserProfile, UserProfile } from '@/lib/firebase/profiles';

// Simple wrapper for Select components
const SimpleSelectWrapper: React.FC<{
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}> = ({ value, onValueChange, placeholder, options }) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-12 rounded-xl border-2">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface SettingsScreenProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      name?: string;
    };
  };
  onBack: () => void;
  onNavigate: (screen: string) => void;
  inAppNavigation?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  onBack,
  onNavigate,
  inAppNavigation = false
}) => {
  const [profile, setProfile] = useState({
    name: user?.user_metadata?.name || '',
    email: user?.email || '',
    profession: '',
    income: '',
    state: '',
    filing_status: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showWriteOffsModal, setShowWriteOffsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'homeOffice' | 'assets' | 'taxSummary'>('profile');
  const [loadingStates, setLoadingStates] = useState({
    homeOffice: false,
    assets: false,
    taxSummary: false,
  });

  // Home Office Settings
  const [homeOfficeSettings, setHomeOfficeSettings] = useState({
    totalHomeSqFt: '',
    officeSqFt: '',
    rentOrMortgageInterest: '',
    utilities: '',
    insurance: '',
    repairsMaintenance: '',
    propertyTax: '',
    other: '',
  });

  // Assets
  const [assets, setAssets] = useState<any[]>([]);
  const [newAsset, setNewAsset] = useState({
    description: '',
    datePlacedInService: '',
    cost: '',
    businessUsePercent: '100',
    category: 'other',
    method: 'MACRS_5YR',
    section179Requested: false,
    bonusEligible: false,
  });

  // Tax Summary
  const [taxSummary, setTaxSummary] = useState({
    scheduleCNetProfit: '',
    taxYear: new Date().getFullYear().toString(),
    adjustments: '',
  });

  // Load existing profile data
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        console.log('Loading profile for user:', {
          id: user.id,
          email: user.email,
          metadata: user.user_metadata
        });

        // Load profile data first (most important)
        const { data: existingProfile, error } = await getUserProfile(user.id);

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', {
            message: (error as any)?.message,
            code: (error as any)?.code,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            fullError: error
          });
          setErrorMessage('Failed to load profile data');
          return;
        }

        if (existingProfile) {
          setProfile({
            name: existingProfile.name || user?.user_metadata?.name || '',
            email: existingProfile.email || user?.email || '',
            profession: existingProfile.profession || '',
            income: existingProfile.income || '',
            state: existingProfile.state || '',
            filing_status: existingProfile.filing_status || ''
          });
        }

        // Stop loading here for profile tab, load other data in background
        setIsLoading(false);

        // Load additional settings in parallel (non-blocking)
        const loadAdditionalSettings = async () => {
          // Home office settings
          setLoadingStates(prev => ({ ...prev, homeOffice: true }));
          fetch('/api/settings/home-office').then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              if (data) {
                setHomeOfficeSettings({
                  totalHomeSqFt: data.totalHomeSqFt?.toString() || '',
                  officeSqFt: data.officeSqFt?.toString() || '',
                  rentOrMortgageInterest: data.rentOrMortgageInterest?.toString() || '',
                  utilities: data.utilities?.toString() || '',
                  insurance: data.insurance?.toString() || '',
                  repairsMaintenance: data.repairsMaintenance?.toString() || '',
                  propertyTax: data.propertyTax?.toString() || '',
                  other: data.other?.toString() || '',
                });
              }
            }
          }).catch(() => { }).finally(() => {
            setLoadingStates(prev => ({ ...prev, homeOffice: false }));
          });

          // Assets
          setLoadingStates(prev => ({ ...prev, assets: true }));
          fetch('/api/settings/assets').then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              if (data) {
                setAssets(data);
              }
            }
          }).catch(() => { }).finally(() => {
            setLoadingStates(prev => ({ ...prev, assets: false }));
          });

          // Tax summary (with timeout)
          setLoadingStates(prev => ({ ...prev, taxSummary: true }));
          Promise.race([
            fetch('/api/settings/tax-summary'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]).then(async (response: any) => {
            if (response.ok) {
              const { data } = await response.json();
              if (data) {
                setTaxSummary({
                  scheduleCNetProfit: data.scheduleCNetProfit?.toString() || '',
                  taxYear: data.taxYear?.toString() || new Date().getFullYear().toString(),
                  adjustments: data.adjustments?.toString() || '',
                });
              }
            }
          }).catch(() => {
            // Set default tax summary if loading fails
            setTaxSummary({
              scheduleCNetProfit: '',
              taxYear: new Date().getFullYear().toString(),
              adjustments: '',
            });
          }).finally(() => {
            setLoadingStates(prev => ({ ...prev, taxSummary: false }));
          });
        };

        // Load additional settings in background
        loadAdditionalSettings();

      } catch (err) {
        console.error('Error loading data:', err);
        setErrorMessage('Failed to load data');
        setIsLoading(false);
      }
    };

    loadAllData();
  }, [user.id, user?.user_metadata?.name, user?.email]);

  const handleInputChange = (field: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('idle');
      setErrorMessage('');

      console.log('Attempting to save profile for user:', user.id);

      const profileData = {
        user_id: user.id,
        email: profile.email,
        name: profile.name,
        profession: profile.profession,
        income: profile.income,
        state: profile.state,
        filing_status: profile.filing_status
      };

      console.log('Profile data to save:', profileData);

      const { data, error } = await upsertUserProfile(user.id, profileData);

      if (error) {
        console.error('Error saving profile:', {
          message: (error as any)?.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          fullError: error
        });
        setSaveStatus('error');
        setErrorMessage(`Failed to save profile: ${(error as any)?.message || 'Unknown error'}`);
        return;
      }

      console.log('Profile saved successfully:', data);
      setSaveStatus('success');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);

    } catch (err) {
      console.error('Error saving profile (catch block):', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        fullError: err
      });
      setSaveStatus('error');
      setErrorMessage(`Failed to save profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = profile.name && profile.email && profile.profession && profile.income && profile.state && profile.filing_status;

  // Save functions for new settings
  const handleSaveHomeOffice = async () => {
    try {
      setIsSaving(true);
      // Convert string values to numbers for saving
      const numericSettings = {
        totalHomeSqFt: Number(homeOfficeSettings.totalHomeSqFt) || 0,
        officeSqFt: Number(homeOfficeSettings.officeSqFt) || 0,
        rentOrMortgageInterest: Number(homeOfficeSettings.rentOrMortgageInterest) || 0,
        utilities: Number(homeOfficeSettings.utilities) || 0,
        insurance: Number(homeOfficeSettings.insurance) || 0,
        repairsMaintenance: Number(homeOfficeSettings.repairsMaintenance) || 0,
        propertyTax: Number(homeOfficeSettings.propertyTax) || 0,
        other: Number(homeOfficeSettings.other) || 0,
      };

      const response = await fetch('/api/settings/home-office', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(numericSettings),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Failed to save home office settings');
      }
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage('Failed to save home office settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAssets = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/settings/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets }),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Failed to save assets');
      }
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage('Failed to save assets');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTaxSummary = async () => {
    try {
      setIsSaving(true);
      // Convert string values to numbers for saving
      const numericSettings = {
        scheduleCNetProfit: Number(taxSummary.scheduleCNetProfit) || 0,
        taxYear: Number(taxSummary.taxYear) || new Date().getFullYear(),
        adjustments: Number(taxSummary.adjustments) || 0,
      };

      const response = await fetch('/api/settings/tax-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(numericSettings),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Failed to save tax summary');
      }
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage('Failed to save tax summary');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAsset = () => {
    if (!newAsset.description || !newAsset.cost || !newAsset.datePlacedInService) {
      setSaveStatus('error');
      setErrorMessage('Please fill in all required asset fields');
      return;
    }

    const asset = {
      id: Date.now().toString(),
      ...newAsset,
      cost: Number(newAsset.cost) || 0,
      businessUsePercent: Number(newAsset.businessUsePercent) || 100,
      datePlacedInService: new Date(newAsset.datePlacedInService),
    };

    setAssets([...assets, asset]);
    setNewAsset({
      description: '',
      datePlacedInService: '',
      cost: '',
      businessUsePercent: '100',
      category: 'other',
      method: 'MACRS_5YR',
      section179Requested: false,
      bonusEligible: false,
    });

    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleRemoveAsset = (assetId: string) => {
    setAssets(assets.filter(asset => asset.id !== assetId));
  };

  const handleRefreshScheduleC = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/tax/schedule-c/calculate');
      if (response.ok) {
        const { data } = await response.json();
        if (data && data.netProfit !== undefined) {
          setTaxSummary(prev => ({
            ...prev,
            scheduleCNetProfit: data.netProfit.toString(),
          }));
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
        }
      } else {
        throw new Error('Failed to calculate Schedule C');
      }
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage('Failed to refresh Schedule C data');
    } finally {
      setIsSaving(false);
    }
  };

  const incomeOptions = [
    { value: 'under_25k', label: 'Under $25,000' },
    { value: '25k_50k', label: '$25,000 - $50,000' },
    { value: '50k_75k', label: '$50,000 - $75,000' },
    { value: '75k_100k', label: '$75,000 - $100,000' },
    { value: '100k_150k', label: '$100,000 - $150,000' },
    { value: '150k_250k', label: '$150,000 - $250,000' },
    { value: 'over_250k', label: 'Over $250,000' }
  ];

  const stateOptions = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' }
  ];

  const filingStatusOptions = [
    { value: 'single', label: 'Single' },
    { value: 'married_jointly', label: 'Married Filing Jointly' },
    { value: 'married_separately', label: 'Married Filing Separately' },
    { value: 'head_of_household', label: 'Head of Household' },
    { value: 'qualifying_widow', label: 'Qualifying Widow(er)' }
  ];

  const professionOptions = [
    { value: 'software_engineer', label: 'Software Engineer' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'freelancer', label: 'Freelancer' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'real_estate_agent', label: 'Real Estate Agent' },
    { value: 'insurance_agent', label: 'Insurance Agent' },
    { value: 'financial_advisor', label: 'Financial Advisor' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'lawyer', label: 'Lawyer' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'dentist', label: 'Dentist' },
    { value: 'therapist', label: 'Therapist' },
    { value: 'photographer', label: 'Photographer' },
    { value: 'designer', label: 'Designer' },
    { value: 'writer', label: 'Writer' },
    { value: 'marketing', label: 'Marketing Professional' },
    { value: 'sales', label: 'Sales Professional' },
    { value: 'teacher', label: 'Teacher/Educator' },
    { value: 'coach', label: 'Coach/Trainer' },
    { value: 'artist', label: 'Artist' },
    { value: 'musician', label: 'Musician' },
    { value: 'content_creator', label: 'Content Creator' },
    { value: 'influencer', label: 'Influencer' },
    { value: 'ecommerce', label: 'E-commerce Business Owner' },
    { value: 'restaurant_owner', label: 'Restaurant Owner' },
    { value: 'retail_owner', label: 'Retail Business Owner' },
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'tradesperson', label: 'Tradesperson' },
    { value: 'other', label: 'Other' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading profile settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between p-6">
          {/* <button 
            onClick={onBack}
            className="w-12 h-12 bg-white border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button> */}
          <div className="w-full flex flex-col items-center">
            <h2 className="text-4xl font-bold text-primary mb-2 text-center">Settings</h2>
            <p className="text-lg text-muted-foreground text-center">Manage your profile and preferences</p>
          </div>
          <div className="w-12"></div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Save Status Messages */}
        {saveStatus === 'success' && (
          <Card className="p-4 bg-accent/5 border-accent/20 shadow-sm mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-accent" />
              <div>
                <p className="text-accent font-medium">Settings Updated Successfully</p>
                <p className="text-accent/80 text-sm">Your changes have been saved.</p>
              </div>
            </div>
          </Card>
        )}

        {saveStatus === 'error' && (
          <Card className="p-4 bg-red-50 border-red-200 shadow-sm mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="text-red-800 font-medium">Save Failed</p>
                <p className="text-red-600 text-sm">{errorMessage}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'profile'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('homeOffice')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'homeOffice'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {loadingStates.homeOffice ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Home className="w-4 h-4" />
            )}
            Home Office
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'assets'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {loadingStates.assets ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            Assets
          </button>
          <button
            onClick={() => setActiveTab('taxSummary')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'taxSummary'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {loadingStates.taxSummary ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Tax Summary
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card className="p-8 bg-white border border-border shadow-lg">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-medium text-foreground mb-2">Profile Settings</h2>
              <p className="text-muted-foreground">Update your personal information and tax preferences</p>
            </div>

            <div className="space-y-6">
              {/* Personal Information Section */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={profile.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter your full name"
                      className="h-12 rounded-lg border-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter your email"
                      className="h-12 rounded-lg border-2"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Information Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  Professional Information
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Profession
                  </label>
                  <SimpleSelectWrapper
                    value={profile.profession}
                    onValueChange={(value: string) => handleInputChange('profession', value)}
                    placeholder="Select your profession"
                    options={professionOptions}
                  />
                </div>
              </div>

              {/* Tax Information Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Tax Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Annual Income
                    </label>
                    <SimpleSelectWrapper
                      value={profile.income}
                      onValueChange={(value: string) => handleInputChange('income', value)}
                      placeholder="Select income range"
                      options={incomeOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      State
                    </label>
                    <SimpleSelectWrapper
                      value={profile.state}
                      onValueChange={(value: string) => handleInputChange('state', value)}
                      placeholder="Select your state"
                      options={stateOptions}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Filing Status
                    </label>
                    <SimpleSelectWrapper
                      value={profile.filing_status}
                      onValueChange={(value: string) => handleInputChange('filing_status', value)}
                      placeholder="Select filing status"
                      options={filingStatusOptions}
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t border-slate-200">
                <div className="flex gap-4">
                  <Button
                    onClick={handleSave}
                    disabled={!isFormValid || isSaving}
                    className="flex-1 h-14 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all duration-200 shadow-sm text-base font-medium"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={onBack}
                    variant="outline"
                    className="h-14 px-8 rounded-lg border-2"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Home Office Tab */}
        {activeTab === 'homeOffice' && (
          <Card className="p-8 bg-white border border-border shadow-lg">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <Home className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-medium text-foreground mb-2">Home Office Settings</h2>
              <p className="text-muted-foreground">Configure your home office information for Form 8829</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalHomeSqFt" required>Total Home Square Footage</Label>
                  <Input
                    id="totalHomeSqFt"
                    type="number"
                    value={homeOfficeSettings.totalHomeSqFt}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      totalHomeSqFt: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="officeSqFt" required>Office Square Footage</Label>
                  <Input
                    id="officeSqFt"
                    type="number"
                    value={homeOfficeSettings.officeSqFt}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      officeSqFt: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="rentOrMortgageInterest" required>Rent or Mortgage Interest</Label>
                  <Input
                    id="rentOrMortgageInterest"
                    type="number"
                    value={homeOfficeSettings.rentOrMortgageInterest}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      rentOrMortgageInterest: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="utilities" required>Utilities</Label>
                  <Input
                    id="utilities"
                    type="number"
                    value={homeOfficeSettings.utilities}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      utilities: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="insurance" required>Insurance</Label>
                  <Input
                    id="insurance"
                    type="number"
                    value={homeOfficeSettings.insurance}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      insurance: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="repairsMaintenance" required>Repairs & Maintenance</Label>
                  <Input
                    id="repairsMaintenance"
                    type="number"
                    value={homeOfficeSettings.repairsMaintenance}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      repairsMaintenance: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="propertyTax" required>Property Tax</Label>
                  <Input
                    id="propertyTax"
                    type="number"
                    value={homeOfficeSettings.propertyTax}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      propertyTax: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="other" required>Other Expenses</Label>
                  <Input
                    id="other"
                    type="number"
                    value={homeOfficeSettings.other}
                    onChange={(e) => setHomeOfficeSettings({
                      ...homeOfficeSettings,
                      other: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <Button
                  onClick={handleSaveHomeOffice}
                  disabled={isSaving}
                  className="w-full h-14 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all duration-200 shadow-sm text-base font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Home Office Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <Card className="p-8 bg-white border border-border shadow-lg">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-medium text-foreground mb-2">Business Assets</h2>
              <p className="text-muted-foreground">Manage your business assets for Form 4562 depreciation calculations</p>
            </div>

            <div className="space-y-6">
              {/* Add New Asset Form */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-medium mb-4">Add New Asset</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="assetDescription">Description</Label>
                    <Input
                      id="assetDescription"
                      value={newAsset.description}
                      onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                      placeholder="e.g., MacBook Pro"
                      className="h-12 rounded-lg border-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="assetDate">Date Placed in Service</Label>
                    <Input
                      id="assetDate"
                      type="date"
                      value={newAsset.datePlacedInService}
                      onChange={(e) => setNewAsset({ ...newAsset, datePlacedInService: e.target.value })}
                      className="h-12 rounded-lg border-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="assetCost">Cost</Label>
                    <Input
                      id="assetCost"
                      type="number"
                      value={newAsset.cost}
                      onChange={(e) => setNewAsset({ ...newAsset, cost: e.target.value })}
                      className="h-12 rounded-lg border-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="assetBusinessUse">Business Use %</Label>
                    <Input
                      id="assetBusinessUse"
                      type="number"
                      min="0"
                      max="100"
                      value={newAsset.businessUsePercent}
                      onChange={(e) => setNewAsset({ ...newAsset, businessUsePercent: e.target.value })}
                      className="h-12 rounded-lg border-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="assetCategory">Category</Label>
                    <SimpleSelectWrapper
                      value={newAsset.category}
                      onValueChange={(value) => setNewAsset({ ...newAsset, category: value })}
                      placeholder="Select category"
                      options={[
                        { value: 'computer', label: 'Computer' },
                        { value: 'furniture', label: 'Furniture' },
                        { value: 'vehicle', label: 'Vehicle' },
                        { value: 'equipment', label: 'Equipment' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="assetMethod">Depreciation Method</Label>
                    <SimpleSelectWrapper
                      value={newAsset.method}
                      onValueChange={(value) => setNewAsset({ ...newAsset, method: value })}
                      placeholder="Select method"
                      options={[
                        { value: 'MACRS_5YR', label: 'MACRS 5-Year' },
                        { value: 'MACRS_7YR', label: 'MACRS 7-Year' },
                        { value: 'SL', label: 'Straight Line' },
                      ]}
                    />
                  </div>
                </div>
                <div className="flex gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="section179"
                      checked={newAsset.section179Requested}
                      onCheckedChange={(checked) => setNewAsset({ ...newAsset, section179Requested: !!checked })}
                    />
                    <Label htmlFor="section179">Section 179 Requested</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="bonusEligible"
                      checked={newAsset.bonusEligible}
                      onCheckedChange={(checked) => setNewAsset({ ...newAsset, bonusEligible: !!checked })}
                    />
                    <Label htmlFor="bonusEligible">Bonus Depreciation Eligible</Label>
                  </div>
                </div>
                <Button onClick={handleAddAsset} className="bg-primary hover:bg-primary-hover text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              </div>

              {/* Assets List */}
              {assets.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Your Assets ({assets.length})</h3>
                  {assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{asset.description}</div>
                        <div className="text-sm text-gray-500">
                          ${asset.cost.toLocaleString()} • {asset.businessUsePercent}% business use • {asset.category}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAsset(asset.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-6 border-t border-slate-200">
                <Button
                  onClick={handleSaveAssets}
                  disabled={isSaving || assets.length === 0}
                  className="w-full h-14 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all duration-200 shadow-sm text-base font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Assets
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tax Summary Tab */}
        {activeTab === 'taxSummary' && (
          <Card className="p-8 bg-white border border-border shadow-lg">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-medium text-foreground mb-2">Tax Summary Settings</h2>
              <p className="text-muted-foreground">Configure your tax summary for Schedule SE calculations</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="scheduleCNetProfit">Schedule C Net Profit</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshScheduleC}
                      disabled={isSaving}
                      className="text-xs"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-3 h-3 mr-1" />
                          Auto-calculate
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    id="scheduleCNetProfit"
                    type="number"
                    value={taxSummary.scheduleCNetProfit}
                    onChange={(e) => setTaxSummary({
                      ...taxSummary,
                      scheduleCNetProfit: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                    placeholder="Auto-calculated from transactions"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Calculated from your {new Date().getFullYear()} transactions
                  </p>
                </div>
                <div>
                  <Label htmlFor="taxYear">Tax Year</Label>
                  <Input
                    id="taxYear"
                    type="number"
                    value={taxSummary.taxYear}
                    onChange={(e) => setTaxSummary({
                      ...taxSummary,
                      taxYear: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                  />
                </div>
                <div>
                  <Label htmlFor="adjustments">Adjustments</Label>
                  <Input
                    id="adjustments"
                    type="number"
                    value={taxSummary.adjustments}
                    onChange={(e) => setTaxSummary({
                      ...taxSummary,
                      adjustments: e.target.value
                    })}
                    className="h-12 rounded-lg border-2"
                    placeholder="Enter any adjustments"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Additional adjustments to net profit (if any)
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <Button
                  onClick={handleSaveTaxSummary}
                  disabled={isSaving}
                  className="w-full h-14 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all duration-200 shadow-sm text-base font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Tax Summary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Additional Settings */}
        <Card className="p-6 bg-white border border-border shadow-lg mt-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Bank Account Management</h3>
          <div className="space-y-4">
            <Button
              type="button"
              onClick={() => onNavigate('plaid-link')}
              className="w-full h-14 bg-accent hover:bg-accent/90 text-white rounded-lg flex items-center justify-center gap-3"
            >
              <DollarSign className="w-5 h-5" />
              Connect Bank Account with Plaid
            </Button>
            <Button
              type="button"
              onClick={() => onNavigate('plaid')}
              variant="outline"
              className="w-full h-12 justify-center gap-3 rounded-lg"
            >
              <DollarSign className="w-4 h-4" />
              Manage Connected Accounts
            </Button>
          </div>
        </Card>

        {/* Data Rights Portal */}
        <Card className="p-6 bg-white border border-border shadow-lg mt-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Data Rights & Privacy</h3>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>You have the right to view, export, and delete your data, and to revoke access to your bank data at any time.</p>
            </div>
            <Button
              onClick={async () => {
                try {
                  const res = await fetch('/api/user/export');
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'writeoffapp-user-data.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } else {
                    alert('Failed to export data.');
                  }
                } catch (err) {
                  alert('Failed to export data.');
                }
              }}
              variant="outline"
              className="w-full h-12 justify-center gap-3 rounded-lg"
            >
              <FileText className="w-4 h-4" />
              View / Export My Data
            </Button>
            <Button
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete your account and all associated data? This action cannot be undone.')) {
                  try {
                    const res = await fetch('/api/user/delete', { method: 'DELETE' });
                    const result = await res.json();
                    if (result.success) {
                      alert('Your account and data have been deleted. You will be logged out.');
                      window.location.href = '/';
                    } else {
                      alert('Failed to delete account: ' + (result.error || 'Unknown error'));
                    }
                  } catch (err) {
                    alert('Failed to delete account.');
                  }
                }
              }}
              variant="destructive"
              className="w-full h-12 justify-center gap-3 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete My Account & Data
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full h-12 justify-center gap-3 rounded-lg"
            >
              <a href="https://my.plaid.com/" target="_blank" rel="noopener noreferrer">
                <Shield className="w-4 h-4" />
                Revoke Plaid Access (Plaid Portal)
              </a>
            </Button>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 bg-white border border-border shadow-lg mt-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={() => setShowWriteOffsModal(true)}
              className="h-12 justify-start gap-3 bg-primary hover:bg-primary-hover text-white"
            >
              <BookOpen className="w-4 h-4" />
              Learn about write-offs
            </Button>
            <Button
              onClick={() => onNavigate('dashboard')}
              variant="outline"
              className="h-12 justify-start gap-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>

      {/* Write-offs Educational Modal */}
      {showWriteOffsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">Learn About Tax Write-offs</h2>
              <button
                onClick={() => setShowWriteOffsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Introduction */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-blue-900 mb-3">What are Tax Write-offs?</h3>
                <p className="text-blue-800">
                  Tax write-offs (also called deductions) are legitimate business expenses that reduce your taxable income.
                  As a freelancer or business owner, you can deduct ordinary and necessary expenses related to your work,
                  potentially saving you 20-30% of those costs in taxes.
                </p>
              </div>

              {/* Common Deductible Expenses */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">✅ Common Deductible Expenses</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Office & Equipment</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Computer, software, and tech equipment</li>
                      <li>• Office supplies and furniture</li>
                      <li>• Internet and phone bills (business portion)</li>
                      <li>• Home office expenses</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Professional Services</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Legal and accounting fees</li>
                      <li>• Business consulting</li>
                      <li>• Professional development courses</li>
                      <li>• Industry conferences and workshops</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Travel & Transportation</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Business travel (flights, hotels)</li>
                      <li>• Mileage for business trips</li>
                      <li>• Parking and tolls</li>
                      <li>• Uber/Lyft for business purposes</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Business Operations</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Marketing and advertising</li>
                      <li>• Business insurance</li>
                      <li>• Bank fees and merchant processing</li>
                      <li>• Business licenses and permits</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Meals - Special Rules */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-yellow-800 mb-3">🍽️ Business Meals - Special Rules</h3>
                <p className="text-yellow-700 mb-3">
                  Business meals are generally 50% deductible, but there are exceptions:
                </p>
                <ul className="text-sm text-yellow-700 space-y-2">
                  <li>• <strong>Client meetings:</strong> 50% deductible when discussing business</li>
                  <li>• <strong>Team meals:</strong> 50% deductible for employee meals</li>
                  <li>• <strong>Office snacks:</strong> 100% deductible for office-provided food</li>
                  <li>• <strong>Travel meals:</strong> 50% deductible when traveling for business</li>
                </ul>
              </div>

              {/* Non-Deductible Expenses */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">❌ Generally NOT Deductible</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <ul className="text-sm text-red-700 space-y-2">
                    <li>• Personal groceries and household items</li>
                    <li>• Personal clothing (unless it's a uniform)</li>
                    <li>• Personal entertainment and hobbies</li>
                    <li>• Commuting to your regular workplace</li>
                    <li>• Personal insurance and medical expenses</li>
                    <li>• Personal credit card interest</li>
                    <li>• Fines and penalties</li>
                  </ul>
                </div>
              </div>

              {/* Key Requirements */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">📋 Key Requirements for Deductions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">1. Ordinary & Necessary</h4>
                    <p className="text-sm text-gray-600">
                      The expense must be common and accepted in your industry, and helpful for your business.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">2. Business Purpose</h4>
                    <p className="text-sm text-gray-600">
                      The expense must be directly related to your business activities, not personal use.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">3. Keep Records</h4>
                    <p className="text-sm text-gray-600">
                      Maintain receipts, invoices, and records showing the business purpose and amount.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">4. Reasonable Amount</h4>
                    <p className="text-sm text-gray-600">
                      The expense amount should be reasonable and not excessive for the business benefit.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-blue-800 mb-3">💡 Pro Tips</h3>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Track everything:</strong> Use WriteOff to automatically categorize your expenses</li>
                  <li>• <strong>Mixed-use items:</strong> Only deduct the business portion (e.g., 70% of home internet if 70% is for business)</li>
                  <li>• <strong>When in doubt:</strong> Consult with a tax professional</li>
                  <li>• <strong>Stay organized:</strong> Keep digital copies of all receipts and invoices</li>
                  <li>• <strong>Be conservative:</strong> Only claim legitimate business expenses</li>
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-700">
                  <strong>Disclaimer:</strong> This information is for educational purposes only and should not be considered tax advice.
                  Tax laws vary by location and situation. Always consult with a qualified tax professional for advice specific to your circumstances.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
