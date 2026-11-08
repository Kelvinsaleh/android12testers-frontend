import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Google Play Production Access Checklist for Android Developers",
  description: "A practical checklist for preparing an Android app for Google Play production access after closed testing: app quality, test feedback, policy readiness and application answers.",
  alternates: { canonical: "/guides/google-play-production-access-checklist" },
};

export default function ProductionChecklistPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Release readiness · 8 minute guide</span><h1>Prepare for Google Play production access.</h1><p>Passing a closed-test duration requirement is one checkpoint. Use this checklist to prepare the app and the production-access application itself.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <p><strong>Reviewed 4 November 2026.</strong> This is a practical preparation guide, not a statement of every current Google Play policy requirement. Review the requirements shown in your own Play Console.</p>
      <h2>1. Confirm account eligibility</h2><ul><li>Identify whether your developer account is personal or organisation.</li><li>Check the account creation date and whether the 12 testers / 14 continuous days rule applies.</li><li>Resolve any identity, verification, account-standing, or policy notices shown in Play Console.</li></ul>
      <h2>2. Check the app itself</h2><ul><li>Make sure the app opens and its primary features work reliably.</li><li>Test sign-up, sign-in, account recovery, permissions, offline states, and core user journeys where relevant.</li><li>Remove placeholder content, broken navigation, test credentials, debug screens, and unfinished flows.</li><li>Check crashes, ANRs, performance, accessibility, and compatibility on representative devices.</li></ul>
      <h2>3. Run a meaningful closed test</h2><ul><li>Recruit testers who can use the app and provide actionable feedback.</li><li>Explain what to test without scripting positive responses or requiring public ratings.</li><li>Collect issues, reproduce them, fix important defects, and test the fixes.</li><li>Keep accurate records of the test dates, tester participation, and changes made.</li></ul>
      <h2>4. Review policy and store presentation</h2><ul><li>Check the app against the current Google Play Developer Program Policies.</li><li>Verify Data safety, privacy policy, permissions, target audience, ads declarations, and content rating where applicable.</li><li>Use accurate screenshots, descriptions, feature claims, and app category information.</li><li>Make sure the app does not collect or share data in ways that conflict with its disclosures.</li></ul>
      <h2>5. Answer production-access questions honestly</h2><p>Describe who tested the app, how they were recruited, what feedback was received, what problems were found, and what changed as a result. Do not fabricate testers, activity, feedback, or app improvements. The answers should match the records from the actual test.</p>
      <h2>6. Submit only when ready</h2><p>Review the current production-access task in Play Console and resolve each requested item. If Google declines the application, read the exact reason before deciding what to fix. A rejection does not automatically mean that the closed-testing duration was invalid.</p>
      <h2>Official sources</h2><p>Start with Google's <a href="https://support.google.com/googleplay/android-developer/answer/14151465" target="_blank" rel="noreferrer">closed-testing and production-access requirements</a> and the <a href="https://play.google.com/about/developer-content-policy/" target="_blank" rel="noreferrer">Google Play Developer Program Policies</a>.</p>
      <div className="prose-callout">Android Testers is an independent human testing service. It is not operated, certified, or endorsed by Google, and it cannot guarantee production access.</div>
      <p>Use our <Link href="/testing-guide">closed-test setup guide</Link> before submitting a $10 campaign.</p>
    </article></div></section>
  </>;
}
