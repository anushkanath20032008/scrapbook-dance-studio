import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { openConsentChoice } from "@/components/analytics";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice | ChoreoStudio" },
      { name: "description", content: "What personal data ChoreoStudio collects, why, who sees it, how long we keep it and how to use your rights." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Notice." windowTitle="Privacy.txt" updated="22 October 2026">
      <p>
        This notice explains what personal data ChoreoStudio ("we", "us") collects, why, who sees it, how long we keep
        it, and how you can use your rights under India's Digital Personal Data Protection Act, 2023 (the "DPDP Act").
        It is part of our <a href="/terms">Terms of Service</a>.
      </p>

      <h2>1. Who is responsible for what</h2>
      <ul>
        <li><strong>Studio owners, visitors and people who contact us.</strong> For your own data (your account, billing, earlier walkthrough requests, support messages and website visits), we are the Data Fiduciary.</li>
        <li><strong>Dancers.</strong> A studio enters its dancers' details into ChoreoStudio. For that data the studio is the Data Fiduciary and we are its Data Processor: we hold and process it only to run the service for that studio. If you are a dancer, your studio decides what it holds about you and why, so please ask it first. We will help the studio answer you.</li>
      </ul>

      <h2>2. What we collect and why</h2>
      <ul>
        <li><strong>Earlier walkthrough requests.</strong> The website no longer has this form. If you sent one before, we hold your studio name, WhatsApp number and the range of students you gave us, only to contact you about that request. You agreed by ticking a box, and you can opt out any time.</li>
        <li><strong>Studio owner account.</strong> Your name, email, studio name, phone and city, and your sign-in details. If you sign in with Google, we receive your name and email from Google. Why: to give you an account and the service. Passwords are handled by our sign-in provider and are not readable by us.</li>
        <li><strong>Subscription.</strong> Your plan, status and renewal date, and a customer reference from our payment partner. Card or UPI details go to Dodo Payments and are not seen or stored by us.</li>
        <li><strong>Dancer records entered by a studio.</strong> Dancer name and phone number, fees and charges, payments, attendance, class batches, and whether the dancer asked not to be messaged. Why: so the studio can track fees and classes and prepare reminders.</li>
        <li><strong>Payment notes from dancers.</strong> If a dancer tells a studio they have paid, we keep the amount, the date, the method, an optional reference number and an optional screenshot, so the studio can check it. Screenshots can show a name, UPI ID or phone number, so please send one only if you are comfortable.</li>
        <li><strong>Telegram (only if your studio switches it on).</strong> The Telegram chat identifier of a dancer who joined the bot, and what they type to it, such as "paid".</li>
        <li><strong>Technical records.</strong> Basic logs kept by our hosting and database providers for security and fixing faults.</li>
        <li><strong>Website analytics (only if you allow it).</strong> See section 7.</li>
      </ul>
      <p>We use data only for the purposes above. We do not sell it, and we do not use it for advertising.</p>

      <h2>3. Why we may use it</h2>
      <p>
        We rely on your consent (for example the analytics choice), and on the fact that you
        gave us the data voluntarily for a stated purpose, such as signing up. You can withdraw consent at any time. It
        should be as easy to withdraw as it was to give, and doing so does not affect anything done before.
      </p>

      <h2>4. Who we share it with</h2>
      <p>We share data only with the providers we need to run the service, and only for that purpose:</p>
      <ul>
        <li>Supabase: database and sign-in, in the Mumbai region of India.</li>
        <li>Vercel: hosting of the website and app.</li>
        <li>Dodo Payments: subscription billing.</li>
        <li>Zoho: our support email.</li>
        <li>Telegram: only if a studio uses the Telegram bot.</li>
        <li>Microsoft Clarity: website analytics, only if a visitor allows it.</li>
      </ul>
      <p>
        A studio's reminders are sent by the studio from its own WhatsApp or Telegram account, so those services see
        the message. We may also disclose data if the law or a court requires it. Each studio sees only its own
        records. Some of our providers may handle data outside India. We transfer data only where the DPDP Act allows.
      </p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>Account and dancer records: while the account is open. When it closes, you can ask for an export for 30 days, and we delete the data within a further 30 days, except what the law requires us to keep.</li>
        <li>Payment screenshots: removed when the studio decides the claim, and automatically after 30 days if it is still undecided.</li>
        <li>Earlier walkthrough requests: until you opt out or ask us to delete them.</li>
        <li>Support emails: for as long as needed to help you and keep a record of it.</li>
      </ul>

      <h2>6. Your rights</h2>
      <p>Under the DPDP Act you have the right to:</p>
      <ul>
        <li>get a summary of the personal data we hold about you and how it is used;</li>
        <li>ask us to correct, complete or update it;</li>
        <li>ask us to erase it, when it is no longer needed for the purpose or the law does not require us to keep it;</li>
        <li>withdraw your consent;</li>
        <li>have your complaint dealt with; and</li>
        <li>name another person to exercise these rights for you if you die or cannot do so yourself.</li>
      </ul>
      <p>
        To use any of them, email <strong>support@choreostudio.live</strong> from the address you signed up with, or
        use the opt-out link on the <a href="/opt-out">opt-out page</a>. We will confirm that it is you, acknowledge
        your request within 3 working days, and aim to answer within 30 days. If you are a dancer, the studio is
        responsible for your data, and we will pass your request to it or help it act on it. If we cannot resolve your
        complaint, you can complain to the Data Protection Board of India.
      </p>

      <h2>7. Cookies and analytics</h2>
      <p>
        We use only what the site needs to work, such as keeping you signed in. Microsoft Clarity, which records how
        visitors use our pages (for example where they click), is switched off unless you choose "Allow" on the bar
        that appears. It runs only on our public pages (home, sign-in, privacy and terms), never inside the studio
        console or on a dancer's private link. You can change your mind at any time:{" "}
        <button type="button" className="text-link" onClick={openConsentChoice}>
          change analytics choice
        </button>
        .
      </p>

      <h2>8. Children</h2>
      <p>
        ChoreoStudio is for studio owners and adult dancers. We do not knowingly collect data from children through our
        website. If a studio enters data about anyone under 18, it must have the verifiable consent of their parent or
        lawful guardian, as our Terms require, and must not use ChoreoStudio to track or monitor a child's behaviour or
        to target advertising at them. If you think a child's data has been added without that consent, tell us and we
        will act on it.
      </p>

      <h2>9. How we protect it</h2>
      <ul>
        <li>Each studio can see only its own records. This is enforced inside the database, not only on the screen.</li>
        <li>Data is encrypted while it travels, and secret keys stay on our servers, not in your browser.</li>
        <li>Dancers' private links are stored only in scrambled form, and can be cancelled by the studio.</li>
        <li>We limit who on our side can reach data, and we keep software and providers up to date.</li>
      </ul>
      <p>
        If a breach affects your personal data, we will tell the affected studio without undue delay and report it to
        the Data Protection Board and to those affected, as the law requires.
      </p>

      <h2>10. Who to contact, and changes</h2>
      <p>
        Grievance Officer and data contact: ChoreoStudio Support, support@choreostudio.live. We may update this notice.
        If a change matters, we will tell studio owners by email or in the app before it applies, and we will ask for
        consent again where the law requires it. The date at the top shows the latest version.
      </p>
    </LegalPage>
  );
}
