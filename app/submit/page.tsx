import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SubmitAppForm } from "@/components/submit-app-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submit an App", robots: { index: false, follow: false } };

export default async function SubmitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return <section className="content-section"><div className="container portal-container">
    <span className="eyebrow">New campaign</span><h1 className="portal-title">Submit your Android app.</h1>
    <p className="portal-intro">Complete your own Google Play closed-test configuration before submitting. We review the evidence before you pay.</p>
    <div className="portal-card"><div className="portal-card-heading"><div><h2>App and tester setup</h2><p>Fixed service: $10 USD · 12 human testers · 15 consecutive days</p></div></div><SubmitAppForm /></div>
  </div></section>;
}
