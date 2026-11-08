export const siteConfig = {
  name: "Android Testers",
  shortName: "Android Testers",
  description:
    "A coordinated, human-led Google Play closed-testing service: 12 testers, 15 days of structured participation, and one transparent price.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  priceUsd: 10,
  testerCount: 12,
  campaignDays: 15,
  whatsappNumber: "254742608319",
  whatsappDisplayNumber: "+254 742 608 319",
  whatsappUrl: "https://wa.me/254742608319?text=Hello%20Android%20Testers%2C%20I%20need%20help%20with%20a%20campaign.",
};

export const publicRoutes = [
  "/",
  "/how-it-works",
  "/pricing",
  "/testing-guide",
  "/resources",
  "/faq",
  "/guides/google-play-closed-testing-requirements",
  "/guides/add-testers-to-google-play",
  "/guides/prepare-for-production-access",
  "/guides/google-play-closed-test-opt-in-link",
  "/guides/14-day-closed-testing-timeline",
  "/guides/google-play-production-access-checklist",
  "/refund-policy",
  "/terms",
  "/privacy",
  "/contact",
];
