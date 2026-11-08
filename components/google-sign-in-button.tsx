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
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      console.error("Android Testers Google authentication:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Please try again."
      );

      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="button button-dark"
        onClick={signIn}
        disabled={busy}
        style={{ width: "100%", opacity: busy ? 0.7 : 1 }}
      >
        <span className="google-glyph">G</span>
        {busy ? "Connecting to Google..." : "Continue with Google"}
      </button>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}