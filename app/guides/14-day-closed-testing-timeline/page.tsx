import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Google Play 14-Day Closed Testing Timeline Explained",
  description: "Understand the 12 testers and 14 continuous days closed-testing requirement for eligible new personal Google Play developer accounts, including opt-outs and restarts.",
  alternates: { canonical: "/guides/14-day-closed-testing-timeline" },
};

export default function TestingTimelineGuidePage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Testing requirements · 7 minute guide</span><h1>How the 14-day closed-testing period works.</h1><p>Understand the tester count, continuous opt-in period, and what can interrupt the timeline before planning your launch.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <p><strong>Reviewed 4 November 2026.</strong> The requirement described here applies to eligible personal developer accounts created after 13 November 2023. Other account types and individual Play Console conditions can differ.</p>
      <h2>The basic requirement</h2><p>Google Play currently requires eligible new personal developer accounts to run a closed test with at least 12 testers who have remained opted in continuously for at least 14 days before applying for production access. The 12 testers are a minimum group size, not a guarantee of approval.</p>
      <h2>What “continuously opted in” means</h2><p>Testers must join the closed test and remain enrolled throughout the qualifying period. Merely adding an email address to a tester list is not enough. The tester must complete the opt-in process using the intended Google account. If a tester opts out, their continuous participation is interrupted.</p>
      <h2>Why a 15-day operational window?</h2><p>Android Testers plans a 15-day window after all 12 testers have been confirmed as opted in. The additional day is an operational buffer; it does not change Google's stated 14-day minimum or guarantee that Google will accept the production-access application.</p>
      <h2>Example timeline</h2><ol><li>Day 0: publish the closed-test release and configure tester access.</li><li>Enrollment: each invited tester opens the opt-in link and joins the test.</li><li>Start: the qualifying service clock begins after all 12 opt-ins are confirmed.</li><li>Days 1–15: testers remain opted in, use the app, and report genuine issues or observations.</li><li>After completion: review feedback, improve the app, and apply for production access only when the account and app are ready.</li></ol>
      <h2>What the rule does not establish</h2><p>The tester/time condition is not the only production-access factor. Google can consider app quality, meaningful testing, policy compliance, account standing, and the developer's answers. Never treat a campaign certificate or a tester count as a promise of approval.</p>
      <h2>Official Google source</h2><p>Read <a href="https://support.google.com/googleplay/android-developer/answer/14151465" target="_blank" rel="noreferrer">Google Play's testing requirements for new personal developer accounts</a>. The Play Console rules are the source of truth for your own account.</p>
      <div className="prose-callout">Android Testers coordinates human participation and provides a completion summary. We do not sell ratings, reviews, downloads, or positive feedback, and we cannot make Google's production-access decision.</div>
      <p>See our <Link href="/guides/google-play-closed-testing-requirements">full requirements guide</Link> and <Link href="/refund-policy">refund and retest policy</Link>.</p>
    </article></div></section>
  </>;
}
