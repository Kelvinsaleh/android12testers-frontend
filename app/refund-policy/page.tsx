import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund and Retest Policy",
  description: "When Android Testers offers a repeat campaign or refund, including service delivery failures and Google Play production-access outcomes.",
  alternates: { canonical: "/refund-policy" },
};

const whatsapp = "https://wa.me/254742608319?text=Hello%20Android%20Testers%2C%20I%20would%20like%20to%20request%20a%20refund%20or%20retest%20review.";

export default function RefundPolicyPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Customer protection</span><h1>Refund and retest policy.</h1><p>What happens when a campaign cannot be delivered as agreed or a Google Play production-access application is declined.</p></div></section>
    <section className="content-section"><div className="container"><article className="prose">
      <div className="prose-callout"><strong>Publication checklist:</strong> This is the operating-policy draft dated 8 November 2026. It must be checked against mandatory consumer rights in Kenya and the countries where customers are served before live payments begin.</div>
      <p><strong>Version:</strong> 2026-11-08-v1 · <strong>Draft date:</strong> 8 November 2026.</p>

      <h2>1. What you purchase</h2>
      <p>One standard campaign costs <strong>US$10</strong> and includes coordination of 12 human tester accounts over 15 consecutive days. The campaign period begins only after all 12 testers have been confirmed as opted in and the start has been recorded. Payment puts the campaign into the scheduling queue; it does not, by itself, begin testing.</p>

      <h2>2. If you cancel before the campaign starts</h2>
      <p>If the 12-person campaign has not started, contact us through <a href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp support</a> with your campaign reference. We will stop the order where possible and refund the campaign fee, subject to payment-provider processing and any mandatory legal requirements. If the provider has already begun processing a payment, the refund may take additional time to appear on your card or bank statement.</p>

      <h2>3. If Android Testers fails to deliver</h2>
      <p>If we fail to deliver the agreed 12-person, 15-consecutive-day campaign because of a failure on our side, you may choose one of the following remedies:</p>
      <ul><li><strong>One repeat campaign</strong> at no additional service charge, scheduled for the next available period; or</li><li><strong>A full refund of the US$10 campaign fee.</strong></li></ul>
      <p>If a tester opts out or becomes unavailable during the continuous period, we will not mark the campaign complete while the agreed delivery remains outstanding. We will review the record, restore the tester position where possible and restart the required continuity period as necessary.</p>

      <h2>4. If Google does not approve production access</h2>
      <p>Google makes the production-access decision. If the refusal is attributable to our failure to deliver the agreed tester participation or service duration, you may choose a repeat campaign or a full refund. Please provide the relevant Play Console notice or explanation so we can review it against the campaign records.</p>
      <p>If Google declines production access for reasons outside the testing service—such as app quality, policy compliance, developer-account standing, missing information, app readiness or the developer's production-access answers—the campaign fee is not automatically refundable. We can review the notice and explain whether a testing-delivery issue appears to be involved.</p>

      <h2>5. How to request a refund or retest</h2>
      <p>Submit the request from your Android Testers dashboard within <strong>14 calendar days</strong> after the campaign completion notice. Include your campaign reference, a clear explanation and the relevant Play Console notice if your request relates to production access. Select your preferred remedy: repeat campaign or refund. Only the account owner can submit a request for that account.</p>
      <p>The administrator reviews the campaign record and supporting information. The administrator may approve the selected remedy or decline the request with an explanation. If additional information is required, we may ask you to provide it. Requests are handled individually; we do not promise that Google will change its decision.</p>

      <h2>6. Refund processing</h2>
      <p>Approved refunds are submitted through Paystack to the original payment method where supported. Paystack, the card network and the issuing bank control final processing and posting times. A refund may show as pending or processing before it appears in your account. We will update the campaign record when the provider confirms the outcome. If Paystack reports that it needs additional information or cannot complete the refund, we will contact you through the support channel.</p>

      <h2>7. What is not guaranteed</h2>
      <p>We do not guarantee Google Play production access, publication, a particular review result, positive feedback, ratings, reviews, a specific download count or a specific app-store ranking. We do not fabricate testing activity or sell artificial engagement. A completed campaign does not remove your responsibility to meet Google Play requirements.</p>

      <h2>8. Consumer rights</h2>
      <p>This policy does not exclude or reduce any mandatory refund, cancellation or other consumer rights that apply under the laws governing your purchase. If a provision of this policy conflicts with a non-waivable legal right, that legal right prevails.</p>

      <h2>9. Contact</h2>
      <p>Contact <a href={whatsapp} target="_blank" rel="noopener noreferrer">Android Testers support on WhatsApp at +254 742 608 319</a>. Include the email address used to sign in and the campaign reference. Do not send passwords or card security details.</p>
    </article></div></section>
  </>;
}
