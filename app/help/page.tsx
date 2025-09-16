// app/help/page.tsx
import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import writeOffLogo from "@/public/writeofflogo.png";
import HelpClient from "./HelpClient";

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src={writeOffLogo} alt="WriteOff" className="w-8 h-auto" />
              <h1 className="text-2xl font-bold text-foreground">Help &amp; Support</h1>
            </div>
            <Link href="/">
              <button
                type="button"
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-5 rounded-md"
              >
                Back to Home
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Render the client-only interactive UI inside Suspense */}
        <Suspense fallback={<div>Loading help content…</div>}>
          <HelpClient />
        </Suspense>
      </div>
    </div>
  );
}
