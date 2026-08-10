import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

type Section = { title: string; paragraphs?: string[]; bullets?: string[] };

const LAST_UPDATED = "August 10, 2026";

const privacySections: Section[] = [
  {
    title: "1. Who We Are",
    paragraphs: [
      "California Cricket Academy (\"CCA,\" \"we,\" \"us,\" or \"our\") is a California nonprofit youth cricket academy and league. This Privacy Policy explains how we collect, use, disclose, and protect information through calcricket.org, parent and coach portals, registrations, donations, communications, and academy activities.",
      "The website and parent portal are intended for adults. A parent or legal guardian must create the account and provide information about a minor participant.",
    ],
  },
  {
    title: "2. Information We Collect",
    bullets: [
      "Parent or guardian information: name, email, telephone number, password credentials, mailing address, profile photo, account status, and communications preferences.",
      "Participant information supplied by a parent or guardian: name, date of birth, gender, school, medical notes, profile photo, program and batch selections, attendance, coach notes, messages, and optional fitness entries such as height, weight, and BMI history.",
      "Registration and transaction information: programs, schedules, students, waiver consent and signature, coupon use, payment method, payment status, transaction identifiers, invoices, refunds, and purchase history.",
      "Donation information: donor name and email when provided, donation amount, payment status, and transaction identifier.",
      "Messages and support information: parent, coach, and administrator messages; inquiries; chatbot prompts; and information voluntarily entered into support or registration tools.",
      "Technical information: IP address, browser and device information, request logs, session and security events, and cookies needed for authentication, fraud prevention, and site operation.",
    ],
  },
  {
    title: "3. How We Use Information",
    bullets: [
      "Create and secure accounts; register participants; manage schedules, attendance, rosters, coaching, and academy operations.",
      "Process and verify payments, donations, discounts, refunds, and receipts.",
      "Communicate with parents, participants, coaches, and administrators about programs, payments, schedule changes, safety, and support.",
      "Provide parent and coach portal features, messaging, reports, and optional chatbot assistance.",
      "Maintain participant safety, respond to emergencies, prevent fraud or misuse, enforce our agreements, and comply with legal obligations.",
      "Use photographs, video, names, likenesses, or voice for academy communications and promotion only when authorized through the applicable consent or release.",
      "Improve our programs, website, accessibility, and service reliability using aggregated or operational information.",
    ],
  },
  {
    title: "4. Children’s Privacy and Parental Control",
    paragraphs: [
      "CCA serves children, but account creation, enrollment, payments, and submission of a child’s information must be completed by a parent or legal guardian. Children should not independently submit personal information through the website or chatbot.",
      "A parent or guardian may request access to, correction of, or deletion of their child’s information, or withdraw consent to future collection or use, by contacting us. We may verify identity and authority before completing a request. Some records may be retained when reasonably necessary for safety, legal, accounting, dispute, or insurance purposes.",
    ],
  },
  {
    title: "5. How We Share Information",
    paragraphs: ["We disclose information only as reasonably necessary for the purposes described in this policy, including to:"],
    bullets: [
      "Coaches, authorized staff, volunteers, and administrators who need it to operate programs and protect participants.",
      "Payment providers such as Stripe and PayPal. CCA does not receive or store complete payment-card numbers or security codes.",
      "Hosting, database, email, file-storage, analytics, communications, chatbot, and technical-support providers acting on our behalf.",
      "Schools, facilities, leagues, tournament organizers, travel providers, insurers, emergency responders, or other operational partners when necessary and appropriately authorized.",
      "Government authorities, courts, or other parties when required by law or reasonably necessary to protect rights, safety, and security.",
    ],
  },
  {
    title: "6. Sale, Sharing, and Advertising",
    paragraphs: [
      "CCA does not sell personal information for money. We do not knowingly sell the personal information of children. The site may load services supplied by payment, communications, font, chatbot, or media providers, which may process device or usage information under their own privacy terms. Where applicable law treats a particular disclosure as a sale or sharing, you may contact us to exercise an available opt-out right.",
    ],
  },
  {
    title: "7. Cookies and Sessions",
    paragraphs: [
      "We use cookies and similar browser storage needed to keep users signed in, protect refresh tokens, remember carts and registration drafts, maintain security, and operate the website. Disabling required storage may prevent account, cart, checkout, or portal features from working.",
    ],
  },
  {
    title: "8. Retention and Security",
    paragraphs: [
      "We retain information for as long as reasonably necessary to provide services, maintain registration and financial records, meet legal or insurance obligations, resolve disputes, and protect participants and CCA. Retention periods vary by record type.",
      "We use administrative, technical, and organizational safeguards designed to protect information, including access controls, encrypted connections, hashed passwords, restricted portals, and payment processing by established providers. No system can guarantee absolute security.",
    ],
  },
  {
    title: "9. Your Privacy Choices",
    paragraphs: [
      "Depending on where you live and which laws apply, you may have rights to request access, correction, deletion, or a copy of personal information; learn about disclosures; limit certain uses of sensitive information; or opt out of sale or sharing. CCA will not discriminate against you for exercising an applicable privacy right. We may verify your identity and may deny or limit a request where permitted by law.",
    ],
  },
  {
    title: "10. Third-Party Services and Links",
    paragraphs: [
      "Our website may link to or embed services operated by third parties. Their collection and use of information is governed by their own terms and privacy notices. Review those notices before providing information directly to a third party.",
    ],
  },
  {
    title: "11. Policy Changes",
    paragraphs: ["We may update this policy as our services or legal obligations change. We will post the revised policy with a new last-updated date and provide additional notice when appropriate."],
  },
  {
    title: "12. Contact Us",
    paragraphs: ["For privacy questions or requests, contact California Cricket Academy at calcricket_academy@yahoo.com or +1 (408) 203-3594. Please do not send medical details, passwords, or payment-card information by ordinary email."],
  },
];

