import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppSupport } from "@/components/whatsapp-support";
import { siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Android Testers | 12 Human Testers for 15 Days",
    template: "%s | Android Testers",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "Google Play closed testing",
    "Android app testing",
    "12 testers",
    "Google Play production access testing",
    "closed testing service",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: "Android Testers | 12 Human Testers for 15 Days",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Android Testers | 12 Human Testers for 15 Days",
    description: siteConfig.description,
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Android Testers",
  url: siteConfig.url,
  description: siteConfig.description,
  contactPoint: {
    "@type": "ContactPoint",
    telephone: `+${siteConfig.whatsappNumber}`,
    contactType: "customer support",
    url: siteConfig.whatsappUrl,
    availableLanguage: ["English"],
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Google Play closed-testing campaign",
  serviceType: "Human-led Android app closed testing",
  provider: { "@type": "Organization", name: "Android Testers", url: siteConfig.url },
  description: "A coordinated 15-day closed-testing campaign with 12 human testers.",
  offers: {
    "@type": "Offer",
    price: "10.00",
    priceCurrency: "USD",
  },
};

function jsonLd(value: object) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <WhatsAppSupport />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }} />
      </body>
    </html>
  );
}
