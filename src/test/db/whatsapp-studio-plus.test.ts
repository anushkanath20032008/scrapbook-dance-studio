// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudent, newStudio } from "./fixtures";

describe("Studio+ WhatsApp", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const makePlus = (owner: string) =>
    db.admin("UPDATE public.studio_profiles SET plan = 'studio', billing_status = 'active' WHERE user_id = $1", [owner]);

  async function queued(owner: string) {
    const student = await newStudent(db, owner, "Asha", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "Asha"),
      planName: "Monthly",
    });
    await db.query({ user: owner }, "SELECT public.generate_monthly_charges($1::date, $2::date)", ["2026-10-01", "2026-10-05"]);
    await db.query({ user: owner }, "SELECT public.queue_fee_reminders($1::date, $2::date)", ["2026-10-01", "2026-10-10"]);
    return student;
  }

  it("refuses to switch automation on without an active Studio+ plan", async () => {
    const owner = await newStudio(db);
    expect(await rejection(db.query({ user: owner }, "SELECT public.set_whatsapp_automation(true)"))).toMatch(/Studio\+/);
    const status = await db.query<{ studio_plus: boolean; enabled: boolean }>({ user: owner }, "SELECT * FROM public.whatsapp_automation_status()");
    expect(status[0]).toEqual({ studio_plus: false, enabled: false });
  });

  it("lets a Studio+ owner switch it on and off, and the sender only claims reminders once it is on", async () => {
    const owner = await newStudio(db);
    await makePlus(owner);
    await queued(owner);
    const claim = () =>
      db.query<{ studio_id: string }>("service", "SELECT studio_id FROM public.claim_due_reminders(50, 60)");
    expect((await claim()).filter((r) => r.studio_id === owner)).toEqual([]);
    await db.query({ user: owner }, "SELECT public.set_whatsapp_automation(true)");
    expect((await claim()).filter((r) => r.studio_id === owner).length).toBeGreaterThan(0);
  });

  it("does not claim reminders again when the studio leaves Studio+", async () => {
    const owner = await newStudio(db);
    await makePlus(owner);
    await queued(owner);
    await db.query({ user: owner }, "SELECT public.set_whatsapp_automation(true)");
    await db.admin("UPDATE public.studio_profiles SET billing_status = 'cancelled' WHERE user_id = $1", [owner]);
    const rows = await db.query<{ studio_id: string }>("service", "SELECT studio_id FROM public.claim_due_reminders(50, 60)");
    expect(rows.filter((r) => r.studio_id === owner)).toEqual([]);
  });

  it("records delivery updates for a sent message and keeps a failure's reason", async () => {
    const owner = await newStudio(db);
    await makePlus(owner);
    await queued(owner);
    await db.admin("UPDATE public.reminders SET status = 'sent', provider_message_id = 'wamid.A' WHERE studio_id = $1", [owner]);
    const ok = await db.query<{ record_delivery_status: boolean }>("service", "SELECT public.record_delivery_status('wamid.A', 'delivered')");
    expect(ok[0].record_delivery_status).toBe(true);
    const row = await db.query<{ delivery_status: string; status: string }>(
      "service",
      "SELECT delivery_status, status FROM public.reminders WHERE studio_id = $1",
      [owner],
    );
    expect(row[0]).toEqual({ delivery_status: "delivered", status: "sent" });
    const missing = await db.query<{ record_delivery_status: boolean }>("service", "SELECT public.record_delivery_status('nope', 'read')");
    expect(missing[0].record_delivery_status).toBe(false);
  });

  it("marks a reminder failed with the provider's reason, and lets only the service role record updates", async () => {
    const owner = await newStudio(db);
    await queued(owner);
    await db.admin("UPDATE public.reminders SET status = 'sent', provider_message_id = 'wamid.B' WHERE studio_id = $1", [owner]);
    await db.query("service", "SELECT public.record_delivery_status('wamid.B', 'failed', 'Number is not on WhatsApp')");
    const row = await db.query<{ status: string; last_error: string }>(
      "service",
      "SELECT status, last_error FROM public.reminders WHERE studio_id = $1",
      [owner],
    );
    expect(row[0]).toEqual({ status: "failed", last_error: "Number is not on WhatsApp" });
    expect(await rejection(db.query({ user: owner }, "SELECT public.record_delivery_status('wamid.B', 'read')"))).toMatch(/permission denied/i);
  });
});

describe("Studio+ WhatsApp switch is server-managed", () => {
  it("does not let an owner write the automation column directly", async () => {
    const db = await createDb();
    try {
      const owner = await newStudio(db);
      expect(
        await rejection(
          db.query({ user: owner }, "UPDATE public.studio_profiles SET whatsapp_automation = true WHERE user_id = $1", [owner]),
        ),
      ).toMatch(/permission denied/i);
    } finally {
      await db.close();
    }
  }, 60_000);
});
