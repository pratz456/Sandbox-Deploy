// app/auth/confirm/ConfirmClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ConfirmClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams?.get("token") || searchParams?.get("oobCode") || null;
    const mode = searchParams?.get("mode") || null;

    // If no token, show an error
    if (!token) {
      setStatus("error");
      setMessage("Missing confirmation token. Please check the link in your email.");
      return;
    }

    // Example: call your confirm API endpoint or Firebase verify function
    // This is a placeholder; replace with your real API call if needed.
    async function confirmAccount() {
      try {
        setStatus("loading");
        // Example call:
        // const res = await fetch(`/api/auth/confirm?token=${encodeURIComponent(token)}&mode=${encodeURIComponent(mode || "")}`, { method: "POST" });
        // const data = await res.json();
        // simulate network delay
        await new Promise((r) => setTimeout(r, 800));
        // Pretend success:
        setStatus("success");
        setMessage("Your account has been confirmed. Redirecting to sign in…");
        setTimeout(() => {
          router.push("/auth/sign-in");
        }, 1200);
      } catch (err) {
        console.error("Confirm error", err);
        setStatus("error");
        setMessage("Something went wrong when confirming your account. Try again or contact support.");
      }
    }

    confirmAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="rounded-md p-6 bg-card border">
      {status === "loading" && <p className="text-sm text-muted-foreground">Confirming your account...</p>}
      {status === "success" && <p className="text-sm text-foreground">{message}</p>}
      {status === "error" && (
        <>
          <p className="text-sm text-destructive mb-4">{message}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/auth/resend-confirmation")}>
              Resend confirmation email
            </Button>
            <Button onClick={() => router.push("/support")}>Contact Support</Button>
          </div>
        </>
      )}
      {status === "idle" && (
        <>
          <p className="text-sm text-muted-foreground">Preparing confirmation…</p>
          <div className="mt-4">
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </>
      )}
    </div>
  );
}
