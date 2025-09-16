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
import { useState } from "react";
import { resendEmailVerification } from "@/lib/firebase/auth";

export default function Page() {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
