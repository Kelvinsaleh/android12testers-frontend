"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  }
  return <button className="button button-outline button-small" type="button" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>;
}
