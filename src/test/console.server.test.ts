import { describe, expect, it } from "vitest";
import { getConsoleContext } from "@/lib/console.server";
import { fakeSupabase } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";

describe("getConsoleContext", () => {
  it("creates the profile for a first-time owner and reports the default plan", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.fn === "has_role") return { data: false };
      return { data: null };
    });
    const result = await getConsoleContext({ supabase: client, userId: user });
    expect(result).toEqual({
      ownerName: "",
      studioName: "",
      plan: "waitlist",
      billingStatus: "not_started",
      isPlatformOwner: false,
    });
    // The profile is created through an insert-or-ignore, never an overwrite.
    expect(calls.some((call) => call.steps.some(([name]) => name === "upsert"))).toBe(true);
  });

  it("returns the saved studio details and plan", async () => {
    const { client } = fakeSupabase((call) => {
      if (call.fn === "has_role") return { data: false };
      if (call.table === "studio_profiles" && call.steps.some(([name]) => name === "maybeSingle")) {
        return {
          data: {
            name: "Asha",
            studio_name: "Rhythm House",
            plan: "growth",
            billing_status: "active",
          },
        };
      }
      return {};
    });
    expect(await getConsoleContext({ supabase: client, userId: user })).toMatchObject({
      ownerName: "Asha",
      studioName: "Rhythm House",
      plan: "growth",
      billingStatus: "active",
    });
  });

  it("takes the platform owner role from the role check only", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.fn === "has_role" ? { data: true } : {},
    );
    const result = await getConsoleContext({ supabase: client, userId: user });
    expect(result.isPlatformOwner).toBe(true);
    const roleCall = calls.find((call) => call.fn === "has_role");
    expect(roleCall?.args).toEqual([{ _user_id: user, _role: "owner" }]);
  });

  it("fails with a friendly message when the role check errors", async () => {
    const { client } = fakeSupabase((call) =>
      call.fn === "has_role" ? { error: { code: "XX000", message: "internal detail" } } : {},
    );
    await expect(getConsoleContext({ supabase: client, userId: user })).rejects.toThrow(
      "Could not load your studio.",
    );
  });
});
