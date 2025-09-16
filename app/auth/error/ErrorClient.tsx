// app/auth/error/ErrorClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ErrorClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    // Read error details from URL params (example keys: error, error_description, code)
    const err = searchParams?.get("error") ?? searchParams?.get("message") ?? null;
    const errCode = searchParams?.get("code") ?? searchParams?.get("error_code") ?? null;

    if (err) setMessage(err);
    if (errCode) setCode(errCode);
  }, [searchParams]);

  return (
    <div className="rounded-md p-6 bg-card border">
      <h2 className="text-lg font-medium text-foreground mb-2">Sign-in Error</h2>

      {code && (
        <p className="text-sm text-muted-foreground mb-2">
          Error code: <strong className="text-foreground">{code}</strong>
        </p>
      )}

      {message ? (
        <p className="text-sm text-destructive mb-4">{message}</p>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">Unknown authentication error.</p>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => router.push("/auth/sign-in")}>
          Back to Sign in
        </Button>
        <Button onClick={() => router.push("/support")}>Contact Support</Button>
      </div>
    </div>
  );
}
