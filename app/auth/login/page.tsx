// app/auth/login/page.tsx
import React, { Suspense } from "react";
import Link from "next/link";

import LoginClient from "./LoginClient"; // client component we add below

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-foreground">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to access your WriteOff account
          </p>
        </div>

        {/* Client-only login UI inside Suspense */}
        <Suspense fallback={<div className="p-6 bg-card rounded">Loading sign-in…</div>}>
          <LoginClient />
        </Suspense>

        <div className="mt-6 text-center">
          <Link href="/auth/sign-up">
            <a className="text-sm underline">Don't have an account? Sign up</a>
          </Link>
        </div>
      </div>
    </div>
  );
}
