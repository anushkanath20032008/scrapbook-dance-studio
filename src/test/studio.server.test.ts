import { describe, expect, it } from "vitest";
import { ensureStudio, friendlyError, unwrap } from "@/lib/studio.server";
import { firstOfMonth, isoDate, likePattern, paise, todayInIndia } from "@/lib/validators";
import { fakeSupabase, stepsOf } from "./fake-supabase";

describe("friendlyError", () => {
  it("passes through messages our SQL raised on purpose", () => {
    expect(friendlyError({ code: "P0001", message: "fee plan is archived" }).message).toBe(
      "fee plan is archived",
    );
  });

  it("hides table and constraint names behind readable messages", () => {
    const unique = friendlyError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "students_pkey"',
    });
    expect(unique.message).toBe("That already exists.");
    expect(unique.message).not.toMatch(/students|constraint/i);
    expect(
      friendlyError({ code: "23503", message: "violates foreign key constraint fk" }).message,
    ).toMatch(/another studio/);
    expect(
      friendlyError({ code: "42501", message: 'permission denied for table "payments"' }).message,
    ).toBe("You don't have access to that.");
    expect(friendlyError({ code: "XX000", message: "internal: secret detail" }).message).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("unwrap", () => {
  it("returns data, throws a friendly error, and treats a missing row as not found", () => {
    expect(unwrap({ data: { id: 1 }, error: null })).toEqual({ id: 1 });
    expect(() => unwrap({ data: null, error: { code: "23505", message: "dup" } })).toThrow(
      "That already exists.",
    );
    expect(() => unwrap({ data: null, error: null })).toThrow("not found");
  });
});

describe("ensureStudio", () => {
  it("creates the profile row only when it is missing and uses the user id as the studio id", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    const studio = await ensureStudio({
      supabase: client,
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(studio.studioId).toBe("11111111-1111-4111-8111-111111111111");
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("studio_profiles");
    expect(stepsOf(calls[0], "upsert")).toEqual([
      [
        { user_id: "11111111-1111-4111-8111-111111111111" },
        { onConflict: "user_id", ignoreDuplicates: true },
      ],
    ]);
  });

  it("reports a failure to create the profile", async () => {
    const { client } = fakeSupabase(() => ({ error: { code: "42501", message: "denied" } }));
    await expect(
      ensureStudio({ supabase: client, userId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toThrow("access");
  });
});

describe("shared validators", () => {
  it("accepts real calendar dates only", () => {
    expect(isoDate.safeParse("2026-10-16").success).toBe(true);
    expect(isoDate.safeParse("2026-02-30").success).toBe(false);
    expect(isoDate.safeParse("16-10-2026").success).toBe(false);
  });

  it("accepts positive whole paise within a sane maximum", () => {
    expect(paise.safeParse(90000).success).toBe(true);
    for (const bad of [0, -1, 10.5, 1_000_000_001])
      expect(paise.safeParse(bad).success, String(bad)).toBe(false);
  });

  it("normalizes a date to the first of its month and today to India time", () => {
    expect(firstOfMonth("2026-10-17")).toBe("2026-10-01");
    expect(todayInIndia(new Date("2026-10-16T20:00:00Z"))).toBe("2026-10-17");
    expect(todayInIndia(new Date("2026-10-16T05:00:00Z"))).toBe("2026-10-16");
  });

  it("escapes wildcard characters in search terms", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
