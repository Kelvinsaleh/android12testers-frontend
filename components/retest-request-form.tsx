"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RetestRequestForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/retests`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: data.get("reason"), requestedRemedy: data.get("requestedRemedy"), evidenceUrl: data.get("evidenceUrl") || "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit the request.");
      router.refresh(); setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit the request.");
    } finally { setBusy(false); }
  }
  return <div className="retest-form-wrap">
    {!open ? <button className="button button-outline button-small" type="button" onClick={() => setOpen(true)}>Request retest or refund review</button> :
      <form className="portal-form compact-form" onSubmit={submit}>
        <label>Preferred resolution<select name="requestedRemedy" defaultValue="retest"><option value="retest">Repeat the 15-day test campaign</option><option value="refund">Refund the $10 campaign fee</option></select></label>
        <label>Explain what happened<textarea name="reason" required minLength={20} maxLength={1500} rows={4} placeholder="Describe the production-access result and why you are requesting a review." /></label>
        <label>Optional Google notice screenshot link<input name="evidenceUrl" type="url" placeholder="https://…" /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="button-row"><button className="button button-dark button-small" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button><button className="button button-outline button-small" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
        <p className="field-hint">Only the administrator can view this request. We will review the service record and your selected resolution; we will not substitute a different remedy without your agreement.</p>
      </form>}
  </div>;
}
