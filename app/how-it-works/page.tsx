import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/cta-banner";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "How It Works",
  description: "See how an Android Testers closed-testing campaign works, from Google Play setup and verification to 15 days of human testing.",
  alternates: { canonical: "/how-it-works" },
};

const steps = [
  ["01", "Create your account", "Sign in with your Google account. Your Android Testers account is separate from your Google Play Console account; we never need your Play Console password."],
  ["02", "Prepare the closed test", "We provide the 12 tester email addresses and setup instructions. Add them to your app's closed-test email list, include Kenya among the available countries for the test release, publish the release, and copy the opt-in link."],
  ["03", "Submit your app for a setup check", "Provide the app name, package name, closed-test opt-in link, and evidence that the tester list and country availability are configured. We check the setup before taking payment."],
  ["04", "Pay the fixed campaign fee", "Once your setup is accepted, complete the one-time $10 payment through Paystack. Payment does not start the 15-day clock."],
  ["05", "All 12 testers opt in", "We coordinate the tester group and confirm that all 12 accounts have joined the closed test. The campaign start date is recorded after all required opt-ins are confirmed."],
  ["06", "Run the 15-day test", "The testers participate throughout the 15-day window and provide genuine testing feedback. We monitor continuity and address interruptions under the campaign policy."],
  ["07", "Receive your completion summary", "At the end of the campaign, receive the campaign dates, participation status, and a concise testing summary. You remain responsible for applying for production access in Play Console."],
];

export default function HowItWorksPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">A clear sequence</span><h1>Know exactly what happens at each stage.</h1><p>Android Testers handles tester coordination. You keep control of your app, release, and developer account.</p></div></section>
    <section className="content-section"><div className="container">
      <div className="prose"><h2>One campaign, seven steps</h2><p>The process is designed to catch setup problems before you pay and to start the testing clock only when the full group has joined the test.</p></div>
      <div className="process-list" style={{ display: "grid", gap: 13, maxWidth: 850, marginTop: 30 }}>
        {steps.map(([num, title, text]) => <article key={num} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 20, padding: "22px 0", borderBottom: "1px solid #e4e8ed" }}><span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 99, background: "#eff6dc", color: "#5d7c20", fontSize: 12, fontWeight: 800 }}>{num}</span><div><h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{title}</h3><p style={{ margin: 0, color: "#667286", fontSize: 13, lineHeight: 1.8 }}>{text}</p></div></article>)}
      </div>
      <div className="prose"><h2>When does the 15-day period begin?</h2><p>The clock starts after all 12 testers have successfully opted in and the campaign start is confirmed. It does not begin when you create an account, submit your app, or pay. Google Play's applicable requirement is based on continuous opt-in, so an opt-out or other interruption can affect an individual tester's qualifying period.</p><div className="prose-callout">If your release is not published, your opt-in link is not available, the tester country is not supported, or the 12 addresses are not correctly listed, we will ask you to correct the setup before payment.</div><h2>What you need to prepare</h2><ul><li>A Google Play developer account with your app's closed-testing track created.</li><li>A test release that has been published and can be joined through the opt-in link.</li><li>The 12 tester email addresses added to the correct tester list.</li><li>Kenya included in the test's available countries because our initial tester pool is based there.</li><li>A working app build and a way for testers to report real issues or feedback.</li></ul><p>See the <Link href="/testing-guide">step-by-step setup guide</Link> before submitting your campaign.</p></div>
    </div></section>
    <CtaBanner title="Ready to prepare your app?" description="Review the setup steps first. You will pay only after the configuration check." />
  </>;
}
