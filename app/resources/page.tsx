import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Android App Testing Resources",
  description: "Practical guides to Google Play closed testing, tester email lists, opt-in links, and preparing an Android app for production access.",
  alternates: { canonical: "/resources" },
};

const resources = [
  { tag: "Requirements", title: "Google Play's 12 testers and 14 days rule", description: "Who the continuous opt-in requirement applies to, what happens when testers opt out, and what the rule does not guarantee.", href: "/guides/google-play-closed-testing-requirements", read: "6 min read" },
  { tag: "Play Console", title: "How to add testers to a closed test", description: "Create an email list, choose country availability, publish your test, and share the opt-in link.", href: "/guides/add-testers-to-google-play", read: "5 min read" },
  { tag: "App readiness", title: "Preparing for Google Play production access", description: "A practical checklist for testing evidence, app quality, policy readiness, and honest production-access answers.", href: "/guides/prepare-for-production-access", read: "7 min read" },
  { tag: "Opt-in", title: "Find your closed-test opt-in link", description: "Locate the shareable tester link, check that the release is published, and troubleshoot common access errors.", href: "/guides/google-play-closed-test-opt-in-link", read: "6 min read" },
  { tag: "Timeline", title: "How the 14-day period works", description: "Understand continuous opt-in, tester interruptions, and the 15-day operational window.", href: "/guides/14-day-closed-testing-timeline", read: "7 min read" },
  { tag: "Readiness", title: "Production access preparation checklist", description: "Prepare app quality, policy compliance, meaningful feedback, and honest production-access answers.", href: "/guides/google-play-production-access-checklist", read: "8 min read" },
  { tag: "Setup", title: "Android Testers campaign setup guide", description: "The exact Play Console configuration expected before your $10 campaign can be approved.", href: "/testing-guide", read: "4 min read" },
];

export default function ResourcesPage() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Developer resources</span><h1>Understand the process before you publish.</h1><p>Practical, source-linked guidance for Android developers preparing a Google Play closed test and production-access application.</p></div></section>
    <section className="content-section"><div className="container"><div className="resource-grid">{resources.map((item) => <article className="resource-card" key={item.href}><span>{item.tag} · {item.read}</span><h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>Read the guide ↗</Link></article>)}</div></div></section>
  </>;
}
