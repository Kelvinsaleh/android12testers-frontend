"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PaymentStatusButton({ reference }: { reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment status could not be checked.");
      if (data.status === "success") setMessage("Payment confirmed. Refreshing your campaign status.");
      else if (data.status === "failed") setMessage("Paystack confirmed that this attempt failed. You can now try checkout again.");
      else setMessage("Paystack has not confirmed a final result yet. Do not pay again; check again shortly.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment status could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="checkout-area">
    <button type="button" className="button button-outline button-small" disabled={busy} onClick={verify}>{busy ? "Checking Paystack…" : "Check payment status"}</button>
    {message && <p className="field-hint" role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
