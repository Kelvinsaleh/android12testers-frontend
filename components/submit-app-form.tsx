"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type UploadedEvidence = { key: string; fileName: string; contentType: string; bytes: number };

export function SubmitAppForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testerEmails, setTesterEmails] = useState<string[]>([]);
  const [testerListMessage, setTesterListMessage] = useState("Loading the current tester list…");
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/tester-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The tester list is not available yet.");
        if (active) {
          setTesterEmails(data.testerEmails || []);
          setTesterListMessage("");
        }
      })
      .catch((reason) => {
        if (active) setTesterListMessage(reason instanceof Error ? reason.message : "The tester list is not available yet.");
      });
    return () => { active = false; };
  }, []);

  async function copyTesterEmails() {
    try {
      await navigator.clipboard.writeText(testerEmails.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access was blocked. Select and copy the addresses manually.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    const files = form.getAll("evidence").filter((item): item is File => item instanceof File && item.size > 0);
    if (testerEmails.length !== 12) {
      setBusy(false);
      setError("The 12 tester addresses are not configured yet. Please return after the service team has added them.");
      return;
    }
    if (files.length < 2 || files.length > 4) {
      setBusy(false);
      setError("Upload 2 to 4 screenshots: one showing the saved tester email list and one showing Kenya availability.");
      return;
    }
    try {
      const uploaded: UploadedEvidence[] = [];
      for (const file of files) {
        const upload = new FormData();
        upload.set("file", file);
        const response = await fetch("/api/uploads", { method: "POST", body: upload });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not upload ${file.name}.`);
        uploaded.push(data as UploadedEvidence);
      }
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: String(form.get("appName") || ""),
          packageName: String(form.get("packageName") || ""),
          optInUrl: String(form.get("optInUrl") || ""),
          kenyaAvailable: form.get("kenyaAvailable") === "on",
          emailListConfigured: form.get("emailListConfigured") === "on",
          evidenceKeys: uploaded.map((item) => item.key),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Submission failed.");
      setMessage("Your app has been submitted for setup review. Payment becomes available after approval.");
      formRef.current?.reset();
      router.push("/dashboard?submitted=1");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="portal-form" ref={formRef} onSubmit={onSubmit}>
    <div className="form-grid">
      <label>App name<input name="appName" required minLength={2} maxLength={100} placeholder="e.g. Budget Buddy" /></label>
      <label>Android package name<input name="packageName" required pattern="[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+" placeholder="com.example.budgetbuddy" /></label>
    </div>
    <label>Closed-test opt-in link<input name="optInUrl" type="url" required placeholder="https://play.google.com/apps/testing/..." /></label>
    <div className="tester-list-panel">
      <div className="portal-card-heading"><div><strong>Your 12 tester Google accounts</strong><p>Add every address below to the closed-test email list in Play Console before submitting.</p></div>
        {testerEmails.length === 12 && <button type="button" className="button button-outline button-small" onClick={copyTesterEmails}>{copied ? "Copied" : "Copy all 12"}</button>}
      </div>
      {testerEmails.length === 12 ? <ol className="tester-email-list">{testerEmails.map((email) => <li key={email}><code>{email}</code></li>)}</ol> : <p className="field-hint" role="status">{testerListMessage}</p>}
      <p className="field-hint">These addresses are shown only to signed-in, verified customers because you need them to configure your closed test. Do not add other testers to this campaign.</p>
    </div>
    <div className="form-checks">
      <label><input name="emailListConfigured" type="checkbox" required /> I have added the 12 tester email addresses to the closed-test email list and saved it.</label>
      <label><input name="kenyaAvailable" type="checkbox" required /> Kenya is included in the country availability for this closed test.</label>
    </div>
    <label>Setup screenshots <span className="field-hint">Upload 2–4 PNG, JPEG, or WebP images. Maximum 4 MB each.</span>
      <input name="evidence" type="file" accept="image/png,image/jpeg,image/webp" multiple required />
    </label>
    <div className="prose-callout"><strong>Privacy:</strong> screenshots are private and visible only to the administrator reviewing your submission. Blur unrelated personal or account information. Never upload passwords, recovery codes, payment details, or two-factor codes.</div>
    {message && <p className="form-success" role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" type="submit" disabled={busy || testerEmails.length !== 12}>{busy ? "Uploading and submitting…" : "Submit for setup review"}</button>
    <p className="field-hint">You will not be charged at this stage. We review the setup first, then unlock the fixed $10 USD checkout.</p>
  </form>;
}
