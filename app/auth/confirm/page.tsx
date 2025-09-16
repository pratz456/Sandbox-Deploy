// app/auth/confirm/page.tsx
import React, { Suspense } from "react";
import Link from "next/link";
import ConfirmClient from "./ConfirmClient"; // direct import of client component

export const metadata = {
  title: "Confirm Account",
};

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Confirm your account</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We'll finish setting up your account — just confirm the details below.
          </p>
        </div>

        {/* Render client-only confirmation UI inside Suspense */}
        <Suspense fallback={<div>Loading confirmation…</div>}>
          <ConfirmClient />
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
