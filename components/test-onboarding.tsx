"use client";

import React, { useState } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { IntroTutorial } from './tutorial/intro-tutorial';
import { PlaidGuideTutorial } from './tutorial/plaid-guide-tutorial';

export function TestOnboarding() {
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);
  const [showPlaidGuide, setShowPlaidGuide] = useState(false);

  const handleIntroComplete = () => {
    console.log('Intro tutorial completed');
    setShowIntroTutorial(false);
  };

  const handleIntroSkip = () => {
    console.log('Intro tutorial skipped');
    setShowIntroTutorial(false);
  };

  const handlePlaidGuideComplete = () => {
    console.log('Plaid guide completed');
    setShowPlaidGuide(false);
  };

  const handlePlaidGuideSkip = () => {
    console.log('Plaid guide skipped');
    setShowPlaidGuide(false);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Tutorial Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <Button onClick={() => setShowIntroTutorial(true)}>
              Test Intro Tutorial
            </Button>
            <Button onClick={() => setShowPlaidGuide(true)}>
              Test Plaid Guide
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Use these buttons to test the onboarding tutorials:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Intro Tutorial: Welcome → Connect Bank → Auto-analyze & Review</li>
              <li>Plaid Guide: Progress banner → Category/Deductible chips → Confirm/edit</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Intro Tutorial */}
      <IntroTutorial
        isOpen={showIntroTutorial}
        onClose={() => setShowIntroTutorial(false)}
        onComplete={handleIntroComplete}
        onSkip={handleIntroSkip}
      />

      {/* Plaid Guide Tutorial */}
      <PlaidGuideTutorial
        isOpen={showPlaidGuide}
        onClose={() => setShowPlaidGuide(false)}
        onComplete={handlePlaidGuideComplete}
        onSkip={handlePlaidGuideSkip}
      />
    </div>
  );
}
