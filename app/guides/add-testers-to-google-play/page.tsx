import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Add Testers to a Google Play Closed Test",
  description: "Step-by-step instructions for creating a closed-test email list, adding tester Google accounts, setting country availability, publishing a test, and sharing the opt-in link.",
  alternates: { canonical: "/guides/add-testers-to-google-play" },
};

export default function AddTestersGuide() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Play Console walkthrough</span><h1>How to add testers to a Google Play closed test.</h1><p>Use an email list to control who can join your closed test, then share the opt-in link with the people on that list.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <p><strong>Last reviewed: 4 November 2026.</strong> Google Play Console's interface may change. The official help page linked below should take precedence over this walkthrough.</p>
      <h2>1. Open the closed-testing track</h2><p>In Play Console, choose your app and open <strong>Test and release → Testing → Closed testing</strong>. Select the track you want to use or create a new one.</p>
      <h2>2. Create an email list</h2><p>Open the track's <strong>Testers</strong> tab. Choose email-based tester access. Create an email list, give it a clear internal name, and add the Google Account or Google Workspace email addresses of the people you want to invite. Save the list and select it for the track.</p>
      <h2>3. Confirm country availability</h2><p>Review the country and region availability for your release. If your testers are in Kenya, make sure Kenya is included for the relevant test. Google notes that country availability settings can affect multiple tracks, so check the consequences before saving changes.</p>
      <h2>4. Publish the test release</h2><p>Prepare a closed-test release and roll it out. A link may not be shown while the release is still a draft or pending publication. Google also notes that a new opt-in link can take several hours to become available after publication.</p>
      <h2>5. Share the opt-in link</h2><p>Copy the closed-test opt-in link from Play Console and send it to the listed testers. Each tester must open the link and complete the opt-in process with the Google account that was added to the list. Adding an email address to the list does not automatically opt that person in.</p>
      <h2>6. Keep the test active and gather feedback</h2><p>Tell testers what to explore and where to report issues. The goal is to learn about the app, not to collect scripted positive reviews. Review feedback and improve the app before applying for production access.</p>
      <div className="prose-callout">For an Android Testers campaign, you will receive the 12 tester addresses after sign-in. Add all 12 addresses to your email list, make the test available in Kenya, and submit the opt-in link and configuration evidence for review.</div>
      <h2>Official instructions</h2><p>Read Google's latest <a href="https://support.google.com/googleplay/android-developer/answer/9845334" target="_blank" rel="noreferrer">Set up an open, closed, or internal test</a> help page. See also our <Link href="/testing-guide">full setup guide</Link> and <Link href="/guides/google-play-closed-testing-requirements">overview of the 12 tester / 14 day rule</Link>.</p>
    </article></div></section>
  </>;
}
