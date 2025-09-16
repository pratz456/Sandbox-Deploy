// app/auth/login/LoginClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Lightweight client-side login UI that safely uses useSearchParams / useRouter.
 * This intentionally keeps logic local so `page.tsx` can remain a server component.
 *
 * NOTE: This is a minimal, safe implementation to unblock builds. If your project
 * has a custom sign-in form component (e.g. components/sign-in-screen.tsx),
 * you can replace the inner JSX with that component import.
 */

export default function LoginClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Read optional URL params like ?next=/protected or ?message=...
  useEffect(() => {
    const next = searchParams?.get("next");
    const msg = searchParams?.get("message") ?? searchParams?.get("info") ?? null;
    if (msg) setInfo(msg);
    // if there's a `email` query param (prefill)
    const emailParam = searchParams?.get("email");
    if (emailParam) setEmail(emailParam);
    // optionally could store next in state if you want to redirect after sign-in
  }, [searchParams]);

  const handleSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setInfo(null);
    try {
      // Placeholder logic for sign-in. Replace with real auth call if you have one.
      // Example: await fetch('/api/auth/sign-in', { method: 'POST', body: JSON.stringify({ email }) });
      await new Promise((r) => setTimeout(r, 800)); // simulate network

      // On success, redirect to "next" param or protected page
      const next = searchParams?.get("next") || "/protected";
      router.push(next);
    } catch (err) {
      console.error("Sign-in error", err);
      setInfo("Unable to sign in right now. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = (provider: string) => {
    // Replace this with your real OAuth flow (server endpoint) as needed.
    // Example: window.location.href = `/api/auth/oauth/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  return (
    <div className="p-6 bg-card rounded-md border">
      {info && <div className="mb-4 text-sm text-muted-foreground">{info}</div>}

      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            className="w-full bg-input border rounded px-3 py-2"
            required
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <Button variant="ghost" onClick={() => router.push("/auth/forgot-password")}>
            Forgot password
          </Button>
        </div>
      </form>

      <div className="mt-4 border-t pt-4">
        <p className="text-xs text-muted-foreground mb-2">Or sign in with</p>
        <div className="flex gap-2">
          <Button onClick={() => handleOAuthSignIn("google")}>Google</Button>
          <Button onClick={() => handleOAuthSignIn("github")}>GitHub</Button>
        </div>
      </div>
    </div>
  );
}
