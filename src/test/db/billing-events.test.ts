// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newStudio } from "./fixtures";

describe("apply_billing_event", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  let counter = 0;
  const apply = async (
    owner: string | null,
    event: { status: string | null; plan?: string | null; sub?: string; at: string },
    id = `evt_${++counter}`,
  ) => {
    await db.admin(
      "INSERT INTO public.billing_events (id, type, event_at, payload) VALUES ($1, 'subscription.test', $2, '{}') ON CONFLICT (id) DO NOTHING",
      [id, event.at],
    );
    const [row] = await db.query<{ outcome: string }>(
      "service",
      "SELECT public.apply_billing_event($1, $2, $3, $4, $5, 'cus_1', $6, NULL) AS outcome",
      [id, owner, event.status, event.plan ?? null, event.sub ?? "sub_A", event.at],
    );
    return row.outcome;
  };
  const studio = async (owner: string) =>
    (
      await db.admin<{
        plan: string;
        billing_status: string;
        dodo_subscription_id: string | null;
      }>(
        "SELECT plan, billing_status, dodo_subscription_id FROM public.studio_profiles WHERE user_id = $1",
        [owner],
      )
    )[0];

  it("activates a plan and stores the subscription", async () => {
    const owner = await newStudio(db);
    expect(
      await apply(owner, { status: "active", plan: "growth", at: "2026-10-01T10:00:00Z" }),
    ).toBe("applied");
    expect(await studio(owner)).toEqual({
      plan: "growth",
      billing_status: "active",
      dodo_subscription_id: "sub_A",
    });
  });

  it("applies the same event once however often it is delivered", async () => {
    const owner = await newStudio(db);
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(
        await apply(
          owner,
          { status: "active", plan: "starter", at: "2026-10-01T10:00:00Z" },
          "evt_same",
        ),
      );
    }
    expect(outcomes).toEqual(["applied", "duplicate", "duplicate"]);
  });

  it("ignores an older event that arrives after a newer one", async () => {
    const owner = await newStudio(db);
    await apply(owner, { status: "active", plan: "growth", at: "2026-10-01T10:00:00Z" });
    await apply(owner, { status: "cancelled", at: "2026-10-05T10:00:00Z" });
    expect(
      await apply(owner, { status: "active", plan: "growth", at: "2026-10-02T10:00:00Z" }),
    ).toBe("stale");
    expect(await studio(owner)).toMatchObject({ plan: "growth", billing_status: "cancelled" });
  });

  it("keeps the paid plan on a status-only change", async () => {
    const owner = await newStudio(db);
    await apply(owner, { status: "active", plan: "studio", at: "2026-10-01T10:00:00Z" });
    await apply(owner, { status: "past_due", at: "2026-10-03T10:00:00Z" });
    expect(await studio(owner)).toMatchObject({ plan: "studio", billing_status: "past_due" });
  });

  it("refuses an event for a different subscription while the stored one is live", async () => {
    const owner = await newStudio(db);
    await apply(owner, {
      status: "active",
      plan: "growth",
      sub: "sub_A",
      at: "2026-10-01T10:00:00Z",
    });
    expect(
      await apply(owner, {
        status: "active",
        plan: "studio",
        sub: "sub_B",
        at: "2026-10-02T10:00:00Z",
      }),
    ).toBe("mismatch");
    expect(await studio(owner)).toMatchObject({ plan: "growth", dodo_subscription_id: "sub_A" });
  });

  it("lets a new subscription replace one that has expired, and ignores a late event for the old one", async () => {
    const owner = await newStudio(db);
    await apply(owner, {
      status: "active",
      plan: "growth",
      sub: "sub_A",
      at: "2026-10-01T10:00:00Z",
    });
    await apply(owner, {
      status: "cancelled",
      plan: "waitlist",
      sub: "sub_A",
      at: "2026-10-10T10:00:00Z",
    });
    expect(
      await apply(owner, {
        status: "active",
        plan: "starter",
        sub: "sub_B",
        at: "2026-10-12T10:00:00Z",
      }),
    ).toBe("applied");
    expect(
      await apply(owner, {
        status: "cancelled",
        plan: "waitlist",
        sub: "sub_A",
        at: "2026-10-13T10:00:00Z",
      }),
    ).toBe("mismatch");
    expect(await studio(owner)).toEqual({
      plan: "starter",
      billing_status: "active",
      dodo_subscription_id: "sub_B",
    });
  });

  it("does not let an ended studio be taken over by a non-starting event for another subscription", async () => {
    const owner = await newStudio(db);
    await apply(owner, {
      status: "active",
      plan: "growth",
      sub: "sub_A",
      at: "2026-10-01T10:00:00Z",
    });
    await apply(owner, {
      status: "cancelled",
      plan: "waitlist",
      sub: "sub_A",
      at: "2026-10-10T10:00:00Z",
    });
    expect(
      await apply(owner, { status: "on_hold", sub: "sub_C", at: "2026-10-11T10:00:00Z" }),
    ).toBe("mismatch");
  });

  it("creates the profile for an existing account without one, and skips unknown accounts", async () => {
    const account = await db.addUser();
    expect(
      await apply(account, { status: "active", plan: "starter", at: "2026-10-01T10:00:00Z" }),
    ).toBe("applied");
    expect(await studio(account)).toMatchObject({ plan: "starter" });
    expect(
      await apply("00000000-0000-4000-8000-000000000000", {
        status: "active",
        plan: "starter",
        at: "2026-10-01T10:00:00Z",
      }),
    ).toBe("no_studio");
    expect(
      await apply(null, { status: "active", plan: "starter", at: "2026-10-01T10:00:00Z" }),
    ).toBe("no_studio");
  });

  it("marks an event without a status change as handled", async () => {
    const owner = await newStudio(db);
    expect(await apply(owner, { status: null, at: "2026-10-01T10:00:00Z" }, "evt_ignored")).toBe(
      "ignored",
    );
    const [event] = await db.admin<{ applied: boolean }>(
      "SELECT applied FROM public.billing_events WHERE id = 'evt_ignored'",
    );
    expect(event.applied).toBe(true);
  });

  it("is callable by the service role only", async () => {
    const owner = await newStudio(db);
    await db.admin(
      "INSERT INTO public.billing_events (id, type, payload) VALUES ('evt_denied', 't', '{}')",
    );
    const call = (actor: { user: string } | "anon") =>
      db.query(
        actor,
        "SELECT public.apply_billing_event('evt_denied', $1, 'active', 'studio', 'sub_X', NULL, now(), NULL)",
        [owner],
      );
    expect(await rejection(call({ user: owner }))).toMatch(/permission denied/i);
    expect(await rejection(call("anon"))).toMatch(/permission denied/i);
    expect((await studio(owner))?.plan).toBe("waitlist");
  });
});
