// app/help/HelpClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle,
  Shield,
  Info,
  MessageCircle,
  BookOpen,
  CreditCard,
  FileText,
  Users,
  Heart,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FAQSection } from "@/components/faq-section";
import { ContactSupportForm } from "@/components/contact-support-form";

export default function HelpClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>("help");

  // Handle URL parameters for direct tab navigation
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab && ["help", "privacy", "about", "faq", "contact"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTutorialClick = (tutorialType: string) => {
    // For now, these will open in new tabs/windows
    switch (tutorialType) {
      case "intro":
        window.open("/protected?tutorial=intro", "_blank");
        break;
      case "plaid":
        window.open("/protected?tutorial=plaid", "_blank");
        break;
      case "reports":
        window.open("/protected?tutorial=reports", "_blank");
        break;
      default:
        break;
    }
  };

  const handleContactSupport = () => setActiveTab("contact");
  const handleFAQ = () => setActiveTab("faq");
  const handleCommunity = () => alert("Community features coming soon!");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="help" className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Help &amp; Support
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
              <CardDescription>Learn the basics of using WriteOff</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                New to WriteOff? Start here to learn the fundamentals.
              </p>
              <Button className="w-full" size="sm" onClick={() => handleTutorialClick("intro")}>
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
              <CardDescription>Connect your bank accounts securely</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Learn how to connect your bank accounts using Plaid.
              </p>
              <Button className="w-full" size="sm" onClick={() => handleTutorialClick("plaid")}>
                View Guide
              </Button>
            </CardContent>
          </Card>

          {/* Reports & Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Reports &amp; Analytics
              </CardTitle>
              <CardDescription>Understanding your tax reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Learn how to interpret your tax reports and analytics.
              </p>
              <Button className="w-full" size="sm" onClick={() => handleTutorialClick("reports")}>
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
              <CardDescription>Get help from our support team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Can&apos;t find what you&apos;re looking for? Contact our support team.
              </p>
              <Button className="w-full" size="sm" onClick={handleContactSupport}>
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
              <CardDescription>Common questions and answers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Find answers to the most common questions about WriteOff.
              </p>
              <Button className="w-full" size="sm" onClick={handleFAQ}>
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
              <CardDescription>Connect with other users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Join our community to share tips and get help from other users.
              </p>
              <Button className="w-full" size="sm" onClick={handleCommunity}>
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
            <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-muted-foreground">
            {/* ...kept content omitted here for brevity in this example...
                You can paste the detailed privacy content from your original page here */}
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
            <CardDescription>AI-powered tax optimization for modern professionals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-muted-foreground">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Our Mission</h3>
              <p>
                At WriteOff, we believe that tax optimization shouldn&apos;t be complicated or time-consuming.
                Our mission is to empower professionals and small business owners with intelligent tools that
                automatically identify tax-saving opportunities and streamline expense management.
              </p>
            </div>
            {/* ...more about content as needed... */}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
