import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Find Your Google Play Closed-Test Opt-In Link",
  description: "Find and share the Google Play closed-testing opt-in link after publishing a test release. Troubleshoot unavailable links and verify tester access.",
  alternates: { canonical: "/guides/google-play-closed-test-opt-in-link" },
};

const articleSchema = {
  "@context": "https://schema.org", "@type": "Article",
  headline: "How to Find Your Google Play Closed-Test Opt-In Link",
  dateModified: "2026-11-04", datePublished: "2026-11-04",
  author: { "@type": "Organization", name: "Android Testers" },
  publisher: { "@type": "Organization", name: "Android Testers" },
};

export default function OptInLinkGuidePage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Google Play Console · 6 minute guide</span><h1>Find your closed-test opt-in link.</h1><p>The opt-in link is how invited testers join a published closed test. It is not a substitute for adding the correct Google accounts to the tester list.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <p><strong>Reviewed 4 November 2026.</strong> Play Console labels can change. Use the current Google Play Help instructions if your screen differs.</p>
      <h2>Before looking for the link</h2><p>Confirm that the app has a closed-testing track, that the intended testers are included in the track's email list or Google Group, and that a test release has been rolled out. A draft release is not the same as a published test.</p>
      <h2>Find the link in Play Console</h2><ol><li>Open the app in Google Play Console.</li><li>Go to <strong>Testing → Closed testing</strong> and select the correct track.</li><li>Open the tester or track details area and locate the shareable opt-in link.</li><li>Copy the URL and open it in a private browser window to confirm that it resolves to the correct app and test.</li><li>Share the link only with the intended testers.</li></ol>
      <h2>What testers must do</h2><p>Each tester must open the opt-in link while signed in to the Google account whose email address is on the tester list, accept the testing invitation, and follow the Play Store prompt to join. Installing the app is a separate action from opting in. A tester should not switch Google accounts after joining.</p>
      <h2>If the link is missing or does not work</h2><ul><li>Confirm the release has been rolled out to the closed-testing track.</li><li>Check that the tester's Google account is on the saved list or Google Group.</li><li>Check that the test is available in the tester's country.</li><li>Allow time for a recently published test or configuration change to become available.</li><li>Make sure the tester is using the same account that was invited.</li></ul>
      <h2>Official source</h2><p>See Google's current <a href="https://support.google.com/googleplay/android-developer/answer/9845334" target="_blank" rel="noreferrer">closed testing setup instructions</a>. Android Testers is an independent service and is not affiliated with Google.</p>
      <div className="prose-callout">For an Android Testers campaign, submit the opt-in link only after you have saved the tester list and confirmed Kenya is included in the test's country availability. We review the setup before requesting payment.</div>
      <p>Continue with the <Link href="/testing-guide">campaign setup guide</Link> or read <Link href="/guides/add-testers-to-google-play">how to add testers by email</Link>.</p>
    </article></div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
  </>;
}
