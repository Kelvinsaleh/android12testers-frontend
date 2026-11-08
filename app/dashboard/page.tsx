import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { fetchBackendAsUser } from "@/lib/backend-proxy";
import { CheckoutButton } from "@/components/checkout-button";
import { PaymentStatusButton } from "@/components/payment-status-button";
import { RetestRequestForm } from "@/components/retest-request-form";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer Dashboard", robots: { index: false, follow: false } };

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string | Date | null) => value ? new Date(value).toLocaleString() : "Not started";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const response = await fetchBackendAsUser(user, "/api/apps", { method: "GET" });
  const data = await response.json().catch(() => ({}));
  const campaigns = response.ok && Array.isArray(data.campaigns) ? data.campaigns : [];
  const loadError = response.ok ? null : (typeof data.error === "string" ? data.error : "Campaign information is temporarily unavailable.");

  return <section className="content-section"><div className="container portal-container">
    <div className="portal-section-heading"><div><span className="eyebrow">Customer dashboard</span><h1 className="portal-title">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1><p className="portal-intro">Manage your submissions, payment status, campaign progress, and retest requests.</p></div><SignOutButton /></div>
    <div className="portal-actions"><Link href="/submit" className="button button-dark">Submit another app</Link><span className="field-hint">Signed in as {user.email}</span></div>
    {loadError ? <div className="portal-card"><p className="form-error">{loadError}</p><p>Refresh this page in a moment. Your campaign data has not been changed.</p></div> : campaigns.length === 0 ? <div className="portal-card empty-state"><h2>No campaigns yet.</h2><p>Submit your first app and we will review the Play Console setup before payment.</p><Link href="/submit" className="button button-dark">Start a campaign</Link></div> :
      <div className="admin-card-list">{campaigns.map((campaign: any) => <article className="portal-card" key={campaign.id}>
        <div className="portal-card-heading"><div><h2>{campaign.app_name}</h2><p>{campaign.package_name}</p></div><span className={`status-pill status-${campaign.status}`}>{label(campaign.status)}</span></div>
        <div className="admin-meta-grid"><div><small>Price</small><strong>{campaign.is_comped_retest ? "Complimentary" : "$10 USD"}</strong></div><div><small>Payment</small><strong>{campaign.is_comped_retest ? "Not required" : label(campaign.payment_status || "not due")}</strong></div><div><small>Tester opt-ins</small><strong>{campaign.opted_in_count}/12</strong></div><div><small>Campaign started</small><strong>{date(campaign.actual_start_at)}</strong></div><div><small>Expected end</small><strong>{date(campaign.actual_end_at)}</strong></div><div><small>Submitted</small><strong>{date(campaign.created_at)}</strong></div></div>
        {campaign.admin_note && <div className="prose-callout"><strong>Setup review note:</strong> {campaign.admin_note}</div>}
        {campaign.status === "awaiting_review" && <p className="field-hint">Your setup is waiting for review. Payment is not required yet.</p>}
        {campaign.status === "needs_changes" && <p className="field-hint">We need a setup correction. Follow the review note, update your Play Console setup, then submit the corrected campaign again.</p>}
        {campaign.status === "awaiting_payment" && <div className="checkout-area"><p>Your setup has passed review. Complete the secure Paystack checkout to join the campaign queue.</p><CheckoutButton campaignId={campaign.id} /></div>}
        {campaign.status === "payment_pending" && <><p className="field-hint">Payment is being confirmed. Do not pay again until the provider status is checked.</p>{campaign.provider_reference && <PaymentStatusButton reference={campaign.provider_reference} />}</>}
        {campaign.status === "paid_queued" && <p className="field-hint">Payment confirmed. Your campaign is queued while the 12-person tester pool is scheduled.</p>}
        {campaign.status === "enrolling" && <p className="field-hint">The team is confirming all 12 opt-ins. The 15-day clock starts only after all 12 have joined.</p>}
        {campaign.status === "running" && <div className="progress-panel"><strong>15-day campaign in progress</strong><p>Confirmed tester opt-ins: {campaign.opted_in_count}/12. Started: {date(campaign.actual_start_at)} · Scheduled end: {date(campaign.actual_end_at)}.</p></div>}
        {campaign.status === "completed" && <><div className="prose-callout"><strong>Campaign completed.</strong> {campaign.completion_summary || "The campaign record is complete. You can now apply your own judgement when preparing a production-access application."}</div>{campaign.latest_retest_status === "pending" || campaign.latest_retest_status === "processing" ? <p className="field-hint">A retest / refund review request is awaiting the administrator.</p> : campaign.latest_retest_status && <p className="field-hint">Latest request: {label(campaign.latest_retest_status)}{campaign.latest_retest_note ? ` — ${campaign.latest_retest_note}` : ""}</p>}{!campaign.is_comped_retest && (!campaign.latest_retest_status || campaign.latest_retest_status === "declined") && <RetestRequestForm campaignId={campaign.id} />}</>}
        {campaign.status === "refund_pending" && <p className="field-hint">{campaign.refund_status === "needs_attention" ? "Paystack needs additional information to continue processing this refund. Contact support so the required next step can be reviewed." : campaign.refund_status === "processing" ? "Paystack's processor is handling your refund. Your bank or card provider may take additional time to display the funds." : "Your refund has been submitted to Paystack and is awaiting processing."}</p>}
        {campaign.status === "refunded" && <p className="form-success">Paystack has confirmed the refund as processed.</p>}
      </article>)}</div>}
  </div></section>;
}
