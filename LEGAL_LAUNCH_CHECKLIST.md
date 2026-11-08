# Android Testers — legal publication checklist

The `/privacy`, `/terms`, and `/refund-policy` routes are service-specific working drafts. They are not a legal opinion and must not be presented as final while the operator identity placeholders remain.

## Required before live checkout

- [ ] Replace `[INSERT THE LEGAL NAME ...]` with the actual individual or registered entity operating Android Testers.
- [ ] Add the correct physical or registered business address.
- [ ] Confirm the legal form, registration details (if any), and tax disclosures that must appear on the website and payment receipt.
- [ ] Confirm with the Office of the Data Protection Commissioner (ODPC) whether the operator must register as a data controller and/or processor or qualifies for an exemption. Do not assume exemption based only on being a small start-up.
- [ ] Review the controller/processor roles and put appropriate processing terms in place with Google/Neon Auth, Neon, Vercel, Render, Paystack, Cloudflare R2, WhatsApp/Meta and Resend if enabled.
- [ ] Confirm the actual data-centre/processing regions selected in each provider account. Document the legal basis and safeguards for personal data transferred outside Kenya before production processing begins.
- [ ] Confirm that the retention schedule in the privacy notice is operationally achievable and consistent with tax, accounting, dispute and data-protection requirements.
- [ ] Review the $10 USD price display, possible bank FX fees, tax treatment, cancellation wording, refund procedure and service-start queue disclosures.
- [ ] Have a Kenyan advocate review the Terms of Service, Privacy Policy and Refund and Retest Policy, including the Consumer Protection Act requirements for online agreements and customers in other target countries.
- [ ] Confirm that customers can retain a copy of the agreement presented at checkout and that the business can retrieve the exact historical text associated with each recorded version.
- [ ] Keep `lib/legal.ts` version identifiers in sync with the Rust constants. Increment both identifiers whenever the corresponding legal text changes, and archive the prior text before publishing the new version.
- [ ] Apply database migration `0007_legal_acceptance.sql`. Checkout must fail when the customer has not acknowledged the current versions.

## Current policy assumptions encoded in the site

- One campaign costs US$10.
- A standard campaign coordinates 12 human tester accounts over 15 consecutive days.
- The campaign clock starts only after all 12 testers are confirmed opted in.
- The same 12-person pool supports one enrolling/running campaign at a time; paid campaigns may queue.
- If Android Testers fails to deliver the agreed testing service, the customer may choose one repeat campaign or a full campaign-fee refund.
- A Google production-access rejection for reasons unrelated to our testing delivery does not automatically trigger a refund.
- Customer support and privacy requests are routed through WhatsApp at +254742608319.
- The administrator account is `sksalee071@gmail.com`.

These assumptions should be changed only through a deliberate business-policy decision followed by matching code, database and legal-document updates.

## Official references to review

- Kenya Data Protection Act and subsidiary regulations: https://www.odpc.go.ke/data-protection-laws-kenya/
- ODPC data-subject rights: https://www.odpc.go.ke/rights-of-a-data-subject/index.html
- ODPC registration guidance and FAQs: https://www.odpc.go.ke/faqs/
- Kenya Consumer Protection Act: https://new.kenyalaw.org/akn/ke/act/2012/46/eng%402022-12-31/source
