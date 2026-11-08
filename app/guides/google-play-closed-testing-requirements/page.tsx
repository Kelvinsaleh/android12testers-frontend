import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Google Play Closed Testing Requirements: 12 Testers and 14 Days",
  description: "Understand Google's 12 testers and 14 continuous opt-in day requirement for eligible new personal developer accounts, plus what it does and does not guarantee.",
  alternates: { canonical: "/guides/google-play-closed-testing-requirements" },
};

export default function ClosedTestingRequirementsGuide() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Android development guide</span><h1>Google Play closed testing: the 12 testers and 14 days rule.</h1><p>A practical explanation of the testing requirement for eligible new personal developer accounts—and why meeting it is not the same as being approved for production.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <p><strong>Last reviewed: 4 November 2026.</strong> Google can update Play Console requirements, so always confirm the current instructions in your own developer account before planning a release.</p>
      <h2>Who does the 12-tester requirement apply to?</h2><p>Google Play currently states that developers with personal accounts created after 13 November 2023 must run a closed test with at least 12 testers who have been opted in continuously for at least 14 days before applying for production access. This rule is not a universal statement that every developer account has the same eligibility path.</p>
      <h2>What does “continuously opted in” mean?</h2><p>The tester must remain opted in throughout the required period. Google's help page explains that a tester who opts out and later opts back in must complete a new consecutive 14-day period. A test's total calendar age is not enough if the required group has not remained opted in continuously.</p>
      <h2>Why Android Testers uses 15 days</h2><p>Our standard campaign is planned for 15 days. The extra day provides a one-day margin beyond the 14-day minimum. It does not change Google's policy, replace the need to keep the required testers opted in, or guarantee the outcome of a production-access application.</p>
      <h2>What happens after the closed test?</h2><p>When the account meets the relevant testing criteria, the developer can apply for production access through Play Console. Google asks questions about the app, the test, and production readiness. Google's review can consider more than the number of testers and the length of the test.</p>
      <h2>What the testing requirement does not guarantee</h2><ul><li>It does not guarantee production access.</li><li>It does not excuse policy violations, missing disclosures, broken functionality, or poor app quality.</li><li>It does not mean testers should provide artificial ratings or reviews.</li><li>It does not remove the developer's responsibility to give genuine answers about their testing process.</li></ul>
      <h2>How to prepare</h2><p>Publish a valid closed-test release, configure the tester list, ensure the app is available to testers in their country, share the correct opt-in link, and provide testers with a real feedback channel. Google recommends using closed testing to find issues and gather feedback before production.</p>
      <p>Android Testers coordinates a 12-person, 15-day campaign. You remain responsible for the app, Play Console configuration, policy compliance, and production-access application. Read our <Link href="/testing-guide">closed-testing setup guide</Link> for the steps used before a campaign.</p>
      <h2>Official sources</h2><ul><li><a href="https://support.google.com/googleplay/android-developer/answer/14151465" target="_blank" rel="noreferrer">Google Play: App testing requirements for new personal developer accounts</a>.</li><li><a href="https://support.google.com/googleplay/android-developer/answer/9845334" target="_blank" rel="noreferrer">Google Play: Set up an open, closed, or internal test</a>.</li></ul>
    </article></div></section>
  </>;
}
