import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { CtaBanner } from "@/components/cta-banner";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One flat $10 price for an Android app closed-testing campaign with 12 human testers and a 15-day participation window.",
  alternates: { canonical: "/pricing" },
};

const inclusions = [
  "12 human tester accounts coordinated for your app",
  "15-day consecutive participation window",
  "Tester setup instructions and opt-in coordination",
  "Participation check-ins and campaign record",
  "Completion summary for your records",
  "One-time payment; no subscription",
];

export default function PricingPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Simple, fixed pricing</span><h1>One campaign. One price. No surprises.</h1><p>Every standard campaign has the same scope and price. There is no first-app or repeat-app pricing tier.</p></div></section>
    <section className="content-section"><div className="container">
      <div className="price-card"><span className="eyebrow">Standard closed-testing campaign</span><div className="price-amount"><strong>$10</strong><span>USD / campaign</span></div><p>For one Android app's closed-testing campaign with 12 testers over 15 consecutive days.</p><div className="price-divider"/><div className="price-includes">{inclusions.map((item) => <div className="check-item" key={item}><CheckIcon />{item}</div>)}</div><Link href="/sign-in" className="button button-dark" style={{ width: "100%" }}>Start a campaign</Link><p style={{ fontSize: 10, textAlign: "center", marginBottom: 0 }}>Payment is requested only after your Play Console setup passes our check.</p></div>
      <div className="prose" style={{ margin: "52px auto 0" }}><h2>What is not included</h2><ul><li>A guarantee that Google will approve production access.</li><li>Public ratings, reviews, positive feedback, or artificial install counts.</li><li>App development, bug fixing, Play Console account management, or policy appeals.</li><li>Overlapping campaign dates unless the tester pool has capacity and we confirm the schedule.</li></ul><h2>Payment currency</h2><p>The listed service price is USD $10. The final checkout amount and any currency conversion or bank charges will be shown by Paystack before you confirm payment. Your order is not marked paid based only on a browser redirect; payment will be confirmed server-side.</p></div>
    </div></section>
    <CtaBanner title="A straightforward $10 campaign." description="Start with the setup guide, then submit your app for a configuration check." />
  </>;
}
