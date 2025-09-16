// app/auth/error/page.tsx
import React, { Suspense } from "react";
import Link from "next/link";
import ConfirmClient from "../confirm/ConfirmClient"; // optional: keep if you want to reuse confirm client
import ErrorClient from "./ErrorClient"; // the new client component

export const metadata = {
  title: "Authentication Error",
};

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Authentication Error</h1>
          <p className="text-sm text-muted-foreground mt-2">
            There was an issue with your authentication. See details below.
          </p>
        </div>

        <Suspense fallback={<div>Loading error details…</div>}>
          <ErrorClient />
        </Suspense>

        <div className="mt-8">
          <Link href="/">
            <a className="text-sm underline">Back to home</a>
          </Link>
        </div>
      </div>
    </div>
  );
}
