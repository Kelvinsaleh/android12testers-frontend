"use client";
import Link from "next/link";
import { useState } from "react";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export function CheckoutButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function checkout() {
    if (!accepted) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start checkout.");
      if (typeof data.authorizationUrl !== "string" || !data.authorizationUrl.startsWith("https://checkout.paystack.com/")) {
        throw new Error("Paystack did not return a valid checkout address.");
      }
      window.location.assign(data.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout failed.");
      setBusy(false);
    }
  }
  return <div>
    <div className="form-checks" style={{ marginBottom: 12 }}>
      <label><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} /> I have read and agree to the <Link href="/terms" className="text-link">Terms of Service</Link> and acknowledge the <Link href="/privacy" className="text-link">Privacy Policy</Link> and <Link href="/refund-policy" className="text-link">Refund and Retest Policy</Link>.</label>
    </div>
    <button type="button" className="button button-dark button-small" disabled={busy || !accepted} onClick={checkout}>{busy ? "Opening Paystack…" : "Pay $10 USD"}</button>
    <p className="field-hint">Your agreement to the displayed policy versions is recorded with this campaign before checkout begins. Payment is confirmed only after server-side verification.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
