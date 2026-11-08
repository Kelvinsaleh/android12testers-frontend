"use client";
import { useCallback, useEffect, useState } from "react";

type Tester = { id: string; testerId: string; email: string; status: string; checkins: number; lastConfirmedAt: string | null };
type Campaign = {
  id: string; status: string; created_at: string; actual_start_at: string | null; actual_end_at: string | null;
  is_comped_retest: boolean; payment_required: boolean; app_name: string; package_name: string; opt_in_url: string;
  setup_status: string; admin_note: string | null; customer_email: string; payment_status: string | null;
  setup_evidence: Array<{ key: string; fileName: string; contentType: string; url: string | null }>;
  assigned_testers: Tester[];
};
type Retest = { id: string; status: string; campaign_id: string; customer_reason: string; requested_remedy: "retest" | "refund"; evidence_url: string | null; created_at: string; app_name: string; package_name: string; customer_email: string; payment_status: string | null; refund_status: string | null };
type FailedWebhook = { id: string; event_type: string; provider_reference: string | null; attempts: number; last_error: string | null; received_at: string };

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function AdminDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [retests, setRetests] = useState<Retest[]>([]);
  const [failedWebhooks, setFailedWebhooks] = useState<FailedWebhook[]>([]);
  const [emails, setEmails] = useState("");
  const [activeTesterCount, setActiveTesterCount] = useState(0);
  const [poolLocked, setPoolLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignRes, retestRes, testerRes, webhookRes] = await Promise.all([
        fetch("/api/admin/campaigns", { cache: "no-store" }),
        fetch("/api/admin/retests", { cache: "no-store" }),
        fetch("/api/admin/testers", { cache: "no-store" }),
        fetch("/api/admin/webhook-events", { cache: "no-store" }),
      ]);
      const [campaignData, retestData, testerData, webhookData] = await Promise.all([campaignRes.json(), retestRes.json(), testerRes.json(), webhookRes.json()]);
      if (!campaignRes.ok || !retestRes.ok || !testerRes.ok || !webhookRes.ok) throw new Error(campaignData.error || retestData.error || testerData.error || webhookData.error || "Admin data could not be loaded.");
      setCampaigns(campaignData.campaigns || []);
      setRetests(retestData.requests || []);
      setFailedWebhooks(webhookData.events || []);
      setActiveTesterCount(testerData.activeCount || 0);
      setPoolLocked(Boolean(testerData.locked));
      setEmails((testerData.testers || []).filter((item: { active: boolean }) => item.active).map((item: { email: string }) => item.email).join("\n"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load admin data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function action(key: string, url: string, method: string, body: unknown) {
    setBusy(key); setError(null); setMessage(null);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");
      setMessage("Action completed.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed."); }
    finally { setBusy(null); }
  }

  async function saveTesterPool() {
    const values = emails.split(/[\n,;]/).map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (values.length !== 12 || new Set(values).size !== 12) { setError("Enter exactly 12 unique tester email addresses."); return; }
    await action("testers", "/api/admin/testers", "PUT", { emails: values });
  }

  function decideRetest(item: Retest, decision: "approve_retest" | "refund" | "decline") {
    const prompt = decision === "approve_retest" ? "Why is a complimentary retest approved?" : decision === "refund" ? "Add an internal reason for the full $10 refund." : "Explain why the request is declined.";
    const note = window.prompt(prompt, decision === "approve_retest" ? "Approved after service-delivery review." : "");
    if (!note || note.trim().length < 5) return;
    void action(`retest-${item.id}`, "/api/admin/retests", "PATCH", { id: item.id, decision, note });
  }

  if (loading) return <div className="portal-card"><p>Loading administrator workspace…</p></div>;
  return <div className="admin-workspace">
    {message && <p className="form-success" role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="portal-card">
      <div className="portal-card-heading"><div><span className="eyebrow">Private operations</span><h2>Tester pool</h2><p>Enter the 12 tester addresses before opening customer submissions. The list locks permanently after the first verified customer views it, preventing mismatches with Play Console email lists.</p></div><span className="status-pill">{activeTesterCount}/12 active</span></div>
      <label>12 Google account email addresses<textarea rows={6} value={emails} disabled={poolLocked} onChange={(event) => setEmails(event.target.value)} placeholder="tester01@gmail.com&#10;tester02@gmail.com&#10;…" /></label>
      <div className="button-row"><button className="button button-dark button-small" onClick={saveTesterPool} disabled={!!busy || poolLocked}>{busy === "testers" ? "Saving…" : poolLocked ? "Tester pool locked" : "Save 12-person pool"}</button><span className="field-hint">{poolLocked ? "A customer has already received the list. This pool is frozen so their Play Console tester list remains valid." : "Configure this once before accepting customers; edits lock on first customer access."}</span></div>
    </section>

    <section>
      <div className="portal-section-heading"><div><span className="eyebrow">Order management</span><h2>Campaigns</h2></div><button className="button button-outline button-small" onClick={() => void refresh()}>Refresh</button></div>
      {campaigns.length === 0 && <div className="portal-card"><p>No campaigns have been submitted yet.</p></div>}
      <div className="admin-card-list">
        {campaigns.map((campaign) => <article className="portal-card" key={campaign.id}>
          <div className="portal-card-heading"><div><h3>{campaign.app_name}</h3><p>{campaign.package_name} · {campaign.customer_email}</p></div><span className={`status-pill status-${campaign.status}`}>{pretty(campaign.status)}</span></div>
          <div className="admin-meta-grid"><div><small>Payment</small><strong>{campaign.payment_required ? pretty(campaign.payment_status || "not paid") : "Complimentary retest"}</strong></div><div><small>Created</small><strong>{new Date(campaign.created_at).toLocaleDateString()}</strong></div><div><small>Campaign clock</small><strong>{campaign.actual_start_at ? new Date(campaign.actual_start_at).toLocaleString() : "Not started"}</strong></div><div><small>Expected end</small><strong>{campaign.actual_end_at ? new Date(campaign.actual_end_at).toLocaleString() : "—"}</strong></div></div>
          <p><a href={campaign.opt_in_url} target="_blank" rel="noreferrer" className="text-link">Open tester opt-in link ↗</a></p>
          {campaign.setup_evidence?.length > 0 && <div className="evidence-links"><strong>Setup evidence</strong>{campaign.setup_evidence.map((item) => <a key={item.key} href={item.url || undefined} target="_blank" rel="noreferrer" aria-disabled={!item.url}>{item.fileName} {item.url ? "↗" : "(storage unavailable)"}</a>)}</div>}
          {campaign.admin_note && <p className="field-hint">Latest review note: {campaign.admin_note}</p>}
          {campaign.status === "awaiting_review" && <div className="button-row"><button className="button button-dark button-small" disabled={!!busy} onClick={() => void action(campaign.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "approve_setup", note: "Setup evidence reviewed." })}>Approve setup</button><button className="button button-outline button-small" disabled={!!busy} onClick={() => { const note = window.prompt("What must the customer change?"); if (note && note.trim().length >= 5) void action(campaign.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "request_changes", note }); }}>Request changes</button></div>}
          {campaign.status === "paid_queued" && <button className="button button-dark button-small" disabled={!!busy || activeTesterCount !== 12} onClick={() => void action(campaign.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "start_campaign" })}>{busy === campaign.id ? "Starting…" : "Assign 12 testers / begin enrollment"}</button>}
          {campaign.assigned_testers?.length > 0 && <div className="tester-admin-list"><strong>Assigned testers ({campaign.assigned_testers.length}/12)</strong>{campaign.assigned_testers.map((tester) => <div className="tester-admin-row" key={tester.id}><span><b>{tester.email}</b><small>{pretty(tester.status)} · {tester.checkins} daily check-ins</small></span><div className="button-row">{tester.status !== "opted_in" && campaign.status === "enrolling" && <button className="button button-outline button-small" disabled={!!busy} onClick={() => void action(tester.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "set_tester_status", campaignTesterId: tester.id, status: "opted_in" })}>Confirm opt-in</button>}{tester.status === "opted_in" && campaign.status === "running" && <><button className="button button-outline button-small" disabled={!!busy} onClick={() => { const note = window.prompt(`Record a genuine testing activity or feedback note for ${tester.email} (at least 10 characters).`); if (note && note.trim().length >= 10) void action(tester.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "daily_check_in", campaignTesterId: tester.id, note }); }}>Check in today</button><button className="button button-outline button-small" disabled={!!busy} onClick={() => { if (window.confirm("Confirm that this tester has opted out? The 15-day cohort clock will reset.")) void action(tester.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "set_tester_status", campaignTesterId: tester.id, status: "opted_out" }); }}>Opted out</button></>}</div></div>)}</div>}
          {campaign.status === "running" && <div className="button-row"><button className="button button-dark button-small" disabled={!!busy} onClick={() => { const summary = window.prompt("Write a short completion report summary (minimum 20 characters)."); if (summary && summary.length >= 20) void action(campaign.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { action: "complete_campaign", summary }); }}>Mark 15-day campaign complete</button><span className="field-hint">Completion requires 15 full days, all 12 testers still opted in, and 15 daily feedback notes per tester.</span></div>}
        </article>)}
      </div>
    </section>

    <section>
      <div className="portal-section-heading"><div><span className="eyebrow">Payment operations</span><h2>Failed webhook reconciliation</h2><p>Verified Paystack events are persisted before acknowledgement. Events that fail repeated processing attempts appear here for owner review.</p></div></div>
      {failedWebhooks.length === 0 ? <div className="portal-card"><p>No failed Paystack webhook events.</p></div> : <div className="admin-card-list">{failedWebhooks.map((event) => <article className="portal-card" key={event.id}>
        <div className="portal-card-heading"><div><h3>{pretty(event.event_type)}</h3><p>{event.provider_reference || "No provider reference"} · {new Date(event.received_at).toLocaleString()}</p></div><span className="status-pill status-refund_pending">Failed processing</span></div>
        <p className="field-hint">Attempts: {event.attempts}. {event.last_error || "No error detail recorded."}</p>
        <button className="button button-outline button-small" disabled={!!busy} onClick={() => void action(`webhook-${event.id}`, "/api/admin/webhook-events", "PATCH", { id: event.id })}>Retry event processing</button>
      </article>)}</div>}
    </section>

    <section>
      <div className="portal-section-heading"><div><span className="eyebrow">Owner-only queue</span><h2>Pending retest / refund requests</h2><p>Only the verified owner account can retrieve this queue or make decisions.</p></div></div>
      {retests.length === 0 && <div className="portal-card"><p>No pending requests.</p></div>}
      <div className="admin-card-list">{retests.map((item) => <article className="portal-card" key={item.id}>
        <div className="portal-card-heading"><div><h3>{item.app_name}</h3><p>{item.customer_email} · {item.package_name}</p></div><span className="status-pill">{pretty(item.status)}</span></div>
        <div className="prose-callout"><strong>Customer's chosen resolution:</strong> {item.requested_remedy === "refund" ? "Full $10 refund" : "Complimentary 15-day retest"}</div>
        <p>{item.customer_reason}</p>{item.evidence_url && <a className="text-link" href={item.evidence_url} target="_blank" rel="noreferrer">Open customer evidence ↗</a>}
        {item.status === "pending" ? <div className="button-row">{item.requested_remedy === "retest" ? <button className="button button-dark button-small" disabled={!!busy} onClick={() => decideRetest(item, "approve_retest")}>Approve complimentary retest</button> : <button className="button button-dark button-small" disabled={!!busy || item.payment_status !== "success"} onClick={() => decideRetest(item, "refund")}>Issue full $10 refund</button>}<button className="button button-outline button-small" disabled={!!busy} onClick={() => decideRetest(item, "decline")}>Decline</button></div> : <p className="field-hint">{item.refund_status === "needs_attention" ? "Paystack marked this refund as needing attention. Review it in your Paystack dashboard; do not issue another refund." : "This request is in provider reconciliation. Do not initiate another refund or retest until its status is confirmed in Paystack."}</p>}
      </article>)}</div>
    </section>
  </div>;
}