const termsSections: Section[] = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: ["These Terms & Conditions (\"Terms\") govern use of the CCA website, accounts, portals, registrations, donations, communications, and online services. By using the services, creating an account, registering a participant, or making a payment, you agree to these Terms and any policies or agreements presented during enrollment."],
  },
  {
    title: "2. Parent and Guardian Responsibility",
    paragraphs: ["You must be at least 18 years old and legally authorized to act for each minor participant you register. You are responsible for providing accurate, current information and for reviewing program requirements, schedules, waivers, medical considerations, and communications on the participant’s behalf."],
  },
  {
    title: "3. Accounts and Security",
    bullets: [
      "Keep account credentials confidential and notify CCA promptly of suspected unauthorized access.",
      "Do not impersonate another person, register a child without authority, interfere with the website, bypass security, scrape protected information, or use the services unlawfully.",
      "CCA may suspend or terminate access when reasonably necessary to protect participants, users, systems, or academy operations.",
    ],
  },
  {
    title: "4. Programs, Schedules, and Participation",
    paragraphs: [
      "Program descriptions, coaches, venues, schedules, capacity, and availability may change because of weather, facility availability, safety, enrollment, tournaments, or operational needs. CCA will make reasonable efforts to communicate material changes.",
      "Participants and guardians must follow academy, coach, facility, league, tournament, health, safety, and conduct rules. CCA may restrict participation when conduct creates a safety, integrity, or operational concern.",
    ],
  },
  {
    title: "5. Registration, Pricing, and Payment",
    bullets: [
      "Registration is not complete until required information, consent, and payment or approved check arrangements are received and confirmed.",
      "Prices, discounts, coupon eligibility, and availability are shown at checkout and may change before an order is submitted.",
      "Payments are processed through third-party providers such as Stripe and PayPal. Their terms may also apply.",
      "You authorize CCA and its payment provider to charge the displayed amount and to issue transaction communications and receipts.",
    ],
  },
  {
    title: "6. Cancellations and Refunds",
    paragraphs: [
      "Unless a specific program states otherwise, annual-program cancellation requests made within two weeks of the first scheduled class are eligible for a full refund less a $100 non-refundable processing fee; requests made between two and four weeks after the first scheduled class are eligible for a 50% refund; and requests made more than four weeks after the first scheduled class are not eligible for a refund.",
      "Program-specific, camp, tournament, travel, donation, or third-party fees may have different or non-refundable terms disclosed at registration. Approved refunds are returned through the available original payment method where practicable.",
    ],
  },
  {
    title: "7. Waiver, Medical Consent, and Media Release",
    paragraphs: ["Cricket and related activities involve inherent risks. Enrollment may require acceptance of a separate waiver, release, medical authorization, media consent, and electronic signature. Those enrollment terms are incorporated into these Terms and control for the subjects they address. If you do not agree, do not complete registration or allow participation."],
  },
  {
    title: "8. Donations",
    paragraphs: ["Donations support CCA’s nonprofit mission and projects described on the donation page. Donations are generally final except where a refund is required by law or approved by CCA. Consult your tax adviser regarding deductibility; CCA does not provide individual tax advice."],
  },
  {
    title: "9. Communications and User Content",
    paragraphs: ["You may receive transactional messages concerning accounts, registrations, payments, attendance, schedules, safety, and support. You are responsible for content you submit through messages, forms, uploads, or chat tools and must not submit unlawful, harmful, infringing, or unnecessarily sensitive information."],
  },
  {
    title: "10. Intellectual Property",
    paragraphs: ["The website, academy branding, text, graphics, software, and other CCA-provided content are owned by or licensed to CCA and may not be copied, republished, sold, or exploited without permission, except for ordinary personal use of the services."],
  },
  {
    title: "11. Third-Party Services",
    paragraphs: ["CCA is not responsible for third-party websites, payment services, facilities, or tools outside its control. Third-party terms and privacy notices may apply. Links or integrations do not necessarily constitute endorsement."],
  },
  {
    title: "12. Disclaimers and Limitation",
    paragraphs: ["To the fullest extent permitted by law, online services are provided on an “as available” basis without a guarantee of uninterrupted or error-free operation. Nothing in these Terms excludes liability that cannot legally be excluded. Additional activity-related releases and limitations appear in the enrollment waiver."],
  },
  {
    title: "13. Governing Law and Disputes",
    paragraphs: ["These Terms are governed by California law. Any dispute provisions, arbitration agreement, or class-action waiver accepted in the enrollment waiver apply to enrollment and participation disputes to the extent enforceable. Before starting formal proceedings, please contact CCA and allow a reasonable opportunity to resolve the concern."],
  },
  {
    title: "14. Changes and Contact",
    paragraphs: ["CCA may update these Terms by posting a revised version and date. Material changes apply prospectively unless otherwise stated or required by law. Questions may be sent to calcricket_academy@yahoo.com or +1 (408) 203-3594."],
  },
];

function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? privacySections : termsSections;
  const title = isPrivacy ? "Privacy Policy" : "Terms & Conditions";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [kind]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar />
      <div className="h-20" />
      <header className="bg-[var(--outfield)] px-6 py-14 text-center text-white">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--gold)]">California Cricket Academy</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm text-white/60">Last updated: {LAST_UPDATED}</p>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          This document describes CCA’s current website and operational practices. It does not replace enrollment waivers or program-specific terms.
        </div>
        <article className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-[var(--outfield)]">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-slate-600">{paragraph}</p>)}
              {section.bullets && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
            </section>
          ))}
        </article>
      </main>
      <Footer />
    </div>
  );
}

export default LegalPage;
