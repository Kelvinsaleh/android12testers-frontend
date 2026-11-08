import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in with Google to submit and manage Android app closed-testing campaigns.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Customer portal</span><h1>Your campaigns, in one place.</h1><p>Sign in with Google to submit apps, complete setup checks, pay securely, and track your 15-day testing campaign.</p></div></section>
    <section className="content-section"><div className="container"><div className="auth-card">
      <h2>Continue with Google</h2>
      <p>Android Testers uses Google sign-in for customer accounts. Signing in does not grant us access to your Play Console.</p>
      <GoogleSignInButton />
      <p className="field-hint" style={{ marginTop: 18 }}>We never ask for your Google password or Play Console credentials. Read the <Link href="/privacy" className="text-link">privacy notice</Link> and <Link href="/terms" className="text-link">service terms</Link>.</p>
    </div></div></section>
  </>;
}
