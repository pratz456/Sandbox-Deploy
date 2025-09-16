"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resendEmailVerification, getCurrentUser } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/firebase/auth-context";
import { auth } from "@/lib/firebase/client";

export default function Page() {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { user, loading } = useAuth();

  // Check if user is authenticated and verified, then redirect
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (loading) return; // Wait for auth context to load
      
      try {
        // Get current user from Firebase
        const { data } = await getCurrentUser();
        
        if (data.user) {
          // User is authenticated, check if email is verified
          const currentUser = auth.currentUser;
          
          if (currentUser && currentUser.emailVerified) {
            // User is verified, redirect to protected area
            router.push('/protected');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthAndRedirect();

    // Set up periodic check for email verification (every 3 seconds)
    const interval = setInterval(() => {
      if (!loading) {
        checkAuthAndRedirect();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loading, router]);

  const handleResendVerification = async () => {
    setIsResending(true);
    setError(null);
    
    try {
      const { error } = await resendEmailVerification();
      if (error) {
        setError(error.message);
      } else {
        setResendSuccess(true);
      }
    } catch {
      setError("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth || loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              </div>
              <CardTitle className="text-2xl">Checking verification...</CardTitle>
              <CardDescription>
                Please wait while we check your email verification status
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl">
                Check your email!
              </CardTitle>
              <CardDescription>
                We sent a verification link to your email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ve successfully signed up! Please check your email and click the verification link before signing in.
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 text-center">
                  <strong>Auto-redirect:</strong> Once you verify your email, you&apos;ll be automatically redirected to your dashboard!
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">What's next?</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700">
                      <li>Check your email inbox (and spam folder)</li>
                      <li>Click the verification link</li>
                      <li>Return here to sign in</li>
                    </ol>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {resendSuccess && (
                <p className="text-sm text-green-600 text-center">
                  Verification email sent! Check your inbox.
                </p>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleResendVerification}
                  disabled={isResending || resendSuccess}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? "Sending..." : "Resend verification email"}
                </Button>

                <div className="text-center">
                  <Link
                    href="/auth/login"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Already verified? Sign in →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
