import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/simple-select';
import { User, Briefcase, MapPin, FileText, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { upsertUserProfile } from '@/lib/firebase/profiles';
import { PlaidLinkScreen } from './plaid-link-screen';

interface UserProfile {
  email: string;
  name: string;
  yearOfBirth: string;
  profession: string;
  income: string;
  state: string;
  filingStatus: string;
  plaidToken?: string;
}

interface ProfileSetupScreenProps {
  user: any;
  onBack: () => void;
  onComplete: (profile: UserProfile, redirectTo?: string) => void;
}

const professions = [
  'Software Developer', 'Freelance Writer', 'Graphic Designer', 'Consultant', 'Marketing Specialist',
  'Real Estate Agent', 'Photographer', 'Web Designer', 'Content Creator', 'Business Coach',
  'Virtual Assistant', 'Social Media Manager', 'Online Tutor', 'E-commerce Store Owner', 'Other'
];

const incomeRanges = [
  'Under $11,600', '$11,600 - $47,150', '$47,150 - $100,525', '$100,525 - $191,950',
  '$191,950 - $243,725', '$243,725 - $609,350', 'Over $609,350'
];

const usStates = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const filingStatuses = [
  'Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household', 'Qualifying Widower'
];

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({ user, onBack, onComplete }) => {
  const [currentStep, setCurrentStep] = useState<'profile' | 'plaid'>('profile');
  const [formData, setFormData] = useState<UserProfile>({
    email: user?.email || '',
    name: user?.user_metadata?.name || '',
    yearOfBirth: '',
    profession: '',
    income: '',
    state: '',
    filingStatus: '',
    plaidToken: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  const isFormValid = formData.email && formData.name && formData.yearOfBirth && formData.profession && 
                    formData.income && formData.state && formData.filingStatus;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Save profile to Firebase using the database service
      const { data, error: profileError } = await upsertUserProfile(user.id, {
        email: formData.email,
        name: formData.name,
        year_of_birth: formData.yearOfBirth,
        profession: formData.profession,
        income: formData.income,
        state: formData.state,
        filing_status: formData.filingStatus,
        plaid_token: formData.plaidToken
      });

      if (profileError) {
        console.error('Profile save error details:', profileError);
        let errorMessage = 'Failed to save profile';
        
        if (typeof profileError === 'string') {
          errorMessage = profileError;
        } else if (profileError?.message) {
          errorMessage = profileError.message;
        } else if (profileError?.code) {
          errorMessage = `Error: ${profileError.code}`;
        }
        
        throw new Error(errorMessage);
      }

      console.log('Profile saved successfully:', data);
      // Move to Plaid connection step
      setCurrentStep('plaid');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      
      // Run database test to help diagnose the issue
      try {
        const response = await fetch('/api/test-db');
        const testResult = await response.json();
        console.log('Database test result:', testResult);
      } catch (testError) {
        console.error('Database test failed:', testError);
      }
      
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaidSuccess = () => {
    // Complete the entire onboarding flow and redirect to review transactions
    onComplete(formData, 'review-transactions');
  };

  const handlePlaidBack = () => {
    setCurrentStep('profile');
  };

  const handleCreateTable = async () => {
    setIsCreatingTable(true);
    try {
      const response = await fetch('/api/create-table', { method: 'POST' });
      const result = await response.json();
      console.log('Table creation result:', result);
      
      if (result.success || result.tableTest?.works) {
        setError(null);
        alert('Database table created successfully! Please try saving your profile again.');
      } else {
        setError(`Failed to create database table: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error creating table:', err);
      setError(`Failed to create database table: ${err.message}`);
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Show Plaid Link screen if profile is complete
  if (currentStep === 'plaid') {
    return (
      <PlaidLinkScreen
        user={user}
        onSuccess={handlePlaidSuccess}
        onBack={handlePlaidBack}
      />
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
            <h1 className="text-lg font-medium text-foreground">Complete Your <span className="text-primary font-medium">Profile</span></h1>
            <p className="text-xs text-muted-foreground">Help us personalize your <span className="font-medium text-primary">tax experience</span></p>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="p-4 pb-20 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-white font-medium text-xs">1</div>
            <div className="w-12 h-1 bg-primary rounded-full"></div>
            <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center text-muted-foreground font-medium text-xs">2</div>
            <div className="w-12 h-1 bg-muted rounded-full"></div>
            <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center text-muted-foreground font-medium text-xs">3</div>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            <span className="font-medium text-primary">Step 1 of 3:</span> Personal Information
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <p className="text-red-800 text-sm">{error}</p>
            {error.includes('Failed to save profile') && (
              <div className="pt-2 border-t border-red-200">
                <p className="text-red-700 text-xs mb-2">
                  This might be a database setup issue. Try creating the required table:
                </p>
                <Button
                  onClick={handleCreateTable}
                  disabled={isCreatingTable}
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  {isCreatingTable ? 'Creating Table...' : 'Setup Database Table'}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Basic Information */}
          <Card className="p-4 bg-white border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Basic <span className="text-primary font-medium">Information</span></h3>
                <p className="text-xs text-muted-foreground">Your personal details</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <Mail className="w-3 h-3 text-primary" />
                  Email Address <span className="text-red-600 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="h-10 text-sm rounded-lg border border-border bg-muted/30 text-foreground cursor-not-allowed pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Verified email address</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <User className="w-3 h-3 text-primary" />
                  Full Name <span className="text-red-600 ml-0.5">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  className="h-10 text-sm rounded-lg border border-border focus:border-primary bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Year of Birth <span className="text-red-600 ml-0.5">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.yearOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, yearOfBirth: e.target.value }))}
                  placeholder="1990"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="h-10 text-sm rounded-lg border border-border focus:border-primary bg-white"
                />
                <p className="text-xs text-muted-foreground mt-1">Used for age-based deductions and retirement limits</p>
              </div>
            </div>
          </Card>

          {/* Professional Details */}
          <Card className="p-4 bg-white border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Professional <span className="text-emerald-600 font-medium">Details</span></h3>
                <p className="text-xs text-muted-foreground">Work and income info</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <Briefcase className="w-3 h-3 text-emerald-600" />
                  Profession <span className="text-red-600 ml-0.5">*</span>
                </label>
                <Select value={formData.profession} onValueChange={(value: string) => setFormData(prev => ({ ...prev, profession: value }))}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border border-border focus:border-emerald-500 bg-white">
                    <SelectValue placeholder="Select your profession" />
                  </SelectTrigger>
                  <SelectContent>
                    {professions.map((profession) => (
                      <SelectItem key={profession} value={profession}>
                        {profession}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <FileText className="w-3 h-3 text-emerald-600" />
                  Annual Income Range <span className="text-red-600 ml-0.5">*</span>
                </label>
                <Select value={formData.income} onValueChange={(value: string) => setFormData(prev => ({ ...prev, income: value }))}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border border-border focus:border-emerald-500 bg-white">
                    <SelectValue placeholder="Select your income range" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeRanges.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Tax Information */}
          <Card className="p-4 bg-white border border-border shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Tax <span className="text-purple-600 font-medium">Information</span></h3>
                <p className="text-xs text-muted-foreground">Details for accurate tax calculations</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-purple-600" />
                  State of Residence <span className="text-red-600 ml-0.5">*</span>
                </label>
                <Select value={formData.state} onValueChange={(value: string) => setFormData(prev => ({ ...prev, state: value }))}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border border-border focus:border-purple-500 bg-white">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {usStates.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <FileText className="w-3 h-3 text-purple-600" />
                  Filing Status <span className="text-red-600 ml-0.5">*</span>
                </label>
                <Select value={formData.filingStatus} onValueChange={(value: string) => setFormData(prev => ({ ...prev, filingStatus: value }))}>
                  <SelectTrigger className="h-10 text-sm rounded-lg border border-border focus:border-purple-500 bg-white">
                    <SelectValue placeholder="Select your filing status" />
                  </SelectTrigger>
                  <SelectContent>
                    {filingStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        <div className="pt-6">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full h-12 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center gap-3 disabled:opacity-50 text-base font-medium"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Setting up your profile...</span>
              </>
            ) : (
              <>
                <span>Continue to Bank Connection</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
