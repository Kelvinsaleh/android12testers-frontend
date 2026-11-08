import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand-block">
          <Link className="brand brand-footer" href="/">
            <span className="brand-mark"><span /><span /><span /><span /></span>
            <span>android<span className="brand-light">testers</span></span>
          </Link>
          <p>Real people. Real app testing. A clearer path to your next release.</p>
        </div>
        <div className="footer-col"><span className="footer-heading">Explore</span><Link href="/how-it-works">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/testing-guide">Setup guide</Link><Link href="/resources">Developer resources</Link><Link href="/faq">FAQ</Link></div>
        <div className="footer-col"><span className="footer-heading">Resources</span><Link href="/guides/google-play-closed-testing-requirements">Testing requirements</Link><Link href="/guides/add-testers-to-google-play">Add testers in Play Console</Link><Link href="/guides/prepare-for-production-access">Production readiness</Link><Link href="/contact">Contact</Link><a href={siteConfig.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp support</a></div>
        <div className="footer-col"><span className="footer-heading">Policies</span><Link href="/terms">Terms of service</Link><Link href="/refund-policy">Refund policy</Link><Link href="/privacy">Privacy notice</Link></div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Android Testers. All rights reserved.</span>
        <span>Independent testing service. Not affiliated with Google.</span>
      </div>
    </footer>
  );
}
