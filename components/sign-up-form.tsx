"use client";

import { cn } from "@/lib/utils";
import { signUpUser } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import writeOffLogo from '@/public/writeofflogo.png';
import Image from 'next/image';
import { Eye, EyeOff } from "lucide-react";
import { validatePassword } from "@/lib/utils/passwordValidation";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Consent checkboxes
  const [bankConsent, setBankConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [commConsent, setCommConsent] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
    const validation = validatePassword(newPassword);
    setPasswordErrors(validation.errors);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError("Please fix the password requirements below");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await signUpUser(email, password);
      if (error) throw new Error(error.message);
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = email && password && confirmPassword && password === confirmPassword && passwordErrors.length === 0 && bankConsent && aiConsent;

  return (
    <div className="min-h-screen bg-background">
      {/* Background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/20"></div>
      
      <div className="relative min-h-screen flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Header */}
          <div className="text-center space-y-6 mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
            
            <div className="flex justify-center">
              <Image src={writeOffLogo} alt="WriteOff" className="w-32 h-auto"/>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">
                Create your account
              </h1>
              <p className="text-muted-foreground">
                Start maximizing your tax deductions today
              </p>
            </div>
          </div>

          {/* Sign up form */}
          <div className="bg-card/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-gray-900/5 ring-1 ring-border p-8">
            {/* Notice at Collection */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              <strong>Notice at Collection:</strong> We collect your name, email, password, and, after signup, your bank transactions, employer/workstyle answers, and state. This information is used to provide tax deduction analysis, generate reports, and personalize your experience. See our <a href="/privacy" className="underline text-blue-700" target="_blank" rel="noopener noreferrer">Privacy Policy</a> for details.
            </div>
            <form onSubmit={handleSignUp} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-foreground" required>
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="mt-2 h-12 rounded-xl border-border bg-input-background focus:border-primary focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-foreground" required>
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="Create a strong password (min 10 chars, 1 uppercase, 1 special char)"
                      className="mt-2 h-12 rounded-xl border-border bg-input-background focus:border-primary focus:ring-primary/20 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {passwordErrors.map((error, index) => (
                        <p key={index} className="text-sm text-destructive">
                          • {error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground" required>
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="mt-2 h-12 rounded-xl border-border bg-input-background focus:border-primary focus:ring-primary/20 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-sm text-destructive">Passwords don't match</p>
                  )}
                </div>
              </div>


              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Explicit Consents */}
              <div className="space-y-3 bg-muted/40 border border-border rounded-xl p-4">
                <div className="flex items-start gap-2">
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
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="aiConsent"
                    checked={aiConsent}
                    onChange={e => setAiConsent(e.target.checked)}
                    className="mt-1"
                    required
                  />
                  <label htmlFor="aiConsent" className="text-xs text-foreground">
                    I understand that WriteOff uses automated (AI) analysis to help identify tax deductions. I may request a human review and can opt out of model improvement if offered in the future.
                    <span className="text-red-600 ml-0.5">*</span>
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="commConsent"
                    checked={commConsent}
                    onChange={e => setCommConsent(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="commConsent" className="text-xs text-foreground">
                    I consent to receive communications about my account, product updates, and support via email or SMS.
                  </label>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">What happens next?</p>
                    <p>After creating your account, you'll set up your profile with basic information to personalize your tax optimization experience.</p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            {/* Sign in link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
