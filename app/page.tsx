import Link from "next/link";
import { ArrowUpRight, CalendarIcon, CheckIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { SectionHeading } from "@/components/section-heading";
import { CtaBanner } from "@/components/cta-banner";
import { faqs } from "@/lib/content";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Human-led Android app testing</span>
            <h1>12 real testers.<br /><em>15 focused days.</em><br />One clear price.</h1>
            <p className="hero-copy">A coordinated Google Play closed-testing campaign for Android developers preparing their apps for production review. No subscriptions. No mystery pricing.</p>
            <div className="hero-actions">
              <Link className="button button-dark" href="/sign-in">Start your campaign <ArrowUpRight /></Link>
              <Link className="button button-outline" href="/how-it-works">See how it works</Link>
            </div>
            <div className="hero-note"><span /> $10 per campaign · 12 testers · 15 consecutive days</div>
          </div>
          <div className="hero-visual" aria-label="Illustration of a testing campaign dashboard">
            <div className="orbit" />
            <div className="float-pill float-one">12 / 12 <strong>testers</strong></div>
            <div className="float-pill float-two">15-day <strong>campaign</strong></div>
            <div className="dashboard-card">
              <div className="dash-top"><div><div className="dash-label">Campaign overview</div><strong style={{ display: "block", marginTop: 5, fontSize: 15 }}>Your closed test</strong></div><span className="dash-status">Structured plan</span></div>
              <div className="dash-metrics"><div className="dash-metric"><strong>12</strong><span>human testers</span></div><div className="dash-metric"><strong>15d</strong><span>participation window</span></div></div>
              <div className="progress-head"><span>Campaign timeline</span><b>15 days</b></div>
              <div className="progress-track"><span /></div>
              <div className="dash-days"><span>Day 1 · Opt-in</span><span>Day 15 · Summary</span></div>
              <div className="dash-activity">
                <div className="activity-row"><span className="activity-icon">✓</span><div><b>Tester access confirmed</b><small>12 accounts added to the closed test</small></div></div>
                <div className="activity-row"><span className="activity-icon">↗</span><div><b>Testing activity coordinated</b><small>Feedback gathered during the campaign</small></div></div>
                <div className="activity-row"><span className="activity-icon">▤</span><div><b>Completion summary</b><small>Campaign record prepared for you</small></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics-strip" aria-label="Service summary">
        <div className="container metrics-grid">
          <div className="metric-item"><span className="metric-number">12</span><span className="metric-caption">human tester accounts<br />in each campaign</span></div>
          <div className="metric-item"><span className="metric-number">15 days</span><span className="metric-caption">consecutive testing<br />participation window</span></div>
          <div className="metric-item"><span className="metric-number">$10</span><span className="metric-caption">one flat campaign price<br />no recurring charge</span></div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container">
          <SectionHeading eyebrow="Why Android Testers" title="A defined process, not a list of empty installs." description="Your app is handled by people who opt in and participate in the closed test. We focus on continuity, clear setup, and genuine feedback throughout the campaign." />
          <div className="feature-grid">
            <article className="feature-card"><div className="feature-icon"><UsersIcon /></div><h3>12 human participants</h3><p>A fixed group of 12 tester accounts joins your closed test. We coordinate the group rather than selling anonymous install counts.</p></article>
            <article className="feature-card"><div className="feature-icon"><CalendarIcon /></div><h3>15 consecutive days</h3><p>We plan for a 15-day participation window, one day beyond the 14-day continuous opt-in minimum that applies to certain new personal developer accounts.</p></article>
            <article className="feature-card"><div className="feature-icon"><ShieldIcon /></div><h3>Transparent boundaries</h3><p>You keep control of your Play Console. We do not ask for your password or promise production approval, ratings, or positive reviews.</p></article>
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="container">
          <SectionHeading eyebrow="The process" title="From Play Console setup to a completed test." description="You prepare the closed-test track and keep ownership of the app. We coordinate the tester side after your setup is verified." />
          <div className="steps-grid">
            <article className="step"><span className="step-num">01</span><h3>Sign in with Google</h3><p>Create your customer account using Google sign-in. Your Play Console credentials stay with you.</p></article>
            <article className="step"><span className="step-num">02</span><h3>Set up your test</h3><p>Add our 12 tester addresses, make the app available to Kenya, publish the closed-test release, and share its opt-in link.</p></article>
            <article className="step"><span className="step-num">03</span><h3>Verify and pay</h3><p>Submit your app details and setup evidence. After the setup check, pay the one-time $10 campaign fee.</p></article>
            <article className="step"><span className="step-num">04</span><h3>Run the 15-day campaign</h3><p>We coordinate opt-in, participation, continuity, and a completion summary for your records.</p></article>
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container split-panel">
          <div>
            <SectionHeading eyebrow="Important to understand" title="Testing helps. It does not guarantee approval." description="For eligible personal developer accounts created after 13 November 2023, Google Play currently asks for at least 12 testers to remain opted in to a closed test continuously for 14 days before a production-access application." />
            <div className="check-list">
              <div className="check-item"><CheckIcon />Meet the applicable tester and time requirements.</div>
              <div className="check-item"><CheckIcon />Use the test to collect real feedback and improve your app.</div>
              <div className="check-item"><CheckIcon />Review Google Play's account-specific requirements before applying.</div>
            </div>
          </div>
          <aside className="note-panel"><h3>Keep your account in control.</h3><p>Android Testers is an independent testing service. We do not represent Google, access your developer account, or make production decisions. Google evaluates your app, developer account, test quality, and production-access answers.</p><Link href="/guides/google-play-closed-testing-requirements">Read the testing requirements <ArrowUpRight style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle" }} /></Link></aside>
        </div>
      </section>

      <section className="section section-white" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHeading eyebrow="Common questions" title="Know what is included before you start." description="Straight answers about the campaign, timeline, and what Google Play ultimately decides." />
          <div className="faq-list">
            {faqs.slice(0, 4).map((faq) => <article className="faq-item" key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}
          </div>
          <div style={{ marginTop: 24 }}><Link className="button button-outline" href="/faq">View all questions <ArrowUpRight /></Link></div>
        </div>
      </section>

      <CtaBanner title="Get your closed-testing campaign organised." description="One fixed price. Twelve people. Fifteen days of coordinated participation." />
    </>
  );
}
