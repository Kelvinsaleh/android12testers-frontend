import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "WhatsApp Support",
  description: "Contact Android Testers on WhatsApp for help with Play Console setup, campaign timing, payments, or an existing campaign.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Customer support</span><h1>Talk to Android Testers.</h1><p>Our customer support channel is WhatsApp. Contact us about Play Console setup, campaign timing, payments, or an existing campaign.</p></div></section>
    <section className="content-section"><div className="container"><div className="auth-card" style={{ marginTop: 0 }}><h2>WhatsApp support</h2><p>Message our support team directly. Include your campaign reference when you are asking about an existing order.</p><a className="button button-dark whatsapp-contact-button" href={siteConfig.whatsappUrl} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L4 20l1.1-4a8.2 8.2 0 1 1 15.1-4.3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8.7 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .5l-.5.7c-.2.2-.2.4-.1.6.4.8 1 1.4 1.8 1.8.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5 0 .3-.2 1-.6 1.3-.4.4-1 .6-1.5.5-1-.2-2.1-.7-3.2-1.7-1.2-1-2-2.2-2.3-3.2-.2-.8.1-1.7.5-2.2Z" fill="currentColor"/></svg>
        Chat on WhatsApp
      </a><p className="whatsapp-number">{siteConfig.whatsappDisplayNumber}</p><p className="field-hint">Do not send Google passwords, Play Console passwords, payment card details, or other login credentials through WhatsApp.</p><p>For campaign-specific matters, you can also review the latest status in your customer dashboard after signing in.</p></div></div></section>
  </>;
}
