"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/dashboard`,
        disableRedirect: true,
      });

      if (result.error) {
        throw new Error(
          result.error.message || "Google authentication could not be started."
        );
      }

      const authorizationUrl = result.data?.url;

      if (!authorizationUrl) {
        throw new Error(
          "Neon Auth did not return a Google authorization URL."
        );
      }

      const destination = new URL(authorizationUrl);

      if (destination.protocol !== "https:") {
        throw new Error("Invalid authentication redirect URL.");
      }

      window.location.assign(destination.toString());

    } catch (reason) {
      console.error("Google sign-in failed:", reason);

      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to connect to Google. Please try again."
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
        style={{
          width: "100%",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <span aria-hidden="true" className="google-glyph">
          G
        </span>

        {busy ? "Connecting to Google…" : "Continue with Google"}
      </button>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}