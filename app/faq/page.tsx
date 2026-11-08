import type { Metadata } from "next";
import { faqs } from "@/lib/content";
import { CtaBanner } from "@/components/cta-banner";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about Android Testers pricing, tester participation, 15-day campaigns, Play Console setup, refunds, and production access.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
    <section className="page-hero"><div className="container"><span className="eyebrow">Help centre</span><h1>Questions before you launch?</h1><p>Understand the service boundaries, setup requirements, timing, and refund rules before placing an order.</p></div></section>
    <section className="content-section"><div className="container"><div className="faq-list">{faqs.map((faq) => <article className="faq-item" key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}</div><div className="prose" style={{ marginTop: 52 }}><h2>Still need help?</h2><p>Read the <a href="/testing-guide">Play Console setup guide</a> or visit the <a href="/contact">contact page</a> for the current support channel.</p></div></div></section>
    <CtaBanner title="Start with the right setup." description="The setup check is designed to catch problems before you pay." />
  </>;
}
