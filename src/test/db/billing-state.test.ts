// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudio } from "./fixtures";

describe("billing state, webhook events and family links", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("keeps plan, billing status and subscription ids server-managed", async () => {
    const owner = await newStudio(db);
    for (const assignment of ["plan = 'growth'", "billing_status = 'active'", "dodo_subscription_id = 'sub_1'", "dodo_customer_id = 'cus_1'", "billing_updated_at = now()", "current_period_end = now()"]) {
      expect(await rejection(db.query({ user: owner }, `UPDATE public.studio_profiles SET ${assignment} WHERE user_id = $1`, [owner])), assignment).toMatch(/permission denied/i);
    }
    await db.query("service", "UPDATE public.studio_profiles SET plan = 'growth', billing_status = 'active', dodo_subscription_id = 'sub_1' WHERE user_id = $1", [owner]);
    const [row] = await db.admin<{ plan: string; billing_status: string }>("SELECT plan, billing_status FROM public.studio_profiles WHERE user_id = $1", [owner]);
    expect(row).toEqual({ plan: "growth", billing_status: "active" });
  });

  it("stops an owner without a profile from pre-setting server-managed columns when creating one", async () => {
    for (const column of ["dodo_subscription_id", "dodo_customer_id", "billing_updated_at", "current_period_end"]) {
      const owner = await db.addUser();
      const value = column.endsWith("_at") || column.endsWith("_end") ? "now()" : "'x'";
      const insert = db.query({ user: owner }, `INSERT INTO public.studio_profiles (user_id, ${column}) VALUES ($1, ${value})`, [owner]);
      expect(await rejection(insert), column).toMatch(/permission denied/i);
    }
  });

  it("still lets an owner create and re-save a profile with the contact columns", async () => {
    const owner = await db.addUser();
    await db.query({ user: owner }, "INSERT INTO public.studio_profiles (user_id) VALUES ($1)", [owner]);
    const other = await db.addUser();
    const upsert = `INSERT INTO public.studio_profiles (user_id, name, studio_name, phone, city) VALUES ($1, 'Rhea', 'Rhea Studio', NULL, 'Pune')
      ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, studio_name = EXCLUDED.studio_name, phone = EXCLUDED.phone, city = EXCLUDED.city`;
    await db.query({ user: other }, upsert, [other]);
    await db.query({ user: other }, upsert, [other]);
    const [row] = await db.query<{ studio_name: string; plan: string }>({ user: other }, "SELECT studio_name, plan FROM public.studio_profiles");
    expect(row).toEqual({ studio_name: "Rhea Studio", plan: "waitlist" });
  });

  it("rejects an owner creating a profile that already claims a paid plan", async () => {
    const owner = await db.addUser();
    expect(await rejection(db.query({ user: owner }, "INSERT INTO public.studio_profiles (user_id, plan, billing_status) VALUES ($1, 'studio', 'active')", [owner]))).toMatch(/permission denied/i);
  });

  it("rejects plan and billing values outside the allowed sets", async () => {
    const owner = await newStudio(db);
    expect(await rejection(db.query("service", "UPDATE public.studio_profiles SET plan = 'enterprise' WHERE user_id = $1", [owner]))).toMatch(/check/i);
    expect(await rejection(db.query("service", "UPDATE public.studio_profiles SET billing_status = 'paid' WHERE user_id = $1", [owner]))).toMatch(/check/i);
  });

  it("records a webhook event id once, and keeps the log away from owners", async () => {
    const insert = (id: string) => db.query("service", "INSERT INTO public.billing_events (id, type, payload) VALUES ($1, 'subscription.active', '{}')", [id]);
    await insert("evt_1");
    expect(await rejection(insert("evt_1"))).toMatch(/unique|duplicate/i);
    const ignored = await db.query("service", "INSERT INTO public.billing_events (id, type, payload) VALUES ('evt_1', 'subscription.active', '{}') ON CONFLICT (id) DO NOTHING RETURNING id");
    expect(ignored).toEqual([]);
    const owner = await newStudio(db);
    expect(await rejection(db.query({ user: owner }, "SELECT * FROM public.billing_events"))).toMatch(/permission denied/i);
    expect(await rejection(db.query("anon", "SELECT * FROM public.billing_events"))).toMatch(/permission denied/i);
    const [event] = await db.query<{ applied: boolean }>("service", "SELECT applied FROM public.billing_events WHERE id = 'evt_1'");
    expect(event.applied).toBe(false);
  });

  it("keeps family links private to the studio and revocable once", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const guardian = await newGuardian(db, owner);
    const [link] = await db.query<{ id: string }>({ user: owner }, "INSERT INTO public.family_links (studio_id, guardian_id, token_hash) VALUES ($1, $2, 'hash-1') RETURNING id", [owner, guardian]);
    expect(await db.query({ user: other }, "SELECT 1 FROM public.family_links")).toEqual([]);
    expect(await db.query("anon", "SELECT 1 FROM public.family_links").catch(() => [])).toEqual([]);
    expect(await rejection(db.query({ user: other }, "INSERT INTO public.family_links (studio_id, guardian_id, token_hash) VALUES ($1, $2, 'hash-2')", [other, guardian]))).toMatch(/foreign key/i);
    expect(await rejection(db.query({ user: owner }, "INSERT INTO public.family_links (studio_id, guardian_id, token_hash) VALUES ($1, $2, 'hash-1')", [owner, guardian]))).toMatch(/unique|duplicate/i);
    expect(await rejection(db.query({ user: owner }, "UPDATE public.family_links SET token_hash = 'other' WHERE id = $1", [link.id]))).toMatch(/permission denied/i);
    await db.query({ user: owner }, "UPDATE public.family_links SET revoked_at = now() WHERE id = $1", [link.id]);
    expect(await rejection(db.query({ user: owner }, "UPDATE public.family_links SET revoked_at = NULL WHERE id = $1", [link.id]))).toMatch(/revoked/i);
    expect(await rejection(db.query({ user: owner }, "DELETE FROM public.family_links WHERE id = $1", [link.id]))).toMatch(/permission denied/i);
  });
});
