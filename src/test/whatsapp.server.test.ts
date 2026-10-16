import { describe, expect, it, vi } from "vitest";
import { authenticateJobRequest } from "@/lib/job-auth.server";
import {
  getWhatsAppProvider,
  HttpWhatsAppProvider,
  renderReminder,
  toInternationalPhone,
} from "@/lib/whatsapp.server";

const payload = {
  studio_name: "Rhythm House",
  guardian_name: "Meera",
  student_name: "Aarav",
  amount_paise: 90000,
  due_on: "2026-10-05",
  period: "2026-10-01",
};
const request = {
  to: "+919999999999",
  templateName: "fee_due_reminder",
  variables: {},
  text: "hi",
};

describe("phone numbers", () => {
  it("normalizes Indian numbers and refuses unusable ones", () => {
    expect(toInternationalPhone("98765 43210")).toBe("+919876543210");
    expect(toInternationalPhone("09876543210")).toBe("+919876543210");
    expect(toInternationalPhone("919876543210")).toBe("+919876543210");
    expect(toInternationalPhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(toInternationalPhone("12345")).toBeNull();
    expect(toInternationalPhone("")).toBeNull();
    expect(toInternationalPhone(null)).toBeNull();
  });
});

describe("renderReminder", () => {
  it("writes a due and an overdue message from the stored payload", () => {
    const due = renderReminder("fee_due", payload);
    expect(due?.templateName).toBe("fee_due_reminder");
    expect(due?.text).toContain("₹900");
    expect(due?.text).toContain("5 Oct");
    expect(due?.text).toContain("October 2026");
    expect(renderReminder("fee_overdue", payload)?.templateName).toBe("fee_overdue_reminder");
  });

  it("returns null for an unknown kind or a payload missing details", () => {
    expect(renderReminder("other", payload)).toBeNull();
    expect(renderReminder("fee_due", { ...payload, amount_paise: 0 })).toBeNull();
    expect(renderReminder("fee_due", null)).toBeNull();
  });
});

describe("HttpWhatsAppProvider", () => {
  const provider = (impl: () => Promise<Response>) =>
    new HttpWhatsAppProvider(
      "https://wa.example/send",
      "tok",
      vi.fn(impl) as unknown as typeof fetch,
    );

  it("returns the provider message id and sends the bearer token", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "wamid.1" }));
    const result = await new HttpWhatsAppProvider(
      "https://wa.example/send",
      "tok",
      fetchImpl as unknown as typeof fetch,
    ).send(request);
    expect(result).toEqual({ ok: true, providerMessageId: "wamid.1" });
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
  });

  it("treats 429, 5xx and network errors as retryable and other 4xx as final", async () => {
    expect(
      await provider(async () => new Response("", { status: 429 })).send(request),
    ).toMatchObject({
      ok: false,
      retryable: true,
    });
    expect(
      await provider(async () => new Response("", { status: 503 })).send(request),
    ).toMatchObject({
      ok: false,
      retryable: true,
    });
    expect(
      await provider(async () => new Response("", { status: 400 })).send(request),
    ).toMatchObject({
      ok: false,
      retryable: false,
    });
    expect(
      await provider(async () => {
        throw new Error("down");
      }).send(request),
    ).toMatchObject({ ok: false, retryable: true });
  });
});

describe("getWhatsAppProvider", () => {
  it("is null without both settings or with an insecure remote URL", () => {
    expect(getWhatsAppProvider({})).toBeNull();
    expect(getWhatsAppProvider({ WHATSAPP_PROVIDER_URL: "https://x.test" })).toBeNull();
    expect(
      getWhatsAppProvider({ WHATSAPP_PROVIDER_URL: "http://x.test", WHATSAPP_PROVIDER_TOKEN: "t" }),
    ).toBeNull();
    expect(
      getWhatsAppProvider({ WHATSAPP_PROVIDER_URL: "nonsense", WHATSAPP_PROVIDER_TOKEN: "t" }),
    ).toBeNull();
    expect(
      getWhatsAppProvider({
        WHATSAPP_PROVIDER_URL: "https://x.test",
        WHATSAPP_PROVIDER_TOKEN: "t",
      }),
    ).not.toBeNull();
  });
});

describe("authenticateJobRequest", () => {
  const env = { RENDER_JOB_SECRET: "s3cret" };
  const withAuth = (value?: string) =>
    new Request("https://x.test/api/jobs/send-reminders", {
      method: "POST",
      ...(value ? { headers: { authorization: value } } : {}),
    });

  it("allows the right secret only", () => {
    expect(authenticateJobRequest(withAuth("Bearer s3cret"), env)).toBeNull();
    expect(authenticateJobRequest(withAuth("Bearer wrong"), env)?.status).toBe(401);
    expect(authenticateJobRequest(withAuth(), env)?.status).toBe(401);
    expect(authenticateJobRequest(withAuth("Basic s3cret"), env)?.status).toBe(401);
  });

  it("fails closed when the secret is not configured", () => {
    expect(authenticateJobRequest(withAuth("Bearer x"), {})?.status).toBe(500);
  });
});
