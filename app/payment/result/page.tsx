import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Payment Status", robots: { index: false, follow: false } };

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const success = status === "success";
  const pending = status === "pending";
  return <section className="content-section"><div className="container"><div className="portal-card result-card">
    <span className="eyebrow">Paystack checkout</span>
    <h1>{success ? "Payment verified." : pending ? "Payment confirmation pending." : "Payment could not be verified."}</h1>
    <p>{success ? "Paystack confirmed your $10 USD transaction. Your campaign is now in the paid queue; the 15-day clock has not started yet." : pending ? "We have not yet confirmed the transaction. Check your customer dashboard before retrying. Do not pay again until its payment status is clear." : "The payment reference could not be verified. Open your dashboard to check the latest status or contact support."}</p>
    <Link href="/dashboard" className="button button-dark">Open customer dashboard</Link>
  </div></div></section>;
}
