import { siteConfig } from "@/lib/site";

export function WhatsAppSupport() {
  return (
    <a
      className="whatsapp-fab"
      href={siteConfig.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with Android Testers support on WhatsApp at ${siteConfig.whatsappDisplayNumber}`}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L4 20l1.1-4a8.2 8.2 0 1 1 15.1-4.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8.7 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4 0 .5l-.5.7c-.2.2-.2.4-.1.6.4.8 1 1.4 1.8 1.8.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5 0 .3-.2 1-.6 1.3-.4.4-1 .6-1.5.5-1-.2-2.1-.7-3.2-1.7-1.2-1-2-2.2-2.3-3.2-.2-.8.1-1.7.5-2.2Z" fill="currentColor" />
      </svg>
      <span>WhatsApp support</span>
    </a>
  );
}
