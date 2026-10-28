import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  handleWhatsAppStatusWebhook,
  handleWhatsAppVerification,
  parseDeliveryUpdates,
  signatureMatches,
} from "@/lib/whatsapp-status.server";

const secret = "app-secret";
const sign = (body: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const body = JSON.stringify({
  entry: [
    {
      changes: [
        {
          value: {
            statuses: [
              { id: "wamid.1", status: "delivered" },
              { id: "wamid.2", status: "failed", errors: [{ title: "Number not on WhatsApp" }] },
              { id: "wamid.3", status: "sent" },
              { status: "read" },
            ],
          },
        },
      ],
    },
  ],
});

describe("WhatsApp delivery webhook", () => {
  it("keeps delivered, read and failed updates and ignores the rest", () => {
    expect(parseDeliveryUpdates(JSON.parse(body))).toEqual([
      { messageId: "wamid.1", status: "delivered", error: null },
      { messageId: "wamid.2", status: "failed", error: "Number not on WhatsApp" },
    ]);
    expect(parseDeliveryUpdates(null)).toEqual([]);
  });

  it("checks the signature", () => {
    expect(signatureMatches(body, sign(body), secret)).toBe(true);
    expect(signatureMatches(body, sign(body + " "), secret)).toBe(false);
    expect(signatureMatches(body, null, secret)).toBe(false);
  });

  it("records signed updates and rejects unsigned ones", async () => {
    const record = vi.fn(async () => undefined);
    const bad = await handleWhatsAppStatusWebhook(
      new Request("https://x.test", { method: "POST", body }),
      secret,
      record,
    );
    expect(bad.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
    const ok = await handleWhatsAppStatusWebhook(
      new Request("https://x.test", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": sign(body) },
      }),
      secret,
      record,
    );
    expect(ok.status).toBe(200);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("says it is not configured without a secret", async () => {
    const res = await handleWhatsAppStatusWebhook(
      new Request("https://x.test", { method: "POST", body }),
      "",
    );
    expect(res.status).toBe(503);
  });

  it("answers Meta's verification only with the right token", async () => {
    const url = (token: string) =>
      new Request(`https://x.test/?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=123`);
    expect(await handleWhatsAppVerification(url("good"), "good").text()).toBe("123");
    expect(handleWhatsAppVerification(url("bad"), "good").status).toBe(403);
    expect(handleWhatsAppVerification(url("good"), "").status).toBe(503);
  });
});
