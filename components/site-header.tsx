import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/resources", label: "Resources" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link className="brand" href="/" aria-label="Android Testers home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>android<span className="brand-light">testers</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className="nav-actions">
          <Link className="nav-login" href="/sign-in">Sign in</Link>
          <Link className="button button-small button-dark" href="/sign-in">Start a campaign <ArrowUpRight /></Link>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Open navigation"><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            <Link href="/sign-in">Sign in / Start a campaign</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
