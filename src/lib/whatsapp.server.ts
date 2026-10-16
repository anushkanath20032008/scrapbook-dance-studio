import { z } from "zod";

// The reminder job talks to WhatsApp only through this interface, so a vendor can be chosen later without
// touching the queue. The one implementation is a generic HTTP provider configured from the environment.

export type SendRequest = {
  to: string;
  templateName: string;
  variables: Record<string, string>;
  text: string;
};

export type SendResult =
  { ok: true; providerMessageId: string } | { ok: false; retryable: boolean; error: string };

export interface WhatsAppProvider {
  send(request: SendRequest): Promise<SendResult>;
}

/** Normalize an Indian-style phone number to +country-code digits, or null when it cannot be used. */
export function toInternationalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+"))
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

const payloadSchema = z.object({
  studio_name: z.string(),
  guardian_name: z.string(),
  student_name: z.string(),
  amount_paise: z.number().int().positive(),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ReminderPayload = z.infer<typeof payloadSchema>;

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function rupees(paise: number): string {
  const whole = paise % 100 === 0;
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${months[Number(month) - 1]?.slice(0, 3) ?? ""}`;
}
function monthYear(iso: string): string {
  const [year, month] = iso.split("-");
  return `${months[Number(month) - 1] ?? ""} ${year}`;
}

/** Build the template name, its variables and the plain text of a fee reminder. Returns null for a payload that is missing details. */
export function renderReminder(
  kind: string,
  payload: unknown,
): { templateName: string; variables: Record<string, string>; text: string } | null {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || (kind !== "fee_due" && kind !== "fee_overdue")) return null;
  const p = parsed.data;
  const variables = {
    guardian: p.guardian_name,
    student: p.student_name,
    studio: p.studio_name,
    amount: rupees(p.amount_paise),
    month: monthYear(p.period),
    due_date: shortDate(p.due_on),
  };
  const text =
    kind === "fee_overdue"
      ? `Hi ${variables.guardian}, ${variables.student}'s fee for ${variables.month} (${variables.amount}) at ${variables.studio} was due on ${variables.due_date} and is still pending. Please pay when you can. Thank you!`
      : `Hi ${variables.guardian}, a reminder from ${variables.studio}: ${variables.student}'s fee for ${variables.month} (${variables.amount}) is due on ${variables.due_date}. Thank you!`;
  return {
    templateName: kind === "fee_overdue" ? "fee_overdue_reminder" : "fee_due_reminder",
    variables,
    text,
  };
}

export class HttpWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(request: SendRequest): Promise<SendResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify({
          to: request.to,
          template: request.templateName,
          variables: request.variables,
          text: request.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { ok: false, retryable: true, error: "Could not reach the WhatsApp provider." };
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      return { ok: false, retryable, error: `The WhatsApp provider answered ${response.status}.` };
    }
    const body = (await response.json().catch(() => null)) as {
      id?: unknown;
      message_id?: unknown;
      messages?: { id?: unknown }[];
    } | null;
    const id = body?.id ?? body?.message_id ?? body?.messages?.[0]?.id;
    return {
      ok: true,
      providerMessageId: typeof id === "string" || typeof id === "number" ? String(id) : "accepted",
    };
  }
}

/** The configured provider, or null when WHATSAPP_PROVIDER_URL or WHATSAPP_PROVIDER_TOKEN is missing or the URL is unusable. */
export function getWhatsAppProvider(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): WhatsAppProvider | null {
  const url = env["WHATSAPP_PROVIDER_URL"]?.trim();
  const token = env["WHATSAPP_PROVIDER_TOKEN"]?.trim();
  if (!url || !token) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return null;
  } catch {
    return null;
  }
  return new HttpWhatsAppProvider(url, token, fetchImpl);
}
