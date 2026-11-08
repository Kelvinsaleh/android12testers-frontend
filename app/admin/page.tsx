import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminDashboard } from "@/components/admin-dashboard";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.isAdmin) redirect("/dashboard?notice=not-authorised");
  return <section className="content-section"><div className="container portal-container">
    <div className="portal-section-heading"><div><span className="eyebrow">Sole administrator · verified owner account</span><h1 className="portal-title">Operations console.</h1><p className="portal-intro">Signed in as {user.email}. Retest requests, tester identities, and operational controls are restricted to this account.</p></div><SignOutButton /></div>
    <AdminDashboard />
  </div></section>;
}
