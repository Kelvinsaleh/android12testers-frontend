"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/dashboard` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Google sign-in could not be started.");
      setBusy(false);
    }
  }

  return <div>
    <button type="button" className="button button-dark" onClick={signIn} disabled={busy} style={{ width: "100%", opacity: busy ? .7 : 1 }}>
      <span aria-hidden="true" className="google-glyph">G</span>{busy ? "Connecting to Google…" : "Continue with Google"}
    </button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
