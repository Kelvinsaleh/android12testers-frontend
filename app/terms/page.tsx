import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for Android Testers app submissions, human-led closed-testing campaigns, payments, tester participation, refunds and customer responsibilities.",
  alternates: { canonical: "/terms" },
};

const whatsapp = "https://wa.me/254742608319?text=Hello%20Android%20Testers%2C%20I%20have%20a%20question%20about%20the%20service%20terms.";

export default function TermsPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Service agreement</span><h1>Terms of service.</h1><p>The service scope, customer responsibilities, payment rules and limits that apply to an Android Testers campaign.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <div className="prose-callout"><strong>Publication checklist:</strong> This is a working legal draft dated 8 November 2026. Before accepting live payments, insert the operator's legal identity and physical address, confirm the payment/tax disclosures, and obtain review under Kenyan consumer law and the laws relevant to customers in target countries.</div>
      <p><strong>Version:</strong> 2026-11-08-v1 · <strong>Draft date:</strong> 8 November 2026.</p>

      <h2>1. Who provides the service?</h2>
      <p>Android Testers is a service operated by <strong>[INSERT THE LEGAL NAME OF THE INDIVIDUAL OR REGISTERED BUSINESS THAT OPERATES ANDROID TESTERS]</strong>, trading as Android Testers, of <strong>[INSERT PHYSICAL OR REGISTERED BUSINESS ADDRESS]</strong>, Kenya (“Android Testers”, “we”, “us” or “our”). These terms form the agreement between that operator and the person or business placing a campaign order (“you” or “customer”).</p>
      <p>For support, contact us through <a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp at +254 742 608 319</a>.</p>

      <h2>2. Acceptance and eligibility</h2>
      <p>By creating an account, submitting an app, or paying for a campaign, you confirm that you have read the applicable terms and privacy policy and agree to the terms that apply to your order. At checkout, we record the version of the terms and privacy policy you acknowledge. You must be at least 18 years old or legally authorised to enter the agreement on behalf of the business or developer account concerned.</p>
      <p>If you do not agree, do not submit an app or proceed with checkout. Your statutory consumer rights are not excluded or reduced by these terms.</p>

      <h2>3. What the $10 service includes</h2>
      <p>The standard price is <strong>US$10 for one campaign</strong>. A standard campaign is coordinated participation by 12 human tester accounts over a 15-consecutive-day service window. The campaign clock starts only after all 12 assigned testers have been confirmed as opted in and the start has been recorded. Payment alone does not start the 15-day period.</p>
      <p>The service includes review of the customer's closed-test setup evidence, coordination of the 12 testers, confirmation of opt-in status, campaign-period monitoring, genuine app use and appropriate testing notes, and a completion status/report in the customer dashboard. It does not include app development, fixing app defects, managing the customer's Play Console account, preparing a production-access application, or guaranteeing a Google decision.</p>

      <h2>4. Queue and campaign start</h2>
      <p>Android Testers currently operates a shared pool of 12 testers. Only one campaign can use that complete pool for enrolment or active testing at a time. Paid campaigns may be queued. We will show or communicate the available scheduling estimate; a customer must not assume that payment means testing begins immediately. We will confirm the actual start when all 12 testers have opted in.</p>
      <p>If a tester opts out or becomes unavailable during the required continuous period, the campaign may be paused and the continuity period restarted after the tester position has been restored and all required opt-ins are reconfirmed. We will not mark a campaign complete unless the agreed 15-day period has been delivered and the required participation records have been checked.</p>

      <h2>5. Customer responsibilities</h2>
      <p>You must:</p>
      <ul>
        <li>own the app or have authority from its owner and developer-account holder to arrange the test;</li>
        <li>provide accurate app name, package name, opt-in URL and other requested details;</li>
        <li>create and publish a functioning closed-test release in your own Google Play Console;</li>
        <li>add the 12 tester email addresses supplied through your authenticated account to the correct closed-test email list and select the relevant country availability;</li>
        <li>keep the test track, release and opt-in link available throughout the campaign;</li>
        <li>ensure the app is lawful, safe to test, and compliant with Google Play policies and applicable laws;</li>
        <li>remove or blur unrelated personal, confidential, payment and account information from screenshots before uploading; and</li>
        <li>respond promptly to setup questions and provide accurate evidence if requesting a retest or refund.</li>
      </ul>
      <p>You remain responsible for your developer account, app content, privacy disclosures, Data safety declarations, permissions, user data, app quality, policy compliance and production-access application. We never need your Google password, Play Console password, recovery codes or two-factor authentication codes. Do not send them to us.</p>

      <h2>6. Genuine testing and prohibited requests</h2>
      <p>Testers are real people who are expected to opt in and use the app in a genuine testing context and provide honest observations where appropriate. We do not sell public ratings, reviews, positive feedback, fabricated bug reports, artificial downloads or false engagement. You must not ask testers or us to misrepresent installation, use, opt-in, feedback or participation. We may refuse or stop a campaign involving unlawful, deceptive, harmful or policy-prohibited app activity.</p>

      <h2>7. Google Play is independent</h2>
      <p>Android Testers is an independent service and is not affiliated with, endorsed by or sponsored by Google. Google controls Google Play Console, closed-test requirements, production-access applications and approval decisions. A 15-day campaign with 12 testers may support an eligible developer's testing requirement, but it does not guarantee that the developer account meets every requirement or that Google will grant production access. You must check the current requirements that apply to your own developer account.</p>

      <h2>8. Price, currency and payment</h2>
      <p>The displayed campaign fee is US$10. Payment is processed through Paystack. We create a unique payment reference and verify the transaction with Paystack before marking the campaign as paid. A browser redirect or screenshot is not proof of payment. Your card issuer or bank may apply its own currency-conversion or international transaction charges. Any taxes or other amounts charged by us will be disclosed before you commit to payment.</p>
      <p>We do not receive or store your full card number or CVV. Payment information is handled by Paystack under its own terms and privacy notices. We may suspend checkout if Paystack or our account cannot accept the payment method or currency.</p>

      <h2>9. Refunds, cancellations and retests</h2>
      <p>The <a href="/refund-policy">Refund and Retest Policy</a> forms part of these terms. It explains when a customer can choose a repeat campaign or refund if we fail to deliver the agreed service, and how we assess a Google production-access rejection. Nothing in that policy removes mandatory rights that apply under consumer law.</p>
      <p>A customer may request cancellation before the 12-person campaign has started by contacting support. We will review the status and apply the published refund policy and any mandatory legal rights. Once the campaign has started, a cancellation request does not automatically establish that the service was not delivered.</p>

      <h2>10. Accounts, security and misuse</h2>
      <p>You are responsible for activity carried out through your Google account and for keeping your account secure. Do not attempt to access another customer's records, interfere with tester accounts, reverse engineer or disrupt the service, upload malware, submit unlawful material, or bypass campaign, payment or administrator controls. We may restrict or suspend access where reasonably necessary to protect the service, users, testers or legal compliance. Where appropriate, we will explain the reason and provide a way to contact support.</p>

      <h2>11. Intellectual property and customer materials</h2>
      <p>You retain ownership of your app, app content and materials you submit. You grant us a limited, non-exclusive permission to use those materials only as needed to review setup and deliver, support and document your campaign. You confirm that you have the rights and permissions needed to provide them. The website, software, branding and materials supplied by Android Testers remain owned by their respective rights holders. No ownership is transferred to you except for the limited service use described here.</p>

      <h2>12. Privacy</h2>
      <p>Our <a href="/privacy">Privacy Policy</a> explains the personal information we handle, why we use it, who receives it, potential processing outside Kenya, retention periods and how to exercise privacy rights. By using the service, you acknowledge that you have been given access to that notice. This clause does not replace any consent or other lawful basis required for a particular processing activity.</p>

      <h2>13. Availability and changes</h2>
      <p>We aim to keep the website and service available but do not guarantee uninterrupted operation. Hosting, authentication, payment and storage providers may experience outages or change their services. We may reschedule a campaign for tester availability, provider outages, security issues or other circumstances beyond reasonable control. If a change materially affects an active campaign, we will communicate with you and apply the refund policy where appropriate.</p>

      <h2>14. Liability</h2>
      <p>Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including any non-waivable consumer rights. To the maximum extent permitted by applicable law, we are not responsible for indirect or consequential losses, lost profits, loss of business opportunity, or Google's independent decisions. Where the law permits a cap, our total liability for a particular paid campaign will not exceed the amount paid for that campaign. This limitation does not apply where prohibited by law or to liability arising from fraud, wilful misconduct or other liability that cannot legally be limited.</p>

      <h2>15. Complaints and dispute resolution</h2>
      <p>Contact us first through <a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp support</a> with your account email and campaign reference. We will review the matter and respond through the available support channel. For customers in Kenya, these terms are governed by the laws of Kenya, subject to mandatory consumer protections that apply. Courts in Kenya may hear disputes, without restricting any mandatory right a consumer has to bring a claim in another competent jurisdiction.</p>

      <h2>16. Changes and severability</h2>
      <p>We may update these terms when the service or legal requirements change. The version and date will be displayed on this page. Material changes will not retrospectively reduce rights already accrued under a paid order unless required by law or agreed with you. If part of these terms is unenforceable, the remaining provisions continue to apply to the extent permitted by law.</p>

      <h2>17. Legal framework</h2>
      <p>These terms are intended to operate consistently with applicable Kenyan law, including the Consumer Protection Act, 2012, and mandatory consumer rules in the customer's country where applicable. The final text must be reviewed for the actual operating entity and target markets before live checkout is enabled. The official text is available from <a href="https://new.kenyalaw.org/akn/ke/act/2012/46/eng%402022-12-31/source" target="_blank" rel="noopener noreferrer">Kenya Law</a>.</p>

      <div className="prose-callout"><strong>Operator details still required:</strong> replace the bracketed legal name and address before launch. Confirm business registration/tax status, the final consumer cancellation and refund process, and that checkout records a retained copy of the accepted version. This draft is not a substitute for review by a Kenyan advocate.</div>
    </article></div></section>
  </>;
}
