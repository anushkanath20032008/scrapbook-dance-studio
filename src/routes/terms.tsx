import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | ChoreoStudio" },
      { name: "description", content: "The terms for using ChoreoStudio, the fee and attendance tool for dance studios." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service." windowTitle="Terms.txt" updated="22 October 2026">
      <p>
        These terms are the agreement between you and ChoreoStudio ("we", "us") for using the ChoreoStudio website and
        app (the "Service"). Please read them with our <a href="/privacy">Privacy Notice</a>, which is part of them.
      </p>

      <h2>1. Who these terms are for</h2>
      <p>
        "You" means the studio owner, or the person acting for a studio, who creates an account. You must be at least 18
        and able to enter a contract under Indian law. If you sign up for a business, you confirm you have the authority
        to accept these terms for it. By creating an account or using the Service you agree to them. If you do not agree,
        do not use the Service.
      </p>

      <h2>2. What the Service does, and what it does not</h2>
      <ul>
        <li>ChoreoStudio helps you keep records of dancers, fees, charges, payments, attendance and batches, see who owes what, and prepare reminders.</li>
        <li>Reminders open in your own WhatsApp (or, if you turn it on, a Telegram bot) with the message filled in. You review and send them. We do not send messages to your dancers on our own.</li>
        <li>We do not collect, hold, transfer or process money between your dancers and you. We are not a bank, payment aggregator or payment gateway. A payment exists in the Service only because you recorded it or confirmed a dancer's claim against your own bank or UPI statement.</li>
        <li>Amounts, balances and statuses are calculated from what you enter. They are a record, not accounting, tax or legal advice. You are responsible for checking them.</li>
        <li>Features marked "coming soon", including automated WhatsApp messages, are not part of the Service until we release them, and we give no date.</li>
      </ul>

      <h2>3. Your account</h2>
      <p>
        Give accurate information and keep it up to date. Keep your sign-in details secret. You are responsible for
        everything done through your account, and you must tell us at support@choreostudio.live straight away if you
        think someone else has got in. One account is for one studio.
      </p>

      <h2>4. Free first month, plans and limits</h2>
      <ul>
        <li>Your first 30 days from sign-up are free, with all features and no card needed.</li>
        <li>After that, the plan you choose applies. Regular is for up to 50 active dancers. Studio+ is for more. These limits are enforced by the Service. Existing records are never deleted because of a limit, but you cannot add or restore a dancer beyond it.</li>
        <li>Prices are shown in Indian rupees on our website. Taxes such as GST are added where they apply. We may change prices for new customers at any time, and for existing subscribers by giving at least 30 days' notice before the next renewal.</li>
      </ul>

      <h2>5. Paying for a plan</h2>
      <p>
        Paid plans are sold and billed through our payment partner, Dodo Payments, which acts as seller of record and
        handles your card or UPI details. Its terms apply at checkout. We never see or store your full payment details.
        A paid plan renews every month until you cancel it. You can cancel any time from "Manage billing" in your
        account, and the cancellation takes effect at the end of the period you have paid for. Fees already paid are not
        refundable unless the law requires it or we say otherwise when you buy. If a renewal payment fails we may limit
        what you can add until it is fixed, and may suspend the account after notice.
      </p>

      <h2>6. Your data and our role</h2>
      <p>
        You own the data you put into the Service. You give us a limited licence to host, copy and process it only to
        run the Service for you. Dancers' details that you enter are personal data. Under India's Digital Personal Data
        Protection Act, 2023 (the "DPDP Act"), you are the Data Fiduciary for them and we are a Data Processor acting
        on your instructions. For that data, we agree to:
      </p>
      <ul>
        <li>process it only to provide the Service, and not for any other purpose of our own;</li>
        <li>keep it protected with reasonable security safeguards, including keeping each studio's records separate from every other studio's;</li>
        <li>use only the service providers listed in our Privacy Notice, and make sure they protect it as well;</li>
        <li>help you answer a dancer's request to see, correct or erase their data;</li>
        <li>tell you without undue delay, and in any case within 72 hours of becoming aware, if a personal data breach affects your data; and</li>
        <li>delete or return it when the agreement ends, as set out in section 13.</li>
      </ul>
      <p>This section is meant to be the contract between a Data Fiduciary and its Data Processor that the DPDP Act asks for.</p>

      <h2>7. Your duties about your dancers' data</h2>
      <ul>
        <li>You must have a lawful basis, and where needed the dancer's free, specific and informed consent, to keep their details and to message them. You must tell them what you hold and why, and let them take back consent as easily as they gave it.</li>
        <li>Collect only what you need. Keep it accurate. Remove or correct data when asked.</li>
        <li>Respect opt-outs. Use the "don't send reminders" setting for any dancer who asks not to be messaged.</li>
        <li><strong>Children.</strong> ChoreoStudio is built for adult dancers. Do not enter details of anyone under 18 unless you have the verifiable consent of their parent or lawful guardian, and never use the Service to track or monitor a child's behaviour or to aim advertising at children.</li>
        <li>You are responsible for answering your dancers' requests and complaints about their data. You are the first contact for them.</li>
      </ul>

      <h2>8. Messages you send</h2>
      <p>
        Reminders go out from your own WhatsApp or Telegram account. The terms and policies of those services apply to
        you, and you must follow them and the law. Send only fee and class messages that dancers would expect. No spam,
        no abuse, no misleading messages. We are not responsible if a message is not delivered, is blocked, or if a
        messaging service restricts your account.
      </p>

      <h2>9. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>use the Service for anything unlawful, or to harass, threaten or deceive anyone;</li>
        <li>enter data you have no right to use;</li>
        <li>share a dancer's private link or payment details publicly;</li>
        <li>try to get into another studio's data, probe or attack the Service, scrape it, or reverse engineer it;</li>
        <li>get around plan limits, security, or rate limits; or</li>
        <li>upload malicious files, or screenshots that show other people's information beyond what is needed to check a payment.</li>
      </ul>

      <h2>10. Other services we rely on</h2>
      <p>
        The Service runs on providers such as Supabase (database and sign-in), Vercel (hosting), Dodo Payments
        (billing), Zoho (support email) and, if you use it, Telegram. Microsoft Clarity runs on our public pages only if
        a visitor allows it. We are not responsible for outages or changes of services we do not control, but we will
        take reasonable care in choosing them. Your use of WhatsApp or Telegram is between you and them.
      </p>

      <h2>11. Availability and backups</h2>
      <p>
        We work to keep the Service running and your data safe, but we do not promise it will always be available or free
        of errors. We may pause it for maintenance. We take reasonable steps to back up data, but you should keep your
        own copy of anything important. Ask us for an export of your records at any time.
      </p>

      <h2>12. Our rights in the Service</h2>
      <p>
        The Service, its design, software, name and logo belong to us. You get a limited, non-exclusive right to use it
        for your studio while these terms apply. You may not copy, sell or sublicense it. Suggestions you send us may be
        used by us freely. Your own data stays yours.
      </p>

      <h2>13. Ending the agreement</h2>
      <ul>
        <li>You can stop any time. Cancel your plan, and ask us at support@choreostudio.live to close your account.</li>
        <li>We may suspend or end your account if you break these terms, do not pay after notice, put others or the Service at risk, or the law requires it. Where we can, we will tell you why first.</li>
        <li>When the account closes, you can ask for an export of your records for 30 days. After that, we delete your studio's data, including your dancers' details, within a further 30 days, except what the law requires us to keep. Backups are overwritten in the normal course.</li>
        <li>Sections that by their nature should survive (data duties, disclaimers, liability, indemnity and disputes) do survive.</li>
      </ul>

      <h2>14. Disclaimers</h2>
      <p>
        To the extent the law allows, the Service is provided "as is" and "as available", without promises about fitness
        for a particular purpose, accuracy, or uninterrupted use. We do not guarantee that dancers will pay, or that a
        reminder will lead to payment.
      </p>

      <h2>15. Limit of our liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss, lost profit, lost revenue, or
        lost data, and our total liability for any claim is limited to the fees you paid us in the 3 months before the
        claim, or ₹1,000 if you have paid nothing. Nothing in these terms limits liability that cannot be limited under
        Indian law.
      </p>

      <h2>16. You protect us from claims about your use</h2>
      <p>
        You will cover our reasonable losses and costs from a claim by a dancer, a regulator or anyone else that comes
        from your breach of these terms, the data you entered, or the messages you sent.
      </p>

      <h2>17. Changes to these terms</h2>
      <p>
        We may update these terms. For a change that matters, we will tell you by email or in the app at least 14 days
        before it applies. If you keep using the Service after that, you accept the change. If you do not agree, stop
        using it and close your account.
      </p>

      <h2>18. Law, disputes and complaints</h2>
      <p>
        These terms are governed by the laws of India. If you have a problem, write to us first at
        support@choreostudio.live and give us 30 days to put it right. If it is not resolved, the competent courts in
        India have jurisdiction.
      </p>
      <p>
        <strong>Grievances:</strong> write to our Grievance Officer at support@choreostudio.live. We will acknowledge
        your message within 3 working days and aim to resolve it within 30 days. For data protection rights, see the
        Privacy Notice.
      </p>

      <h2>19. General</h2>
      <p>
        These terms and the Privacy Notice are the whole agreement between us about the Service. If a part is found
        unenforceable, the rest stays in force. If we do not enforce a term straight away, we have not given it up. You
        may not transfer your account to someone else without our consent. We are not responsible for delay or failure
        caused by events beyond our reasonable control. We may send you notices by email or in the app.
      </p>
      <p>Contact: support@choreostudio.live</p>
    </LegalPage>
  );
}
