"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle, Shield, Info, Mail, MessageCircle, BookOpen, CreditCard, FileText, Users, Heart } from 'lucide-react';
import Link from 'next/link';
import writeOffLogo from '@/public/writeofflogo.png';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { FAQSection } from '@/components/faq-section';
import { ContactSupportForm } from '@/components/contact-support-form';

export default function HelpPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('help');

  // Handle URL parameters for direct tab navigation
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['help', 'privacy', 'about', 'faq', 'contact'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTutorialClick = (tutorialType: string) => {
    // For now, these will open in new tabs/windows
    // In a real implementation, you'd integrate with the actual tutorial system
    switch (tutorialType) {
      case 'intro':
        window.open('/protected?tutorial=intro', '_blank');
        break;
      case 'plaid':
        window.open('/protected?tutorial=plaid', '_blank');
        break;
      case 'reports':
        window.open('/protected?tutorial=reports', '_blank');
        break;
      default:
        break;
    }
  };

  const handleContactSupport = () => {
    // Switch to contact tab
    setActiveTab('contact');
  };

  const handleFAQ = () => {
    // Switch to FAQ tab
    setActiveTab('faq');
  };

  const handleCommunity = () => {
    // For now, open community page or forum
    // In a real implementation, you'd have a community platform
    alert('Community features coming soon!');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src={writeOffLogo} alt="WriteOff" className="w-8 h-auto" />
              <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="help" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Help & Support
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              About Us
            </TabsTrigger>
          </TabsList>

          {/* Help & Support Tab */}
          <TabsContent value="help" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Getting Started */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Getting Started
                  </CardTitle>
                  <CardDescription>
                    Learn the basics of using WriteOff
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    New to WriteOff? Start here to learn the fundamentals.
                  </p>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => handleTutorialClick('intro')}
                  >
                    View Tutorial
                  </Button>
                </CardContent>
              </Card>

              {/* Bank Connection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    Bank Connection
                  </CardTitle>
                  <CardDescription>
                    Connect your bank accounts securely
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Learn how to connect your bank accounts using Plaid.
                  </p>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => handleTutorialClick('plaid')}
                  >
                    View Guide
                  </Button>
                </CardContent>
              </Card>

              {/* Reports & Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Reports & Analytics
                  </CardTitle>
                  <CardDescription>
                    Understanding your tax reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Learn how to interpret your tax reports and analytics.
                  </p>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => handleTutorialClick('reports')}
                  >
                    Learn More
                  </Button>
                </CardContent>
              </Card>

              {/* Contact Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-orange-600" />
                    Contact Support
                  </CardTitle>
                  <CardDescription>
                    Get help from our support team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Can't find what you're looking for? Contact our support team.
                  </p>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={handleContactSupport}
                  >
                    Contact Us
                  </Button>
                </CardContent>
              </Card>

              {/* FAQ */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                    Frequently Asked Questions
                  </CardTitle>
                  <CardDescription>
                    Common questions and answers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Find answers to the most common questions about WriteOff.
                  </p>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={handleFAQ}
                  >
                    View FAQ
                  </Button>
                </CardContent>
              </Card>

              {/* Community */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    Community
                  </CardTitle>
                  <CardDescription>
                    Connect with other users
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Join our community to share tips and get help from other users.
                  </p>
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={handleCommunity}
                  >
                    Join Community
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <FAQSection />
          </TabsContent>

          {/* Contact Support Tab */}
          <TabsContent value="contact" className="space-y-6">
            <ContactSupportForm />
          </TabsContent>

          {/* Privacy Policy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Privacy Policy
                </CardTitle>
                <CardDescription>
                  Last updated: {new Date().toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-muted-foreground">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Information We Collect</h3>
                  <p className="mb-3">
                    We collect information you provide directly to us, such as when you create an account, 
                    connect your bank accounts, or upload receipts. This may include:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Personal information (name, email, profession)</li>
                    <li>Financial information through secure bank connections</li>
                    <li>Transaction data and receipts</li>
                    <li>Usage information and preferences</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">How We Use Your Information</h3>
                  <p className="mb-3">
                    We use the information we collect to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Provide and maintain our services</li>
                    <li>Process transactions and analyze expenses</li>
                    <li>Generate tax reports and analytics</li>
                    <li>Improve our services and user experience</li>
                    <li>Communicate with you about updates and features</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Data Security</h3>
                  <p>
                    We implement industry-standard security measures to protect your personal and financial information. 
                    This includes encryption, secure connections, and regular security audits. We never share your 
                    personal information with third parties without your explicit consent.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Your Rights</h3>
                  <p className="mb-3">
                    You have the right to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Access and update your personal information</li>
                    <li>Request deletion of your data</li>
                    <li>Opt-out of certain communications</li>
                    <li>Disconnect your bank accounts at any time</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Contact Us</h3>
                  <p>
                    If you have any questions about this Privacy Policy or our data practices, 
                    please contact us at writeoffapp@gmail.com
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* About Us Tab */}
          <TabsContent value="about" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-green-600" />
                  About WriteOff
                </CardTitle>
                <CardDescription>
                  AI-powered tax optimization for modern professionals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-muted-foreground">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Our Mission</h3>
                  <p>
                    At WriteOff, we believe that tax optimization shouldn't be complicated or time-consuming. 
                    Our mission is to empower professionals and small business owners with intelligent tools 
                    that automatically identify tax-saving opportunities and streamline expense management.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">What We Do</h3>
                  <p className="mb-3">
                    WriteOff is an AI-powered platform that helps you:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Automatically categorize and analyze business expenses</li>
                    <li>Identify tax-deductible items using advanced AI</li>
                    <li>Generate comprehensive tax reports and analytics</li>
                    <li>Streamline receipt management and organization</li>
                    <li>Maximize your tax savings with intelligent insights</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Our Technology</h3>
                  <p>
                    We leverage cutting-edge artificial intelligence and machine learning to analyze your 
                    financial data and provide intelligent recommendations. Our platform integrates securely 
                    with major banks and financial institutions, ensuring your data is always protected.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Why Choose WriteOff</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="flex items-start gap-3">
                      <Heart className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-foreground">User-First Design</h4>
                        <p className="text-xs">Built with professionals in mind, focusing on ease of use</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-foreground">Bank-Level Security</h4>
                        <p className="text-xs">Enterprise-grade security to protect your financial data</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-foreground">AI-Powered Insights</h4>
                        <p className="text-xs">Intelligent analysis to maximize your tax savings</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-foreground">Expert Support</h4>
                        <p className="text-xs">Dedicated support team to help you succeed</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Get in Touch</h3>
                  <p>
                    Have questions or want to learn more? We'd love to hear from you. 
                    Contact us at writeoffapp@gmail.com or visit our website at writeoff.com
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
