import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/cta-banner";

export const metadata: Metadata = {
  title: "Google Play Closed Testing Setup Guide",
  description: "Prepare your Google Play closed test for Android Testers: create an email list, add the 12 tester addresses, enable Kenya, publish the release, and share the opt-in link.",
  alternates: { canonical: "/testing-guide" },
};

export default function TestingGuidePage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Before payment</span><h1>Prepare your Google Play closed test.</h1><p>Follow these steps in your own Play Console account. Android Testers will never ask you to share your Play Console password.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <div className="prose-callout"><strong>Before you begin:</strong> This guide is for a closed-testing track. The exact labels in Play Console can change. Follow the current Google Play Console instructions if your interface differs.</div>
      <h2>1. Create or open your closed-testing track</h2><ol><li>Sign in to your Google Play Console.</li><li>Select the app you want to test.</li><li>Open <strong>Test and release → Testing → Closed testing</strong>.</li><li>Create or select the closed-testing track you intend to use.</li></ol>
      <h2>2. Create an email list for the 12 testers</h2><ol><li>Open the track's <strong>Testers</strong> tab.</li><li>Choose email-based tester access and create an email list if you do not already have one.</li><li>After you receive the Android Testers tester addresses, add all 12 addresses to that list and save the changes.</li><li>Check the saved list carefully. Do not paste the addresses into a public page or public issue tracker.</li></ol>
      <h2>3. Make the test available in Kenya</h2><p>Our initial tester pool is based in Kenya. In the country or region availability settings for the relevant test release, confirm that Kenya is included. Google notes that country availability changes can apply across testing and production tracks, so review the selection before saving.</p>
      <h2>4. Publish the closed-test release</h2><p>Prepare and roll out a closed-testing release. The opt-in link is available only when the test is published; a draft or pending-publication release may not expose a working opt-in link. Google also notes that a newly published test link can take several hours to become available.</p>
      <h2>5. Copy the tester opt-in link</h2><p>From the closed-testing track, copy the shareable opt-in link. Testers must join the test through that link using the Google account whose email address is on the tester list.</p>
      <h2>6. Submit your campaign details</h2><p>Return to Android Testers and provide your app name, package name, opt-in link, and the requested screenshots showing the tester list and country availability. We will check the configuration before requesting payment.</p>
      <h2>7. Wait for the confirmed campaign start</h2><p>Once the setup is accepted and the $10 payment is confirmed, we coordinate the 12 opt-ins. The 15-day campaign window starts only after all 12 have been confirmed as opted in.</p>
      <h2>Official Google instructions</h2><p>Use Google's current <a href="https://support.google.com/googleplay/android-developer/answer/9845334" target="_blank" rel="noreferrer">guide to setting up a closed test</a> as the source of truth. For account eligibility and the 12-tester continuous opt-in requirement, see <a href="https://support.google.com/googleplay/android-developer/answer/14151465" target="_blank" rel="noreferrer">Google Play's testing requirements for new personal developer accounts</a>.</p>
      <div className="prose-callout">Never send us your Google password, two-factor authentication code, or Play Console recovery information. We only need the public opt-in link and limited evidence of the tester configuration.</div>
      <p>For a deeper explanation, see our guides on <Link href="/guides/google-play-closed-testing-requirements">closed-testing requirements</Link> and <Link href="/guides/add-testers-to-google-play">adding testers by email address</Link>.</p>
    </article></div></section>
    <CtaBanner title="Your Play Console stays yours." description="Complete the configuration in your own account, then submit the opt-in link for review." />
  </>;
}
